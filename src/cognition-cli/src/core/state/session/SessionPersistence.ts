/**
 * Session Persistence
 *
 * Handles loading and saving session state files.
 */

import fs from 'fs';
import path from 'path';
import { SessionState, SigmaTask } from './types.js';
import { systemDiagnosticsService } from '../../services/diagnostics/SystemDiagnosticsService.js';

/**
 * Interface representing the legacy session state structure
 * used before the migration to SessionStateMachine.
 */
interface LegacySessionState {
  timestamp?: string;
  newSessionId?: string;
  compression?: {
    triggered_at_tokens?: number;
  };
  turnAnalysis?: {
    total_turns_analyzed?: number;
    paradigm_shifts?: number;
    routine_turns?: number;
    avg_novelty?: string;
    avg_importance?: string;
  };
  anchor_id?: string;
  compression_history?: Array<{
    sdk_session: string;
    timestamp: string;
    reason: string;
    tokens?: number;
  }>;
}

/**
 * Migrate tasks from old format (without id) to new format (with id)
 */
export function migrateTasks(tasks: unknown[]): SigmaTask[] {
  return tasks.map((t, idx) => {
    const task = t as Partial<SigmaTask>;
    if (!task.id) {
      const id = `migrated-${idx}-${Date.now()}`;
      systemDiagnosticsService.systemLog(
        'sigma',
        'Migrating task without ID',
        { content: task.content || 'No content', id },
        'warn'
      );
      return {
        ...task,
        id,
        content: task.content || 'Migrated task',
        activeForm: task.activeForm || 'Migrated task',
        status: task.status || 'pending',
      } as SigmaTask;
    }
    return task as SigmaTask;
  });
}

/**
 * List all sessions in the .sigma directory
 *
 * @param projectRoot - Project root directory
 * @returns Array of session metadata
 */
export function listSessions(projectRoot: string): Array<{
  anchor_id: string;
  created_at: string;
  last_updated: string;
  sessions_count: number;
}> {
  const sigmaDir = path.join(projectRoot, '.sigma');

  if (!fs.existsSync(sigmaDir)) {
    return [];
  }

  const stateFiles = fs
    .readdirSync(sigmaDir)
    .filter((f) => f.endsWith('.state.json'));

  const sessions = [];

  for (const file of stateFiles) {
    try {
      const content = fs.readFileSync(path.join(sigmaDir, file), 'utf-8');
      const state = JSON.parse(content) as SessionState;

      sessions.push({
        anchor_id: state.anchor_id,
        created_at: state.created_at,
        last_updated: state.last_updated,
        sessions_count: state.compression_history?.length || 0,
      });
    } catch {
      continue;
    }
  }

  return sessions.sort(
    (a, b) =>
      new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
  );
}

/**
 * Load session state from disk
 *
 * @param anchorId - The anchor ID for the session
 * @param projectRoot - Project root directory
 * @returns The loaded session state or null if not found
 */
export function loadSessionState(
  anchorId: string,
  projectRoot: string
): SessionState | null {
  const sigmaDir = path.join(projectRoot, '.sigma');
  const stateFile = path.join(sigmaDir, `${anchorId}.state.json`);

  if (!fs.existsSync(stateFile)) {
    // Try to migrate if it's an old style anchor
    if (!anchorId.includes('-sigma-')) {
      return migrateOldStateFile(anchorId, projectRoot);
    }
    return null;
  }

  try {
    const content = fs.readFileSync(stateFile, 'utf-8');
    const state = JSON.parse(content) as SessionState;

    // Migrate tasks without id field
    if (state.todos && state.todos.length > 0) {
      const hasMissingIds = (state.todos as Array<Partial<SigmaTask>>).some(
        (t) => !t.id
      );
      if (hasMissingIds) {
        state.todos = migrateTasks(state.todos);
        saveSessionState(state, projectRoot);
      }
    }

    return state;
  } catch (error) {
    systemDiagnosticsService.systemLog(
      'sigma',
      `Failed to load session state for ${anchorId}`,
      { error: error instanceof Error ? error.message : String(error) },
      'error'
    );
    return null;
  }
}

/**
 * Migrate old state files to new anchor format
 */
