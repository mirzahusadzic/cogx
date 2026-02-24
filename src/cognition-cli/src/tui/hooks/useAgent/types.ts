import type { MessagePublisher } from '../../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../../ipc/MessageQueue.js';
import type { WorkbenchHealthResult } from '../../../utils/workbench-detect.js';
/**
 * Configuration options for Agent integration (Claude, Gemini, etc.)
 */
export interface UseAgentOptions {
  /**
   * User-provided session ID (from CLI --session-id flag)
   * If not provided, auto-generates timestamp-based ID
   */
  sessionId?: string;

  /**
   * Current working directory for .sigma/ state files
   */
  cwd: string;

  /**
   * Token threshold for automatic context compression
   * @default 80000
   */
  sessionTokens?: number;

  /**
   * Token threshold for semantic compression (task completion)
   * @default 50000 (Gemini)
   */
  semanticThreshold?: number;

  /**
   * Maximum tokens for extended thinking (experimental)
   * Enables Claude to think longer on complex problems
   */
  maxThinkingTokens?: number;

  /**
   * Display thinking blocks in the TUI
   * @default true
   */
  displayThinking?: boolean;

  /**
   * Enable debug logging to console and tui-debug.log
   * @default false
   */
  debug?: boolean;

  /**
   * LLM provider to use (default: 'claude')
   * @default 'claude'
   */
  provider?: string;

  /**
   * Model to use (provider-specific)
   * If not specified, uses provider's default model
   */
  model?: string;

  /**
   * Solo mode (disables IPC and PGC tools to save tokens)
   */
  solo?: boolean;

  /**
   * Tool confirmation callback (for guardrails)
   * Called before executing each tool to request user permission
   * @returns Promise resolving to 'allow' or 'deny'
   */
  onRequestToolConfirmation?: (
    toolName: string,
    input: unknown
  ) => Promise<'allow' | 'deny'>;

  /**
   * Background task manager getter (for get_background_tasks tool)
   * Optional - if provided, enables the get_background_tasks tool
   */
  getTaskManager?: () => unknown;

  /**
   * Message publisher getter (for agent-to-agent messaging tool)
   * Optional - if provided, enables the send_agent_message and list_agents tools
   */
  getMessagePublisher?: () => MessagePublisher | null;

  /**
   * Message queue getter (for agent-to-agent messaging tool to read messages)
   * Optional - if provided, enables the list_pending_messages and mark_message_read tools
   */
  getMessageQueue?: () => MessageQueue | null;

  /**
   * Auto-respond to agent messages without user input
   * When true, triggers a turn automatically when messages arrive
   * @default true
   */
  autoResponse?: boolean;

  /**
   * Pre-computed workbench health result
   * If provided, skips redundant health check on startup
   */
  initialWorkbenchHealth?: WorkbenchHealthResult | null;
}

/**
 * Message object displayed in conversation UI
 */
export interface TUIMessage {
  /** Message role */
  type: 'user' | 'assistant' | 'system' | 'tool_progress' | 'thinking';

  /** Message text content */
  content: string;

  /** When message was created */
  timestamp: Date;
}

/**
 * Task from SigmaTaskUpdate tool
 */
export interface SigmaTask {
  id: string;
  content: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delegated';
  acceptance_criteria?: string[];
  delegated_to?: string;
  context?: string;
  delegate_session_id?: string;
  result_summary?: string;
  /** Tokens at start of task */
  tokensAtStart?: number;
  /** Total tokens used for this task across context windows */
  tokensUsed?: number;
  /** Tokens saved (cached) for this task */
  tokensSaved?: number;
  /** Tokens accumulated from previous context windows */
  tokensAccumulated?: number;
  /** Saved tokens accumulated from previous context windows */
  tokensSavedAccumulated?: number;
  /** Saved tokens at start of task */
  tokensSavedAtStart?: number;
}

/**
 * Grounding configuration for a task
 */
export interface SigmaGrounding {
  id: string;
  strategy: 'none' | 'pgc_first' | 'pgc_verify' | 'pgc_cite';
  overlay_hints?: ('O2' | 'O4' | 'O5' | 'O6' | 'O1' | 'O3' | 'O7')[];
  query_hints?: string[];
  evidence_required?: boolean;
}

/**
 * Structured grounding evidence returned by the worker
 */
export interface SigmaGroundingEvidence {
  id: string;
  queries_executed?: string[];
  overlays_consulted?: ('O2' | 'O4' | 'O5' | 'O6' | 'O1' | 'O3' | 'O7')[];
  citations?: {
    overlay: string;
    content: string;
    relevance: 'low' | 'medium' | 'high';
    file_path?: string;
  }[];
  grounding_confidence?: 'low' | 'medium' | 'high';
  overlay_warnings?: string[] | null;
}

/**
 * Full task state for the TUI
 */
export interface SigmaTasks {
  todos: SigmaTask[];
  grounding?: SigmaGrounding[];
  grounding_evidence?: SigmaGroundingEvidence[];
}
