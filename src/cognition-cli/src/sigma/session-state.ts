/**
 * Session State Management
 *
 * Manages the mapping between user-facing anchor IDs and the actual
 * SDK session UUIDs that may change over time due to compression or
 * session expiration.
 */

import fs from 'fs';
import path from 'path';
import { systemLog } from '../utils/debug-logger.js';
import { SYSTEM_PROMPT_MAX_COMPLETED_TASKS } from '../config.js';

/**
 * Sigma task item in session state
 */
export interface SigmaTask {
  /** Unique stable identifier for this task (e.g., nanoid or semantic slug) */
  id: string;
  /** Imperative form: "Fix ruff errors in src/api.py" */
  content: string;
  /** Present continuous form: "Fixing ruff errors in src/api.py" */
  activeForm: string;
  /** Task status */
  status: 'pending' | 'in_progress' | 'completed' | 'delegated';

  // Delegation fields (for Manager/Worker paradigm)
  /** Success criteria for task completion (e.g., ["Must pass 'npm test'"]) */
  acceptance_criteria?: string[];
  /** Agent ID this task was delegated to (e.g., "flash1") */
  delegated_to?: string;
  /** Additional context for delegated worker */
  context?: string;
  /** Worker's session ID (for audit trail) */
  delegate_session_id?: string;
  /** Worker's completion report */
  result_summary?: string;

  /** Tokens at start of task (TUI-internal) */
  tokensAtStart?: number;
  /** Total tokens used for this task across context windows (TUI-internal) */
  tokensUsed?: number;
  /** Tokens accumulated from previous context windows (TUI-internal) */
  tokensAccumulated?: number;

  /** Grounding requirements for the task */
  grounding?: {
    /**
     * Strategy for how worker should approach the task
     * - "pgc_first": Query PGC before any code changes
     * - "pgc_verify": Use PGC to verify proposed changes
     * - "pgc_cite": Must cite PGC sources in response
     * - "none": Free-form (legacy behavior)
     */
    strategy: 'pgc_first' | 'pgc_verify' | 'pgc_cite' | 'none';

    /**
     * Hints about which overlays are most relevant
     * Helps worker focus lattice queries
     */
    overlay_hints?: Array<'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'>;

    /**
     * Semantic query hints for the worker's PGC
     * Worker should run these queries before acting
     */
    query_hints?: string[];

    /**
     * Whether response must include evidence citations
     */
    evidence_required?: boolean;
  };
  /**
   * Structured grounding evidence returned by the worker
   * Stores the actual citations and confidence scores
   */
  grounding_evidence?: {
    queries_executed: string[];
    overlays_consulted: Array<'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'>;
    citations: Array<{
      overlay: string;
      content: string;
      relevance: string;
      file_path?: string;
    }>;
    grounding_confidence: 'high' | 'medium' | 'low';
    overlay_warnings?: string[];
  };
}

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

  /** Model used for this session (e.g., 'claude-sonnet-4-5-20250514', 'gemini-3-pro-preview') */
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

  /** Cumulative session token usage (persists across restarts) */
  cumulative_tokens?: {
    input: number;
    output: number;
    total: number;
    cost_usd?: number;
  };

  /** Active task list for this session (for providers without native SigmaTaskUpdate) */
  todos?: SigmaTask[];
}

/**
 * Migrate tasks from old format (without id) to new format (with id)
 *
 * Ensures backward compatibility with session files created before
 * the id field was required for delegation support.
 *
 * @param tasks - Array of tasks that may be missing id fields
 * @returns Migrated tasks with guaranteed id fields
 */
