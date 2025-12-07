/**
 * Check if authentication error from stderr
 *
 * Detects authentication failures from SDK stderr output.
 * Used to provide user-friendly error messages and trigger re-authentication.
 *
 * ALGORITHM:
 * 1. Join stderr lines into single string
 * 2. Check for HTTP 401 status code
 * 3. Check for authentication-related error messages:
 *    - "authentication_error"
 *    - "OAuth token has expired"
 *    - "token has expired"
 * 4. Return true if both 401 and error message found
 *
 * @param stderrLines - Array of stderr output lines from SDK
 * @returns True if authentication error detected
 *
 * @example
 * const stderrLines = ["Error: 401 - OAuth token has expired"];
 * if (isAuthenticationError(stderrLines)) {
 *   showLoginPrompt();
 * }
 */
export function isAuthenticationError(stderrLines: string[]): boolean {
  const stderrText = stderrLines.join(' ').toLowerCase();

  // Check for various OAuth/auth error patterns
  return (
    // HTTP 401 status
    (stderrText.includes('401') &&
      (stderrText.includes('authentication_error') ||
        stderrText.includes('oauth') ||
        stderrText.includes('token') ||
        stderrText.includes('unauthorized'))) ||
    // Explicit OAuth expiration messages
    stderrText.includes('oauth token has expired') ||
    stderrText.includes('token has expired') ||
    stderrText.includes('token expired') ||
    stderrText.includes('authentication failed') ||
    stderrText.includes('invalid_grant') ||
    stderrText.includes('credentials have expired') ||
    // Claude/Anthropic specific errors
    stderrText.includes('anthropic_api_error') ||
    stderrText.includes('authentication error') ||
    // Claude Code subprocess exit (SDK swallows actual error, we only get exit code)
    // Our claude-agent-provider.ts converts this to a helpful message containing these keywords
    stderrText.includes('claude code exited unexpectedly') ||
    stderrText.includes('please run: claude /login')
  );
}

/**
 * Format authentication error message
 *
 * Returns a user-friendly error message for authentication failures.
 * Includes instructions for re-authentication via /login command.
 *
 * @returns Formatted authentication error message
 *
 * @example
 * if (isAuthenticationError(stderr)) {
 *   displayError(formatAuthError());
 * }
 */
export function formatAuthError(): string {
  return '⎿ API Error: 401 - OAuth token has expired. Please obtain a new token or refresh your existing token.\n· Please run /login';
}

/**
 * Format generic SDK error
 *
 * Formats SDK error messages for display to user.
 * Handles special case of empty responses (likely authentication issues).
 *
 * ALGORITHM:
 * 1. Check if no stderr and no messages received
 *    - Suggests authentication problem
 *    - Return generic auth check message
 * 2. Otherwise, join stderr lines and return as error
 *
 * @param stderrLines - Array of stderr output lines
 * @param hadMessages - Whether any messages were received from SDK
 * @returns Formatted error message
 *
 * @example
 * const error = formatSDKError(
 *   ["Network error: ECONNREFUSED"],
 *   false
 * );
 * console.error(error);
 */
export function formatSDKError(
  stderrLines: string[],
  hadMessages: boolean
): string {
  if (stderrLines.length === 0 && !hadMessages) {
    return 'SDK completed without response - check authentication';
  }
  return `SDK error: ${stderrLines.join(' ')}`;
}
