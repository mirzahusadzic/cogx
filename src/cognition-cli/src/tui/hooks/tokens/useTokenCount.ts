/**
 * Token Count Hook
 *
 * React hook for tracking token usage across conversation with proper
 * reset semantics for context compression.
 *
 * DESIGN PROBLEM:
 * The Claude Agent SDK sends token counts in streaming message_delta events.
 * These counts are cumulative within a turn, but can drop when a new turn
 * starts or when context is evicted/compressed.
 *
 * 1. NEW TURN:
 *    When a new turn starts, the output tokens reset to 0 and the input tokens
 *    may grow (due to previous turn's output becoming part of prompt).
 *    Solution: Directly update state to reflect the current context window.
 *
 * 2. COMPRESSION/EVICTION:
 *    When context is compressed or surgically evicted, token counts drop.
 *    Solution: Directly update state to reflect the new smaller window.
 *
 * 3. TRANSIENT 0:
 *    Providers may report 0 tokens while thinking.
 *    Solution: Allow 0 to be reported so the UI can show the reset state.
 *
 * ALGORITHM:
 * - update(): Updates the current token count state directly.
 * - reset(): Sets count to 0.
 *
 * This ensures:
 * - Counts accurately reflect the current context window reported by the SDK.
 * - UI correctly shows 0 output tokens during the "thinking" phase of a new turn.
 * - Context eviction is immediately visible in the UI.
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

  /** Cached tokens (discounted) */
  cached?: number;
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

  // Accumulation tracking for multi-turn context windows
  const accumulatedOutput = useRef(0);
  const lastTurnOutput = useRef(0);

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
    setCount({ input: 0, output: 0, total: 0, cached: 0 });
    justReset.current = true;
    accumulatedOutput.current = 0;
    lastTurnOutput.current = 0;
  }, []);

  /**
   * Update token count.
   *
   * Updates the state with the new count directly to reflect the
   * current context window as reported by the provider.
   *
   * @param newCount - New token count from SDK
   *
   * @example
   * update({ input: 1500, output: 800, total: 2300 });
   */
  const update = useCallback((newCount: TokenCount) => {
    // Ignore 0-token reports (common at the start of provider streams) to prevent
    // the UI from flickering or hiding the token count panel prematurely.
    if (newCount.total === 0) return;

    // Detect new turn or tool use by seeing output tokens reset/drop
    // We only do this if total > 0 to avoid false positives during transient provider states
    if (newCount.total > 0 && newCount.output < lastTurnOutput.current) {
      accumulatedOutput.current += lastTurnOutput.current;
    }
    lastTurnOutput.current = newCount.output;

    // Safety: If context window shrunk (eviction/compression) without a reset,
    // ensure accumulated output doesn't exceed the new total context.
    if (accumulatedOutput.current > newCount.total) {
      accumulatedOutput.current = newCount.total;
    }

    if (justReset.current) {
      justReset.current = false;
      accumulatedOutput.current = 0;
      lastTurnOutput.current = newCount.output;
      setCount(newCount);
      return;
    }

    setCount((prev) => {
      // Calculate effective output by combining current generation with past turns' generation
      // that are still within the context window.
      const effectiveOutput = accumulatedOutput.current + newCount.output;

      // Final output count cannot exceed total context window reported by provider
      const finalOutput = Math.min(effectiveOutput, newCount.total);

      // Input is whatever remains in the context window
      const finalInput = newCount.total - finalOutput;

      // Preserve cached count if not provided (or 0) in this update.
      // We keep the previous value even across turns to prevent UI flickering,
      // as cached prefix tokens are usually stable or growing within a session.
      // Only reset() or initialize() (compression/eviction) should clear it.
      const cached =
        newCount.cached !== undefined && newCount.cached > 0
          ? newCount.cached
          : prev.cached;

      return {
        input: finalInput,
        output: finalOutput,
        total: newCount.total,
        cached,
      };
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
    accumulatedOutput.current = 0;
    lastTurnOutput.current = 0;
  }, []);

  return useMemo(
    () => ({
      count,
      reset,
      update,
      initialize,
    }),
    [count, reset, update, initialize]
  );
}
