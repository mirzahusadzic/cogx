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
 *   onSessionLoaded: (msg) => systemLog('tui', `Session loaded: ${msg}`),
 *   onSDKSessionChanged: (evt) => systemLog('tui', `SDK Session changed: ${evt.reason}`)
 * });
 *
 * // Access session state
 * systemLog('tui', `Anchor: ${sessionManager.state.anchorId}`);
 * systemLog('tui', `Current: ${sessionManager.state.currentSessionId}`);
 * systemLog('tui', `Resume: ${sessionManager.state.resumeSessionId}`);
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
import { systemLog } from '../../../utils/debug-logger.js';
import type {
  SessionOptions,
  SessionState,
  SessionUpdateEvent,
  SessionTokens,
} from './types.js';
import type { TurnAnalysis } from '../../../sigma/types.js';
import type { SigmaTask } from '../useAgent/types.js';

/**
 * Convert a full model ID to a short name for use in anchor IDs.
 *
 * Mapping:
 * - sonnet45: Claude Sonnet 4.5 (claude-sonnet-4-5-*)
 * - opus45: Claude Opus 4.5 (claude-opus-4-5-*)
 * - gemini3f: Gemini 3.0 Flash (gemini-3-flash-preview, gemini-3.0-flash-*)
 * - gemini31p: Gemini 3.1 Pro (gemini-3.1-pro-preview, gemini-3.1-pro-preview-customtools)
 * - gemini3p: Gemini 3.0 Pro (gemini-3-pro-preview, gemini-3.0-pro-*)
 * - gemini25f: Gemini 2.5 Flash (gemini-2.5-flash-*)
 * - gemini25p: Gemini 2.5 Pro (gemini-2.5-pro-*)
 * - gpt4o: GPT-4o (gpt-4o)
 * - gpt4om: GPT-4o Mini (gpt-4o-mini)
 * - o1: O1 reasoning model (o1)
 * - o3: O3 reasoning model (o3)
 * - oss20b: GPT-OSS 20B local model (gpt-oss-20b)
 * - oss120b: GPT-OSS 120B local model (gpt-oss-120b)
 *
 * @param model Full model ID (e.g., 'claude-opus-4-5-20251101')
 * @returns Short model name (e.g., 'opus45') or undefined if unknown
 */
export function getModelShortName(model?: string): string | undefined {
  if (!model) return undefined;

  const lower = model.toLowerCase();

  // Claude models
  if (
    lower.includes('claude-sonnet-4-5') ||
    lower.includes('claude-sonnet-4.5')
  )
    return 'sonnet45';
  if (lower.includes('claude-opus-4-5') || lower.includes('claude-opus-4.5'))
    return 'opus45';

  // Gemini models - check specific versions before generic
  if (
    lower.includes('gemini-3-flash') ||
    (lower.includes('gemini-3') && lower.includes('flash'))
  )
    return 'gemini3f';
  if (lower.includes('gemini-3.1') && lower.includes('pro')) return 'gemini31p';
  if (
    lower.includes('gemini-3') &&
    lower.includes('pro') &&
    !lower.includes('flash')
  )
    return 'gemini3p';
  if (
    lower.includes('gemini-2.5-flash') ||
    (lower.includes('gemini-2.5') && lower.includes('flash'))
  )
    return 'gemini25f';
  if (
    lower.includes('gemini-2.5') &&
    lower.includes('pro') &&
    !lower.includes('flash')
  )
    return 'gemini25p';
  if (
    lower.includes('gemini-2.0-flash') ||
    (lower.includes('gemini-2.0') && lower.includes('flash'))
  )
    return 'gemini2f';
  if (
    lower.includes('gemini-2.0') &&
    lower.includes('pro') &&
    !lower.includes('flash')
  )
    return 'gemini2p';

  // OpenAI models
  if (lower === 'gpt-4o') return 'gpt4o';
  if (lower === 'gpt-4o-mini') return 'gpt4om';
  if (lower === 'o1') return 'o1';
  if (lower === 'o3') return 'o3';

  // OpenAI-compatible local models (eGemma)
  if (lower.includes('gpt-oss-20b')) return 'oss20b';
  if (lower.includes('gpt-oss-120b')) return 'oss120b';

  // Unknown model
  return undefined;
}

export interface UseSessionManagerOptions extends SessionOptions {
  /**
   * Callback when session is loaded
   */
  onSessionLoaded?: (message?: string) => void;

  /**
   * Callback when SDK session ID changes
   */
  onSDKSessionChanged?: (event: SessionUpdateEvent) => void;

