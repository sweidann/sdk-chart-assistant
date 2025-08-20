// Chart-related types
export interface ChartConfig {
  type: string;
  title: string;
  explanation: string;
  confidence: number;
  highchartsConfig: any;
}

// Communication protocol types
export interface MessageBase {
  id: string;
  timestamp: number;
  source: 'chat-app' | 'preview-app';
}

export interface ChartUpdateMessage extends MessageBase {
  type: 'CHART_UPDATE';
  payload: {
    chartConfig: ChartConfig;
    data: any;
  };
}

export interface ChartReadyMessage extends MessageBase {
  type: 'CHART_READY';
  payload: {
    success: boolean;
    error?: string;
  };
}

export interface ExportRequestMessage extends MessageBase {
  type: 'EXPORT_REQUEST';
  payload: {
    projectName: string;
    chartConfig: ChartConfig;
  };
}

export interface ExportCompleteMessage extends MessageBase {
  type: 'EXPORT_COMPLETE';
  payload: {
    success: boolean;
    downloadUrl?: string;
    error?: string;
  };
}

export type AppMessage = 
  | ChartUpdateMessage 
  | ChartReadyMessage 
  | ExportRequestMessage 
  | ExportCompleteMessage;

// Data types (from Incorta SDK)
export interface ResponseData {
  headers: Array<{
    name: string;
    type: string;
    aggregation?: string;
  }>;
  data: Array<any[]>;
  totalRows?: number;
}

// LLM Response types
export interface LLMResponse {
  chartType: string;
  title: string;
  explanation: string;
  confidence: number;
  highchartsConfig: any;
}
