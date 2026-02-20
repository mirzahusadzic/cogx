/**
 * Token Count Hook
 *
 * React hook for tracking token usage across conversation with proper
 * reset semantics for context compression.
 *
 * DESIGN PROBLEM:
 * The Claude Agent SDK sends token counts in streaming message_delta events.
 * These counts are cumulative within a session. However, there are two edge cases:
 *
 * 1. NEW QUERY IN SAME SESSION:
 *    SDK may send lower token counts when a new query starts (before accumulating).
 *    Solution: Use Math.max() to prevent count from decreasing
 *
 * 2. COMPRESSION (NEW SESSION):
 *    When context is compressed, we need to reset to 0 and accept the first value.
 *    Problem: Math.max() would keep the old high count!
 *    Solution: reset() sets a flag that bypasses Math.max on next update
 *
 * ALGORITHM:
 * - update(): Normally uses Math.max to prevent decreasing counts
 * - reset(): Sets count to 0 AND sets justReset flag
 * - update() after reset(): Accepts ANY value (bypasses Math.max)
 * - justReset flag auto-clears after first update
 *
 * This ensures:
 * - Counts never decrease during normal conversation
 * - Counts properly reset to 0 after compression
 * - First update after reset accepts new session's token count
 *
 * @example
 * // Normal usage - track tokens during conversation
 * const tokenCounter = useTokenCount();
 *
 * // Update from SDK message
 * tokenCounter.update({
 *   input: 1500,
 *   output: 800,
 *   total: 2300
 * });
 *
 * systemLog('tui', `Tokens: ${tokenCounter.count.total}`);
 *
 * @example
 * // Compression workflow
 * const tokenCounter = useTokenCount();
 *
 * // ... conversation happens, tokens accumulate to 95K ...
 *
 * // Compress context
 * await compressContext();
 * tokenCounter.reset(); // Count goes to 0, justReset flag set
 *
 * // SDK starts new session, sends first update
 * tokenCounter.update({ input: 200, output: 0, total: 200 });
 * // Accepted! (justReset flag bypasses Math.max)
 * systemLog('tui', `Tokens: ${tokenCounter.count.total}`); // 200 (not 95000!)
 */

import { useState, useCallback, useRef, useMemo } from 'react';

/**
 * Token count breakdown by type
 */
export interface TokenCount {
  /** Input tokens (user messages + context) */
  input: number;

  /** Output tokens (assistant responses) */
  output: number;

  /** Total tokens (input + output) */
  total: number;
}

/**
 * Hook for managing token count with proper reset semantics.
 *
 * Provides update() and reset() functions that handle the edge case
 * of resetting counts to 0 during context compression.
 *
 * The key insight is using ref-based flags (justReset, expectDrop) that bypass
 * the Math.max protection for specific scenarios.
 *
 * @returns Object with count state and update/reset/allowDrop functions
 *
 * @example
 * const { count, update, reset, allowDrop } = useTokenCount();
 *
 * // Track tokens
 * update({ input: 1000, output: 500, total: 1500 });
 *
 * // Allow a drop (e.g. after surgical eviction)
 * allowDrop();
 * update({ input: 800, output: 500, total: 1300 }); // Accepted
 *
 * // Reset for new session
 * reset();
 * update({ input: 100, output: 0, total: 100 }); // Accepted
 */
export function useTokenCount() {
  const [count, setCount] = useState<TokenCount>({
    input: 0,
    output: 0,
    total: 0,
  });
  const justReset = useRef(false);
  const expectDrop = useRef(false);

  /**
   * Reset token count to zero.
   *
   * Sets justReset flag to bypass Math.max on next update.
   * Critical for compression workflow where new session starts at 0.
   *
   * @example
   * reset();
   * update({ input: 100, output: 0, total: 100 }); // Accepted
   */
  const reset = useCallback(() => {
    setCount({ input: 0, output: 0, total: 0 });
    justReset.current = true;
    expectDrop.current = false;
  }, []);

  /**
   * Update token count.
   *
   * Normally uses Math.max to prevent count from decreasing.
   * After reset(), accepts any value (bypasses Math.max once).
   *
   * @param newCount - New token count from SDK
   *
   * @example
   * update({ input: 1500, output: 800, total: 2300 });
   */
  const update = useCallback((newCount: TokenCount) => {
    setCount((prev) => {
      // After reset, accept any value (don't use Math.max)
      // This is used during session compression/restart.
      if (justReset.current) {
        justReset.current = false;
        return newCount;
      }

      // If we are waiting for a drop (e.g. after surgical eviction)
      if (expectDrop.current) {
        if (newCount.total < prev.total) {
          // Found the drop!
          expectDrop.current = false;
          return newCount;
        } else if (newCount.total > prev.total) {
          // Count grew instead of dropping (e.g. overhead increased)
          // Still clear the flag as we've seen a change.
          expectDrop.current = false;
          return newCount;
        }
        // If equal, keep waiting for the drop from the provider
        return prev;
      }

      // Normal updates: use Math.max to prevent drops
      // (SDK can send lower values when new query starts)
      if (newCount.total > prev.total) {
        return newCount;
      }

      return prev;
    });
  }, []);

  /**
   * Initialize token count from persisted state.
   *
   * Used on session resume to restore token count for compression threshold.
   * Sets count directly without Math.max logic.
   *
   * @param initialCount - Token count from persisted session state
   */
  const initialize = useCallback((initialCount: TokenCount) => {
    setCount(initialCount);
    // Set justReset to true to allow the first update after initialization
    // to override the persisted count. This is critical when a session is
    // resumed and reconstructed, as the new context size is likely smaller
    // than the persisted one.
    justReset.current = true;
    expectDrop.current = false;
  }, []);

  /**
   * Allow the next token update to decrease the count.
   *
   * Sets expectDrop flag. The next update that differs from current total
   * will be accepted even if it's lower. Useful for surgical eviction.
   */
  const allowDrop = useCallback(() => {
    expectDrop.current = true;
  }, []);

  return useMemo(
    () => ({
      count,
      reset,
      update,
      initialize,
      allowDrop,
    }),
    [count, reset, update, initialize, allowDrop]
  );
}
