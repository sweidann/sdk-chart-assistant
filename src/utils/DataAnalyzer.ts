import { ResponseData } from '@incorta-org/component-sdk';

export interface DataColumn {
  name: string;
  label: string;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'unknown';
  id: string;
  isMeasure: boolean;
  isDimension: boolean;
  uniqueValues: number;
  nullCount: number;
  sampleValues: any[];
  hasNumericValues: boolean;
  isTimeRelated: boolean;
}

export interface ChartSuggestion {
  type: 'bar' | 'column' | 'line' | 'pie' | 'scatter' | 'area' | 'donut';
  confidence: number;
  reasoning: string;
  sampleConfig: any;
  priority: number;
}

export interface DataInsights {
  columns: DataColumn[];
  rowCount: number;
  hasTimeColumn: boolean;
  numericColumns: string[];
  categoricalColumns: string[];
  dataComplexity: 'simple' | 'moderate' | 'complex';
  suggestedCharts: ChartSuggestion[];
  isAggregated: boolean;
  isSampled: boolean;
}

export interface TransformedChartData {
  categories?: string[];
  series: Array<{
    name: string;
    data: any[];
    type?: string;
  }>;
  xAxis?: any;
  yAxis?: any;
}

export default class DataAnalyzer {
  private data: ResponseData;
  private insights: DataInsights | null = null;

  constructor(data: ResponseData) {
    this.data = data;
  }

  /**
   * Analyze the Incorta data structure and extract insights
   */
  analyze(): DataInsights {
    if (this.insights) {
      return this.insights;
    }

    const columns = this.analyzeColumns();
    const rowCount = this.getRowCount();
    const hasTimeColumn = this.detectTimeColumns(columns);
    const numericColumns = columns.filter(col => col.hasNumericValues).map(col => col.name);
    const categoricalColumns = columns.filter(col => col.dataType === 'string').map(col => col.name);
    const dataComplexity = this.calculateComplexity(columns, rowCount);
    const isAggregated = this.data.isAggregated || false;
    const isSampled = this.data.isSampled || false;

    this.insights = {
      columns,
      rowCount,
      hasTimeColumn,
      numericColumns,
      categoricalColumns,
      dataComplexity,
      suggestedCharts: [],
      isAggregated,
      isSampled
    };

    // Generate chart suggestions based on analysis
    this.insights.suggestedCharts = this.generateChartSuggestions(this.insights);

    return this.insights;
  }

  /**
   * Analyze column structure from Incorta data format
   */
  private analyzeColumns(): DataColumn[] {
    const columns: DataColumn[] = [];

    // Process measureHeaders (these are typically dimensions/measures)
    if (this.data.measureHeaders) {
      this.data.measureHeaders.forEach((header, index) => {
        const columnData = this.extractColumnData(index);
        const analysis = this.analyzeColumnData(columnData);

        columns.push({
          name: header.label || `Column_${index}`,
          label: header.label || `Column_${index}`,
          dataType: this.mapIncortaDataType(header.dataType),
          id: header.id || `col_${index}`,
          isMeasure: this.isMeasureColumn(header, analysis),
          isDimension: !this.isMeasureColumn(header, analysis),
          uniqueValues: analysis.uniqueValues,
          nullCount: analysis.nullCount,
          sampleValues: analysis.sampleValues,
          hasNumericValues: analysis.hasNumericValues,
          isTimeRelated: this.isTimeRelatedColumn(header.label, analysis.sampleValues)
        });
      });
    }

    // Process rowHeaders if they exist
    if (this.data.rowHeaders && this.data.rowHeaders.length > 0) {
      this.data.rowHeaders.forEach((header, index) => {
        columns.push({
          name: header.label || `RowHeader_${index}`,
          label: header.label || `RowHeader_${index}`,
          dataType: this.mapIncortaDataType(header.dataType),
          id: header.id || `row_${index}`,
          isMeasure: false,
          isDimension: true,
          uniqueValues: 0, // Would need additional analysis
          nullCount: 0,
          sampleValues: [],
          hasNumericValues: false,
          isTimeRelated: this.isTimeRelatedColumn(header.label, [])
        });
      });
    }

    return columns;
  }

