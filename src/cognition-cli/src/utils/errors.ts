/**
 * Standardized Error Handling for Cognition CLI
 *
 * Provides user-friendly error messages with:
 * - Error codes for searchability (COG-E001, COG-E002, etc.)
 * - Clear titles and descriptions
 * - Actionable solution suggestions
 * - Documentation links
 * - Optional stack traces in verbose mode
 *
 * ERROR CODE SCHEMA:
 * - COG-E0xx: User input errors (invalid arguments, missing files)
 * - COG-E1xx: System errors (permissions, disk space)
 * - COG-E2xx: Network errors (API failures, timeouts)
 * - COG-E3xx: PGC errors (workspace not found, corruption)
 * - COG-E4xx: Internal errors (bugs, unexpected conditions)
 *
 * EXIT CODE MAPPING:
 * - 0:   Success
 * - 1:   General error (catch-all)
 * - 2:   Missing required arguments (COG-E001)
 * - 3:   Invalid configuration (COG-E002, COG-E003)
 * - 4:   PGC not initialized (COG-E301, COG-E302)
 * - 5:   Workbench connection failed (COG-E201)
 * - 6:   API request failed (COG-E202)
 * - 7:   Permission denied (COG-E101)
 * - 8:   Internal error (COG-E401)
 * - 130: Interrupted (SIGINT/Ctrl-C)
 *
 * @example
 * throw new CognitionError(
 *   'COG-E301',
 *   'Workspace Not Found',
 *   'No .open_cognition directory found in current path or parent directories.',
 *   [
 *     'Run "cognition-cli init" to create a new workspace',
 *     'Navigate to an existing project directory',
 *     'Use --project-root to specify workspace location'
 *   ],
 *   'https://docs.cognition.dev/errors/COG-E301'
 * );
 */

/**
 * Standardized error class for Cognition CLI
 *
 * Extends Error with additional fields for better error handling and formatting.
 * All commands should throw CognitionError instead of generic Error.
 */
export class CognitionError extends Error {
  /**
   * Create a new CognitionError
   *
   * @param code - Error code (e.g., 'COG-E001')
   * @param title - Short, user-friendly title
   * @param message - Detailed explanation of what went wrong
   * @param solutions - Array of suggested fixes (actionable steps)
   * @param docsLink - Optional link to troubleshooting documentation
   * @param cause - Original error for debugging (shown in verbose mode)
   */
  constructor(
    public code: string,
    public title: string,
    message: string,
    public solutions: string[],
    public docsLink?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'CognitionError';
    // Maintain proper stack trace for where our error was created (V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CognitionError);
    }
  }
}

/**
 * Predefined error codes with factory functions
 * Makes it easy to throw common errors consistently
 */
