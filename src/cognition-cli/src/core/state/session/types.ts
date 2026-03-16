/**
 * Session State Machine Types
 */

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

  /** Model used for this session (e.g., 'claude-sonnet-4-5-20250514', 'gemini-3.1-pro-preview') */
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
 * Valid session lifecycle states
 */
export enum SessionStatus {
  /** Session is being created or loaded from disk */
  INITIALIZING = 'INITIALIZING',
  /** Session is ready and awaiting user input */
  ACTIVE = 'ACTIVE',
  /** Agent is currently executing a task */
  TASK_PROCESSING = 'TASK_PROCESSING',
  /** Session is undergoing memory pruning/eviction */
  PRUNING = 'PRUNING',
  /** Session state is being saved to disk */
  PERSISTING = 'PERSISTING',
  /** Session has been closed */
  TERMINATED = 'TERMINATED',
  /** An error occurred during session lifecycle */
  ERROR = 'ERROR',
}

/**
 * Events that trigger state transitions
 */
export type SessionEvent =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; state: SessionState }
  | { type: 'LOAD_FAILURE'; error: Error }
  | { type: 'TASK_START'; taskId: string }
  | { type: 'TASK_COMPLETE'; taskId: string; summary: string }
  | { type: 'TASK_FAIL'; taskId: string; error: Error }
  | { type: 'PRUNE_START' }
  | { type: 'PRUNE_COMPLETE' }
  | { type: 'PERSIST_START' }
  | { type: 'PERSIST_SUCCESS' }
  | { type: 'PERSIST_FAILURE'; error: Error }
  | { type: 'TERMINATE' };

/**
 * State machine transition listener
 */
export type SessionStateListener = (
  status: SessionStatus,
  state: SessionState | null,
  error?: Error
) => void;
