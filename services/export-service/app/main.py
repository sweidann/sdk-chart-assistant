from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import google.generativeai as genai
from typing import Any, Dict, Optional
import os
import tempfile
import shutil
import subprocess
import json
import asyncio
import httpx
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
load_dotenv(ROOT_DIR / ".env")

app = FastAPI(title="Incorta Chart Assistant Export Service", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",  # preview app
        "http://localhost:5173",  # chat app
        "http://127.0.0.1:5173",  # chat app
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChartConfig(BaseModel):
    type: str
    title: str
    explanation: str
    confidence: float
    highchartsConfig: Dict[str, Any]

class ExportRequest(BaseModel):
    projectName: str
    chartConfig: ChartConfig

class ExportResponse(BaseModel):
    success: bool
    downloadUrl: Optional[str] = None
    error: Optional[str] = None

class ChatRequest(BaseModel):
    prompt: str
    dataContext: Optional[Dict[str, Any]] = None
    mode: str = "initial"
    sessionId: Optional[str] = None

class ChatResponse(BaseModel):
    explanation: str
    dataSource: Optional[Dict[str, Any]] = None
    displayFormat: Optional[Dict[str, Any]] = None
    dataTransformation: Optional[Dict[str, Any]] = None
    chartConfig: Optional[Dict[str, Any]] = None
    success: bool = True

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "export-service"}


@app.post("/chat/process", response_model=ChatResponse)
async def process_chat(request: ChatRequest):
    """
    Process chat prompt with LLM and send chart instructions to preview app
    """
    try:
        # Before LLM: request a data sample from preview over WS if sessionId provided
        # effective_context = request.dataContext
        if request.sessionId:
            try:
                effective_context = await request_data_sample(request.sessionId)
                print(f"no exception happened")
            except Exception:
                effective_context = request.dataContext
        print(f"effective_context: {effective_context}")
        print(f"request.prompt: {request.prompt}")
        # Call LLM with user prompt and data context (possibly the preview-provided sample)
        llm_response = await call_llm(request.prompt, effective_context)
        # print(f"llm_response: {llm_response}")
        # Broadcast LLM response via WebSocket to the session, if provided
        print(f"request.sessionId: {request.sessionId}")
        print(f"llm_response: {llm_response}")
        if request.sessionId and llm_response:
            await manager.broadcast_to_session(
                request.sessionId,
                {
                    "type": "CHART_UPDATE",
                    "payload": {
                        "explanation": llm_response.get("explanation", ""),
                        "chartConfig": llm_response.get("chartConfig", {}),
                        "dataSource": llm_response.get("dataSource", {}),
                        "displayFormat": llm_response.get("displayFormat", {}),
                        "dataTransformation": llm_response.get("dataTransformation", {})
                    },
                },
            )
            print(f"broadcasted to session: {request.sessionId}")
        # Optional: also try to send to preview app HTTP endpoint (best-effort)
        # if llm_response.get("chartInstructions"):
        #     await send_to_preview_app(llm_response["chartInstructions"])
        
        return ChatResponse(
            explanation=llm_response.get("explanation", "No response received"),
            chartConfig=llm_response.get("chartConfig", {}),
            dataSource=llm_response.get("dataSource", {}),
            displayFormat=llm_response.get("displayFormat", {}),
            dataTransformation=llm_response.get("dataTransformation", {}),
            success=True
        )
        
    except Exception as e:
        return ChatResponse(
            explanation=f"Error processing request: {str(e)}",
            success=False
        )

@app.post("/export", response_model=ExportResponse)
async def export_project(request: ExportRequest):
    """
    Export a chart configuration as an Incorta component
    """
    try:
        # Create temporary directory for the project
        with tempfile.TemporaryDirectory() as temp_dir:
            project_path = Path(temp_dir) / request.projectName
            
            # Create the component using create-incorta-component
            await create_component(project_path, request.projectName)
            
            # Update the component with chart configuration
            await update_component(project_path, request.chartConfig)
            
            # Build the component
            build_result = await build_component(project_path)
            
            if not build_result:
                raise HTTPException(status_code=500, detail="Failed to build component")
            
            # Find the generated .inc file
            inc_file = find_inc_file(project_path)
            
            if not inc_file:
                raise HTTPException(status_code=500, detail="No .inc file generated")
            
            # Copy to a permanent location for download
            download_dir = Path("downloads")
            download_dir.mkdir(exist_ok=True)
            
            download_file = download_dir / f"{request.projectName}.inc"
            shutil.copy2(inc_file, download_file)
            
            return ExportResponse(
                success=True,
                downloadUrl=f"/download/{request.projectName}.inc"
            )
            
    except Exception as e:
        return ExportResponse(
            success=False,
            error=str(e)
        )

