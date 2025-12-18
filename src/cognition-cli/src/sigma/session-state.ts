/**
 * Session State Management
 *
 * Manages the mapping between user-facing anchor IDs and the actual
 * SDK session UUIDs that may change over time due to compression or
 * session expiration.
 */

import fs from 'fs';
import path from 'path';

/**
 * Session state file format
 */
export interface SessionState {
  /** User-facing anchor ID (what user provides with --session-id) */
  anchor_id: string;

  /** Current active SDK session UUID */
  current_session: string;

  /** LLM provider used for this session (e.g., 'claude', 'gemini') */
  provider?: string;

  /** Model used for this session (e.g., 'claude-sonnet-4-5-20250514', 'gemini-2.5-pro') */
  model?: string;

  /** When this anchor was created */
  created_at: string;

  /** Last time current_session was updated */
  last_updated: string;

  /** History of SDK sessions (for debugging/audit) */
  compression_history: Array<{
    sdk_session: string;
    timestamp: string;
    reason: 'initial' | 'compression' | 'expiration' | 'restart';
    tokens?: number;
  }>;

  /** Sigma statistics */
  stats?: {
    total_turns_analyzed: number;
    paradigm_shifts: number;
    routine_turns: number;
    avg_novelty: string;
    avg_importance: string;
  };

  /** Last known token counts for compression threshold continuity */
  last_total_tokens?: {
    input: number;
    output: number;
    total: number;
  };

  /** Active todo list for this session (for providers without native TodoWrite) */
  todos?: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm: string;
  }>;
}

/**
 * Load session state from disk
 *
 * @param anchorId - User-facing anchor ID for the session
 * @param projectRoot - Project root directory
 * @returns Session state object or null if not found or invalid
 */
