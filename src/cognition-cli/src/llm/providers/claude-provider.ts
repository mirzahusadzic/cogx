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
import {
  query,
  type Query,
  type SDKMessage,
} from '@anthropic-ai/claude-agent-sdk';
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

/**
 * Claude Provider
 *
 * Implements both LLMProvider (basic completions) and AgentProvider (agent workflows)
 * using the Anthropic SDK and Claude Agent SDK.
 */
export class ClaudeProvider implements LLMProvider, AgentProvider {
  name = 'claude';
  models = [
    'claude-sonnet-4-5-20250929',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
  ];

  private client: Anthropic;
  private currentQuery: Query | null = null;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
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
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Quick availability check - try to create a minimal request
      await this.client.messages.create({
        model: this.models[3], // Use Haiku (cheapest)
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Estimate cost for token usage
   *
   * Based on Anthropic pricing as of Jan 2025:
   * - Sonnet 4.5: $3/$15 per MTok (input/output)
   * - Sonnet 3.5: $3/$15 per MTok
   * - Opus: $15/$75 per MTok
   * - Haiku: $0.25/$1.25 per MTok
   */
  estimateCost(tokens: number, model: string): number {
    const mtokens = tokens / 1000000;

    // Estimate 40% input, 60% output (typical conversation ratio)
    const inputMtokens = mtokens * 0.4;
    const outputMtokens = mtokens * 0.6;

    if (model.includes('sonnet-4')) {
      return inputMtokens * 3 + outputMtokens * 15;
    } else if (model.includes('sonnet')) {
      return inputMtokens * 3 + outputMtokens * 15;
    } else if (model.includes('opus')) {
      return inputMtokens * 15 + outputMtokens * 75;
    } else if (model.includes('haiku')) {
      return inputMtokens * 0.25 + outputMtokens * 1.25;
    }

    // Default to Sonnet pricing
    return inputMtokens * 3 + outputMtokens * 15;
  }

  // ========================================
  // AgentProvider Interface (Agent Workflows)
  // ========================================

  /**
   * Check if provider supports agent mode
   */
  supportsAgentMode(): boolean {
    return true;
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
    // Create SDK query with agent features
    this.currentQuery = query({
      prompt: request.prompt,
      options: {
        cwd: request.cwd,
        resume: request.resumeSessionId,
        systemPrompt:
          request.systemPrompt?.type === 'preset' && request.systemPrompt.preset
            ? ({
                type: 'preset',
                preset: 'claude_code',
                append:
                  request.systemPrompt.preset !== 'claude_code'
                    ? request.systemPrompt.preset
                    : undefined,
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

    try {
      for await (const sdkMessage of this.currentQuery) {
        // Extract session ID
        if ('session_id' in sdkMessage && sdkMessage.session_id) {
          currentSessionId = sdkMessage.session_id;
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
        };
      }
    } finally {
      // Always clear query reference to prevent memory leaks
      this.currentQuery = null;
    }
  }

  /**
   * Interrupt the current agent execution
   *
   * Sends interrupt signal to Claude Agent SDK to stop execution.
   * Used for ESC ESC keyboard shortcut in TUI.
   */
  async interrupt(): Promise<void> {
    if (this.currentQuery) {
      await this.currentQuery.interrupt();
      this.currentQuery = null;
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
        interface ContentBlock {
          type: string;
          text?: string;
          id?: string;
          name?: string;
          input?: Record<string, unknown>;
        }
        const content = sdkMessage.message.content as ContentBlock[];
        const textBlocks = content.filter(
          (c): c is ContentBlock & { text: string } => c.type === 'text'
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

        if (textBlocks.length > 0) {
          return {
            ...baseMessage,
            type: 'assistant',
            role: 'assistant',
            content: textBlocks.map((b) => b.text).join('\n'),
          } as AgentMessage;
        } else if (toolBlocks.length > 0) {
          return {
            ...baseMessage,
            type: 'tool_use',
            role: 'assistant',
            content: toolBlocks.map((t) => ({
              type: 'tool_use' as const,
              id: t.id,
              name: t.name,
              input: t.input,
            })),
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
        };
      };

      if (event.type === 'message_delta' && event.usage) {
        return {
          prompt: event.usage.input_tokens,
          completion: event.usage.output_tokens,
          total: event.usage.input_tokens + event.usage.output_tokens,
        };
      }
    } else if (
      sdkMessage.type === 'result' &&
      sdkMessage.subtype === 'success'
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

    if (sdkMessage.type === 'assistant') {
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
