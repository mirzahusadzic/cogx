import { useState, useCallback, useMemo, useRef } from 'react';
import type { TokenCount } from './useTokenCount.js';

/**
 * Extended token count including cost estimation
 */
export interface SessionTokenCount extends TokenCount {
  /** Estimated cumulative cost in USD */
  costUsd: number;
  /** Estimated cumulative savings in USD from caching */
  savedCostUsd: number;
  /** Cumulative number of LLM turns */
  turns: number;
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
    savedCostUsd: 0,
    cached: 0,
    turns: 0,
  });

  // Tokens from previously completed turns
  const accumulated = useRef<SessionTokenCount>({
    input: 0,
    output: 0,
    total: 0,
    costUsd: 0,
    savedCostUsd: 0,
    cached: 0,
    turns: 0,
  });

  // Last tokens seen in the current turn
  const lastTurnTokens = useRef<SessionTokenCount>({
    input: 0,
    output: 0,
    total: 0,
    costUsd: 0,
    savedCostUsd: 0,
    cached: 0,
    turns: 0,
  });

  // Track turns from previously completed queries/commits
  const turnsFromPreviousCommits = useRef(0);

  /**
   * Update current turn tokens.
   * If the new count is lower than the last seen count (and not 0),
   * it indicates a new turn has started, so we commit the previous turn.
   */
  const update = useCallback(
    (
      currentTurn: TokenCount,
      costUsd: number = 0,
      savedCostUsd: number = 0,
      overrideTurns?: number
    ) => {
      // Ignore 0-token reports (common at the start of provider streams) to prevent
      // premature turn completion or data loss in the session total.
      // The current context window (Σ CTX TOKENS) is tracked by useTokenCount,
      // which now accumulates output tokens across turns within the same context.
      if (currentTurn.total === 0) return;

      // Detect new turn, context eviction, or new internal request in a generator loop:
      // 1. total < last.total: context was evicted or compressed (prompt shrunk)
      // 2. output < last.output: a new tool execution started (output reset to 0)
      // 3. input < last.input: context was forcibly trimmed
      // We ignore 0 reports for 'last' to avoid false positives at the very start of a session.
      const isNewTurn =
        currentTurn.total > 0 &&
        lastTurnTokens.current.total > 0 &&
        (currentTurn.total < lastTurnTokens.current.total ||
          currentTurn.output < lastTurnTokens.current.output ||
          currentTurn.input < lastTurnTokens.current.input);

      if (isNewTurn) {
        accumulated.current = {
          input: accumulated.current.input + lastTurnTokens.current.input,
          output: accumulated.current.output + lastTurnTokens.current.output,
          total: accumulated.current.total + lastTurnTokens.current.total,
          costUsd: accumulated.current.costUsd + lastTurnTokens.current.costUsd,
          savedCostUsd:
            accumulated.current.savedCostUsd +
            lastTurnTokens.current.savedCostUsd,
          cached:
            (accumulated.current.cached || 0) +
            (lastTurnTokens.current.cached || 0),
          turns: (accumulated.current.turns || 0) + 1,
        };
      }

      // If the SDK reports its own turn count, use it as a baseline for accumulation.
      // This ensures we stay in sync with the provider's view of history while still
      // correctly tracking the current (possibly uncounted) turn.
      // We do this AFTER turn detection to avoid double-counting if the SDK's turn
      // count already incremented.
      if (overrideTurns !== undefined && overrideTurns > 0) {
        // overrideTurns is 1-indexed turn count for the current request
        accumulated.current.turns =
          turnsFromPreviousCommits.current + (overrideTurns - 1);
      }

      // Preserve cached tokens and saved cost if not provided in this update chunk.
      // Many providers only report cached tokens in the first chunk or sporadically.
      // Safety: We cap cached tokens by the current turn's input to prevent
      // displaying more cached tokens than input tokens when context shrinks.
      const rawTurnCached =
        currentTurn.cached !== undefined && currentTurn.cached > 0
          ? currentTurn.cached
          : isNewTurn
            ? 0
            : lastTurnTokens.current.cached || 0;

      const effectiveTurnCached = Math.min(rawTurnCached, currentTurn.input);

      // If savedCostUsd is 0 but we have cached tokens, and it's not a new turn,
      // preserve the previous saved cost estimate for this turn.
      const effectiveTurnSavedCost =
        savedCostUsd > 0
          ? savedCostUsd
          : isNewTurn
            ? 0
            : lastTurnTokens.current.savedCostUsd || 0;

      // Same for costUsd - ensure it doesn't drop during a turn
      const effectiveTurnCost = Math.max(
        costUsd,
        isNewTurn ? 0 : lastTurnTokens.current.costUsd
      );

      lastTurnTokens.current = {
        ...currentTurn,
        cached: effectiveTurnCached,
        costUsd: effectiveTurnCost,
        savedCostUsd: effectiveTurnSavedCost,
        turns: 0, // Not used in lastTurnTokens
      };

      // Current turn count is 1 + accumulated turns
      const currentTurns = (accumulated.current.turns || 0) + 1;

      setSessionCount({
        input: accumulated.current.input + currentTurn.input,
        output: accumulated.current.output + currentTurn.output,
        total: accumulated.current.total + currentTurn.total,
        costUsd: accumulated.current.costUsd + effectiveTurnCost,
        savedCostUsd: accumulated.current.savedCostUsd + effectiveTurnSavedCost,
        cached: (accumulated.current.cached || 0) + effectiveTurnCached,
        turns: currentTurns,
      });
    },
    []
  );

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
      savedCostUsd:
        accumulated.current.savedCostUsd + lastTurnTokens.current.savedCostUsd,
      cached:
        (accumulated.current.cached || 0) +
        (lastTurnTokens.current.cached || 0),
      turns: (accumulated.current.turns || 0) + 1,
    };
    lastTurnTokens.current = {
      input: 0,
      output: 0,
      total: 0,
      costUsd: 0,
      savedCostUsd: 0,
      cached: 0,
      turns: 0,
    };

    // Update state to reflect the committed accumulation
    setSessionCount(accumulated.current);
    turnsFromPreviousCommits.current = accumulated.current.turns;
  }, []);

  const reset = useCallback(() => {
    accumulated.current = {
      input: 0,
      output: 0,
      total: 0,
      costUsd: 0,
      savedCostUsd: 0,
      cached: 0,
      turns: 0,
    };
    lastTurnTokens.current = {
      input: 0,
      output: 0,
      total: 0,
      costUsd: 0,
      savedCostUsd: 0,
      cached: 0,
      turns: 0,
    };
    turnsFromPreviousCommits.current = 0;
    setSessionCount({
      input: 0,
      output: 0,
      total: 0,
      costUsd: 0,
      savedCostUsd: 0,
      cached: 0,
      turns: 0,
    });
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
      savedCostUsd:
        accumulated.current.savedCostUsd + lastTurnTokens.current.savedCostUsd,
      cached:
        (accumulated.current.cached || 0) +
        (lastTurnTokens.current.cached || 0),
      turns:
        (accumulated.current.turns || 0) +
        (lastTurnTokens.current.total > 0 ? 1 : 0),
    };
  }, []);

  const initialize = useCallback(
    (
      initialCount: TokenCount,
      costUsd: number = 0,
      savedCostUsd: number = 0,
      turns: number = 0
    ) => {
      accumulated.current = {
        input: initialCount.input,
        output: initialCount.output,
        total: initialCount.total,
        costUsd,
        savedCostUsd,
        cached: initialCount.cached || 0,
        turns,
      };
      lastTurnTokens.current = {
        input: 0,
        output: 0,
        total: 0,
        costUsd: 0,
        savedCostUsd: 0,
        cached: 0,
        turns: 0,
      };
      setSessionCount({
        ...initialCount,
        costUsd,
        savedCostUsd,
        cached: initialCount.cached || 0,
        turns,
      });
      turnsFromPreviousCommits.current = turns;
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
