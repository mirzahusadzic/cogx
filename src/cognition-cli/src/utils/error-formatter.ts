/**
 * Error Formatting Utilities
 *
 * Provides consistent, user-friendly formatting for CognitionError instances.
 * Supports both normal and verbose modes, with accessibility-aware output.
 *
 * @example
 * try {
 *   throw ErrorCodes.WORKSPACE_NOT_FOUND('/path/to/project');
 * } catch (error) {
 *   if (error instanceof CognitionError) {
 *     console.error(formatError(error, options.verbose));
 *     process.exit(1);
 *   }
 * }
 */

import chalk from 'chalk';
import { CognitionError } from './errors.js';
import { useColor, emoji as emojiHelper } from './terminal-capabilities.js';

/**
 * Format a CognitionError for display
 *
 * Creates a user-friendly error message with:
 * - Error code and title
 * - Detailed description
 * - List of suggested solutions
 * - Documentation link
 * - Optional stack trace (verbose mode)
 *
 * Respects terminal capabilities (colors, emojis).
 *
 * @param error - CognitionError instance to format
 * @param verbose - Show stack trace and cause details
 * @returns Formatted error string ready for console.error()
 */
export function formatError(error: CognitionError, verbose: boolean): string {
  const lines: string[] = [];
  const c = useColor() ? chalk : createNoopChalk();
  const showEmoji = emojiHelper;

  // Error header with code and title
  lines.push(
    c.red.bold(
      `${showEmoji('✗', 'X')} Error [${error.code}]: ${error.title}`
    )
  );
  lines.push('');

  // Detailed message
  lines.push(c.white(error.message));
  lines.push('');

  // Solutions (if any)
  if (error.solutions.length > 0) {
    lines.push(c.bold('Possible Solutions:'));
    error.solutions.forEach((solution) => {
      lines.push(`  ${c.cyan(showEmoji('•', '-'))} ${solution}`);
    });
    lines.push('');
  }

  // Documentation link
  if (error.docsLink) {
    lines.push(c.dim(`${showEmoji('📖', 'Docs:')} ${error.docsLink}`));
    lines.push('');
  }

  // Verbose mode: show cause and stack trace
  if (verbose && error.cause) {
    lines.push(c.dim('-'.repeat(60)));
    lines.push(c.dim('Stack Trace (verbose mode):'));
    lines.push(c.dim(error.cause.stack || 'No stack trace available'));
  } else if (error.cause) {
    lines.push(
      c.dim(`${showEmoji('💡', 'Tip:')} Run with --verbose for detailed error information`)
    );
  }

  return lines.join('\n');
}

/**
 * Create a no-op chalk-like object for when colors are disabled
 * Returns identity functions that don't modify the string
 */
function createNoopChalk() {
  const identity = (s: string) => s;
  return {
    red: {
      bold: identity,
    },
    bold: identity,
    white: identity,
    cyan: identity,
    dim: identity,
  };
}

/**
 * Format a generic error (non-CognitionError) for display
 *
 * Converts unknown errors to a standardized format.
 * Used as a fallback when error is not a CognitionError instance.
 *
 * @param error - Generic Error or unknown error object
 * @param verbose - Show stack trace
 * @returns Formatted error string
 */
export function formatGenericError(error: unknown, verbose: boolean): string {
  const lines: string[] = [];
  const c = useColor() ? chalk : createNoopChalk();
  const showEmoji = emojiHelper;

  lines.push(c.red.bold(`${showEmoji('✗', 'X')} Unexpected Error`));
  lines.push('');

  if (error instanceof Error) {
    lines.push(c.white(error.message));
    lines.push('');

    if (verbose && error.stack) {
      lines.push(c.dim('-'.repeat(60)));
      lines.push(c.dim('Stack Trace:'));
      lines.push(c.dim(error.stack));
    }
  } else {
    lines.push(c.white(String(error)));
  }

  lines.push('');
  lines.push(c.bold('This appears to be an unexpected error.'));
  lines.push(c.dim('Please report this issue with the error details above.'));
  lines.push(
    c.dim('Report at: https://github.com/mirzahusadzic/cogx/issues')
  );

  return lines.join('\n');
}