@app.get("/download/{filename}")
async def download_file(filename: str):
    """Download the generated .inc file"""
    file_path = Path("downloads") / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream"
    )

@app.get("/preview/data_sample")
async def get_data_sample(data_context: Dict[str, Any]):
    """Get the data sample"""
    return {"data": data_context}

# ------------------ WebSocket Session Manager ------------------
class ConnectionManager:
    def __init__(self) -> None:
        # session_id -> set of websockets
        self.active_sessions: Dict[str, set[WebSocket]] = {}
        # session_id -> latest sample payload
        self.latest_sample: Dict[str, Any] = {}
        # session_id -> list of futures waiting for sample
        self.sample_waiters: Dict[str, list[asyncio.Future]] = {}

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if session_id not in self.active_sessions:
            self.active_sessions[session_id] = set()
        self.active_sessions[session_id].add(websocket)
        print(f"WS CONNECT: Client connected to session '{session_id}'. Total clients: {len(self.active_sessions[session_id])}")

    def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        try:
            if session_id in self.active_sessions and websocket in self.active_sessions[session_id]:
                self.active_sessions[session_id].remove(websocket)
                print(f"WS DISCONNECT: Client removed from session '{session_id}'. Remaining clients: {len(self.active_sessions.get(session_id, []))}")
            if session_id in self.active_sessions and not self.active_sessions[session_id]:
                del self.active_sessions[session_id]
                print(f"WS DISCONNECT: Session '{session_id}' closed.")
        except Exception as e:
            print(f"WS DISCONNECT ERROR: {e}")

    async def broadcast_to_session(self, session_id: str, message: Dict[str, Any]) -> None:
        if session_id not in self.active_sessions or not self.active_sessions[session_id]:
            print(f"WS BROADCAST: No active clients in session '{session_id}' to send to.")
            return
        
        websockets = list(self.active_sessions[session_id])
        print(f"WS BROADCAST: Sending to {len(websockets)} client(s) in session '{session_id}'.")
        for ws in websockets:
            try:
                await ws.send_json(message)
            except Exception as e:
                print(f"WS BROADCAST ERROR: Failed to send to a client in session '{session_id}': {e}")
                # Best-effort; drop broken sockets
                self.disconnect(session_id, ws)


manager = ConnectionManager()


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(session_id, websocket)
    try:
        while True:
            message = await websocket.receive_json()
            print(f"WS MESSAGE RECEIVED from session '{session_id}': {message}")
            
            # Preview responds with data sample
            if isinstance(message, dict) and message.get("type") == "DATA_SAMPLE_RESPONSE":
                payload = message.get("payload")
                manager.latest_sample[session_id] = payload
                # notify any waiters
                if session_id in manager.sample_waiters:
                    waiters = manager.sample_waiters.pop(session_id)
                    for fut in waiters:
                        if not fut.done():
                            fut.set_result(payload)
    except WebSocketDisconnect:
        print(f"WS DISCONNECT: Session '{session_id}' disconnected normally")
        manager.disconnect(session_id, websocket)
    except Exception as e:
        print(f"WS ERROR: Session '{session_id}' error: {e}")
        manager.disconnect(session_id, websocket)

