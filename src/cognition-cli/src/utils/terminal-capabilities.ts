/**
 * Terminal Capability Detection
 *
 * Detects terminal capabilities to gracefully degrade features:
 * - Color support
 * - Unicode/emoji support
 * - Box-drawing characters
 * - Terminal width
 *
 * Respects environment variables:
 * - NO_COLOR: Disable colors (standard: https://no-color.org/)
 * - COGNITION_NO_COLOR: CLI-specific color disable
 * - COGNITION_NO_EMOJI: Disable emojis
 * - COGNITION_FORMAT: Output format (auto|plain|json)
 *
 * @example
 * if (useColor()) {
 *   console.log(chalk.green('Success'));
 * } else {
 *   console.log('Success');
 * }
 *
 * @example
 * const icon = useEmoji() ? '✓' : '[OK]';
 */

/**
 * Check if color output is enabled
 *
 * Respects multiple sources (in priority order):
 * 1. COGNITION_NO_COLOR env var (CLI flag)
 * 2. NO_COLOR env var (standard)
 * 3. TTY detection (disable if piped)
 * 4. CI environment detection
 *
 * @returns true if colors should be used
 */
export function useColor(): boolean {
  // Respect CLI flag (set by --no-color)
  if (process.env.COGNITION_NO_COLOR === '1') return false;

  // Respect NO_COLOR standard (https://no-color.org/)
  if (process.env.NO_COLOR) return false;

  // Disable in non-TTY (pipes, redirects)
  if (!process.stdout.isTTY) return false;

  // Disable in CI environments
  if (process.env.CI === 'true') return false;

  return true;
}

/**
 * Check if emoji output is enabled
 *
 * Respects:
 * 1. COGNITION_NO_EMOJI env var (CLI flag)
 * 2. Terminal Unicode support detection
 * 3. Plain format mode
 *
 * @returns true if emojis should be used
 */
export function useEmoji(): boolean {
  // Respect CLI flag (set by --no-emoji)
  if (process.env.COGNITION_NO_EMOJI === '1') return false;

  // Disable in plain format mode
  if (process.env.COGNITION_FORMAT === 'plain') return false;

  // Check if terminal supports Unicode
  const lang = process.env.LANG || '';
  const supportsUnicode =
    lang.includes('UTF-8') || process.platform === 'darwin';

  return supportsUnicode;
}

/**
 * Helper function that returns emoji or fallback based on terminal support
 *
 * @param emoji - Emoji character to use
 * @param fallback - ASCII fallback when emojis not supported
 * @returns Emoji or fallback string
 *
 * @example
 * emoji('✓', '[OK]')  // → "✓" or "[OK]" depending on terminal
 * emoji('🔥', '!')    // → "🔥" or "!" depending on terminal
 */
export function emoji(emojiChar: string, fallback: string): string {
  return useEmoji() ? emojiChar : fallback;
}

/**
 * Check if box-drawing characters are supported
 *
 * @returns true if Unicode box-drawing chars should be used
 */
export function useBoxDrawing(): boolean {
  // Disable in dumb terminals
  if (process.env.TERM === 'dumb') return false;

  // Disable in plain format mode
  if (process.env.COGNITION_FORMAT === 'plain') return false;

  // Check Unicode support
  const lang = process.env.LANG || '';
  return lang.includes('UTF-8') || process.platform === 'darwin';
}

/**
 * Get terminal width for text wrapping
 *
 * @returns Terminal column width (default: 80)
 */
export function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/**
 * Get box-drawing characters based on terminal support
 *
 * Returns Unicode box chars if supported, ASCII fallback otherwise.
 *
 * @returns Object with box-drawing characters
 */
export function getBoxChars() {
  if (useBoxDrawing()) {
    return {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
      leftT: '├',
      rightT: '┤',
      topT: '┬',
      bottomT: '┴',
      cross: '┼',
    };
  } else {
    return {
      topLeft: '+',
      topRight: '+',
      bottomLeft: '+',
      bottomRight: '+',
      horizontal: '-',
      vertical: '|',
      leftT: '+',
      rightT: '+',
      topT: '+',
      bottomT: '+',
      cross: '+',
    };
  }
}

/**
 * Check if output should be in plain mode
 *
 * Plain mode disables:
 * - Colors
 * - Emojis
 * - Box-drawing characters
 * - Fancy formatting
 *
 * @returns true if plain mode is active
 */
export function isPlainMode(): boolean {
  return process.env.COGNITION_FORMAT === 'plain';
}

/**
 * Check if output should be in JSON mode
 *
 * JSON mode disables all visual formatting and outputs structured data.
 *
 * @returns true if JSON mode is active
 */
export function isJsonMode(): boolean {
  return process.env.COGNITION_FORMAT === 'json';
}

/**
 * Detect all terminal capabilities at once
 *
 * Useful for logging or debugging terminal support.
 *
 * @returns Object with all detected capabilities
 */
export function detectTerminalCapabilities() {
  return {
    supportsColor: useColor(),
    supportsEmoji: useEmoji(),
    supportsBoxDrawing: useBoxDrawing(),
    columns: getTerminalWidth(),
    isPlain: isPlainMode(),
    isJson: isJsonMode(),
    platform: process.platform,
    term: process.env.TERM,
    lang: process.env.LANG,
    isTTY: process.stdout.isTTY,
    isCI: process.env.CI === 'true',
  };
}
