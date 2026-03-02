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

import { systemLog } from '../../../utils/debug-logger.js';
import OpenAI from 'openai';
import { Agent, run, setDefaultOpenAIClient, tool } from '@openai/agents';
import {
  OpenAIResponsesModel,
  OpenAIConversationsSession,
} from '@openai/agents-openai';
import {
  archiveTaskLogs,
  TASK_LOG_EVICTION_THRESHOLD,
} from '../eviction-utils.js';

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
 * Event from raw model stream
 */
interface RawModelStreamEvent {
  type: 'raw_model_stream_event';
  data: {
    type: string;
    event?: {
      type: string;
      delta?: string;
    };
    delta?: string;
  };
}

/**
 * Event from run items
 */
interface RunItemStreamEvent {
  type: 'run_item_stream_event';
  name: string;
  item: {
    type: string;
    rawItem?: {
      name?: string;
      arguments?: string;
    };
    output?: unknown;
  };
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

import type { AgentRequest } from '../../agent-provider-interface.js';
import type {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '../../provider-interface.js';

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

interface ConversationItemToolCall {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
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
  tool_calls?: ConversationItemToolCall[];
  tool_call_id?: string;
}

import { BaseAgentProvider } from '../base-agent-provider.js';
import { UnifiedStreamingChunk } from '../../types.js';
import { ThinkingBudget } from '../thinking-utils.js';

/**
 * OpenAI Agent Provider
 *
 * Implements AgentProvider using @openai/agents SDK.
 * Works with both OpenAI API and OpenAI-compatible endpoints.
 */
export class OpenAIAgentProvider extends BaseAgentProvider {
  name = 'openai';
  models: string[] = Object.values(OPENAI_MODELS);

  private client: OpenAI;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private baseUrl: string | undefined;
  private apiKey: string;
  private isLocalEndpoint: boolean = false;
  private isWorkbenchConfigured: boolean = false;

  constructor(options: OpenAIAgentProviderOptions = {}) {
    super();
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
    // Fallback: 200k for official OpenAI (GPT-4o has 128k, but o1 has much more), 4K for unknown local endpoints
    const defaultFallback = this.isLocalEndpoint ? 4096 : 200000;
    this.defaultMaxTokens =
      options.maxTokens ||
      (process.env.COGNITION_OPENAI_MAX_TOKENS
        ? parseInt(process.env.COGNITION_OPENAI_MAX_TOKENS, 10)
        : defaultFallback);

    // Set as default client for the SDK
    setDefaultOpenAIClient(this.client);

    // Wrap responses.create to support cache_control for persistent caching
    // This allows utilizing persistent caching on both official OpenAI (via prompt_cache_retention)
    // and OpenAI-compatible endpoints like eGemma (via cache_control on items)
    const originalCreate = this.client.responses.create.bind(
      this.client.responses
    );
    // @ts-expect-error - modifying SDK object to inject caching parameters
    this.client.responses.create = async (
      params: Record<string, unknown>,
      options: unknown
    ) => {
      // 1. Mark system prompt with cache_control
      // If provided as top-level instructions, move to input array to support per-item cache_control
      if (params.instructions && typeof params.instructions === 'string') {
        const systemPrompt = params.instructions;
        delete params.instructions;

        const systemItem = {
          role: 'system',
          content: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'persistent' },
            },
          ],
        };

        if (params.input && Array.isArray(params.input)) {
          params.input.unshift(systemItem);
        } else if (typeof params.input === 'string') {
          params.input = [systemItem, { role: 'user', content: params.input }];
        } else {
          params.input = [systemItem];
        }
      } else if (params.input && Array.isArray(params.input)) {
        // If already in input array, inject cache_control into system messages
        const input = params.input as Array<{
          role?: string;
          content?:
            | string
            | Array<{
                type?: string;
                text?: string;
                input_text?: string;
                cache_control?: unknown;
              }>;
        }>;
        for (const item of input) {
          if (item.role === 'system') {
            if (Array.isArray(item.content)) {
              for (const content of item.content) {
                if (content.type === 'text' || content.type === 'input_text') {
                  content.cache_control = { type: 'persistent' };
                }
              }
            } else if (typeof item.content === 'string') {
              item.content = [
                {
                  type: 'text',
                  text: item.content,
                  cache_control: { type: 'persistent' },
                },
              ];
            }
          }
        }
      }

      // 2. Mark all tools with cache_control
      if (params.tools && Array.isArray(params.tools)) {
        params.tools = (params.tools as Array<Record<string, unknown>>).map(
          (tool) => ({
            ...tool,
            cache_control: { type: 'persistent' },
          })
        );
      }

      // 3. Enable standard OpenAI Extended Prompt Caching (24h retention)
      params.prompt_cache_retention = '24h';

      return originalCreate(
        params as Parameters<typeof originalCreate>[0],
        options as Parameters<typeof originalCreate>[1]
      );
    };

