/**
 * Session State Management (Legacy Proxy)
 *
 * This file now delegates to the formalized state machine in src/core/state/session/.
 * It maintains backward compatibility with the existing procedural API.
 */

import type { SigmaTask, SessionState } from '../core/state/session/types.js';
import {
  loadSessionState as loadPersisted,
  saveSessionState as savePersisted,
  createSessionState as createInitial,
  listSessions as listAll,
  migrateOldStateFile as migrateFile,
  migrateAllOldStates as migrateAll,
  migrateTasks as migrateTasksLogic,
} from '../core/state/session/SessionPersistence.js';
import { sessionManager } from '../core/state/session/SessionManager.js';
import { SessionStateMachine } from '../core/state/session/SessionStateMachine.js';

// Re-export types for backward compatibility
export type { SigmaTask, SessionState };

/**
 * Migrate tasks from old format (without id) to new format (with id)
 */
export function migrateTasks(tasks: unknown[]): SigmaTask[] {
  return migrateTasksLogic(tasks);
}

/**
 * Load session state from disk
 */
export function loadSessionState(
  anchorId: string,
  projectRoot: string
): SessionState | null {
  return loadPersisted(anchorId, projectRoot);
}

/**
 * Save session state to disk with atomic write
 */
export function saveSessionState(
  state: SessionState,
  projectRoot: string
): void {
  savePersisted(state, projectRoot);
  // Also update the in-memory manager's state for this anchor if it's already tracked.
  // We do NOT call machine.updateSDKSession here as that would add a 'restart' entry
  // to history every time we save. Instead, we just sync the state.
  const machine = sessionManager.getStateMachine(state.anchor_id, projectRoot);
  if (machine) {
    const currentState = machine.getState();
    if (
      !currentState ||
      currentState.current_session !== state.current_session
    ) {
      machine.handleEvent({ type: 'LOAD_SUCCESS', state });
    }
  }
}

/**
 * Create initial session state
 */
export function createSessionState(
  anchorId: string,
  sdkSessionId: string,
  provider?: string,
  model?: string
): SessionState {
  return createInitial(anchorId, sdkSessionId, provider, model);
}

/**
 * Update session state with new SDK session
 */
export function updateSessionState(
  state: SessionState,
  newSdkSession: string,
  reason: 'compression' | 'expiration' | 'restart',
  tokens?: number
): SessionState {
  const machine = new SessionStateMachine(state);
  machine.updateSDKSession(newSdkSession, reason, tokens);
  return machine.getState() || state;
}

/**
 * Update Sigma statistics
 */
export function updateSessionStats(
  state: SessionState,
  stats: SessionState['stats']
): SessionState {
  const machine = new SessionStateMachine(state);
  machine.updateStats(stats);
  return machine.getState() || state;
}

/**
 * Update session todos
 */
export function updateSessionTasks(
  state: SessionState,
  todos: SessionState['todos']
): SessionState {
  // Direct update for legacy API
  return {
    ...state,
    todos: todos as SigmaTask[],
    last_updated: new Date().toISOString(),
  };
}

/**
 * Update todos directly by anchor ID
 */
export async function updateTasksByAnchorId(
  anchorId: string,
  projectRoot: string,
  todos: SessionState['todos'],
  replace: boolean = false
): Promise<string> {
  const state = loadPersisted(anchorId, projectRoot);
  if (!state) {
    return `Warning: No session state found for ${anchorId}. Todos not persisted.`;
  }

  const machine = sessionManager.getStateMachine(anchorId, projectRoot);
  if (machine && !machine.getState()) {
    machine.handleEvent({ type: 'LOAD_SUCCESS', state });
  }
  return await machine.updateTasks(todos as Partial<SigmaTask>[], replace);
}

/**
 * Formats a concise context of the task list for the system prompt.
 */
export function getTaskContextForPrompt(
  anchorId: string,
  projectRoot: string
): string {
  const machine = sessionManager.getStateMachine(anchorId, projectRoot);
  return machine.getTaskContextForPrompt();
}

/**
 * Get the currently active Sigma task for a session
 */
export function getActiveTask(
  anchorId: string,
  projectRoot: string
): SigmaTask | null {
  const state = loadSessionState(anchorId, projectRoot);
  if (!state || !state.todos) return null;
  return state.todos.find((t) => t.status === 'in_progress') || null;
}

/**
 * Get the currently active Sigma task ID for a session
 */
export function getActiveTaskId(
  anchorId: string,
  projectRoot: string
): string | null {
  const task = getActiveTask(anchorId, projectRoot);
  return task ? task.id : null;
}

/**
 * List all sessions
 */
export function listSessions(projectRoot: string): Array<{
  anchor_id: string;
  created_at: string;
  last_updated: string;
  sessions_count: number;
}> {
  return listAll(projectRoot);
}

/**
 * Migrate old state file format
 */
export function migrateOldStateFile(
  anchorId: string,
  projectRoot: string
): SessionState | null {
  return migrateFile(anchorId, projectRoot);
}

/**
 * Migrate all old state files
 */
export function migrateAllOldStates(projectRoot: string): void {
  migrateAll(projectRoot);
}
