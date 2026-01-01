/**
 * Session State Store
 *
 * Manages persistent session state storage for the TUI.
 * Provides a clean object-oriented API over the lower-level session-state.ts functions.
 *
 * DESIGN:
 * This class bridges the dual-identity session model with disk persistence:
 *
 * File structure:
 *   .sigma/{anchorId}.state.json
 *
 * State format:
 *   {
 *     anchor_id: "my-project",
 *     current_session: "sdk-uuid-2",
 *     compression_history: [
 *       { from: "sdk-uuid-1", to: "sdk-uuid-2", reason: "compression", ... }
 *     ],
 *     stats: {
 *       total_turns_analyzed: 47,
 *       paradigm_shifts: 3,
 *       ...
 *     }
 *   }
 *
 * RESPONSIBILITIES:
 * - Load/save session state files (.sigma/{anchorId}.state.json)
 * - Track anchor ID → SDK session ID mapping
 * - Update conversation statistics (turns analyzed, paradigm shifts, etc.)
 * - Maintain compression history for audit trail
 * - Migrate old state file formats
 *
 * The store ensures that even when SDK sessions change (due to compression
 * or expiration), the anchor ID remains stable and all history is preserved.
 *
 * @example
 * // Create new session
 * const store = new SessionStateStore('my-project', cwd);
 * store.create('sdk-uuid-1'); // Save initial state
 *
 * @example
 * // Update after compression
 * const store = new SessionStateStore('my-project', cwd);
 * store.update({
 *   previousSessionId: 'sdk-uuid-1',
 *   newSessionId: 'sdk-uuid-2',
 *   reason: 'compression',
 *   compressedTokens: 100000
 * });
 *
 * @example
 * // Resume existing session
 * const store = new SessionStateStore('my-project', cwd);
 * const result = store.loadForResume();
 * systemLog('tui', `Resume from: ${result.resumeSessionId}`);
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
import { systemLog } from '../../../utils/debug-logger.js';
import type {
  SessionLoadResult,
  SessionUpdateEvent,
  SessionTokens,
} from './types.js';

/**
 * Statistics tracked for each session
 */
export interface SessionStats {
  /** Total number of conversation turns analyzed */
  total_turns_analyzed: number;

  /** Count of paradigm shift turns (major conceptual changes) */
  paradigm_shifts: number;

  /** Count of routine turns (low novelty) */
  routine_turns: number;

  /** Average novelty score across all turns (0.0-1.0) */
  avg_novelty: string;

  /** Average importance score across all turns (0-10) */
  avg_importance: string;
}

/**
 * Manages session state persistence to disk.
 *
 * This class provides CRUD operations for session state files:
 * - create(): Initialize new session state
 * - load(): Read existing state from disk
 * - save(): Write state to disk
 * - update(): Update with new SDK session ID
 * - updateStats(): Update conversation statistics
 * - migrate(): Convert old state file formats
 *
 * State files are stored at: .sigma/{anchorId}.state.json
 *
 * @example
 * const store = new SessionStateStore('my-session', '/home/user/project');
 * const state = store.load();
 * if (state) {
 *   systemLog('tui', `Current SDK session: ${state.current_session}`);
 * }
 */
export class SessionStateStore {
  /**
   * Creates a new session state store.
   *
   * @param anchorId - Stable session identifier (user-facing)
   * @param cwd - Working directory containing .sigma/ folder
   * @param debug - Enable debug logging (default: false)
   */
  constructor(
    private anchorId: string,
    private cwd: string,
    private debug: boolean = false
  ) {}

  /**
   * Load session state from disk.
   *
   * Reads .sigma/{anchorId}.state.json and parses as SessionState.
   * Returns null if file doesn't exist or is invalid.
   *
   * @returns Session state object, or null if not found
   *
   * @example
   * const store = new SessionStateStore('my-session', cwd);
   * const state = store.load();
   * if (state) {
   *   systemLog('tui', `Session has ${state.compression_history.length} compressions`);
   * }
   */
  load(): SessionState | null {
    try {
      return loadSessionState(this.anchorId, this.cwd);
    } catch (err) {
      if (this.debug) {
        systemLog('tui', `[SessionStateStore] Failed to load state: ${err}`);
      }
      return null;
    }
  }

  /**
   * Save session state to disk.
   *
   * Writes state object to .sigma/{anchorId}.state.json.
   * Creates .sigma/ directory if it doesn't exist.
   *
   * @param state - Session state to persist
   * @returns True if save succeeded, false on error
   */
  save(state: SessionState): boolean {
    try {
      saveSessionState(state, this.cwd);
      return true;
    } catch (err) {
      if (this.debug) {
        systemLog('tui', `[SessionStateStore] Failed to save state: ${err}`);
      }
      return false;
    }
  }

