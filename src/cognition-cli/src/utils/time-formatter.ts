/**
 * Time Formatting Utilities
 *
 * Provides human-readable time formatting for:
 * - Duration formatting (ms → "3m 42s")
 * - ETA calculation and display
 * - Elapsed time tracking
 *
 * @example
 * const start = Date.now();
 * // ... operation ...
 * console.log(`Completed in ${formatDuration(Date.now() - start)}`);
 * // → "Completed in 2m 15s"
 *
 * @example
 * const eta = calculateETA(120, 500, startTime);
 * console.log(`ETA: ${formatDuration(eta)}`);
 * // → "ETA: 4m 30s"
 */

/**
 * Format milliseconds as human-readable duration
 *
 * Converts milliseconds to friendly format:
 * - < 1s: "500ms"
 * - < 1m: "42.5s"
 * - >= 1m: "3m 42s"
 * - >= 1h: "2h 15m"
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 *
 * @example
 * formatDuration(500) // → "500ms"
 * formatDuration(5500) // → "5.5s"
 * formatDuration(125000) // → "2m 5s"
 * formatDuration(7325000) // → "2h 2m"
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return '0ms';

  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }

  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (seconds > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${minutes}m`;
}

/**
 * Calculate estimated time to completion
 *
 * Based on current progress rate, estimates remaining time.
 * Uses linear extrapolation from elapsed time and progress.
 *
 * @param processed - Number of items processed
 * @param total - Total number of items
 * @param startTime - Start timestamp (Date.now())
 * @returns Estimated remaining time in milliseconds
 *
 * @example
 * const start = Date.now();
 * // ... process 120 of 500 items ...
 * const eta = calculateETA(120, 500, start);
 * console.log(`ETA: ${formatDuration(eta)}`);
 * // → "ETA: 4m 15s"
 */
export function calculateETA(
  processed: number,
  total: number,
  startTime: number
): number {
  if (processed === 0) return 0;
  if (processed >= total) return 0;

  const elapsed = Date.now() - startTime;
  const rate = processed / elapsed; // items per ms
  const remaining = total - processed;
  return remaining / rate;
}

/**
 * Create a progress message with count and ETA
 *
 * Formats a complete progress message showing:
 * - Current/total count
 * - Percentage
 * - ETA (if > 5s remaining)
 *
 * @param processed - Items processed
 * @param total - Total items
 * @param startTime - Start timestamp
 * @param operation - Operation description (e.g., "Processing files")
 * @returns Formatted progress message
 *
 * @example
 * formatProgress(120, 500, startTime, 'Processing files')
 * // → "Processing files (120/500) 24% ETA: 4m 15s"
 */
export function formatProgress(
  processed: number,
  total: number,
  startTime: number,
  operation: string
): string {
  const percent = Math.floor((processed / total) * 100);
  const parts = [`${operation} (${processed}/${total}) ${percent}%`];

  if (processed > 0 && processed < total) {
    const eta = calculateETA(processed, total, startTime);
    if (eta > 5000) {
      // Only show ETA if > 5s
      parts.push(`ETA: ${formatDuration(eta)}`);
    }
  }

  return parts.join(' ');
}

/**
 * Track elapsed time with start/stop
 *
 * Simple timer utility for tracking operation duration.
 *
 * @example
 * const timer = new Timer();
 * timer.start();
 * // ... operation ...
 * const elapsed = timer.stop();
 * console.log(`Took ${formatDuration(elapsed)}`);
 */
export class Timer {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = Date.now();
    this.endTime = 0;
  }

  stop(): number {
    this.endTime = Date.now();
    return this.elapsed();
  }

  elapsed(): number {
    if (this.startTime === 0) return 0;
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }

  reset(): void {
    this.startTime = 0;
    this.endTime = 0;
  }
}
