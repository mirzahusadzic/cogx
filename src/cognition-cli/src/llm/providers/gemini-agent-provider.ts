/**
 * Gemini Agent Provider Implementation
 *
 * Extends GeminiProvider with agent-specific capabilities using Google ADK.
 * Provides full agent workflow support including:
 * - Multi-turn conversation
 * - Tool execution (Phase 3)
 * - Streaming responses
 *
 * EXPERIMENTAL: Google ADK TypeScript SDK is pre-release (v0.1.x)
 *
 * @example
 * const provider = new GeminiAgentProvider(process.env.GEMINI_API_KEY);
 *
 * for await (const response of provider.executeAgent({
 *   prompt: 'Analyze this codebase',
 *   model: 'gemini-2.5-flash',
 *   cwd: process.cwd()
 * })) {
 *   console.log(response.messages);
 * }
 */

import {
  LlmAgent,
  Runner,
  InMemorySessionService,
  GOOGLE_SEARCH,
  AgentTool,
  setLogLevel,
  LogLevel,
  StreamingMode,
} from '@google/adk';
import { getCognitionTools } from './gemini-adk-tools.js';
import type {
  AgentProvider,
  AgentRequest,
  AgentResponse,
  AgentMessage,
} from '../agent-provider-interface.js';
import type {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '../provider-interface.js';

/**
 * Gemini Agent Provider
 *
 * Implements AgentProvider using Google ADK for agent workflows.
 *
 * DESIGN:
 * - Pure ADK implementation (no parent class inheritance)
 * - Uses Google ADK LlmAgent for agent orchestration
 * - Full tool execution support via ADK
 * - Handles streaming via ADK Runner
 * - Session management via InMemorySessionService
 */
export class GeminiAgentProvider implements AgentProvider {
  name = 'gemini';
  // Only models that support extended thinking (ordered newest first)
  models = [
    'gemini-3-flash-preview', // Gemini 3.0 Flash with high-level thinking (default)
    'gemini-3-pro-preview', // Gemini 3.0 Pro with advanced reasoning
    'gemini-2.5-pro', // Gemini 2.5 Pro - most capable 2.x
    'gemini-2.5-flash', // Gemini 2.5 Flash - fast and efficient
  ];

  private apiKey: string;
  private currentRunner: Runner | null = null;
  private sessionService = new InMemorySessionService();
  private abortController: AbortController | null = null;
  private currentGenerator: AsyncGenerator<unknown> | null = null;

  /**
   * Create Gemini Agent Provider
   *
   * @param apiKey - Google API key (optional, defaults to GEMINI_API_KEY env var)
   * @throws Error if no API key provided
   */
  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;

    if (!key) {
      throw new Error(
        'Gemini provider requires an API key. ' +
          'Provide it as constructor argument or set GEMINI_API_KEY environment variable.'
      );
    }

    this.apiKey = key;

    // Suppress ADK info logs (only show errors)
    setLogLevel(LogLevel.ERROR);
  }

  /**
   * Check if provider supports agent mode
   */
  supportsAgentMode(): boolean {
    return true;
  }

  /**
   * Execute agent query with ADK
   *
   * Creates an LlmAgent and runs it via ADK Runner.
   * Yields AgentResponse snapshots as the conversation progresses.
   */
  async *executeAgent(
    request: AgentRequest
  ): AsyncGenerator<AgentResponse, void, undefined> {
    // Get file tools (with optional recall tool if conversation registry provided)
    const conversationRegistry = request.conversationRegistry as
      | import('../../sigma/conversation-registry.js').ConversationOverlayRegistry
      | undefined;
    const taskManager = request.getTaskManager as
      | (() =>
          | import('../../tui/services/BackgroundTaskManager.js').BackgroundTaskManager
          | null)
      | undefined;
    const messagePublisher = request.getMessagePublisher as
      | (() => import('../../ipc/MessagePublisher.js').MessagePublisher | null)
      | undefined;
    const messageQueue = request.getMessageQueue as
      | (() => import('../../ipc/MessageQueue.js').MessageQueue | null)
      | undefined;

    const cognitionTools = getCognitionTools(
      conversationRegistry,
      request.workbenchUrl,
      request.onCanUseTool, // Pass permission callback for tool confirmations
      taskManager, // Pass task manager getter for background tasks tool
      messagePublisher, // Pass message publisher getter for agent messaging tools
      messageQueue, // Pass message queue getter for agent messaging tools
      request.cwd || request.projectRoot, // Pass project root for agent discovery
      request.agentId, // Pass current agent ID for excluding self from listings
      {
        provider: 'gemini', // Enable external SigmaTaskUpdate for Gemini
        anchorId: request.anchorId, // Session anchor for SigmaTaskUpdate state persistence
      }
    );

    // Create a specialized web search agent
    // Use Agent-as-Tool pattern to combine with file tools
    const webSearchAgent = new LlmAgent({
      name: 'WebSearch',
      description:
        'Search the web for current information, news, facts, and real-time data using Google Search',
      model: request.model || 'gemini-2.5-flash',
      instruction:
        'You are a web search specialist. When called, search Google for the requested information and return concise, accurate results with sources.',
      tools: [GOOGLE_SEARCH],
    });

    // Wrap the web search agent as a tool
    const webSearchTool = new AgentTool({
      agent: webSearchAgent,
      skipSummarization: false,
    });

    // Combine cognition tools (includes file tools, web search tool, fetch URL tool)
    const tools = [...cognitionTools];

    // Create abort controller for cancellation support
    this.abortController = new AbortController();

    const modelId = request.model || 'gemini-3-flash-preview';
    const isGemini3 = modelId.includes('gemini-3');

    // Dynamic Thinking Budgeting:
    // If TPM is low (< 200k), reduce thinking budget significantly
    const remainingTPM = request.remainingTPM ?? 1000000;
    const isTPMLow = remainingTPM < 200000;
    const defaultThinkingBudget = isTPMLow ? 8192 : 24576;

    const agent = new LlmAgent({
      name: 'cognition_agent',
      model: modelId,
      instruction: this.buildSystemPrompt(request),
      tools,
      generateContentConfig: {
        abortSignal: this.abortController.signal,
        ...(isGemini3
          ? {
              // GEMINI 3.0 CONFIG (Requires SDK bypass currently)
              thinkingConfig: {
                // Reduced thinking for low TPM (though HIGH is usually preferred for Gemini 3)
                thinkingLevel: isTPMLow ? 'LOW' : 'HIGH',
                includeThoughts: request.displayThinking !== false,
              },
            }
          : {
              // GEMINI 2.5 / LEGACY CONFIG
              thinkingConfig: {
                thinkingBudget:
                  request.maxThinkingTokens !== undefined
                    ? Math.min(request.maxThinkingTokens, defaultThinkingBudget)
                    : isTPMLow
                      ? 8192
                      : -1,
                includeThoughts: request.displayThinking !== false,
              },
            }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    // Create runner
    this.currentRunner = new Runner({
      agent,
      appName: 'cognition-cli',
      sessionService: this.sessionService,
    });

    const messages: AgentMessage[] = [];
    let numTurns = 0;
    let totalTokens = 0;

    // Track actual token usage from Gemini API
    // cumulativeXxxTokens = total API consumption across all turns (for quota tracking)
    // currentXxxTokens = last turn's tokens (for current context size)
    let cumulativePromptTokens = 0;
    let cumulativeCompletionTokens = 0;
    let currentPromptTokens = 0;
    let currentCompletionTokens = 0;

    // Track accumulated content to extract deltas (SSE sends full text each time)
    // Use Map for thinking blocks (key = block ID extracted from header)
    const accumulatedThinkingBlocks = new Map<string, string>();
    let accumulatedAssistant = '';

    // Create or resume session
    // Add random component to prevent collisions when multiple sessions created in same millisecond
    const sessionId =
      request.resumeSessionId ||
      `gemini-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const userId = 'cognition-user';

    // Get or create session
    let session = await this.sessionService.getSession({
      appName: 'cognition-cli',
      userId,
      sessionId,
    });

    if (!session) {
      session = await this.sessionService.createSession({
        appName: 'cognition-cli',
        userId,
        sessionId,
      });
    }

    // Add user message
    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      type: 'user',
      role: 'user',
      content: request.prompt,
      timestamp: new Date(),
    };
    messages.push(userMessage);

    // Yield initial state
    yield {
      messages: [...messages],
      sessionId,
      tokens: { prompt: 0, completion: 0, total: 0 },
      finishReason: 'stop',
      numTurns: 0,
    };

    // BIDI (bidirectional) streaming mode handles multi-turn tool conversations better than SSE
    // Use BIDI if explicitly enabled (via env var), otherwise use SSE for stability
    // BIDI mode is experimental (ADK v0.1.x) and can throw JSON parsing errors
    const useBidiMode = process.env.GEMINI_USE_BIDI === '1';

    try {
      // Run agent - runAsync returns an async generator
      const runGenerator = this.currentRunner.runAsync({
        userId,
        sessionId,
        newMessage: {
          role: 'user',
          parts: [{ text: request.prompt }],
        },
        runConfig: {
          streamingMode: useBidiMode ? StreamingMode.BIDI : StreamingMode.SSE,
        },
      });

      // Store generator reference for interrupt support
      this.currentGenerator = runGenerator as AsyncGenerator<unknown>;

      // Process events from the generator
      for await (const event of runGenerator) {
        // Check if abort was requested (ESC key pressed)
        if (this.abortController?.signal.aborted) {
          if (process.env.DEBUG_ESC_INPUT) {
            console.error('[Gemini] Abort signal detected, exiting loop');
          }
          // Exit cleanly - don't throw, just break
          break;
        }

        if (process.env.DEBUG_GEMINI_STREAM) {
          console.error(`[Gemini] Processing event (turn ${numTurns + 1})`);
        }

        // Cast event to access properties (ADK types are not well defined yet)
        const evt = event as unknown as {
          author?: string;
          errorCode?: string;
          errorMessage?: string;
          content?: {
            role?: string;
            parts?: Array<{
              text?: string;
              thought?: boolean; // true if this part contains thinking/reasoning
              functionCall?: { name: string; args: Record<string, unknown> };
              functionResponse?: { name: string; response: unknown };
            }>;
          };
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
            thoughtsTokenCount?: number; // thinking token usage
          };
        };

        numTurns++;

        // Capture actual token usage from Gemini API
        // promptTokenCount includes all history sent in this request
        // totalTokenCount is the sum of prompt and candidates for this request
        if (evt.usageMetadata) {
          if (evt.usageMetadata.promptTokenCount !== undefined) {
            cumulativePromptTokens = evt.usageMetadata.promptTokenCount;
            currentPromptTokens = evt.usageMetadata.promptTokenCount;
          }
          if (
            evt.usageMetadata.totalTokenCount !== undefined &&
            evt.usageMetadata.promptTokenCount !== undefined
          ) {
            cumulativeCompletionTokens =
              evt.usageMetadata.totalTokenCount -
              evt.usageMetadata.promptTokenCount;
          } else if (evt.usageMetadata.candidatesTokenCount !== undefined) {
            // Fallback if totalTokenCount is missing
            cumulativeCompletionTokens +=
              evt.usageMetadata.candidatesTokenCount;
            currentCompletionTokens = evt.usageMetadata.candidatesTokenCount;
          }
        }

        // Handle error events (but skip "STOP" which is a normal finish reason, not an error)
        if ((evt.errorCode && evt.errorCode !== 'STOP') || evt.errorMessage) {
          const errorMsg = evt.errorMessage || `Error code: ${evt.errorCode}`;
          throw new Error(`Gemini API Error: ${errorMsg}`);
        }

        // Skip user echo events
        if (evt.author === 'user') {
          continue;
        }

        // Handle assistant/model responses
        if (evt.author === 'cognition_agent' && evt.content?.parts) {
          for (const part of evt.content.parts) {
            // Handle function calls (tool use)
            if (part.functionCall) {
              if (process.env.DEBUG_GEMINI_STREAM) {
                console.error(
                  `\n[Gemini] === TOOL CALL: ${part.functionCall.name} ===`
                );
              }

              // Don't pre-format - let TUI handle formatting via toolName/toolInput
              const toolMessage: AgentMessage = {
                id: `msg-${Date.now()}-tool-${numTurns}`,
                type: 'tool_use',
                role: 'assistant',
                content: '', // TUI will format using toolName and toolInput
                timestamp: new Date(),
                toolName: part.functionCall.name,
                toolInput: part.functionCall.args,
              };
              messages.push(toolMessage);

              yield {
                messages: [...messages],
                sessionId,
                tokens: {
                  prompt: Math.max(
                    cumulativePromptTokens,
                    Math.ceil(request.prompt.length / 4)
                  ),
                  completion: Math.max(cumulativeCompletionTokens, totalTokens),
                  total:
                    Math.max(
                      cumulativePromptTokens,
                      Math.ceil(request.prompt.length / 4)
                    ) + Math.max(cumulativeCompletionTokens, totalTokens),
                },
                finishReason: 'tool_use',
                numTurns,
              };

              // Reset assistant accumulator after tool use - next assistant message will be a new response
              if (process.env.DEBUG_GEMINI_STREAM) {
                console.error(
                  '[Gemini] Resetting accumulators (post-tool-use)'
                );
              }
              accumulatedAssistant = '';
              accumulatedThinkingBlocks.clear();
            }

            // Handle function responses (tool results)
            if (part.functionResponse) {
              if (process.env.DEBUG_GEMINI_STREAM) {
                console.error(
                  `\n[Gemini] === TOOL RESULT: ${part.functionResponse.name} ===`
                );
              }

              const resultMessage: AgentMessage = {
                id: `msg-${Date.now()}-result-${numTurns}`,
                type: 'tool_result',
                role: 'user',
                content:
                  typeof part.functionResponse.response === 'string'
                    ? part.functionResponse.response
                    : JSON.stringify(part.functionResponse.response),
                timestamp: new Date(),
                toolName: part.functionResponse.name,
              };
              messages.push(resultMessage);

              yield {
                messages: [...messages],
                sessionId,
                tokens: {
                  prompt:
                    cumulativePromptTokens ||
                    Math.ceil(request.prompt.length / 4),
                  completion: cumulativeCompletionTokens || totalTokens,
                  total:
                    (cumulativePromptTokens ||
                      Math.ceil(request.prompt.length / 4)) +
                    (cumulativeCompletionTokens || totalTokens),
                },
                finishReason: 'tool_use', // Tool result, not stop - agent continues
                numTurns,
                // Pass back the tool result information for compression triggers
                toolResult: {
                  name: part.functionResponse.name,
                  response: part.functionResponse.response,
                },
              };

              // Reset assistant accumulator after tool result - next assistant message will be a new response
              if (process.env.DEBUG_GEMINI_STREAM) {
                console.error(
                  '[Gemini] Resetting accumulators (post-tool-result)'
                );
              }
              accumulatedAssistant = '';
              accumulatedThinkingBlocks.clear();
            }

            // Handle text responses (both thinking and regular)
            if (part.text) {
              // Check if this is thinking content
              const isThinking = part.thought === true;
              const messageType = isThinking ? 'thinking' : 'assistant';

              if (process.env.DEBUG_GEMINI_STREAM) {
                console.error(
                  `\n[Gemini] === NEW EVENT: ${messageType} (${part.text.length} chars) ===`
                );
                console.error(
                  `[Gemini] Text preview: "${part.text.substring(0, 256)}..."`
                );
              }

              // SSE mode sends FULL accumulated text each time, not deltas
              // For thinking blocks, extract block ID from header (e.g., "**Analyzing Code**")
              let blockId = '';
              let accumulated = '';

              if (isThinking) {
                // Extract thinking block header (first line, usually bold)
                const match = part.text.match(/^\*\*([^*]+)\*\*/);
                blockId = match ? match[1] : 'default';
                accumulated = accumulatedThinkingBlocks.get(blockId) || '';
              } else {
                accumulated = accumulatedAssistant;
              }

              if (process.env.DEBUG_GEMINI_STREAM) {
                console.error(
                  `[Gemini] Accumulated: ${accumulated.length} chars: "${accumulated.substring(0, 100)}..."`
                );
              }

              // Skip if no new content (shorter than current accumulated = stale event)
              if (accumulated && part.text.length <= accumulated.length) {
                if (process.env.DEBUG_GEMINI_STREAM) {
                  console.error(
                    `[Gemini] SKIP: No new content (${part.text.length} <= ${accumulated.length})`
                  );
                }
                continue;
              }

              // Verify this is a legitimate continuation (not a restructured/combined event)
              // Both thinking AND assistant messages can get restructured by Gemini
              if (accumulated && !part.text.startsWith(accumulated)) {
                if (process.env.DEBUG_GEMINI_STREAM) {
                  console.error(
                    `[Gemini] SKIP: ${messageType} doesn't start with accumulated (restructured event)`
                  );
                }
                // This is likely a restructured event with different text
                continue;
              }

              // Extract delta text (only the new portion)
              const deltaText = part.text.substring(accumulated.length);

              if (process.env.DEBUG_GEMINI_STREAM) {
                console.error(
                  `[Gemini] Delta (${deltaText.length} chars): "${deltaText.substring(0, 100)}..."`
                );
              }

              // Skip if delta is empty or just whitespace (final event with no new content)
              if (!deltaText || deltaText.trim().length === 0) {
                if (process.env.DEBUG_GEMINI_STREAM) {
                  console.error(`[Gemini] SKIP: Empty delta`);
                }
                // Update accumulated tracker even though we're skipping
                if (isThinking) {
                  accumulatedThinkingBlocks.set(blockId, part.text);
                } else {
                  accumulatedAssistant = part.text;
                }
                continue;
              }

              // Update accumulated trackers
              if (isThinking) {
                accumulatedThinkingBlocks.set(blockId, part.text);
              } else {
                accumulatedAssistant = part.text;
              }

              if (process.env.DEBUG_GEMINI_STREAM) {
                console.error(
                  `[Gemini] ✓ YIELDING delta, new total: ${part.text.length} chars`
                );
              }

              // Create new message with delta text
              // The TUI will accumulate these deltas via processAgentMessage
              const message: AgentMessage = {
                id: `msg-${Date.now()}-${numTurns}-${messageType}`,
                type: messageType,
                role: 'assistant',
                content: deltaText, // Send only the delta
                timestamp: new Date(),
              };

              if (isThinking) {
                message.thinking = deltaText;
              }

              messages.push(message);

              totalTokens += Math.ceil(part.text.length / 4);

              yield {
                messages: [...messages],
                sessionId,
                tokens: {
                  prompt:
                    cumulativePromptTokens ||
                    Math.ceil(request.prompt.length / 4),
                  completion: cumulativeCompletionTokens || totalTokens,
                  total:
                    (cumulativePromptTokens ||
                      Math.ceil(request.prompt.length / 4)) +
                    (cumulativeCompletionTokens || totalTokens),
                },
                finishReason: 'stop',
                numTurns,
              };
            }
          }
        }
      }

      // Final response with actual token counts from Gemini API
      // Always yield final response to signal completion (even if we've yielded before)
      if (process.env.DEBUG_GEMINI_STREAM) {
        console.error(
          `\n[Gemini] === STREAM LOOP EXITED ===\n[Gemini] Total turns: ${numTurns}\n[Gemini] Cumulative tokens: ${cumulativePromptTokens} prompt, ${cumulativeCompletionTokens} completion\n[Gemini] Current context: ${currentPromptTokens} prompt, ${currentCompletionTokens} completion\n[Gemini] Last message type: ${messages[messages.length - 1]?.type || 'none'}\n[Gemini] Yielding final response with finishReason='stop'`
        );
      }
      yield {
        messages: [...messages],
        sessionId,
        tokens: {
          prompt: Math.max(
            cumulativePromptTokens,
            Math.ceil(request.prompt.length / 4)
          ),
          completion: Math.max(cumulativeCompletionTokens, totalTokens),
          total:
            Math.max(
              cumulativePromptTokens,
              Math.ceil(request.prompt.length / 4)
            ) + Math.max(cumulativeCompletionTokens, totalTokens),
        },
        finishReason: 'stop',
        numTurns,
      };
    } catch (error) {
      // Check if this is a user-initiated abort (not an actual error)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isAbort =
        errorMessage === 'Operation aborted by user' ||
        errorMessage.includes('aborted') ||
        errorMessage.includes('abort') ||
        errorMessage.includes('signal') ||
        // SDK might throw JSON parsing errors when aborted
        (errorMessage.includes('JSON') && this.abortController?.signal.aborted);

      // ADK SDK (experimental v0.1.x) can throw JSON parsing errors in both SSE and BIDI modes
      // These are typically benign SDK bugs when the stream ends, not real errors
      // If we got any assistant messages before the error, treat as successful completion
      const hasAssistantMessages = messages.some(
        (m) => m.type === 'assistant' || m.type === 'thinking'
      );
      const isBenignSdkError =
        errorMessage.includes('JSON') &&
        errorMessage.includes('Unexpected token') &&
        hasAssistantMessages;

      if (process.env.DEBUG_ESC_INPUT && isAbort) {
        console.error('[Gemini] Caught abort-related error:', errorMessage);
      }

      if (process.env.DEBUG_GEMINI_STREAM && isBenignSdkError) {
        console.error(
          '[Gemini] Ignoring benign ADK SDK JSON parsing error:',
          errorMessage
        );
      }

      // Only show error message if it's not an abort or benign SDK error
      if (!isAbort && !isBenignSdkError) {
        const errorMessage: AgentMessage = {
          id: `msg-${Date.now()}-error`,
          type: 'assistant',
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
        };
        messages.push(errorMessage);
      }

      yield {
        messages: [...messages],
        sessionId,
        tokens: {
          prompt: Math.max(
            cumulativePromptTokens,
            Math.ceil(request.prompt.length / 4)
          ),
          completion: Math.max(cumulativeCompletionTokens, totalTokens),
          total:
            Math.max(
              cumulativePromptTokens,
              Math.ceil(request.prompt.length / 4)
            ) + Math.max(cumulativeCompletionTokens, totalTokens),
        },
        finishReason: isAbort || isBenignSdkError ? 'stop' : 'error',
        numTurns,
      };
    } finally {
      this.currentRunner = null;
      this.abortController = null;
      this.currentGenerator = null;
    }
  }

  /**
   * Interrupt current agent execution
   *
   * Forces the generator to exit by calling return() on it.
   * Google ADK doesn't support native cancellation, so we forcefully
   * close the async generator to stop event processing.
   */
  async interrupt(): Promise<void> {
    if (process.env.DEBUG_ESC_INPUT) {
      console.error('[Gemini] interrupt() called');
    }

    // Signal abort for the loop check
    if (this.abortController) {
      if (process.env.DEBUG_ESC_INPUT) {
        console.error('[Gemini] Aborting controller');
      }
      this.abortController.abort();
    }

    // Force the generator to exit (since ADK doesn't support native cancellation)
    if (this.currentGenerator) {
      try {
        if (process.env.DEBUG_ESC_INPUT) {
          console.error('[Gemini] Calling generator.return()');
        }
        await this.currentGenerator.return(undefined);
        if (process.env.DEBUG_ESC_INPUT) {
          console.error('[Gemini] generator.return() completed');
        }
      } catch (err) {
        if (process.env.DEBUG_ESC_INPUT) {
          console.error('[Gemini] generator.return() error:', err);
        }
      }
    }

    this.currentRunner = null;
    this.currentGenerator = null;
    if (process.env.DEBUG_ESC_INPUT) {
      console.error('[Gemini] interrupt() completed');
    }
  }

  /**
   * Generate completion (stub - agent mode is primary interface)
   *
   * Note: This provider is optimized for agent workflows via executeAgent().
   * Basic completions are not the primary use case.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    throw new Error(
      'GeminiAgentProvider is designed for agent workflows. Use executeAgent() instead of complete().'
    );
  }

  /**
   * Stream completion (stub - agent mode is primary interface)
   */
  async *stream(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, undefined> {
    throw new Error(
      'GeminiAgentProvider is designed for agent workflows. Use executeAgent() instead of stream().'
    );
    // Unreachable yield to satisfy generator signature
    yield { delta: '', text: '', done: true };
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    // Simple API key check - ADK will validate on first use
    return !!this.apiKey;
  }

  /**
   * Estimate cost for token usage
   *
   * Based on Google Gemini pricing as of Dec 2025:
   * - Gemini 3.0 Flash Preview: $0.50/$3.00 per MTok (input/output)
   * - Gemini 3.0 Pro Preview: $2/$12 per MTok (<200k tokens), $4/$18 per MTok (>200k tokens)
   * - Context: 1M tokens, Output: 64k tokens
   */
  estimateCost(tokens: number, model: string): number {
    const mtokens = tokens / 1000000;

    // Estimate 40% input, 60% output (typical conversation ratio)
    const inputMtokens = mtokens * 0.4;
    const outputMtokens = mtokens * 0.6;

    // Gemini 3.0 Pro Preview - tiered pricing
    if (model.includes('3-pro')) {
      // >200k tokens = higher tier
      if (tokens > 200000) {
        return inputMtokens * 4.0 + outputMtokens * 18.0;
      }
      // <200k tokens = lower tier
      return inputMtokens * 2.0 + outputMtokens * 12.0;
    }

    // Gemini 3.0 Flash Preview (default)
    return inputMtokens * 0.5 + outputMtokens * 3.0;
  }

  /**
   * Build system prompt from request
   */
  private buildSystemPrompt(request: AgentRequest): string {
    if (
      request.systemPrompt?.type === 'custom' &&
      request.systemPrompt.custom
    ) {
      return request.systemPrompt.custom;
    }

    const modelName = request.model || 'Gemini';
    return `You are **${modelName}** (Google ADK) running inside **Cognition Σ (Sigma) CLI** - a verifiable AI-human symbiosis architecture with dual-lattice knowledge representation.

## What is Cognition Σ?
A portable cognitive layer that can be initialized in **any repository**. Creates \`.sigma/\` (conversation memory) and \`.open_cognition/\` (PGC project knowledge store) in the current working directory.

## Your Capabilities
You have access to tools for:
- **read_file**: Read file contents at a given path
- **write_file**: Write content to files
- **glob**: Find files matching patterns (e.g., "**/*.ts")
- **grep**: Search code with ripgrep
- **bash**: Execute shell commands (git, npm, etc.)
- **edit_file**: Make targeted text replacements
- **SigmaTaskUpdate**: Update the task list to track progress and maintain state across the session
- **WebSearch**: Search the web for current information, news, facts, and real-time data using Google Search
- **fetch_url**: Fetch and read content from any URL (returns markdown-formatted text with basic HTML stripping)
- **recall_past_conversation**: Search conversation history for past context (if available)
- **get_background_tasks**: Query status of background operations (genesis, overlay generation) - check progress, see completed/failed tasks
- **list_agents**: List all active agents in the IPC bus
- **send_agent_message**: Send a message to another agent by alias or ID
- **broadcast_agent_message**: Broadcast a message to all active agents
- **list_pending_messages**: List all pending messages from other agents (DO NOT poll - system auto-notifies on arrival)
- **mark_message_read**: Mark a pending message as read/processed
- **query_agent**: Ask semantic questions to agents in other repositories and get grounded answers based on their Project Grounding Context

## Working Directory
${request.cwd || process.cwd()}

## Guidelines
- Be concise and helpful
- Use tools proactively to gather context before answering
- When making changes, explain what you're doing briefly
- Prefer editing existing files over creating new ones
- Run tests after making code changes
- Use WebSearch tool when you need current information that might not be in files (e.g., latest docs, recent changes, current events)

## Task Management
You have access to the SigmaTaskUpdate tool to help you manage and plan tasks. Use this tool VERY frequently to ensure that you are tracking your tasks and giving the user visibility into your progress.
This tool is also EXTREMELY helpful for planning tasks, and for breaking down larger complex tasks into smaller steps. If you do not use this tool when planning, you may forget to do important tasks - and that is unacceptable.

It is critical that you mark tasks as completed as soon as you are done with a task. Do not batch up multiple tasks before marking them as completed.

### Examples

**Example 1: Multi-step task with tests**
User: "Run the build and fix any type errors"
You should:
1. Use SigmaTaskUpdate to create items: "Run the build", "Fix any type errors"
2. Run the build using bash
3. If you find 10 type errors, use SigmaTaskUpdate to add 10 items for each error
4. Mark the first task as in_progress
5. Work on the first item, then mark it as completed
6. Continue until all items are done

**Example 2: Feature implementation**
User: "Help me write a new feature that allows users to track their usage metrics and export them to various formats"
You should:
1. Use SigmaTaskUpdate to plan: Research existing metrics, Design system, Implement core tracking, Create export functionality
2. Start by researching the existing codebase
3. Mark items in_progress as you work, completed when done

**Example 3: Delegating a task (Manager/Worker Pattern)**
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

**Example 4: When NOT to use SigmaTaskUpdate**
User: "How do I print 'Hello World' in Python?"
Do NOT use SigmaTaskUpdate - this is a simple, trivial task with no multi-step implementation.

User: "Add a comment to the calculateTotal function"
Do NOT use SigmaTaskUpdate - this is a single, straightforward task.

### Task State Rules
1. **Task States**: pending (not started), in_progress (currently working), completed (finished), delegated (assigned to another agent)
2. **One at a time**: Exactly ONE task should be in_progress at any time
3. **Delegation**: When delegating, set status to 'delegated' AND send IPC message. Do not mark completed until worker reports back.
4. **Immediate completion**: Mark tasks complete IMMEDIATELY after finishing
5. **Honest completion**: ONLY mark completed when FULLY accomplished - if blocked, keep in_progress and add a new task for the blocker
6. **Both forms required**: Always provide content (imperative: "Fix bug") AND activeForm (continuous: "Fixing bug")

IMPORTANT: Always use the SigmaTaskUpdate tool to plan and track tasks throughout the conversation.

## Token Economy (IMPORTANT - Each tool call costs tokens!)
- **NEVER re-read files you just edited** - you already have the content in context
- **Use glob/grep BEFORE read_file** - find specific content instead of reading entire files
- **Batch operations** - if you need multiple files, plan which ones first, then read them efficiently
- **Use limit/offset for large files** - read only the sections you need
- **Prefer git diff or reading specific line ranges; avoid \`cat\` or \`read_file\` on full files unless the file is small (<50 lines) or strictly necessary.**
- **Avoid redundant reads** - if you read a file earlier in this conversation, don't read it again unless it changed
- **Summarize don't quote** - explain findings concisely rather than quoting entire file contents`;
  }
}