  /**
   * Create initial session state.
   *
   * Initializes new state file with:
   * - anchor_id = anchorId
   * - current_session = sdkSessionId
   * - provider and model (for session resume)
   * - Empty compression_history
   * - Default stats (zeros)
   *
   * @param sdkSessionId - Initial SDK session UUID
   * @param provider - LLM provider (e.g., 'claude', 'gemini')
   * @param model - Model name (e.g., 'claude-sonnet-4-5-20250514')
   * @returns Newly created session state
   *
   * @example
   * const store = new SessionStateStore('my-session', cwd);
   * const state = store.create('sdk-abc-123', 'claude', 'claude-sonnet-4-5-20250514');
   * // Creates .sigma/my-session.state.json
   */
  create(
    sdkSessionId: string,
    provider?: string,
    model?: string
  ): SessionState {
    const state = createSessionState(
      this.anchorId,
      sdkSessionId,
      provider,
      model
    );
    this.save(state);
    if (this.debug) {
      systemLog(
        'tui',
        `[SessionStateStore] Created state: ${this.anchorId} → ${sdkSessionId} (${provider}/${model})`
      );
    }
    return state;
  }

  /**
   * Update existing session state with new SDK session ID.
   *
   * Records SDK session change in compression_history and updates current_session.
   * Used when compression or expiration creates new SDK session.
   *
   * @param event - Session update event with old/new IDs and reason
   * @returns Updated session state, or null if no state file exists
   *
   * @example
   * store.update({
   *   previousSessionId: 'sdk-abc',
   *   newSessionId: 'sdk-xyz',
   *   reason: 'compression',
   *   compressedTokens: 95000
   * });
   */
  update(event: SessionUpdateEvent): SessionState | null {
    const state = this.load();
    if (!state) {
      if (this.debug) {
        systemLog('tui', '[SessionStateStore] No state to update');
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
      systemLog(
        'tui',
        `[SessionStateStore] Updated: ${this.anchorId} → ${event.newSessionId} (${event.reason})`
      );
    }

    return updated;
  }

  /**
   * Update session statistics.
   *
   * Overwrites stats section of state file with new values.
   * Used to track conversation analysis metrics.
   *
   * @param stats - New statistics to save
   * @returns True if update succeeded, false on error
   *
   * @example
   * store.updateStats({
   *   total_turns_analyzed: 42,
   *   paradigm_shifts: 3,
   *   routine_turns: 15,
   *   avg_novelty: '0.673',
   *   avg_importance: '6.2'
   * });
   */
  updateStats(stats: SessionStats): boolean {
    const state = this.load();
    if (!state) {
      if (this.debug) {
        systemLog('tui', '[SessionStateStore] No state to update stats');
      }
      return false;
    }

    const updated = updateSessionStats(state, stats);
    return this.save(updated);
  }

  /**
   * Update last known token counts.
   *
   * Persists current token usage for restoration on TUI restart.
   * Enables accurate compression threshold detection across restarts.
   *
   * @param tokens - Current token counts
   * @returns True if update succeeded, false on error
   */
  updateTokens(tokens: SessionTokens): boolean {
    const state = this.load();
    if (!state) {
      if (this.debug) {
        systemLog('tui', '[SessionStateStore] No state to update tokens');
      }
      return false;
    }

    state.last_total_tokens = {
      input: tokens.input,
      output: tokens.output,
      total: tokens.total,
    };
    state.last_updated = new Date().toISOString();

    return this.save(state);
  }

  /**
   * Migrate old state file format if needed.
   *
   * Converts legacy state files (missing compression_history) to new format.
   * Called automatically by loadForResume().
   *
   * @returns Migrated session state, or null if migration failed
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
          systemLog('tui', '[SessionStateStore] Migrating old state file');
        }
        return migrateOldStateFile(this.anchorId, this.cwd);
      }

      return state;
    } catch (err) {
      if (this.debug) {
        systemLog('tui', `[SessionStateStore] Migration failed: ${err}`);
      }
      return null;
    }
  }

  /**
   * Load and prepare session for resumption.
   *
   * High-level method that:
   * 1. Attempts migration if state file is old format
   * 2. Returns fresh session info if no state exists
   * 3. Returns resume info with SDK session ID if state exists
   *
   * Used by useSessionManager on mount to determine session continuity.
   *
   * @returns Object with resume session ID and optional user message
   *
   * @example
   * const result = store.loadForResume();
   * if (result.resumeSessionId) {
   *   systemLog('tui', `Resuming from: ${result.resumeSessionId}`);
   *   if (result.message) {
   *     showUserMessage(result.message);
   *   }
   * }
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

    // Restore token counts for compression threshold continuity
    const restoredTokens = state.last_total_tokens
      ? {
          input: state.last_total_tokens.input,
          output: state.last_total_tokens.output,
          total: state.last_total_tokens.total,
        }
      : undefined;

    return {
      resumeSessionId: state.current_session,
      currentSessionId: this.anchorId,
      message,
      restoredTokens,
      // Include provider/model for backward-compatible resume
      provider: state.provider,
      model: state.model,
      // Include todos for providers without native SigmaTaskUpdate (Gemini, OpenAI)
      todos: state.todos,
    };
  }

  /**
   * Get anchor ID for this store.
   *
   * @returns Stable anchor session ID
   */
  getAnchorId(): string {
    return this.anchorId;
  }
}
