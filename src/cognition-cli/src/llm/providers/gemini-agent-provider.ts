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
 * EXPERIMENTAL: Google ADK TypeScript SDK is pre-release (v0.1.x)
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
import * as fs from 'fs/promises';
import * as path from 'path';

import { getGroundingContext } from './grounding-utils.js';
import { getDynamicThinkingBudget } from './thinking-utils.js';
import { getActiveTaskId } from '../../sigma/session-state.js';

import { getCognitionTools } from './gemini-adk-tools.js';
import { systemLog } from '../../utils/debug-logger.js';
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
 * Patterns of SDK noise to suppress from stdout.
 * These are typically printed by Google Cloud/Vertex AI SDKs directly to stdout
 * bypassing console.log, or via C++ bindings.
 */
const STDOUT_NOISE_PATTERNS = [
  'Pub/Sub',
  'google-cloud',
  'google-auth',
  'transport',
  'gRPC',
  'ALTS',
  'metadata',
  'credential',
  'Default Credentials',
  '[GoogleAuth]',
  'The user provided Google Cloud credentials',
  'Requesting active client',
  'Sending request',
  'precedence',
  'Vertex AI SDK',
];

/**
 * Check if a string looks like SDK noise that should be suppressed.
 * Heuristic: TUI output usually starts with ANSI escape codes (\x1b).
 * SDK noise usually starts with plain text.
 */