  /**
   * Callback when tokens are restored from persisted state
   * Called during session resume to initialize token counter
   */
  onTokensRestored?: (tokens: SessionTokens) => void;

  /**
   * Callback when cumulative session tokens are restored from persisted state
   */
  onSessionTokensRestored?: (tokens: SessionTokens) => void;

  /**
   * Callback when tasks are restored from persisted state
   * Called during session resume for providers without native SigmaTaskUpdate
   */
  onTasksRestored?: (tasks: SigmaTask[]) => void;
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

  /**
   * Get effective resume session ID (respects forceNewSession flag)
   * Use this instead of reading state.resumeSessionId directly to avoid async race conditions
   */
  getResumeSessionId: () => string | undefined;

  /**
   * Persist current token counts for compression threshold continuity
   */
  updateTokens: (tokens: SessionTokens) => void;

  /**
   * Persist cumulative session token counts across restarts
   */
  updateSessionTokens: (tokens: SessionTokens) => void;

  /**
   * Persist current task list for session continuity (for providers without native SigmaTaskUpdate)
   */
  updateTasks: (tasks: SigmaTask[]) => void;
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
 *     systemLog('tui', `Session changed: ${event.reason}`);
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
    provider,
    model,
    debug = false,
    onSessionLoaded,
    onSDKSessionChanged,
    onTokensRestored,
    onSessionTokensRestored,
    onTasksRestored,
  } = options;

  // Generate stable anchor ID (only computed once)
  // Format: tui-<modelShortName>-<timestamp> (e.g., tui-opus45-1764769493427)
  // Model first for easier tab completion (tui-s<tab> matches sonnet sessions)
  const anchorId = useMemo(() => {
    // If user provided a session ID, use it as-is
    if (sessionIdProp) return sessionIdProp;

    // Generate new anchor ID with model short name prefix
    const timestamp = Date.now();
    const modelShort = getModelShortName(model);

    return modelShort ? `tui-${modelShort}-${timestamp}` : `tui-${timestamp}`;
  }, [sessionIdProp, model]);

  // Session state store
  const storeRef = useRef<SessionStateStore>(
    new SessionStateStore(anchorId, cwd, debug)
  );

  // Synchronous flag to force new session (survives async chaos)
  // This ref is checked immediately when sending messages, bypassing React's async state
  const forceNewSessionRef = useRef(false);

  // Session state
  const [state, setState] = useState<SessionState>({
    anchorId,
    currentSessionId: anchorId,
    resumeSessionId: undefined,
    forceNewSession: false,
    injectedRecap: null,
    hasReceivedSDKSessionId: false,
    lastCompressionTimestamp: 0,
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
        lastCompressionTimestamp: result.lastCompressionTimestamp || 0,
      }));

      if (result.message) {
        onSessionLoaded?.(result.message);
      }

      // Restore tokens and tasks for session continuity
      if (result.restoredTokens) {
        onTokensRestored?.(result.restoredTokens);
        if (debug) {
          systemLog(
            'tui',
            `[useSessionManager] Restored tokens: ${result.restoredTokens.total}`
          );
        }
      }

      if (result.restoredSessionTokens) {
        onSessionTokensRestored?.(result.restoredSessionTokens);
        if (debug) {
          systemLog(
            'tui',
            `[useSessionManager] Restored cumulative tokens: ${result.restoredSessionTokens.total}`
          );
        }
      }

      if (result.todos && result.todos.length > 0) {
        onTasksRestored?.(result.todos);
        if (debug) {
          systemLog(
            'tui',
            `[useSessionManager] Restored ${result.todos.length} tasks`
          );
        }
      }

      if (debug) {
        systemLog(
          'tui',
          `[useSessionManager] Loaded session: ${result.currentSessionId}, resume: ${result.resumeSessionId || 'none'}`
        );
      }
    };

    loadSession();
  }, [
    anchorId,
    cwd,
    debug,
    onSessionLoaded,
    onTokensRestored,
    onSessionTokensRestored,
    onTasksRestored,
  ]);

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
            systemLog('tui', '[useSessionManager] SDK session unchanged');
          }
          return prev; // No change
        }

        // Check if this is the first SDK session we've received
        const sessionState = store.load();

        if (!sessionState) {
          // No state file exists - create initial state (with provider/model for resume)
          store.create(newSessionId, provider, model);
          if (debug) {
            systemLog(
              'tui',
              `[useSessionManager] Created initial state: ${anchorId} → ${newSessionId} (${provider}/${model})`
            );
          }
        } else if (
          reason === 'initial' &&
          sessionState.compression_history.length > 1
        ) {
          // State exists with compression history - this is a TUI restart
          // Preserve history by appending with 'restart' reason instead of creating new state
          const event: SessionUpdateEvent = {
            previousSessionId,
            newSessionId,
            reason: 'restart',
            compressedTokens,
          };
          store.update(event);

          if (debug) {
            systemLog(
              'tui',
              `[useSessionManager] Preserved state on restart: ${anchorId} → ${newSessionId} (${sessionState.compression_history.length} sessions in history)`
            );
          }

          // Notify callback
          onSDKSessionChanged?.(event);
        } else if (reason === 'initial') {
          // State exists but has only initial entry - recreate it (with provider/model for resume)
          store.create(newSessionId, provider, model);
          if (debug) {
            systemLog(
              'tui',
              `[useSessionManager] Recreated initial state: ${anchorId} → ${newSessionId} (${provider}/${model})`
            );
          }
        } else {
          // Update existing state (reason is 'compression' or 'expiration')
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
          systemLog(
            'tui',
            `[useSessionManager] SDK session updated: ${previousSessionId} → ${newSessionId} (${reason})`
          );
        }

        // Return updated state
        // Clear forceNewSession flag (both ref and state) when session changes
        // This allows resumeSessionId to be used for subsequent messages
        if (debug) {
          systemLog(
            'tui',
            `[useSessionManager.updateSDKSession] Clearing forceNewSession flag (was ${forceNewSessionRef.current})`
          );
        }
        forceNewSessionRef.current = false;

        return {
          ...prev,
          currentSessionId: newSessionId,
          resumeSessionId: newSessionId,
          forceNewSession: false,
          hasReceivedSDKSessionId: true,
        };
      });
    },
    [anchorId, provider, model, debug, onSDKSessionChanged]
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
        systemLog(
          'tui',
          `[useSessionManager] Stats updated: ${JSON.stringify(stats)}`
        );
      }
    },
    [debug]
  );

  // Reset resume session ID (after compression)
  const resetResumeSession = useCallback(() => {
    // Set synchronous ref FIRST (immediate effect, bypasses React async state)
    forceNewSessionRef.current = true;

    setState((prev) => ({
      ...prev,
      resumeSessionId: undefined,
      forceNewSession: true, // Also set in state for consistency
    }));

    if (debug) {
      systemLog(
        'tui',
        '[useSessionManager] Resume session reset (forceNewSession=true, ref set)'
      );
    }
  }, [debug]);

  // Get effective resume session ID (respects synchronous forceNewSession flag)
  const getResumeSessionId = useCallback(() => {
    // debug logging removed to prevent render loops

    // Check synchronous ref FIRST - it's set immediately by resetResumeSession
    // This bypasses React's async state updates and prevents race conditions
    if (forceNewSessionRef.current) {
      if (debug) {
        // Reduced frequency logging to avoid render loops
        // systemLog(
        //   'tui',
        //   '[useSessionManager.getResumeSessionId] Returning undefined (force new session)'
        // );
      }
      return undefined; // Force new session
    }

    if (debug) {
      // Reduced frequency logging to avoid render loops
      // systemLog(
      //   'tui',
      //   `[useSessionManager.getResumeSessionId] Returning ${state.resumeSessionId}`
      // );
    }
    return state.resumeSessionId;
  }, [state.resumeSessionId, debug]);

  // Persist token counts for compression threshold continuity
  const updateTokens = useCallback(
    (tokens: SessionTokens) => {
      storeRef.current.updateTokens(tokens);
      if (debug) {
        systemLog('tui', `[useSessionManager] Saved tokens: ${tokens.total}`);
      }
    },
    [debug]
  );

  // Persist cumulative session token counts
  const updateSessionTokens = useCallback(
    (tokens: SessionTokens) => {
      storeRef.current.updateSessionTokens(tokens);
      if (debug) {
        systemLog(
          'tui',
          `[useSessionManager] Saved cumulative tokens: ${tokens.total}`
        );
      }
    },
    [debug]
  );

  // Persist current task list for session continuity (for providers without native SigmaTaskUpdate)
  const updateTasks = useCallback(
    (tasks: SigmaTask[]) => {
      storeRef.current.updateTasks(tasks);
      if (debug) {
        systemLog('tui', `[useSessionManager] Saved ${tasks.length} tasks`);
      }
    },
    [debug]
  );

  return {
    state,
    store: storeRef.current,
    updateSDKSession,
    updateStats,
    resetResumeSession,
    getResumeSessionId,
    updateTokens,
    updateSessionTokens,
    updateTasks,
  };
}
