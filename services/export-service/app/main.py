from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Any, Dict, Optional
import os
import tempfile
import shutil
import subprocess
import json
import asyncio
from pathlib import Path

app = FastAPI(title="Incorta Chart Assistant Export Service", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://localhost:3001"],  # Chat app and preview app URLs
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

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "export-service"}

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
    
    return f'''import React from 'react';
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
