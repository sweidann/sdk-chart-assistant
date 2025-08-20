import {
  AppliedPrompts,
  Context,
  onDrillDownFunction,
  ResponseData,
  TContext
} from '@incorta-org/component-sdk';
import React, { useState, useEffect, useMemo } from 'react';
import OpenAI from 'openai';
import ChartPreview, { ChartConfig } from './components/ChartPreview';
import DataSampler from './utils/DataSampler';
// import DataMapper from './utils/DataMapper';

interface Props {
  context: Context<TContext>;
  prompts: AppliedPrompts;
  data: ResponseData;
  drillDown: onDrillDownFunction;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type AppMode = 'initial' | 'chart-building' | 'chart-editing';

const SdkChartAssistant = ({ context, prompts, data, drillDown }: Props) => {
  console.log({ context, prompts, data, drillDown });
  // console.log('Data structure:', JSON.stringify(data, null, 2));
  
  const [currentMode, setCurrentMode] = useState<AppMode>('initial');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Chart state management
  const [currentChart, setCurrentChart] = useState<ChartConfig | null>(null);
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);

  // Extract data sample for LLM
  const dataSample = useMemo(() => {
    if (!data || !data.data || data.data.length === 0) {
      return null;
    }
    try {
      return DataSampler.extractSample(data, 5);
    } catch (error) {
      console.error('Error extracting data sample:', error);
      return null;
    }
  }, [data]);

  // Log data sample for debugging
  useEffect(() => {
    if (dataSample) {
      console.log('=== Data Sample for LLM ===');
      console.log('Sample:', dataSample);
      console.log('Formatted for LLM:');
      console.log(DataSampler.formatForLLM(dataSample));
    }
  }, [dataSample]);





  const getSystemPrompt = () => {
    const dataContext = dataSample ? DataSampler.formatForLLM(dataSample) : '';
    const transformationGuidance = DataSampler.getTransformationPrompt();

    return `
You are an expert data visualization assistant specialized in creating Highcharts configurations.

CONTEXT: You're working with query data from an analytics platform. Users will describe their data and visualization needs.

${dataContext}

${transformationGuidance}

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
        const openai = new OpenAI({
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: import.meta.env.VITE_API_KEY,
          dangerouslyAllowBrowser: true
        });

          const completion = await openai.chat.completions.create({
            model: "openai/gpt-oss-20b:free",
            messages: [
              {
                "role": "system",
                "content": getSystemPrompt()
              },
              {
                "role": "user",
                "content": currentInput
              }
            ],
          });
        
          console.log({ completion });

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
        
        let parsedResponse = null;
        try {
          // const jsonMatch = completion.match(/\{[\s\S]*\}/);
          const jsonMatch = completion.choices[0].message.content?.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResponse = JSON.parse(jsonMatch[0]);
            console.log({ parsedResponse });
          }
          // const parsedResponse = JSON.parse(completion.choices[0].message.content || '{}');
        } catch (error) {
          console.error('Error parsing JSON:', error);
        }
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        type: 'assistant',
        // content: completion.choices[0].message.content || 'No response received',
        content: parsedResponse?.explanation || 'No response received',
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, assistantMessage]);
      
              // Generate chart from LLM response
        setIsGeneratingChart(true);
        try {
          if (parsedResponse && parsedResponse.chartType && parsedResponse.highchartsConfig) {
            const chartConfig: ChartConfig = {
              type: parsedResponse.chartType,
              title: parsedResponse.highchartsConfig.title?.text || 'Chart',
              explanation: parsedResponse.explanation || '',
              confidence: parsedResponse.confidence || 0.8,
              highchartsOptions: parsedResponse.highchartsConfig
            };
            setCurrentChart(chartConfig);
          }
        } catch (chartError) {
          console.error('Error generating chart:', chartError);
        }
        setIsGeneratingChart(false);
      
      if (currentMode === 'initial') {
        setCurrentMode('chart-building');
      }

          console.log(completion);
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
        {/* Chart Preview Section */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Chart Preview</h3>
          </div>
          
          <div className="chart-container">
            {currentChart ? (
              <ChartPreview
                chartConfig={currentChart}
                isLoading={isGeneratingChart}
                onChartReady={(chart) => {
                  console.log('Chart ready:', chart);
                }}
              />
            ) : (
              <div className="chart-placeholder">
                <div className="placeholder-content">
                  <div className="placeholder-icon">📊</div>
                  <h4>Your chart will appear here</h4>
                  <p>Start a conversation to generate a chart visualization</p>
                </div>
              </div>
            )}
          </div>

                     <div className="chart-options">
             {/* {dataInsights && (
               <div className="options-content">
                 <h4>Data Analysis</h4>
                 <div className="data-insights">
                   <div className="insight-section">
                     <p><strong>Data Overview:</strong></p>
                     <ul>
                       <li>{dataInsights.rowCount.toLocaleString()} rows</li>
                       <li>{dataInsights.columns.length} columns</li>
                       <li>Complexity: {dataInsights.dataComplexity}</li>
                     </ul>
                   </div>
                   
                   <div className="insight-section">
                     <p><strong>Columns:</strong></p>
                     <ul>
                       {dataInsights.columns.slice(0, 3).map((col, index) => (
                         <li key={index}>
                           {col.name} ({col.dataType})
                           {col.isMeasure ? ' [Measure]' : ' [Dimension]'}
                         </li>
                       ))}
                       {dataInsights.columns.length > 3 && (
                         <li>... and {dataInsights.columns.length - 3} more</li>
                       )}
                     </ul>
                   </div>

                   {dataInsights.suggestedCharts.length > 0 && (
                     <div className="insight-section">
                       <p><strong>Chart Suggestions:</strong></p>
                       <ul>
                         {dataInsights.suggestedCharts.slice(0, 2).map((suggestion, index) => (
                           <li key={index}>
                             <strong>{suggestion.type.toUpperCase()}</strong> 
                             ({Math.round(suggestion.confidence * 100)}% confidence)
                           </li>
                         ))}
                       </ul>
                     </div>
                   )}
                 </div>
               </div>
             )} */}
             
             {/* {!dataInsights && currentMode !== 'initial' && (
               <div className="options-content">
                 <h4>Data Analysis</h4>
                 <div className="data-insights">
                   <p>No data available for analysis</p>
                 </div>
               </div>
             )} */}
           </div>
        </div>
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
                value={currentInput}
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
