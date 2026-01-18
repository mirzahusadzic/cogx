/**
 * ANSI Utility Functions
 * 
 * Provides helpers for cleaning and processing ANSI escape sequences
 * specifically for TUI rendering.
 */

/**
 * Regex to match terminal cursor control sequences
 * Matches: \x1b[?25h (show cursor), \x1b[?25l (hide cursor), and variations
 */
export const CURSOR_CONTROL_RE = /\x1b\[\?\d*[hl]/g;

/**
 * Strip terminal cursor control sequences from a string
 * 
 * @param text - Text to clean
 * @returns Cleaned text
 */
export function stripCursorSequences(text: string): string {
  if (!text) return text;
  return text.replace(CURSOR_CONTROL_RE, '');
}
