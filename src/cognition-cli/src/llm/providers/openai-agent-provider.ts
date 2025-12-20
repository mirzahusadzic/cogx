/**
 * OpenAI Agent Provider Implementation
 *
 * Implements AgentProvider using the @openai/agents SDK.
 * Supports OpenAI API and OpenAI-compatible endpoints (eGemma, etc.).
 *
 * KEY FEATURES:
 * - Uses OpenAIChatCompletionsModel for Chat Completions API compatibility
 * - Works with local endpoints via OPENAI_BASE_URL
 * - Supports streaming via run() with stream events
 * - Tool execution via @openai/agents tool() function
 * - Server-side conversation management via Conversations API
 *
 * SESSION MANAGEMENT (Conversations API):
 * - Same code path for both eGemma and official OpenAI
 * - POST /v1/conversations → creates conversation
 * - GET /v1/conversations/{id} → retrieve conversation
 * - POST /v1/conversations/{id}/items → add messages
 * - GET /v1/conversations/{id}/items → get history
 *
 * ENVIRONMENT VARIABLES:
 * - OPENAI_API_KEY: API key (required for OpenAI, can be dummy for local)
 * - OPENAI_BASE_URL: Custom endpoint (default: https://api.openai.com/v1)
 * - OPENAI_MODEL: Default model (default: gpt-4o)
 *
 * @example
 * ```typescript
 * // OpenAI API
 * const provider = new OpenAIAgentProvider();
 *
 * // Local eGemma
 * const provider = new OpenAIAgentProvider({
 *   baseUrl: 'http://localhost:8000/v1',
 *   apiKey: 'dummy',
 *   model: 'gpt-oss-20b'
 * });
 *
 * for await (const response of provider.executeAgent({
 *   prompt: 'Hello!',
 *   model: 'gpt-oss-20b',
 *   cwd: process.cwd()
 * })) {
 *   console.log(response.messages);
 * }
 * ```
 */

// Disable OpenAI Agents SDK tracing and logging to prevent console output in TUI
// Must be set BEFORE importing @openai/agents
// The SDK uses both custom env vars AND the debug package
process.env.OPENAI_AGENTS_DISABLE_TRACING = '1';
process.env.OPENAI_AGENTS_DONT_LOG_MODEL_DATA = '1';
process.env.OPENAI_AGENTS_DONT_LOG_TOOL_DATA = '1';
process.env.DEBUG = ''; // Disable debug package output

import OpenAI from 'openai';
import { Agent, run, setDefaultOpenAIClient } from '@openai/agents';
import {
  OpenAIResponsesModel,
  OpenAIConversationsSession,
} from '@openai/agents-openai';
import { getOpenAITools } from './openai-agent-tools.js';
import type { ConversationOverlayRegistry } from '../../sigma/conversation-registry.js';
import type { BackgroundTaskManager } from '../../tui/services/BackgroundTaskManager.js';
import type { MessagePublisher } from '../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../ipc/MessageQueue.js';

/**
 * Extended event types from OpenAI Responses API
 * These are part of the Responses API spec but not fully typed in @openai/agents
 */
interface ResponseDeltaEvent {
  type: 'response.output_text.delta' | 'response.reasoning_text.delta';
  delta?: string;
  item_id?: string;
  response_id?: string;
}

/**
 * Type guard to check if an event is a ResponseDeltaEvent
 */
function isResponseDeltaEvent(event: unknown): event is ResponseDeltaEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'type' in event &&
    (event.type === 'response.output_text.delta' ||
      event.type === 'response.reasoning_text.delta')
  );
}

import type {
  AgentProvider,
  AgentRequest,
  AgentResponse,
  AgentMessage,
} from '../agent-provider-interface.js';
import type {
  CompletionRequest,
  CompletionResponse,
} from '../provider-interface.js';

/**
 * OpenAI Agent Provider configuration options
 */
export interface OpenAIAgentProviderOptions {
  /** API key (defaults to OPENAI_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API (defaults to OPENAI_BASE_URL or OpenAI's API) */
  baseUrl?: string;
  /** Default model (defaults to OPENAI_MODEL or 'gpt-4o') */
  model?: string;
  /** Default max tokens (defaults to COGNITION_OPENAI_MAX_TOKENS or 4096) */
  maxTokens?: number;
}

/**
 * Default OpenAI models
 */
export const OPENAI_MODELS = {
  /** GPT-4o - latest and most capable */
  latest: 'gpt-4o',
  /** GPT-4o mini - fast and cheap */
  fast: 'gpt-4o-mini',
  /** o1 - reasoning model */
  reasoning: 'o1',
  /** o3 - next-gen reasoning */
  reasoningNext: 'o3',
} as const;

