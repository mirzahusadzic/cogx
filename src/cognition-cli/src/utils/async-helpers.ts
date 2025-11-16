/**
 * Async Operation Helpers
 *
 * Utility functions for resilient async operations including:
 * - Parallel execution with error recovery
 * - Retry logic with exponential backoff
 * - Timeout wrappers
 *
 * DESIGN:
 * These helpers prevent catastrophic failures from single errors in
 * batch operations, providing partial success and graceful degradation.
 */

import chalk from 'chalk';

/**
 * Result of parallel operation with error recovery
 */
export interface ParallelResult<T> {
  /** Successfully completed operations */
  successful: T[];
  /** Failed operations with context */
  failed: Array<{
    index: number;
    input: unknown;
    error: Error;
  }>;
}

/**
 * Execute operations in parallel with error recovery
 *
 * Unlike Promise.all(), this function allows partial success - if some
 * operations fail, successful ones are still returned. This prevents
 * losing hours of computation due to a single error.
 *
 * ALGORITHM:
 * 1. Wrap each operation in error-catching promise
 * 2. Execute all in parallel with Promise.all
 * 3. Separate successful from failed results
 * 4. Report failure statistics
 * 5. Return both successful and failed operations
 *
 * @param inputs - Array of inputs to process
 * @param operation - Async operation to perform on each input
 * @param options - Configuration for operation name and error handling
 * @returns Object with successful and failed results
 *
 * @example
 * const {successful, failed} = await parallelWithRecovery(
 *   files,
 *   async (file) => await processFile(file),
 *   {
 *     operationName: 'File processing',
 *     onError: (err, file, idx) => {
 *       console.error(`Failed to process ${file.name}: ${err.message}`);
 *     }
 *   }
 * );
 * console.log(`Processed ${successful.length}/${files.length} files`);
 */
export async function parallelWithRecovery<T, I>(
  inputs: I[],
  operation: (input: I, index: number) => Promise<T>,
  options: {
    operationName: string;
    onError?: (error: Error, input: I, index: number) => void;
    failFast?: boolean;
  }
): Promise<ParallelResult<T>> {
  // Wrap each operation to catch errors
  const promises = inputs.map((input, index) =>
    operation(input, index).catch(error => ({
      __error: true as const,
      error,
      input,
      index
    }))
  );

  // Execute all in parallel
  const results = await Promise.all(promises);

  const successful: T[] = [];
  const failed: Array<{index: number; input: unknown; error: Error}> = [];

  // Separate successful from failed
  results.forEach((result, index) => {
    if (result && typeof result === 'object' && '__error' in result) {
      failed.push({
        index: result.index,
        input: result.input,
        error: result.error
      });
      options.onError?.(result.error, result.input as I, result.index);
    } else {
      successful.push(result as T);
    }
  });

  // Report statistics
  if (failed.length > 0) {
    const failRate = (failed.length / inputs.length * 100).toFixed(1);
    console.warn(
      chalk?.yellow
        ? chalk.yellow(
            `⚠️  ${options.operationName}: ${failed.length}/${inputs.length} operations failed (${failRate}%)`
          )
        : `⚠️  ${options.operationName}: ${failed.length}/${inputs.length} operations failed (${failRate}%)`
    );

    // Fail fast if all operations failed
    if (options.failFast && failed.length === inputs.length) {
      throw new Error(
        `${options.operationName} completely failed - all operations errored`
      );
    }
  }

  return {successful, failed};
}

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay: number;
  /** Backoff multiplier for exponential delay (default: 2) */
  backoffMultiplier: number;
  /** Function to determine if error is retryable (default: all errors) */
  retryableErrors?: (error: Error) => boolean;
  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry an async operation with exponential backoff
 *
 * Automatically retries failed operations with increasing delays,
 * useful for transient failures like network errors or rate limits.
 *
 * ALGORITHM:
 * 1. Attempt operation
 * 2. On error, check if retryable
 * 3. If not retryable or max attempts reached, throw error
 * 4. Otherwise, wait with exponential backoff
 * 5. Retry operation
 *
 * @param operation - Async operation to retry
 * @param options - Retry configuration
 * @returns Result of successful operation
 * @throws Last error if all retries exhausted
 *
 * @example
 * const db = await withRetry(
 *   () => connect(dbPath),
 *   {
 *     maxAttempts: 3,
 *     initialDelay: 1000,
 *     retryableErrors: (err) =>
 *       err.message.includes('ECONNREFUSED') ||
 *       err.message.includes('EAGAIN'),
 *     onRetry: (attempt, error) => {
 *       console.warn(`Retry ${attempt}/3: ${error.message}`);
 *     }
 *   }
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryableErrors = () => true,
    onRetry
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (!retryableErrors(lastError)) {
        throw lastError; // Not retryable, fail immediately
      }

      // Check if max attempts reached
      if (attempt === maxAttempts - 1) {
        throw lastError; // Last attempt, give up
      }

      // Calculate backoff delay
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      // Call retry callback
      onRetry?.(attempt + 1, lastError);

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Wrap an async operation with a timeout
 *
 * Prevents operations from hanging indefinitely by adding a time limit.
 * Useful for database queries, API calls, and file operations.
 *
 * ALGORITHM:
 * 1. Create timeout promise that rejects after specified duration
 * 2. Race operation promise against timeout
 * 3. Return result if operation completes first
 * 4. Throw timeout error if timeout completes first
 *
 * @param promise - Async operation to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Operation name for error message
 * @returns Result of operation if completed before timeout
 * @throws Error if operation times out
 *
 * @example
 * const results = await withTimeout(
 *   query.toArray(),
 *   30000, // 30 second timeout
 *   'Database query'
 * );
 *
 * @example
 * // With custom error handling
 * try {
 *   const data = await withTimeout(
 *     fetchLargeFile(),
 *     60000,
 *     'Large file download'
 *   );
 * } catch (error) {
 *   if (error.message.includes('timed out')) {
 *     console.error('Download took too long, please try again');
 *   }
 * }
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}
