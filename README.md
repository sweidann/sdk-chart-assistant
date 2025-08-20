# Incorta Chart Assistant - Monorepo

A monorepo containing the Incorta Chart Assistant with live preview and export capabilities.

## Project Structure

```
├── packages/
│   ├── chat_app/          # Chat interface app
│   ├── preview_app/       # Chart preview app  
│   └── shared/            # Shared types and utilities
└── services/
    └── export-service/    # FastAPI export service
```

## Prerequisites

- Node.js v18 (use `nvm use` to switch)
- pnpm package manager
- Python 3.8+ (for export service)

## Setup

1. **Install Node.js v18:**
   ```bash
   nvm install 18
   nvm use 18
   ```

2. **Install all dependencies:**
   ```bash
   pnpm install:all
   ```
   This will install both Node.js and Python dependencies.

3. **Or setup manually:**
   ```bash
   # Install Node.js dependencies
   pnpm install
   
   # Setup Python virtual environment for export service
   pnpm setup:python
   
   # Build shared package
   pnpm --filter @incorta-chart-assistant/shared build
   ```

## Development

### Start all services:
```bash
pnpm dev
```

This will start:
- Chat app on `http://localhost:8000` (configured via CHAT_APP_PORT in .env)
- Preview app on `http://localhost:3001` 
- Export service on `http://localhost:8080`

### Start individual services:
```bash
# Chat app only
pnpm dev:chat

# Preview app only  
pnpm dev:preview

# Export service only (uses Python venv)
pnpm dev:export

# Or manually activate Python environment for export service
cd services/export-service
./activate.sh  # Shows available commands
uvicorn app.main:app --reload
```

## Architecture

### Communication Flow
1. **Chat App** (`packages/chat_app`): Main interface where users interact with the LLM
2. **Preview App** (`packages/preview_app`): Embedded iframe that renders chart previews
3. **Shared Package** (`packages/shared`): Common types and communication utilities
4. **Export Service** (`services/export-service`): FastAPI service for building and exporting components

### Message Protocol
The apps communicate via `window.postMessage` using a structured protocol defined in the shared package:

- `CHART_UPDATE`: Chat → Preview (send chart config and data)
- `CHART_READY`: Preview → Chat (confirm chart rendered)
- `EXPORT_REQUEST`: Chat → Preview (request component export)
- `EXPORT_COMPLETE`: Preview → Chat (export finished)

## Phase 0 Implementation Status ✅

- [x] Monorepo setup with pnpm workspaces
- [x] Node.js v18 configuration
- [x] Shared package with communication protocol
- [x] FastAPI export service structure
- [x] Iframe communication between chat and preview apps
- [x] TypeScript types and message utilities

## Next Steps (Phase 1)
- Integrate LLM-powered chat with live preview
- Connect export service to component generation
- Add error handling and loading states
- Implement chart editing via prompts