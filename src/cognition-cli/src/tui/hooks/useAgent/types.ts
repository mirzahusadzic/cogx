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
