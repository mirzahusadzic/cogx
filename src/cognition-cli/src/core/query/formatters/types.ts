import { QueryResult } from '../query.js';

/**
 * Interface for query result formatters.
 *
 * Each formatter takes a QueryResult and returns a formatted string.
 */
export interface IQueryFormatter {
  /**
   * Format the query result.
   *
   * @param result - The query result to format
   * @returns Formatted string
   */
  format(result: QueryResult): string;
}

/**
 * Supported query output formats
 */
export type QueryFormat = 'human' | 'json' | 'lineage' | 'markdown';