  /**
   * Extract column data from the Incorta data array
   */
  private extractColumnData(columnIndex: number): any[] {
    if (!this.data.data || !Array.isArray(this.data.data)) {
      return [];
    }

    return this.data.data.map(row => {
      if (Array.isArray(row) && row[columnIndex]) {
        return row[columnIndex].value;
      }
      return null;
    }).filter(value => value !== null && value !== undefined);
  }

  /**
   * Analyze individual column data for patterns and types
   */
  private analyzeColumnData(values: any[]): {
    uniqueValues: number;
    nullCount: number;
    sampleValues: any[];
    hasNumericValues: boolean;
  } {
    const uniqueSet = new Set(values);
    const sampleValues = Array.from(uniqueSet).slice(0, 5);
    
    // Check if values can be interpreted as numbers
    const numericValues = values.filter(val => {
      const num = Number(val);
      return !isNaN(num) && isFinite(num);
    });

    return {
      uniqueValues: uniqueSet.size,
      nullCount: 0, // Would need to check original data for nulls
      sampleValues,
      hasNumericValues: numericValues.length > values.length * 0.7 // 70% threshold
    };
  }

  /**
   * Map Incorta data types to our standard types
   */
  private mapIncortaDataType(incortaType: string): DataColumn['dataType'] {
    const type = incortaType?.toLowerCase() || '';
    
    if (type.includes('string') || type.includes('text') || type.includes('varchar')) {
      return 'string';
    }
    if (type.includes('number') || type.includes('int') || type.includes('decimal') || type.includes('float')) {
      return 'number';
    }
    if (type.includes('date') || type.includes('time') || type.includes('timestamp')) {
      return 'date';
    }
    if (type.includes('bool')) {
      return 'boolean';
    }
    
    return 'unknown';
  }

  /**
   * Determine if a column should be treated as a measure
   */
  private isMeasureColumn(header: any, analysis: any): boolean {
    // If it has numeric values and many unique values, likely a measure
    return analysis.hasNumericValues && analysis.uniqueValues > 10;
  }

  /**
   * Check if column is time-related based on name and values
   */
  private isTimeRelatedColumn(label: string, sampleValues: any[]): boolean {
    const timeKeywords = ['date', 'time', 'year', 'month', 'day', 'created', 'updated', 'timestamp'];
    const labelLower = label.toLowerCase();
    
    // Check label for time-related keywords
    if (timeKeywords.some(keyword => labelLower.includes(keyword))) {
      return true;
    }

    // Check sample values for date patterns
    if (sampleValues.length > 0) {
      const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}|^\d{4}$/;
      return sampleValues.some(val => 
        typeof val === 'string' && datePattern.test(val)
      );
    }

