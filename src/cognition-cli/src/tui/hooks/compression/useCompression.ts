/**
 * Compression Hook
 *
 * React hook that orchestrates the context compression workflow for the TUI layer.
 * Monitors token usage and conversation turns, triggering compression when thresholds
 * are exceeded to prevent context window exhaustion.
 *
 * DESIGN:
 * The useCompression hook bridges the React component layer with the core compression
 * logic (CompressionTrigger). It manages:
 * 1. CompressionTrigger instance lifecycle
 * 2. Compression state tracking (React refs for persistence)
 * 3. Option updates when props change
 * 4. Callbacks for compression events
 *
 * Architecture:
 * ```
 * useClaudeAgent (parent hook)
 *       ↓
 *   useCompression (this hook)
 *       ↓
 * CompressionTrigger (decision logic)
 * ```
 *
 * The hook provides:
 * - state: Current compression state (triggered, count, etc.)
 * - shouldTrigger: Whether compression should occur now
 * - triggerCompression: Manual trigger function
 * - reset: Reset for new session
 * - getTriggerInfo: Diagnostic information
 *
 * IMPORTANT - Manual Triggering (Option C):
 * The automatic compression effect has been DISABLED to prevent race conditions.
 * Previously, the effect would race with message queueing, causing 50%+ context loss.
 *
 * Compression is now triggered manually from the queueing effect in useClaudeAgent.ts,
 * ensuring sequential execution:
 * 1. isThinking becomes false (assistant finished)
 * 2. Queue effect processes pending messages
 * 3. Queue effect calls triggerCompression() if needed
 * 4. Compression runs with full message queue
 *
 * See .sigma/case/post-fix-failure-analysis.md for race condition details.
 *
 * Integration with Grounded Context Pool (PGC):
 * - Monitors token counts from PGC updates
 * - Triggers compression to free context window
 * - Preserves semantic context via PGC during compression
 *
 * @example
 * // Using in a component
 * const compression = useCompression({
 *   tokenCount: totalTokens,
 *   analyzedTurns: turnCount,
 *   isThinking: false,
 *   tokenThreshold: 120000,
 *   minTurns: 5,
 *   onCompressionTriggered: (tokens, turns) => {
 *     console.log(`Compressing at ${tokens} tokens, ${turns} turns`);
 *     performCompression();
 *   }
 * });
 *
 * @example
 * // Manual triggering after queueing
 * useEffect(() => {
 *   if (!isThinking && queueEmpty) {
 *     const { shouldTrigger } = compression;
 *     if (shouldTrigger) {
 *       compression.triggerCompression();
 *     }
 *   }
 * }, [isThinking, queueEmpty]);
 *
 * @example
 * // Resetting for new session
 * if (newSessionStarted) {
 *   compression.reset();
 * }
 *
 * Extracted from useClaudeAgent.ts for better testability and maintainability.
 */

import { useRef, useCallback, useEffect, useMemo } from 'react';
import { CompressionTrigger } from './CompressionTrigger.js';
import type { CompressionOptions, CompressionState } from './types.js';

/**
 * Options for useCompression hook
 *
 * Extends CompressionOptions with React-specific props for monitoring
 * current state and handling compression events.
 *
 * @example
 * const options: UseCompressionOptions = {
 *   tokenCount: 125000,
 *   analyzedTurns: 8,
 *   isThinking: false,
 *   tokenThreshold: 120000,
 *   minTurns: 5,
 *   onCompressionTriggered: (tokens, turns) => {
 *     performCompression();
 *   }
 * };
 */
export interface UseCompressionOptions extends CompressionOptions {
  /**
   * Current token count from PGC
   *
   * Total tokens used in conversation, updated by SDK messages.
   */
  tokenCount: number;

  /**
   * Number of analyzed turns
   *
   * Count of user-assistant exchange pairs completed.
   */
  analyzedTurns: number;

  /**
   * Whether assistant is currently thinking (don't trigger during streaming)
   *
   * Note: This is preserved for interface compatibility but no longer used
   * in automatic compression (see OPTION C comment below).
   */
  isThinking: boolean;