export const ErrorCodes = {
  /**
   * COG-E001: Required argument missing
   */
  MISSING_ARGUMENT: (argName: string) =>
    new CognitionError(
      'COG-E001',
      'Missing Required Argument',
      `The required argument '${argName}' was not provided.`,
      [
        `Provide the ${argName} argument`,
        `Run command with --help to see usage examples`,
      ],
      'https://mirzahusadzic.github.io/cogx/manual/'
    ),

  /**
   * COG-E002: Invalid argument value
   */
  INVALID_ARGUMENT: (argName: string, value: string, expected: string) =>
    new CognitionError(
      'COG-E002',
      'Invalid Argument Value',
      `The argument '${argName}' has invalid value '${value}'. Expected: ${expected}`,
      [
        `Provide a valid ${argName} value`,
        `Run command with --help to see valid options`,
      ],
      'https://mirzahusadzic.github.io/cogx/manual/'
    ),

  /**
   * COG-E003: File not found
   */
  FILE_NOT_FOUND: (filePath: string) =>
    new CognitionError(
      'COG-E003',
      'File Not Found',
      `The file '${filePath}' does not exist.`,
      [
        'Check that the file path is correct',
        'Use an absolute path or path relative to current directory',
        'Verify file permissions',
      ],
      'https://mirzahusadzic.github.io/cogx/manual/'
    ),

  /**
   * COG-E301: PGC workspace not found
   */
  WORKSPACE_NOT_FOUND: (searchPath: string) =>
    new CognitionError(
      'COG-E301',
      'Workspace Not Found',
      `No .open_cognition directory found in '${searchPath}' or parent directories.`,
      [
        'Run "cognition-cli init" to create a new workspace',
        'Navigate to an existing project directory',
        'Use --project-root to specify workspace location',
      ],
      'https://mirzahusadzic.github.io/cogx/manual/part-1-foundation/02-the-pgc.html#initialization-and-lifecycle'
    ),

  /**
   * COG-E302: PGC workspace corrupted
   */
  WORKSPACE_CORRUPTED: (reason: string) =>
    new CognitionError(
      'COG-E302',
      'Workspace Corrupted',
      `The PGC workspace appears to be corrupted: ${reason}`,
      [
        'Run "cognition-cli init" to reinitialize (WARNING: destructive)',
        'Restore from backup if available',
        'Check file permissions on .open_cognition directory',
      ],
      'https://mirzahusadzic.github.io/cogx/manual/'
    ),

  /**
   * COG-E201: Workbench connection failed
   */
  WORKBENCH_CONNECTION_FAILED: (url: string, cause?: Error) =>
    new CognitionError(
      'COG-E201',
      'Workbench Connection Failed',
      `Unable to connect to workbench at '${url}'`,
      [
        'Check that the workbench server is running',
        'Verify the URL is correct (WORKBENCH_URL env var or --workbench flag)',
        'Check firewall settings',
        'Try running: curl ' + url + '/health',
      ],
      'https://mirzahusadzic.github.io/cogx/manual/',
      cause
    ),

  /**
   * COG-E202: API request failed
   */
  API_REQUEST_FAILED: (endpoint: string, statusCode: number, cause?: Error) =>
    new CognitionError(
      'COG-E202',
      'API Request Failed',
      `API request to '${endpoint}' failed with status ${statusCode}`,
      [
        'Check workbench server logs for errors',
        'Verify API credentials (WORKBENCH_API_KEY)',
        'Try again in a few moments',
        'Use --verbose for detailed error information',
      ],
      'https://mirzahusadzic.github.io/cogx/manual/',
      cause
    ),

  /**
   * COG-E101: Permission denied
   */
  PERMISSION_DENIED: (path: string, operation: string) =>
    new CognitionError(
      'COG-E101',
      'Permission Denied',
      `Permission denied when attempting to ${operation} '${path}'`,
      [
        'Check file/directory permissions',
        'Run with appropriate user privileges',
        'Verify you own the directory',
      ],
      'https://mirzahusadzic.github.io/cogx/manual/'
    ),

  /**
   * COG-E401: Internal error (bug)
   */
  INTERNAL_ERROR: (context: string, cause?: Error) =>
    new CognitionError(
      'COG-E401',
      'Internal Error',
      `An unexpected error occurred: ${context}`,
      [
        'This is likely a bug - please report it',
        'Use --verbose to see stack trace',
        'Include error details when reporting',
      ],
      'https://github.com/mirzahusadzic/cogx/issues',
      cause
    ),

  /**
   * COG-E005: Non-interactive mode requires flag
   */
  NON_INTERACTIVE_MISSING_FLAG: (flagName: string, flagDescription: string) =>
    new CognitionError(
      'COG-E005',
      'Missing Required Flag',
      `This command requires user input, but --no-input mode is active.`,
      [
        `Provide the ${flagName} flag: ${flagDescription}`,
        'Remove --no-input to enable interactive prompts',
        'Ensure stdin is connected to a terminal',
      ],
      'https://mirzahusadzic.github.io/cogx/manual/'
    ),
};

/**
 * Exit code mapping for CognitionError codes
 *
 * Maps error codes to specific exit codes for script-friendly error handling.
 * Scripts can check exit codes to determine the type of failure.
 *
 * @example
 * // In a shell script:
 * // cognition genesis src/
 * // if [ $? -eq 4 ]; then echo "PGC not initialized"; fi
 */
export const EXIT_CODES: Record<string, number> = {
  // User input errors (exit 2-3)
  'COG-E001': 2, // Missing required argument
  'COG-E002': 3, // Invalid argument value
  'COG-E003': 3, // File not found
  'COG-E005': 2, // Non-interactive missing flag

  // System errors (exit 7)
  'COG-E101': 7, // Permission denied

  // Network errors (exit 5-6)
  'COG-E201': 5, // Workbench connection failed
  'COG-E202': 6, // API request failed

  // PGC errors (exit 4)
  'COG-E301': 4, // Workspace not found
  'COG-E302': 4, // Workspace corrupted

  // Internal errors (exit 8)
  'COG-E401': 8, // Internal error (bug)
};

/**
 * Get the exit code for a CognitionError
 *
 * @param error - CognitionError instance or error code string
 * @returns Exit code (1 if not mapped)
 *
 * @example
 * process.exit(getExitCode(error));
 */
export function getExitCode(error: CognitionError | string): number {
  const code = typeof error === 'string' ? error : error.code;
  return EXIT_CODES[code] ?? 1;
}