function isStdoutNoise(str: string): boolean {
  // If it starts with ANSI escape code, it's likely TUI/Ink - keep it!
  if (str.startsWith('\x1b')) {
    return false;
  }

  // Check for known noise patterns
  return STDOUT_NOISE_PATTERNS.some((p) => str.includes(p));
}

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
    'gemini-3.1-pro-preview', // Gemini 3.1 Pro preview
    'gemini-3.1-pro-preview-customtools', // Gemini 3.1 Pro with custom tools
    'gemini-3-pro-preview', // Gemini 3.0 Pro with advanced reasoning
  ];

  private apiKey: string;
  private currentRunner: Runner | null = null;
  private sessionService = new InMemorySessionService();
  private abortController: AbortController | null = null;
  private currentGenerator: AsyncGenerator<unknown> | null = null;
  private sessionSignatures = new Map<string, string>();

  /**
   * Create Gemini Agent Provider
   *
   * @param apiKey - Google API key (optional, defaults to GEMINI_API_KEY env var)
   * @throws Error if no API key provided
   */
  constructor(apiKey?: string) {
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

    // Suppress gRPC and Google SDK logging which can leak to stdout/stderr and mess up the TUI.
    // This is especially common when using Vertex AI auth (ALTS warnings, etc.)
    if (!process.env.GRPC_VERBOSITY) {
      process.env.GRPC_VERBOSITY = 'NONE';
    }
    if (!process.env.GOOGLE_SDK_LOG_LEVEL) {
      process.env.GOOGLE_SDK_LOG_LEVEL = 'error';
    }

    // Persistence Hack: Monkey-patch session service once at initialization.
    // Gemini 3 requires thought_signature to resume reasoning, but ADK 0.2.4 doesn't store it.
    // We use a shared map of sessionSignatures to ensure concurrent safety.
    const originalAppendEvent = this.sessionService.appendEvent.bind(
      this.sessionService
    );
    this.sessionService.appendEvent = async (args: {
      session: Session;
      event: Event;
    }) => {
      // Access sessionId via index to satisfy ADK 0.2.4 types without 'any'
      const sessionId = (args.session as unknown as Record<string, string>)
        .sessionId;
      const lastSignature = this.sessionSignatures.get(sessionId);

      if (
        args.event.author === 'cognition_agent' &&
        args.event.content?.parts &&
        lastSignature
      ) {
        // Ensure all parts in the assistant turn have the captured signature.
        // Gemini 3 requires thought_signature for ALL parts (text, thought, functionCall)
        // to maintain reasoning state across turns.
        let injectedCount = 0;
        for (const part of args.event.content.parts) {
          const p = part as { thoughtSignature?: string };
          if (!p.thoughtSignature) {
            p.thoughtSignature = lastSignature;
            injectedCount++;
          }
        }

        if (injectedCount > 0 && process.env.DEBUG_GEMINI_STREAM) {
          systemLog(
            'gemini',
            `[Gemini] Injected signature into ${injectedCount} parts for session ${sessionId}`
          );
        }
      }
      return originalAppendEvent(args);
    };
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
    result_summary: string | undefined,
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

          // Replace with tombstone
          const toolTombstone = result_summary
            ? `[Task ${taskId} completed. Raw logs evicted to archive. \nSUMMARY: ${result_summary}]`
            : `[Task ${taskId} completed: output evicted to archive. Use 'grep' on .sigma/archives/${sessionId}/${taskId}.log if previous logs are needed.]`;

          const assistantTombstone = result_summary
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
        if (process.env.DEBUG_ARCHIVE) {
          // Archive logs to disk
          const archiveDir = path.join(
            projectRoot,
            '.sigma',
            'archives',
            sessionId
          );
          await fs.mkdir(archiveDir, { recursive: true });
          const archivePath = path.join(archiveDir, `${taskId}.log`);

          await fs.appendFile(
            archivePath,
            `\n--- ARCHIVED AT ${new Date().toISOString()} ---\n` +
              evictedLogs.join('\n---\n')
          );
        }

        // Update session history in memory
        (session as unknown as AdkSession).events = newEvents;

        systemLog(
          'sigma',
          `Evicted ${evictedCount} log messages (Turn-Range + Surgical) for task ${taskId}. ${process.env.DEBUG_ARCHIVE ? 'Archived to disk.' : ''}`
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
    // CAPTURE ORIGINALS IMMEDIATELY to prevent any leakage during setup
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;
    const originalStderrWrite = process.stderr.write;
    const originalStdoutWrite = process.stdout.write;
    const originalEmitWarning = process.emitWarning;

    // State variables for tracking conversation and tokens
    // Declared outside try/catch to be available for error handling
    const messages: AgentMessage[] = [];
    let numTurns = 0;
    let currentTurnOutputEstimate = 0;
    let cumulativeCompletionTokens = 0;
    let currentPromptTokens = 0;
    let currentCompletionTokens = 0;
    const accumulatedThinkingBlocks = new Map<string, string>();
    let accumulatedAssistant = '';
    const sessionId =
      request.resumeSessionId ||
      `gemini-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create a null stream sink for stderr/warnings
    const noop = () => true;

    try {
      // 1. SUPPRESS STDERR & WARNINGS COMPLETELY (where gRPC logs go)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      process.stderr.write = noop as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      process.emitWarning = noop as any;

      // 2. FILTER STDOUT: Intercept to block SDK noise but allow TUI/Ink
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      process.stdout.write = ((...args: any[]) => {
        const [chunk] = args;
        const str = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);

        if (isStdoutNoise(str)) {
          if (process.env.DEBUG_GEMINI_STREAM) {
            systemLog(
              'gemini',
              'Suppressed stdout noise',
              { text: str },
              'debug'
            );
          }
          // Invoke callback if provided
          const cb = args[args.length - 1];
          if (typeof cb === 'function') cb();
          return true;
        }

        return (originalStdoutWrite as (...args: unknown[]) => boolean).apply(
          process.stdout,
          args
        );
      }) as typeof process.stdout.write;

      // 3. WRAP CONSOLE METHODS: Catch direct console.log/info/warn usage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createSafeLogger = (originalLogger: (...args: any[]) => void) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (...args: any[]) => {
          const str = args.map((a) => String(a)).join(' ');
          if (isStdoutNoise(str)) {
            if (process.env.DEBUG_GEMINI_STREAM) {
              systemLog(
                'gemini',
                'Suppressed console noise',
                { text: str },
                'debug'
              );
            }
            return;
          }
          originalLogger.apply(console, args);
        };
      };

      console.log = createSafeLogger(originalConsoleLog);
      console.info = createSafeLogger(originalConsoleInfo);
      console.warn = createSafeLogger(originalConsoleWarn);
      console.error = createSafeLogger(originalConsoleError);

      // --- START AGENT SETUP (Now running in silenced environment) ---

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
        | (() =>
            | import('../../ipc/MessagePublisher.js').MessagePublisher
            | null)
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
          onToolOutput: request.onToolOutput, // Pass streaming callback for tools like bash
          onTaskCompleted: async (
            taskId: string,
            result_summary?: string,
            activeSession?: Session
          ) => {
            // Surgical log eviction on task completion
            await this.pruneTaskLogs(
              taskId,
              result_summary,
              sessionId,
              request.cwd || request.projectRoot || process.cwd(),
              activeSession
            );
          },
          mode: request.mode,
          getActiveTaskId: () =>
            request.anchorId
              ? getActiveTaskId(
                  request.anchorId,
                  request.cwd || request.projectRoot || process.cwd()
                )
              : null,
          currentPromptTokens, // Pass current prompt tokens for dynamic optimization
        }
      );

      // Create a specialized web search agent
      const webSearchAgent = new LlmAgent({
        name: 'WebSearch',
        description:
          'Search the web for current information, news, facts, and real-time data using Google Search',
        model: request.model || 'gemini-3-flash-preview',
        instruction:
          'You are a web search specialist. When called, search Google for the requested information and return concise, accurate results with sources.',
        tools: [GOOGLE_SEARCH],
      });

      // Wrap the web search agent as a tool
      const webSearchTool = new AgentTool({
        agent: webSearchAgent,
        skipSummarization: false,
      });

      // Combine cognition tools + web search tool (always enabled)
      const tools = [...cognitionTools, webSearchTool];

      // Handle automated grounding queries if requested
      const groundingContext = await getGroundingContext(request);

      // Create abort controller for cancellation support
      this.abortController = new AbortController();
      const abortSignal = this.abortController.signal;

      let activeModel = request.model || 'gemini-3-flash-preview';
      let attempt = 0;
      const maxRetries = 5;
      let retryDelay = 1000;

      // Add user message to local state once
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
        activeModel,
        messages: [...messages],
        sessionId,
        tokens: {
          prompt: currentPromptTokens || 0,
          completion: currentCompletionTokens || 0,
          total: (currentPromptTokens || 0) + (currentCompletionTokens || 0),
        },
        finishReason: 'stop',
        numTurns: 0,
        retryCount: 0,
      };

      while (true) {
        try {
          const isGemini3 = activeModel.includes('gemini-3');

          // Dynamic Thinking Budgeting:
          const { thinkingLevel, thinkingBudget } = getDynamicThinkingBudget(
            request.remainingTPM
          );

          // Load active context if it exists
          let activeContext = '';
          try {
            const contextPath = path.join(
              request.cwd || request.projectRoot || process.cwd(),
              '.sigma',
              'archives',
              sessionId,
              'active_context.md'
            );
            activeContext = await fs.readFile(contextPath, 'utf-8');
            activeContext = `\n\n## Long Term Working Memory (.sigma/archives/${sessionId}/active_context.md)\n${activeContext}\n`;
          } catch {
            // Ignore error if file doesn't exist or is unreadable
          }

          // Initialize Agent & Runner (No runSilently needed, we are already silent)
          const agentInstance = new LlmAgent({
            name: 'cognition_agent',
            model: activeModel,
            instruction:
              this.buildSystemPrompt(request, sessionId) +
              activeContext +
              (groundingContext
                ? `\n\n## Automated Grounding Context\n${groundingContext}`
                : ''),
            tools,
            generateContentConfig: {
              abortSignal,
              ...(isGemini3
                ? {
                    // GEMINI 3.0 CONFIG (Requires SDK bypass currently)
                    thinkingConfig: {
                      thinkingLevel,
                      includeThoughts: request.displayThinking !== false,
                    },
                  }
                : {
                    // GEMINI 2.5 / LEGACY CONFIG
                    thinkingConfig: {
                      thinkingBudget:
                        request.maxThinkingTokens !== undefined
                          ? Math.min(request.maxThinkingTokens, thinkingBudget)
                          : thinkingBudget,
                      includeThoughts: request.displayThinking !== false,
                    },
                  }),
              // Use custom interface to support experimental thinkingConfig
            } as GeminiGenerateContentConfig,
          });

          const runnerInstance = new Runner({
            agent: agentInstance,
            appName: 'cognition-cli',
            sessionService: this.sessionService,
          });

          this.currentRunner = runnerInstance;

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

          // BIDI vs SSE
          const useBidiMode = process.env.GEMINI_USE_BIDI === '1';

          // Run agent - runAsync returns an async generator
          const runOptions: AdkRunOptions = {
            userId,
            sessionId,
            runConfig: {
              streamingMode: useBidiMode
                ? StreamingMode.BIDI
                : StreamingMode.SSE,
            },
          };

          // Only add newMessage if it's not already in the session history
          // This prevents duplication on retries while ensuring the runner has input
          // if the session was not persisted (e.g. failure during first turn).
          let shouldInjectMessage = true;
          const events = (session as unknown as AdkSession).events || [];
          if (events.length > 0) {
            // Scan last few messages to see if this prompt is already active
            // (Handle cases like autonomous turns or retries where persistence succeeded)
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

          // Use AdkRunOptions cast to satisfy required newMessage in SDK type definition
          // while allowing its absence for session resumption.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const runGenerator = this.currentRunner.runAsync(runOptions as any);

          // Store generator reference for interrupt support
          this.currentGenerator = runGenerator as AsyncGenerator<unknown>;

          // Process events from the generator
          for await (const event of runGenerator) {
            // ... (rest of the processing logic)
            // Check if abort was requested (ESC key pressed)
            if (this.abortController?.signal.aborted) {
              if (process.env.DEBUG_ESC_INPUT) {
                systemLog(
                  'gemini',
                  'Abort signal detected, exiting loop',
                  undefined,
                  'debug'
                );
              }
              // Exit cleanly - don't throw, just break
              break;
            }

            if (process.env.DEBUG_GEMINI_STREAM) {
              systemLog(
                'gemini',
                `Processing event (turn ${numTurns + 1})`,
                undefined,
                'debug'
              );
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
                  thoughtSignature?: string; // encrypted reasoning state for Gemini 3
                  functionCall?: {
                    name: string;
                    args: Record<string, unknown>;
                  };
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

            // Increment turn counter for message indexing and TUI display.
            // We use this to ensure unique IDs for messages within a session.
            // This ensures that we only count CONSECUTIVE failures towards the failover limit.
            // If we receive even one valid event from the model, we consider the connection "working".
            if (attempt > 0) {
              if (process.env.DEBUG_GEMINI_STREAM) {
                systemLog(
                  'gemini',
                  `[Gemini] Resetting retry counter (was ${attempt}) after successful event`
                );
              }
              attempt = 0;
              retryDelay = 1000;
            }

            // Capture actual token usage from Gemini API
            if (evt.usageMetadata) {
              if (evt.usageMetadata.promptTokenCount !== undefined) {
                // Trust the API's reported promptTokenCount for current context size.
                currentPromptTokens = evt.usageMetadata.promptTokenCount;
              }
              if (
                evt.usageMetadata.totalTokenCount !== undefined &&
                evt.usageMetadata.promptTokenCount !== undefined
              ) {
                cumulativeCompletionTokens +=
                  evt.usageMetadata.totalTokenCount -
                  evt.usageMetadata.promptTokenCount -
                  currentCompletionTokens;

                currentCompletionTokens =
                  evt.usageMetadata.totalTokenCount -
                  evt.usageMetadata.promptTokenCount;
              } else if (evt.usageMetadata.candidatesTokenCount !== undefined) {
                // Fallback if totalTokenCount is missing
                cumulativeCompletionTokens +=
                  evt.usageMetadata.candidatesTokenCount -
                  currentCompletionTokens;
                currentCompletionTokens =
                  evt.usageMetadata.candidatesTokenCount;
              }
            }

            // Handle error events (but skip "STOP" which is a normal finish reason, not an error)
            if (
              (evt.errorCode && evt.errorCode !== 'STOP') ||
              evt.errorMessage
            ) {
              const errorMsg =
                evt.errorMessage || `Error code: ${evt.errorCode}`;
              throw new Error(`Gemini API Error: ${errorMsg}`);
            }

            // Skip user echo events
            if (evt.author === 'user') {
              continue;
            }

            // Handle assistant/model responses
            if (evt.author === 'cognition_agent' && evt.content?.parts) {
              for (const part of evt.content.parts) {
                // Capture thought signature into ADK session history to prevent looping
                // Gemini 3 requires the thought_signature to be present in subsequent turns
                // to resume reasoning state. ADK 0.2.4 doesn't handle this automatically.
                if (part.thoughtSignature) {
                  this.sessionSignatures.set(sessionId, part.thoughtSignature);
                }

                // Handle function calls (tool use)
                if (part.functionCall) {
                  if (process.env.DEBUG_GEMINI_STREAM) {
                    systemLog(
                      'gemini',
                      `\n[Gemini] === TOOL CALL: ${part.functionCall.name} ===`
                    );
                  }

                  // Don't pre-format - let TUI handle formatting via toolName/toolInput
                  numTurns++;
                  const toolMessage: AgentMessage = {
                    id: `msg-${Date.now()}-tool-${numTurns}`,
                    type: 'tool_use',
                    role: 'assistant',
                    content: '', // TUI will format using toolName and toolInput
                    timestamp: new Date(),
                    toolName: part.functionCall.name,
                    toolInput: part.functionCall.args,
                    thoughtSignature: part.thoughtSignature,
                  };
                  messages.push(toolMessage);

                  yield {
                    activeModel,
                    messages: [...messages],
                    sessionId,
                    tokens: {
                      prompt:
                        currentPromptTokens ||
                        Math.ceil(request.prompt.length / 4),
                      completion:
                        currentCompletionTokens || currentTurnOutputEstimate,
                      total:
                        (currentPromptTokens ||
                          Math.ceil(request.prompt.length / 4)) +
                        (currentCompletionTokens || currentTurnOutputEstimate),
                    },
                    finishReason: 'tool_use',
                    numTurns,
                  };

                  // Reset turn-specific accumulators after tool use - next assistant message will be a new response
                  if (process.env.DEBUG_GEMINI_STREAM) {
                    systemLog(
                      'gemini',
                      '[Gemini] Resetting turn accumulators (post-tool-use)'
                    );
                  }
                  accumulatedAssistant = '';
                  accumulatedThinkingBlocks.clear();
                  currentTurnOutputEstimate = 0;
                } else if (part.functionResponse) {
                  if (process.env.DEBUG_GEMINI_STREAM) {
                    // Always log for now to debug bash
                    systemLog(
                      'gemini',
                      `\n[Gemini] === TOOL RESULT: ${part.functionResponse.name} ===`
                    );
                    systemLog(
                      'gemini',
                      `[Gemini] Result type: ${typeof part.functionResponse.response}`
                    );
                  }

                  numTurns++;
                  const resultMessage: AgentMessage = {
                    id: `msg-${Date.now()}-result-${numTurns}`,
                    type: 'tool_result',
                    role: 'user',
                    content: (function () {
                      const resp = part.functionResponse.response;
                      if (typeof resp === 'string') return resp;
                      if (
                        resp &&
                        typeof resp === 'object' &&
                        'result' in resp &&
                        typeof (resp as Record<string, unknown>).result ===
                          'string'
                      ) {
                        return (resp as Record<string, unknown>)
                          .result as string;
                      }
                      return JSON.stringify(resp);
                    })(),
                    timestamp: new Date(),
                    toolName: part.functionResponse.name,
                  };
                  messages.push(resultMessage);

                  yield {
                    activeModel,
                    messages: [...messages],
                    sessionId,
                    tokens: {
                      prompt:
                        currentPromptTokens ||
                        Math.ceil(request.prompt.length / 4),
                      completion:
                        currentCompletionTokens ||
                        currentTurnOutputEstimate ||
                        0,
                      total:
                        (currentPromptTokens ||
                          Math.ceil(request.prompt.length / 4)) +
                        (currentCompletionTokens || currentTurnOutputEstimate),
                    },
                    finishReason: 'tool_use', // Tool result, not stop - agent continues
                    numTurns,
                    // Pass back the tool result information for compression triggers
                    toolResult: {
                      name: part.functionResponse.name,
                      response: part.functionResponse.response,
                    },
                  };

                  // Reset turn-specific accumulators after tool result - next assistant message will be a new response
                  if (process.env.DEBUG_GEMINI_STREAM) {
                    systemLog(
                      'gemini',
                      '[Gemini] Resetting turn accumulators (post-tool-result)'
                    );
                  }
                  accumulatedAssistant = '';
                  accumulatedThinkingBlocks.clear();
                  currentTurnOutputEstimate = 0;
                } else if (part.text || part.thoughtSignature) {
                  // Check if this is thinking content
                  const isThinking = part.thought === true;
                  const messageType = isThinking ? 'thinking' : 'assistant';

                  if (process.env.DEBUG_GEMINI_STREAM) {
                    systemLog(
                      'gemini',
                      `\n[Gemini] === NEW EVENT: ${messageType} (${part.text?.length || 0} chars) ===`
                    );
                    if (part.text) {
                      systemLog(
                        'gemini',
                        `[Gemini] Text preview: "${part.text.substring(0, 256)}..."`
                      );
                    }
                    if (part.thoughtSignature) {
                      systemLog(
                        'gemini',
                        `[Gemini] Thought Signature present: ${part.thoughtSignature.substring(0, 20)}...`
                      );
                    }
                  }

                  // SSE mode sends FULL accumulated text each time, not deltas
                  // For thinking blocks, extract block ID from header (e.g., "**Analyzing Code**")
                  let blockId = '';
                  let accumulated = '';

                  if (isThinking) {
                    // Extract thinking block header (first line, usually bold)
                    const match = part.text?.match(/^\*\*([^*]+)\*\*/);
                    blockId = match ? match[1] : 'default';
                    accumulated = accumulatedThinkingBlocks.get(blockId) || '';
                  } else {
                    accumulated = accumulatedAssistant;
                  }

                  if (process.env.DEBUG_GEMINI_STREAM) {
                    systemLog(
                      'gemini',
                      `[Gemini] Accumulated: ${accumulated.length} chars: "${accumulated.substring(0, 100)}..."`
                    );
                  }

                  // Skip if no new content (shorter than current accumulated = stale event)
                  // Only applicable for SSE (cumulative) mode. BIDI sends deltas.
                  const isBidi = process.env.GEMINI_USE_BIDI === '1';

                  if (
                    !isBidi &&
                    part.text &&
                    accumulated &&
                    part.text.length <= accumulated.length
                  ) {
                    if (process.env.DEBUG_GEMINI_STREAM) {
                      systemLog(
                        'gemini',
                        `[Gemini] SKIP: No new content (${part.text.length} <= ${accumulated.length})`
                      );
                    }
                    continue;
                  }

                  // Verify this is a legitimate continuation (not a restructured/combined event)
                  // Both thinking AND assistant messages can get restructured by Gemini
                  // Only applicable for SSE (cumulative) mode.
                  if (
                    !isBidi &&
                    part.text &&
                    accumulated &&
                    !part.text.startsWith(accumulated)
                  ) {
                    if (process.env.DEBUG_GEMINI_STREAM) {
                      systemLog(
                        'gemini',
                        `[Gemini] SKIP: ${messageType} doesn't start with accumulated (restructured event)`
                      );
                    }
                    // This is likely a restructured event with different text
                    continue;
                  }

                  // Extract delta text (only the new portion)
                  // In BIDI mode, part.text IS the delta.
                  // In SSE mode, part.text IS the full text.
                  let deltaText = isBidi
                    ? part.text || ''
                    : (part.text || '').substring(accumulated.length);

                  // Special handling for thinking block headers to ensure clean spacing
                  // This handles cases where the header and content are in different chunks
                  if (isThinking && accumulated && part.text) {
                    const fullHeaderMatch =
                      part.text.match(/^(\*\*([^*]+)\*\*)/);
                    if (fullHeaderMatch && accumulated === fullHeaderMatch[1]) {
                      // We just finished the header and are starting the content in this chunk
                      deltaText = deltaText.replace(/^([\n\r]|\\n)+/, '\n\n');
                    }
                  }

                  // Trim leading newlines from the first chunk of any message
                  if (!accumulated && part.text) {
                    deltaText = deltaText.replace(/^([\n\r]|\\n)+/, '');

                    if (isThinking) {
                      // For thinking blocks, ensure a double newline after the header
                      // Header is usually **Thinking** or similar
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

                  if (process.env.DEBUG_GEMINI_STREAM) {
                    systemLog(
                      'gemini',
                      `[Gemini] Delta (${deltaText.length} chars): "${deltaText.substring(0, 100)}..."`
                    );
                  }

                  // Skip if delta is empty (final event or just a signature update)
                  // We capture the signature in the last message to preserve state without
                  // pushing empty messages that break the TUI's streaming tool output logic.
                  if (!deltaText || deltaText.trim().length === 0) {
                    if (process.env.DEBUG_GEMINI_STREAM) {
                      systemLog(
                        'gemini',
                        `[Gemini] SKIP: Empty delta (signature: ${!!part.thoughtSignature})`
                      );
                    }

                    if (part.thoughtSignature && messages.length > 0) {
                      // Only update assistant or thinking messages, never tool results
                      for (let i = messages.length - 1; i >= 0; i--) {
                        if (
                          messages[i].role === 'assistant' ||
                          messages[i].type === 'thinking'
                        ) {
                          messages[i].thoughtSignature = part.thoughtSignature;
                          break;
                        }
                      }
                    }

                    // Update accumulated tracker even though we're skipping
                    if (isThinking) {
                      const current =
                        accumulatedThinkingBlocks.get(blockId) || '';
                      accumulatedThinkingBlocks.set(
                        blockId,
                        isBidi
                          ? current + (part.text || '')
                          : part.text || current
                      );
                    } else {
                      if (isBidi) {
                        accumulatedAssistant += part.text || '';
                      } else {
                        accumulatedAssistant =
                          part.text || accumulatedAssistant;
                      }
                    }
                    continue;
                  }

                  // Update accumulated trackers
                  if (isThinking) {
                    const current =
                      accumulatedThinkingBlocks.get(blockId) || '';
                    accumulatedThinkingBlocks.set(
                      blockId,
                      isBidi
                        ? current + (part.text || '')
                        : part.text || current
                    );
                  } else {
                    if (isBidi) {
                      accumulatedAssistant += part.text || '';
                    } else {
                      accumulatedAssistant = part.text || accumulatedAssistant;
                    }
                  }

                  if (process.env.DEBUG_GEMINI_STREAM && deltaText) {
                    systemLog(
                      'gemini',
                      `[Gemini] ✓ YIELDING delta, new total: ${part.text?.length || 0} chars`
                    );
                  }

                  // Increment turn counter for message indexing and TUI display.
                  // Only increment for the FIRST chunk of a new assistant response.
                  if (!accumulated) {
                    numTurns++;
                  }

                  // Create new message with delta text
                  // The TUI will accumulate these deltas via processAgentMessage
                  const message: AgentMessage = {
                    id: `msg-${Date.now()}-${numTurns}-${messageType}`,
                    type: messageType,
                    role: 'assistant',
                    content: deltaText, // Send only the delta
                    timestamp: new Date(),
                    thoughtSignature: part.thoughtSignature,
                  };

                  if (isThinking) {
                    message.thinking = deltaText;
                  }

                  messages.push(message);

                  currentTurnOutputEstimate += Math.ceil(
                    (part.text?.length || 0) / 4
                  );

                  yield {
                    activeModel,
                    messages: [...messages],
                    sessionId,
                    tokens: {
                      prompt:
                        currentPromptTokens ||
                        Math.ceil(request.prompt.length / 4),
                      completion:
                        currentCompletionTokens ||
                        currentTurnOutputEstimate ||
                        0,
                      total:
                        (currentPromptTokens ||
                          Math.ceil(request.prompt.length / 4)) +
                        (currentCompletionTokens || currentTurnOutputEstimate),
                    },
                    finishReason: 'stop',
                    numTurns,
                    retryCount: attempt,
                  };
                }
              }
            }
          }

          // Final response with actual token counts from Gemini API
          // Always yield final response to signal completion (even if we've yielded before)
          if (process.env.DEBUG_GEMINI_STREAM) {
            systemLog(
              'gemini',
              `\n[Gemini] === STREAM LOOP EXITED ===\n[Gemini] Total turns: ${numTurns}\n[Gemini] Total tokens billed (estimated): ${currentPromptTokens + cumulativeCompletionTokens}\n[Gemini] Current context: ${currentPromptTokens} prompt, ${currentCompletionTokens} completion\n[Gemini] Last message type: ${messages[messages.length - 1]?.type || 'none'}\n[Gemini] Yielding final response with finishReason='stop'`
            );
          }
          yield {
            activeModel,
            messages: [...messages],
            sessionId,
            tokens: {
              prompt:
                currentPromptTokens || Math.ceil(request.prompt.length / 4),
              completion: currentCompletionTokens || currentTurnOutputEstimate,
              total:
                (currentPromptTokens || Math.ceil(request.prompt.length / 4)) +
                (currentCompletionTokens || currentTurnOutputEstimate),
            },
            finishReason: 'stop',
            numTurns,
            retryCount: 0, // Reset UI on success
          };

          // Reset retry attempt counter on success!
          // This ensures that transient errors don't accumulate across turns
          // and only consecutive failures lead to failover.
          attempt = 0;

          break; // SUCCESS: Exit retry loop
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
            (errorMessage.includes('JSON') &&
              this.abortController?.signal.aborted);

          if (isAbort) {
            if (process.env.DEBUG_ESC_INPUT) {
              systemLog('gemini', '[Gemini] Caught abort-related error:', {
                error: errorMessage,
              });
            }
            break; // Exit loop on abort
          }

          // ADK SDK (experimental v0.1.x) can throw JSON parsing errors in both SSE and BIDI modes
          // These are typically benign SDK bugs when the stream ends, not real errors
          const hasAssistantMessages = messages.some(
            (m) => m.type === 'assistant' || m.type === 'thinking'
          );
          const isBenignSdkError =
            errorMessage.includes('JSON') &&
            errorMessage.includes('Unexpected token') &&
            hasAssistantMessages;

          if (isBenignSdkError) {
            if (process.env.DEBUG_GEMINI_STREAM) {
              systemLog(
                'gemini',
                '[Gemini] Ignoring benign ADK SDK JSON parsing error:',
                { error: errorMessage }
              );
            }
            break; // Exit loop on benign SDK error (treat as success)
          }

          // CHECK FOR RETRYABLE ERRORS (429, 503, etc.)
          const isRetryable =
            errorMessage.includes('429') ||
            errorMessage.includes('503') ||
            errorMessage.includes('Resource exhausted') ||
            errorMessage.includes('Service Unavailable') ||
            errorMessage.includes('Deadline exceeded') ||
            errorMessage.includes('Unknown error') ||
            errorMessage.includes('Internal error') ||
            errorMessage.includes('Internal Server Error') ||
            errorMessage.includes('ECONNRESET') ||
            errorMessage.includes('ETIMEDOUT');

          if (isRetryable && attempt < maxRetries) {
            attempt++;

            // Log retry attempt
            systemLog(
              'gemini',
              `[Gemini] Hit retryable error (${errorMessage}). Retrying in ${retryDelay}ms... (Attempt ${attempt}/${maxRetries})`,
              undefined,
              'warn'
            );

            // Yield state to TUI with retryCount to trigger UI feedback
            yield {
              activeModel,
              messages: [...messages],
              sessionId,
              tokens: {
                prompt:
                  currentPromptTokens || Math.ceil(request.prompt.length / 4),
                completion:
                  currentCompletionTokens || currentTurnOutputEstimate,
                total:
                  (currentPromptTokens ||
                    Math.ceil(request.prompt.length / 4)) +
                  (currentCompletionTokens || currentTurnOutputEstimate),
              },
              finishReason: 'stop', // Keep as stop so TUI continues to show "Thinking"
              numTurns,
              retryCount: attempt,
            };

            // Wait with exponential backoff + jitter
            const jitter = Math.random() * 1000;
            await new Promise((resolve) =>
              setTimeout(resolve, retryDelay + jitter)
            );
            retryDelay *= 2;

            // FALLOVER PATTERN: Switch to more stable model if preview fails repeatedly
            if (attempt >= 3 && activeModel.includes('preview')) {
              const fallback = 'gemini-3-flash-preview';
              systemLog(
                'gemini',
                `[Gemini] Falling back to stable model: ${fallback} after ${attempt} failures`,
                undefined,
                'warn'
              );
              activeModel = fallback;
            }

            continue; // RETRY
          }

          // NOT RETRYABLE or MAX RETRIES REACHED
          // Only show error message if it's not an abort or benign SDK error
          const errorMsg: AgentMessage = {
            id: `msg-${Date.now()}-error`,
            type: 'assistant',
            role: 'assistant',
            content: `Error: ${errorMessage}`,
            timestamp: new Date(),
          };
          messages.push(errorMsg);

          yield {
            activeModel,
            messages: [...messages],
            sessionId,
            tokens: {
              prompt:
                currentPromptTokens || Math.ceil(request.prompt.length / 4),
              completion: currentCompletionTokens || currentTurnOutputEstimate,
              total:
                (currentPromptTokens || Math.ceil(request.prompt.length / 4)) +
                (currentCompletionTokens || currentTurnOutputEstimate),
            },
            finishReason: 'error',
            numTurns,
          };
          break; // Exit loop after yielding error
        }
      }
    } finally {
      // Clean up session signature to avoid memory leaks
      this.sessionSignatures.delete(sessionId);

      // Restore original console and streams
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      console.info = originalConsoleInfo;
      process.stderr.write = originalStderrWrite;
      process.stdout.write = originalStdoutWrite;
      process.emitWarning = originalEmitWarning;

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
      systemLog('gemini', '[Gemini] interrupt() called');
    }

    // Signal abort for the loop check
    if (this.abortController) {
      if (process.env.DEBUG_ESC_INPUT) {
        systemLog('gemini', '[Gemini] Aborting controller');
      }
      this.abortController.abort();
    }

    // Force the generator to exit (since ADK doesn't support native cancellation)
    if (this.currentGenerator) {
      try {
        if (process.env.DEBUG_ESC_INPUT) {
          systemLog('gemini', '[Gemini] Calling generator.return()');
        }
        await this.currentGenerator.return(undefined);
        if (process.env.DEBUG_ESC_INPUT) {
          systemLog('gemini', '[Gemini] generator.return() completed');
        }
      } catch (err) {
        if (process.env.DEBUG_ESC_INPUT) {
          systemLog('gemini', '[Gemini] generator.return() error:', {
            error: err,
          });
        }
      }
    }

    this.currentRunner = null;
    this.currentGenerator = null;
    if (process.env.DEBUG_ESC_INPUT) {
      systemLog('gemini', '[Gemini] interrupt() completed');
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
  estimateCost(
    tokens: { prompt: number; completion: number; total: number },
    model: string
  ): number {
    const inputMtokens = tokens.prompt / 1000000;
    const outputMtokens = tokens.completion / 1000000;

    // Gemini 3.0 Pro Preview - tiered pricing
    if (model.includes('3-pro')) {
      // >200k tokens = higher tier
      if (tokens.total > 200000) {
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
  private buildSystemPrompt(request: AgentRequest, sessionId?: string): string {
    if (
      request.systemPrompt?.type === 'custom' &&
      request.systemPrompt.custom
    ) {
      return request.systemPrompt.custom;
    }

    const modelName = request.model || 'Gemini';
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const isSolo = request.mode === 'solo';
    const currentSessionId = sessionId || 'current_session';

    const delegationExample = isSolo
      ? ''
      : `
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
`;

    const taskStateRules = isSolo
      ? `### Task State Rules
1. **Task States**: pending (not started), in_progress (currently working), completed (finished)
2. **Task-First (Token Health)**: ALWAYS mark a task as \`in_progress\` BEFORE running tools (research, read_file, bash, etc.). This ensures tool outputs are tagged with the active task ID for surgical context eviction upon completion.
   - **CRITICAL**: You are FORBIDDEN from using \`read_file\`, \`grep\`, or \`bash\` unless a task is explicitly in the \`in_progress\` state. If you need to explore, create a task "Explore codebase" and mark it \`in_progress\` FIRST.
3. **One at a time**: Exactly ONE task should be in_progress at any time
4. **Immediate completion**: Mark tasks complete IMMEDIATELY after finishing to trigger log eviction and reclaim tokens.
5. **Micro-Tasking for Research**: Before executing heavy tools like \`grep\` or \`read_file\`, create a highly specific task (e.g., "Research auth module line 40-100"). Mark it completed IMMEDIATELY after extracting the insight to quickly flush the heavy logs.
6. **Persistence via Summary**: The raw logs of a completed task (file contents, grep results) WILL BE DELETED immediately.
   - You MUST distill all critical findings into the \`result_summary\` field of SigmaTaskUpdate.
   - Do not write "Done" or "Found it". Write "Found API key in config.ts line 45" or "UserController.ts handles auth logic".
   - If the \`result_summary\` is empty or vague, you will lose the knowledge required for subsequent tasks.
7. **Honest completion**: ONLY mark completed when FULLY accomplished - if blocked, keep in_progress and add a new task for the blocker.
8. **Both forms required**: Always provide content (imperative: "Fix bug") AND activeForm (continuous: "Fixing bug")`
      : `### Task State Rules
1. **Task States**: pending (not started), in_progress (currently working), completed (finished), delegated (assigned to another agent)
2. **Task-First (Token Health)**: ALWAYS mark a task as \`in_progress\` BEFORE running tools (research, read_file, bash, etc.). This ensures tool outputs are tagged with the active task ID for surgical context eviction upon completion.
   - **CRITICAL**: You are FORBIDDEN from using \`read_file\`, \`grep\`, or \`bash\` unless a task is explicitly in the \`in_progress\` state. If you need to explore, create a task "Explore codebase" and mark it \`in_progress\` FIRST.
3. **One at a time**: Exactly ONE task should be in_progress at any time
4. **Delegation**: When delegating, set status to 'delegated' AND send IPC message. Do not mark completed until worker reports back.
5. **Immediate completion**: Mark tasks complete IMMEDIATELY after finishing to trigger log eviction and reclaim tokens.
6. **Micro-Tasking for Research**: Before executing heavy tools like \`grep\` or \`read_file\`, create a highly specific task (e.g., "Research auth module line 40-100"). Mark it completed IMMEDIATELY after extracting the insight to quickly flush the heavy logs.
7. **Persistence via Summary**: The raw logs of a completed task (file contents, grep results) WILL BE DELETED immediately.
   - You MUST distill all critical findings into the \`result_summary\` field of SigmaTaskUpdate.
   - Do not write "Done" or "Found it". Write "Found API key in config.ts line 45" or "UserController.ts handles auth logic".
   - If the \`result_summary\` is empty or vague, you will lose the knowledge required for subsequent tasks.
8. **Honest completion**: ONLY mark completed when FULLY accomplished - if blocked, keep in_progress and add a new task for the blocker.
9. **Both forms required**: Always provide content (imperative: "Fix bug") AND activeForm (continuous: "Fixing bug")`;

    const memoryRules = `
### 🧠 MEMORY & EVICTION RULES (CRITICAL)
1. **The "Amnesia" Warning**: When you mark a task as \`completed\`, the system IMMEDIATELY deletes all tool outputs (file reads, grep results, bash logs) associated with that task.
2. **Distill Before Dying**: You are FORBIDDEN from completing a task until you have saved the *essential findings*.
   - **Simple Findings**: Write them into the \`result_summary\` field of \`SigmaTaskUpdate\`.
   - **Complex Findings (Code/Diffs)**: Write them to \`.sigma/archives/${currentSessionId}/active_context.md\` using \`write_file\` or \`edit_file\` before completing the task.
3. **Context Grooming**: Treat \`active_context.md\` as a volatile scratchpad. When a sub-project is finished, proactively delete obsolete notes from it using \`edit_file\` to keep your baseline context lean.
4. **Verification**: Before calling \`SigmaTaskUpdate(status='completed')\`, ask yourself: "If I lose all my previous logs right now, do I have enough info in the summary/scratchpad to continue?"
`;

    return (
      `You are **${modelName}** (Google ADK) running inside **Cognition Σ (Sigma) CLI** - a verifiable AI-human symbiosis architecture with dual-lattice knowledge representation.

**Current Date**: ${currentDate}

## What is Cognition Σ?
A portable cognitive layer that can be initialized in **any repository**. Creates \`.sigma/\` (conversation memory) and \`.open_cognition/\` (PGC project knowledge store) in the current working directory.
${memoryRules}
## Your Capabilities
You have access to environment tools defined in your schema. Prioritize using them proactively.

## Guidelines
- Be concise and helpful
- **Reasoning First**: For any complex operation or tool call (especially \`SigmaTaskUpdate\`, \`edit_file\`${isSolo ? '' : ', or IPC delegation'}), you MUST engage your internal reasoning/thinking process first to plan the action and validate parameters. **CRITICAL: NEVER include the JSON for SigmaTaskUpdate in your assistant response text. ONLY use it as the direct input to the SigmaTaskUpdate tool call.**
  When planning \`SigmaTaskUpdate\`, ensure your JSON structure matches the parallel array pattern (inside your internal thought block, not the response):
  \`\`\`json
  {
    "todos": [
      { "id": "task-1", "content": "Task description", "activeForm": "Doing task", "status": "completed", "result_summary": "Summary of findings (min 15 chars)" }
    ],
    "grounding": [
      { "id": "task-1", "strategy": "pgc_first" }
    ]
  }
  \`\`\`
- Use tools proactively to gather context before answering
- When making changes, explain what you're doing briefly
- Prefer editing existing files over creating new ones
- Run tests after making code changes
- Use WebSearch tool when you need current information that might not be in files (e.g., latest docs, recent changes, current events)

## Task Management
You have access to the SigmaTaskUpdate tool to help you manage and plan tasks. Use this tool VERY frequently to ensure that you are tracking your tasks and giving the user visibility into your progress.
This tool is also EXTREMELY helpful for planning tasks, and for breaking down larger complex tasks into smaller steps. If you do not use this tool when planning, you may forget to do important tasks - and that is unacceptable.
**Planning in your internal thought blocks before calling SigmaTaskUpdate ensures reliable task tracking and prevents malformed tool arguments.**

It is critical that you mark tasks as completed as soon as you are done with a task. Do not batch up multiple tasks before marking them as completed.

### Semantic Checkpointing (TPM Optimization)
Gemini has a 1,000,000 TPM limit. Large tool outputs and deep thinking can quickly exhaust this.
- **Trigger Compression**: Use \`SigmaTaskUpdate\` to mark a task as \`completed\` to trigger "Semantic Compression". This flushes implementation noise (logs, previous file reads) while keeping your high-level plan in context.
- **Proactive Management**: If you see a \`<token-pressure-warning>\`, it means your context is getting large (~50k+ tokens). You should aim to finish your current sub-task and mark it completed to clear the air before starting the next phase.
- **Granularity**: Prefer smaller, focused tasks over one giant task. Every time you mark a task completed, the system has an opportunity to optimize your "Mental Map".

### Examples of Task Management

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
${delegationExample}
**Example ${isSolo ? '3' : '4'}: When NOT to use SigmaTaskUpdate**
User: "How do I print 'Hello World' in Python?"
Do NOT use SigmaTaskUpdate - this is a simple, trivial task with no multi-step implementation.

User: "Add a comment to the calculateTotal function"
Do NOT use SigmaTaskUpdate - this is a single, straightforward task.

${taskStateRules}

IMPORTANT: Always use the SigmaTaskUpdate tool to plan and track tasks throughout the conversation.

## Token Economy (IMPORTANT - Each tool call costs tokens!)
- **NEVER re-read files you just edited** - you already have the content in context
- **Use glob/grep BEFORE read_file** - find specific content instead of reading entire files
- **Surgical Reads ONLY**: NEVER use \`read_file\` without \`offset\` and \`limit\` unless the file is under 100 lines. Always use \`grep\` with \`-n\` to find exact line numbers first. 
- **Batch operations** - if you need multiple files, plan which ones first, then read them efficiently
- **Use limit/offset for large files** - read only the sections you need
- **Avoid redundant reads** - if you read a file earlier in this conversation, don't read it again unless it changed
- **Summarize don't quote** - explain findings concisely rather than quoting entire file contents` +
      (request.systemPrompt?.append ? `\n\n${request.systemPrompt.append}` : '')
    );
  }
}
