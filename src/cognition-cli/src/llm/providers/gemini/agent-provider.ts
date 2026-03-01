/**
 * Gemini Agent Provider Implementation
 *
 * Extends GeminiProvider with agent-specific capabilities using Google ADK.
 * Provides full agent workflow support including:
 * - Multi-turn conversation
 * - Tool execution (Phase 3)
 * - Streaming responses
 * - Automatic thought signature handling (Gemini 3) via ADK Runner
 *
 * EXPERIMENTAL: Google ADK TypeScript SDK is pre-release (v0.3.x)
 *
 * @example
 * const provider = new GeminiAgentProvider(process.env.GEMINI_API_KEY);
 *
 * for await (const response of provider.executeAgent({
 *   prompt: 'Analyze this codebase',
 *   model: 'gemini-3-flash-preview',
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
  Session,
  Event,
} from '@google/adk';

import { ThinkingLevel } from '@google/genai';

import { getActiveTaskId } from '../../../sigma/session-state.js';

import { systemLog } from '../../../utils/debug-logger.js';
import { archiveTaskLogs } from '../eviction-utils.js';
import type { AgentRequest } from '../../agent-provider-interface.js';
import type {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '../../provider-interface.js';

/**
 * Internal ADK Session interface for history inspection.
 * Note: history is an internal field in some ADK implementations used for turn tracking.
 */
interface AdkSession {
  events?: Array<{
    author?: string;
    content?: {
      parts?: Array<{
        text?: string;
        thought?: boolean;
        thoughtSignature?: string;
        functionCall?: { name: string; args?: Record<string, unknown> };
        functionResponse?: { name: string; response?: unknown };
      }>;
    };
  }>;
}

/**
 * ADK Run Options with support for optional newMessage injection.
 * The SDK type definition marks newMessage as required, but the implementation
 * handles its absence for session resumption.
 */
interface AdkRunOptions {
  userId: string;
  sessionId: string;
  runConfig: {
    streamingMode: StreamingMode;
  };
  newMessage?: {
    role: string;
    parts: Array<{ text: string }>;
  };
}

/**
 * Extended GenerateContentConfig to support experimental thinking features.
 */
interface GeminiGenerateContentConfig {
  abortSignal?: AbortSignal;
  thinkingConfig?: {
    includeThoughts?: boolean;
    thinkingBudget?: number;
    thinkingLevel?: ThinkingLevel;
  };
}

// runSilently removed - logic moved to executeAgent for global scope suppression

import { BaseAgentProvider } from '../base-agent-provider.js';
import { UnifiedStreamingChunk } from '../../types.js';
import type { ThinkingBudget } from '../thinking-utils.js';

/**
 * Gemini Agent Provider
 *
 * Implements AgentProvider using Google ADK for agent workflows.
 * Extends BaseAgentProvider for shared orchestration logic.
 */
export class GeminiAgentProvider extends BaseAgentProvider {
  name = 'gemini';
  // Only models that support extended thinking (ordered newest first)
  models = [
    'gemini-3-flash-preview', // Gemini 3.0 Flash with high-level thinking (default)
    'gemini-3.1-pro-preview', // Gemini 3.1 Pro preview
    'gemini-3.1-pro-preview-customtools', // Gemini 3.1 Pro with custom tools
  ];

  private apiKey: string;
  private currentRunner: Runner | null = null;
  private sessionService = new InMemorySessionService();
  private currentGenerator: AsyncGenerator<unknown> | null = null;
  private sessionSignatures = new Map<string, string>();

