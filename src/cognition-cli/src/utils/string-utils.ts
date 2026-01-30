import stripAnsi from 'strip-ansi';

/**
 * Strips ANSI escape codes from a string.
 * Centralized utility to avoid direct dependency spread and allow for future optimizations.
 */
export function cleanAnsi(text: string): string {
  if (typeof text !== 'string') return text;
  return stripAnsi(text);
}
