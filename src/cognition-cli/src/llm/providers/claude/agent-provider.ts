/**
 * Claude Provider Implementation
 *
 * Wraps the Anthropic Claude Agent SDK to implement both LLMProvider and AgentProvider interfaces.
 * Enables the TUI to use Claude for agent workflows while maintaining abstraction for future multi-provider support.
 *
 * This provider supports:
 * - Basic completions via Anthropic SDK
 * - Agent workflows via Claude Agent SDK
 * - Session management
 * - Tool calling
 * - MCP server integration
 * - Extended thinking mode
 *
 * @example
 * ```typescript
 * const provider = new ClaudeProvider(process.env.ANTHROPIC_API_KEY);
 *
 * // Basic completion
 * const response = await provider.complete({
 *   prompt: "Hello!",
 *   model: "claude-sonnet-4-5-20250929"
 * });
 *
 * // Agent workflow
 * for await (const response of provider.executeAgent({
 *   prompt: "Analyze this codebase",
 *   model: "claude-sonnet-4-5-20250929",
 *   cwd: process.cwd()
 * })) {
 *   console.log(response.messages);
 * }
 * ```
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '../../core/interfaces/provider.js';
import type { AgentRequest } from '../../core/interfaces/agent-provider.js';
import type { Query, SDKMessage } from '../../../tui/hooks/sdk/types.js';

import { BaseAgentProvider } from '../../core/base-agent-provider.js';
import { UnifiedStreamingChunk } from '../../core/types.js';
import { ThinkingBudget } from '../../core/utils/thinking-utils.js';
import { systemLog } from '../../../utils/debug-logger.js';

/**
 * Claude Provider
 *
 * Implements both LLMProvider (basic completions) and AgentProvider (agent workflows)
 * using the Anthropic SDK and Claude Agent SDK.
 */
export class ClaudeProvider extends BaseAgentProvider {
  name = 'claude';
  // Current Claude models (Opus 4.5 and Sonnet 4.5)
  models = ['claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929'];

  private client: Anthropic;
  private currentQuery: Query | null = null;
  private claudeAgentSdk: { query: (options: unknown) => Query } | undefined;
  private agentSdkLoadingPromise: Promise<void> | undefined; // Promise to track SDK loading

