import { ResponseData } from '@incorta-org/component-sdk';

export interface DataSample {
  structure: {
    totalRows: number;
    isSampled: boolean;
    isAggregated: boolean;
    measureHeaders: Array<{
      label: string;
      dataType: string;
      id: string;
    }>;
    rowHeaders: Array<{
      label: string;
      dataType: string;
      id: string;
    }>;
  };
  sampleData: Array<{
    values: any[];
    formatted: string[];
  }>;
  insights: {
    dataTypes: string[];
    approximateShape: string;
    sampleSize: number;
  };
}

export class DataSampler {
  /**
   * Extract a sample of data for LLM analysis
   */
  static extractSample(data: ResponseData, maxSampleRows: number = 5): DataSample {
    const structure = {
      totalRows: data.totalRows || 0,
      isSampled: data.isSampled || false,
      isAggregated: data.isAggregated || false,
      measureHeaders: data.measureHeaders || [],
      rowHeaders: data.rowHeaders || []
    };

    // Extract sample rows
    const sampleData: Array<{ values: any[]; formatted: string[] }> = [];
    const dataRows = data.data || [];
    const sampleSize = Math.min(maxSampleRows, dataRows.length);

    for (let i = 0; i < sampleSize; i++) {
      const row = dataRows[i];
      if (Array.isArray(row)) {
        const values = row.map(cell => cell?.value);
        const formatted = row.map(cell => cell?.formatted || cell?.value || '');
        sampleData.push({ values, formatted });
      }
    }

    // Generate insights
    const dataTypes = structure.measureHeaders.map(header => header.dataType);
    const columnCount = structure.measureHeaders.length;
    const approximateShape = `${structure.totalRows} rows × ${columnCount} columns`;

    return {
      structure,
      sampleData,
      insights: {
        dataTypes,
        approximateShape,
        sampleSize
      }
    };
  }

  /**
   * Format data sample for LLM consumption
   */
  static formatForLLM(sample: DataSample): string {
    let formatted = `
DATA STRUCTURE:
- Total Rows: ${sample.structure.totalRows}
- Shape: ${sample.insights.approximateShape}
- Is Aggregated: ${sample.structure.isAggregated ? 'Yes' : 'No'}
- Is Sampled: ${sample.structure.isSampled ? 'Yes' : 'No'}

COLUMNS:`;

    // Add column information
    sample.structure.measureHeaders.forEach((header, index) => {
      formatted += `\n- Column ${index + 1}: "${header.label}" (${header.dataType})`;
    });

    if (sample.structure.rowHeaders.length > 0) {
      formatted += `\n\nROW HEADERS:`;
      sample.structure.rowHeaders.forEach((header, index) => {
        formatted += `\n- Row Header ${index + 1}: "${header.label}" (${header.dataType})`;
      });
    }

    formatted += `\n\nSAMPLE DATA (first ${sample.insights.sampleSize} rows):`;
    
    // Add header row
    const headers = sample.structure.measureHeaders.map(h => h.label);
    formatted += `\n| ${headers.join(' | ')} |`;
    formatted += `\n|${headers.map(() => '---').join('|')}|`;

    // Add sample rows
    sample.sampleData.forEach(row => {
      formatted += `\n| ${row.formatted.join(' | ')} |`;
    });

    formatted += `\n\nRAW DATA SAMPLE (for reference):`;
    formatted += `\n${JSON.stringify(sample.sampleData.slice(0, 3), null, 2)}`;

    return formatted;
  }

  /**
   * Get data transformation suggestions prompt
   */
  static getTransformationPrompt(): string {
    return `
WHEN SUGGESTING DATA TRANSFORMATIONS:
1. If data needs aggregation, specify how to group and what to measure
2. If data needs filtering, specify the criteria
3. If data needs reshaping, explain the new structure
4. If data is ready as-is, proceed with visualization

EXAMPLE TRANSFORMATIONS:
- "Group by category, sum the values"
- "Filter to show only last 6 months"
- "Pivot to show categories as columns"
- "Calculate percentage of total for each category"

You can suggest these transformations in your explanation and I'll implement them.
`;
  }
}

export default DataSampler;
