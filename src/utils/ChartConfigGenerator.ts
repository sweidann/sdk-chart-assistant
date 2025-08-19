import { ChartConfig } from '../components/ChartPreview';
import DataAnalyzer, { DataInsights } from './DataAnalyzer';

export interface LLMChartResponse {
  explanation?: string;
  chartType?: string;
  confidence?: number;
  highchartsConfig?: any;
  insights?: string[];
  alternatives?: Array<{type: string; reason: string}>;
}

export class ChartConfigGenerator {
  private dataAnalyzer: DataAnalyzer;
  private dataInsights: DataInsights;

  constructor(dataAnalyzer: DataAnalyzer) {
    this.dataAnalyzer = dataAnalyzer;
    this.dataInsights = dataAnalyzer.analyze();
  }

  /**
   * Parse LLM response and generate chart configuration
   */
  generateFromLLMResponse(llmResponse: string): ChartConfig | null {
    try {

      console.log({ llmResponse });
      // Try to parse JSON response from LLM
      const parsedResponse = this.parseLLMResponse(llmResponse);

      console.log({ parsedResponse });
      
      if (!parsedResponse || !parsedResponse.chartType) {
        // Fallback to intelligent suggestions if LLM response is not parseable
        return this.generateFallbackChart();
      }

      const chartType = parsedResponse.chartType.toLowerCase();
      const transformedData = this.dataAnalyzer.transformForChart(chartType);

      console.log('Transformed data for chart:', transformedData);

      // If LLM provides highchartsConfig, merge it with real data
      let finalHighchartsConfig = parsedResponse.highchartsConfig || {};
      
      if (parsedResponse.highchartsConfig && transformedData) {
        // Override LLM's mock data with real transformed data
        finalHighchartsConfig = {
          ...parsedResponse.highchartsConfig,
          series: transformedData.series || parsedResponse.highchartsConfig.series,
          xAxis: {
            ...parsedResponse.highchartsConfig.xAxis,
            categories: transformedData.categories || parsedResponse.highchartsConfig.xAxis?.categories
          }
        };
      }

      console.log('Final chart config:', {
        type: chartType,
        title: this.generateChartTitle(chartType),
        explanation: parsedResponse.explanation || '',
        confidence: parsedResponse.confidence || 0.8,
        highchartsOptions: finalHighchartsConfig
      });

      return {
        type: chartType,
        title: this.generateChartTitle(chartType),
        explanation: parsedResponse.explanation || '',
        confidence: parsedResponse.confidence || 0.8,
        highchartsOptions: finalHighchartsConfig
      };

    } catch (error) {
      console.error('Error generating chart config from LLM response:', error);
      return this.generateFallbackChart();
    }
  }

  /**
   * Generate a fallback chart based on data analysis
   */
  generateFallbackChart(): ChartConfig | null {
    const suggestions = this.dataInsights.suggestedCharts;
    
    if (suggestions.length === 0) {
      return null;
    }

    const bestSuggestion = suggestions[0];
    const transformedData = this.dataAnalyzer.transformForChart(bestSuggestion.type);

    return {
      type: bestSuggestion.type,
      title: this.generateChartTitle(bestSuggestion.type),
      explanation: bestSuggestion.reasoning,
      confidence: bestSuggestion.confidence,
      highchartsOptions: this.generateBasicHighchartsConfig(bestSuggestion.type, transformedData)
    };
  }

  /**
   * Generate chart from specific type request
   */
  generateFromType(chartType: string, userDescription?: string): ChartConfig | null {
    try {
      const normalizedType = chartType.toLowerCase();
      const transformedData = this.dataAnalyzer.transformForChart(normalizedType);

      return {
        type: normalizedType,
        title: this.generateChartTitle(normalizedType),
        explanation: userDescription || `${chartType} chart visualization of your data`,
        confidence: 0.9,
        highchartsOptions: this.generateBasicHighchartsConfig(normalizedType, transformedData)
      };

    } catch (error) {
      console.error('Error generating chart config from type:', error);
      return null;
    }
  }

