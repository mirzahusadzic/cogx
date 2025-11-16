/**
 * Input Validation Utilities
 *
 * Helper functions for validating and sanitizing user input including:
 * - Number validation and sanitization
 * - Array bounds checking
 * - String validation
 * - Type guards
 *
 * DESIGN:
 * - Defensive: Returns safe defaults rather than throwing
 * - Clear: Provides validation errors with context
 * - Type-safe: TypeScript type guards for runtime safety
 */

/**
 * Sanitize integer input with bounds
 *
 * Parses string or number as integer, clamps to min/max range,
 * and returns default value if invalid.
 *
 * @param value - Value to parse (string or number)
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param defaultVal - Default value if parsing fails
 * @returns Sanitized integer within bounds
 *
 * @example
 * // From CLI argument
 * const topK = sanitizeInt(options.topK, 1, 100, 10);
 * // Returns 10 if topK is NaN, clamps to 1-100 otherwise
 *
 * @example
 * // From user input
 * const timeout = sanitizeInt(userInput, 1000, 60000, 30000);
 */
export function sanitizeInt(
  value: string | number,
  min: number,
  max: number,
  defaultVal: number
): number {
  const num = typeof value === 'string' ? parseInt(value) : value;
  if (isNaN(num)) return defaultVal;
  return Math.max(min, Math.min(max, num));
}

/**
 * Validate number with error throwing
 *
 * Throws descriptive error if value is not a valid number.
 * Use when you want to fail fast on invalid input.
 *
 * @param value - Value to validate
 * @param name - Parameter name for error message
 * @param min - Optional minimum value
 * @param max - Optional maximum value
 * @returns Validated number
 * @throws Error if value is NaN or out of bounds
 *
 * @example
 * const sessionTokens = validateNumber(
 *   parseInt(options.sessionTokens),
 *   'sessionTokens',
 *   10000,
 *   1000000
 * );
 */
export function validateNumber(
  value: number,
  name: string,
  min?: number,
  max?: number
): number {
  if (isNaN(value)) {
    throw new Error(
      `Invalid ${name}: must be a valid number, got: ${value}`
    );
  }

  if (min !== undefined && value < min) {
    throw new Error(
      `Invalid ${name}: must be >= ${min}, got: ${value}`
    );
  }

  if (max !== undefined && value > max) {
    throw new Error(
      `Invalid ${name}: must be <= ${max}, got: ${value}`
    );
  }

  return value;
}

/**
 * Safely access array element with bounds checking
 *
 * Returns element at index if it exists, otherwise returns undefined.
 * Prevents crashes from accessing array[0] when array is empty.
 *
 * @param array - Array to access
 * @param index - Index to access
 * @returns Element at index or undefined
 *
 * @example
 * const first = safeArrayAccess(results, 0);
 * if (first) {
 *   console.log(first.name);
 * }
 *
 * @example
 * const lastItem = safeArrayAccess(items, items.length - 1);
 */
export function safeArrayAccess<T>(
  array: T[] | undefined | null,
  index: number
): T | undefined {
  if (!array || index < 0 || index >= array.length) {
    return undefined;
  }
  return array[index];
}

/**
 * Safely access object property
 *
 * Returns property value if it exists and is of expected type,
 * otherwise returns undefined.
 *
 * @param obj - Object to access
 * @param key - Property key
 * @returns Property value or undefined
 *
 * @example
 * const name = safePropertyAccess(user, 'name');
 * // Returns user.name if exists, undefined otherwise
 */
export function safePropertyAccess<T, K extends keyof T>(
  obj: T | undefined | null,
  key: K
): T[K] | undefined {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }
  return obj[key];
}

/**
 * Type guard: Check if value is non-null object
 *
 * @param value - Value to check
 * @returns True if value is object (not null, not array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard: Check if value is non-empty string
 *
 * @param value - Value to check
 * @returns True if value is non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard: Check if value is non-empty array
 *
 * @param value - Value to check
 * @returns True if value is non-empty array
 */
export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Validate required string parameter
 *
 * @param value - Value to validate
 * @param name - Parameter name for error message
 * @returns Validated string
 * @throws Error if value is not a non-empty string
 */
export function requireString(value: unknown, name: string): string {
  if (!isNonEmptyString(value)) {
    throw new Error(
      `Invalid ${name}: must be a non-empty string, got: ${typeof value}`
    );
  }
  return value;
}

/**
 * Validate required array parameter
 *
 * @param value - Value to validate
 * @param name - Parameter name for error message
 * @returns Validated array
 * @throws Error if value is not an array
 */
export function requireArray<T>(value: unknown, name: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `Invalid ${name}: must be an array, got: ${typeof value}`
    );
  }
  return value;
}
