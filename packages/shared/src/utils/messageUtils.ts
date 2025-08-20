import { AppMessage, MessageBase } from '../types';

export class MessageUtils {
  private static generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static createMessage<T extends AppMessage>(
    type: T['type'],
    source: MessageBase['source'],
    payload: T['payload']
  ): T {
    return {
      id: this.generateId(),
      timestamp: Date.now(),
      source,
      type,
      payload
    } as T;
  }

  static isValidMessage(data: any): data is AppMessage {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.id === 'string' &&
      typeof data.timestamp === 'number' &&
      ['chat-app', 'preview-app'].includes(data.source) &&
      ['CHART_UPDATE', 'CHART_READY', 'EXPORT_REQUEST', 'EXPORT_COMPLETE'].includes(data.type) &&
      data.payload !== undefined
    );
  }

  static postMessage(targetWindow: Window, message: AppMessage, targetOrigin: string = '*') {
    targetWindow.postMessage(message, targetOrigin);
  }

  static addMessageListener(
    callback: (message: AppMessage) => void,
    allowedOrigins: string[] = ['*']
  ): () => void {
    const handleMessage = (event: MessageEvent) => {
      // Check origin if specified
      if (!allowedOrigins.includes('*') && !allowedOrigins.includes(event.origin)) {
        return;
      }

      if (this.isValidMessage(event.data)) {
        callback(event.data);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }
}
