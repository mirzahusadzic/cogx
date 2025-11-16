/**
 * Retry Utilities
 *
 * Provides retry wrappers for transient failures in database and network operations.
 * Implements exponential backoff with jitter for optimal retry behavior.
 *
 * @example
 * // Retry LanceDB operation
 * await withDbRetry(() => table.mergeInsert('id').execute([record]));
 *
 * @example
 * // Custom retry config
 * await withRetry(
 *   () => apiCall(),
 *   { maxRetries: 5, baseDelay: 200 }
 * );
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 100) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 5000) */
  maxDelay?: number;
  /** Predicate to determine if error is retryable (default: all errors) */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Generic retry wrapper with exponential backoff
 *
 * @param operation - Async operation to retry
 * @param options - Retry configuration
 * @returns Result of the operation
 * @throws Last error if all retries exhausted
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 100,
    maxDelay = 5000,
    shouldRetry = () => true,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // Don't delay on last attempt
      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter: baseDelay * 2^attempt + random(0, baseDelay)
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * baseDelay;
        const delay = Math.min(exponentialDelay + jitter, maxDelay);

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Retry wrapper specifically for LanceDB operations
 *
 * Handles common LanceDB errors like SQLITE_BUSY and connection issues.
 * Uses shorter delays optimized for database operations.
 *
 * @param operation - LanceDB operation to retry
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns Result of the operation
 * @throws DatabaseError if all retries exhausted
 *
 * @example
 * await withDbRetry(() =>
 *   table.mergeInsert('id')
 *     .whenMatchedUpdateAll()
 *     .whenNotMatchedInsertAll()
 *     .execute([record])
 * );
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  return withRetry(operation, {
    maxRetries,
    baseDelay: 100, // 100ms base delay for DB operations
    maxDelay: 2000, // 2s max delay
    shouldRetry: (error: Error) => {
      const message = error.message?.toLowerCase() || '';
      // Retry on SQLITE_BUSY, connection issues, or timeout
      return (
        message.includes('busy') ||
        message.includes('locked') ||
        message.includes('timeout') ||
        message.includes('connection')
      );
    },
  });
}

/**
 * Retry wrapper for network operations
 *
 * Handles network errors like timeouts, connection resets, and transient failures.
 * Uses longer delays suitable for network operations.
 *
 * @param operation - Network operation to retry
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns Result of the operation
 *
 * @example
 * await withNetworkRetry(() => fetch(url));
 */
export async function withNetworkRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  return withRetry(operation, {
    maxRetries,
    baseDelay: 500, // 500ms base delay for network operations
    maxDelay: 10000, // 10s max delay
    shouldRetry: (error: Error) => {
      const message = error.message?.toLowerCase() || '';
      // Retry on network errors, but not on 4xx client errors
      return (
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('enotfound') ||
        message.includes('econnrefused') ||
        message.includes('network') ||
        message.includes('fetch failed')
      );
    },
  });
}
