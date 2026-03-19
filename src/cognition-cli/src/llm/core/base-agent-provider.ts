import {
  AgentProvider,
  AgentRequest,
  AgentResponse,
  AgentMessage,
} from './interfaces/agent-provider.js';
import { UnifiedStreamingChunk } from './types.js';
import { systemDiagnosticsService } from '../../core/services/diagnostics/SystemDiagnosticsService.js';

/**
 * Model pricing configuration (cost per 1M tokens)
 */
export interface ModelPricing {
  /** Cost per 1M input tokens (USD) */
  prompt: number;
  /** Cost per 1M output tokens (USD) */
  completion: number;
  /** Cost per 1M cached input tokens (USD, optional) */
  cached?: number;
}
import {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from './interfaces/provider.js';
import { getGroundingContext } from './utils/grounding-utils.js';
import {
  getDynamicThinkingBudget,
  ThinkingBudget,
} from './utils/thinking-utils.js';
import { buildSystemPrompt } from './utils/system-prompt.js';
import {
  getUnifiedTools,
  type UnifiedToolsContext,
  type ProviderType,
} from '../tools/unified-tools.js';
import { getActiveTaskId } from '../../sigma/session-state.js';
import { terminalFormatter } from '../../core/services/terminal-formatter/TerminalFormatterService.js';
import type { BackgroundTaskManager } from '../../tui/services/BackgroundTaskManager.js';
import type { MessagePublisher } from '../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../ipc/MessageQueue.js';
import type { ConversationOverlayRegistry } from '../../sigma/conversation-registry.js';
import { Session } from '@google/adk';

import { AsyncMutex } from '../../sigma/utils/AsyncMutex.js';

/**
 * Base Agent Provider implementation.
 *
 * Provides a common foundation for all agent-capable LLM providers (Gemini, OpenAI, Claude).
 * Implements the Template Method pattern for executeAgent() to reduce boilerplate.
 */
export abstract class BaseAgentProvider implements AgentProvider {
  /** Provider name (e.g., 'gemini', 'openai') */
  abstract name: string;

  /** Available models for this provider */
  abstract models: string[];

  /** Serializes tool execution to prevent interleaved output */
  protected toolMutex = new AsyncMutex();

  /** Cumulative usage across current execution */
  protected usage = {
    prompt: 0,
    completion: 0,
    total: 0,
    cached: 0,
  };

  /** Current message history for the session */
  protected messages: AgentMessage[] = [];

  /** Number of agent reasoning turns completed */
  protected numTurns = 0;

  /** Current retry attempt count */
  protected retryCount = 0;

  /** Current session ID (can be updated by providers) */
  protected sessionId = '';

  /** Abort controller for current request */
  protected abortController: AbortController | null = null;

  // --- LLMProvider methods (to be implemented by concrete classes) ---
  abstract complete(request: CompletionRequest): Promise<CompletionResponse>;
  abstract stream(request: CompletionRequest): AsyncGenerator<StreamChunk>;
  abstract getModelPricing(model: string, promptTokens?: number): ModelPricing;
  abstract getApiKeyEnvVar(): string;

  /**
   * Hook for provider-specific cleanup after surgical log pruning.
   * Useful for server-side conversation item deletion (OpenAI) or session updates (ADK).
   */
  protected abstract onTaskLogsPruned(
    taskId: string,
    resultSummary: string | null | undefined,
    sessionId: string,
    projectRoot: string,
    evictedLogs: string[]
  ): Promise<void>;

  /**
   * Identifies indices of messages to prune for a given task.
   * Handles both Turn-Range (Pass 1) and Surgical Tag (Pass 2) eviction.
   *
   * @param taskId - Task identifier
   * @param items - List of conversation items (events, messages, or API items)
   * @param getTodos - Function to extract SigmaTaskUpdate todos from an item
   * @param hasTag - Function to check if an item contains the surgical eviction tag
   * @param isAssistant - Function to check if an item is an assistant turn
   */
  protected identifyPruningIndices<T>(
    taskId: string,
    items: T[],
    getTodos: (item: T) => Array<{ id: string; status: string }> | null,
    hasTag: (item: T, tag: string) => boolean,
    isAssistant: (item: T) => boolean
  ): {
    startIndex: number;
    endIndex: number;
    lastEvictedIndex: number;
    indicesToPrune: Set<number>;
  } {
    const tag = `<!-- sigma-task: ${taskId} -->`;
    let startIndex = -1;
    let endIndex = items.length - 1;

    // Pass 1: Identify task range (from 'in_progress' to 'completed')
    for (let i = 0; i < items.length; i++) {
      const todos = getTodos(items[i]);
      if (!todos) continue;

      if (
        startIndex === -1 &&
        todos.some((t) => t.id === taskId && t.status === 'in_progress')
      ) {
        startIndex = i;
      } else if (
        startIndex !== -1 &&
        todos.some((t) => t.id === taskId && t.status === 'completed')
      ) {
        endIndex = i;
        break;
      }
    }

    // Pass 2: Find all indices to prune (Surgical Tag + Turn-Range)
    const indicesToPrune = new Set<number>();
    let lastEvictedIndex = -1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const tagged = hasTag(item, tag);
      const assistantInRange =
        startIndex !== -1 &&
        i >= startIndex &&
        i <= endIndex &&
        isAssistant(item);

      if (tagged || assistantInRange) {
        indicesToPrune.add(i);
        lastEvictedIndex = i;
      }
    }

    return { startIndex, endIndex, lastEvictedIndex, indicesToPrune };
  }

  /**
   * Generates tombstone messages for evicted logs.
   */
  protected getTombstones(
    taskId: string,
    resultSummary: string | null | undefined,
    isLast: boolean
  ): { tool: string; assistant: string } {
    const shouldInjectSummary = isLast && !!resultSummary;

    const tool = shouldInjectSummary
      ? `[Task ${taskId} completed. Raw logs evicted to archive. \nSUMMARY: ${resultSummary}]`
      : `[Task ${taskId} completed: output evicted to archive. Use 'grep' on .sigma/archives/ or previous logs if needed.]`;

    const assistant = shouldInjectSummary
      ? `[Assistant thinking/text for task ${taskId} evicted to save tokens. \nSUMMARY: ${resultSummary}]`
      : `[Assistant thinking/text for task ${taskId} evicted to save tokens.]`;

    return { tool, assistant };
  }

  /**
   * Check if the provider is available.
   * Default implementation checks the API key environment variable.
   */
  async isAvailable(): Promise<boolean> {
    const envVar = this.getApiKeyEnvVar();
    return !!process.env[envVar];
  }

  /**
   * Estimate cost for token usage (USD)
   * Centralized implementation for all providers.
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

    const pricing = this.getModelPricing(model, tokens.prompt);
    const cachedTokens = tokens.cached || 0;
    const nonCachedInputMtokens = (tokens.prompt - cachedTokens) / 1000000;
    const cachedInputMtokens = cachedTokens / 1000000;
    const outputMtokens = tokens.completion / 1000000;

    const promptCost = nonCachedInputMtokens * pricing.prompt;
    const completionCost = outputMtokens * pricing.completion;
    const cachedCost =
      pricing.cached !== undefined ? cachedInputMtokens * pricing.cached : 0;

    return promptCost + completionCost + cachedCost;
  }

  // --- AgentProvider methods (to be implemented by concrete classes) ---
  abstract supportsAgentMode(): boolean;

  /**
   * Internal streaming method that concrete classes must implement.
   * This method should yield provider-specific deltas normalized into UnifiedStreamingChunk.
   */
  protected abstract internalStream(
    request: AgentRequest,
    context: {
      sessionId: string;
      groundingContext: string;
      thinkingBudget: ThinkingBudget;
      systemPrompt: string;
    }
  ): AsyncGenerator<UnifiedStreamingChunk, void, undefined>;

  /**
   * Orchestrates the agent execution using the Template Method pattern.
   * Standardizes:
   * 1. Noise suppression (stdout/stderr filtering)
   * 2. Context gathering (Grounding, Thinking Budget, System Prompt)
   * 3. Streaming execution (via internalStream)
   * 4. Usage/Message accumulation
   * 5. Snapshot yielding
   * 6. Error handling and noise restoration
   */
  async *executeAgent(
    request: AgentRequest
  ): AsyncGenerator<AgentResponse, void, undefined> {
    // 1. Suppress SDK noise immediately
    systemDiagnosticsService.suppressNoise();

    try {
      // Initialize per-request state
      this.usage = { prompt: 0, completion: 0, total: 0, cached: 0 };
      this.messages = [];
      this.numTurns = 0;
      this.retryCount = 0;
      this.abortController = new AbortController();

      this.sessionId = await this.prepareSessionId(request);
      const activeModel = request.model || this.models[0];

      // 2. Setup Context (Grounding, Thinking Budget, System Prompt)
      const groundingContext = await this.getGroundingContext(request);
      const thinkingBudget = this.getThinkingBudget(request);
      const systemPrompt = await this.getSystemPrompt(
        request,
        activeModel,
        groundingContext
      );

      // Add initial user message if not resuming
      if (!request.resumeSessionId) {
        this.messages.push({
          id: `msg-${Date.now()}`,
          type: 'user',
          role: 'user',
          content: request.prompt,
          timestamp: new Date(),
        });
      }

      // Yield initial snapshot
      yield {
        messages: this.getTuiMessages(),
        sessionId: this.sessionId,
        tokens: { ...this.usage },
        numTurns: this.numTurns,
        retryCount: this.retryCount,
        activeModel,
      };

      // 3. Start internal stream
      for await (const chunk of this.internalStream(request, {
        sessionId: this.sessionId,
        groundingContext,
        thinkingBudget,
        systemPrompt,
      })) {
        // 4. Update usage and messages based on chunk
        this.processChunk(chunk);

        // Determine finish reason (e.g., tool use)
        const finishReason =
          chunk.type === 'tool_call' ? 'tool_use' : undefined;

        // Prepare tokens (with fallback estimation if needed)
        const tokens = { ...this.usage };
        if (tokens.prompt === 0) {
          tokens.prompt = Math.ceil(request.prompt.length / 4);
          tokens.total = tokens.prompt + tokens.completion;
        }
        if (tokens.completion === 0) {
          // Estimate from last assistant/thinking messages in this turn
          let estimated = 0;
          for (let i = this.messages.length - 1; i >= 0; i--) {
            const m = this.messages[i];
            if (m.type === 'tool_use' || m.type === 'tool_result') break;
            if (m.type === 'assistant' || m.type === 'thinking') {
              estimated += Math.ceil(
                (typeof m.content === 'string' ? m.content.length : 0) / 4
              );
            }
          }
          if (estimated > 0) {
            tokens.completion = estimated;
            tokens.total = tokens.prompt + tokens.completion;
          }
        }

        // Yield snapshot for the TUI
        yield {
          messages: this.getTuiMessages(),
          sessionId: this.sessionId,
          tokens,
          numTurns: this.numTurns,
          retryCount: this.retryCount,
          activeModel,
          finishReason,
          // Handle toolResult if present in chunk
          toolResult:
            chunk.type === 'tool_response' ? chunk.toolResponse : undefined,
        };
      }

      // Yield final snapshot with stop reason if not already yielded by tool_use
      const lastMsg = this.messages[this.messages.length - 1];
      const alreadyYieldedStop = lastMsg?.type === 'tool_use';

      if (!alreadyYieldedStop) {
        // Final token cleanup/fallback
        const tokens = { ...this.usage };
        if (tokens.prompt === 0) {
          tokens.prompt = Math.ceil(request.prompt.length / 4);
          tokens.total = tokens.prompt + tokens.completion;
        }
        if (tokens.completion === 0) {
          // Estimate from last assistant/thinking messages in this turn
          let estimated = 0;
          for (let i = this.messages.length - 1; i >= 0; i--) {
            const m = this.messages[i];
            if (m.type === 'tool_use' || m.type === 'tool_result') break;
            if (m.type === 'assistant' || m.type === 'thinking') {
              estimated += Math.ceil(
                (typeof m.content === 'string' ? m.content.length : 0) / 4
              );
            }
          }
          if (estimated > 0) {
            tokens.completion = estimated;
            tokens.total = tokens.prompt + tokens.completion;
          }
        }

        yield {
          messages: this.getTuiMessages(),
          sessionId: this.sessionId,
          tokens,
          numTurns: this.numTurns,
          retryCount: this.retryCount,
          activeModel,
          finishReason: 'stop',
        };
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorName = err instanceof Error ? err.name : '';

      if (
        (err instanceof Error && err.name === 'AbortError') ||
        errorName === 'AbortError' ||
        errorMessage.includes('abort') ||
        errorMessage.includes('cancel')
      ) {
        systemDiagnosticsService.systemLog(
          this.name,
          'Agent execution aborted or cancelled'
        );
        // Still yield final state on abort/cancel
        yield {
          messages: this.getTuiMessages(),
          sessionId: request.resumeSessionId || this.sessionId || 'abort',
          tokens: { ...this.usage },
          numTurns: this.numTurns,
          retryCount: this.retryCount,
          activeModel: request.model || this.models[0],
          finishReason: 'stop', // Abort/cancel is treated as stop
        };
      } else {
        systemDiagnosticsService.systemLog(
          this.name,
          `Agent execution failed: ${errorMessage}`,
          { error: err },
          'error'
        );

        // Add error message to history as system type to avoid triggering success logic
        this.messages.push({
          id: `msg-${Date.now()}-error`,
          type: 'system',
          role: 'system',
          content: `Error: ${errorMessage}`,
          timestamp: new Date(),
        });

        yield {
          messages: this.getTuiMessages(),
          sessionId: request.resumeSessionId || this.sessionId || 'error',
          tokens: { ...this.usage },
          numTurns: this.numTurns,
          retryCount: this.retryCount,
          activeModel: request.model || this.models[0],
          finishReason: 'error',
        };
      }
    } finally {
      // 5. Restore console/process functions
      systemDiagnosticsService.restoreNoise();
      this.abortController = null;
    }
  }

  /**
   * Builds the set of tools available for the agent request, centralized for all providers.
   * This handles standard Sigma tools, MCP servers, and optional filtering/confirmation logic.
   */
  protected buildTools(
    request: AgentRequest,
    provider: ProviderType,
    onTaskCompleted?: (
      taskId: string,
      result_summary?: string | null,
      session?: Session
    ) => Promise<void>
  ): unknown[] {
    const context: UnifiedToolsContext = {
      cwd: request.cwd || process.cwd(),
      projectRoot: request.projectRoot,
      agentId: request.agentId,
      anchorId: request.anchorId,
      toolMutex: this.toolMutex,
      workbenchUrl: request.workbenchUrl,
      onToolOutput: request.onToolOutput,
      currentPromptTokens: this.usage.prompt,
      getActiveTaskId: () =>
        request.anchorId
          ? getActiveTaskId(
              request.anchorId,
              request.cwd || request.projectRoot || process.cwd()
            )
          : null,
      onCanUseTool: request.onCanUseTool,
      onTaskCompleted,
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
      mode: request.mode,
    };

    return getUnifiedTools(context, provider);
  }
  protected getAdditionalTools(_request: AgentRequest): unknown[] {
    void _request;
    return [];
  }

  protected getTuiMessages(): AgentMessage[] {
    return this.messages.map((m) => {
      const result = { ...m };
      if (typeof result.content === 'string') {
        result.content = terminalFormatter.stripSigmaMarkers(result.content);
      } else if (Array.isArray(result.content)) {
        result.content = result.content.map((block) => {
          if (block.type === 'text' && typeof block.text === 'string') {
            return {
              ...block,
              text: terminalFormatter.stripSigmaMarkers(block.text),
            };
          }
          if (block.type === 'thinking' && typeof block.thinking === 'string') {
            return {
              ...block,
              thinking: terminalFormatter.stripSigmaMarkers(block.thinking),
            };
          }
          return block;
        });
      }

      if (typeof result.thinking === 'string') {
        result.thinking = terminalFormatter.stripSigmaMarkers(result.thinking);
      }
      return result;
    });
  }

  /**
   * Interrupt current execution
   */
  async interrupt(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Generate a unique session ID
   */
  protected generateSessionId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Prepares the session ID for the request.
   * Can be overridden by providers that need server-side session initialization.
   */
  protected async prepareSessionId(request: AgentRequest): Promise<string> {
    return request.resumeSessionId || this.generateSessionId();
  }

  /**
   * Process a unified streaming chunk to update internal state.
   */
  protected processChunk(chunk: UnifiedStreamingChunk): void {
    if (chunk.retryCount !== undefined) {
      this.retryCount = chunk.retryCount;
    }

    if (chunk.numTurns !== undefined) {
      this.numTurns = chunk.numTurns;
    }

    if (chunk.type === 'usage' && chunk.usage) {
      this.usage.prompt = chunk.usage.prompt;
      this.usage.completion = chunk.usage.completion;
      this.usage.total = chunk.usage.total;
      if (chunk.usage.cached !== undefined) {
        this.usage.cached = chunk.usage.cached;
      }
    }

    if (chunk.type === 'text' && chunk.delta) {
      this.accumulateMessage('assistant', chunk.delta, chunk.thoughtSignature);
    } else if (chunk.type === 'thinking' && chunk.thought) {
      this.accumulateThought(chunk.thought, chunk.thoughtSignature);
    } else if (chunk.type === 'tool_call' && chunk.toolCall) {
      // Deduplicate tool calls by ID (crucial for cumulative stream providers like Gemini)
      if (
        chunk.toolCall.id &&
        this.messages.some(
          (m) => m.type === 'tool_use' && m.toolCallId === chunk.toolCall!.id
        )
      ) {
        return;
      }

      const lastMsg = this.messages[this.messages.length - 1];
      // Only increment turn if the previous message was NOT from the assistant.
      // This prevents "turn explosion" during parallel tool calls in a single turn.
      if (lastMsg && lastMsg.role !== 'assistant') {
        this.numTurns++;
        // Reset completion usage for the new turn
        this.usage.completion = 0;
      } else if (!lastMsg) {
        this.numTurns++;
      }

      this.messages.push({
        id: `msg-${Date.now()}-tool-${this.numTurns}`,
        type: 'tool_use',
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        toolName: chunk.toolCall.name,
        toolInput: chunk.toolCall.args,
        thoughtSignature: chunk.thoughtSignature,
        toolCallId: chunk.toolCall.id,
        toolIndex: chunk.toolCall.index,
        toolTotal: chunk.toolCall.total,
      });
    } else if (chunk.type === 'tool_response' && chunk.toolResponse) {
      // Deduplicate tool responses by ID (crucial for cumulative stream providers like Gemini)
      if (
        chunk.toolResponse.id &&
        this.messages.some(
          (m) =>
            m.type === 'tool_result' && m.toolCallId === chunk.toolResponse!.id
        )
      ) {
        return;
      }

      const lastMsg = this.messages[this.messages.length - 1];
      // Only increment turn if the previous message was NOT from the user.
      // This prevents "turn explosion" during multiple tool responses in a single turn.
      if (lastMsg && lastMsg.role !== 'user') {
        this.numTurns++;
        // Reset completion usage for the new user turn (tool responses)
        this.usage.completion = 0;
      }

      this.messages.push({
        id: `msg-${Date.now()}-result-${this.numTurns}`,
        type: 'tool_result',
        role: 'user',
        content:
          typeof chunk.toolResponse.response === 'string'
            ? chunk.toolResponse.response
            : JSON.stringify(chunk.toolResponse.response),
        timestamp: new Date(),
        toolName: chunk.toolResponse.name,
        toolCallId: chunk.toolResponse.id,
      });
    }
  }

  protected accumulateMessage(
    role: string,
    content: string,
    thoughtSignature?: string
  ): void {
    // Optimization: If the last message is of the same type/role and has the same thought signature,
    // we append to it instead of pushing a new message object.
    // This significantly reduces the number of messages the TUI has to process during streaming.
    const lastMsg = this.messages[this.messages.length - 1];
    const targetType = role === 'user' ? 'user' : 'assistant';
    if (
      lastMsg &&
      lastMsg.type === targetType &&
      lastMsg.role === role &&
      lastMsg.thoughtSignature === thoughtSignature
    ) {
      if (typeof lastMsg.content === 'string') {
        lastMsg.content += content;
        return;
      }
    }

    this.messages.push({
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: role === 'user' ? 'user' : 'assistant',
      role: role as 'user' | 'assistant',
      content,
      timestamp: new Date(),
      thoughtSignature,
    });
  }

  protected accumulateThought(
    thought: string,
    thoughtSignature?: string
  ): void {
    const lastMsg = this.messages[this.messages.length - 1];
    if (
      lastMsg &&
      lastMsg.type === 'thinking' &&
      lastMsg.thoughtSignature === thoughtSignature
    ) {
      if (typeof lastMsg.content === 'string') {
        lastMsg.content += thought;
      }
      if (typeof lastMsg.thinking === 'string') {
        lastMsg.thinking += thought;
      }
      return;
    }

    this.messages.push({
      id: `msg-${Date.now()}-thinking-${Math.random().toString(36).substring(2, 7)}`,
      type: 'thinking',
      role: 'assistant',
      content: thought,
      thinking: thought,
      timestamp: new Date(),
      thoughtSignature,
    });
  }

  // --- Context Helpers ---

  protected async getGroundingContext(request: AgentRequest): Promise<string> {
    return getGroundingContext(request);
  }

  protected getThinkingBudget(request: AgentRequest): ThinkingBudget {
    return getDynamicThinkingBudget(request.remainingTPM);
  }

  protected async getSystemPrompt(
    request: AgentRequest,
    activeModel: string,
    groundingContext: string
  ): Promise<string> {
    const flavor = this.name.charAt(0).toUpperCase() + this.name.slice(1);
    const basePrompt = buildSystemPrompt(request, activeModel, flavor);
    return groundingContext
      ? `${basePrompt}\n\n## Automated Grounding Context\n${groundingContext}`
      : basePrompt;
  }
}
