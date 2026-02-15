/**
 * Utility functions for processing chart data
 */

export interface ChartDataPoint {
  date: string | Date;
  value: number | string;
  [key: string]: any;
}

/**
 * Formats numbers like SocialBlade: 1,234, 1.2M, 3.4K
 */
export function formatChartNumber(value: number | string): string {
  const num = typeof value === 'string' 
    ? parseFloat(value.replace(/,/g, '')) 
    : value;
  
  if (isNaN(num) || num === null || num === undefined) {
    return '0';
  }

  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  } else {
    return num.toLocaleString('en-US');
  }
}

/**
 * Cleans and prepares chart data:
 * - Converts dates to Date objects
 * - Removes commas and converts strings to numbers
 * - Filters out invalid data points
 * - Sorts by date
 */
export function prepareChartData<T extends ChartDataPoint>(
  data: T[],
  valueField: string = 'value',
  dateField: string = 'date'
): Array<{ date: Date; value: number; [key: string]: any }> {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }

  const prepared = data
    .map((d) => {
      // Parse date
      let date: Date;
      if (d[dateField] instanceof Date) {
        date = d[dateField] as Date;
      } else if (typeof d[dateField] === 'string') {
        date = new Date(d[dateField]);
      } else {
        return null;
      }

      // Parse value - remove commas and convert to number
      let value: number;
      const rawValue = d[valueField];
      if (typeof rawValue === 'number') {
        value = rawValue;
      } else if (typeof rawValue === 'string') {
        value = parseFloat(rawValue.replace(/,/g, '').trim());
      } else {
        return null;
      }

      // Return null if invalid
      if (isNaN(value) || isNaN(date.getTime())) {
        return null;
      }

      // Return prepared data point with all original fields
      return {
        ...d,
        date,
        value,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return prepared;
}

/**
 * Clips extreme outliers to prevent chart flattening
 * Uses IQR (Interquartile Range) method
 */
export function clipOutliers(
  data: Array<{ value: number }>,
  multiplier: number = 1.5
): Array<{ value: number }> {
  if (data.length === 0) return data;

  const values = data.map((d) => d.value).sort((a, b) => a - b);
  const q1 = values[Math.floor(values.length * 0.25)];
  const q3 = values[Math.floor(values.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  return data.map((d) => ({
    ...d,
    value: Math.max(lowerBound, Math.min(upperBound, d.value)),
  }));
}

