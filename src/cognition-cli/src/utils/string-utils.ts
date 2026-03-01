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
 * Strips Sigma task markers (<!-- sigma-task: ... -->) from a string.
 * These are used internally for token eviction and logging but should
 * be hidden from the user in the TUI.
 */
export function stripSigmaMarkers(text: string): string {
  if (typeof text !== 'string') return text;
  // Use a global regex to handle multiple markers.
  // 1. First remove markers that are on their own line.
  // If the marker is at the very beginning of the string, don't leave a leading newline.
  let result = text.replace(
    /(\r?\n|^)\s*<!-- sigma-task: [^>]+ -->\s*(?:\r?\n|$)/g,
    (_, prefix) => (prefix ? '\n' : '')
  );
  // 2. Then remove markers in the middle of text.
  // We use a more careful replacement to avoid injecting spaces where not needed.
  result = result.replace(/\s*<!-- sigma-task: [^>]+ -->\s*/g, (match) => {
    // If it was surrounded by spaces, keep one space.
    // Otherwise, if it was at the end or start of a line/string, we don't need to add a space.
    return match.startsWith(' ') && match.endsWith(' ') ? ' ' : '';
  });

  // 3. Cleanup trailing whitespace but preserve intentional leading newlines.
  // We no longer strip all leading newlines globally because they are significant in streaming deltas.
  if (result.trim().length === 0) return '';
  return result.trimEnd();
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
