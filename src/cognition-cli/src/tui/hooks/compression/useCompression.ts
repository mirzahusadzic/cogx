/**
 * Compression Hook
 *
 * React hook that orchestrates the compression workflow:
 * - Monitors token count and turns
 * - Triggers compression when thresholds met
 * - Manages compression state
 * - Notifies when compression occurs
 *
 * Extracted from useClaudeAgent.ts for better testability and maintainability.
 */

import { useRef, useCallback, useEffect } from 'react';
import { CompressionTrigger } from './CompressionTrigger.js';
import type { CompressionOptions, CompressionState } from './types.js';

export interface UseCompressionOptions extends CompressionOptions {
  /**
   * Current token count
   */
  tokenCount: number;

  /**
   * Number of analyzed turns
   */
  analyzedTurns: number;

  /**
   * Whether assistant is currently thinking (don't trigger during streaming)
   */
  isThinking: boolean;

  /**
   * Callback when compression should be triggered
   */
  onCompressionTriggered?: (tokens: number, turns: number) => void;

  /**
   * Whether to enable debug logging
   */
  debug?: boolean;
}

export interface UseCompressionResult {
  /**
   * Current compression state
   */
  state: CompressionState;

  /**
   * Whether compression should trigger now
   */
  shouldTrigger: boolean;

  /**
   * Manually trigger compression
   */
  triggerCompression: () => void;

  /**
   * Reset compression state (call when new session starts)
   */
  reset: () => void;

  /**
   * Get compression trigger details
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
 */
export function useCompression(
  options: UseCompressionOptions
): UseCompressionResult {
  const {
    tokenCount,
    analyzedTurns,
    isThinking,
    onCompressionTriggered,
    tokenThreshold,
    minTurns,
    enabled = true,
    debug = false,
  } = options;

  // Compression trigger instance
  const triggerRef = useRef<CompressionTrigger>(
    new CompressionTrigger({ tokenThreshold, minTurns, enabled })
  );

  // Compression state
  const stateRef = useRef<CompressionState>({
    triggered: false,
    compressionCount: 0,
  });

  // Update trigger options when they change
  useEffect(() => {
    triggerRef.current.updateOptions({ tokenThreshold, minTurns, enabled });
  }, [tokenThreshold, minTurns, enabled]);

  // Check for compression trigger
  useEffect(() => {
    // Don't check during streaming
    if (isThinking) {
      return;
    }

    const result = triggerRef.current.shouldTrigger(tokenCount, analyzedTurns);

    if (result.shouldTrigger) {
      if (debug) {
        console.log('[useCompression] Triggering compression:', result.reason);
      }

      // Mark as triggered
      triggerRef.current.markTriggered();
      stateRef.current.triggered = true;
      stateRef.current.lastCompression = new Date();
      stateRef.current.lastCompressedTokens = tokenCount;
      stateRef.current.compressionCount++;

      // Notify parent
      onCompressionTriggered?.(tokenCount, analyzedTurns);
    }
  }, [tokenCount, analyzedTurns, isThinking, onCompressionTriggered, debug]);

  const triggerCompression = useCallback(() => {
    if (debug) {
      console.log('[useCompression] Manual compression trigger');
    }

    triggerRef.current.markTriggered();
    stateRef.current.triggered = true;
    stateRef.current.lastCompression = new Date();
    stateRef.current.lastCompressedTokens = tokenCount;
    stateRef.current.compressionCount++;

    onCompressionTriggered?.(tokenCount, analyzedTurns);
  }, [tokenCount, analyzedTurns, onCompressionTriggered, debug]);

  const reset = useCallback(() => {
    if (debug) {
      console.log('[useCompression] Resetting compression state');
    }

    triggerRef.current.reset();
    stateRef.current.triggered = false;
  }, [debug]);

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

  return {
    state: stateRef.current,
    shouldTrigger: triggerRef.current.shouldTrigger(tokenCount, analyzedTurns)
      .shouldTrigger,
    triggerCompression,
    reset,
    getTriggerInfo,
  };
}