    systemLog(
      'openai',
      'Initialized OpenAI Agent Provider',
      {
        baseUrl: this.baseUrl,
        model: this.defaultModel,
        isLocal: this.isLocalEndpoint,
        isWorkbench: this.isWorkbenchConfigured,
      },
      'debug'
    );
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

    systemLog('openai', 'Creating new conversation', { url }, 'debug');

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getConversationHeaders(true),
    });

    if (!response.ok) {
      systemLog(
        'openai',
        'Failed to create conversation',
        { status: response.status },
        'error'
      );
      throw new Error(`Failed to create conversation: ${response.status}`);
    }

    const data = (await response.json()) as ConversationResponse;
    systemLog(
      'openai',
      'Created conversation',
      { conversationId: data.id },
      'debug'
    );
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

    systemLog('openai', 'Retrieving conversation', { conversationId }, 'debug');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (response.status === 404) {
      systemLog(
        'openai',
        'Conversation not found',
        { conversationId },
        'debug'
      );
      return null;
    }

    if (!response.ok) {
      systemLog(
        'openai',
        'Failed to get conversation',
        { conversationId, status: response.status },
        'error'
      );
      throw new Error(`Failed to get conversation: ${response.status}`);
    }

    const data = (await response.json()) as ConversationResponse;
    systemLog(
      'openai',
      'Retrieved conversation',
      { conversationId: data.id },
      'debug'
    );
    return data;
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

    systemLog(
      'openai',
      'Retrieving conversation items',
      { conversationId, limit, order },
      'debug'
    );

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      systemLog(
        'openai',
        'Failed to get conversation items',
        { conversationId, status: response.status },
        'error'
      );
      throw new Error(`Failed to get conversation items: ${response.status}`);
    }

    const data = (await response.json()) as {
      data: ConversationItemResponse[];
    };
    systemLog(
      'openai',
      'Retrieved conversation items',
      { conversationId, count: data.data.length },
      'debug'
    );
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
      tool_calls?: ConversationItemToolCall[];
      tool_call_id?: string;
    }>
  ): Promise<ConversationItemResponse[]> {
    const url = `${this.getConversationsBaseUrl()}/conversations/${conversationId}/items`;

    systemLog(
      'openai',
      'Adding items to conversation',
      { conversationId, count: items.length },
      'debug'
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      systemLog(
        'openai',
        'Failed to add conversation items',
        { conversationId, status: response.status },
        'error'
      );
      throw new Error(`Failed to add conversation items: ${response.status}`);
    }

    const data = (await response.json()) as {
      data: ConversationItemResponse[];
    };
    systemLog(
      'openai',
      'Added items to conversation',
      { conversationId, count: data.data.length },
      'debug'
    );
    return data.data;
  }

  /**
   * Delete an item (message) from a conversation
   * @param conversationId Conversation ID
   * @param itemId Item ID to delete
   */
  private async deleteConversationItem(
    conversationId: string,
    itemId: string
  ): Promise<void> {
    const url = `${this.getConversationsBaseUrl()}/conversations/${conversationId}/items/${itemId}`;

    systemLog(
      'openai',
      'Deleting conversation item',
      { conversationId, itemId },
      'debug'
    );

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getConversationHeaders(),
    });

    if (!response.ok) {
      systemLog(
        'openai',
        'Failed to delete conversation item',
        { conversationId, itemId, status: response.status },
        'error'
      );
      throw new Error(`Failed to delete conversation item: ${response.status}`);
    }

    systemLog(
      'openai',
      'Deleted conversation item',
      { conversationId, itemId },
      'debug'
    );
  }

  /**
   * Rolling prune for in-progress tasks (OpenAI).
   * Maintains a ring buffer of tool outputs in the conversation history.
   */
  private async rollingPruneTaskLogs(
    taskId: string,
    conversationId: string,
    projectRoot: string,
    threshold: number = TASK_LOG_EVICTION_THRESHOLD
  ) {
    try {
      const items = await this.getConversationItems(conversationId);
      if (!items || items.length === 0) return;

      const tag = `<!-- sigma-task: ${taskId} -->`;
      const taggedItems: ConversationItemResponse[] = [];

      for (const item of items) {
        if (item.content?.includes(tag)) {
          taggedItems.push(item);
        }
      }

      if (taggedItems.length <= threshold) return;

      const toPruneCount = taggedItems.length - threshold;
      const itemsToPrune = taggedItems.slice(0, toPruneCount);
      const evictedLogs: string[] = [];

      for (const item of itemsToPrune) {
        evictedLogs.push(JSON.stringify(item, null, 2));
        try {
          await this.deleteConversationItem(conversationId, item.id);
        } catch (err) {
          systemLog(
            'openai',
            'Failed to delete item during rolling prune',
            { itemId: item.id, error: String(err) },
            'warn'
          );
        }
      }

      await archiveTaskLogs({
        projectRoot,
        sessionId: conversationId,
        taskId,
        evictedLogs,
      });

      systemLog(
        'sigma',
        `Rolling prune: Evicted ${toPruneCount} oldest tool logs for task ${taskId} (threshold: ${threshold}) (OpenAI).`
      );
    } catch (err) {
      systemLog(
        'sigma',
        `Failed rolling prune for task ${taskId} (OpenAI)`,
        { error: err instanceof Error ? err.message : String(err) },
        'error'
      );
    }
  }

  /**
   * Prune tool logs for a completed task and archive them.
   */
  private async pruneTaskLogs(
    taskId: string,
    result_summary: string | null | undefined,
    conversationId: string,
    projectRoot: string
  ) {
    try {
      const items = await this.getConversationItems(conversationId);
      if (!items || items.length === 0) return;

      const tag = `<!-- sigma-task: ${taskId} -->`;
      const evictedLogs: string[] = [];
      let evictedCount = 0;

      // Pass 0: Identify task range (from 'in_progress' to 'completed')
      let startIndex = -1;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.role === 'assistant' && Array.isArray(item.tool_calls)) {
          const hasInProgress = item.tool_calls.some(
            (tool: { function?: { name?: string; arguments?: string } }) => {
              if (tool.function?.name === 'SigmaTaskUpdate') {
                try {
                  const input = JSON.parse(tool.function.arguments || '{}') as {
                    todos?: Array<{ id: string; status: string }>;
                  };
                  return input.todos?.some(
                    (t) => t.id === taskId && t.status === 'in_progress'
                  );
                } catch {
                  return false;
                }
              }
              return false;
            }
          );
          if (hasInProgress) {
            startIndex = i;
          }
        }
      }

      const isTurnInRange = (index: number) => {
        if (startIndex === -1 || index <= startIndex) return false;
        const item = items[index];
        if (item.role === 'user') return false;
        if (item.role === 'assistant' && Array.isArray(item.tool_calls)) {
          const hasTaskCompleted = item.tool_calls.some(
            (tool: { function?: { name?: string; arguments?: string } }) => {
              if (tool.function?.name === 'SigmaTaskUpdate') {
                try {
                  const input = JSON.parse(tool.function.arguments || '{}') as {
                    todos?: Array<{ id: string; status: string }>;
                  };
                  return input.todos?.some(
                    (t) => t.id === taskId && t.status === 'completed'
                  );
                } catch {
                  return false;
                }
              }
              return false;
            }
          );
          if (hasTaskCompleted) return false;
        }
        return true;
      };

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.content?.includes(tag) || isTurnInRange(i)) {
          evictedLogs.push(JSON.stringify(item, null, 2));
          evictedCount++;

          // Delete from server-side session
          try {
            await this.deleteConversationItem(conversationId, item.id);
          } catch (err) {
            systemLog(
              'openai',
              'Failed to delete item from server session',
              { itemId: item.id, error: String(err) },
              'warn'
            );
          }
        }
      }

      if (evictedCount > 0) {
        await archiveTaskLogs({
          projectRoot,
          sessionId: conversationId,
          taskId,
          evictedLogs,
          result_summary,
        });

        systemLog(
          'sigma',
          `Evicted ${evictedCount} log messages (Turn-Range + Surgical) for task ${taskId} (OpenAI). ${process.env.DEBUG_ARCHIVE ? 'Archived to disk.' : ''}`
        );
      } else {
        systemLog(
          'sigma',
          `No logs found for eviction for task ${taskId} (OpenAI). (items=${items.length}, startIndex=${startIndex})`,
          { taskId, conversationId, startIndex },
          'warn'
        );
      }
    } catch (err) {
      systemLog(
        'sigma',
        `Failed to prune task logs for ${taskId} (OpenAI)`,
        { error: err instanceof Error ? err.message : String(err) },
        'error'
      );
    }
  }

  // =========================================================================
  // AgentProvider Interface
  // =========================================================================

  /**
   * Check if provider supports agent mode
   */
  // --- BaseAgentProvider Implementation ---

  supportsAgentMode(): boolean {
    return true;
  }

  protected async prepareSessionId(request: AgentRequest): Promise<string> {
    if (request.resumeSessionId) {
      const existing = await this.getConversation(request.resumeSessionId);
      if (existing) return existing.id;
    }
    return await this.createConversation();
  }

  async *internalStream(
    request: AgentRequest,
    context: {
      sessionId: string;
      groundingContext: string;
      thinkingBudget: ThinkingBudget;
      systemPrompt: string;
    }
  ): AsyncGenerator<UnifiedStreamingChunk, void, undefined> {
    const modelId = request.model || this.defaultModel;
    const { sessionId, systemPrompt, thinkingBudget } = context;

    systemLog(
      'openai',
      'Executing agent query (refactored)',
      {
        model: modelId,
        promptLength: request.prompt.length,
        sessionId,
      },
      'debug'
    );

    // Build tools array
    const tools = this.buildTools(
      request,
      'openai',
      async (taskId: string, result_summary?: string | null) => {
        await this.pruneTaskLogs(
          taskId,
          result_summary,
          sessionId,
          request.cwd || request.projectRoot || process.cwd()
        );
      }
    ) as ReturnType<typeof tool>[];

    // Use Responses API for all endpoints
    const modelImpl = new OpenAIResponsesModel(this.client, modelId);

    // Create agent
    const agent = new Agent({
      name: this.name,
      model: modelImpl,
      instructions: systemPrompt,
      tools,
      modelSettings: {
        temperature: 1.0,
        reasoning: {
          effort: thinkingBudget.reasoningEffort,
        },
      },
    });

    // Create session for conversation continuity
    const session = new OpenAIConversationsSession({
      conversationId: sessionId,
      client: this.client,
    });

    // Run agent with streaming
    const streamedResult = await run(agent, request.prompt, {
      stream: true,
      signal: this.abortController?.signal,
      maxTurns: 30,
      session,
    });

    // Track output for conversation storage and fallback
    let accumulatedOutput = '';
    let hasAssistantMessages = false;

    // Process streaming events
    for await (const event of streamedResult) {
      if (this.abortController?.signal.aborted) break;

      // Handle raw model stream events for text and thinking deltas
      if (event.type === 'raw_model_stream_event') {
        const rawEvent = event as unknown as RawModelStreamEvent;

        // Process reasoning/thinking deltas
        if (
          rawEvent.data.type === 'model' &&
          rawEvent.data.event?.type === 'response.reasoning_text.delta' &&
          rawEvent.data.event.delta
        ) {
          yield {
            type: 'thinking',
            thought: rawEvent.data.event.delta,
          };
        }

        // Process output text deltas
        if (rawEvent.data.type === 'output_text_delta' && rawEvent.data.delta) {
          accumulatedOutput += rawEvent.data.delta;
          hasAssistantMessages = true;
          yield {
            type: 'text',
            delta: rawEvent.data.delta,
          };
        }
      }

      if (event.type === 'run_item_stream_event') {
        const itemEvent = event as unknown as RunItemStreamEvent;

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

          yield {
            type: 'tool_call',
            toolCall: {
              name: toolName,
              args: toolInput,
            },
          };
        }

        // Handle tool outputs
        if (
          itemEvent.name === 'tool_output' &&
          itemEvent.item.type === 'tool_call_output_item'
        ) {
          const toolOutput =
            typeof itemEvent.item.output === 'string'
              ? itemEvent.item.output
              : JSON.stringify(itemEvent.item.output);

          // Find the tool name from the last tool_use message
          const lastToolUse = [...this.messages]
            .reverse()
            .find((m) => m.type === 'tool_use');

          yield {
            type: 'tool_response',
            toolResponse: {
              name: lastToolUse?.toolName || 'unknown',
              response: toolOutput,
            },
          };
        }
      }

      // Handle streaming text deltas (response.output_text.delta events)
      const eventUnknown = event as unknown;
      if (isResponseDeltaEvent(eventUnknown)) {
        if (eventUnknown.type === 'response.output_text.delta') {
          accumulatedOutput += eventUnknown.delta || '';
          hasAssistantMessages = true;
          yield {
            type: 'text',
            delta: eventUnknown.delta,
          };
        } else if (eventUnknown.type === 'response.reasoning_text.delta') {
          yield {
            type: 'thinking',
            thought: eventUnknown.delta,
          };
        }
      }
    }

    // After the loop, if we didn't get any text, use finalOutput as fallback
    const finalOutput =
      (streamedResult as unknown as { finalOutput?: string }).finalOutput ||
      accumulatedOutput;

    if (!hasAssistantMessages && finalOutput) {
      yield {
        type: 'text',
        delta: finalOutput,
      };
      accumulatedOutput = finalOutput;
    }

    // Store messages in conversation (for session persistence)
    try {
      await this.addConversationItems(sessionId, [
        { role: 'user', content: request.prompt },
        { role: 'assistant', content: accumulatedOutput },
      ]);
    } catch (err) {
      // Non-fatal, silently ignore in TUI context
      systemLog(
        'openai',
        'Failed to add conversation items',
        { error: String(err) },
        'debug'
      );
    }

    // Yield final usage from SDK run state
    const modelResponses = (
      streamedResult as unknown as {
        state?: {
          _modelResponses?: {
            usage?: { inputTokens?: number; outputTokens?: number };
          }[];
        };
      }
    ).state?._modelResponses;
    if (modelResponses && Array.isArray(modelResponses)) {
      let promptCount = 0;
      let completionCount = 0;
      for (const modelResponse of modelResponses) {
        if (modelResponse.usage) {
          promptCount += modelResponse.usage.inputTokens || 0;
          completionCount += modelResponse.usage.outputTokens || 0;
        }
      }
      if (promptCount > 0 || completionCount > 0) {
        yield {
          type: 'usage',
          usage: {
            prompt: promptCount,
            completion: completionCount,
            total: promptCount + completionCount,
          },
        };
      }
    }
  }

  /**
   * Finalize the session and cleanup
   */
  public async cleanup(): Promise<void> {
    // No-op for now as sessionService.clear() does not exist in the current ADK version
  }

  // ========================================
  // LLMProvider Interface (Required stub)
  // ========================================

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    throw new Error(
      `OpenAI Agent provider does not support complete(). Use executeAgent() instead. (Requested model: ${request.model})`
    );
  }

  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    // eslint-disable-next-line no-constant-condition
    if (false) yield {} as StreamChunk; // Satisfy require-yield
    throw new Error(
      `Use executeAgent() for OpenAI Agent provider (model: ${request.model})`
    );
  }

  /**
   * Check if OpenAI API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try a simple models list call
      await this.client.models.list();
      systemLog('openai', 'OpenAI API is available', undefined, 'debug');
      return true;
    } catch (error) {
      systemLog(
        'openai',
        'OpenAI API check failed',
        { error: String(error) },
        'debug'
      );
      // If we have a custom base URL, check if it's reachable
      if (process.env.OPENAI_BASE_URL) {
        try {
          const response = await fetch(`${process.env.OPENAI_BASE_URL}/models`);
          const ok = response.ok;
          systemLog(
            'openai',
            'Custom base URL availability check',
            { url: process.env.OPENAI_BASE_URL, ok },
            'debug'
          );
          return ok;
        } catch (fetchError) {
          systemLog(
            'openai',
            'Custom base URL fetch failed',
            { error: String(fetchError) },
            'debug'
          );
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
  estimateCost(
    tokens: {
      prompt: number;
      completion: number;
      total: number;
      cached?: number;
    },
    model: string
  ): number {
    // Validation for NaN - return 0 if invalid
    if (
      isNaN(tokens.prompt) ||
      isNaN(tokens.completion) ||
      (tokens.cached !== undefined && isNaN(tokens.cached))
    ) {
      return 0;
    }

    const inputMtokens = tokens.prompt / 1000000;
    const outputMtokens = tokens.completion / 1000000;

    if (model.includes('mini')) {
      return inputMtokens * 0.15 + outputMtokens * 0.6;
    }

    // Default to GPT-4o pricing
    return inputMtokens * 2.5 + outputMtokens * 10;
  }
}
