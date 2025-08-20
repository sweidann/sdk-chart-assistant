import { useEffect, useRef, useCallback } from 'react';
import { 
  MessageUtils, 
  ChartUpdateMessage, 
  ChartReadyMessage,
  ExportRequestMessage,
  ExportCompleteMessage,
  CONFIG,
  APP_SOURCES,
  MESSAGE_TYPES
} from '@incorta-chart-assistant/shared';

interface UsePreviewCommunicationProps {
  onChartReady?: (success: boolean, error?: string) => void;
  onExportComplete?: (success: boolean, downloadUrl?: string, error?: string) => void;
}

export const usePreviewCommunication = ({
  onChartReady,
  onExportComplete
}: UsePreviewCommunicationProps = {}) => {
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Setup message listener
  useEffect(() => {
    const cleanup = MessageUtils.addMessageListener(
      (message) => {
        switch (message.type) {
          case MESSAGE_TYPES.CHART_READY:
            const chartReadyMsg = message as ChartReadyMessage;
            onChartReady?.(chartReadyMsg.payload.success, chartReadyMsg.payload.error);
            break;
            
          case MESSAGE_TYPES.EXPORT_COMPLETE:
            const exportCompleteMsg = message as ExportCompleteMessage;
            onExportComplete?.(
              exportCompleteMsg.payload.success,
              exportCompleteMsg.payload.downloadUrl,
              exportCompleteMsg.payload.error
            );
            break;
        }
      },
      [CONFIG.PREVIEW_ORIGIN]
    );

    cleanupRef.current = cleanup;
    return cleanup;
  }, [onChartReady, onExportComplete]);

  // Send chart update to preview
  const sendChartUpdate = useCallback((chartConfig: any, data: any) => {
    if (!previewIframeRef.current?.contentWindow) {
      console.warn('Preview iframe not ready');
      return;
    }

    const message = MessageUtils.createMessage<ChartUpdateMessage>(
      MESSAGE_TYPES.CHART_UPDATE,
      APP_SOURCES.CHAT_APP,
      { chartConfig, data }
    );

    MessageUtils.postMessage(
      previewIframeRef.current.contentWindow,
      message,
      CONFIG.PREVIEW_ORIGIN
    );
  }, []);

  // Send export request
  const sendExportRequest = useCallback((projectName: string, chartConfig: any) => {
    if (!previewIframeRef.current?.contentWindow) {
      console.warn('Preview iframe not ready');
      return;
    }

    const message = MessageUtils.createMessage<ExportRequestMessage>(
      MESSAGE_TYPES.EXPORT_REQUEST,
      APP_SOURCES.CHAT_APP,
      { projectName, chartConfig }
    );

    MessageUtils.postMessage(
      previewIframeRef.current.contentWindow,
      message,
      CONFIG.PREVIEW_ORIGIN
    );
  }, []);

  return {
    previewIframeRef,
    sendChartUpdate,
    sendExportRequest
  };
};