  /**
   * Parse LLM response text to extract chart configuration
   */
  private parseLLMResponse(response: string): LLMChartResponse | null {
    try {
      // Try to find JSON in the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Try to extract chart type from text
      const chartTypeMatch = response.match(/(?:chart[:\s]+|type[:\s]+)(\w+)/i);
      if (chartTypeMatch) {
        return {
          chartType: chartTypeMatch[1],
          explanation: response,
          confidence: 0.7
        };
      }

      return null;
    } catch (error) {
      console.error('Error parsing LLM response:', error);
      return null;
    }
  }

  /**
   * Generate basic Highcharts configuration for a chart type
   */
  private generateBasicHighchartsConfig(chartType: string, transformedData: any): any {
    const baseConfig = {
      chart: {
        type: chartType === 'donut' ? 'pie' : chartType,
        height: 400
      },
      title: {
        text: this.generateChartTitle(chartType)
      },
      series: transformedData.series || []
    };

    switch (chartType) {
      case 'bar':
      case 'column':
      case 'line':
      case 'area':
        return {
          ...baseConfig,
          xAxis: {
            categories: transformedData.categories || [],
            title: {
              text: this.getCategoryAxisTitle()
            }
          },
          yAxis: {
            title: {
              text: this.getValueAxisTitle()
            }
          }
        };

      case 'pie':
        return {
          ...baseConfig,
          plotOptions: {
            pie: {
              allowPointSelect: true,
              cursor: 'pointer',
              dataLabels: {
                enabled: true,
                format: '<b>{point.name}</b>: {point.percentage:.1f} %'
              }
            }
          }
        };

      case 'donut':
        return {
          ...baseConfig,
          plotOptions: {
            pie: {
              allowPointSelect: true,
              cursor: 'pointer',
              innerSize: '50%',
              dataLabels: {
                enabled: true,
                format: '<b>{point.name}</b>: {point.percentage:.1f} %'
              }
            }
          }
        };

      case 'scatter':
        return {
          ...baseConfig,
          chart: {
            ...baseConfig.chart,
            zoomType: 'xy'
          },
          xAxis: {
            title: {
              text: this.getNumericAxisTitle(0)
            }
          },
          yAxis: {
            title: {
              text: this.getNumericAxisTitle(1)
            }
          }
        };

      default:
        return baseConfig;
    }
  }

  /**
   * Generate appropriate chart title
   */
  private generateChartTitle(chartType: string): string {
    const measures = this.dataInsights.columns.filter(col => col.isMeasure);
    const dimensions = this.dataInsights.columns.filter(col => col.isDimension);
    
    if (measures.length > 0 && dimensions.length > 0) {
      return `${measures[0].name} by ${dimensions[0].name}`;
    }
    
    if (this.dataInsights.columns.length > 0) {
      return this.dataInsights.columns[0].name;
    }
    
    return `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`;
  }

  /**
   * Get category axis title
   */
  private getCategoryAxisTitle(): string {
    const dimension = this.dataInsights.columns.find(col => col.isDimension);
    return dimension?.name || '';
  }

  /**
   * Get value axis title
   */
  private getValueAxisTitle(): string {
    const measure = this.dataInsights.columns.find(col => col.isMeasure);
    return measure?.name || '';
  }

  /**
   * Get numeric axis title for scatter plots
   */
  private getNumericAxisTitle(index: number): string {
    const numericColumns = this.dataInsights.columns.filter(col => col.hasNumericValues);
    return numericColumns[index]?.name || '';
  }

  /**
   * Get data insights for display
   */
  getDataInsights(): DataInsights {
    return this.dataInsights;
  }

  /**
   * Get transformed data for a specific chart type
   */
  getTransformedData(chartType: string) {
    return this.dataAnalyzer.transformForChart(chartType);
  }
}

export default ChartConfigGenerator;
