/**
 * Gemini Provider Implementation
 *
 * LLM provider implementation for Google's Gemini models.
 * Wraps the Google Gen AI SDK to provide a standardized interface.
 *
 * FEATURES:
 * - Complete Gemini model support (Gemini 2.5 Flash, 2.0 Flash Thinking, Pro, etc.)
 * - Streaming and non-streaming completions
 * - Cost estimation based on current pricing
 * - Health check with minimal token usage
 * - Automatic API key management from environment
 *
 * MODELS SUPPORTED:
 * - gemini-2.5-flash (latest, balanced performance)
 * - gemini-2.0-flash-thinking-exp-01-21 (experimental thinking mode)
 * - gemini-1.5-pro (most capable, multimodal)
 * - gemini-1.5-flash (fastest, cost-effective)
 *
 * @example
 * const provider = new GeminiProvider(process.env.GOOGLE_API_KEY);
 *
 * const response = await provider.complete({
 *   prompt: 'Explain quantum computing',
 *   model: 'gemini-2.5-flash',
 *   maxTokens: 1000
 * });
 *
 * console.log(response.text);
 * console.log(`Tokens: ${response.tokens.total}`);
 */

import { GoogleGenAI } from '@google/genai';
import type {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '../provider-interface.js';

/**
 * Gemini Provider
 *
 * Implementation of LLMProvider interface for Google's Gemini models.
 *
 * DESIGN:
 * - Lazy initialization of Google Gen AI client
 * - Environment variable fallback for API key
 * - Comprehensive error handling
 * - Token usage tracking
 * - Cost estimation based on current pricing (as of 2025)
 *
 * @example
 * // With explicit API key
 * const gemini = new GeminiProvider('AIza...');
 *
 * // With environment variable
 * const gemini = new GeminiProvider();
 * // Uses GOOGLE_API_KEY from process.env
 */
export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash-thinking-exp-01-21',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ];

  private client: GoogleGenAI;

  /**
   * Create Gemini provider
   *
   * @param apiKey - Google API key (optional, defaults to GOOGLE_API_KEY env var)
   * @throws Error if no API key provided and GOOGLE_API_KEY not set
   *
   * @example
   * const provider = new GeminiProvider(process.env.GOOGLE_API_KEY);
   */
  constructor(apiKey?: string) {
    const key = apiKey || process.env.GOOGLE_API_KEY;

    if (!key) {
      throw new Error(
        'Gemini provider requires an API key. ' +
          'Provide it as constructor argument or set GOOGLE_API_KEY environment variable.'
      );
    }

    this.client = new GoogleGenAI({
      apiKey: key,
    });
  }

  /**
   * Generate completion
   *
   * Sends a completion request to Gemini and returns the response.
   *
   * @param request - Completion parameters
   * @returns Promise resolving to completion response
   * @throws Error if Gemini API call fails
   *
   * @example
   * const response = await provider.complete({
   *   prompt: 'What is TypeScript?',
   *   model: 'gemini-2.5-flash',
   *   maxTokens: 500,
   *   temperature: 0.7
   * });
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      // Build contents with system prompt if provided
      let contents = request.prompt;
      if (request.systemPrompt) {
        contents = `${request.systemPrompt}\n\n${request.prompt}`;
      }

      const response = await this.client.models.generateContent({
        model: request.model,
        contents,
        config: {
          maxOutputTokens: request.maxTokens || 4096,
          temperature: request.temperature,
          stopSequences: request.stopSequences,
        },
      });

      const text = response.text || '';

      // Extract token usage
      const usageMetadata = response.usageMetadata || {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
      };

      return {
        text,
        model: request.model,
        tokens: {
          prompt: usageMetadata.promptTokenCount || 0,
          completion: usageMetadata.candidatesTokenCount || 0,
          total: usageMetadata.totalTokenCount || 0,
        },
        finishReason: 'stop',
      };
    } catch (error) {
      // Enhance error message with context
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Gemini API error: ${errorMessage}`);
    }
  }

  /**
   * Generate streaming completion
   *
   * Streams completion response incrementally for better UX on long responses.
   *
   * @param request - Completion parameters
   * @returns Async generator yielding stream chunks
   * @throws Error if Gemini API call fails
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
      // Build contents with system prompt if provided
      let contents = request.prompt;
      if (request.systemPrompt) {
        contents = `${request.systemPrompt}\n\n${request.prompt}`;
      }

      const stream = await this.client.models.generateContentStream({
        model: request.model,
        contents,
        config: {
          maxOutputTokens: request.maxTokens || 4096,
          temperature: request.temperature,
          stopSequences: request.stopSequences,
        },
      });

      for await (const chunk of stream) {
        const text = chunk.text || '';
        if (text) {
          yield {
            text,
            isComplete: false,
          };
        }
      }

      // Final chunk to signal completion
      yield { text: '', isComplete: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Gemini streaming error: ${errorMessage}`);
    }
  }

  /**
   * Estimate cost in USD
   *
   * Provides rough cost estimate based on current Gemini pricing (2025).
   * Uses a 50/50 input/output split assumption if exact split unknown.
   *
   * Pricing (per 1M tokens):
   * - Gemini 2.5 Flash: $0.075 input, $0.30 output
   * - Gemini 2.0 Flash Thinking: $0.075 input, $0.30 output
   * - Gemini 1.5 Pro: $1.25 input, $5.00 output
   * - Gemini 1.5 Flash: $0.075 input, $0.30 output
   *
   * @param tokens - Total token count
   * @param model - Model identifier
   * @returns Estimated cost in USD
   *
   * @example
   * const cost = provider.estimateCost(10000, 'gemini-2.5-flash');
   * console.log(`Estimated cost: $${cost.toFixed(4)}`); // ~$0.0019
   */
  estimateCost(tokens: number, model: string): number {
    // Pricing per 1M tokens (USD)
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-2.5-flash': { input: 0.075, output: 0.3 },
      'gemini-2.0-flash-thinking-exp-01-21': { input: 0.075, output: 0.3 },
      'gemini-1.5-pro': { input: 1.25, output: 5.0 },
      'gemini-1.5-flash': { input: 0.075, output: 0.3 },
    };

    // Default to Gemini 2.5 Flash pricing if model not found
    const rates = pricing[model] || pricing['gemini-2.5-flash'];

    // Rough estimate: assume 50/50 input/output split
    const avgRate = (rates.input + rates.output) / 2;
    return (tokens / 1_000_000) * avgRate;
  }

  /**
   * Check provider availability
   *
   * Performs a minimal API call to verify Gemini is accessible.
   * Uses Gemini 1.5 Flash (cheapest model) with minimal tokens.
   *
   * @returns Promise resolving to availability status
   *
   * @example
   * const available = await provider.isAvailable();
   * if (!available) {
   *   console.warn('Gemini is currently unavailable');
   * }
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Quick test with minimal tokens to check availability
      await this.client.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: 'test',
        config: {
          maxOutputTokens: 1,
        },
      });

      return true;
    } catch {
      // Any error means unavailable
      return false;
    }
  }
}
