/**
 * Agent Provider Adapter
 *
 * Bridges the LLM provider abstraction with the TUI's useClaudeAgent hook.
 * Provides a unified interface for agent workflows regardless of underlying provider.
 *
 * This adapter:
 * - Manages provider selection and model configuration
 * - Translates AgentProvider responses to TUI-compatible format
 * - Handles error mapping and logging
 * - Enables provider switching without rewriting TUI code
 *
 * @example
 * ```typescript
 * const adapter = new AgentProviderAdapter({
 *   provider: 'claude',
 *   cwd: process.cwd(),
 *   maxThinkingTokens: 10000
 * });
 *
 * for await (const response of adapter.query("Analyze this code")) {
 *   // response.messages contains conversation history
 *   // response.sessionId is current session ID
 *   systemLog('tui', JSON.stringify(response.messages));
 * }
 * ```
 */

import path from 'path';
import { registry } from '../../../llm/index.js';
import { DELEGATION_PROTOCOL_PROMPT } from '../../../sigma/prompts/delegation-protocol.js';
import { systemLog } from '../../../utils/debug-logger.js';
import type {
  AgentRequest,
  AgentResponse,
} from '../../../llm/agent-provider-interface.js';

type McpSdkServerConfigWithInstance = unknown;

/**
 * Adapter Options
 *
 * Configuration for the agent provider adapter.
 * Maps TUI's useClaudeAgent options to AgentProvider interface.
 */
export interface AgentAdapterOptions {
  /** Provider name (default: 'claude') */
  provider?: string;

  /** Model to use (provider-specific) */
  model?: string;

  /** Operation mode for token optimization */
  mode?: 'solo' | 'full';

  /** Working directory for tool execution */
  cwd: string;

  /** Resume session ID */
  resumeSessionId?: string;

  /** Extended thinking token budget */
  maxThinkingTokens?: number;

  /** Display thinking blocks (default: true) */
  displayThinking?: boolean;

  /** MCP servers */
  mcpServers?: Record<string, McpSdkServerConfigWithInstance>;

  /** Conversation registry for memory recall (optional) */
  conversationRegistry?: unknown;

  /** Workbench URL for API access (optional) */
  workbenchUrl?: string;

  /** Error callback */
  onStderr?: (error: string) => void;

  /** Tool permission callback */
  onCanUseTool?: (
    toolName: string,
    input: unknown
  ) => Promise<{ behavior: 'allow' | 'deny'; updatedInput?: unknown }>;

  /** Background task manager getter (for get_background_tasks tool) */
  getTaskManager?: () => unknown;

  /** Agent message publisher (for send_message/broadcast_message tools) */
  getMessagePublisher?: () => unknown;

  /** Agent message queue (for list_pending_messages/mark_messages_read tools) */
  getMessageQueue?: () => unknown;

  /** Project root directory (for agent discovery) */
  projectRoot?: string;

  /** Current agent ID (for excluding self from listings) */
  agentId?: string;

  /** Session anchor ID (for SigmaTaskUpdate state persistence) */
  anchorId?: string;

  /** Remaining Tokens Per Minute (TPM) budget for dynamic adjustment */
  remainingTPM?: number;

  /** Tool output callback for streaming tool results (e.g. bash) */
  onToolOutput?: (output: string) => void;

  /** Debug mode */
  debug?: boolean;
}

/**
 * Agent Provider Adapter
 *
 * Wraps the AgentProvider interface for use in the TUI.
 * Handles provider selection, error mapping, and message conversion.
 */
export class AgentProviderAdapter {
  private providerName: string;
  private model: string;
  private options: AgentAdapterOptions;
  private provider: import('../../../llm/agent-provider-interface.js').AgentProvider;

  constructor(options: AgentAdapterOptions) {
    this.options = options;
    this.providerName = options.provider || 'claude';

    // Auto-select model if not specified and store provider
    this.provider = registry.getAgent(this.providerName);
    this.model = options.model || this.provider.models[0];
  }

