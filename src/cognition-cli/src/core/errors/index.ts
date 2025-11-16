/**
 * Custom Error Hierarchy for cognition-cli
 *
 * Provides structured error types with context preservation and consistent handling.
 * All errors extend the base CognitionError class for uniform error handling.
 *
 * DESIGN:
 * - Base error class with structured context
 * - Error codes for programmatic handling
 * - Cause chaining to preserve root errors
 * - Type-safe error categories
 *
 * @example
 * // File operation error
 * throw new FileOperationError('write', '/path/to/file', new Error('ENOSP'));
 *
 * @example
 * // Network error with retry context
 * throw new NetworkError('fetch', {
 *   url: 'http://api.example.com',
 *   attempt: 3,
 *   maxRetries: 5
 * }, originalError);
 */

/**
 * Base error class for all cognition-cli errors
 *
 * Provides structured context and cause chaining for better debugging.
 *
 * @example
 * throw new CognitionError(
 *   'Failed to process pattern',
 *   'PATTERN_PROCESS_ERROR',
 *   { patternId: '123', phase: 'embedding' },
 *   { cause: originalError }
 * );
 */
export class CognitionError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>,
    options?: { cause?: Error }
  ) {
    super(message, options);
    this.name = this.constructor.name;

    // Ensure stack trace includes the cause
    if (options?.cause && Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
      cause: this.cause instanceof Error ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : this.cause
    };
  }
}

/**
 * File operation errors (ENOENT, EACCES, ENOSPC, etc.)
 *
 * @example
 * throw new FileOperationError('read', '/path/to/config.json', ioError);
 */
export class FileOperationError extends CognitionError {
  constructor(
    operation: string,
    filePath: string,
    cause?: Error,
    additionalContext?: Record<string, unknown>
  ) {
    // Sanitize file path for security (remove absolute paths in production)
    const sanitizedPath = process.env.NODE_ENV === 'production'
      ? filePath.split('/').pop() || filePath
      : filePath;

    super(
      `File operation failed: ${operation}`,
      'FILE_OPERATION_ERROR',
      { operation, path: sanitizedPath, ...additionalContext },
      { cause }
    );
  }
}

/**
 * Network operation errors (ETIMEDOUT, ECONNRESET, rate limits, etc.)
 *
 * @example
 * throw new NetworkError('embed', { url, attempt: 3 }, timeoutError);
 */
export class NetworkError extends CognitionError {
  constructor(
    operation: string,
    context: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      `Network operation failed: ${operation}`,
      'NETWORK_ERROR',
      context,
      { cause }
    );
  }
}

/**
 * Database operation errors (LanceDB, connection issues, etc.)
 *
 * @example
 * throw new DatabaseError('mergeInsert', { table: 'patterns' }, busyError);
 */
export class DatabaseError extends CognitionError {
  constructor(
    operation: string,
    context: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      `Database operation failed: ${operation}`,
      'DATABASE_ERROR',
      context,
      { cause }
    );
  }
}

/**
 * Validation errors (schema, dimensions, types, etc.)
 *
 * @example
 * throw new ValidationError('Embedding dimension mismatch', {
 *   expected: 768,
 *   actual: 512
 * });
 */
export class ValidationError extends CognitionError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, 'VALIDATION_ERROR', context, { cause });
  }
}

/**
 * Worker pool errors (crashes, timeout, communication failures, etc.)
 *
 * @example
 * throw new WorkerError('lineage-worker', { jobId: '123' }, crashError);
 */
export class WorkerError extends CognitionError {
  constructor(
    workerType: string,
    context: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      `Worker error: ${workerType}`,
      'WORKER_ERROR',
      context,
      { cause }
    );
  }
}

/**
 * Compression/lattice errors (timeout, analysis failures, etc.)
 *
 * @example
 * throw new CompressionError('Analysis queue timeout', {
 *   queueLength: 10,
 *   timeoutMs: 60000
 * });
 */
export class CompressionError extends CognitionError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, 'COMPRESSION_ERROR', context, { cause });
  }
}

/**
 * Configuration errors (missing env vars, invalid settings, etc.)
 *
 * @example
 * throw new ConfigurationError('WORKBENCH_API_KEY not set');
 */
export class ConfigurationError extends CognitionError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'CONFIGURATION_ERROR', context);
  }
}

/**
 * Type guard to check if error is a CognitionError
 */
export function isCognitionError(error: unknown): error is CognitionError {
  return error instanceof CognitionError;
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * Extract error stack from unknown error type
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}
