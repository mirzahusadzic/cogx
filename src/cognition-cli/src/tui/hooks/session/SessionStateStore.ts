/**
 * Session State Store
 *
 * Encapsulates all session state persistence logic.
 * Manages the mapping between anchor IDs and SDK session UUIDs.
 *
 * Extracted from useClaudeAgent.ts as part of Week 1 Day 4-5 refactor.
 */

import {
  SessionState,
  loadSessionState,
  saveSessionState,
  createSessionState,
  updateSessionState,
  updateSessionStats,
} from '../../../sigma/session-state.js';

export interface SessionStats {
  total_turns_analyzed: number;
  paradigm_shifts: number;
  routine_turns: number;
  avg_novelty: string;
  avg_importance: string;
}

/**
 * Session state store for TUI.
 * Handles all session state persistence operations.
 */
export class SessionStateStore {
  constructor(private projectRoot: string) {}

  /**
   * Load session state from disk
   */
  load(anchorId: string): SessionState | null {
    return loadSessionState(anchorId, this.projectRoot);
  }

  /**
   * Save session state to disk
   */
  save(state: SessionState): void {
    saveSessionState(state, this.projectRoot);
  }

  /**
   * Create initial session state
   */
  create(anchorId: string, sdkSessionId: string): SessionState {
    return createSessionState(anchorId, sdkSessionId);
  }

  /**
   * Update session state with new SDK session
   */
  updateSession(
    state: SessionState,
    newSdkSession: string,
    reason: 'compression' | 'expiration',
    tokens?: number
  ): SessionState {
    return updateSessionState(state, newSdkSession, reason, tokens);
  }

  /**
   * Update session statistics
   */
  updateStats(state: SessionState, stats: SessionStats): SessionState {
    return updateSessionStats(state, stats);
  }

  /**
   * Get or create session state
   */
  getOrCreate(anchorId: string, sdkSessionId: string): SessionState {
    const existing = this.load(anchorId);
    if (existing) {
      return existing;
    }
    const newState = this.create(anchorId, sdkSessionId);
    this.save(newState);
    return newState;
  }
}
