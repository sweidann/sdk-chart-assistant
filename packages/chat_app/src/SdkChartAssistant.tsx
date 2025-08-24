
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CONFIG } from '../../shared/src/constants';
import './styles.css';
import axios from 'axios';
// import OpenAI from 'openai';
// Remove chart preview - handled by separate preview app
// import DataMapper from './utils/DataMapper';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type AppMode = 'initial' | 'chart-building' | 'chart-editing';

const SdkChartAssistant = () => {
  // console.log({ context, prompts, data, drillDown });
  // console.log('Data structure:', JSON.stringify(data, null, 2));
  
  const [currentMode, setCurrentMode] = useState<AppMode>('initial');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // No chart state needed - charts handled by preview app

  // Extract data sample for LLM
  // const dataSample = useMemo(() => {
  //   if (!data || !data.data || data.data.length === 0) {
  //     return null;
  //   }
  //   try {
  //     return DataSampler.extractSample(data, 5);
  //   } catch (error) {
  //     console.error('Error extracting data sample:', error);
  //     return null;
  //   }
  // }, [data]);

  // // Log data sample for debugging
  // useEffect(() => {
  //   if (dataSample) {
  //     console.log('=== Data Sample for LLM ===');
  //     console.log('Sample:', dataSample);
  //     console.log('Formatted for LLM:');
  //     console.log(DataSampler.formatForLLM(dataSample));
  //   }
  // }, [dataSample]);





  const getSystemPrompt = () => {
    // const dataContext = dataSample ? DataSampler.formatForLLM(dataSample) : '';
    // const transformationGuidance = DataSampler.getTransformationPrompt();

    return `
You are an expert data visualization assistant specialized in creating Highcharts configurations.

CONTEXT: You're working with query data from an analytics platform. Users will describe their data and visualization needs.



CAPABILITIES:
1. Analyze the provided data sample and recommend optimal chart types
2. Generate complete Highcharts configuration objects
3. Explain visualization choices with clear reasoning
4. Suggest data transformations when needed
5. Adapt charts based on user feedback

IMPORTANT: Use the ACTUAL data from the sample above in your Highcharts configuration. The categories and data values should match the real data provided.

RESPONSE FORMAT: Always respond with JSON containing:
{
  "explanation": "Clear explanation of chart choice, data analysis, and any suggested transformations",
  "chartType": "bar|line|pie|scatter|area|column",
  "confidence": 0.9,
  "highchartsConfig": { 
    /* Complete Highcharts options using REAL data from the sample */
    "series": [{"name": "ActualColumnName", "data": [real, data, values]}],
    "xAxis": {"categories": ["real", "category", "names"]}
  },
  "dataTransformations": ["Optional: List any data transformations you recommend"],
  "insights": ["Data insight 1 based on actual data", "Data insight 2"],
  "alternatives": [{"type": "line", "reason": "Better for trends if data was time-based"}]
}

CHART TYPE GUIDELINES:
- Bar/Column: Comparisons between categories (like the data sample shows)
- Line: Trends over time (if temporal data is present)
- Pie: Part-to-whole relationships (good for categorical breakdowns)
- Scatter: Correlations between two variables
- Area: Cumulative values over time

CRITICAL: Always use the real data from the sample in your Highcharts configuration. Never use placeholder data.
Use the data analysis above to make informed recommendations. Always prioritize data clarity and user experience.
    `;
  };

  const sessionIdRef = useRef<string | null>(null);
  if (sessionIdRef.current === null) {
    const isDev = import.meta.env.MODE !== 'production';
    if (isDev && CONFIG.DEFAULT_SESSION_ID) {
      sessionIdRef.current = CONFIG.DEFAULT_SESSION_ID;
    } else {
      const existing = sessionStorage.getItem('wsSessionId');
      if (existing) {
        sessionIdRef.current = existing;
      } else {
        const sid = Math.random().toString(36).slice(2);
        sessionStorage.setItem('wsSessionId', sid);
        sessionIdRef.current = sid;
      }
    }
  }
  const sessionId = sessionIdRef.current as string;

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) {
    e.preventDefault();
      e.stopPropagation();
    }
    if (!currentInput.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentInput,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, userMessage]);
    setCurrentInput('');
    setIsLoading(true);

    try {
      // Send request to FastAPI pipeline instead of direct LLM call
      axios.post('http://localhost:8080/chat/process', {
        prompt: currentInput,
        // dataContext: dataSample,
        mode: currentMode,
        sessionId
      }).then((response: any) => {
        console.log({ response });
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          type: 'assistant',
          content: response.data.explanation || 'No response received',
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, assistantMessage]);
      });
      