  /**
   * Callback when compression should be triggered
   *
   * Called when compression conditions are met and compression should begin.
   * Parent should initiate actual compression process.
   *
   * @param tokens - Token count at compression time
   * @param turns - Turn count at compression time
   * @returns Promise that resolves when compression completes (or void for sync callbacks)
   */
  onCompressionTriggered?: (
    tokens: number,
    turns: number
  ) => void | Promise<void>;

  /**
   * Whether to enable debug logging
   *
   * Logs compression decisions to console for troubleshooting.
   */
  debug?: boolean;
}

/**
 * Result returned by useCompression hook
 *
 * Provides access to compression state, trigger status, and control functions.
 *
 * @example
 * const { state, shouldTrigger, triggerCompression, reset } = useCompression(options);
 *
 * if (shouldTrigger && messagesQueued) {
 *   triggerCompression();
 * }
 */
export interface UseCompressionResult {
  /**
   * Current compression state
   *
   * Includes triggered flag, last compression time, compression count, etc.
   */
  state: CompressionState;

  /**
   * Whether compression should trigger now
   *
   * Based on current token count, turn count, and configuration.
   * Does not automatically trigger - use triggerCompression() to execute.
   */
  shouldTrigger: boolean;

  /**
   * Manually trigger compression
   *
   * Call this function to execute compression when shouldTrigger is true.
   * Updates state and invokes onCompressionTriggered callback.
   *
   * @returns Promise that resolves when compression completes
   */
  triggerCompression: () => Promise<void>;

  /**
   * Reset compression state (call when new session starts)
   *
   * Clears triggered flag and resets counters for a fresh session.
   */
  reset: () => void;

  /**
   * Get compression trigger details
   *
   * Returns diagnostic information about current compression state
   * and why it should/shouldn't trigger.
   *
   * @returns Object with current metrics and reasoning
   */
  getTriggerInfo: () => {
    currentTokens: number;
    threshold: number;
    currentTurns: number;
    minTurns: number;
    reason: string;
  };
}

/**
 * Hook for managing compression lifecycle
 *
 * Provides a React interface to the compression system, managing trigger logic,
 * state persistence, and compression event coordination.
 *
 * ALGORITHM:
 * 1. Initialize CompressionTrigger instance (persisted via useRef)
 * 2. Track compression state (triggered, count, timestamps)
 * 3. Update trigger options when props change (via useEffect)
 * 4. Provide manual trigger function (triggerCompression)
 * 5. Provide reset function for new sessions
 * 6. Provide diagnostic function (getTriggerInfo)
 * 7. Return state and control functions
 *
 * Note: Automatic compression effect is DISABLED (see Option C comment in code).
 * Compression must be triggered manually after message queueing completes.
 *
 * @param options - Hook configuration including current metrics and thresholds
 * @returns Compression state and control functions
 *
 * @example
 * const compression = useCompression({
 *   tokenCount: 125000,
 *   analyzedTurns: 8,
 *   isThinking: false,
 *   tokenThreshold: 120000,
 *   minTurns: 5,
 *   onCompressionTriggered: (tokens, turns) => {
 *     console.log(`Compressing ${tokens} tokens`);
 *     performCompression();
 *   }
 * });
 *
 * // Later, after messages are queued:
 * if (compression.shouldTrigger) {
 *   compression.triggerCompression();
 * }
 */
