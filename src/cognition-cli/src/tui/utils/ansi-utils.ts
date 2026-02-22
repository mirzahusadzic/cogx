/**
 * ANSI Utility Functions
 *
 * Provides helpers for cleaning and processing ANSI escape sequences
 * specifically for TUI rendering.
 */

/**
 * Regex to match terminal cursor control sequences
 * Matches:
 * - \x1b[?25h (show cursor), \x1b[?25l (hide cursor)
 * - \x1b[K (erase line), \x1b[2K (erase line)
 * - \x1b[A, \x1b[B, etc (cursor movement)
 * - \x1b[H (home), \x1b[f (force cursor)
 * But preserves SGR (colors/bold) which end in 'm'
 */
// eslint-disable-next-line no-control-regex
export const CURSOR_CONTROL_RE = /\x1b\[(?:\?[\d;]*[hl]|[\d;]*[A-LN-Za-ln-z])/g;

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

/**
 * Convert hex color to ANSI foreground sequence (TrueColor)
 * @param hex Hex color (e.g., #ff0000)
 */
export function hexToAnsi(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}

/**
 * Convert hex color to ANSI background sequence (TrueColor)
 * @param hex Hex color (e.g., #ff0000)
 */
export function hexToAnsiBg(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `\x1b[48;2;${r};${g};${b}m`;
}

/**
 * ANSI Reset Code
 */
export const ANSI_RESET = '\x1b[0m';

/**
 * ANSI Dim Code
 */
export const ANSI_DIM = '\x1b[2m';

/**
 * ANSI Italic Code
 */
export const ANSI_ITALIC = '\x1b[3m';

/**
 * ANSI Bold Code
 */
export const ANSI_BOLD = '\x1b[1m';

/**
 * ANSI Inverse Code
 */
export const ANSI_INVERSE = '\x1b[7m';

/**
 * Get the ANSI escape sequence for a set of styles
 */
export function getStyleAnsi(styles: {
  color?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  dim?: boolean;
  inverse?: boolean;
}): string {
  let ansi = '';
  if (styles.color) ansi += hexToAnsi(styles.color);
  if (styles.bg) ansi += hexToAnsiBg(styles.bg);
  if (styles.bold) ansi += ANSI_BOLD;
  if (styles.italic) ansi += ANSI_ITALIC;
  if (styles.dim) ansi += ANSI_DIM;
  if (styles.inverse) ansi += ANSI_INVERSE;
  return ansi;
}

/**
 * Helper to parse hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    return {
      r: parseInt(cleanHex[0] + cleanHex[0], 16) || 0,
      g: parseInt(cleanHex[1] + cleanHex[1], 16) || 0,
      b: parseInt(cleanHex[2] + cleanHex[2], 16) || 0,
    };
  }
  return {
    r: parseInt(cleanHex.substring(0, 2), 16) || 0,
    g: parseInt(cleanHex.substring(2, 4), 16) || 0,
    b: parseInt(cleanHex.substring(4, 6), 16) || 0,
  };
}
