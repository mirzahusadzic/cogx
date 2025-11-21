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
 * const provider = new GeminiAgentProvider(process.env.GOOGLE_API_KEY);
 *
 * for await (const response of provider.executeAgent({
 *   prompt: 'Analyze this codebase',
 *   model: 'gemini-2.5-flash',
 *   cwd: process.cwd()
 * })) {
 *   console.log(response.messages);
 * }
 */

import { LlmAgent, Runner, InMemorySessionService } from '@google/adk';
import { GeminiProvider } from './gemini-provider.js';
import { getCognitionTools } from './gemini-adk-tools.js';
import type {
  AgentProvider,
  AgentRequest,
  AgentResponse,
  AgentMessage,
} from '../agent-provider-interface.js';

/**
 * Gemini Agent Provider
 *
 * Implements AgentProvider using Google ADK for agent workflows.
 *
 * DESIGN:
 * - Extends GeminiProvider for basic LLM capabilities
 * - Uses Google ADK LlmAgent for agent orchestration
 * - Tool support coming in Phase 3
 * - Handles streaming via ADK Runner
 */
export class GeminiAgentProvider
  extends GeminiProvider
  implements AgentProvider
{
  override name = 'gemini';
  private currentRunner: Runner | null = null;
  private sessionService = new InMemorySessionService();

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
    // Get Cognition tools mapped to ADK format
    const tools = getCognitionTools();

    const agent = new LlmAgent({
      name: 'cognition_agent',
      model: request.model || 'gemini-2.5-flash',
      instruction: this.buildSystemPrompt(request),
      tools,
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
      const runGenerator = this.currentRunner.runAsync({
        userId,
        sessionId,
        newMessage: {
          role: 'user',
          parts: [{ text: request.prompt }],
        },
      });

      // Process events from the generator
      for await (const event of runGenerator) {
        // Cast event to access properties (ADK types are not well defined yet)
        const evt = event as unknown as Record<string, unknown>;
        numTurns++;

        // Handle tool calls (function_call events)
        if (evt.type === 'function_call' || evt.functionCall) {
          const funcCall = (evt.functionCall || evt) as {
            name?: string;
            args?: Record<string, unknown>;
          };
          const toolMessage: AgentMessage = {
            id: `msg-${Date.now()}-tool-${numTurns}`,
            type: 'tool_use',
            role: 'assistant',
            content: JSON.stringify(funcCall.args || {}),
            timestamp: new Date(),
            toolName: funcCall.name,
            toolInput: funcCall.args,
          };
          messages.push(toolMessage);

          yield {
            messages: [...messages],
            sessionId,
            tokens: {
              prompt: Math.ceil(request.prompt.length / 4),
              completion: totalTokens,
              total: Math.ceil(request.prompt.length / 4) + totalTokens,
            },
            finishReason: 'tool_use',
            numTurns,
          };
          continue;
        }

        // Handle tool results (function_response events)
        if (evt.type === 'function_response' || evt.functionResponse) {
          const funcResp = (evt.functionResponse || evt) as {
            name?: string;
            response?: unknown;
          };
          const resultMessage: AgentMessage = {
            id: `msg-${Date.now()}-result-${numTurns}`,
            type: 'tool_result',
            role: 'user',
            content:
              typeof funcResp.response === 'string'
                ? funcResp.response
                : JSON.stringify(funcResp.response),
            timestamp: new Date(),
            toolName: funcResp.name,
          };
          messages.push(resultMessage);

          yield {
            messages: [...messages],
            sessionId,
            tokens: {
              prompt: Math.ceil(request.prompt.length / 4),
              completion: totalTokens,
              total: Math.ceil(request.prompt.length / 4) + totalTokens,
            },
            finishReason: 'stop',
            numTurns,
          };
          continue;
        }

        // Handle text responses
        if (evt.type === 'agent_response' || evt.content) {
          let textContent = '';
          if (typeof evt.content === 'string') {
            textContent = evt.content;
          } else if (evt.response && typeof evt.response === 'object') {
            const resp = evt.response as { parts?: Array<{ text?: string }> };
            const textParts = resp.parts?.filter((p) => p.text);
            textContent = textParts?.map((p) => p.text).join('') || '';
          }

          if (textContent) {
            const assistantMessage: AgentMessage = {
              id: `msg-${Date.now()}-${numTurns}`,
              type: 'assistant',
              role: 'assistant',
              content: textContent,
              timestamp: new Date(),
            };
            messages.push(assistantMessage);

            totalTokens += Math.ceil(textContent.length / 4);

            yield {
              messages: [...messages],
              sessionId,
              tokens: {
                prompt: Math.ceil(request.prompt.length / 4),
                completion: totalTokens,
                total: Math.ceil(request.prompt.length / 4) + totalTokens,
              },
              finishReason: 'stop',
              numTurns,
            };
          }
        }
      }

      // Final response
      yield {
        messages: [...messages],
        sessionId,
        tokens: {
          prompt: Math.ceil(request.prompt.length / 4),
          completion: totalTokens,
          total: Math.ceil(request.prompt.length / 4) + totalTokens,
        },
        finishReason: 'stop',
        numTurns,
      };
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

## Working Directory
${request.cwd || process.cwd()}

## Guidelines
- Be concise and helpful
- Use tools proactively to gather context before answering
- When making changes, explain what you're doing briefly
- Prefer editing existing files over creating new ones
- Run tests after making code changes`;
  }
}
