/**
 * Structured Logging System
 *
 * Provides consistent, leveled logging with module namespacing.
 * Enables debugging, error tracking, and observability.
 *
 * DESIGN:
 * - Log levels: DEBUG, INFO, WARN, ERROR
 * - Module namespacing: Each logger has a module name
 * - Global level control: Can set minimum log level globally
 * - Structured context: Attach metadata to log messages
 * - Optional color output: Uses chalk if available
 *
 * @example
 * const logger = new Logger('Genesis');
 * logger.info('Starting genesis', { source: 'src/', files: 42 });
 * logger.warn('Skipping large file', { path: 'data.json', size: '15MB' });
 * logger.error('Processing failed', error, { file: 'main.ts' });
 */

import chalk from 'chalk';

/**
 * Log severity levels (ordered by priority)
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Global minimum log level (can be set via environment or config)
 */
let globalLogLevel: LogLevel = LogLevel.INFO;

/**
 * Set global minimum log level
 *
 * Messages below this level will not be logged.
 *
 * @param level - Minimum log level
 *
 * @example
 * // Enable debug logging
 * setGlobalLogLevel(LogLevel.DEBUG);
 *
 * @example
 * // Silence all logs except errors
 * setGlobalLogLevel(LogLevel.ERROR);
 */
export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

/**
 * Get global log level (for testing or conditional logic)
 */
export function getGlobalLogLevel(): LogLevel {
  return globalLogLevel;
}

/**
 * Logger with module namespacing and structured logging
 */
export class Logger {
  /**
   * Create a logger for a specific module
   *
   * @param module - Module name for log prefixing
   * @param level - Minimum level for this logger (defaults to global level)
   */
  constructor(
    private module: string,
    private level: LogLevel = globalLogLevel
  ) {}

  /**
   * Log debug message (low-level details for troubleshooting)
   *
   * @param msg - Log message
   * @param context - Optional structured context data
   */
  debug(msg: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.DEBUG && globalLogLevel <= LogLevel.DEBUG) {
      const formatted = this.formatMessage('DEBUG', msg, context);
      console.log(
        chalk?.gray ? chalk.gray(formatted) : formatted
      );
    }
  }

  /**
   * Log info message (general informational messages)
   *
   * @param msg - Log message
   * @param context - Optional structured context data
   */
  info(msg: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.INFO && globalLogLevel <= LogLevel.INFO) {
      const formatted = this.formatMessage('INFO', msg, context);
      console.log(formatted);
    }
  }

  /**
   * Log warning message (important but non-critical issues)
   *
   * @param msg - Log message
   * @param context - Optional structured context data
   */
  warn(msg: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.WARN && globalLogLevel <= LogLevel.WARN) {
      const formatted = this.formatMessage('WARN', msg, context);
      console.warn(
        chalk?.yellow ? chalk.yellow(formatted) : formatted
      );
    }
  }

  /**
   * Log error message (critical issues requiring attention)
   *
   * @param msg - Log message
   * @param error - Optional error object (stack trace will be logged)
   * @param context - Optional structured context data
   */
  error(msg: string, error?: Error, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.ERROR && globalLogLevel <= LogLevel.ERROR) {
      const formatted = this.formatMessage('ERROR', msg, context);
      console.error(
        chalk?.red ? chalk.red(formatted) : formatted
      );

      // Log stack trace if error provided
      if (error && error.stack) {
        console.error(
          chalk?.red ? chalk.red(error.stack) : error.stack
        );
      }
    }
  }

  /**
   * Format log message with module, level, and context
   *
   * @private
   */
  private formatMessage(
    level: string,
    msg: string,
    context?: Record<string, unknown>
  ): string {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${this.module}] ${level}: ${msg}`;

    if (context && Object.keys(context).length > 0) {
      formatted += ` ${JSON.stringify(context)}`;
    }

    return formatted;
  }
}

/**
 * Create logger for a module
 *
 * Convenience function for creating loggers.
 *
 * @param module - Module name
 * @returns Logger instance
 *
 * @example
 * const logger = createLogger('WorkbenchClient');
 * logger.info('Connecting to workbench');
 */
export function createLogger(module: string): Logger {
  return new Logger(module);
}
