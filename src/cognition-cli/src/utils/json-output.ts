/**
 * JSON Output Utilities
 *
 * Provides consistent JSON output formatting for --json mode.
 * Ensures all commands output structured data in compatible formats.
 *
 * DESIGN:
 * - All JSON output includes metadata (timestamp, version, etc.)
 * - Results wrapped in standard envelope: { data, metadata, errors }
 * - Supports pagination info when applicable
 * - Pretty-printed by default (can be minified with --compact)
 *
 * @example
 * const result = formatJsonOutput({
 *   items: [...],
 *   count: 10
 * });
 * console.log(result);
 */

/**
 * Standard JSON output metadata
 */
export interface JsonMetadata {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** CLI version */
  version: string;
  /** Command that generated output */
  command?: string;
  /** Execution time in milliseconds */
  executionTime?: number;
}

/**
 * Standard JSON output envelope
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface JsonOutput<T = any> {
  /** Actual result data */
  data: T;
  /** Metadata about the output */
  metadata: JsonMetadata;
  /** Errors or warnings (if any) */
  errors?: string[];
  /** Warnings (non-fatal issues) */
  warnings?: string[];
}

/**
 * Pagination information for large result sets
 */
export interface PaginationInfo {
  /** Total items available */
  total: number;
  /** Number of items returned */
  count: number;
  /** Items per page (limit) */
  limit: number;
  /** Current offset */
  offset: number;
  /** Whether more items available */
  hasMore: boolean;
}

/**
 * Format data as JSON output with standard envelope
 *
 * Wraps raw data in standard JSON structure with metadata.
 *
 * @param data - Data to output
 * @param options - Optional metadata and formatting options
 * @returns JSON string
 *
 * @example
 * const json = formatJsonOutput(
 *   { items: [1, 2, 3] },
 *   { command: 'query', executionTime: 1234 }
 * );
 */
export function formatJsonOutput<T>(
  data: T,
  options?: {
    command?: string;
    executionTime?: number;
    errors?: string[];
    warnings?: string[];
    pretty?: boolean;
  }
): string {
  const output: JsonOutput<T> = {
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      version: '2.3.2',
      command: options?.command,
      executionTime: options?.executionTime,
    },
    errors: options?.errors,
    warnings: options?.warnings,
  };

  const pretty = options?.pretty !== false; // Pretty by default
  return JSON.stringify(output, null, pretty ? 2 : 0);
}

/**
 * Format paginated results with pagination info
 *
 * @param items - Array of result items
 * @param pagination - Pagination metadata
 * @param options - Optional metadata
 * @returns JSON string
 *
 * @example
 * const json = formatPaginatedJsonOutput(
 *   items.slice(0, 50),
 *   { total: 500, count: 50, limit: 50, offset: 0, hasMore: true }
 * );
 */
export function formatPaginatedJsonOutput<T>(
  items: T[],
  pagination: PaginationInfo,
  options?: {
    command?: string;
    executionTime?: number;
  }
): string {
  return formatJsonOutput(
    {
      items,
      pagination,
    },
    options
  );
}

/**
 * Check if JSON output mode is active
 *
 * @returns true if --json flag was passed
 */
export function isJsonMode(): boolean {
  return process.env.COGNITION_FORMAT === 'json';
}

/**
 * Output JSON if in JSON mode, otherwise use callback for normal output
 *
 * Helper to simplify command implementations.
 *
 * @param data - Data to output
 * @param normalOutputFn - Function to call for normal output
 * @param options - JSON formatting options
 *
 * @example
 * outputJson(
 *   { items: results },
 *   () => {
 *     console.log(tableHeader(['ID', 'Name']));
 *     results.forEach(r => console.log(tableRow([r.id, r.name])));
 *   },
 *   { command: 'list' }
 * );
 */
export function outputJson<T>(
  data: T,
  normalOutputFn: () => void,
  options?: {
    command?: string;
    executionTime?: number;
  }
): void {
  if (isJsonMode()) {
    console.log(formatJsonOutput(data, options));
  } else {
    normalOutputFn();
  }
}
