/**
 * Agent Provider Interface
 *
 * Extends the base LLMProvider interface with agent-specific capabilities:
 * - Multi-turn session management
 * - Tool calling support
 * - MCP server integration
 * - Extended thinking mode
 *
 * This interface enables the TUI to work with different LLM providers while
 * maintaining full feature parity with the Claude Agent SDK.
 *
 * @example
 * ```typescript
 * const provider = registry.getAgent('claude');
 *
 * for await (const response of provider.executeAgent({
 *   prompt: "Analyze this codebase",
 *   model: "claude-sonnet-4-5-20250929",
 *   cwd: process.cwd(),
 *   maxThinkingTokens: 10000
 * })) {
 *   systemLog('agent', 'Response messages:', response.messages);
 * }
 * ```
 */

import type { LLMProvider } from './provider-interface.js';
import type { GroundingInstructions } from '../ipc/DelegationProtocol.js';
type McpSdkServerConfigWithInstance = unknown; // Placeholder for optional Claude SDK

/**
 * Agent-specific request options
 *
 * Extends basic completion with agent SDK features like session management,
 * tool calling, MCP integration, and extended thinking.
 */
export interface AgentRequest {
  /** User prompt */
  prompt: string;

  /** Model identifier */
  model: string;

  /** Working directory for tool execution */
  cwd?: string;

  /** Resume session ID (undefined = fresh session) */
  resumeSessionId?: string;

  /** System prompt configuration */
  systemPrompt?: {
    type: 'preset' | 'custom';
    preset?: string; // e.g., 'claude_code'
    custom?: string;
    append?: string; // Additional instructions to append to preset (Claude SDK)
  };

  /** Extended thinking token budget */
  maxThinkingTokens?: number;

  /** Display thinking blocks (default: true) */
  displayThinking?: boolean;

  /** MCP server configurations */
  mcpServers?: Record<string, McpSdkServerConfigWithInstance>;

  /** Conversation registry for memory recall (optional) */
  conversationRegistry?: unknown; // ConversationOverlayRegistry - avoid circular dependency

  /** Workbench URL for API access (optional) */
  workbenchUrl?: string;

  /** Tool use permission callback */
  onCanUseTool?: (
    toolName: string,
    input: unknown
  ) => Promise<{ behavior: 'allow' | 'deny'; updatedInput?: unknown }>;

  /** Background task manager getter (for get_background_tasks tool) */
  getTaskManager?: () => unknown; // BackgroundTaskManager - avoid circular dependency

  /** Agent message publisher (for send_message/broadcast_message tools) */
  getMessagePublisher?: () => unknown; // MessagePublisher - avoid circular dependency

  /** Agent message queue (for list_pending_messages/mark_messages_read tools) */
  getMessageQueue?: () => unknown; // MessageQueue - avoid circular dependency

  /** Project root directory (for agent discovery) */
  projectRoot?: string;

  /** Current agent ID (for excluding self from listings) */
  agentId?: string;

  /** Session anchor ID (for SigmaTaskUpdate state persistence) */
  anchorId?: string;

  /** Remaining Tokens Per Minute (TPM) budget for dynamic adjustment */
  remainingTPM?: number;

  /** Error callback */
  onStderr?: (error: string) => void;

  /** Enable streaming (partial messages) */
  includePartialMessages?: boolean;

  /** Optional grounding instructions (v2.0 protocol) */
  grounding?:
    | GroundingInstructions
    | Promise<GroundingInstructions | undefined>;

  /** Additional options */
  maxTokens?: number;
  temperature?: number;
}

/**
 * Agent message content block
 */
export interface AgentContent {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking';
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
  is_error?: boolean;
}

/**
 * Agent message
 *
 * Represents a single message in the conversation (user, assistant, tool, etc.)
 */
export interface AgentMessage {
  id: string;
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'thinking';
  role?: 'user' | 'assistant';
  content: string | AgentContent[];
  timestamp: Date;
  thinking?: string; // Extended thinking content
  toolName?: string; // Tool name for tool_use/tool_result messages
  toolInput?: unknown; // Tool input arguments
}

/**
 * Agent response
 *
 * Complete snapshot of conversation state at a point in time.
 * Yielded from executeAgent() async generator.
 */
export interface AgentResponse {
  /** All messages in the conversation so far */
  messages: AgentMessage[];

  /** Current session ID (new or resumed) */
  sessionId: string;

  /** Token usage */
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };

  /** Finish reason */
  finishReason: 'stop' | 'length' | 'tool_use' | 'error';

  /** Number of turns (agent reasoning cycles) */
  numTurns: number;

  /** Tool result information (if this response contains a tool result) */
  toolResult?: {
    name: string;
    response: unknown;
  };
}

/**
 * Agent Provider Interface
 *
 * Extends LLMProvider with agent-specific capabilities required by the TUI:
 * - Multi-turn session management
 * - Tool calling support
 * - MCP server integration
 * - Extended thinking mode
 *
 * Providers that implement this interface can be used for agent workflows
 * like the TUI, which require complex interaction patterns beyond simple completions.
 */
export interface AgentProvider extends LLMProvider {
  /**
   * Execute agent query with full agent SDK features
   *
   * Returns async generator for streaming message updates.
   * Each yielded value is a complete snapshot of the conversation state.
   *
   * @example
   * ```typescript
   * const provider = registry.getAgent('claude');
   *
   * for await (const response of provider.executeAgent({
   *   prompt: "Review this code",
   *   model: "claude-sonnet-4-5-20250929",
   *   cwd: process.cwd(),
   *   resumeSessionId: "session-123"
   * })) {
   *   // response.messages contains all messages so far
   *   // Last message may be partial (streaming)
   *   const lastMsg = response.messages[response.messages.length - 1];
   *   systemLog('agent', 'Last message:', lastMsg);
   * }
   * ```
   *
   * @param request - Agent request with session, tools, MCP config
   * @returns Async generator of conversation snapshots
   */
  executeAgent(
    request: AgentRequest
  ): AsyncGenerator<AgentResponse, void, undefined>;

  /**
   * Check if provider supports agent workflows
   *
   * Some providers may only support basic completions.
   * This method allows runtime capability checking.
   *
   * @returns True if provider supports agent mode
   */
  supportsAgentMode(): boolean;

  /**
   * Interrupt the current agent execution
   *
   * Sends an interrupt signal to stop the agent mid-execution.
   * Optional - providers that don't support interrupts can omit this.
   *
   * @returns Promise that resolves when interrupt is sent
   *
   * @example
   * ```typescript
   * const provider = registry.getAgent('claude');
   * const queryPromise = provider.executeAgent(request);
   *
   * // Later, interrupt execution
   * await provider.interrupt();
   * ```
   */
  interrupt?(): Promise<void>;
}

/**
 * Type guard to check if provider supports agent workflows
 *
 * @example
 * ```typescript
 * const provider = registry.get('gemini');
 *
 * if (isAgentProvider(provider)) {
 *   // Can use executeAgent()
 *   await provider.executeAgent(request);
 * } else {
 *   // Only basic completions
 *   await provider.complete(request);
 * }
 * ```
 */
export function isAgentProvider(
  provider: LLMProvider
): provider is AgentProvider {
  return (
    'executeAgent' in provider &&
    typeof (provider as AgentProvider).executeAgent === 'function' &&
    typeof (provider as AgentProvider).supportsAgentMode === 'function' &&
    (provider as AgentProvider).supportsAgentMode()
  );
}
