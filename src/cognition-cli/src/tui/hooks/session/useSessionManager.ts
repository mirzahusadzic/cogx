/**
 * Session Manager Hook
 *
 * Manages session lifecycle including:
 * - Anchor ID (stable, user-facing)
 * - SDK session ID (transient, changes on compression)
 * - Session state persistence
 * - Resume session tracking
 *
 * Extracted from useClaudeAgent.ts as part of Week 1 Day 4-5 refactor.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { SessionStateStore, SessionStats } from './SessionStateStore.js';
import { SessionState } from '../../../sigma/session-state.js';

export interface UseSessionManagerOptions {
  sessionId?: string;
  cwd: string;
  debug?: boolean;
}

export interface SessionManager {
  /** Stable anchor ID (user-facing) */
  anchorId: string;
  /** Current SDK session ID (transient) */
  currentSessionId: string;
  /** Session ID to resume from (undefined = start fresh) */
  resumeSessionId: string | undefined;
  /** Whether we've received SDK session ID */
  hasReceivedSDKSessionId: boolean;
  /** Update current session ID (called when SDK provides new ID) */
  updateCurrentSession: (newSessionId: string) => void;
  /** Update resume session ID */
  updateResumeSession: (sessionId: string | undefined) => void;
  /** Mark that SDK session ID was received */
  markSDKSessionReceived: () => void;
  /** Update session statistics */
  updateStats: (stats: SessionStats) => void;
  /** Handle compression event */
  handleCompression: (compressedTokens: number) => void;
  /** Get current session state */
  getState: () => SessionState | null;
}

/**
 * Hook to manage session state
 */
export function useSessionManager(
  options: UseSessionManagerOptions
): SessionManager {
  const { sessionId: sessionIdProp, cwd, debug } = options;

  // Stable anchor ID (never changes)
  const anchorId = useMemo(
    () => sessionIdProp || `tui-${Date.now()}`,
    [sessionIdProp]
  );

  // Session state store
  const storeRef = useRef(new SessionStateStore(cwd));
  const store = storeRef.current;

  // Current SDK session ID (transient)
  const [currentSessionId, setCurrentSessionId] = useState(anchorId);

  // Resume session ID (undefined = start fresh)
  const [resumeSessionId, setResumeSessionId] = useState<string | undefined>(
    undefined
  );

  // Track if we've received SDK session ID (use state for observability)
  const [hasReceivedSDKSessionId, setHasReceivedSDKSessionId] = useState(false);

  // Compression flag (used to determine reason for session change)
  const compressionTriggeredRef = useRef(false);

  // Update current session ID when SDK provides new one
  const updateCurrentSession = useCallback(
    (newSessionId: string) => {
      if (newSessionId === currentSessionId) {
        return; // No change
      }

      if (debug) {
        console.log(
          `[SessionManager] SDK session changed: ${currentSessionId} → ${newSessionId}`
        );
      }

      // Load existing state or create new one
      let state = store.load(anchorId);

      if (!state) {
        // First time - create initial state
        state = store.create(anchorId, newSessionId);
        store.save(state);
        if (debug) {
          console.log(
            `[SessionManager] Created new state: ${anchorId} → ${newSessionId}`
          );
        }
      } else {
        // Update existing state with new SDK session
        const reason = compressionTriggeredRef.current
          ? 'compression'
          : 'expiration';
        const compressedTokens = compressionTriggeredRef.current
          ? undefined
          : undefined; // TODO: Pass from compression handler

        const updated = store.updateSession(
          state,
          newSessionId,
          reason,
          compressedTokens
        );
        store.save(updated);

        if (debug) {
          console.log(
            `[SessionManager] Updated state: ${anchorId} → ${newSessionId} (${reason})`
          );
        }

        // Reset compression flag after handling
        compressionTriggeredRef.current = false;
      }

      setCurrentSessionId(newSessionId);
    },
    [currentSessionId, anchorId, store, debug]
  );

  // Update resume session ID
  const updateResumeSession = useCallback((sessionId: string | undefined) => {
    setResumeSessionId(sessionId);
  }, []);

  // Mark that SDK session ID was received
  const markSDKSessionReceived = useCallback(() => {
    setHasReceivedSDKSessionId(true);
  }, []);

  // Update session statistics
  const updateStats = useCallback(
    (stats: SessionStats) => {
      const state = store.load(anchorId);
      if (!state) {
        if (debug) {
          console.warn(
            '[SessionManager] Cannot update stats - no state exists'
          );
        }
        return;
      }

      const updated = store.updateStats(state, stats);
      store.save(updated);

      if (debug) {
        console.log(`[SessionManager] Updated stats for ${anchorId}`);
      }
    },
    [anchorId, store, debug]
  );

  // Handle compression event
  const handleCompression = useCallback(
    (compressedTokens: number) => {
      compressionTriggeredRef.current = true;

      if (debug) {
        console.log(
          `[SessionManager] Compression triggered (${compressedTokens} tokens)`
        );
      }

      // Clear resume session - start fresh after compression
      setResumeSessionId(undefined);
    },
    [debug]
  );

  // Get current session state
  const getState = useCallback(() => {
    return store.load(anchorId);
  }, [anchorId, store]);

  return {
    anchorId,
    currentSessionId,
    resumeSessionId,
    hasReceivedSDKSessionId,
    updateCurrentSession,
    updateResumeSession,
    markSDKSessionReceived,
    updateStats,
    handleCompression,
    getState,
  };
}
