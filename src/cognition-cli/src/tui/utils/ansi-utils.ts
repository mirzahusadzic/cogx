import { terminalFormatter } from '../../core/services/terminal-formatter/TerminalFormatterService.js';

/**
 * ANSI Utility Functions
 *
 * Provides helpers for cleaning and processing ANSI escape sequences
 * specifically for TUI rendering.
 *
 * @deprecated Use TerminalFormatterService instead.
 */

/**
 * Regex to match terminal cursor control sequences
 * @deprecated Use TerminalFormatterService.CURSOR_CONTROL_RE instead.
 */
// eslint-disable-next-line no-control-regex
export const CURSOR_CONTROL_RE = /\x1b\[(?:\?[\d;]*[hl]|[\d;]*[A-LN-Za-ln-z])/g;

/**
 * Strip terminal cursor control sequences from a string
 *
 * @param text - Text to clean
 * @returns Cleaned text
 * @deprecated Use terminalFormatter.stripCursorSequences instead.
 */
export function stripCursorSequences(text: string): string {
  return terminalFormatter.stripCursorSequences(text);
}

/**
 * Convert hex color to ANSI foreground sequence (TrueColor)
 * @param hex Hex color (e.g., #ff0000)
 * @deprecated Use terminalFormatter.hexToAnsi instead.
 */
export function hexToAnsi(hex: string): string {
  return terminalFormatter.hexToAnsi(hex);
}

/**
 * Convert hex color to ANSI background sequence (TrueColor)
 * @param hex Hex color (e.g., #ff0000)
 * @deprecated Use terminalFormatter.hexToAnsiBg instead.
 */
export function hexToAnsiBg(hex: string): string {
  return terminalFormatter.hexToAnsiBg(hex);
}

/**
 * ANSI Reset Code
 * @deprecated Use terminalFormatter.ANSI_RESET instead.
 */
export const ANSI_RESET = terminalFormatter.ANSI_RESET;

/**
 * ANSI Dim Code
 * @deprecated Use terminalFormatter.ANSI_DIM instead.
 */
export const ANSI_DIM = terminalFormatter.ANSI_DIM;

/**
 * ANSI Italic Code
 * @deprecated Use terminalFormatter.ANSI_ITALIC instead.
 */
export const ANSI_ITALIC = terminalFormatter.ANSI_ITALIC;

/**
 * ANSI Bold Code
 * @deprecated Use terminalFormatter.ANSI_BOLD instead.
 */
export const ANSI_BOLD = terminalFormatter.ANSI_BOLD;

/**
 * ANSI Inverse Code
 * @deprecated Use terminalFormatter.ANSI_INVERSE instead.
 */
export const ANSI_INVERSE = terminalFormatter.ANSI_INVERSE;

/**
 * Get the ANSI escape sequence for a set of styles
 * @deprecated Use terminalFormatter.getStyleAnsi instead.
 */
export function getStyleAnsi(styles: {
  color?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  dim?: boolean;
  inverse?: boolean;
}): string {
  return terminalFormatter.getStyleAnsi(styles);
}
