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
import { getGroundingContext } from '../grounding-utils.js';
import { getActiveTaskId } from '../../../sigma/session-state.js';
import { buildSystemPrompt } from '../system-prompt.js';
import OpenAI from 'openai';
import { Agent, run, setDefaultOpenAIClient } from '@openai/agents';
import {
  OpenAIResponsesModel,
  OpenAIConversationsSession,
} from '@openai/agents-openai';
import { getOpenAITools } from './agent-tools.js';
import {
  archiveTaskLogs,
  TASK_LOG_EVICTION_THRESHOLD,
} from '../eviction-utils.js';
import { getDynamicThinkingBudget } from '../thinking-utils.js';
import type { ConversationOverlayRegistry } from '../../../sigma/conversation-registry.js';
import type { BackgroundTaskManager } from '../../../tui/services/BackgroundTaskManager.js';
import type { MessagePublisher } from '../../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../../ipc/MessageQueue.js';

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
} from '../../agent-provider-interface.js';
import type {
  CompletionRequest,
  CompletionResponse,
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
  // =========================================================================
  // AgentProvider Interface
  // =========================================================================
  async *executeAgent(
    request: AgentRequest
  ): AsyncGenerator<AgentResponse, void, undefined> {
    const modelId = request.model || this.defaultModel;

    systemLog(
      'openai',
      'Executing agent query',
      {
        model: modelId,
        promptLength: request.prompt.length,
        resumeSessionId: request.resumeSessionId,
      },
      'debug'
    );

    // Create abort controller for cancellation (local to avoid race conditions)
    const abortController = new AbortController();
    this.abortController = abortController; // Also store for interrupt() method

    const messages: AgentMessage[] = [];
    let conversationId: string = 'pending';
    let numTurns = 0;

    // Initial estimates
    let totalPromptTokens = Math.ceil(request.prompt.length / 4);
    let totalCompletionTokens = 0;
    let currentTurnOutputEstimate = 0;

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

      systemLog('openai', 'Using conversation ID', { conversationId }, 'debug');

      // Yield initial state after conversation is ready
      yield {
        messages: [...messages],
        sessionId: conversationId,
        tokens: { prompt: 0, completion: 0, total: 0 },
        numTurns: 0,
      };

      // Handle automated grounding queries if requested
      const groundingContext = await getGroundingContext(request);
      if (groundingContext) {
        systemLog(
          'openai',
          'Injected grounding context',
          { length: groundingContext.length },
          'debug'
        );
      }

      // Build tools array
      const tools = this.buildTools(
        request,
        async (taskId: string, result_summary?: string | null) => {
          await this.pruneTaskLogs(
            taskId,
            result_summary,
            conversationId,
            request.cwd || request.projectRoot || process.cwd()
          );
        }
      );
      systemLog('openai', 'Built tools', { count: tools.length }, 'debug');

      // Use Responses API for all endpoints (primary API for Agents SDK)
      // Works with both OpenAI and OpenAI-compatible endpoints like eGemma
      const modelImpl = new OpenAIResponsesModel(this.client, modelId);

      // Dynamic Thinking Budgeting:
      const { reasoningEffort } = getDynamicThinkingBudget(
        request.remainingTPM
      );

      // Create agent
      const agent = new Agent({
        name: 'cognition_agent',
        model: modelImpl,
        instructions:
          buildSystemPrompt(request, modelId, 'OpenAI Agents SDK') +
          (groundingContext
            ? `\n\n## Automated Grounding Context\n${groundingContext}`
            : ''),
        tools,
        modelSettings: {
          temperature: 1.0,
          reasoning: {
            effort: reasoningEffort,
          },
        },
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
      systemLog('openai', 'Starting agent run', { model: modelId }, 'debug');
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
        if (process.env.DEBUG_OPENAI_STREAM) {
          systemLog(
            'openai',
            `Processing event: ${event.type}`,
            undefined,
            'debug'
          );
        }
        // Check for abort at start of each iteration
        if (abortController.signal.aborted) {
          systemLog(
            'openai',
            'Abort signal detected, exiting loop',
            undefined,
            'debug'
          );
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
            currentTurnOutputEstimate += Math.ceil(
              rawEvent.data.event.delta.length / 4
            );

            // Yield intermediate state with thinking delta
            yield {
              messages: [...messages],
              sessionId: conversationId,
              tokens: {
                prompt: totalPromptTokens,
                completion: totalCompletionTokens + currentTurnOutputEstimate,
                total:
                  totalPromptTokens +
                  totalCompletionTokens +
                  currentTurnOutputEstimate,
              },
              numTurns,
            };
          }

          // Process output text deltas for streaming
          if (
            rawEvent.data.type === 'output_text_delta' &&
            rawEvent.data.delta
          ) {
            outputText += rawEvent.data.delta;
            currentTurnOutputEstimate += Math.ceil(
              rawEvent.data.delta.length / 4
            );

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
                completion: totalCompletionTokens + currentTurnOutputEstimate,
                total:
                  totalPromptTokens +
                  totalCompletionTokens +
                  currentTurnOutputEstimate,
              },
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

            systemLog(
              'openai',
              `Tool call detected: ${toolName}`,
              { toolName },
              'debug'
            );

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
                completion: totalCompletionTokens + currentTurnOutputEstimate,
                total:
                  totalPromptTokens +
                  totalCompletionTokens +
                  currentTurnOutputEstimate,
              },
              finishReason: 'tool_use',
              numTurns,
            };

            // After tool call, current turn's output is part of "total"
            totalCompletionTokens += currentTurnOutputEstimate;
            currentTurnOutputEstimate = 0;
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

            systemLog(
              'openai',
              `Tool output received: ${lastToolUse?.toolName}`,
              {
                toolName: lastToolUse?.toolName,
                outputLength: toolOutput.length,
              },
              'debug'
            );

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
                completion: totalCompletionTokens + currentTurnOutputEstimate,
                total:
                  totalPromptTokens +
                  totalCompletionTokens +
                  currentTurnOutputEstimate,
              },
              finishReason: 'tool_use',
              numTurns,
            };

            // After tool result, prompt tokens will increase (handled by estimation later)
            // For now just keep totals consistent
            totalCompletionTokens += currentTurnOutputEstimate;
            currentTurnOutputEstimate = 0;
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
                completion: totalCompletionTokens + currentTurnOutputEstimate,
                total:
                  totalPromptTokens +
                  totalCompletionTokens +
                  currentTurnOutputEstimate,
              },
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
                completion: totalCompletionTokens + currentTurnOutputEstimate,
                total:
                  totalPromptTokens +
                  totalCompletionTokens +
                  currentTurnOutputEstimate,
              },
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
      } catch (err) {
        // Non-fatal: silently ignore - don't log to console in TUI context
        // (console output corrupts Ink-based TUI layout)
        systemLog(
          'openai',
          'Failed to add conversation items',
          { error: String(err) },
          'debug'
        );
      }

      // Extract actual token counts from SDK (not estimation!)
      // The StreamedRunResult.state contains ModelResponse[] with usage data
      if (streamedResult.state?._modelResponses) {
        totalPromptTokens = 0;
        totalCompletionTokens = 0;
        for (const response of streamedResult.state._modelResponses) {
          if (response.usage) {
            // Prompt tokens represents the current context size (from the latest turn)
            totalPromptTokens += response.usage.inputTokens || 0;
            // Completion tokens are cumulative for all turns in the request
            totalCompletionTokens += response.usage.outputTokens || 0;
          }
        }
      }

      // Fallback to estimation if no usage data available
      if (totalPromptTokens === 0 && totalCompletionTokens === 0) {
        totalPromptTokens = Math.ceil(request.prompt.length / 4);
        totalCompletionTokens = Math.ceil(output.length / 4);
      }

      systemLog(
        'openai',
        'Agent run completed',
        {
          tokens: {
            prompt: totalPromptTokens,
            completion: totalCompletionTokens,
          },
          turns: numTurns,
          wasAborted,
        },
        'debug'
      );

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

      systemLog(
        'openai',
        'Agent execution failed',
        { error: errorMessage, name: errorName },
        'error'
      );

      // Check for abort (AbortError, user cancellation, or signal already aborted)
      if (
        errorName === 'AbortError' ||
        errorMessage.includes('abort') ||
        errorMessage.includes('cancel') ||
        abortController.signal.aborted
      ) {
        systemLog('openai', 'Request aborted by user', undefined, 'debug');
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
   * Uses the comprehensive tool set from agent-tools.ts which includes:
   * - Core: read_file, write_file, glob, grep, bash, edit_file
   * - Memory: recall_past_conversation
   * - Background: get_background_tasks
   * - IPC: list_agents, send_agent_message, broadcast_agent_message,
   *        list_pending_messages, mark_message_read
   */
  private buildTools(
    request: AgentRequest,
    onTaskCompleted?: (
      taskId: string,
      result_summary?: string | null
    ) => Promise<void>
  ) {
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
      onToolOutput: request.onToolOutput,
      onTaskCompleted,
      getActiveTaskId: () =>
        request.anchorId
          ? getActiveTaskId(
              request.anchorId,
              request.cwd || request.projectRoot || process.cwd()
            )
          : null,
      mode: request.mode,
    });
  }

  /**
   * Build system prompt for the agent
   */

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
