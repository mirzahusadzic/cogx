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
 *   console.log(response.messages);
 * }
 * ```
 */

import { registry } from '../../../llm/index.js';
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

  /** Agent message queue (for get_pending_messages/mark_messages_read tools) */
  getMessageQueue?: () => unknown;

  /** Project root directory (for agent discovery) */
  projectRoot?: string;

  /** Current agent ID (for excluding self from listings) */
  agentId?: string;

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
   *   console.log(response.messages.length, "messages");
   *   console.log("Session:", response.sessionId);
   * }
   * ```
   */
  async *query(prompt: string): AsyncGenerator<AgentResponse> {
    const request: AgentRequest = {
      prompt,
      model: this.model,
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
      onStderr: this.options.onStderr,
      onCanUseTool: this.options.onCanUseTool,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
      },
      includePartialMessages: true,
    };

    if (this.options.debug) {
      console.log('[AgentAdapter] Query:', {
        provider: this.providerName,
        model: this.model,
        prompt: prompt.substring(0, 100) + '...',
      });
    }

    // Stream responses from provider
    try {
      for await (const response of this.provider.executeAgent(request)) {
        if (this.options.debug) {
          console.log('[AgentAdapter] Response:', {
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
        console.error('[AgentAdapter] Error:', errorMsg);
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