/**
 * Local models (OpenAI-compatible)
 */
export const LOCAL_MODELS = {
  /** GPT-OSS 20B - primary development target */
  gptOss20b: 'gpt-oss-20b',
  /** GPT-OSS 120B - larger variant */
  gptOss120b: 'gpt-oss-120b',
} as const;

/**
 * Conversation response from API
 */
interface ConversationResponse {
  id: string;
  object: string;
  created_at: number;
  metadata?: Record<string, unknown>;
}

/**
 * Conversation item from API
 */
interface ConversationItemResponse {
  id: string;
  object: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: number;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

/**
 * OpenAI Agent Provider
 *
 * Implements AgentProvider using @openai/agents SDK.
 * Works with both OpenAI API and OpenAI-compatible endpoints.
 */
export class OpenAIAgentProvider implements AgentProvider {
  name = 'openai';
  models: string[];

  private client: OpenAI;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private abortController: AbortController | null = null;

  // API configuration
  private baseUrl: string | undefined;
  private apiKey: string;
  private isLocalEndpoint: boolean = false;
  private isWorkbenchConfigured: boolean = false;

  constructor(options: OpenAIAgentProviderOptions = {}) {
    this.baseUrl = options.baseUrl || process.env.OPENAI_BASE_URL;

    // Normalize baseURL to always include /v1 suffix for OpenAI API compatibility
    // This ensures both Chat Completions and Conversations API work correctly
    if (this.baseUrl && !this.baseUrl.endsWith('/v1')) {
      this.baseUrl = this.baseUrl.replace(/\/$/, '') + '/v1';
    }

    // For local endpoints, prefer WORKBENCH_API_KEY over dummy key
    const isLocal =
      this.baseUrl &&
      (this.baseUrl.includes('127.0.0.1') ||
        this.baseUrl.includes('localhost'));
    this.apiKey =
      options.apiKey ||
      process.env.OPENAI_API_KEY ||
      (isLocal ? process.env.WORKBENCH_API_KEY : undefined) ||
      'dummy-key-for-local';

    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: true, // Allow running in test environments
    });

    // Check if configured via workbench auto-detection
    this.isWorkbenchConfigured =
      process.env.COGNITION_OPENAI_FROM_WORKBENCH === 'true';

    // Get model from COGNITION_OPENAI_MODEL (set by workbench auto-config) or OPENAI_MODEL
    this.defaultModel =
      options.model ||
      process.env.COGNITION_OPENAI_MODEL ||
      process.env.OPENAI_MODEL ||
      OPENAI_MODELS.latest;

    // Set models list based on configuration source
    // If configured from workbench, only show the workbench model
    // Otherwise show all OpenAI models
    if (this.isWorkbenchConfigured && process.env.COGNITION_OPENAI_MODEL) {
      // Only the workbench-detected model is available
      this.models = [process.env.COGNITION_OPENAI_MODEL];
    } else if (process.env.OPENAI_API_KEY) {
      // Official OpenAI API - show all OpenAI models
      this.models = [
        OPENAI_MODELS.latest,
        OPENAI_MODELS.fast,
        OPENAI_MODELS.reasoning,
      ];
    } else {
      // Local endpoint without workbench auto-config - show local models
      this.models = [LOCAL_MODELS.gptOss20b, LOCAL_MODELS.gptOss120b];
    }

    // Detect if this is a local endpoint (eGemma or similar)
    this.isLocalEndpoint =
      !!this.baseUrl && !this.baseUrl.includes('api.openai.com');

    // Use COGNITION_OPENAI_MAX_TOKENS from workbench auto-config
    // Fallback: 120K for official OpenAI (GPT-4o has 128K), 4K for unknown local endpoints
    const defaultFallback = this.isLocalEndpoint ? 4096 : 120000;
    this.defaultMaxTokens =
      options.maxTokens ||
      (process.env.COGNITION_OPENAI_MAX_TOKENS
        ? parseInt(process.env.COGNITION_OPENAI_MAX_TOKENS, 10)
        : defaultFallback);