  /**
   * Create Gemini Agent Provider
   *
   * @param apiKey - Google API key (optional, defaults to GEMINI_API_KEY env var)
   * @throws Error if no API key provided
   */
  constructor(apiKey?: string) {
    super();
    const key = apiKey || process.env.GEMINI_API_KEY;
    const isVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';

    if (!key && !isVertex) {
      throw new Error(
        'Gemini provider requires an API key. ' +
          'Provide it as constructor argument or set GEMINI_API_KEY environment variable.\n' +
          'Alternatively, set GOOGLE_GENAI_USE_VERTEXAI=true and configure Google Cloud credentials.'
      );
    }

    // In Vertex AI mode, the API key is not used for auth (ADC is used),
    // but the SDK type definition might strictly require a string.
    this.apiKey = key || 'vertex-managed';

    // Suppress ADK info logs (only show errors)
    setLogLevel(LogLevel.ERROR);
    if (!process.env.ADK_LOG_LEVEL) {
      process.env.ADK_LOG_LEVEL = 'ERROR';
    }

    // Suppress gRPC and Google SDK logging
    if (!process.env.GRPC_VERBOSITY) {
      process.env.GRPC_VERBOSITY = 'NONE';
    }
    if (!process.env.GOOGLE_SDK_LOG_LEVEL) {
      process.env.GOOGLE_SDK_LOG_LEVEL = 'error';
    }

    // Persistence Hack: Monkey-patch session service once at initialization.
    const originalAppendEvent = this.sessionService.appendEvent.bind(
      this.sessionService
    );
    this.sessionService.appendEvent = async (args: {
      session: Session;
      event: Event;
    }) => {
      const sessionId = (args.session as unknown as Record<string, string>)
        .sessionId;
      const lastSignature = this.sessionSignatures.get(sessionId);

      if (
        args.event.author === 'cognition_agent' &&
        args.event.content?.parts &&
        lastSignature
      ) {
        for (const part of args.event.content.parts) {
          const p = part as { thoughtSignature?: string };
          if (!p.thoughtSignature) {
            p.thoughtSignature = lastSignature;
          }
        }
      }
      return originalAppendEvent(args);
    };
  }

  /**
   * Rolling prune for in-progress tasks.
   * Maintains a ring buffer of tool outputs to prevent context bloat.
   *
   * @param taskId - The ID of the active task
   * @param sessionId - ADK session ID
   * @param projectRoot - Project root directory
   * @param threshold - Maximum number of tool outputs to keep (default: 20)
   * @param activeSession - Optional active session object
   */
  private async rollingPruneTaskLogs(
    taskId: string,
    sessionId: string,
    projectRoot: string,
    threshold: number = 20,
    activeSession?: Session
  ) {
    try {
      const session =
        activeSession ||
        (await this.sessionService.getSession({
          appName: 'cognition-cli',
          userId: 'cognition-user',
          sessionId: sessionId,
        }));

      if (!session) return;

      const events = (session as unknown as AdkSession).events;
      if (!events || events.length === 0) return;

      const tag = `<!-- sigma-task: ${taskId} -->`;

      // Find all events that have this task tag in their parts
      const taggedEventIndices: number[] = [];
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const parts = event.content?.parts || [];
        const hasTag = parts.some((p) => {
          if (p.text?.includes(tag)) return true;
          if (p.functionResponse?.response) {
            return JSON.stringify(p.functionResponse.response).includes(tag);
          }
          return false;
        });
        if (hasTag) {
          taggedEventIndices.push(i);
        }
      }

      if (taggedEventIndices.length <= threshold) return;

      // We need to prune oldest events to reach the threshold
      const toPruneCount = taggedEventIndices.length - threshold;
      const indicesToPrune = taggedEventIndices.slice(0, toPruneCount);

      const evictedLogs: string[] = [];
      const newEvents = [...events];

      for (const idx of indicesToPrune) {
        const event = newEvents[idx];
        evictedLogs.push(JSON.stringify(event, null, 2));

        const toolTombstone = `[Tool output for task ${taskId} evicted (Rolling Prune) to keep context small. Use 'grep' on .sigma/archives/${sessionId}/${taskId}.log if previous logs are needed.]`;

        const newParts = event.content?.parts?.map((p) => {
          if (p.functionResponse) {
            return {
              ...p,
              functionResponse: {
                name: p.functionResponse.name,
                response: {
                  result: toolTombstone,
                },
              },
            };
          }
          if (p.text?.includes(tag)) {
            return { text: toolTombstone };
          }
          return p;
        });

        newEvents[idx] = {
          ...event,
          content: {
            ...event.content,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parts: newParts as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        };
      }

      // Archive the pruned logs before deleting them from memory
      await archiveTaskLogs({
        projectRoot,
        sessionId,
        taskId,
        evictedLogs,
      });

      // Update session history in memory
      (session as unknown as AdkSession).events = newEvents;

      // Update internal storage if using InMemorySessionService
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalStorage = (this.sessionService as any).sessions;
      if (internalStorage?.['cognition-cli']?.['cognition-user']?.[sessionId]) {
        internalStorage['cognition-cli']['cognition-user'][sessionId].events = [
          ...newEvents,
        ];
      }

      systemLog(
        'sigma',
        `Rolling prune: Evicted ${toPruneCount} oldest tool logs for task ${taskId} (threshold: ${threshold}). ${process.env.DEBUG_ARCHIVE ? 'Archived to disk.' : ''}`
      );
    } catch (err) {
      systemLog(
        'sigma',
        `Failed rolling prune for task ${taskId}`,
        { error: err instanceof Error ? err.message : String(err) },
        'error'
      );
    }
  }

