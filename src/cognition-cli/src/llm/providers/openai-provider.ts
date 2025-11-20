/**
 * OpenAI Provider Implementation
 *
 * LLM provider implementation for OpenAI's GPT models.
 * Wraps the OpenAI SDK to provide a standardized interface.
 *
 * FEATURES:
 * - Complete GPT model support (GPT-4 Turbo, GPT-4o, GPT-3.5)
 * - Streaming and non-streaming completions
 * - Cost estimation based on current pricing
 * - Health check with minimal token usage
 * - Automatic API key management from environment
 *
 * MODELS SUPPORTED:
 * - gpt-4o (latest, multimodal)
 * - gpt-4-turbo (high capability, good speed)
 * - gpt-4 (most capable, slower)
 * - gpt-3.5-turbo (fastest, cheapest)
 *
 * @example
 * const provider = new OpenAIProvider(process.env.OPENAI_API_KEY);
 *
 * const response = await provider.complete({
 *   prompt: 'Explain quantum computing',
 *   model: 'gpt-4-turbo',
 *   maxTokens: 1000
 * });
 *
 * console.log(response.text);
 * console.log(`Tokens: ${response.tokens.total}`);
 */

import OpenAI from 'openai';
import type {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '../provider-interface.js';

/**
 * OpenAI Provider
 *
 * Implementation of LLMProvider interface for OpenAI's GPT models.
 *
 * DESIGN:
 * - Lazy initialization of OpenAI client
 * - Environment variable fallback for API key
 * - Comprehensive error handling
 * - Token usage tracking
 * - Cost estimation based on current pricing (as of 2025)
 *
 * @example
 * // With explicit API key
 * const openai = new OpenAIProvider('sk-...');
 *
 * // With environment variable
 * const openai = new OpenAIProvider();
 * // Uses OPENAI_API_KEY from process.env
 */
export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  models = ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];

  private client: OpenAI;

  /**
   * Create OpenAI provider
   *
   * @param apiKey - OpenAI API key (optional, defaults to OPENAI_API_KEY env var)
   * @throws Error if no API key provided and OPENAI_API_KEY not set
   *
   * @example
   * const provider = new OpenAIProvider(process.env.OPENAI_API_KEY);
   */
  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;

    if (!key) {
      throw new Error(
        'OpenAI provider requires an API key. ' +
          'Provide it as constructor argument or set OPENAI_API_KEY environment variable.'
      );
    }

    this.client = new OpenAI({
      apiKey: key,
    });
  }

  /**
   * Generate completion
   *
   * Sends a completion request to OpenAI and returns the response.
   *
   * @param request - Completion parameters
   * @returns Promise resolving to completion response
   * @throws Error if OpenAI API call fails
   *
   * @example
   * const response = await provider.complete({
   *   prompt: 'What is TypeScript?',
   *   model: 'gpt-4-turbo',
   *   maxTokens: 500,
   *   temperature: 0.7
   * });
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const response = await this.client.chat.completions.create({
        model: request.model,
        messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        stop: request.stopSequences,
      });

      const choice = response.choices[0];

      return {
        text: choice.message.content || '',
        model: response.model,
        tokens: {
          prompt: response.usage?.prompt_tokens || 0,
          completion: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0,
        },
        finishReason:
          choice.finish_reason === 'stop'
            ? 'stop'
            : choice.finish_reason === 'length'
              ? 'length'
              : 'stop',
      };
    } catch (error) {
      // Enhance error message with context
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }
  }

  /**
   * Generate streaming completion
   *
   * Streams completion response incrementally for better UX on long responses.
   *
   * @param request - Completion parameters
   * @returns Async generator yielding stream chunks
   * @throws Error if OpenAI API call fails
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
  async *stream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, undefined> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const stream = await this.client.chat.completions.create({
        model: request.model,
        messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        stop: request.stopSequences,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield {
            text: delta,
            isComplete: false,
          };
        }
      }

      // Final chunk to signal completion
      yield { text: '', isComplete: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAI streaming error: ${errorMessage}`);
    }
  }

  /**
   * Estimate cost in USD
   *
   * Provides rough cost estimate based on current OpenAI pricing (2025).
   * Uses a 50/50 input/output split assumption if exact split unknown.
   *
   * Pricing (per 1M tokens):
   * - GPT-4o: $2.50 input, $10 output
   * - GPT-4 Turbo: $10 input, $30 output
   * - GPT-4: $30 input, $60 output
   * - GPT-3.5 Turbo: $0.50 input, $1.50 output
   *
   * @param tokens - Total token count
   * @param model - Model identifier
   * @returns Estimated cost in USD
   *
   * @example
   * const cost = provider.estimateCost(10000, 'gpt-4-turbo');
   * console.log(`Estimated cost: $${cost.toFixed(4)}`); // ~$0.2000
   */
  estimateCost(tokens: number, model: string): number {
    // Pricing per 1M tokens (USD)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.5, output: 10 },
      'gpt-4-turbo': { input: 10, output: 30 },
      'gpt-4': { input: 30, output: 60 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    };

    // Default to GPT-4 Turbo pricing if model not found
    const rates = pricing[model] || pricing['gpt-4-turbo'];

    // Rough estimate: assume 50/50 input/output split
    const avgRate = (rates.input + rates.output) / 2;
    return (tokens / 1_000_000) * avgRate;
  }

  /**
   * Check provider availability
   *
   * Performs a minimal API call to verify OpenAI is accessible.
   * Uses GPT-3.5 Turbo (cheapest model) with max_tokens: 1 to minimize cost.
   *
   * @returns Promise resolving to availability status
   *
   * @example
   * const available = await provider.isAvailable();
   * if (!available) {
   *   console.warn('OpenAI is currently unavailable');
   * }
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Quick test with minimal tokens to check availability
      await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo', // Cheapest model
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1, // Minimal response
      });
      return true;
    } catch {
      // Any error means unavailable
      return false;
    }
  }
}
