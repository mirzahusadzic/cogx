/**
 * Claude Provider Implementation
 *
 * LLM provider implementation for Anthropic's Claude models.
 * Wraps the Anthropic SDK to provide a standardized interface.
 *
 * FEATURES:
 * - Complete Claude model support (Sonnet 4.5, Opus, Haiku)
 * - Streaming and non-streaming completions
 * - Cost estimation based on current pricing
 * - Health check with minimal token usage
 * - Automatic API key management from environment
 *
 * MODELS SUPPORTED:
 * - claude-sonnet-4-5-20250929 (latest, most capable)
 * - claude-3-5-sonnet-20241022 (previous Sonnet)
 * - claude-3-opus-20240229 (most capable, expensive)
 * - claude-3-haiku-20240307 (fastest, cheapest)
 *
 * @example
 * const provider = new ClaudeProvider(process.env.ANTHROPIC_API_KEY);
 *
 * const response = await provider.complete({
 *   prompt: 'Explain quantum computing',
 *   model: 'claude-sonnet-4-5-20250929',
 *   maxTokens: 1000
 * });
 *
 * console.log(response.text);
 * console.log(`Tokens: ${response.tokens.total}`);
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '../provider-interface.js';

/**
 * Claude Provider
 *
 * Implementation of LLMProvider interface for Anthropic's Claude models.
 *
 * DESIGN:
 * - Lazy initialization of Anthropic client
 * - Environment variable fallback for API key
 * - Comprehensive error handling
 * - Token usage tracking
 * - Cost estimation based on current pricing (as of 2025)
 *
 * @example
 * // With explicit API key
 * const claude = new ClaudeProvider('sk-ant-...');
 *
 * // With environment variable
 * const claude = new ClaudeProvider();
 * // Uses ANTHROPIC_API_KEY from process.env
 */
export class ClaudeProvider implements LLMProvider {
  name = 'claude';
  models = [
    'claude-sonnet-4-5-20250929',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
  ];

  private client: Anthropic;

  /**
   * Create Claude provider
   *
   * @param apiKey - Anthropic API key (optional, defaults to ANTHROPIC_API_KEY env var)
   * @throws Error if no API key provided and ANTHROPIC_API_KEY not set
   *
   * @example
   * const provider = new ClaudeProvider(process.env.ANTHROPIC_API_KEY);
   */
  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;

    if (!key) {
      throw new Error(
        'Claude provider requires an API key. ' +
          'Provide it as constructor argument or set ANTHROPIC_API_KEY environment variable.'
      );
    }

    this.client = new Anthropic({
      apiKey: key,
    });
  }

  /**
   * Generate completion
   *
   * Sends a completion request to Claude and returns the response.
   *
   * @param request - Completion parameters
   * @returns Promise resolving to completion response
   * @throws Error if Claude API call fails
   *
   * @example
   * const response = await provider.complete({
   *   prompt: 'What is TypeScript?',
   *   model: 'claude-sonnet-4-5-20250929',
   *   maxTokens: 500,
   *   temperature: 0.7
   * });
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
      const textContent = response.content.find((c) => c.type === 'text');
      const text = textContent?.type === 'text' ? textContent.text : '';

      return {
        text,
        model: response.model,
        tokens: {
          prompt: response.usage.input_tokens,
          completion: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason:
          response.stop_reason === 'end_turn'
            ? 'stop'
            : response.stop_reason === 'max_tokens'
              ? 'length'
              : 'stop',
      };
    } catch (error) {
      // Enhance error message with context
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Claude API error: ${errorMessage}`);
    }
  }

  /**
   * Generate streaming completion
   *
   * Streams completion response incrementally for better UX on long responses.
   *
   * @param request - Completion parameters
   * @returns Async generator yielding stream chunks
   * @throws Error if Claude API call fails
   *
   * @example
   * for await (const chunk of provider.stream(request)) {
   *   process.stdout.write(chunk.text);
   *   if (chunk.isComplete) {
   *     console.log('\nDone!');
   *     break;
   *   }
   * }
   */
  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk, void, undefined> {
    try {
      const stream = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.prompt }],
        stop_sequences: request.stopSequences,
        stream: true,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield {
            text: event.delta.text,
            isComplete: false,
          };
        } else if (event.type === 'message_stop') {
          yield {
            text: '',
            isComplete: true,
          };
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Claude streaming error: ${errorMessage}`);
    }
  }

  /**
   * Estimate cost in USD
   *
   * Provides rough cost estimate based on current Claude pricing (2025).
   * Uses a 50/50 input/output split assumption if exact split unknown.
   *
   * Pricing (per 1M tokens):
   * - Sonnet 4.5: $3 input, $15 output
   * - Sonnet 3.5: $3 input, $15 output
   * - Opus: $15 input, $75 output
   * - Haiku: $0.25 input, $1.25 output
   *
   * @param tokens - Total token count
   * @param model - Model identifier
   * @returns Estimated cost in USD
   *
   * @example
   * const cost = provider.estimateCost(10000, 'claude-sonnet-4-5-20250929');
   * console.log(`Estimated cost: $${cost.toFixed(4)}`); // ~$0.0900
   */
  estimateCost(tokens: number, model: string): number {
    // Pricing per 1M tokens (USD)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-5-20250929': { input: 3, output: 15 },
      'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
      'claude-3-opus-20240229': { input: 15, output: 75 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    };

    // Default to Sonnet 3.5 pricing if model not found
    const rates = pricing[model] || pricing['claude-3-5-sonnet-20241022'];

    // Rough estimate: assume 50/50 input/output split
    const avgRate = (rates.input + rates.output) / 2;
    return (tokens / 1_000_000) * avgRate;
  }

  /**
   * Check provider availability
   *
   * Performs a minimal API call to verify Claude is accessible.
   * Uses Haiku (cheapest model) with max_tokens: 1 to minimize cost.
   *
   * @returns Promise resolving to availability status
   *
   * @example
   * const available = await provider.isAvailable();
   * if (!available) {
   *   console.warn('Claude is currently unavailable');
   * }
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Quick test with minimal tokens to check availability
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307', // Cheapest model
        max_tokens: 1, // Minimal response
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch {
      // Any error means unavailable
      return false;
    }
  }
}