export function loadSessionState(
  anchorId: string,
  projectRoot: string
): SessionState | null {
  const stateFile = path.join(projectRoot, '.sigma', `${anchorId}.state.json`);

  if (!fs.existsSync(stateFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(stateFile, 'utf-8');
    return JSON.parse(content) as SessionState;
  } catch (err) {
    console.error(`Failed to load session state for ${anchorId}:`, err);
    return null;
  }
}

/**
 * Save session state to disk with atomic write
 *
 * Uses atomic write-and-rename to prevent corruption from partial writes.
 * This ensures state files are never left in an incomplete state if the
 * process crashes or is killed during write.
 *
 * ALGORITHM:
 * 1. Write to temporary file (.tmp suffix)
 * 2. Sync to disk (ensures data is written)
 * 3. Atomic rename to final filename
 * 4. Cleanup temp file on error
 *
 * @param state - Session state to save
 * @param projectRoot - Project root directory
 * @throws Error if write or rename fails
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

    // Atomic rename (POSIX guarantees atomicity)
    fs.renameSync(tempFile, stateFile);
  } catch (error) {
    // Clean up temp file on error
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {
      // Ignore cleanup errors
    }

    throw new Error(
      `Failed to save session state for ${state.anchor_id}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

/**
 * Create initial session state
 *
 * @param anchorId - User-facing anchor ID
 * @param sdkSessionId - SDK session UUID
 * @param provider - LLM provider (e.g., 'claude', 'gemini')
 * @param model - Model name (e.g., 'claude-sonnet-4-5-20250514')
 * @returns New session state object
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

/**
 * Update session state with new SDK session
 * (after compression, expiration, or restart)
 *
 * @param state - Current session state
 * @param newSdkSession - New SDK session UUID
 * @param reason - Reason for session change ('compression', 'expiration', or 'restart')
 * @param tokens - Optional token count at time of change
 * @returns Updated session state
 */
export function updateSessionState(
  state: SessionState,
  newSdkSession: string,
  reason: 'compression' | 'expiration' | 'restart',
  tokens?: number
): SessionState {
  // Defense-in-depth: Check if last entry already has this session ID
  // This prevents duplicate entries from React async state updates during rapid message processing
  const lastEntry =
    state.compression_history[state.compression_history.length - 1];
  if (lastEntry && lastEntry.sdk_session === newSdkSession) {
    // Skip duplicate - already logged this session
    return state;
  }

  return {
    ...state,
    current_session: newSdkSession,
    last_updated: new Date().toISOString(),
    compression_history: [
      ...state.compression_history,
      {
        sdk_session: newSdkSession,
        timestamp: new Date().toISOString(),
        reason,
        tokens,
      },
    ],
  };
}

/**
 * Update Sigma statistics
 *
 * @param state - Current session state
 * @param stats - Updated statistics object
 * @returns Updated session state with new stats
 */
export function updateSessionStats(
  state: SessionState,
  stats: SessionState['stats']
): SessionState {
  return {
    ...state,
    stats,
    last_updated: new Date().toISOString(),
  };
}

/**
 * Update session todos
 *
 * Used by providers without native TodoWrite (e.g., Gemini, OpenAI)
 * to persist task list in the session state file.
 *
 * @param state - Current session state
 * @param todos - Updated todo list
 * @returns Updated session state with new todos
 */
export function updateSessionTodos(
  state: SessionState,
  todos: SessionState['todos']
): SessionState {
  return {
    ...state,
    todos,
    last_updated: new Date().toISOString(),
  };
}

/**
 * Update todos directly by anchor ID
 *
 * Convenience function for tool executors that only have anchor ID and cwd.
 * Loads state, updates todos, saves state.
 *
 * @param anchorId - Session anchor ID
 * @param projectRoot - Project root directory
 * @param todos - Updated todo list
 * @returns Success message or error
 */
export function updateTodosByAnchorId(
  anchorId: string,
  projectRoot: string,
  todos: SessionState['todos']
): string {
  const state = loadSessionState(anchorId, projectRoot);

  if (!state) {
    // No state file yet - can't persist todos without session
    return `Warning: No session state found for ${anchorId}. Todos not persisted.`;
  }

  const updated = updateSessionTodos(state, todos);
  saveSessionState(updated, projectRoot);

  // Format summary for tool response
  const summary = (todos || [])
    .map((t) => {
      const icon =
        t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '→' : '○';
      const text = t.status === 'in_progress' ? t.activeForm : t.content;
      return `[${icon}] ${text}`;
    })
    .join('\n');

  return `Todo list updated (${(todos || []).length} items):\n${summary}`;
}

/**
 * List all sessions
 *
 * @param projectRoot - Project root directory
 * @returns Array of session summaries sorted by last_updated (descending)
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
        sessions_count: state.compression_history.length,
      });
    } catch (err) {
      console.warn(
        `Failed to load session state from ${file}: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }
  }

  // Sort by last_updated descending
  return sessions.sort(
    (a, b) =>
      new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
  );
}

/**
 * Migrate old state file format to new anchor-based format
 *
 * Old format had:
 * - newSessionId field pointing to next compressed session
 * - Multiple chained state files (uuid-sigma-timestamp.state.json)
 *
 * New format:
 * - Single state file per anchor
 * - current_session field with real SDK UUID
 * - compression_history array
 *
 * @param anchorId - Anchor ID to migrate
 * @param projectRoot - Project root directory
 * @returns Migrated session state or null if migration fails
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
    const oldState = JSON.parse(content);

    // Check if already in new format
    if ('anchor_id' in oldState && 'compression_history' in oldState) {
      return oldState as SessionState;
    }

    // Migrate old format
    console.log(`🔄 Migrating old state file: ${anchorId}`);

    const compressionHistory: SessionState['compression_history'] = [];

    // Add initial session
    compressionHistory.push({
      sdk_session: anchorId,
      timestamp: oldState.timestamp || new Date().toISOString(),
      reason: 'initial',
    });

    // Follow compression chain if newSessionId exists
    let nextId = oldState.newSessionId;
    let currentState = oldState;
    const filesToDelete: string[] = []; // Track chained files to delete

    while (nextId) {
      compressionHistory.push({
        sdk_session: nextId,
        timestamp: currentState.timestamp || new Date().toISOString(),
        reason: 'compression',
        tokens: currentState.compression?.triggered_at_tokens,
      });

      // Try to load next in chain
      const nextFile = path.join(sigmaDir, `${nextId}.state.json`);
      if (!fs.existsSync(nextFile)) {
        break;
      }

      // Mark this chained file for deletion
      filesToDelete.push(nextFile);

      try {
        const nextContent = fs.readFileSync(nextFile, 'utf-8');
        const nextState = JSON.parse(nextContent);

        currentState = nextState;
        nextId = nextState.newSessionId; // May be undefined in leaf nodes
      } catch (err) {
        console.error(`  ⚠️  Failed to process chain file ${nextId}:`, err);
        break;
      }
    }

    // Delete all chained files after successful migration
    for (const file of filesToDelete) {
      try {
        fs.unlinkSync(file);
        const filename = path.basename(file);
        console.log(`  🗑️  Removed old chained file: ${filename}`);
      } catch (err) {
        console.error(`  ⚠️  Failed to delete ${file}:`, err);
      }
    }

    // Create new state
    // IMPORTANT: Don't use fake chained session IDs as current_session
    // Those are NOT real SDK UUIDs - just use the anchor ID
    const newState: SessionState = {
      anchor_id: anchorId,
      current_session: anchorId, // Use anchor ID, not fake chained ID
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

    // Save migrated state
    saveSessionState(newState, projectRoot);
    console.log(
      `  ✅ Migrated to new format (${compressionHistory.length} sessions)`
    );

    return newState;
  } catch (err) {
    console.error(`Failed to migrate state file ${anchorId}:`, err);
    return null;
  }
}

/**
 * Migrate all old state files in .sigma directory
 *
 * Scans .sigma directory and migrates all old-format state files
 * to the new anchor-based format. Skips already-migrated files and
 * old chained state files.
 *
 * @param projectRoot - Project root directory
 */
export function migrateAllOldStates(projectRoot: string): void {
  const sigmaDir = path.join(projectRoot, '.sigma');

  if (!fs.existsSync(sigmaDir)) {
    return;
  }

  const stateFiles = fs
    .readdirSync(sigmaDir)
    .filter((f) => f.endsWith('.state.json'));

  let migratedCount = 0;

  for (const file of stateFiles) {
    const anchorId = file.replace('.state.json', '');

    // Skip files that look like old chained files (contain -sigma-)
    if (anchorId.includes('-sigma-')) {
      continue;
    }

    const result = migrateOldStateFile(anchorId, projectRoot);
    if (result) {
      migratedCount++;
    }
  }

  if (migratedCount > 0) {
    console.log(
      `\n✅ Migrated ${migratedCount} session(s) to new anchor format\n`
    );
  }
}