async def create_component(project_path: Path, project_name: str):
    """Create a new Incorta component"""
    try:
        process = await asyncio.create_subprocess_exec(
            "npx", "create-incorta-component", "new", str(project_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            raise Exception(f"Failed to create component: {stderr.decode()}")
            
    except Exception as e:
        raise Exception(f"Error creating component: {str(e)}")

async def update_component(project_path: Path, chart_config: ChartConfig):
    """Update the component with chart configuration"""
    try:
        # Read the main component file
        main_component_file = project_path / "src" / "index.tsx"
        
        if not main_component_file.exists():
            raise Exception("Main component file not found")
        
        # Generate the chart component code
        chart_code = generate_chart_component(chart_config)
        
        # Write the updated component
        with open(main_component_file, 'w') as f:
            f.write(chart_code)
            
    except Exception as e:
        raise Exception(f"Error updating component: {str(e)}")

async def build_component(project_path: Path):
    """Build the component"""
    try:
        # Change to project directory and run build
        process = await asyncio.create_subprocess_exec(
            "npm", "run", "build",
            cwd=project_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        return process.returncode == 0
        
    except Exception as e:
        return False

def find_inc_file(project_path: Path) -> Optional[Path]:
    """Find the generated .inc file"""
    dist_dir = project_path / "dist"
    
    if not dist_dir.exists():
        return None
    
    for file in dist_dir.glob("*.inc"):
        return file
    
    return None

def generate_chart_component(chart_config: ChartConfig) -> str:
    """Generate the React component code for the chart"""
    highcharts_config = json.dumps(chart_config.highchartsConfig, indent=2)
    
    return f''' import React from 'react';
                import {{ useQuery }} from '@incorta-org/component-sdk';
                import Highcharts from 'highcharts';
                import HighchartsReact from 'highcharts-react-official';

                interface Props {{
                query: string;
                }}

                const ChartComponent: React.FC<Props> = ({{ query }}) => {{
                const {{ data, loading, error }} = useQuery(query);

                if (loading) return <div>Loading...</div>;
                if (error) return <div>Error: {{error.message}}</div>;

                const chartOptions = {highcharts_config};

                return (
                    <div style={{{{ width: '100%', height: '400px' }}}}>
                    <HighchartsReact
                        highcharts={{Highcharts}}
                        options={{chartOptions}}
                    />
                    </div>
                );
                }};

                export default ChartComponent;
            '''

async def request_data_sample(session_id: str, timeout_seconds: int = 5) -> Dict[str, Any]:
    """Ask the preview app for a data sample over WS and wait for reply."""
    print(f"DATA SAMPLE REQUEST: Requesting sample from session '{session_id}'")
    
    # prepare waiter
    fut: asyncio.Future = asyncio.get_event_loop().create_future()
    manager.sample_waiters.setdefault(session_id, []).append(fut)
    
    # broadcast request
    await manager.broadcast_to_session(session_id, {"type": "DATA_SAMPLE_REQUEST"})
    
    try:
        result = await asyncio.wait_for(fut, timeout=timeout_seconds)
        print(f"DATA SAMPLE RESPONSE: Received sample from session '{session_id}'")
        return result or {}
    except asyncio.TimeoutError:
        print(f"DATA SAMPLE TIMEOUT: No response from session '{session_id}' in {timeout_seconds}s, using cached sample")
        # fallback to latest cached sample if any
        return manager.latest_sample.get(session_id, {})

async def call_llm(prompt: str, data_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Call LLM with prompt and data context
    """
    # You'll need to set your OpenRouter API key in environment
    api_key = os.getenv("OPENROUTER_API_KEY")
    print(f"api_key: {api_key}")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY environment variable not set")
    
    # Format data context for LLM
    context_str = ""
    if data_context:
        context_str = f"Data Context: {json.dumps(data_context, indent=2)}"
    
    system_prompt = f"""
You are an expert data visualization assistant with deep knowledge of data analysis patterns and visualization best practices.

{context_str}

## Your Task
Analyze the data structure (headers, column types, relationships) and user request to provide intelligent visualization recommendations.

## Data Handling 
The preview app automatically converts Incorta's data format (arrays of {{value, formatted}} objects) to the format each visualization library expects:
- **Highcharts**: Converts to {{name, value}} objects  
- **Tables**: Extracts headers and flattens cell values
- **HTML**: Creates simple item lists

## Your Focus Areas

1. **Data Source Strategy**: Use existing data or write custom queries
2. **Visualization Design**: Select the best chart type and styling  
3. **User Experience**: Provide clear explanations and reasoning

## Response Format

Respond with JSON containing:
{{
  "explanation": "Detailed explanation of your choices, data insights, and why this visualization approach works best for the user's request",
  
  "dataSource": {{
    "type": "useQuery",  // Use "useQuery" for existing data, "customQuery" for custom SQL
    "query": null  // Only provide SQL if using customQuery
  }},
  
  "displayFormat": {{
    "type": "highcharts",  // "highcharts" | "table" | "html"
    "subtype": "column"    // Chart-specific: "bar"|"column"|"line"|"pie"|"scatter"|"area" etc.
  }},
  
  "dataTransformation": {{
    "steps": [],  // Leave empty - auto-detection handles this intelligently
    "outputFormat": {{
      "structure": "array",
      "example": "Smart transformation will adapt automatically based on data structure and chart type"
    }}
  }},
  
  "chartConfig": {{
    "title": "Descriptive Visualization Title",
    "additionalOptions": {{
      // For Highcharts: Provide complete Highcharts configuration object
      // Focus on styling, colors, legends, tooltips, axes formatting
      // The data (series/categories) will be automatically populated from real data
      
      "chart": {{ "type": "column", "backgroundColor": "#f8f9fa" }},
      "title": {{ "text": "Your Title", "style": {{ "fontSize": "18px", "fontWeight": "bold" }} }},
      "xAxis": {{ 
        "title": {{ "text": "Category" }},
        "labels": {{ "rotation": -45 }}
      }},
      "yAxis": {{ 
        "title": {{ "text": "Count" }},
        "min": 0
      }},
      "plotOptions": {{
        "column": {{ 
          "colorByPoint": true,
          "dataLabels": {{ "enabled": true }}
        }}
      }},
      "legend": {{ "enabled": false }},
      "tooltip": {{
        "formatter": "function() {{ return '<b>' + this.point.name + '</b>: ' + this.y; }}"
      }}
    }}
  }}
}}

## Key Principles
- **Simple data conversion**: The system automatically converts Incorta format to visualization format
- **Focus on design**: Provide beautiful, meaningful chart configurations with proper styling
- **User-centric**: Explain your reasoning clearly and suggest improvements
- **Let LLM decide**: Choose the best chart type and styling based on data structure and user intent

Remember: You design the visualization experience, the system handles the format conversion.
"""
    use_gemini = False
    try:
        # client = OpenAI(
        #     base_url="https://openrouter.ai/api/v1",
        #     api_key=api_key,
        # )

        # response = client.chat.completions.create(
        #     model="deepseek/deepseek-r1:free",
        #     messages=[
        #         {"role": "system", "content": system_prompt},
        #         {"role": "user", "content": prompt},
        #     ],
        # )
        if use_gemini:
            genai.configure(api_key=os.environ["GEMINI_API_KEY"])

            # Initialize the model
            model = genai.GenerativeModel('gemini-2.5-flash-lite-preview-06-17')

            # Generate content
            chat = model.start_chat(history=[
                {'role': 'user', 'parts': [system_prompt]},
                {'role': 'model', 'parts': [prompt]},
            ])
            response = chat.send_message(prompt)
            # Print the response
            print(response.text)
        # Debug (optional):
        # print(response)
        # print("no llm call")
    except Exception as e:
        print(f"Error calling LLM: {e}")
        raise HTTPException(status_code=500, detail=f"LLM API error: {e}")

    # Extract content from SDK response
    try:
        if use_gemini:
            content = response.text or ""
        else:
            content = '''```json
{
  "explanation": "To display products grouped by category, we need to aggregate product counts by category. Using a custom query ensures we get pre-aggregated data efficiently. A column chart is ideal for comparing quantities across categories.",
  "dataSource": {
    "type": "customQuery",
    "query": "SELECT category_name, COUNT(*) as product_count FROM ProductCategories GROUP BY category_name ORDER BY product_count DESC;"
  },
  "displayFormat": {
    "type": "highcharts",
    "subtype": "column"
  },
  "dataTransformation": {
    "steps": [
      "Step 1: Group records by category_name",
      "Step 2: Count products in each category",
      "Step 3: Sort categories by product count descending"
    ],
    "outputFormat": {
      "structure": "array",
      "example": [
        {"category_name": "Electronics", "product_count": 12},
        {"category_name": "Clothing", "product_count": 8},
        {"category_name": "Books", "product_count": 5}
      ]
    }
  },
  "chartConfig": {
    "title": "Products by Category",
    "additionalOptions": {
      "chart": {
        "type": "column"
      },
      "title": {
        "text": "Products by Category"
      },
      "xAxis": {
        "type": "category",
        "title": {
          "text": "Category"
        }
      },
      "yAxis": {
        "title": {
          "text": "Number of Products"
        }
      },
      "series": [{
        "name": "Products",
        "data": []
      }],
      "plotOptions": {
        "column": {
          "dataLabels": {
            "enabled": true,
            "format": "{y}"
          }
        }
      }
    }
  }
}
'''
    except Exception:
        content = ""
    print(f"content: {content}")
    # Parse JSON response if present, else return explanation-only
    try:
        import re
        # Try to extract JSON from markdown code blocks first
        markdown_json_match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)
        if markdown_json_match:
            json_content = markdown_json_match.group(1)
        else:
            # Fallback to raw JSON extraction
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            json_content = json_match.group() if json_match else None
        
        if json_content:
            return json.loads(json_content)
        return {"explanation": content, "chartInstructions": None}
    except json.JSONDecodeError:
        return {"explanation": content, "chartInstructions": None}

async def send_to_preview_app(chart_instructions: Dict[str, Any]):
    """
    Send chart instructions to preview app
    """
    preview_app_url = "http://localhost:8000/api/chart/update"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                preview_app_url,
                json=chart_instructions,
                timeout=10.0
            )
            print(f"Sent to preview app: {response.status_code}")
        except Exception as e:
            print(f"Failed to send to preview app: {e}")
            # Don't fail the main request if preview app is down

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