  constructor(apiKey?: string) {
    super();
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });

    // Start loading Claude Agent SDK asynchronously in the constructor
    // but do NOT await it here. We'll await it in executeAgent().
    this.agentSdkLoadingPromise = this.initAgentSdk();
  }

  private async initAgentSdk(): Promise<void> {
    try {
      // @ts-expect-error - Dynamic import to avoid build-time dependency requirement
      this.claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
    } catch (err) {
      // SDK not installed - this is OK, agent mode will be disabled
      systemLog('claude', `Failed to load Claude Agent SDK: ${err}`);
      this.claudeAgentSdk = undefined;
    }
  }

  /**
   * Ensures the Claude Agent SDK has been loaded.
   * This method should be awaited before attempting to use agent features.
   */
  private async ensureAgentSdkLoaded(): Promise<void> {
    if (this.agentSdkLoadingPromise) {
      await this.agentSdkLoadingPromise;
    }
  }

  /**
   * Ensures the provider is ready for agent mode.
   * This should be awaited before using agent features.
   * @returns true if agent mode is supported, false otherwise.
   */
  async ensureAgentModeReady(): Promise<boolean> {
    await this.ensureAgentSdkLoaded();
    return !!this.claudeAgentSdk;
  }
  // ========================================
  // LLMProvider Interface (Basic Completions)
  // ========================================

  /**
   * Generate a basic completion
   *
   * Uses the Anthropic SDK for simple text completions.
   * For agent workflows with tools/MCP, use executeAgent() instead.
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.prompt }],
        stop_sequences: request.stopSequences,
      });

      // Extract text from content blocks
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => ('text' in block ? block.text : ''))
        .join('\n');

      return {
        text,
        model: response.model,
        tokens: {
          prompt: response.usage.input_tokens,
          completion: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'length',
      };
    } catch (error) {
      throw new Error(
        `Claude completion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Stream a completion
   *
   * Streams text deltas from Claude API.
   */
  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    try {
      const stream = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.prompt }],
        stream: true,
      });

      let fullText = '';
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            const delta = event.delta.text;
            fullText += delta;

            yield {
              delta,
              text: fullText,
              done: false,
            };
          }
        } else if (event.type === 'message_start') {
          promptTokens = event.message.usage.input_tokens;
        } else if (event.type === 'message_delta') {
          completionTokens = event.usage.output_tokens;
        } else if (event.type === 'message_stop') {
          // Final chunk with token usage
          yield {
            delta: '',
            text: fullText,
            done: true,
            tokens: {
              prompt: promptTokens,
              completion: completionTokens,
              total: promptTokens + completionTokens,
            },
          };
        }
      }
    } catch (error) {
      throw new Error(
        `Claude streaming failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if Claude API is available
   *
   * For Claude, we check if the Agent SDK is loaded AND if the API key is set.
   */
  async isAvailable(): Promise<boolean> {
    // Ensure Agent SDK is loaded
    await this.ensureAgentSdkLoaded();

    // Check for API key
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

    // If Agent SDK is available and API key is set, Claude is available
    return !!this.claudeAgentSdk && hasApiKey;
  }

  /**
   * Estimate cost for token usage
   *
   * Based on Anthropic pricing as of Nov 2025:
   * - Sonnet 4.5: $3/$15 per MTok (input/output)
   */
  estimateCost(
    tokens: {
      prompt: number;
      completion: number;
      total: number;
      cached?: number;
    },
    model?: string // eslint-disable-line @typescript-eslint/no-unused-vars
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

    // Sonnet 4.5 pricing
    return inputMtokens * 3 + outputMtokens * 15;
  }

  // ========================================
  // AgentProvider Interface (Agent Workflows)
  // ========================================

  /**
   * Check if provider supports agent mode
   */
  supportsAgentMode(): boolean {
    return !!this.claudeAgentSdk;
  }

  protected async *internalStream(
    request: AgentRequest,
    context: {
      sessionId: string;
      groundingContext: string;
      thinkingBudget: ThinkingBudget;
      systemPrompt: string;
    }
  ): AsyncGenerator<UnifiedStreamingChunk, void, undefined> {
    // Ensure Claude Agent SDK is loaded before executing agent query
    await this.ensureAgentSdkLoaded();

    if (!this.claudeAgentSdk) {
      throw new Error(
        'Claude Agent SDK is not installed. Please install it to use agent features.'
      );
    }

    const { sessionId, groundingContext, systemPrompt, thinkingBudget } =
      context;

    // Create SDK query with agent features
    this.currentQuery = this.claudeAgentSdk.query({
      prompt: groundingContext
        ? `${groundingContext}\n\nTask: ${request.prompt}`
        : request.prompt,
      options: {
        abortController: this.abortController,
        cwd: request.cwd,
        model: request.model, // Pass model to Claude Agent SDK
        resume: sessionId,
        systemPrompt: systemPrompt,
        includePartialMessages: request.includePartialMessages ?? true,
        maxThinkingTokens: thinkingBudget.thinkingBudget,
        stderr: request.onStderr,
        ...(request.onCanUseTool
          ? { canUseTool: request.onCanUseTool as never }
          : {}),
        mcpServers: request.mcpServers,
      },
    });

    if (!this.currentQuery) {
      throw new Error('Claude Agent SDK query failed to initialize.');
    }

    for await (const sdkMessage of this.currentQuery) {
      if (this.abortController?.signal.aborted) break;

      // Extract session ID
      if ('session_id' in sdkMessage && sdkMessage.session_id) {
        this.sessionId = sdkMessage.session_id;
      }

      // Extract usage and turn count
      const result = this.extractUsageAndTurns(sdkMessage);
      if (result) {
        yield {
          type: 'usage',
          usage: result.usage,
          numTurns: result.numTurns,
        };
      }

      // Handle different SDK message types
      switch (sdkMessage.type) {
        case 'result': {
          if (sdkMessage.subtype === 'error') {
            const error =
              (sdkMessage as { error?: string }).error || 'Unknown error';
            if (error.includes('authentication_error')) {
              throw new Error(`Authentication failed: ${error}`);
            } else if (error.includes('rate_limit')) {
              throw new Error(`Rate limit exceeded: ${error}`);
            } else if (error.includes('process exited with code 1')) {
              throw new Error(`Claude Code exited unexpectedly: ${error}`);
            }
            throw new Error(error);
          }
          break;
        }
        case 'stream_event': {
          const event = sdkMessage.event as {
            type?: string;
            text?: string;
            thinking?: string;
            delta?: {
              type?: string;
              text?: string;
              thinking?: string;
            };
          };
          if (!event) break;

          if (event.type === 'text_delta') {
            yield {
              type: 'text',
              delta: event.text || '',
            };
          } else if (event.type === 'thinking_delta') {
            yield {
              type: 'thinking',
              thought: event.thinking || '',
            };
          } else if (event.type === 'content_block_delta' && event.delta) {
            if (event.delta.type === 'text_delta') {
              yield {
                type: 'text',
                delta: event.delta.text || '',
              };
            } else if (event.delta.type === 'thinking_delta') {
              yield {
                type: 'thinking',
                thought: event.delta.thinking || '',
              };
            }
          }
          break;
        }

        case 'tool_progress': {
          yield {
            type: 'tool_call',
            toolCall: {
              name: sdkMessage.tool_name || 'unknown',
              args: {},
            },
          };
          break;
        }

        case 'assistant': {
          if (!sdkMessage.message) break;
          const content = sdkMessage.message.content;
          for (const block of content) {
            if (block.type === 'tool_use') {
              yield {
                type: 'tool_call',
                toolCall: {
                  name: block.name || 'unknown',
                  args: block.input || {},
                },
              };
            } else if (block.type === 'text' && block.text) {
              yield {
                type: 'text',
                delta: block.text,
              };
            } else if (block.type === 'thinking' && block.thinking) {
              yield {
                type: 'thinking',
                thought: block.thinking,
              };
            }
          }
          break;
        }
      }
    }
  }

  private extractUsageAndTurns(sdkMessage: SDKMessage) {
    if (sdkMessage.type === 'stream_event') {
      const event = sdkMessage.event as {
        usage?: {
          input_tokens: number;
          output_tokens: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
      };
      if (event?.usage) {
        return {
          usage: {
            prompt: event.usage.input_tokens,
            completion: event.usage.output_tokens,
            total: event.usage.input_tokens + event.usage.output_tokens,
            cached:
              (event.usage.cache_creation_input_tokens || 0) +
              (event.usage.cache_read_input_tokens || 0),
          },
          numTurns: undefined,
        };
      }
    } else if (
      sdkMessage.type === 'result' &&
      sdkMessage.subtype === 'success'
    ) {
      const usage = sdkMessage.usage;
      const numTurns = sdkMessage.num_turns;

      if (usage) {
        const cached =
          (usage.cache_creation_input_tokens || 0) +
          (usage.cache_read_input_tokens || 0);
        return {
          usage: {
            prompt: usage.input_tokens,
            completion: usage.output_tokens,
            total: usage.input_tokens + usage.output_tokens,
            cached: cached,
          },
          numTurns,
        };
      } else if (numTurns !== undefined) {
        return {
          usage: undefined,
          numTurns,
        };
      }
    }
    return null;
  }
}
