# Export Service

FastAPI service for exporting chart configurations as Incorta components.

## Setup

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the service:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
   ```

## API Endpoints

### POST /export
Export a chart configuration as an Incorta component.

**Request Body:**
```json
{
  "projectName": "my-chart-component",
  "chartConfig": {
    "type": "bar",
    "title": "Sample Chart",
    "explanation": "A sample bar chart",
    "confidence": 0.95,
    "highchartsConfig": { ... }
  }
}
```

**Response:**
```json
{
  "success": true,
  "downloadUrl": "/download/my-chart-component.inc"
}
```

### GET /download/{filename}
Download the generated .inc file.

### GET /health
Health check endpoint.

## Development

The service automatically:
1. Creates a new Incorta component using `create-incorta-component`
2. Updates the component with the provided chart configuration
3. Builds the component to generate the .inc file
4. Provides a download URL for the generated file

## Requirements

- Node.js (for running `create-incorta-component`)
- Python 3.8+
- FastAPI dependencies (see requirements.txt)