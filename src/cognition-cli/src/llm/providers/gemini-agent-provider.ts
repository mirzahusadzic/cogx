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
  // Only models that support extended thinking
  models = [
    'gemini-2.0-flash-thinking-exp-01-21',
    'gemini-2.5-flash', // Supports thinking mode
    'gemini-2.5-pro', // Supports thinking mode
  ];

  private apiKey: string;
  private currentRunner: Runner | null = null;
  private sessionService = new InMemorySessionService();

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
    const cognitionTools = getCognitionTools(
      conversationRegistry,
      request.workbenchUrl
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

    // Combine file tools + web search tool (always enabled)
    const tools = [...cognitionTools, webSearchTool];

    const agent = new LlmAgent({
      name: 'cognition_agent',
      model: request.model || 'gemini-2.5-flash',
      instruction: this.buildSystemPrompt(request),
      tools,
      generateContentConfig: {
        thinkingConfig: {
          // Gemini's max thinking budget is 24,576 tokens
          // Use dynamic thinking (-1) or custom budget (capped at max)
          thinkingBudget:
            request.maxThinkingTokens !== undefined
              ? Math.min(request.maxThinkingTokens, 24576)
              : -1,
          // Enable thought summaries based on displayThinking flag (default: true)
          includeThoughts: request.displayThinking !== false,
        },
      },
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
    let promptTokens = 0;
    let completionTokens = 0;

    // Track if we've yielded any responses (to avoid duplicate final yield)
    let hasYieldedResponse = false;

    // Create or resume session
    const sessionId = request.resumeSessionId || `gemini-${Date.now()}`;
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

    try {
      // Run agent - runAsync returns an async generator
      // Enable SSE streaming mode for real-time response streaming
      const runGenerator = this.currentRunner.runAsync({
        userId,
        sessionId,
        newMessage: {
          role: 'user',
          parts: [{ text: request.prompt }],
        },
        runConfig: {
          streamingMode: StreamingMode.SSE,
        },
      });

      // Process events from the generator
      for await (const event of runGenerator) {
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
        if (evt.usageMetadata) {
          if (evt.usageMetadata.promptTokenCount !== undefined) {
            promptTokens = evt.usageMetadata.promptTokenCount;
          }
          if (evt.usageMetadata.candidatesTokenCount !== undefined) {
            completionTokens = evt.usageMetadata.candidatesTokenCount;
          }
        }

        // Handle error events
        if (evt.errorCode || evt.errorMessage) {
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
                  prompt: promptTokens || Math.ceil(request.prompt.length / 4), // Use API count or fallback to estimation
                  completion: completionTokens || totalTokens, // Use API count or fallback to manual tracking
                  total:
                    (promptTokens || Math.ceil(request.prompt.length / 4)) +
                    (completionTokens || totalTokens),
                },
                finishReason: 'tool_use',
                numTurns,
              };
            }

            // Handle function responses (tool results)
            if (part.functionResponse) {
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
                  prompt: promptTokens || Math.ceil(request.prompt.length / 4),
                  completion: completionTokens || totalTokens,
                  total:
                    (promptTokens || Math.ceil(request.prompt.length / 4)) +
                    (completionTokens || totalTokens),
                },
                finishReason: 'stop',
                numTurns,
              };
            }

            // Handle text responses (both thinking and regular)
            if (part.text) {
              // Check if this is thinking content
              const isThinking = part.thought === true;
              const messageType = isThinking ? 'thinking' : 'assistant';

              // Check if we should append to the last message (streaming accumulation)
              // or create a new message
              const lastMessage = messages[messages.length - 1];
              const shouldAppend =
                lastMessage &&
                lastMessage.type === messageType &&
                lastMessage.role === 'assistant';

              if (shouldAppend) {
                // Append to existing message for streaming
                lastMessage.content =
                  typeof lastMessage.content === 'string'
                    ? lastMessage.content + part.text
                    : part.text;
                if (isThinking) {
                  lastMessage.thinking = lastMessage.content;
                }
              } else {
                // Create new message
                const message: AgentMessage = {
                  id: `msg-${Date.now()}-${numTurns}-${messageType}`,
                  type: messageType,
                  role: 'assistant',
                  content: part.text,
                  timestamp: new Date(),
                };

                // Add thinking field for thinking messages
                if (isThinking) {
                  message.thinking = part.text;
                }

                messages.push(message);
              }

              totalTokens += Math.ceil(part.text.length / 4);

              hasYieldedResponse = true;
              yield {
                messages: [...messages],
                sessionId,
                tokens: {
                  prompt: promptTokens || Math.ceil(request.prompt.length / 4),
                  completion: completionTokens || totalTokens,
                  total:
                    (promptTokens || Math.ceil(request.prompt.length / 4)) +
                    (completionTokens || totalTokens),
                },
                finishReason: 'stop',
                numTurns,
              };
            }
          }
        }
      }

      // Final response with actual token counts from Gemini API
      // Only yield if we haven't yielded any responses yet (edge case: empty response)
      if (!hasYieldedResponse) {
        yield {
          messages: [...messages],
          sessionId,
          tokens: {
            prompt: promptTokens || Math.ceil(request.prompt.length / 4),
            completion: completionTokens || totalTokens,
            total:
              (promptTokens || Math.ceil(request.prompt.length / 4)) +
              (completionTokens || totalTokens),
          },
          finishReason: 'stop',
          numTurns,
        };
      }
    } catch (error) {
      const errorMessage: AgentMessage = {
        id: `msg-${Date.now()}-error`,
        type: 'assistant',
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };
      messages.push(errorMessage);

      yield {
        messages: [...messages],
        sessionId,
        tokens: { prompt: 0, completion: 0, total: 0 },
        finishReason: 'error',
        numTurns,
      };
    } finally {
      this.currentRunner = null;
    }
  }

  /**
   * Interrupt current agent execution
   */
  async interrupt(): Promise<void> {
    // ADK doesn't have direct interrupt support yet
    this.currentRunner = null;
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
   * Build system prompt from request
   */
  private buildSystemPrompt(request: AgentRequest): string {
    if (
      request.systemPrompt?.type === 'custom' &&
      request.systemPrompt.custom
    ) {
      return request.systemPrompt.custom;
    }

    return `You are **Gemini** (Google ADK) running inside **Cognition Σ (Sigma) CLI** - a verifiable AI-human symbiosis architecture with dual-lattice knowledge representation.

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
- **WebSearch**: Search the web for current information, news, facts, and real-time data using Google Search
- **recall_past_conversation**: Search conversation history for past context (if available)

## Working Directory
${request.cwd || process.cwd()}

## Guidelines
- Be concise and helpful
- Use tools proactively to gather context before answering
- When making changes, explain what you're doing briefly
- Prefer editing existing files over creating new ones
- Run tests after making code changes
- Use WebSearch tool when you need current information that might not be in files (e.g., latest docs, recent changes, current events)`;
  }
}
