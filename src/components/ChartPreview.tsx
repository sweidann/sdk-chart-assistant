import React, { useEffect, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { DataInsights, TransformedChartData } from '../utils/DataAnalyzer';

export interface ChartConfig {
  type: string;
  title?: string;
  explanation?: string;
  confidence?: number;
  highchartsOptions: Highcharts.Options;
}

interface ChartPreviewProps {
  chartConfig: ChartConfig | null;
  transformedData: TransformedChartData | null;
  dataInsights: DataInsights | null;
  isLoading?: boolean;
  onChartReady?: (chart: Highcharts.Chart) => void;
}

const ChartPreview: React.FC<ChartPreviewProps> = ({
  chartConfig,
  transformedData,
  dataInsights,
  isLoading = false,
  onChartReady
}) => {
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  const [chartOptions, setChartOptions] = useState<Highcharts.Options | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (chartConfig && transformedData) {
      try {
        const options = generateHighchartsOptions(chartConfig, transformedData, dataInsights);
        setChartOptions(options);
        setError(null);
      } catch (err) {
        console.error('Error generating chart options:', err);
        setError('Failed to generate chart configuration');
      }
    } else {
      setChartOptions(null);
    }
  }, [chartConfig, transformedData, dataInsights]);

  const handleChartCreated = (chart: Highcharts.Chart) => {
    if (onChartReady) {
      onChartReady(chart);
    }
  };

  if (isLoading) {
    return (
      <div className="chart-loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h4>Generating Chart...</h4>
          <p>Creating visualization based on your data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-error">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h4>Chart Generation Error</h4>
          <p>{error}</p>
          <button onClick={() => setError(null)} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!chartOptions) {
    return (
      <div className="chart-placeholder">
        <div className="placeholder-content">
          <div className="placeholder-icon">📊</div>
          <h4>Your chart will appear here</h4>
          <p>Start by describing your data in the chat to generate a visualization</p>
        </div>
      </div>
    );
  }

  console.log({ chartOptions });

  return (
    <div className="chart-preview-container">
      <div className="chart-wrapper">
        <HighchartsReact
          ref={chartRef}
          highcharts={Highcharts}
          options={chartOptions}
          callback={handleChartCreated}
        />
      </div>
      
      {chartConfig && (
        <div className="chart-metadata">
          <div className="chart-info">
            <span className="chart-type">{chartConfig.type.toUpperCase()}</span>
            {chartConfig.confidence && (
              <span className="confidence-badge">
                {Math.round(chartConfig.confidence * 100)}% confidence
              </span>
            )}
          </div>
          {chartConfig.explanation && (
            <p className="chart-explanation">{chartConfig.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Generate Highcharts options from chart config and transformed data
 */
function generateHighchartsOptions(
  chartConfig: ChartConfig,
  transformedData: TransformedChartData,
  dataInsights: DataInsights | null
): Highcharts.Options {
  const baseOptions: Highcharts.Options = {
    accessibility: {
      enabled: true,
      description: `${chartConfig.type} chart showing data visualization`
    },
    credits: {
      enabled: false
    },
    exporting: {
      enabled: true,
      buttons: {
        contextButton: {
          menuItems: ['viewFullscreen', 'separator', 'downloadPNG', 'downloadJPEG', 'downloadPDF', 'downloadSVG']
        }
      }
    },
    responsive: {
      rules: [{
        condition: {
          maxWidth: 500
        },
        chartOptions: {
          legend: {
            enabled: false
          }
        }
      }]
    }
  };

  // Use provided highchartsOptions from LLM if available, otherwise generate based on type
  if (chartConfig.highchartsOptions && Object.keys(chartConfig.highchartsOptions).length > 0) {
    return mergeChartOptions(baseOptions, chartConfig.highchartsOptions, transformedData);
  }

  // Generate options based on chart type
  switch (chartConfig.type.toLowerCase()) {
    case 'bar':
      return generateBarChartOptions(baseOptions, transformedData, dataInsights);
    
    case 'column':
      return generateColumnChartOptions(baseOptions, transformedData, dataInsights);
    
    case 'line':
      return generateLineChartOptions(baseOptions, transformedData, dataInsights);
    
    case 'area':
      return generateAreaChartOptions(baseOptions, transformedData, dataInsights);
    
    case 'pie':
      return generatePieChartOptions(baseOptions, transformedData, dataInsights);
    
    case 'donut':
      return generateDonutChartOptions(baseOptions, transformedData, dataInsights);
    
    case 'scatter':
      return generateScatterChartOptions(baseOptions, transformedData, dataInsights);
    
    default:
      return generateColumnChartOptions(baseOptions, transformedData, dataInsights);
  }
}

/**
 * Merge base options with custom options and apply data
 */
function mergeChartOptions(
  baseOptions: Highcharts.Options,
  customOptions: Highcharts.Options,
  transformedData: TransformedChartData
): Highcharts.Options {
  return {
    ...baseOptions,
    ...customOptions,
    series: (transformedData.series || customOptions.series || []) as any,
    xAxis: {
      ...customOptions.xAxis,
      categories: transformedData.categories || (customOptions.xAxis as any)?.categories
    }
  };
}

/**
 * Generate bar chart options
 */
function generateBarChartOptions(
  baseOptions: Highcharts.Options,
  transformedData: TransformedChartData,
  dataInsights: DataInsights | null
): Highcharts.Options {
  return {
    ...baseOptions,
    chart: {
      type: 'bar',
      height: 400
    },
    title: {
      text: getChartTitle('Bar Chart', dataInsights)
    },
    xAxis: {
      categories: transformedData.categories || [],
      title: {
        text: getCategoryAxisTitle(dataInsights)
      }
    },
    yAxis: {
      title: {
        text: getValueAxisTitle(dataInsights)
      }
    },
    series: (transformedData.series || []) as any,
    plotOptions: {
      bar: {
        dataLabels: {
          enabled: false
        }
      }
    }
  };
}

/**
 * Generate column chart options
 */
function generateColumnChartOptions(
  baseOptions: Highcharts.Options,
  transformedData: TransformedChartData,
  dataInsights: DataInsights | null
): Highcharts.Options {
  return {
    ...baseOptions,
    chart: {
      type: 'column',
      height: 400
    },
    title: {
      text: getChartTitle('Column Chart', dataInsights)
    },
    xAxis: {
      categories: transformedData.categories || [],
      title: {
        text: getCategoryAxisTitle(dataInsights)
      }
    },
    yAxis: {
      title: {
        text: getValueAxisTitle(dataInsights)
      }
    },
    series: (transformedData.series || []) as any,
    plotOptions: {
      column: {
        dataLabels: {
          enabled: false
        }
      }
    }
  };
}

/**
 * Generate line chart options
 */
function generateLineChartOptions(
  baseOptions: Highcharts.Options,
  transformedData: TransformedChartData,
  dataInsights: DataInsights | null
): Highcharts.Options {
  return {
    ...baseOptions,
    chart: {
      type: 'line',
      height: 400
    },
    title: {
      text: getChartTitle('Line Chart', dataInsights)
    },
    xAxis: {
      categories: transformedData.categories || [],
      title: {
        text: getCategoryAxisTitle(dataInsights)
      }
    },
    yAxis: {
      title: {
        text: getValueAxisTitle(dataInsights)
      }
    },
    series: (transformedData.series || []) as any,
    plotOptions: {
      line: {
        dataLabels: {
          enabled: false
        }
      }
    }
  };
}

/**
 * Generate area chart options
 */
function generateAreaChartOptions(
  baseOptions: Highcharts.Options,
  transformedData: TransformedChartData,
  dataInsights: DataInsights | null
): Highcharts.Options {
  return {
    ...baseOptions,
    chart: {
      type: 'area',
      height: 400
    },
    title: {
      text: getChartTitle('Area Chart', dataInsights)
    },
    xAxis: {
      categories: transformedData.categories || [],
      title: {
        text: getCategoryAxisTitle(dataInsights)
      }
    },
    yAxis: {
      title: {
        text: getValueAxisTitle(dataInsights)
      }
    },
    series: (transformedData.series || []) as any,
    plotOptions: {
      area: {
        stacking: 'normal',
        lineColor: '#666666',
        lineWidth: 1,
        marker: {
          lineWidth: 1,
          lineColor: '#666666'
        }
      }
    }
  };
}

/**
 * Generate pie chart options
 */
function generatePieChartOptions(
  baseOptions: Highcharts.Options,
  transformedData: TransformedChartData,
  dataInsights: DataInsights | null
): Highcharts.Options {
  return {
    ...baseOptions,
    chart: {
      type: 'pie',
      height: 400
    },
    title: {
      text: getChartTitle('Pie Chart', dataInsights)
    },
    series: (transformedData.series || []) as any,
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
}

/**
 * Generate donut chart options
 */
function generateDonutChartOptions(
  baseOptions: Highcharts.Options,
  transformedData: TransformedChartData,
  dataInsights: DataInsights | null
): Highcharts.Options {
  return {
    ...baseOptions,
    chart: {
      type: 'pie',
      height: 400
    },
    title: {
      text: getChartTitle('Donut Chart', dataInsights)
    },
    series: (transformedData.series.map(series => ({
      ...series,
      innerSize: '50%'
    })) || []) as any,
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
}

/**
 * Generate scatter chart options
 */
function generateScatterChartOptions(
  baseOptions: Highcharts.Options,
  transformedData: TransformedChartData,
  dataInsights: DataInsights | null
): Highcharts.Options {
  return {
    ...baseOptions,
    chart: {
      type: 'scatter',
      height: 400
    } as any,
    title: {
      text: getChartTitle('Scatter Plot', dataInsights)
    },
    xAxis: {
      title: {
        text: getNumericAxisTitle(dataInsights, 0)
      }
    },
    yAxis: {
      title: {
        text: getNumericAxisTitle(dataInsights, 1)
      }
    },
    series: (transformedData.series || []) as any,
    plotOptions: {
      scatter: {
        marker: {
          radius: 5,
          states: {
            hover: {
              enabled: true,
              lineColor: 'rgb(100,100,100)'
            }
          }
        }
      }
    }
  };
}

/**
 * Helper functions for generating titles and labels
 */
function getChartTitle(defaultTitle: string, dataInsights: DataInsights | null): string {
  if (!dataInsights || dataInsights.columns.length === 0) {
    return defaultTitle;
  }
  
  const measures = dataInsights.columns.filter(col => col.isMeasure);
  const dimensions = dataInsights.columns.filter(col => col.isDimension);
  
  if (measures.length > 0 && dimensions.length > 0) {
    return `${measures[0].name} by ${dimensions[0].name}`;
  }
  
  return dataInsights.columns[0]?.name || defaultTitle;
}

function getCategoryAxisTitle(dataInsights: DataInsights | null): string {
  if (!dataInsights) return '';
  
  const dimension = dataInsights.columns.find(col => col.isDimension);
  return dimension?.name || '';
}

function getValueAxisTitle(dataInsights: DataInsights | null): string {
  if (!dataInsights) return '';
  
  const measure = dataInsights.columns.find(col => col.isMeasure);
  return measure?.name || '';
}

function getNumericAxisTitle(dataInsights: DataInsights | null, index: number): string {
  if (!dataInsights) return '';
  
  const numericColumns = dataInsights.columns.filter(col => col.hasNumericValues);
  return numericColumns[index]?.name || '';
}

export default ChartPreview;
