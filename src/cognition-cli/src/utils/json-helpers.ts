/**
 * Safe JSON Parsing Utilities
 *
 * Wrapper functions for JSON.parse that handle errors gracefully
 * instead of throwing exceptions.
 *
 * DESIGN:
 * - Never throws - always returns a value or fallback
 * - Logs warnings for debugging
 * - Preserves error context for troubleshooting
 */

/**
 * Safely parse JSON with fallback value
 *
 * Attempts to parse JSON string, returning fallback on failure.
 * Never throws - always returns a valid value.
 *
 * @param json - JSON string to parse
 * @param fallback - Value to return if parsing fails
 * @param context - Optional context for error logging (e.g., file path, field name)
 * @returns Parsed object or fallback value
 *
 * @example
 * const tags = safeJSONParse(turn.semantic_tags, [], 'semantic_tags');
 * // Returns [] if semantic_tags is malformed, logs warning
 *
 * @example
 * const config = safeJSONParse(
 *   fs.readFileSync('config.json', 'utf-8'),
 *   { default: 'config' },
 *   'config.json'
 * );
 */
export function safeJSONParse<T>(
  json: string,
  fallback: T,
  context?: string
): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const contextMsg = context ? ` (${context})` : '';
    console.warn(
      `JSON parse failed${contextMsg}: ${errorMsg}. Using fallback value.`
    );
    return fallback;
  }
}

/**
 * Safely parse JSON with error callback
 *
 * Like safeJSONParse, but allows custom error handling via callback.
 * Useful when you need to log errors or take specific action on failure.
 *
 * @param json - JSON string to parse
 * @param fallback - Value to return if parsing fails
 * @param onError - Callback to execute on parse error
 * @returns Parsed object or fallback value
 *
 * @example
 * const metadata = safeJSONParseWithCallback(
 *   record.metadata,
 *   {},
 *   (error) => {
 *     logger.error('Failed to parse metadata', { error, recordId: record.id });
 *   }
 * );
 */
export function safeJSONParseWithCallback<T>(
  json: string,
  fallback: T,
  onError: (error: Error, json: string) => void
): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    onError(error as Error, json);
    return fallback;
  }
}

/**
 * Parse JSON or throw user-friendly error
 *
 * For cases where you want to fail fast with a clear error message
 * rather than using a fallback.
 *
 * @param json - JSON string to parse
 * @param context - Context for error message
 * @returns Parsed object
 * @throws Error with context if parsing fails
 *
 * @example
 * try {
 *   const config = parseJSONOrThrow(configString, 'config.json');
 * } catch (error) {
 *   console.error('Invalid configuration file');
 *   process.exit(1);
 * }
 */
export function parseJSONOrThrow<T>(json: string, context: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to parse JSON (${context}): ${errorMsg}\n` +
      `JSON preview: ${json.substring(0, 100)}...`
    );
  }
}
