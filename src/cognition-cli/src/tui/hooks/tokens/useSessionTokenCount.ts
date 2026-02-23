import { useState, useCallback, useMemo, useRef } from 'react';
import type { TokenCount } from './useTokenCount.js';

/**
 * Extended token count including cost estimation
 */
export interface SessionTokenCount extends TokenCount {
  /** Estimated cumulative cost in USD */
  costUsd: number;
}

/**
 * Hook for tracking cumulative session token usage.
 * Unlike useTokenCount, this value only increases and survives context evictions.
 * It automatically handles multiple LLM turns by detecting when token counts reset.
 */
export function useSessionTokenCount() {
  const [sessionCount, setSessionCount] = useState<SessionTokenCount>({
    input: 0,
    output: 0,
    total: 0,
    costUsd: 0,
  });

  // Tokens from previously completed turns
  const accumulated = useRef<SessionTokenCount>({
    input: 0,
    output: 0,
    total: 0,
    costUsd: 0,
  });

  // Last tokens seen in the current turn
  const lastTurnTokens = useRef<SessionTokenCount>({
    input: 0,
    output: 0,
    total: 0,
    costUsd: 0,
  });

  /**
   * Update current turn tokens.
   * If the new count is lower than the last seen count (and not 0),
   * it indicates a new turn has started, so we commit the previous turn.
   */
  const update = useCallback((currentTurn: TokenCount, costUsd: number = 0) => {
    // Ignore 0-token reports (common at the start of provider streams) to prevent
    // premature turn completion or data loss.
    if (currentTurn.total === 0) return;

    // Detect new turn or context eviction: if current turn total drops below last seen
    // total, it signifies a context reset/eviction, and we commit the previous
    // turn's tokens to the session total.
    // Detect new turn, context eviction, or new internal request in a generator loop:
    // 1. total < last.total: context was evicted or compressed (prompt shrunk)
    // 2. output < last.output: a new tool execution started (output reset to 0)
    // 3. input < last.input: context was forcibly trimmed
    if (
      currentTurn.total < lastTurnTokens.current.total ||
      currentTurn.output < lastTurnTokens.current.output ||
      currentTurn.input < lastTurnTokens.current.input
    ) {
      accumulated.current = {
        input: accumulated.current.input + lastTurnTokens.current.input,
        output: accumulated.current.output + lastTurnTokens.current.output,
        total: accumulated.current.total + lastTurnTokens.current.total,
        costUsd: accumulated.current.costUsd + lastTurnTokens.current.costUsd,
      };
    }

    lastTurnTokens.current = { ...currentTurn, costUsd };

    setSessionCount({
      input: accumulated.current.input + currentTurn.input,
      output: accumulated.current.output + currentTurn.output,
      total: accumulated.current.total + currentTurn.total,
      costUsd: accumulated.current.costUsd + costUsd,
    });
  }, []);

  /**
   * Manually commit the current turn's tokens.
   * Useful at the end of a query to ensure the last turn is captured.
   */
  const commit = useCallback(() => {
    accumulated.current = {
      input: accumulated.current.input + lastTurnTokens.current.input,
      output: accumulated.current.output + lastTurnTokens.current.output,
      total: accumulated.current.total + lastTurnTokens.current.total,
      costUsd: accumulated.current.costUsd + lastTurnTokens.current.costUsd,
    };
    lastTurnTokens.current = { input: 0, output: 0, total: 0, costUsd: 0 };

    // Update state to reflect the committed accumulation
    setSessionCount(accumulated.current);
  }, []);

  const reset = useCallback(() => {
    accumulated.current = { input: 0, output: 0, total: 0, costUsd: 0 };
    lastTurnTokens.current = { input: 0, output: 0, total: 0, costUsd: 0 };
    setSessionCount({ input: 0, output: 0, total: 0, costUsd: 0 });
  }, []);

  /**
   * Get the latest cumulative token count from internal refs.
   * This provides the most up-to-date value, bypassing React state batching.
   */
  const getLatestCount = useCallback((): SessionTokenCount => {
    return {
      input: accumulated.current.input + lastTurnTokens.current.input,
      output: accumulated.current.output + lastTurnTokens.current.output,
      total: accumulated.current.total + lastTurnTokens.current.total,
      costUsd: accumulated.current.costUsd + lastTurnTokens.current.costUsd,
    };
  }, []);

  const initialize = useCallback(
    (initialCount: TokenCount, costUsd: number = 0) => {
      accumulated.current = {
        input: initialCount.input,
        output: initialCount.output,
        total: initialCount.total,
        costUsd,
      };
      lastTurnTokens.current = { input: 0, output: 0, total: 0, costUsd: 0 };
      setSessionCount({ ...initialCount, costUsd });
    },
    []
  );

  return useMemo(
    () => ({
      count: sessionCount,
      update,
      commit,
      reset,
      getLatestCount,
      initialize,
    }),
    [sessionCount, update, commit, reset, getLatestCount, initialize]
  );
}
