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
 *    - "invalid_api_key"
 * 4. Return true if auth error found
 *
 * @param stderrLines - Array of stderr output lines from SDK
 * @returns True if authentication error detected
 *
 * @example
 * const stderrLines = ["Error: 401 - Unauthorized"];
 * if (isAuthenticationError(stderrLines)) {
 *   showLoginPrompt();
 * }
 */
export function isAuthenticationError(stderrLines: string[]): boolean {
  const stderrText = stderrLines.join(' ').toLowerCase();

  // Check for various auth error patterns
  return (
    // HTTP 401 status
    (stderrText.includes('401') &&
      (stderrText.includes('authentication_error') ||
        stderrText.includes('api key') ||
        stderrText.includes('token') ||
        stderrText.includes('unauthorized'))) ||
    // Explicit expiration messages
    stderrText.includes('token has expired') ||
    stderrText.includes('token expired') ||
    stderrText.includes('authentication failed') ||
    stderrText.includes('invalid_api_key') ||
    stderrText.includes('credentials have expired') ||
    // Claude/Anthropic specific errors
    stderrText.includes('anthropic_api_error') ||
    stderrText.includes('authentication error') ||
    // Claude/OpenAI/Gemini provider error wrappers
    stderrText.includes('please check your anthropic_api_key') ||
    stderrText.includes('please check your gemini_api_key') ||
    stderrText.includes('please check your openai_api_key')
  );
}

/**
 * Format authentication error message
 *
 * Returns a user-friendly error message for authentication failures.
 *
 * @returns Formatted authentication error message
 */
export function formatAuthError(): string {
  return '⎿ API Error: 401 - Authentication failed. Please check your API key.';
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
 * systemLog('tui', error, undefined, 'error');
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