  /**
   * Execute agent query
   *
   * Returns async generator compatible with TUI's message processing.
   * Streams responses from the configured provider.
   *
   * @param prompt - User prompt
   * @returns Async generator of agent responses
   *
   * @example
   * ```typescript
   * for await (const response of adapter.query("Review this code")) {
   *   systemLog('tui', `${response.messages.length} messages`);
   *   systemLog('tui', `Session: ${response.sessionId}`);
   * }
   * ```
   */
  async *query(prompt: string): AsyncGenerator<AgentResponse> {
    const cwd = this.options.cwd || process.cwd();
    const projectRoot = this.options.projectRoot || cwd;
    const projectRootInfo =
      projectRoot !== cwd
        ? `\n\n## Project Root\n${projectRoot}\n(CWD is ${path.relative(projectRoot, cwd)} relative to root)`
        : '';

    const filePathInfo =
      projectRoot !== cwd
        ? `\n\n## File Paths\nNote: You are working in a subdirectory. Tools have been patched to handle git paths automatically.`
        : '';

    const request: AgentRequest = {
      prompt,
      model: this.model,
      mode: this.options.mode,
      cwd: this.options.cwd,
      resumeSessionId: this.options.resumeSessionId,
      maxThinkingTokens: this.options.maxThinkingTokens,
      displayThinking: this.options.displayThinking,
      mcpServers: this.options.mcpServers,
      conversationRegistry: this.options.conversationRegistry,
      workbenchUrl: this.options.workbenchUrl,
      getTaskManager: this.options.getTaskManager,
      getMessagePublisher: this.options.getMessagePublisher,
      getMessageQueue: this.options.getMessageQueue,
      projectRoot: this.options.projectRoot || this.options.cwd,
      agentId: this.options.agentId,
      anchorId: this.options.anchorId,
      remainingTPM: this.options.remainingTPM,
      onStderr: this.options.onStderr,
      onToolOutput: this.options.onToolOutput,
      onCanUseTool: this.options.onCanUseTool,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append:
          (this.providerName === 'claude'
            ? `\n\n# IMPORTANT: Task Management Tool Change\n\n` +
              `The native TodoWrite tool has been DISABLED for this session. ` +
              `Instead, use the **SigmaTaskUpdate** tool for all task management.\n\n` +
              `SigmaTaskUpdate provides enhanced capabilities:\n` +
              `- Stable task IDs (required)\n` +
              `- Manager/Worker delegation pattern\n` +
              `- Task delegation with acceptance_criteria and delegated_to fields\n` +
              `- REQUIRED result_summary (min 15 chars) when status is 'completed'\n` +
              `- Full state persistence across compressions\n\n` +
              `Use SigmaTaskUpdate exactly as you would use TodoWrite, but with the new schema.`
            : '') +
          `\n\n## Working Directory\n${cwd}${projectRootInfo}${filePathInfo}` +
          `\n\n${DELEGATION_PROTOCOL_PROMPT}`,
      },
      includePartialMessages: true,
      // Add grounding requirements from session state if available
      // This is used by the provider to decide whether to run automated PGC queries
      grounding: this.options.anchorId
        ? (async () => {
            const { loadSessionState } =
              await import('../../../sigma/session-state.js');
            const state = loadSessionState(
              this.options.anchorId!,
              this.options.cwd
            );
            const inProgressTask = state?.todos?.find(
              (t) => t.status === 'in_progress'
            );
            return inProgressTask?.grounding;
          })()
        : undefined,
    };

    if (this.options.debug) {
      systemLog('tui', '[AgentAdapter] Query:', {
        provider: this.providerName,
        model: this.model,
        prompt: prompt.substring(0, 100) + '...',
      });
    }

    // Stream responses from provider
    try {
      for await (const response of this.provider.executeAgent(request)) {
        if (this.options.debug) {
          systemLog('tui', '[AgentAdapter] Response:', {
            messageCount: response.messages.length,
            sessionId: response.sessionId,
            tokens: response.tokens.total,
          });
        }
        yield response;
      }
    } catch (error) {
      // Map provider errors to TUI-friendly format
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (this.options.debug) {
        systemLog(
          'tui',
          `[AgentAdapter] Error: ${errorMsg}`,
          undefined,
          'error'
        );
      }

      // Call stderr callback if provided
      if (this.options.onStderr) {
        this.options.onStderr(errorMsg);
      }

      throw error;
    }
  }

  /**
   * Get current provider name
   *
   * @returns Provider name (e.g., 'claude', 'openai')
   */
  getProviderName(): string {
    return this.providerName;
  }

  /**
   * Get current model
   *
   * @returns Model identifier
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Interrupt the current agent execution
   *
   * Sends an interrupt signal to the underlying provider to stop execution.
   * Only works if the provider supports interrupts.
   *
   * @returns Promise that resolves when interrupt is sent
   *
   * @example
   * ```typescript
   * const adapter = new AgentProviderAdapter({ cwd: process.cwd() });
   * const queryPromise = adapter.query("Long running task");
   *
   * // Later, interrupt execution
   * await adapter.interrupt();
   * ```
   */
  async interrupt(): Promise<void> {
    if (this.provider.interrupt) {
      await this.provider.interrupt();
    }
  }

  /**
   * Create adapter with different provider
   *
   * Factory method for switching providers.
   *
   * @param providerName - Provider to use
   * @param options - Adapter options
   * @returns New adapter instance
   *
   * @example
   * ```typescript
   * const openaiAdapter = AgentProviderAdapter.withProvider('openai', {
   *   cwd: process.cwd(),
   *   model: 'gpt-4-turbo'
   * });
   * ```
   */
  static withProvider(
    providerName: string,
    options: AgentAdapterOptions
  ): AgentProviderAdapter {
    return new AgentProviderAdapter({
      ...options,
      provider: providerName,
    });
  }
}
