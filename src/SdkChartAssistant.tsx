import {
  AppliedPrompts,
  Context,
  onDrillDownFunction,
  ResponseData,
  TContext
} from '@incorta-org/component-sdk';
import React, { useState, useEffect, useMemo } from 'react';
import OpenAI from 'openai';
import DataAnalyzer, { DataInsights } from './utils/DataAnalyzer';
import ChartPreview, { ChartConfig } from './components/ChartPreview';
import ChartConfigGenerator from './utils/ChartConfigGenerator';

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
  console.log('Data structure:', JSON.stringify(data, null, 2));
  
  const [currentMode, setCurrentMode] = useState<AppMode>('initial');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Chart state management
  const [currentChart, setCurrentChart] = useState<ChartConfig | null>(null);
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);

  // Analyze data using DataAnalyzer
  const dataInsights = useMemo(() => {
    if (!data || !data.data || data.data.length === 0) {
      return null;
    }
    try {
      const analyzer = new DataAnalyzer(data);
      return analyzer.analyze();
    } catch (error) {
      console.error('Error analyzing data:', error);
      return null;
    }
  }, [data]);

  // Chart config generator
  const chartConfigGenerator = useMemo(() => {
    if (!data || !data.data || data.data.length === 0) {
      return null;
    }
    try {
      const analyzer = new DataAnalyzer(data);
      return new ChartConfigGenerator(analyzer);
    } catch (error) {
      console.error('Error creating chart config generator:', error);
      return null;
    }
  }, [data]);

  // Log data insights for debugging
  useEffect(() => {
    if (dataInsights) {
      console.log('=== Data Analysis Results ===');
      console.log('Columns:', dataInsights.columns.length);
      console.log('Row count:', dataInsights.rowCount);
      console.log('Data complexity:', dataInsights.dataComplexity);
      console.log('Has time column:', dataInsights.hasTimeColumn);
      console.log('Chart suggestions:', dataInsights.suggestedCharts.map(s => 
        `${s.type} (${Math.round(s.confidence * 100)}%): ${s.reasoning}`
      ));
      console.log('Full analysis:', dataInsights);
    }
  }, [dataInsights]);

  // Generate fallback chart when data is available but no chart has been created
  useEffect(() => {
    if (dataInsights && !currentChart && currentMode === 'initial' && chartConfigGenerator) {
      // Auto-generate a chart suggestion based on data analysis
      const fallbackChart = chartConfigGenerator.generateFallbackChart();
      if (fallbackChart) {
        setCurrentChart(fallbackChart);
      }
    }
  }, [dataInsights, currentChart, currentMode, chartConfigGenerator]);

  const getSystemPrompt = () => {
    const dataContext = dataInsights ? `
    
CURRENT DATA ANALYSIS:
- Total Rows: ${dataInsights.rowCount}
- Columns: ${dataInsights.columns.length}
- Data Complexity: ${dataInsights.dataComplexity}
- Has Time Data: ${dataInsights.hasTimeColumn ? 'Yes' : 'No'}
- Is Aggregated: ${dataInsights.isAggregated ? 'Yes' : 'No'}

AVAILABLE COLUMNS:
${dataInsights.columns.map(col => 
  `- ${col.name} (${col.dataType}, ${col.isMeasure ? 'Measure' : 'Dimension'}, ${col.uniqueValues} unique values)`
).join('\n')}

SUGGESTED CHART TYPES (by confidence):
${dataInsights.suggestedCharts.map(suggestion => 
  `- ${suggestion.type.toUpperCase()}: ${suggestion.reasoning} (confidence: ${Math.round(suggestion.confidence * 100)}%)`
).join('\n')}
    ` : '';

    return `
You are an expert data visualization assistant specialized in creating Highcharts configurations.

CONTEXT: You're working with query data from an analytics platform. Users will describe their data and visualization needs.
${dataContext}

CAPABILITIES:
1. Analyze data structure and recommend optimal chart types
2. Generate complete Highcharts configuration objects
3. Explain visualization choices with clear reasoning
4. Adapt charts based on user feedback
5. Suggest data insights and alternative visualizations

RESPONSE FORMAT: Always respond with JSON containing:
{
  "explanation": "Clear explanation of chart choice and insights",
  "chartType": "bar|line|pie|scatter|area|column",
  "confidence": 0.9,
  "highchartsConfig": { /* Complete Highcharts options */ },
  "insights": ["Data insight 1", "Data insight 2"],
  "alternatives": [{"type": "line", "reason": "Better for trends"}]
}

CHART TYPE GUIDELINES:
- Bar/Column: Comparisons between categories
- Line: Trends over time
- Pie: Part-to-whole relationships (limit to 5-7 slices)
- Scatter: Correlations between two variables
- Area: Cumulative values over time

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

    const apiKey = import.meta.env.VITE_API_KEY;
    
    if (!apiKey) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'API key not found. Please check your environment configuration.',
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, errorMessage]);
      setIsLoading(false);
      return;
    }

    try {
        const openai = new OpenAI({
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: apiKey,
          dangerouslyAllowBrowser: true
        });

          // const completion = await openai.chat.completions.create({
          //   model: "openai/gpt-oss-20b:free",
          //   messages: [
          //     {
          //       "role": "system",
          //       "content": getSystemPrompt()
          //     },
          //     {
          //       "role": "user",
          //       "content": currentInput
          //     }
          //   ],
          // });

          const completion = `json
{
  "explanation": "Using a column chart lets us compare the number of products within each category side‑by‑side, which is ideal for a simple count comparison across groups. The x‑axis lists categories, while the y‑axis shows the aggregated product counts. This format is easy to read and immediately highlights which category contains the most products.",
  "chartType": "column",
  "confidence": 0.9,
  "highchartsConfig": {
    "chart": {
      "type": "column"
    },
    "title": {
      "text": "Number of Products per Category"
    },
    "xAxis": {
      "categories": ["Category A", "Category B", "Category C"],
      "title": {
        "text": "Category"
      }
    },
    "yAxis": {
      "min": 0,
      "title": {
        "text": "Product Count"
      },
      "labels": {
        "format": "{value}"
      }
    },
    "tooltip": {
      "shared": true,
      "pointFormat": "<b>{point.y}</b> products"
    },
    "plotOptions": {
      "column": {
        "dataLabels": {
          "enabled": true
        }
      }
    },
    "series": [
      {
        "name": "Products",
        "data": [2, 2, 1]
      }
    ]
  },
  "insights": [
    "Category A and B lead with the highest number of products, each having 2 items.",
    "Category C is the smallest group with only 1."
  ],
  "alternatives": [
    {
      "type": "bar",
      "reason": "A horizontal bar chart can be more readable for long category names."
    },
    {
      "type": "pie",
      "reason": "A pie chart provides a quick visual of each category’s share of the total, but only if you have fewer than 7 categories."
    }
  ]
}
          `;
        
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        type: 'assistant',
        // content: completion.choices[0].message.content || 'No response received',
        content: completion,
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, assistantMessage]);
      
      // Generate chart from LLM response
      if (chartConfigGenerator) {
        setIsGeneratingChart(true);
        try {
          // const chartConfig = chartConfigGenerator.generateFromLLMResponse(
          //   completion.choices[0].message.content || ''
          // );
          const chartConfig = chartConfigGenerator.generateFromLLMResponse(completion);
          if (chartConfig) {
            setCurrentChart(chartConfig);
          }
        } catch (chartError) {
          console.error('Error generating chart:', chartError);
        }
        setIsGeneratingChart(false);
      }
      
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

  console.log("transformed data", chartConfigGenerator?.getTransformedData(currentChart?.type || ''));

  return (
    <div className="sdk-chart-assistant">
      <div className="assistant-container">
        {/* Chart Preview Section */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Chart Preview</h3>
          </div>
          
          <div className="chart-container">
            <ChartPreview
              chartConfig={currentChart}
              transformedData={currentChart && chartConfigGenerator ? 
                chartConfigGenerator.getTransformedData(currentChart.type) : null
              }
              dataInsights={dataInsights}
              isLoading={isGeneratingChart}
              onChartReady={(chart) => {
                console.log('Chart ready:', chart);
              }}
            />
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
                {dataInsights && dataInsights.suggestedCharts.length > 0 && (
                  <div className="auto-suggestions">
                    <p><strong>Quick suggestions based on your data:</strong></p>
                    <ul>
                      {dataInsights.suggestedCharts.slice(0, 2).map((suggestion, index) => (
                        <li key={index}>
                          Try a <strong>{suggestion.type}</strong> chart - {suggestion.reasoning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