export function migrateOldStateFile(
  anchorId: string,
  projectRoot: string
): SessionState | null {
  const sigmaDir = path.join(projectRoot, '.sigma');
  const stateFile = path.join(sigmaDir, `${anchorId}.state.json`);

  if (!fs.existsSync(stateFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(stateFile, 'utf-8');
    const oldState = JSON.parse(content) as LegacySessionState;

    if (oldState.anchor_id && oldState.compression_history) {
      return oldState as unknown as SessionState;
    }

    systemDiagnosticsService.systemLog(
      'sigma',
      `Migrating old state file: ${anchorId}`
    );

    const compressionHistory: SessionState['compression_history'] = [];
    compressionHistory.push({
      sdk_session: anchorId,
      timestamp: oldState.timestamp || new Date().toISOString(),
      reason: 'initial',
    });

    let nextId = oldState.newSessionId;
    let currentState = oldState;
    const filesToDelete: string[] = [];

    while (nextId) {
      compressionHistory.push({
        sdk_session: nextId,
        timestamp: currentState.timestamp || new Date().toISOString(),
        reason: 'compression',
        tokens: currentState.compression?.triggered_at_tokens,
      });

      const nextFile = path.join(sigmaDir, `${nextId}.state.json`);
      if (!fs.existsSync(nextFile)) break;
      filesToDelete.push(nextFile);

      try {
        const nextContent = fs.readFileSync(nextFile, 'utf-8');
        const nextState = JSON.parse(nextContent) as LegacySessionState;
        currentState = nextState;
        nextId = nextState.newSessionId;
      } catch {
        break;
      }
    }

    for (const file of filesToDelete) {
      try {
        fs.unlinkSync(file);
      } catch {
        // Ignore
      }
    }

    const newState: SessionState = {
      anchor_id: anchorId,
      current_session: anchorId,
      created_at: oldState.timestamp || new Date().toISOString(),
      last_updated: new Date().toISOString(),
      compression_history: compressionHistory,
      stats: oldState.turnAnalysis
        ? {
            total_turns_analyzed:
              oldState.turnAnalysis.total_turns_analyzed || 0,
            paradigm_shifts: oldState.turnAnalysis.paradigm_shifts || 0,
            routine_turns: oldState.turnAnalysis.routine_turns || 0,
            avg_novelty: oldState.turnAnalysis.avg_novelty || '0',
            avg_importance: oldState.turnAnalysis.avg_importance || '0',
          }
        : undefined,
    };

    saveSessionState(newState, projectRoot);
    return newState;
  } catch {
    return null;
  }
}

/**
 * Migrate all old state files in .sigma directory
 */
export function migrateAllOldStates(projectRoot: string): void {
  const sigmaDir = path.join(projectRoot, '.sigma');

  if (!fs.existsSync(sigmaDir)) return;

  const stateFiles = fs
    .readdirSync(sigmaDir)
    .filter((f) => f.endsWith('.state.json'));

  let migratedCount = 0;

  for (const file of stateFiles) {
    const anchorId = file.replace('.state.json', '');
    if (anchorId.includes('-sigma-')) continue;

    const result = migrateOldStateFile(anchorId, projectRoot);
    if (result) migratedCount++;
  }

  if (migratedCount > 0) {
    systemDiagnosticsService.systemLog(
      'sigma',
      `Migrated ${migratedCount} session(s) to new anchor format`
    );
  }
}

/**
 * Save session state to disk with atomic write
 *
 * @param state - Session state to save
 * @param projectRoot - Project root directory
 */
export function saveSessionState(
  state: SessionState,
  projectRoot: string
): void {
  const sigmaDir = path.join(projectRoot, '.sigma');
  fs.mkdirSync(sigmaDir, { recursive: true });

  const stateFile = path.join(sigmaDir, `${state.anchor_id}.state.json`);
  const tempFile = `${stateFile}.tmp`;

  try {
    // Write to temp file first
    const content = JSON.stringify(state, null, 2);
    fs.writeFileSync(tempFile, content, 'utf-8');

    // Atomic rename
    fs.renameSync(tempFile, stateFile);
  } catch (error) {
    // Clean up temp file on error
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {
      // Ignore cleanup
    }

    throw new Error(
      `Failed to save session state for ${state.anchor_id}: ${error instanceof Error ? error.message : String(error)}`
    );
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
  return {
    anchor_id: anchorId,
    current_session: sdkSessionId,
    provider,
    model,
    created_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    compression_history: [
      {
        sdk_session: sdkSessionId,
        timestamp: new Date().toISOString(),
        reason: 'initial',
      },
    ],
  };
}