    return false;
  }

  /**
   * Detect time columns in the dataset
   */
  private detectTimeColumns(columns: DataColumn[]): boolean {
    return columns.some(col => col.isTimeRelated || col.dataType === 'date');
  }

  /**
   * Calculate data complexity based on columns and rows
   */
  private calculateComplexity(columns: DataColumn[], rowCount: number): 'simple' | 'moderate' | 'complex' {
    const columnCount = columns.length;
    const measureCount = columns.filter(col => col.isMeasure).length;
    
    if (columnCount <= 2 && rowCount <= 50) {
      return 'simple';
    }
    if (columnCount <= 5 && rowCount <= 1000 && measureCount <= 3) {
      return 'moderate';
    }
    return 'complex';
  }

  /**
   * Get total row count from data
   */
  private getRowCount(): number {
    return this.data.totalRows || this.data.data?.length || 0;
  }

  /**
   * Generate intelligent chart suggestions based on data analysis
   */
  private generateChartSuggestions(insights: DataInsights): ChartSuggestion[] {
    const suggestions: ChartSuggestion[] = [];
    const { columns, rowCount, hasTimeColumn, categoricalColumns, numericColumns } = insights;

    // Rule 1: Time series data -> Line chart
    if (hasTimeColumn && numericColumns.length > 0) {
      suggestions.push({
        type: 'line',
        confidence: 0.9,
        reasoning: 'Time-based data is best visualized with line charts to show trends over time',
        sampleConfig: {},
        priority: 1
      });

      suggestions.push({
        type: 'area',
        confidence: 0.7,
        reasoning: 'Area charts can show cumulative values over time',
        sampleConfig: {},
        priority: 3
      });
    }

    // Rule 2: Single categorical + single numeric -> Bar/Column
    if (categoricalColumns.length === 1 && numericColumns.length === 1) {
      suggestions.push({
        type: 'column',
        confidence: 0.85,
        reasoning: 'Single category with numeric values works well with column charts for comparison',
        sampleConfig: {},
        priority: 1
      });

      suggestions.push({
        type: 'bar',
        confidence: 0.8,
        reasoning: 'Bar charts provide good readability for categorical comparisons',
        sampleConfig: {},
        priority: 2
      });
    }

    // Rule 3: Few categories (2-7) with single measure -> Pie chart
    if (categoricalColumns.length === 1 && numericColumns.length === 1 && rowCount <= 7) {
      const uniqueCategories = this.getUniqueCategoryCount(categoricalColumns[0]);
      if (uniqueCategories <= 7) {
        suggestions.push({
          type: 'pie',
          confidence: 0.75,
          reasoning: 'Few categories with part-to-whole relationship work well with pie charts',
          sampleConfig: {},
          priority: 2
        });

        suggestions.push({
          type: 'donut',
          confidence: 0.7,
          reasoning: 'Donut charts provide a modern alternative to pie charts',
          sampleConfig: {},
          priority: 3
        });
      }
    }

    // Rule 4: Two numeric columns -> Scatter plot
    if (numericColumns.length >= 2) {
      suggestions.push({
        type: 'scatter',
        confidence: 0.6,
        reasoning: 'Multiple numeric variables can reveal correlations in scatter plots',
        sampleConfig: {},
        priority: 4
      });
    }

    // Rule 5: Multiple measures -> Column chart (default safe option)
    if (numericColumns.length > 1) {
      suggestions.push({
        type: 'column',
        confidence: 0.6,
        reasoning: 'Multiple measures can be compared side-by-side in column charts',
        sampleConfig: {},
        priority: 3
      });
    }

    // Sort by priority and confidence
    return suggestions
      .sort((a, b) => a.priority - b.priority || b.confidence - a.confidence)
      .slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Get unique category count for a specific column
   */
  private getUniqueCategoryCount(columnName: string): number {
    const column = this.insights?.columns.find(col => col.name === columnName);
    return column?.uniqueValues || 0;
  }

  /**
   * Transform data for specific chart types
   */
  transformForChart(chartType: string): TransformedChartData {
    const insights = this.analyze();

    console.log({ insights });
    
    switch (chartType.toLowerCase()) {
      case 'bar':
      case 'column':
        return this.transformForBarChart(insights);
      
      case 'line':
      case 'area':
        return this.transformForLineChart(insights);
      
      case 'pie':
      case 'donut':
        return this.transformForPieChart(insights);
      
      case 'scatter':
        return this.transformForScatterChart(insights);
      
      default:
        return this.transformForBarChart(insights); // Default fallback
    }
  }

  /**
   * Transform data for bar/column charts
   */
  private transformForBarChart(insights: DataInsights): TransformedChartData {
    const categoricalCol = insights.columns.find(col => col.isDimension);
    const numericCol = insights.columns.find(col => col.isMeasure);

    // If we only have categorical data, create a count-based chart
    if (categoricalCol && !numericCol) {
      const categories: string[] = [];
      const counts: number[] = [];

      // Count occurrences of each category
      const categoryCount: { [key: string]: number } = {};

      console.log({data: this.data});

      this.data.data?.forEach(row => {
        if (Array.isArray(row) && row.length >= 1) {
          const categoryValue = row[0]?.formatted || row[0]?.value || '';
          const categoryStr = String(categoryValue);
          categoryCount[categoryStr] = Number(row[1]?.value || 0);
        }
      });

      // Convert to arrays for Highcharts
      Object.entries(categoryCount).forEach(([category, count]) => {
        categories.push(category);
        counts.push(count);
      });

      console.log({ counts });

      return {
        categories,
        series: [{
          name: 'Count',
          data: counts
        }]
      };
    }

    // If we have both categorical and numeric columns
    if (!categoricalCol || !numericCol) {
      return { series: [] };
    }

    const categories: string[] = [];
    const values: number[] = [];

    this.data.data?.forEach(row => {
      if (Array.isArray(row) && row.length >= 2) {
        const categoryValue = row[0]?.formatted || row[0]?.value || '';
        const numericValue = Number(row[1]?.value || 0);
        
        categories.push(String(categoryValue));
        values.push(numericValue);
      }
    });

    return {
      categories,
      series: [{
        name: numericCol.label,
        data: values
      }]
    };
  }

  /**
   * Transform data for line/area charts
   */
  private transformForLineChart(insights: DataInsights): TransformedChartData {
    // Similar to bar chart but optimized for time series
    return this.transformForBarChart(insights);
  }

  /**
   * Transform data for pie/donut charts
   */
  private transformForPieChart(insights: DataInsights): TransformedChartData {
    const categoricalCol = insights.columns.find(col => col.isDimension);
    const numericCol = insights.columns.find(col => col.isMeasure);

    // If we only have categorical data, create a count-based pie chart
    if (categoricalCol && !numericCol) {
      const categoryCount: { [key: string]: number } = {};

      this.data.data?.forEach(row => {
        if (Array.isArray(row) && row.length >= 1) {
          const categoryValue = row[0]?.formatted || row[0]?.value || '';
          const categoryStr = String(categoryValue);
          categoryCount[categoryStr] = Number(row[1]?.value || 0);
        }
      });

      const pieData: Array<{ name: string; y: number }> = [];
      Object.entries(categoryCount).forEach(([category, count]) => {
        pieData.push({
          name: category,
          y: count
        });
      });

      return {
        series: [{
          name: 'Count',
          data: pieData
        }]
      };
    }

    // If we have both categorical and numeric columns
    if (!categoricalCol || !numericCol) {
      return { series: [] };
    }

    const pieData: Array<{ name: string; y: number }> = [];

    this.data.data?.forEach(row => {
      if (Array.isArray(row) && row.length >= 2) {
        const name = row[0]?.formatted || row[0]?.value || '';
        const value = Number(row[1]?.value || 0);
        
        pieData.push({
          name: String(name),
          y: value
        });
      }
    });

    return {
      series: [{
        name: numericCol.label,
        data: pieData
      }]
    };
  }

  /**
   * Transform data for scatter charts
   */
  private transformForScatterChart(insights: DataInsights): TransformedChartData {
    const numericCols = insights.columns.filter(col => col.isMeasure);
    
    if (numericCols.length < 2) {
      return { series: [] };
    }

    const scatterData: Array<[number, number]> = [];

    this.data.data?.forEach(row => {
      if (Array.isArray(row) && row.length >= 2) {
        const x = Number(row[0]?.value || 0);
        const y = Number(row[1]?.value || 0);
        
        scatterData.push([x, y]);
      }
    });

    return {
      series: [{
        name: 'Data Points',
        data: scatterData
      }]
    };
  }

  /**
   * Get formatted data sample for debugging
   */
  getDataSample(limit: number = 5): any[] {
    if (!this.data.data || !Array.isArray(this.data.data)) {
      return [];
    }

    return this.data.data.slice(0, limit).map(row => {
      if (Array.isArray(row)) {
        return row.map(cell => ({
          value: cell?.value,
          formatted: cell?.formatted
        }));
      }
      return row;
    });
  }
}