    // Set as default client for the SDK
    setDefaultOpenAIClient(this.client);
  }

  // =========================================================================
  // Conversations API Methods
  // =========================================================================

  /**
   * Get the base URL for Conversations API
   * Handles both /v1 suffixed and non-suffixed URLs
   */
  private getConversationsBaseUrl(): string {
    const base = this.baseUrl || 'https://api.openai.com/v1';
    // Ensure we have /v1 suffix for conversations endpoint
    return base.replace(/\/v1\/?$/, '') + '/v1';
  }

  /**
   * Build headers for Conversations API requests
   * Uses WORKBENCH_API_KEY for local endpoints, OPENAI_API_KEY for official OpenAI
   */
  private getConversationHeaders(
    includeContentType = false
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    // Use WORKBENCH_API_KEY for local endpoints, otherwise use the provider's apiKey
    const authKey = this.isLocalEndpoint
      ? process.env.WORKBENCH_API_KEY
      : this.apiKey;

    if (authKey) {
      headers['Authorization'] = `Bearer ${authKey}`;
    }

    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  /**
   * Create a new conversation via Conversations API
   * @returns Conversation ID from server
   */
  private async createConversation(): Promise<string> {
    const url = `${this.getConversationsBaseUrl()}/conversations`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getConversationHeaders(true),
    });

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.status}`);
    }

    const data = (await response.json()) as ConversationResponse;
    return data.id;
  }

  /**
   * Get a conversation by ID
   * @param conversationId Conversation ID to retrieve
   * @returns Conversation data, or null if not found
   */
  private async getConversation(
    conversationId: string
  ): Promise<ConversationResponse | null> {
    const url = `${this.getConversationsBaseUrl()}/conversations/${conversationId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to get conversation: ${response.status}`);
    }

    return (await response.json()) as ConversationResponse;
  }

  /**
   * Get items (messages) from a conversation
   * @param conversationId Conversation ID
   * @param limit Maximum items to return
   * @param order Sort order ('asc' or 'desc')
   */
  private async getConversationItems(
    conversationId: string,
    limit: number = 1000,
    order: 'asc' | 'desc' = 'asc'
  ): Promise<ConversationItemResponse[]> {
    const url = `${this.getConversationsBaseUrl()}/conversations/${conversationId}/items?limit=${limit}&order=${order}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get conversation items: ${response.status}`);
    }

    const data = (await response.json()) as {
      data: ConversationItemResponse[];
    };
    return data.data;
  }

  /**
   * Add items (messages) to a conversation
   * @param conversationId Conversation ID
   * @param items Items to add
   */
  private async addConversationItems(
    conversationId: string,
    items: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      tool_calls?: unknown[];
      tool_call_id?: string;
    }>
  ): Promise<ConversationItemResponse[]> {
    const url = `${this.getConversationsBaseUrl()}/conversations/${conversationId}/items`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add conversation items: ${response.status}`);
    }

    const data = (await response.json()) as {
      data: ConversationItemResponse[];
    };
    return data.data;
  }

  // =========================================================================
  // AgentProvider Interface
  // =========================================================================

  /**
   * Check if provider supports agent mode
   */
  supportsAgentMode(): boolean {
    return true;
  }

  /**
   * Execute agent query with @openai/agents SDK
   *
   * SESSION MANAGEMENT (Conversations API):
   * - Same code path for both eGemma and official OpenAI
   * - resumeSessionId provided → use existing conversation
   * - resumeSessionId undefined → create new conversation
   * - TUI handles compression and recap injection
   */
  async *executeAgent(
    request: AgentRequest
  ): AsyncGenerator<AgentResponse, void, undefined> {
    const modelId = request.model || this.defaultModel;

    // Create abort controller for cancellation (local to avoid race conditions)
    const abortController = new AbortController();
    this.abortController = abortController; // Also store for interrupt() method

    const messages: AgentMessage[] = [];
    let conversationId: string = 'pending';
    let numTurns = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    // Add user message first (always shown even if errors occur)
    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      type: 'user',
      role: 'user',
      content: request.prompt,
      timestamp: new Date(),
    };
    messages.push(userMessage);

    try {
      // Session management via Conversations API
      if (request.resumeSessionId) {
        // Try to resume existing conversation
        const existing = await this.getConversation(request.resumeSessionId);
        if (existing) {
          conversationId = existing.id;
        } else {
          // Conversation not found, create new one
          conversationId = await this.createConversation();
        }
      } else {
        // Fresh conversation (after compression or first query)
        conversationId = await this.createConversation();
      }

      // Yield initial state after conversation is ready
      yield {
        messages: [...messages],
        sessionId: conversationId,
        tokens: { prompt: 0, completion: 0, total: 0 },
        finishReason: 'stop',
        numTurns: 0,
      };

      // Build tools array
      const tools = this.buildTools(request);

      // Use Responses API for all endpoints (primary API for Agents SDK)
      // Works with both OpenAI and OpenAI-compatible endpoints like eGemma
      const modelImpl = new OpenAIResponsesModel(this.client, modelId);

      // Create agent
      const agent = new Agent({
        name: 'cognition_agent',
        model: modelImpl,
        instructions: this.buildSystemPrompt(request),
        tools,
        modelSettings: { temperature: 1.0 },
      });

      // Create session for conversation continuity
      const session = new OpenAIConversationsSession({
        conversationId,
        client: this.client,
      });

      // Suppress SDK console.error AND stderr output during run and finalOutput access
      // The SDK logs errors like "Accessed finalOutput before agent run is completed"
      // when aborted, which leaks to console and causes visual glitches in TUI
      const originalConsoleError = console.error;
      const originalStderrWrite = process.stderr.write.bind(process.stderr);
      console.error = () => {}; // Suppress all console.error during SDK operations
      process.stderr.write = () => true; // Suppress direct stderr writes

      // Run agent with streaming to capture tool events
      const streamedResult = await run(agent, request.prompt, {
        stream: true,
        signal: abortController.signal,
        maxTurns: 30,
        session,
      });

      // Track tool calls for display
      let outputText = '';

      // Process streaming events
      for await (const event of streamedResult) {
        // Check for abort at start of each iteration
        if (abortController.signal.aborted) {
          break;
        }

        // Handle raw model stream events for text and thinking deltas
        if (event.type === 'raw_model_stream_event') {
          const rawEvent = event as {
            data: {
              type: string;
              delta?: string;
              event?: {
                type: string;
                delta?: string;
              };
            };
          };

          // Process reasoning/thinking deltas (BEFORE text deltas for correct order)
          if (
            rawEvent.data.type === 'model' &&
            rawEvent.data.event?.type === 'response.reasoning_text.delta' &&
            rawEvent.data.event.delta
          ) {
            // Create thinking message with delta
            const thinkingMessage: AgentMessage = {
              id: `msg-${Date.now()}-thinking`,
              type: 'thinking',
              role: 'assistant',
              content: rawEvent.data.event.delta,
              timestamp: new Date(),
              thinking: rawEvent.data.event.delta,
            };

            messages.push(thinkingMessage);

            // Yield intermediate state with thinking delta
            yield {
              messages: [...messages],
              sessionId: conversationId,
              tokens: {
                prompt: totalPromptTokens,
                completion: totalCompletionTokens,
                total: totalPromptTokens + totalCompletionTokens,
              },
              finishReason: 'stop',
              numTurns,
            };
          }

          // Process output text deltas for streaming
          if (
            rawEvent.data.type === 'output_text_delta' &&
            rawEvent.data.delta
          ) {
            outputText += rawEvent.data.delta;

            // Create NEW message with JUST the delta (not accumulated text)
            // This matches Claude SDK pattern - TUI handles accumulation
            const deltaMessage: AgentMessage = {
              id: `msg-${Date.now()}-delta`,
              type: 'assistant',
              role: 'assistant',
              content: rawEvent.data.delta, // ← JUST the delta!
              timestamp: new Date(),
            };

            // Push new message for each delta
            messages.push(deltaMessage);

            // Yield intermediate state with new delta message
            yield {
              messages: [...messages],
              sessionId: conversationId,
              tokens: {
                prompt: totalPromptTokens,
                completion: totalCompletionTokens,
                total: totalPromptTokens + totalCompletionTokens,
              },
              finishReason: 'stop',
              numTurns,
            };
          }
        }

        if (event.type === 'run_item_stream_event') {
          const itemEvent = event as {
            name: string;
            item: {
              type: string;
              rawItem?: {
                name?: string;
                arguments?: string;
                call_id?: string;
              };
              output?: string | unknown;
            };
          };

          // Handle tool calls
          if (
            itemEvent.name === 'tool_called' &&
            itemEvent.item.type === 'tool_call_item'
          ) {
            const rawItem = itemEvent.item.rawItem;
            const toolName = rawItem?.name || 'unknown';
            const toolInput = rawItem?.arguments
              ? JSON.parse(rawItem.arguments)
              : {};

            const toolUseMsg: AgentMessage = {
              id: `msg-${Date.now()}-tool-use`,
              type: 'tool_use',
              role: 'assistant',
              content: '',
              timestamp: new Date(),
              toolName,
              toolInput,
            };
            messages.push(toolUseMsg);
            numTurns++;

            // Yield intermediate state with tool use
            yield {
              messages: [...messages],
              sessionId: conversationId,
              tokens: {
                prompt: totalPromptTokens,
                completion: totalCompletionTokens,
                total: totalPromptTokens + totalCompletionTokens,
              },
              finishReason: 'tool_use',
              numTurns,
            };
          }

          // NOTE: Skip reasoning_item_created - we already handled thinking via
          // response.reasoning_text.delta events in the streaming loop above.
          // Processing it here would duplicate the thinking messages.

          // Handle tool outputs
          if (
            itemEvent.name === 'tool_output' &&
            itemEvent.item.type === 'tool_call_output_item'
          ) {
            const toolOutput =
              typeof itemEvent.item.output === 'string'
                ? itemEvent.item.output
                : JSON.stringify(itemEvent.item.output);

            // Get the tool name from the last tool_use message
            const lastToolUse = [...messages]
              .reverse()
              .find((m) => m.type === 'tool_use');

            const toolResultMsg: AgentMessage = {
              id: `msg-${Date.now()}-tool-result`,
              type: 'tool_result',
              role: 'user',
              content: toolOutput,
              timestamp: new Date(),
              toolName: lastToolUse?.toolName,
            };
            messages.push(toolResultMsg);

            // Yield intermediate state with tool result
            yield {
              messages: [...messages],
              sessionId: conversationId,
              tokens: {
                prompt: totalPromptTokens,
                completion: totalCompletionTokens,
                total: totalPromptTokens + totalCompletionTokens,
              },
              finishReason: 'tool_use',
              numTurns,
            };
          }

          // Handle message output (final text)
          if (
            itemEvent.name === 'message_output_created' &&
            itemEvent.item.type === 'message_output_item'
          ) {
            // Extract text from rawItem content
            const rawItem = itemEvent.item.rawItem as {
              content?: Array<{ type: string; text?: string }>;
            };
            if (rawItem?.content) {
              for (const block of rawItem.content) {
                if (block.type === 'output_text' && block.text) {
                  outputText += block.text;
                }
              }
            }
          }
        }

        // Handle streaming text deltas (response.output_text.delta events)
        // Part of OpenAI Responses API spec - sent by both official OpenAI and compatible endpoints
        const eventUnknown = event as unknown;
        if (
          isResponseDeltaEvent(eventUnknown) &&
          eventUnknown.type === 'response.output_text.delta'
        ) {
          const textEvent = eventUnknown as ResponseDeltaEvent;

          if (textEvent.delta) {
            outputText += textEvent.delta;

            // Create or update assistant message with accumulated text
            const assistantMessage: AgentMessage = {
              id: `msg-${Date.now()}-assistant`,
              type: 'assistant',
              role: 'assistant',
              content: outputText,
              timestamp: new Date(),
            };

            // Update last message if it's assistant, otherwise add new
            if (
              messages.length > 0 &&
              messages[messages.length - 1].type === 'assistant'
            ) {
              messages[messages.length - 1] = assistantMessage;
            } else {
              messages.push(assistantMessage);
            }

            // Yield intermediate state with streaming text
            yield {
              messages: [...messages],
              sessionId: conversationId,
              tokens: {
                prompt: totalPromptTokens,
                completion: totalCompletionTokens,
                total: totalPromptTokens + totalCompletionTokens,
              },
              finishReason: 'stop', // Still in progress, but 'stop' is closest match
              numTurns,
            };
          }
        }

        // Handle streaming reasoning deltas (response.reasoning_text.delta events)
        // For models with extended thinking (o1/o3, gpt-oss-20b with reasoning)
        const eventAsAny = event as unknown;
        if (
          isResponseDeltaEvent(eventAsAny) &&
          eventAsAny.type === 'response.reasoning_text.delta'
        ) {
          const reasoningEvent = eventAsAny as ResponseDeltaEvent;
          if (reasoningEvent.delta) {
            // Create or update thinking message
            const thinkingMessage: AgentMessage = {
              id: `msg-${Date.now()}-thinking`,
              type: 'thinking',
              role: 'assistant',
              content: reasoningEvent.delta,
              timestamp: new Date(),
              thinking: reasoningEvent.delta,
            };

            // Update last message if it's thinking, otherwise add new
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.type === 'thinking') {
              messages[messages.length - 1] = {
                ...lastMsg,
                content: (lastMsg.content || '') + reasoningEvent.delta,
                thinking: (lastMsg.thinking || '') + reasoningEvent.delta,
              };
            } else {
              messages.push(thinkingMessage);
            }

            // Yield intermediate state with streaming thinking
            yield {
              messages: [...messages],
              sessionId: conversationId,
              tokens: {
                prompt: totalPromptTokens,
                completion: totalCompletionTokens,
                total: totalPromptTokens + totalCompletionTokens,
              },
              finishReason: 'stop', // Still in progress, but 'stop' is closest match
              numTurns,
            };
          }
        }
      }

      // Get final output from completed result
      // Wrap in try-catch to suppress SDK error when accessing finalOutput after abort
      let finalOutput = outputText || '';
      try {
        finalOutput = outputText || streamedResult.finalOutput || '';
      } catch {
        // Silently ignore SDK error "Accessed finalOutput before agent run is completed"
        // This happens when user aborts (ESC) before completion
      }

      // Restore console.error and stderr after SDK operations complete
      console.error = originalConsoleError;
      process.stderr.write = originalStderrWrite;

      const output =
        typeof finalOutput === 'string'
          ? finalOutput
          : JSON.stringify(finalOutput);

      // Check if request was aborted by user (ESC key)
      const wasAborted = abortController.signal.aborted;

      // Safety: If no assistant messages were yielded during streaming (e.g., abort, error, or SDK failure),
      // add a final message to ensure we have at least one response
      // Skip this if the request was aborted - let the abort complete naturally without adding fallback
      const hasAssistantMessages = messages.some(
        (m) => m.type === 'assistant' || m.type === 'thinking'
      );
      if (!hasAssistantMessages && !wasAborted) {
        // Always push a message if we don't have any, even if output is empty
        const assistantMessage: AgentMessage = {
          id: `msg-${Date.now()}-assistant`,
          type: 'assistant',
          role: 'assistant',
          content: output || '(No response generated)',
          timestamp: new Date(),
        };
        messages.push(assistantMessage);
      }

      // Estimate turns from messages
      numTurns = Math.max(
        1,
        messages.filter((m) => m.type === 'tool_use').length + 1
      );

      // Store messages in conversation (for session persistence)
      try {
        await this.addConversationItems(conversationId, [
          { role: 'user', content: request.prompt },
          { role: 'assistant', content: output },
        ]);
      } catch {
        // Non-fatal: silently ignore - don't log to console in TUI context
        // (console output corrupts Ink-based TUI layout)
      }

      // Extract actual token counts from SDK (not estimation!)
      // The StreamedRunResult.state contains ModelResponse[] with usage data
      if (streamedResult.state?._modelResponses) {
        totalPromptTokens = 0;
        totalCompletionTokens = 0;
        for (const response of streamedResult.state._modelResponses) {
          if (response.usage) {
            totalPromptTokens += response.usage.inputTokens || 0;
            totalCompletionTokens += response.usage.outputTokens || 0;
          }
        }
      }

      // Fallback to estimation if no usage data available
      if (totalPromptTokens === 0 && totalCompletionTokens === 0) {
        totalPromptTokens = Math.ceil(request.prompt.length / 4);
        totalCompletionTokens = Math.ceil(output.length / 4);
      }

      // Yield final response
      yield {
        messages: [...messages],
        sessionId: conversationId,
        tokens: {
          prompt: totalPromptTokens,
          completion: totalCompletionTokens,
          total: totalPromptTokens + totalCompletionTokens,
        },
        finishReason: 'stop',
        numTurns,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : '';

      // Check for abort (AbortError, user cancellation, or signal already aborted)
      if (
        errorName === 'AbortError' ||
        errorMessage.includes('abort') ||
        errorMessage.includes('cancel') ||
        abortController.signal.aborted
      ) {
        yield {
          messages: [...messages],
          sessionId: conversationId,
          tokens: {
            prompt: totalPromptTokens,
            completion: totalCompletionTokens,
            total: totalPromptTokens + totalCompletionTokens,
          },
          finishReason: 'stop',
          numTurns,
        };
        return;
      }

      // Add error message to chat (displayed in UI instead of crashing)
      const errorMsg: AgentMessage = {
        id: `msg-${Date.now()}-error`,
        type: 'assistant',
        role: 'assistant',
        content: `**Error:** ${errorMessage}\n\nPlease check your configuration and try again.`,
        timestamp: new Date(),
      };
      messages.push(errorMsg);

      yield {
        messages: [...messages],
        sessionId: conversationId,
        tokens: {
          prompt: totalPromptTokens,
          completion: totalCompletionTokens,
          total: totalPromptTokens + totalCompletionTokens,
        },
        finishReason: 'error',
        numTurns,
      };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Interrupt current agent execution
   */
  async interrupt(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Build tools for the agent
   *
   * Uses the comprehensive tool set from openai-agent-tools.ts which includes:
   * - Core: read_file, write_file, glob, grep, bash, edit_file
   * - Memory: recall_past_conversation
   * - Background: get_background_tasks
   * - IPC: list_agents, send_agent_message, broadcast_agent_message,
   *        list_pending_messages, mark_message_read
   */
  private buildTools(request: AgentRequest) {
    return getOpenAITools({
      cwd: request.cwd || process.cwd(),
      workbenchUrl: request.workbenchUrl,
      onCanUseTool: request.onCanUseTool,
      conversationRegistry: request.conversationRegistry as
        | ConversationOverlayRegistry
        | undefined,
      getTaskManager: request.getTaskManager as
        | (() => BackgroundTaskManager | null)
        | undefined,
      getMessagePublisher: request.getMessagePublisher as
        | (() => MessagePublisher | null)
        | undefined,
      getMessageQueue: request.getMessageQueue as
        | (() => MessageQueue | null)
        | undefined,
      projectRoot: request.projectRoot,
      agentId: request.agentId,
      anchorId: request.anchorId,
    });
  }

  /**
   * Build system prompt for the agent
   */
  private buildSystemPrompt(request: AgentRequest): string {
    if (
      request.systemPrompt?.type === 'custom' &&
      request.systemPrompt.custom
    ) {
      return request.systemPrompt.custom;
    }

    const modelName = request.model || this.defaultModel;

    // Build available tools section based on what's configured
    const toolSections: string[] = [];

    // Core tools (always available)
    toolSections.push(`### Core File Tools
- **read_file**: Read file contents (use offset/limit for large files)
- **write_file**: Write content to files
- **glob**: Find files matching patterns (e.g., "**/*.ts")
- **grep**: Search code with ripgrep
- **bash**: Execute shell commands (git, npm, etc.)
- **edit_file**: Make targeted text replacements
- **SigmaTaskUpdate**: Update the task list to track progress and maintain state across the session

### Web Tools
- **fetch_url**: Fetch content from URLs (documentation, APIs, external resources)
- **WebSearch**: Search the web for current information`);

    // Memory tool (if conversation registry is available)
    if (request.conversationRegistry) {
      toolSections.push(`### Memory Tools
- **recall_past_conversation**: Retrieve FULL context from conversation history (uses semantic search across O1-O7 overlays)`);
    }

    // Background tasks (if task manager is available)
    if (request.getTaskManager) {
      toolSections.push(`### Background Tasks
- **get_background_tasks**: Query status of genesis, overlay generation, and other background operations`);
    }

    // IPC messaging (if publisher/queue are available)
    if (request.getMessagePublisher && request.getMessageQueue) {
      toolSections.push(`### Agent Messaging (IPC)
- **list_agents**: Discover other active agents in the IPC bus
- **send_agent_message**: Send a message to a specific agent
- **broadcast_agent_message**: Broadcast to ALL agents
- **list_pending_messages**: List messages in your queue (DO NOT poll - system auto-notifies on arrival)
- **mark_message_read**: Mark messages as processed`);
    }

    return `You are **${modelName}** (OpenAI Agents SDK) running inside **Cognition Σ (Sigma) CLI** - a verifiable AI-human symbiosis architecture with dual-lattice knowledge representation.

## What is Cognition Σ?
A portable cognitive layer that can be initialized in **any repository**. Creates \`.sigma/\` (conversation memory) and \`.open_cognition/\` (PGC project knowledge store) in the current working directory.

## Your Capabilities

${toolSections.join('\n\n')}

## Working Directory
${request.cwd || process.cwd()}

## Guidelines
- Be concise and helpful
- Use tools proactively to gather context before answering
- When making changes, explain what you're doing briefly
- Prefer editing existing files over creating new ones
- Run tests after making code changes
- **ALWAYS use the bash tool for shell commands** (git, grep, npm, yarn, system commands, etc.) - never attempt to execute commands without it

## Task Management with SigmaTaskUpdate
You have access to the SigmaTaskUpdate tool to help you manage and plan tasks. Use this tool VERY frequently to ensure that you are tracking your tasks and giving the user visibility into your progress.

### When to Use SigmaTaskUpdate
1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests task list - When the user directly asks you to use the task list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as tasks
6. When you start working on a task - Mark it as in_progress BEFORE beginning work
7. After completing a task - Mark it as completed and add any new follow-up tasks
8. When delegating tasks - Create a task with status 'delegated' before sending the IPC message

### When NOT to Use SigmaTaskUpdate
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

### Examples of Task Management

**Example 1: Multi-step task**
User: "Run the build and fix any type errors"
You should:
1. Use SigmaTaskUpdate to create items: "Run the build", "Fix any type errors"
2. Run the build using bash
3. If you find 10 type errors, use SigmaTaskUpdate to add 10 items for each error
4. Mark the first task as in_progress
5. Work on the first item, then mark it as completed
6. Continue until all items are done

**Example 2: Delegating a task (Manager/Worker Pattern)**
User: "Delegate the database migration to gemini2"
You should:
1. List agents to confirm 'gemini2' exists and get their ID
2. Use SigmaTaskUpdate to create a task:
   - status: "delegated"
   - delegated_to: "gemini2"
   - acceptance_criteria: ["Migration script created", "Tests passed"]
   - content: "Create database migration for new schema"
3. Use send_agent_message to dispatch the task to gemini2
4. Wait for gemini2 to report back via IPC
5. Verify criteria and mark task as completed

### IPC Message Format for Delegation

When delegating via send_agent_message, use this structured format:

**Manager → Worker (Task Assignment):**
\`\`\`json
{
  "type": "task_assignment",
  "task_id": "migrate-db-schema",
  "content": "Create database migration for new user fields",
  "acceptance_criteria": [
    "Migration script created in migrations/",
    "All tests pass",
    "No breaking changes to existing API"
  ],
  "context": "Adding OAuth fields to user table - keep existing auth flow intact"
}
\`\`\`

**Worker → Manager (Task Completion):**
\`\`\`json
{
  "type": "task_completion",
  "task_id": "migrate-db-schema",
  "status": "completed",
  "result_summary": "Created migration 20250120_add_oauth_fields.sql. All 127 tests passing. No API changes required."
}
\`\`\`

**Worker → Manager (Task Blocked):**
\`\`\`json
{
  "type": "task_status",
  "task_id": "migrate-db-schema",
  "status": "blocked",
  "blocker": "Need database credentials for staging environment",
  "requested_action": "Please provide DB_HOST and DB_PASSWORD for staging"
}
\`\`\`

### Task State Rules
1. **pending**: Task not yet started
2. **in_progress**: Currently working on (limit to ONE task at a time)
3. **completed**: Task finished successfully
4. **delegated**: Task assigned to another agent via IPC (Manager/Worker pattern)
5. **Both forms required**: Always provide content (imperative: "Fix bug") AND activeForm (continuous: "Fixing bug")
6. **Immediate completion**: Mark tasks complete IMMEDIATELY after finishing
7. **Honest completion**: ONLY mark completed when FULLY accomplished - if blocked, keep in_progress and add a new task for the blocker
8. **Delegation**: When delegating, include 'delegated_to' and 'acceptance_criteria'. Do not mark completed until worker reports back.

## Token Economy (IMPORTANT - Each tool call costs tokens!)
- **NEVER re-read files you just edited** - you already have the content in context
- **Use glob/grep BEFORE read_file** - find specific content instead of reading entire files
- **Batch operations** - if you need multiple files, plan which ones first, then read them efficiently
- **Use limit/offset for large files** - read only the sections you need`;
  }

  // ========================================
  // LLMProvider Interface (Required stub)
  // ========================================

  /**
   * Basic completion - NOT SUPPORTED
   * OpenAI Agent provider only supports executeAgent() with Agents SDK
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async complete(_request: CompletionRequest): Promise<CompletionResponse> {
    throw new Error(
      'OpenAI Agent provider does not support complete(). Use executeAgent() instead.'
    );
  }

  /**
   * Check if OpenAI API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try a simple models list call
      await this.client.models.list();
      return true;
    } catch {
      // If we have a custom base URL, check if it's reachable
      if (process.env.OPENAI_BASE_URL) {
        try {
          const response = await fetch(`${process.env.OPENAI_BASE_URL}/models`);
          return response.ok;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Estimate cost for token usage
   *
   * Based on OpenAI pricing as of Dec 2024:
   * - GPT-4o: $2.50/$10 per MTok (input/output)
   * - GPT-4o-mini: $0.15/$0.60 per MTok
   */
  estimateCost(tokens: number, model: string): number {
    const mtokens = tokens / 1000000;

    // Estimate 40% input, 60% output
    const inputMtokens = mtokens * 0.4;
    const outputMtokens = mtokens * 0.6;

    if (model.includes('mini')) {
      return inputMtokens * 0.15 + outputMtokens * 0.6;
    }

    // Default to GPT-4o pricing
    return inputMtokens * 2.5 + outputMtokens * 10;
  }
}
