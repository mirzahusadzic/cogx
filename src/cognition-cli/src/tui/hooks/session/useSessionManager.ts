/**
 * Session Manager Hook
 *
 * React hook for managing session lifecycle:
 * - Initializes anchor ID and SDK session ID
 * - Loads existing session state on mount
 * - Tracks SDK session changes
 * - Updates session state when SDK session changes
 * - Manages resume session ID for continuity
 *
 * Extracted from useClaudeAgent.ts for better testability.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SessionStateStore } from './SessionStateStore.js';
import type {
  SessionOptions,
  SessionState,
  SessionUpdateEvent,
} from './types.js';
import type { TurnAnalysis } from '../../../sigma/types.js';

export interface UseSessionManagerOptions extends SessionOptions {
  /**
   * Callback when session is loaded
   */
  onSessionLoaded?: (message?: string) => void;

  /**
   * Callback when SDK session ID changes
   */
  onSDKSessionChanged?: (event: SessionUpdateEvent) => void;
}

export interface UseSessionManagerResult {
  /**
   * Current session state
   */
  state: SessionState;

  /**
   * Session state store instance
   */
  store: SessionStateStore;

  /**
   * Update SDK session ID (called when SDK provides new session)
   * For initial session, pass reason='initial' and it will call create()
   * For subsequent updates, pass reason='compression' or 'expiration'
   */
  updateSDKSession: (
    newSessionId: string,
    reason: 'initial' | 'compression' | 'expiration',
    compressedTokens?: number
  ) => void;

  /**
   * Update session stats from turn analyses
   */
  updateStats: (analyses: TurnAnalysis[]) => void;

  /**
   * Reset resume session ID (after compression)
   */
  resetResumeSession: () => void;
}

/**
 * Hook for managing session state
 */
export function useSessionManager(
  options: UseSessionManagerOptions
): UseSessionManagerResult {
  const {
    sessionIdProp,
    cwd,
    debug = false,
    onSessionLoaded,
    onSDKSessionChanged,
  } = options;

  // Generate stable anchor ID (only computed once)
  const anchorId = useMemo(
    () => sessionIdProp || `tui-${Date.now()}`,
    [sessionIdProp]
  );

  // Session state store
  const storeRef = useRef<SessionStateStore>(
    new SessionStateStore(anchorId, cwd, debug)
  );

  // Session state
  const [state, setState] = useState<SessionState>({
    anchorId,
    currentSessionId: anchorId,
    resumeSessionId: undefined,
    injectedRecap: null,
    hasReceivedSDKSessionId: false,
  });

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      const store = storeRef.current;
      const result = store.loadForResume();

      setState((prev) => ({
        ...prev,
        currentSessionId: result.currentSessionId,
        resumeSessionId: result.resumeSessionId,
      }));

      if (result.message) {
        onSessionLoaded?.(result.message);
      }

      if (debug) {
        console.log(
          `[useSessionManager] Loaded session: ${result.currentSessionId}, resume: ${result.resumeSessionId || 'none'}`
        );
      }
    };

    loadSession();
  }, [anchorId, cwd, debug, onSessionLoaded]);

  // Update SDK session ID
  const updateSDKSession = useCallback(
    (
      newSessionId: string,
      reason: 'initial' | 'compression' | 'expiration',
      compressedTokens?: number
    ) => {
      const store = storeRef.current;
      const previousSessionId = state.currentSessionId;

      // Check if session actually changed
      if (previousSessionId === newSessionId) {
        if (debug) {
          console.log('[useSessionManager] SDK session unchanged');
        }
        return;
      }

      // Check if this is the first SDK session we've received
      const sessionState = store.load();

      if (!sessionState || reason === 'initial') {
        // Create initial state (or recreate if reason is explicitly 'initial')
        store.create(newSessionId);
        if (debug) {
          console.log(
            `[useSessionManager] Created initial state: ${anchorId} → ${newSessionId}`
          );
        }
      } else {
        // Update existing state (reason must be 'compression' or 'expiration')
        const event: SessionUpdateEvent = {
          previousSessionId,
          newSessionId,
          reason: reason as 'compression' | 'expiration',
          compressedTokens,
        };
        store.update(event);

        // Notify callback
        onSDKSessionChanged?.(event);
      }

      // Update React state
      setState((prev) => ({
        ...prev,
        currentSessionId: newSessionId,
        resumeSessionId: newSessionId,
        hasReceivedSDKSessionId: true,
      }));

      if (debug) {
        console.log(
          `[useSessionManager] SDK session updated: ${previousSessionId} → ${newSessionId} (${reason})`
        );
      }
    },
    [state.currentSessionId, anchorId, debug, onSDKSessionChanged]
  );

  // Update stats from turn analyses
  const updateStats = useCallback(
    (analyses: TurnAnalysis[]) => {
      if (analyses.length === 0) return;

      const stats = {
        total_turns_analyzed: analyses.length,
        paradigm_shifts: analyses.filter((t) => t.is_paradigm_shift).length,
        routine_turns: analyses.filter((t) => t.is_routine).length,
        avg_novelty:
          analyses.length > 0
            ? (
                analyses.reduce((sum, t) => sum + t.novelty, 0) /
                analyses.length
              ).toFixed(3)
            : '0.000',
        avg_importance:
          analyses.length > 0
            ? (
                analyses.reduce((sum, t) => sum + t.importance_score, 0) /
                analyses.length
              ).toFixed(1)
            : '0.0',
      };

      storeRef.current.updateStats(stats);

      if (debug) {
        console.log('[useSessionManager] Stats updated:', stats);
      }
    },
    [debug]
  );

  // Reset resume session ID (after compression)
  const resetResumeSession = useCallback(() => {
    setState((prev) => ({
      ...prev,
      resumeSessionId: undefined,
    }));

    if (debug) {
      console.log('[useSessionManager] Resume session reset');
    }
  }, [debug]);

  return {
    state,
    store: storeRef.current,
    updateSDKSession,
    updateStats,
    resetResumeSession,
  };
}
