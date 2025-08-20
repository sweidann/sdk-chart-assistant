import React from 'react';
import { CONFIG } from '@incorta-chart-assistant/shared';

interface PreviewIframeProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  className?: string;
}

export const PreviewIframe: React.FC<PreviewIframeProps> = ({ 
  iframeRef, 
  className = '' 
}) => {
  return (
    <iframe
      ref={iframeRef}
      src={CONFIG.PREVIEW_ORIGIN}
      className={`preview-iframe ${className}`}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: '8px'
      }}
      title="Chart Preview"
      sandbox="allow-same-origin allow-scripts allow-forms"
    />
  );
};