//           const completion = `json
// {
//   "explanation": "Using a column chart lets us compare the number of products within each category side‑by‑side, which is ideal for a simple count comparison across groups. The x‑axis lists categories, while the y‑axis shows the aggregated product counts. This format is easy to read and immediately highlights which category contains the most products.",
//   "chartType": "column",
//   "confidence": 0.9,
//   "highchartsConfig": {
//     "chart": {
//       "type": "column"
//     },
//     "title": {
//       "text": "Number of Products per Category"
//     },
//     "xAxis": {
//       "categories": ["Category A", "Category B", "Category C"],
//       "title": {
//         "text": "Category"
//       }
//     },
//     "yAxis": {
//       "min": 0,
//       "title": {
//         "text": "Product Count"
//       },
//       "labels": {
//         "format": "{value}"
//       }
//     },
//     "tooltip": {
//       "shared": true,
//       "pointFormat": "<b>{point.y}</b> products"
//     },
//     "plotOptions": {
//       "column": {
//         "dataLabels": {
//           "enabled": true
//         }
//       }
//     },
//     "series": [
//       {
//         "name": "Products",
//         "data": [2, 2, 1]
//       }
//     ]
//   },
//   "insights": [
//     "Category A and B lead with the highest number of products, each having 2 items.",
//     "Category C is the smallest group with only 1."
//   ],
//   "alternatives": [
//     {
//       "type": "bar",
//       "reason": "A horizontal bar chart can be more readable for long category names."
//     },
//     {
//       "type": "pie",
//       "reason": "A pie chart provides a quick visual of each category’s share of the total, but only if you have fewer than 7 categories."
//     }
//   ]
// }
//           `;
        
      // FastAPI returns only the explanation for chat display

      
      // FastAPI handles chart generation and sends to preview app directly
      // No chart processing needed in chat app
      
      if (currentMode === 'initial') {
        setCurrentMode('chart-building');
      }

          // console.log(completion);
    } catch (err) {
      console.error(err);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 3).toString(),
        type: 'assistant',
        content: 'Error calling API. Please try again.',
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const handleButtonClick = () => {
    handleSubmit();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getPlaceholderText = () => {
    switch (currentMode) {
      case 'initial':
        return 'Describe your data';
      case 'chart-building':
      case 'chart-editing':
        return 'How would you like to modify the chart?';
      default:
        return 'Type your message...';
    }
  };



  return (
    <div className="sdk-chart-assistant">
      <div className="assistant-container">
        {/* Chat Interface Only - Charts handled by preview app */}
        {/* Chat Section */}
        <div className="chat-section">
          <div className="chat-header">
            <h3>Chart Assistant</h3>
          </div>
          
          <div className="chat-history">
            {chatHistory.length === 0 && currentMode === 'initial' ? (
              <div className="welcome-message">
                <h4>Welcome to Chart Assistant!</h4>
                <p>I can see your data is ready for analysis. Describe what kind of chart you'd like to create!</p>
                <p style={{fontSize: 12, opacity: 0.7}}>Session: {sessionId}</p>
                
              </div>
            ) : (
              chatHistory.map((message) => (
                <div key={message.id} className={`chat-message ${message.type}`}>
                  <div className="message-content">
                    {message.content}
                  </div>
                  <div className="message-timestamp">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="chat-message assistant loading">
                <div className="message-content">
                  <div className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  Analyzing your data...
                </div>
              </div>
            )}
          </div>

          <div className="chat-input-form">
            <div className="input-container">
              <input
                type="text"
                value={currentInput || 'i want a chart that displays products grouped by category'}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={getPlaceholderText()}
                disabled={isLoading}
                className="chat-input"
              />
              <button 
                type="button"
                onClick={handleButtonClick}
                disabled={isLoading || !currentInput.trim()}
                className="btn btn-primary"
              >
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SdkChartAssistant;
