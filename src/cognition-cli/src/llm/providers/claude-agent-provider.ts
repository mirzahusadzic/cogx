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
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '../provider-interface.js';
import type {
  AgentProvider,
  AgentRequest,
  AgentResponse,
  AgentMessage,
} from '../agent-provider-interface.js';
import type {
  Query,
  SDKMessage,
  ContentBlock,
} from '../../tui/hooks/sdk/types.js';

/**
 * Claude Provider
 *
 * Implements both LLMProvider (basic completions) and AgentProvider (agent workflows)
 * using the Anthropic SDK and Claude Agent SDK.
 */
export class ClaudeProvider implements LLMProvider, AgentProvider {
  name = 'claude';
  // Current Claude models (Opus 4.5 and Sonnet 4.5)
  models = ['claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929'];

  private client: Anthropic;
  private currentQuery: Query | null = null;
  private abortController: AbortController | null = null;
  private claudeAgentSdk: unknown | undefined;
  private agentSdkLoadingPromise: Promise<void> | undefined; // Promise to track SDK loading

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });

    // Start loading Claude Agent SDK asynchronously in the constructor
    // but do NOT await it here. We'll await it in executeAgent().
    // Note: Always load SDK even without API key to support OAuth authentication
    this.agentSdkLoadingPromise = this.initAgentSdk();
  }

  private async initAgentSdk(): Promise<void> {
    const claudeAgentSdkName = '@anthropic-ai/claude-agent-sdk';
    try {
      this.claudeAgentSdk = await import(claudeAgentSdkName);
    } catch {
      // SDK not installed - this is OK, agent mode will be disabled
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
   * For Claude, we check if the Agent SDK is loaded (supports both API key and OAuth),
   * rather than testing the basic SDK client which requires an API key.
   */
  async isAvailable(): Promise<boolean> {
    // Ensure Agent SDK is loaded
    await this.ensureAgentSdkLoaded();

    // If Agent SDK is available, Claude is available
    // (works with both API key and OAuth authentication)
    return !!this.claudeAgentSdk;
  }

  /**
   * Estimate cost for token usage
   *
   * Based on Anthropic pricing as of Nov 2025:
   * - Sonnet 4.5: $3/$15 per MTok (input/output)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  estimateCost(tokens: number, _model: string): number {
    const mtokens = tokens / 1000000;

    // Estimate 40% input, 60% output (typical conversation ratio)
    const inputMtokens = mtokens * 0.4;
    const outputMtokens = mtokens * 0.6;

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

  /**
   * Execute agent query with full SDK features
   *
   * Wraps the Claude Agent SDK to enable:
   * - Multi-turn sessions
   * - Tool calling
   * - MCP server integration
   * - Extended thinking
   *
   * Streams conversation snapshots as the agent works.
   */
  async *executeAgent(
    request: AgentRequest
  ): AsyncGenerator<AgentResponse, void, undefined> {
    // Ensure Claude Agent SDK is loaded before executing agent query
    await this.ensureAgentSdkLoaded();

    if (!this.claudeAgentSdk) {
      throw new Error(
        'Claude Agent SDK is not installed. Please install it to use agent features.'
      );
    }

    // Create AbortController for cancellation support
    this.abortController = new AbortController();

    // Create SDK query with agent features
    this.currentQuery = (
      this.claudeAgentSdk as { query: (options: unknown) => Query }
    ).query({
      prompt: request.prompt,
      options: {
        abortController: this.abortController,
        cwd: request.cwd,
        model: request.model, // Pass model to Claude Agent SDK
        resume: request.resumeSessionId,
        systemPrompt:
          request.systemPrompt?.type === 'preset' && request.systemPrompt.preset
            ? ({
                type: 'preset',
                preset: 'claude_code',
                append: request.systemPrompt.append,
              } as const)
            : request.systemPrompt?.custom
              ? (request.systemPrompt.custom as string)
              : ({ type: 'preset', preset: 'claude_code' } as const),
        includePartialMessages: request.includePartialMessages ?? true,
        maxThinkingTokens: request.maxThinkingTokens,
        stderr: request.onStderr,
        ...(request.onCanUseTool
          ? { canUseTool: request.onCanUseTool as never }
          : {}),
        mcpServers: request.mcpServers,
      },
    });

    // Stream messages from SDK
    const messages: AgentMessage[] = [];
    let currentSessionId = request.resumeSessionId || '';
    let totalTokens = { prompt: 0, completion: 0, total: 0 };
    let currentFinishReason: AgentResponse['finishReason'] = 'stop';
    let numTurns = 0;

    if (!this.currentQuery) {
      throw new Error('Claude Agent SDK query failed to initialize.');
    }

    try {
      for await (const sdkMessage of this.currentQuery) {
        // Check if abort was requested
        if (this.abortController?.signal.aborted) {
          if (process.env.DEBUG_ESC_INPUT) {
            console.error('[Claude] Loop aborted - exiting');
          }
          break;
        }

        // Extract session ID
        if ('session_id' in sdkMessage && sdkMessage.session_id) {
          currentSessionId = sdkMessage.session_id;
        }

        // Extract turn count from final result message
        if (sdkMessage.type === 'result' && 'num_turns' in sdkMessage) {
          numTurns = sdkMessage.num_turns as number;
        }

        // Convert SDK message to AgentMessage
        const agentMessage = this.convertSDKMessage(sdkMessage);
        if (agentMessage) {
          messages.push(agentMessage);
        }

        // Update token counts
        totalTokens = this.updateTokens(sdkMessage, totalTokens);

        // Determine finish reason
        currentFinishReason = this.determineFinishReason(sdkMessage);

        // Yield current state
        yield {
          messages: [...messages], // Clone to avoid mutation
          sessionId: currentSessionId,
          tokens: totalTokens,
          finishReason: currentFinishReason,
          numTurns,
        };
      }
    } catch (error) {
      // Handle SDK errors gracefully to prevent TUI crashes
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : '';

      // 1. AbortError is expected when user interrupts - don't crash
      if (
        errorName === 'AbortError' ||
        errorMessage.includes('aborted by user') ||
        errorMessage.includes('Operation aborted')
      ) {
        if (process.env.DEBUG_ESC_INPUT) {
          console.error('[Claude] Query aborted by user - exiting gracefully');
        }
        // Return gracefully with stop status (user-initiated)
        yield {
          messages: [...messages],
          sessionId: currentSessionId,
          tokens: totalTokens,
          finishReason: 'stop',
          numTurns,
        };
        return;
      }

      // 2. OAuth token expiration (GitHub #10784, #2830, #1746)
      if (
        errorMessage.includes('OAuth token has expired') ||
        errorMessage.includes('OAuth authentication') ||
        errorMessage.includes('token_expired')
      ) {
        throw new Error(
          `OAuth token has expired. Please run the login command to re-authenticate.`
        );
      }

      // 3. General authentication errors
      if (
        errorMessage.includes('authentication_error') ||
        errorMessage.includes('invalid_api_key') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('401')
      ) {
        throw new Error(
          `Authentication failed: Please check your ANTHROPIC_API_KEY or re-authenticate with OAuth`
        );
      }

      // 4. Rate limiting (don't crash, let caller handle retry)
      if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
        throw new Error(
          `Rate limit exceeded. Please wait a moment and try again.`
        );
      }

      // 5. Claude Code subprocess exit with code 1 (often auth error, but SDK eats the message)
      // The SDK spawns Claude Code which prints "use /login" on auth failure, but only
      // returns generic "process exited with code 1" to us
      if (
        errorMessage.includes('process exited with code 1') ||
        errorMessage.includes('exited with code 1')
      ) {
        throw new Error(
          `Claude Code exited unexpectedly. This is often an authentication issue.\n` +
            `Please run: claude /login\n` +
            `If the issue persists, check your API key or OAuth token.`
        );
      }

      // 6. For all other errors, provide context but don't crash with raw error
      console.error('[Claude Provider] Error during query:', errorMessage);
      throw new Error(
        `Claude API error: ${errorMessage.substring(0, 200)}${errorMessage.length > 200 ? '...' : ''}`
      );
    } finally {
      // Always clear query and abort controller references to prevent memory leaks
      this.currentQuery = null;
      this.abortController = null;
    }
  }

  /**
   * Interrupt the current agent execution
   *
   * Sends interrupt signal to Claude Agent SDK to stop execution.
   * Used for ESC ESC keyboard shortcut in TUI.
   */
  async interrupt(): Promise<void> {
    if (process.env.DEBUG_ESC_INPUT) {
      console.error(
        '[Claude] interrupt() called, currentQuery:',
        !!this.currentQuery,
        'abortController:',
        !!this.abortController
      );
    }

    // Abort the query using AbortController (recommended pattern from GitHub #7181)
    if (this.abortController) {
      if (process.env.DEBUG_ESC_INPUT) {
        console.error('[Claude] Calling abortController.abort()');
      }
      this.abortController.abort();
    }

    // Also try the SDK's interrupt method as a backup
    if (this.currentQuery && this.claudeAgentSdk) {
      try {
        if (process.env.DEBUG_ESC_INPUT) {
          console.error('[Claude] Calling currentQuery.interrupt()');
        }
        await this.currentQuery.interrupt();
        if (process.env.DEBUG_ESC_INPUT) {
          console.error('[Claude] currentQuery.interrupt() completed');
        }
      } catch (err) {
        // AbortError is expected when interrupting, don't log as error
        const isAbortError = err instanceof Error && err.name === 'AbortError';
        if (process.env.DEBUG_ESC_INPUT && !isAbortError) {
          console.error('[Claude] currentQuery.interrupt() error:', err);
        } else if (process.env.DEBUG_ESC_INPUT && isAbortError) {
          console.error('[Claude] Request successfully aborted');
        }
      }
    }

    // Dispose of the query (following GitHub #7181 pattern)
    this.currentQuery = null;
    this.abortController = null;

    if (process.env.DEBUG_ESC_INPUT) {
      console.error('[Claude] interrupt() completed');
    }
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Convert Claude Agent SDK message to AgentMessage format
   */
  private convertSDKMessage(sdkMessage: SDKMessage): AgentMessage | null {
    const baseMessage: Partial<AgentMessage> = {
      id: this.generateMessageId(),
      timestamp: new Date(),
    };

    // Handle different SDK message types
    switch (sdkMessage.type) {
      case 'assistant': {
        // Assistant message with possible tool calls
        // NOTE: Streaming text comes via stream_event deltas to avoid duplication.
        // But we still need to handle text that accompanies tool_use (e.g., "Let me check that")

        if (!sdkMessage.message) {
          return null;
        }
        const content = sdkMessage.message.content as ContentBlock[];

        const textBlocks = content.filter(
          (c): c is ContentBlock & { text: string } => c.type === 'text'
        );
        const thinkingBlocks = content.filter(
          (c): c is ContentBlock & { thinking: string } => c.type === 'thinking'
        );
        const toolBlocks = content.filter(
          (
            c
          ): c is ContentBlock & {
            id: string;
            name: string;
            input: Record<string, unknown>;
          } => c.type === 'tool_use'
        );

        // Return thinking blocks immediately (they come in separate messages before tool calls)
        if (thinkingBlocks.length > 0) {
          return {
            ...baseMessage,
            type: 'assistant',
            role: 'assistant',
            content: thinkingBlocks.map((t) => ({
              type: 'thinking' as const,
              thinking: t.thinking,
            })),
          } as AgentMessage;
        }

        // Only return text from assistant messages when there are also tool calls
        // (pure text responses come via stream_event deltas to avoid duplication)
        if (toolBlocks.length > 0) {
          // Build content array with thinking, text, and tool_use blocks
          const contentArray: Array<
            | { type: 'thinking'; thinking: string }
            | { type: 'text'; text: string }
            | {
                type: 'tool_use';
                id: string;
                name: string;
                input: Record<string, unknown>;
              }
          > = [];

          // Add thinking blocks first (reasoning before tool call)
          thinkingBlocks.forEach((t) => {
            contentArray.push({ type: 'thinking', thinking: t.thinking });
          });

          // Add text blocks (if any)
          textBlocks.forEach((t) => {
            contentArray.push({ type: 'text', text: t.text });
          });

          // Add tool_use blocks
          toolBlocks.forEach((t) => {
            contentArray.push({
              type: 'tool_use',
              id: t.id,
              name: t.name,
              input: t.input,
            });
          });

          return {
            ...baseMessage,
            type: 'assistant',
            role: 'assistant',
            content: contentArray,
          } as AgentMessage;
        }
        break;
      }

      case 'stream_event': {
        const event = sdkMessage.event as {
          type: string;
          delta?: { type: string; text?: string };
        };

        if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta' &&
          event.delta.text
        ) {
          return {
            ...baseMessage,
            type: 'assistant',
            role: 'assistant',
            content: event.delta.text,
          } as AgentMessage;
        }
        break;
      }

      case 'tool_progress': {
        return {
          ...baseMessage,
          type: 'tool_use',
          content: `Tool: ${sdkMessage.tool_name} (${sdkMessage.elapsed_time_seconds}s)`,
        } as AgentMessage;
      }

      case 'system': {
        // System initialization messages - we don't need to convert these
        return null;
      }

      case 'result': {
        // Query result - we don't need to convert this to a message
        return null;
      }
    }

    return null;
  }

  /**
   * Update token counts from SDK message
   */
  private updateTokens(
    sdkMessage: SDKMessage,
    current: { prompt: number; completion: number; total: number }
  ): { prompt: number; completion: number; total: number } {
    // Extract token usage from different message types
    if (sdkMessage.type === 'stream_event') {
      const event = sdkMessage.event as {
        type: string;
        usage?: {
          input_tokens: number;
          output_tokens: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
      };

      if (event.type === 'message_delta' && event.usage) {
        // Include cache tokens in input count (matches old SDK behavior)
        const totalInput =
          event.usage.input_tokens +
          (event.usage.cache_creation_input_tokens || 0) +
          (event.usage.cache_read_input_tokens || 0);
        return {
          prompt: totalInput,
          completion: event.usage.output_tokens,
          total: totalInput + event.usage.output_tokens,
        };
      }
    } else if (
      sdkMessage.type === 'result' &&
      sdkMessage.subtype === 'success' &&
      sdkMessage.usage
    ) {
      const usage = sdkMessage.usage;
      return {
        prompt: usage.input_tokens,
        completion: usage.output_tokens,
        total: usage.input_tokens + usage.output_tokens,
      };
    }

    return current;
  }

  /**
   * Determine finish reason from SDK message
   */
  private determineFinishReason(
    sdkMessage: SDKMessage
  ): AgentResponse['finishReason'] {
    if (sdkMessage.type === 'result') {
      if (sdkMessage.subtype === 'success') {
        return 'stop';
      } else {
        return 'error';
      }
    }

    if (sdkMessage.type === 'assistant' && sdkMessage.message) {
      const toolUses = sdkMessage.message.content.filter(
        (c: { type: string }) => c.type === 'tool_use'
      );
      if (toolUses.length > 0) {
        return 'tool_use';
      }
    }

    return 'stop';
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