function migrateTasks(
  tasks: Array<{
    id?: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'delegated';
    activeForm: string;
    acceptance_criteria?: string[];
    delegated_to?: string;
    context?: string;
    delegate_session_id?: string;
    result_summary?: string;
    tokensAtStart?: number;
    tokensUsed?: number;
    tokensAccumulated?: number;
    grounding?: {
      strategy: 'pgc_first' | 'pgc_verify' | 'pgc_cite' | 'none';
      overlay_hints?: Array<'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'>;
      query_hints?: string[];
      evidence_required?: boolean;
    };
    /**
     * Structured grounding evidence returned by the worker
     * Stores the actual citations and confidence scores
     */
    grounding_evidence?: {
      queries_executed: string[];
      overlays_consulted: Array<'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'>;
      citations: Array<{
        overlay: string;
        content: string;
        relevance: string;
        file_path?: string;
      }>;
      grounding_confidence: 'high' | 'medium' | 'low';
      overlay_warnings?: string[];
    };
  }>
): Array<{
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delegated';
  activeForm: string;
  acceptance_criteria?: string[];
  delegated_to?: string;
  context?: string;
  delegate_session_id?: string;
  result_summary?: string;
  grounding?: {
    strategy: 'pgc_first' | 'pgc_verify' | 'pgc_cite' | 'none';
    overlay_hints?: Array<'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'>;
    query_hints?: string[];
    evidence_required?: boolean;
  };
  grounding_evidence?: {
    queries_executed: string[];
    overlays_consulted: Array<'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'>;
    citations: Array<{
      overlay: string;
      content: string;
      relevance: string;
      file_path?: string;
    }>;
    grounding_confidence: 'high' | 'medium' | 'low';
    overlay_warnings?: string[];
  };
}> {
  return tasks.map((task, idx) => {
    if (!task.id) {
      // Generate stable ID from content hash or index
      // Use timestamp to ensure uniqueness across migrations
      const id = `migrated-${idx}-${Date.now()}`;
      systemLog(
        'sigma',
        'Migrating task without ID',
        { content: task.content, id },
        'warn'
      );
      return { ...task, id };
    }
    return task as typeof task & { id: string };
  });
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
    const state = JSON.parse(content) as SessionState;

    // Migrate tasks without id field (backward compatibility)
    if (state.todos && state.todos.length > 0) {
      const hasMissingIds = state.todos.some((t) => !t.id);
      if (hasMissingIds) {
        state.todos = migrateTasks(state.todos);
        // Save migrated state back to disk
        saveSessionState(state, projectRoot);
      }
    }

    return state;
  } catch (err) {
    systemLog(
      'sigma',
      `Failed to load session state for ${anchorId}`,
      { error: err instanceof Error ? err.message : String(err) },
      'error'
    );
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
 * Used by providers without native SigmaTaskUpdate (e.g., Gemini, OpenAI)
 * to persist task list in the session state file.
 *
 * @param state - Current session state
 * @param todos - Updated task list
 * @returns Updated session state with new todos
 */
export function updateSessionTasks(
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
 * @param todos - Updated task list
 * @returns Success message or error
 */
export function updateTasksByAnchorId(
  anchorId: string,
  projectRoot: string,
  todos: SessionState['todos']
): string {
  const state = loadSessionState(anchorId, projectRoot);

  if (!state) {
    // No state file yet - can't persist todos without session
    return `Warning: No session state found for ${anchorId}. Todos not persisted.`;
  }

  const updated = updateSessionTasks(state, todos);
  saveSessionState(updated, projectRoot);

  // Format summary for tool response
  const summary = (todos || [])
    .map((t) => {
      const icon =
        t.status === 'completed'
          ? '✓'
          : t.status === 'in_progress'
            ? '→'
            : t.status === 'delegated'
              ? '⇨'
              : '○';
      const text = t.status === 'in_progress' ? t.activeForm : t.content;
      const suffix =
        t.status === 'delegated' && t.delegated_to
          ? ` (→ ${t.delegated_to})`
          : '';
      return `[${icon}] ${text}${suffix}`;
    })
    .join('\n');

  return `Task list updated (${(todos || []).length} items):\n${summary}`;
}

/**
 * Get the currently active Sigma task for a session
 *
 * @param anchorId - Session anchor ID
 * @param projectRoot - Project root directory
 * @returns Active task object or null
 */
/**
 * Formats a concise context of the task list for the system prompt.
 * This ensures the model sees the result_summary of completed tasks even after logs are evicted.
 */
export function getTaskContextForPrompt(
  anchorId: string,
  projectRoot: string
): string {
  const state = loadSessionState(anchorId, projectRoot);
  if (!state || !state.todos || state.todos.length === 0) {
    return '[No active task]';
  }

  const activeTask = state.todos.find((t) => t.status === 'in_progress');
  const completedTasks = state.todos
    .filter((t) => t.status === 'completed')
    .slice(-SYSTEM_PROMPT_MAX_COMPLETED_TASKS); // Get last N completed tasks

  let prompt = '';

  if (activeTask) {
    prompt += `📋 CURRENT ACTIVE TASK\n[${activeTask.id}] ${activeTask.content}\nStatus: ${activeTask.activeForm}...\n\n`;
  } else {
    prompt += `📋 NO ACTIVE TASK (You must start one before using other tools)\n\n`;
  }

  if (completedTasks.length > 0) {
    prompt += `✅ RECENTLY COMPLETED TASKS (Essential Findings):\n`;
    completedTasks.forEach((t) => {
      prompt += `- [${t.id}] ${t.content}\n  Summary: ${t.result_summary || 'No summary provided.'}\n`;
    });
    prompt += `\n(Use these summaries to recall details that were evicted from your context window)\n`;
  }

  return prompt.trim();
}

export function getActiveTask(
  anchorId: string,
  projectRoot: string
): SigmaTask | null {
  const state = loadSessionState(anchorId, projectRoot);
  if (!state || !state.todos) return null;

  const activeTask = state.todos.find((t) => t.status === 'in_progress');
  return activeTask || null;
}

/**
 * Get the currently active Sigma task ID for a session
 *
 * @param anchorId - Session anchor ID
 * @param projectRoot - Project root directory
 * @returns Active task ID or null
 */
export function getActiveTaskId(
  anchorId: string,
  projectRoot: string
): string | null {
  const state = loadSessionState(anchorId, projectRoot);
  if (!state || !state.todos) return null;

  const activeTask = state.todos.find((t) => t.status === 'in_progress');
  return activeTask ? activeTask.id : null;
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
      systemLog(
        'sigma',
        `Failed to load session state from ${file}`,
        { error: err instanceof Error ? err.message : String(err) },
        'warn'
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
    systemLog('sigma', `Migrating old state file: ${anchorId}`);

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
        systemLog(
          'sigma',
          `Failed to process chain file ${nextId}`,
          { error: err instanceof Error ? err.message : String(err) },
          'error'
        );
        break;
      }
    }

    // Delete all chained files after successful migration
    for (const file of filesToDelete) {
      try {
        fs.unlinkSync(file);
        const filename = path.basename(file);
        systemLog('sigma', `Removed old chained file: ${filename}`);
      } catch (err) {
        systemLog(
          'sigma',
          `Failed to delete ${file}`,
          { error: err instanceof Error ? err.message : String(err) },
          'error'
        );
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
    systemLog(
      'sigma',
      `Migrated to new format (${compressionHistory.length} sessions)`
    );

    return newState;
  } catch (err) {
    systemLog(
      'sigma',
      `Failed to migrate state file ${anchorId}`,
      { error: err instanceof Error ? err.message : String(err) },
      'error'
    );
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
    systemLog(
      'sigma',
      `Migrated ${migratedCount} session(s) to new anchor format`
    );
  }
}
