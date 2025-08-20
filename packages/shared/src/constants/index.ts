// Environment configuration
export const CONFIG = {
  CHAT_ORIGIN: 'http://localhost:8000',
  PREVIEW_ORIGIN: 'http://localhost:3001',
  EXPORT_API_BASE: 'http://localhost:8080',
  PREVIEW_TEMPLATE_VERSION: 'latest'
} as const;

// Message types
export const MESSAGE_TYPES = {
  CHART_UPDATE: 'CHART_UPDATE',
  CHART_READY: 'CHART_READY',
  EXPORT_REQUEST: 'EXPORT_REQUEST',
  EXPORT_COMPLETE: 'EXPORT_COMPLETE'
} as const;

// Chart types supported
export const CHART_TYPES = {
  BAR: 'bar',
  COLUMN: 'column',
  LINE: 'line',
  AREA: 'area',
  PIE: 'pie',
  DONUT: 'donut',
  SCATTER: 'scatter'
} as const;

// App sources
export const APP_SOURCES = {
  CHAT_APP: 'chat-app',
  PREVIEW_APP: 'preview-app'
} as const;