  /**
   * Prune tool logs for a completed task and archive them.
   * This surgical eviction keeps the context clean of "implementation noise".
   *
   * @param taskId - The ID of the completed task
   * @param sessionId - ADK session ID
   * @param projectRoot - Project root directory
   * @param activeSession - Optional active session object from tool context
   */
  private async pruneTaskLogs(
    taskId: string,
    result_summary: string | null | undefined,
    sessionId: string,
    projectRoot: string,
    activeSession?: Session
  ) {
    try {
      const session =
        activeSession ||
        (await this.sessionService.getSession({
          appName: 'cognition-cli',
          userId: 'cognition-user',
          sessionId: sessionId,
        }));

      if (!session) return;

      const events = (session as unknown as AdkSession).events;
      if (!events || events.length === 0) return;

      const tag = `<!-- sigma-task: ${taskId} -->`;
      const evictedLogs: string[] = [];
      const newEvents: NonNullable<AdkSession['events']> = [];
      let evictedCount = 0;

      // Pass 1: Identify task range (from 'in_progress' to 'completed')
      let startIndex = -1;
      for (let i = 0; i < events.length; i++) {
        const parts = events[i].content?.parts || [];
        const taskInProgress = parts.some(
          (p) =>
            p.functionCall?.name === 'SigmaTaskUpdate' &&
            (p.functionCall.args as Record<string, unknown>)?.todos &&
            Array.isArray(
              (p.functionCall.args as Record<string, unknown>).todos
            ) &&
            (
              (p.functionCall.args as Record<string, unknown>).todos as Array<{
                id: string;
                status: string;
              }>
            ).some((t) => t.id === taskId && t.status === 'in_progress')
        );
        if (taskInProgress) {
          startIndex = i;
          break;
        }
      }

      // Pass 2: Find last evicted index to inject summary
      let lastEvictedIndex = -1;
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const parts = event.content?.parts || [];
        const hasTag = parts.some((p) => {
          if (p.text?.includes(tag)) return true;
          if (p.functionResponse?.response) {
            return JSON.stringify(p.functionResponse.response).includes(tag);
          }
          return false;
        });
        const isAssistantTurnInRange =
          startIndex !== -1 &&
          i >= startIndex &&
          event.author === 'cognition_agent';
        if (hasTag || isAssistantTurnInRange) {
          lastEvictedIndex = i;
        }
      }

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const parts = event.content?.parts || [];
        const hasTag = parts.some((p) => {
          if (p.text?.includes(tag)) return true;
          if (p.functionResponse?.response) {
            return JSON.stringify(p.functionResponse.response).includes(tag);
          }
          return false;
        });

        // Turn-Range Eviction: Prune assistant turns (thinking/text) within the task window.
        const isAssistantTurnInRange =
          startIndex !== -1 &&
          i >= startIndex &&
          event.author === 'cognition_agent';

        if (hasTag || isAssistantTurnInRange) {
          evictedLogs.push(JSON.stringify(event, null, 2));
          evictedCount++;

          // Only inject summary into the last evicted turn to avoid token bloat
          const shouldInjectSummary = i === lastEvictedIndex && result_summary;

          // Replace with tombstone
          const toolTombstone = shouldInjectSummary
            ? `[Task ${taskId} completed. Raw logs evicted to archive. \nSUMMARY: ${result_summary}]`
            : `[Task ${taskId} completed: output evicted to archive. Use 'grep' on .sigma/archives/${sessionId}/${taskId}.log if previous logs are needed.]`;

          const assistantTombstone = shouldInjectSummary
            ? `[Assistant thinking/text for task ${taskId} evicted to save tokens. \nSUMMARY: ${result_summary}]`
            : `[Assistant thinking/text for task ${taskId} evicted to save tokens.]`;

          let hasAssistantTombstonePart = false;
          let collectedSignature: string | undefined = undefined;

          // Pre-scan for thought signature in assistant turns being evicted
          if (isAssistantTurnInRange) {
            for (const p of parts) {
              if (p.thoughtSignature) {
                collectedSignature = p.thoughtSignature;
                break;
              }
            }
          }

          const tombstoneParts = parts
            .map((p) => {
              if (p.functionResponse) {
                // Surgical Tool Eviction
                return {
                  ...p,
                  functionResponse: {
                    name: p.functionResponse.name,
                    response: {
                      result: toolTombstone,
                    },
                  },
                };
              }

              if (isAssistantTurnInRange && (p.thought || p.text)) {
                // Turn-Range Assistant Eviction (Prune thinking/text)
                if (!hasAssistantTombstonePart) {
                  hasAssistantTombstonePart = true;
                  return {
                    text: assistantTombstone,
                    thought: true, // Use thinking mode for tombstone to format correctly in TUI
                    thoughtSignature: collectedSignature, // Preserve reasoning state for Gemini 3
                  };
                }
                return null; // Remove extra parts (multiple thinking/text parts)
              }

              // Surgical Tag Eviction for non-assistant turns or non-range turns
              if (hasTag && p.text?.includes(tag)) {
                return { text: toolTombstone };
              }

              return p; // Keep tool calls and other parts
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);

          newEvents.push({
            ...event,
            content: {
              ...event.content,
              parts: tombstoneParts,
            },
          });
        } else {
          newEvents.push(event);
        }
      }

      if (evictedCount > 0) {
        await archiveTaskLogs({
          projectRoot,
          sessionId,
          taskId,
          evictedLogs,
          result_summary,
        });

        // Update session history in memory
        (session as unknown as AdkSession).events = newEvents;

        // CRITICAL: InMemorySessionService.getSession() returns a deep clone!
        // We must also update the internal storage so the eviction persists across turns.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const internalStorage = (this.sessionService as any).sessions;
        if (
          internalStorage?.['cognition-cli']?.['cognition-user']?.[sessionId]
        ) {
          internalStorage['cognition-cli']['cognition-user'][sessionId].events =
            [...newEvents];
        }

        systemLog(
          'sigma',
          `Evicted ${evictedCount} log messages (Turn-Range + Surgical) for task ${taskId}. ${process.env.DEBUG_ARCHIVE ? 'Archived to disk.' : ''}`
        );
      } else {
        // Fallback logging: Why did we not evict anything?
        systemLog(
          'sigma',
          `No logs found for eviction for task ${taskId}. (startIndex=${startIndex}, events=${events.length})`,
          { taskId, sessionId, startIndex },
          'warn'
        );
      }
    } catch (err) {
      systemLog(
        'sigma',
        `Failed to prune task logs for ${taskId}`,
        { error: err instanceof Error ? err.message : String(err) },
        'error'
      );
    }
  }

  protected getAdditionalTools(request: AgentRequest): unknown[] {
    const webSearchAgent = new LlmAgent({
      name: 'WebSearch',
      description: 'Search the web using Google Search',
      model: request.model || 'gemini-3-flash-preview',
      instruction: () =>
        'You are a web search specialist. Search Google and return concise results.',
      tools: [GOOGLE_SEARCH],
    });

    return [
      new AgentTool({
        agent: webSearchAgent,
        skipSummarization: false,
      }),
    ];
  }

  /**
   * Internal streaming implementation for Gemini using ADK.
   * Normalizes ADK events into UnifiedStreamingChunks.
   */
  protected async *internalStream(
    request: AgentRequest,
    context: {
      sessionId: string;
      groundingContext: string;
      thinkingBudget: ThinkingBudget;
      systemPrompt: string;
    }
  ): AsyncGenerator<UnifiedStreamingChunk, void, undefined> {
    const { sessionId, thinkingBudget, systemPrompt } = context;

    // 1. Setup Tools
    const tools = [
      ...this.buildTools(
        request,
        'gemini',
        async (
          taskId: string,
          result_summary?: string | null,
          activeSession?: Session
        ) => {
          await this.pruneTaskLogs(
            taskId,
            result_summary,
            sessionId,
            request.cwd || request.projectRoot || process.cwd(),
            activeSession
          );
        }
      ),
      ...this.getAdditionalTools(request),
    ] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

    let activeModel = request.model || 'gemini-3-flash-preview';
    let attempt = 0;
    const maxRetries = 5;
    let retryDelay = 1000;

    const accumulatedThinkingBlocks = new Map<string, string>();
    let accumulatedAssistant = '';

    while (true) {
      try {
        const isGemini3 = activeModel.includes('gemini-3');
        const { thinkingLevel, thinkingBudget: budget } = thinkingBudget;

        const agentInstance = new LlmAgent({
          name: 'cognition_agent',
          model: activeModel,
          instruction: () => systemPrompt,
          tools,
          generateContentConfig: {
            abortSignal: this.abortController?.signal,
            ...(isGemini3
              ? {
                  thinkingConfig: {
                    thinkingLevel,
                    includeThoughts: request.displayThinking !== false,
                  },
                }
              : {
                  thinkingConfig: {
                    thinkingBudget:
                      request.maxThinkingTokens !== undefined
                        ? Math.min(request.maxThinkingTokens, budget)
                        : budget,
                    includeThoughts: request.displayThinking !== false,
                  },
                }),
          } as GeminiGenerateContentConfig,
        });

        const runnerInstance = new Runner({
          agent: agentInstance,
          appName: 'cognition-cli',
          sessionService: this.sessionService,
        });

        this.currentRunner = runnerInstance;
        const userId = 'cognition-user';

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

        const useBidiMode = process.env.GEMINI_USE_BIDI === '1';
        const runOptions: AdkRunOptions = {
          userId,
          sessionId,
          runConfig: {
            streamingMode: useBidiMode ? StreamingMode.BIDI : StreamingMode.SSE,
          },
        };

        let shouldInjectMessage = true;
        const events = (session as unknown as AdkSession).events || [];
        if (events.length > 0) {
          const lookback = Math.min(events.length, 5);
          for (let i = 1; i <= lookback; i++) {
            const msg = events[events.length - i];
            if (
              msg.author === 'user' &&
              msg.content?.parts?.[0]?.text === request.prompt
            ) {
              shouldInjectMessage = false;
              break;
            }
          }
        }

        if (shouldInjectMessage) {
          runOptions.newMessage = {
            role: 'user',
            parts: [{ text: request.prompt }],
          };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const runGenerator = this.currentRunner.runAsync(runOptions as any);
        this.currentGenerator = runGenerator as AsyncGenerator<unknown>;

        for await (const event of runGenerator) {
          if (this.abortController?.signal.aborted) break;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const evt = event as any;
          if (attempt > 0) {
            attempt = 0;
            retryDelay = 1000;
          }

          // Initial estimation if no metadata yet
          if (!evt.usageMetadata && this.usage.prompt === 0) {
            yield {
              type: 'usage',
              usage: {
                prompt: Math.ceil(request.prompt.length / 4),
                completion: 0,
                total: Math.ceil(request.prompt.length / 4),
              },
              retryCount: attempt,
            };
          }

          if (evt.usageMetadata) {
            yield {
              type: 'usage',
              usage: {
                prompt: evt.usageMetadata.promptTokenCount || 0,
                completion:
                  (evt.usageMetadata.candidatesTokenCount || 0) +
                  (evt.usageMetadata.thoughtsTokenCount || 0),
                total: evt.usageMetadata.totalTokenCount || 0,
                cached: evt.usageMetadata.cachedContentTokenCount,
              },
              retryCount: attempt,
            };
          }

          if ((evt.errorCode && evt.errorCode !== 'STOP') || evt.errorMessage) {
            throw new Error(
              `Gemini API Error: ${evt.errorMessage || evt.errorCode}`
            );
          }

          if (evt.author === 'user') continue;

          if (evt.author === 'cognition_agent' && evt.content?.parts) {
            for (const part of evt.content.parts) {
              if (part.thoughtSignature) {
                this.sessionSignatures.set(sessionId, part.thoughtSignature);
              }

              if (part.functionCall) {
                yield {
                  type: 'tool_call',
                  toolCall: {
                    name: part.functionCall.name,
                    args: part.functionCall.args,
                  },
                  retryCount: attempt,
                };
              } else if (part.functionResponse) {
                const activeTaskId = request.anchorId
                  ? getActiveTaskId(
                      request.anchorId,
                      request.cwd || request.projectRoot || process.cwd()
                    )
                  : null;

                if (activeTaskId) {
                  await this.rollingPruneTaskLogs(
                    activeTaskId,
                    sessionId,
                    request.projectRoot || process.cwd(),
                    request.taskLogEvictionThreshold,
                    session!
                  );
                }

                yield {
                  type: 'tool_response',
                  toolResponse: {
                    name: part.functionResponse.name,
                    response: part.functionResponse.response,
                  },
                  retryCount: attempt,
                };
              } else if (part.text || part.thoughtSignature) {
                const isThinking = part.thought === true;
                const isBidi = process.env.GEMINI_USE_BIDI === '1';

                let blockId = 'default';
                let accumulated = '';
                if (isThinking) {
                  const match = part.text?.match(/^\*\*([^*]+)\*\*/);
                  blockId = match ? match[1] : 'default';
                  accumulated = accumulatedThinkingBlocks.get(blockId) || '';
                } else {
                  accumulated = accumulatedAssistant;
                }

                if (
                  !isBidi &&
                  part.text &&
                  accumulated &&
                  (part.text.length <= accumulated.length ||
                    !part.text.startsWith(accumulated))
                ) {
                  continue;
                }

                let deltaText = isBidi
                  ? part.text || ''
                  : (part.text || '').substring(accumulated.length);

                if (isThinking && accumulated && part.text) {
                  const fullHeaderMatch = part.text.match(/^(\*\*([^*]+)\*\*)/);
                  if (fullHeaderMatch && accumulated === fullHeaderMatch[1]) {
                    deltaText = deltaText.replace(/^([\n\r]|\\n)+/, '\n\n');
                  }
                }

                if (!accumulated && part.text) {
                  deltaText = deltaText.replace(/^([\n\r]|\\n)+/, '');
                  if (isThinking) {
                    const headerMatch = deltaText.match(/^(\*\*([^*]+)\*\*)/);
                    if (headerMatch) {
                      const headerPart = headerMatch[1];
                      const contentPart = deltaText.substring(
                        headerPart.length
                      );
                      deltaText =
                        headerPart +
                        contentPart.replace(/^([\n\r]|\\n)+/, '\n\n');
                    }
                  }
                }

                if (!deltaText && !part.thoughtSignature) continue;

                if (isThinking) {
                  accumulatedThinkingBlocks.set(
                    blockId,
                    isBidi
                      ? (accumulatedThinkingBlocks.get(blockId) || '') +
                          (part.text || '')
                      : part.text || ''
                  );
                  yield {
                    type: 'thinking',
                    thought: deltaText,
                    thoughtSignature: part.thoughtSignature,
                    retryCount: attempt,
                  };
                } else {
                  accumulatedAssistant = isBidi
                    ? accumulatedAssistant + (part.text || '')
                    : part.text || accumulatedAssistant;
                  yield {
                    type: 'text',
                    delta: deltaText,
                    thoughtSignature: part.thoughtSignature,
                    retryCount: attempt,
                  };
                }
              }
            }
          }
        }

        this.sessionSignatures.delete(sessionId);
        return; // Success
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const isAbort =
          errorMessage.includes('aborted') ||
          errorMessage.includes('abort') ||
          (errorMessage.includes('JSON') &&
            this.abortController?.signal.aborted);

        if (isAbort) return;

        const isBenignSdkError =
          errorMessage.includes('JSON') &&
          errorMessage.includes('Unexpected token') &&
          (accumulatedAssistant.length > 0 ||
            accumulatedThinkingBlocks.size > 0);

        if (isBenignSdkError) return;

        const isRetryable =
          errorMessage.includes('429') ||
          errorMessage.includes('503') ||
          errorMessage.includes('Resource exhausted') ||
          errorMessage.includes('Service Unavailable') ||
          errorMessage.includes('Deadline exceeded') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('ETIMEDOUT');

        if (isRetryable && attempt < maxRetries) {
          attempt++;

          // Yield current retry count before sleeping
          yield {
            type: 'usage',
            usage: { ...this.usage },
            retryCount: attempt,
          };

          const jitter = Math.random() * 1000;
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay + jitter)
          );
          retryDelay *= 2;

          if (attempt >= 3 && activeModel.includes('preview')) {
            activeModel = 'gemini-3-flash-preview';
          }
          continue;
        }

        throw error;
      }
    }
  }

  /**
   * Interrupt current agent execution
   */
  async interrupt(): Promise<void> {
    await super.interrupt();

    if (this.currentGenerator) {
      try {
        await this.currentGenerator.return(undefined);
      } catch {
        // Ignore generator return errors
      }
    }

    this.currentRunner = null;
    this.currentGenerator = null;
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  /**
   * Generate completion (stub - agent mode is primary interface)
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    throw new Error(
      `GeminiAgentProvider is designed for agent workflows. Use executeAgent() instead. (Request for model: ${request.model})`
    );
  }

  /**
   * Stream completion (stub - agent mode is primary interface)
   */
  async *stream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, undefined> {
    throw new Error(
      `GeminiAgentProvider is designed for agent workflows. Use executeAgent() instead. (Request for model: ${request.model})`
    );
    yield { delta: '', text: '', done: true };
  }

  /**
   * Supports agent mode
   */
  supportsAgentMode(): boolean {
    return true;
  }

  /**
   * Estimate cost for token usage

  /**
   * Estimate cost for token usage
   *
   * Based on Google Gemini pricing as of Feb 2026:
   * - Gemini 3.0 Flash Preview: $0.50/$3.00 per MTok (input/output)
   * - Gemini 3.0/3.1 Pro Preview: $2/$12 per MTok (<=200k context), $4/$18 per MTok (>200k context)
   * - Context: 1M tokens, Output: 64k tokens
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

    const cachedTokens = tokens.cached || 0;
    const nonCachedInputMtokens = (tokens.prompt - cachedTokens) / 1000000;
    const cachedInputMtokens = cachedTokens / 1000000;
    const outputMtokens = tokens.completion / 1000000;

    // Gemini 3.x Pro models (including custom tools variants) - tiered pricing
    if (
      model.includes('-pro') &&
      (model.includes('3.0') ||
        model.includes('3.1') ||
        model.includes('3-pro'))
    ) {
      // >200k tokens prompt = higher tier
      if (tokens.prompt > 200000) {
        return (
          nonCachedInputMtokens * 4.0 +
          cachedInputMtokens * 1.0 + // 75% discount for cached (standard Gemini pricing)
          outputMtokens * 18.0
        );
      }
      // <=200k tokens prompt = lower tier
      return (
        nonCachedInputMtokens * 2.0 +
        cachedInputMtokens * 0.5 + // 75% discount for cached
        outputMtokens * 12.0
      );
    }

    // Gemini 3.0 Flash Preview (default)
    return (
      nonCachedInputMtokens * 0.5 +
      cachedInputMtokens * 0.125 + // 75% discount for cached (standard Gemini pricing)
      outputMtokens * 3.0
    );
  }

  /**
   * Finalize the session and cleanup
   */
  public async cleanup(): Promise<void> {
    // No-op for now as sessionService.clear() does not exist in the current ADK version
  }
}