export function useCompression(
  options: UseCompressionOptions
): UseCompressionResult {
  const {
    tokenCount,
    analyzedTurns,
    // isThinking, // No longer needed - automatic effect disabled (Option C)
    onCompressionTriggered,
    tokenThreshold,
    minTurns,
    enabled = true,
    debug = false,
  } = options;

  // Compression trigger instance (persisted across renders)
  const triggerRef = useRef<CompressionTrigger>(
    new CompressionTrigger({ tokenThreshold, minTurns, enabled })
  );

  // Compression state (persisted across renders)
  const stateRef = useRef<CompressionState>({
    triggered: false,
    compressionCount: 0,
  });

  // Update trigger options when they change
  // This allows dynamic threshold adjustments without recreating trigger
  useEffect(() => {
    triggerRef.current.updateOptions({ tokenThreshold, minTurns, enabled });
  }, [tokenThreshold, minTurns, enabled]);

  // 🔄 OPTION C: Automatic compression effect DISABLED
  // Compression is now triggered manually from the queueing effect in useClaudeAgent.ts
  // This prevents the race condition where compression fires before messages are queued.
  //
  // See: .sigma/case/post-fix-failure-analysis.md for details
  //
  // The previous automatic effect would race with the queueing effect:
  // - Both triggered by isThinking: false
  // - React effect execution order is undefined
  // - If compression ran first, queue was empty (0.0s wait time)
  // - Result: 50%+ context loss
  //
  // Solution: Trigger compression sequentially after queueing completes

  // useEffect(() => {
  //   // Don't check during streaming
  //   if (isThinking) {
  //     return;
  //   }
  //
  //   const result = triggerRef.current.shouldTrigger(tokenCount, analyzedTurns);
  //
  //   if (result.shouldTrigger) {
  //     if (debug) {
  //       console.log('[useCompression] Triggering compression:', result.reason);
  //     }
  //
  //     // Mark as triggered
  //     triggerRef.current.markTriggered();
  //     stateRef.current.triggered = true;
  //     stateRef.current.lastCompression = new Date();
  //     stateRef.current.lastCompressedTokens = tokenCount;
  //     stateRef.current.compressionCount++;
  //
  //     // Notify parent
  //     onCompressionTriggered?.(tokenCount, analyzedTurns);
  //   }
  // }, [tokenCount, analyzedTurns, isThinking, onCompressionTriggered, debug]);

  /**
   * Manually trigger compression
   *
   * Updates compression state and invokes callback. Should be called
   * from parent when shouldTrigger is true AND message queue is processed.
   *
   * ALGORITHM:
   * 1. Log debug message if debug enabled
   * 2. Mark trigger as triggered (prevent re-trigger)
   * 3. Update state ref with:
   *    - triggered = true
   *    - lastCompression = now
   *    - lastCompressedTokens = current count
   *    - compressionCount incremented
   * 4. Invoke onCompressionTriggered callback and AWAIT completion
   *
   * @returns Promise that resolves when compression callback completes
   */
  const triggerCompression = useCallback(async () => {
    if (debug) {
      console.log('[useCompression] Manual compression trigger');
    }

    triggerRef.current.markTriggered();
    stateRef.current.triggered = true;
    stateRef.current.lastCompression = new Date();
    stateRef.current.lastCompressedTokens = tokenCount;
    stateRef.current.compressionCount++;

    // CRITICAL: Await the callback to block UI until compression completes
    // This ensures recap is ready and session is reset before user can send next message
    await onCompressionTriggered?.(tokenCount, analyzedTurns);
  }, [tokenCount, analyzedTurns, onCompressionTriggered, debug]);

  /**
   * Reset compression state
   *
   * Clears triggered flag to allow compression in new session.
   * Call when starting fresh conversation or after compression completes.
   */
  const reset = useCallback(() => {
    if (debug) {
      console.log('[useCompression] Resetting compression state');
    }

    triggerRef.current.reset();
    stateRef.current.triggered = false;
  }, [debug]);

  /**
   * Get compression trigger diagnostic info
   *
   * Returns current compression decision details including
   * token counts, thresholds, and reasoning.
   */
  const getTriggerInfo = useCallback(() => {
    const result = triggerRef.current.shouldTrigger(tokenCount, analyzedTurns);
    return {
      currentTokens: result.currentTokens,
      threshold: result.threshold,
      currentTurns: result.currentTurns,
      minTurns: result.minTurns,
      reason: result.reason,
    };
  }, [tokenCount, analyzedTurns]);

  // Memoize shouldTrigger to prevent recomputation on every render
  const shouldTrigger = useMemo(() => {
    return triggerRef.current.shouldTrigger(tokenCount, analyzedTurns)
      .shouldTrigger;
  }, [tokenCount, analyzedTurns]);

  return {
    state: stateRef.current,
    shouldTrigger,
    triggerCompression,
    reset,
    getTriggerInfo,
  };
}
