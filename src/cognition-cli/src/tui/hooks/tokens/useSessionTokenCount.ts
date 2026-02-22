import { useState, useCallback, useMemo, useRef } from 'react';
import type { TokenCount } from './useTokenCount.js';

/**
 * Hook for tracking cumulative session token usage.
 * Unlike useTokenCount, this value only increases and survives context evictions.
 * It automatically handles multiple LLM turns by detecting when token counts reset.
 */
export function useSessionTokenCount() {
  const [sessionCount, setSessionCount] = useState<TokenCount>({
    input: 0,
    output: 0,
    total: 0,
  });

  // Tokens from previously completed turns
  const accumulated = useRef<TokenCount>({
    input: 0,
    output: 0,
    total: 0,
  });

  // Last tokens seen in the current turn
  const lastTurnTokens = useRef<TokenCount>({
    input: 0,
    output: 0,
    total: 0,
  });

  /**
   * Update current turn tokens.
   * If the new count is lower than the last seen count (and not 0), 
   * it indicates a new turn has started, so we commit the previous turn.
   */
  const update = useCallback((currentTurn: TokenCount) => {
    // Detect new turn or context eviction: if current turn total drops below last seen
    // total (but is not 0, which occurs at start of streams), it signifies a context 
    // reset/eviction, and we commit the previous turn's tokens to the session total.
    if (currentTurn.total < lastTurnTokens.current.total && currentTurn.total > 0) {
      accumulated.current = {
        input: accumulated.current.input + lastTurnTokens.current.input,
        output: accumulated.current.output + lastTurnTokens.current.output,
        total: accumulated.current.total + lastTurnTokens.current.total,
      };
    }
    
    // If it's 0, it might be the start of a new turn or a transient state.
    // If it's 0 and the last turn had tokens, we should probably commit then too?
    // Actually, if it's 0, we just wait for the first non-zero update of the new turn.

    lastTurnTokens.current = currentTurn;

    setSessionCount({
      input: accumulated.current.input + currentTurn.input,
      output: accumulated.current.output + currentTurn.output,
      total: accumulated.current.total + currentTurn.total,
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
    };
    lastTurnTokens.current = { input: 0, output: 0, total: 0 };
    // sessionCount is already correct because it's accumulated + current (which is now 0)
  }, []);

  const reset = useCallback(() => {
    accumulated.current = { input: 0, output: 0, total: 0 };
    lastTurnTokens.current = { input: 0, output: 0, total: 0 };
    setSessionCount({ input: 0, output: 0, total: 0 });
  }, []);

  return useMemo(
    () => ({
      count: sessionCount,
      update,
      commit,
      reset,
    }),
    [sessionCount, update, commit, reset]
  );
}
