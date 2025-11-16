/**
 * Session Manager Hook
 *
 * React hook for orchestrating the dual-identity session model in the TUI.
 * Manages the lifecycle of both stable anchor IDs and transient SDK session IDs
 * across the conversation lifecycle.
 *
 * DESIGN:
 * This hook bridges React state management with persistent session state:
 *
 * Key responsibilities:
 * 1. Initialize anchor ID (stable, user-facing)
 * 2. Initialize SDK session ID (transient, changes on compression)
 * 3. Load existing session state on mount
 * 4. Track SDK session changes (compression, expiration)
 * 5. Update session statistics from turn analyses
 * 6. Manage resume session ID for continuity
 *
 * SESSION FLOW:
 * 1. Mount: Load state from disk, determine if resuming
 * 2. First query: SDK assigns session UUID, create() saves state
 * 3. Compression: SDK creates new session, update() records transition
 * 4. Stats update: updateStats() saves conversation metrics
 * 5. Unmount: State persists for future resume
 *
 * EXTRACTION RATIONALE:
 * Originally embedded in useClaudeAgent, this was extracted to:
 * - Improve testability (session logic isolated)
 * - Reduce complexity (useClaudeAgent was 1200+ lines)
 * - Enable reuse (other hooks can use session management)
 * - Clarify responsibilities (session vs. SDK vs. Sigma)
 *
 * @example
 * // Basic usage in TUI component
 * const sessionManager = useSessionManager({
 *   sessionIdProp: cliArgs.sessionId,
 *   cwd: process.cwd(),
 *   debug: true,
 *   onSessionLoaded: (msg) => console.log(msg),
 *   onSDKSessionChanged: (evt) => console.log(evt)
 * });
 *
 * // Access session state
 * console.log(`Anchor: ${sessionManager.state.anchorId}`);
 * console.log(`Current: ${sessionManager.state.currentSessionId}`);
 * console.log(`Resume: ${sessionManager.state.resumeSessionId}`);
 *
 * @example
 * // Update SDK session after compression
 * sessionManager.updateSDKSession('new-sdk-uuid', 'compression', 95000);
 *
 * @example
 * // Update stats after turn analysis
 * sessionManager.updateStats(turnAnalyses);
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
 * Hook for managing session state across conversation lifecycle.
 *
 * This hook orchestrates the dual-identity session model:
 * - Anchor ID: Stable user-facing identifier
 * - SDK Session ID: Transient identifier that changes on compression
 *
 * LIFECYCLE:
 * 1. Mount Effect:
 *    - Generate stable anchor ID from sessionIdProp or timestamp
 *    - Create SessionStateStore instance
 *    - Load existing state from disk (if resuming)
 *    - Update React state with loaded values
 *    - Call onSessionLoaded callback
 *
 * 2. SDK Session Updates:
 *    - First query: SDK assigns UUID, call updateSDKSession('initial')
 *    - Compression: SDK creates new session, call updateSDKSession('compression')
 *    - Expiration: SDK rotates session, call updateSDKSession('expiration')
 *
 * 3. Statistics Updates:
 *    - After turn analysis completes, call updateStats()
 *    - Saves conversation metrics to state file
 *
 * 4. Unmount:
 *    - State persists on disk for future resume
 *
 * RETURN VALUE:
 * Returns object with:
 * - state: Current session state (anchorId, currentSessionId, resumeSessionId)
 * - store: SessionStateStore instance for direct access
 * - updateSDKSession(): Update SDK session ID
 * - updateStats(): Update conversation statistics
 * - resetResumeSession(): Clear resume ID (after compression)
 *
 * @param options - Configuration and callbacks
 * @returns Object with session state and update functions
 *
 * @example
 * // Initialize session manager
 * const sessionManager = useSessionManager({
 *   sessionIdProp: 'my-project',
 *   cwd: '/home/user/project',
 *   debug: true,
 *   onSessionLoaded: (message) => {
 *     if (message) showUserMessage(message);
 *   },
 *   onSDKSessionChanged: (event) => {
 *     console.log(`Session changed: ${event.reason}`);
 *   }
 * });
 *
 * @example
 * // Handle SDK session assignment
 * if (sdkMessage.session_id !== sessionManager.state.currentSessionId) {
 *   sessionManager.updateSDKSession(
 *     sdkMessage.session_id,
 *     'initial',
 *     undefined
 *   );
 * }
 *
 * @example
 * // Handle compression
 * await compressContext(analyses);
 * sessionManager.updateSDKSession(
 *   newSdkSessionId,
 *   'compression',
 *   tokenCount
 * );
 * sessionManager.resetResumeSession();
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

      // Use functional setState to get current state synchronously
      // This prevents stale closure issues during rapid SDK messages
      setState((prev) => {
        const previousSessionId = prev.currentSessionId;

        // Check if session actually changed
        if (previousSessionId === newSessionId) {
          if (debug) {
            console.log('[useSessionManager] SDK session unchanged');
          }
          return prev; // No change
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

        if (debug) {
          console.log(
            `[useSessionManager] SDK session updated: ${previousSessionId} → ${newSessionId} (${reason})`
          );
        }

        // Return updated state
        return {
          ...prev,
          currentSessionId: newSessionId,
          resumeSessionId: newSessionId,
          hasReceivedSDKSessionId: true,
        };
      });
    },
    [anchorId, debug, onSDKSessionChanged]
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
