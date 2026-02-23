import stripAnsi from 'strip-ansi';

/**
 * Strips ANSI escape codes from a string.
 * Centralized utility to avoid direct dependency spread and allow for future optimizations.
 */
export function cleanAnsi(text: string): string {
  if (typeof text !== 'string') return text;
  return stripAnsi(text);
}

/**
 * Formats a number into a compact string representation (e.g., 1.7M, 269k).
 * Useful for displaying large counts in space-constrained UI elements.
 */
export function formatCompactNumber(num: number): string {
  const absNum = Math.abs(num);
  if (absNum === 0) return '0';

  if (absNum >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }

  if (absNum >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  }

  return num.toString();
}
