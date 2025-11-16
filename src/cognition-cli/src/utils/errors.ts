/**
 * User-Facing Error Classes
 *
 * Structured error types for clear, actionable error messages that
 * help users understand what went wrong and how to fix it.
 *
 * DESIGN:
 * - UserFacingError: Primary error class with causes, solutions, and docs links
 * - Auto-formatting: Converts structured data into readable error messages
 * - Error codes: Optional codes for documentation lookup
 *
 * @example
 * throw new UserFacingError(
 *   'Failed to connect to workbench',
 *   [
 *     'Workbench not running',
 *     'API key not set',
 *     'Network connectivity issue'
 *   ],
 *   [
 *     'Start workbench: npm run workbench',
 *     'Set API key: export WORKBENCH_API_KEY="your-key"',
 *     'Check network: curl http://localhost:8000/health'
 *   ],
 *   'https://docs.cognition-sigma.dev/troubleshooting#workbench'
 * );
 */

/**
 * User-friendly error with structured context
 *
 * Extends Error with additional metadata for better user experience:
 * - causes: List of possible reasons for the error
 * - solutions: List of actionable steps to fix it
 * - docsLink: Link to documentation for detailed help
 * - originalError: Wrapped error (if applicable) for debugging
 */
export class UserFacingError extends Error {
  /**
   * Create a user-facing error with structured guidance
   *
   * @param userMessage - Brief description of what went wrong
   * @param causes - List of possible reasons (optional)
   * @param solutions - List of steps to fix it (optional)
   * @param docsLink - URL to documentation (optional)
   * @param originalError - Wrapped error for debugging (optional)
   * @param errorCode - Error code for documentation lookup (optional)
   */
  constructor(
    public userMessage: string,
    public causes: string[] = [],
    public solutions: string[] = [],
    public docsLink?: string,
    public originalError?: Error,
    public errorCode?: string
  ) {
    super(formatUserMessage(userMessage, causes, solutions, docsLink, errorCode));
    this.name = 'UserFacingError';

    // Preserve original stack trace if wrapping another error
    if (originalError && originalError.stack) {
      this.stack = `${this.stack}\n\nCaused by: ${originalError.stack}`;
    }
  }
}

/**
 * Format error message for user display
 *
 * Converts structured error data into readable text with:
 * - Clear problem statement
 * - Numbered list of possible causes
 * - Numbered list of solutions
 * - Documentation link
 * - Error code (if provided)
 */
function formatUserMessage(
  message: string,
  causes: string[],
  solutions: string[],
  docsLink?: string,
  errorCode?: string
): string {
  let output = `\n❌ ${message}\n`;

  if (errorCode) {
    output += `\nError Code: ${errorCode}\n`;
  }

  if (causes.length > 0) {
    output += '\nPossible causes:\n';
    causes.forEach((cause, i) => {
      output += `  ${i + 1}. ${cause}\n`;
    });
  }

  if (solutions.length > 0) {
    output += '\nTo fix:\n';
    solutions.forEach((solution, i) => {
      output += `  ${i + 1}. ${solution}\n`;
    });
  }

  if (docsLink) {
    output += `\nDocumentation: ${docsLink}\n`;
  }

  return output;
}

/**
 * Validation error for invalid input
 *
 * Used when user provides invalid CLI arguments, file paths, or data.
 */
export class ValidationError extends UserFacingError {
  constructor(message: string, solution?: string) {
    super(
      message,
      ['Invalid input provided'],
      solution ? [solution] : []
    );
    this.name = 'ValidationError';
  }
}

/**
 * Configuration error for missing or invalid config
 *
 * Used when environment variables, config files, or setup is incorrect.
 */
export class ConfigurationError extends UserFacingError {
  constructor(message: string, causes: string[], solutions: string[]) {
    super(message, causes, solutions);
    this.name = 'ConfigurationError';
  }
}

/**
 * Dependency error for missing or unavailable external services
 *
 * Used when workbench, LanceDB, or other dependencies are unavailable.
 */
export class DependencyError extends UserFacingError {
  constructor(
    service: string,
    message: string,
    causes: string[],
    solutions: string[]
  ) {
    super(`${service}: ${message}`, causes, solutions);
    this.name = 'DependencyError';
  }
}
