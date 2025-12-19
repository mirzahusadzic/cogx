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
 * console.log(`Tokens: ${tokenCounter.count.total}`);
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
 * console.log(tokenCounter.count.total); // 200 (not 95000!)
 */

import { useState, useCallback, useRef } from 'react';

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
 * The key insight is using a ref-based flag (justReset) that bypasses
 * the Math.max protection for exactly ONE update after reset().
 *
 * @returns Object with count state and update/reset functions
 *
 * @example
 * const { count, update, reset } = useTokenCount();
 *
 * // Track tokens
 * update({ input: 1000, output: 500, total: 1500 });
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
      if (justReset.current) {
        justReset.current = false;
        return newCount;
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
  }, []);

  return {
    count,
    reset,
    update,
    initialize,
  };
}
