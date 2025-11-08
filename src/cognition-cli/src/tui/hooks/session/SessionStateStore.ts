/**
 * Session State Store
 *
 * Manages session state persistence to disk.
 * Wraps the lower-level session-state.ts functions with a cleaner API.
 *
 * Responsibilities:
 * - Load/save session state files
 * - Track anchor ID → SDK session ID mapping
 * - Update stats (turns analyzed, paradigm shifts, etc.)
 * - Handle compression history
 * - Migrate old state files
 */

import {
  loadSessionState,
  saveSessionState,
  createSessionState,
  updateSessionState,
  updateSessionStats,
  migrateOldStateFile,
  type SessionState,
} from '../../../sigma/session-state.js';
import type { SessionLoadResult, SessionUpdateEvent } from './types.js';

export interface SessionStats {
  total_turns_analyzed: number;
  paradigm_shifts: number;
  routine_turns: number;
  avg_novelty: string;
  avg_importance: string;
}

/**
 * Manages session state persistence
 */
export class SessionStateStore {
  constructor(
    private anchorId: string,
    private cwd: string,
    private debug: boolean = false
  ) {}

  /**
   * Load session state from disk
   * Returns undefined if no state file exists
   */
  load(): SessionState | null {
    try {
      return loadSessionState(this.anchorId, this.cwd);
    } catch (err) {
      if (this.debug) {
        console.error('[SessionStateStore] Failed to load state:', err);
      }
      return null;
    }
  }

  /**
   * Save session state to disk
   */
  save(state: SessionState): boolean {
    try {
      saveSessionState(state, this.cwd);
      return true;
    } catch (err) {
      if (this.debug) {
        console.error('[SessionStateStore] Failed to save state:', err);
      }
      return false;
    }
  }

  /**
   * Create initial session state
   */
  create(sdkSessionId: string): SessionState {
    const state = createSessionState(this.anchorId, sdkSessionId);
    this.save(state);
    if (this.debug) {
      console.log(
        `[SessionStateStore] Created state: ${this.anchorId} → ${sdkSessionId}`
      );
    }
    return state;
  }

  /**
   * Update existing session state with new SDK session ID
   */
  update(event: SessionUpdateEvent): SessionState | null {
    const state = this.load();
    if (!state) {
      if (this.debug) {
        console.error('[SessionStateStore] No state to update');
      }
      return null;
    }

    const updated = updateSessionState(
      state,
      event.newSessionId,
      event.reason,
      event.compressedTokens
    );

    this.save(updated);
    if (this.debug) {
      console.log(
        `[SessionStateStore] Updated: ${this.anchorId} → ${event.newSessionId} (${event.reason})`
      );
    }

    return updated;
  }

  /**
   * Update session stats (turns analyzed, paradigm shifts, etc.)
   */
  updateStats(stats: SessionStats): boolean {
    const state = this.load();
    if (!state) {
      if (this.debug) {
        console.warn('[SessionStateStore] No state to update stats');
      }
      return false;
    }

    const updated = updateSessionStats(state, stats);
    return this.save(updated);
  }

  /**
   * Migrate old state file format if needed
   */
  migrate(): SessionState | null {
    try {
      const state = this.load();
      if (!state) {
        return null;
      }

      // Check if migration needed
      if (!('compression_history' in state)) {
        if (this.debug) {
          console.log('[SessionStateStore] Migrating old state file');
        }
        return migrateOldStateFile(this.anchorId, this.cwd);
      }

      return state;
    } catch (err) {
      if (this.debug) {
        console.error('[SessionStateStore] Migration failed:', err);
      }
      return null;
    }
  }

  /**
   * Load and prepare session for resumption
   * Returns undefined for fresh session, or session ID to resume
   */
  loadForResume(): SessionLoadResult {
    // Try to migrate if needed
    const state = this.migrate();

    if (!state) {
      // No state - fresh session
      return {
        resumeSessionId: undefined,
        currentSessionId: this.anchorId,
      };
    }

    // Has state - resume from current session
    const message =
      state.compression_history.length > 0
        ? `🔄 Resuming: ${this.anchorId} (${state.compression_history.length} sessions)`
        : undefined;

    return {
      resumeSessionId: state.current_session,
      currentSessionId: this.anchorId,
      message,
    };
  }

  /**
   * Get anchor ID
   */
  getAnchorId(): string {
    return this.anchorId;
  }
}
