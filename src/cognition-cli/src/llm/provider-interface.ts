/**
 * LLM Provider Interface
 *
 * Core abstraction layer for Large Language Model providers.
 * Enables Cognition Σ to work with multiple LLM backends (Claude, OpenAI, local models)
 * without tight coupling to any specific vendor.
 *
 * DESIGN PRINCIPLES:
 * - Provider-agnostic: Works with any LLM API
 * - Streaming-first: Native support for token streaming
 * - Cost-aware: Built-in cost estimation
 * - Observable: Health checks and availability monitoring
 * - Extensible: Easy to add new providers
 *
 * ARCHITECTURE:
 * This interface defines the contract that all LLM providers must implement.
 * The design supports both completion and streaming modes, with unified token
 * counting and cost estimation across providers.
 *
 * @example
 * // Implementing a custom provider
 * class MyProvider implements LLMProvider {
 *   name = 'my-provider';
 *   models = ['my-model-v1'];
 *
 *   async complete(request: CompletionRequest): Promise<CompletionResponse> {
 *     // Implementation
 *   }
 *
 *   async isAvailable(): Promise<boolean> {
 *     // Health check
 *   }
 * }
 */

/**
 * Completion request to LLM provider
 *
 * Standardized request format that works across all providers.
 * Maps to provider-specific APIs internally.
 */
export interface CompletionRequest {
  /**
   * User prompt or message content
   */
  prompt: string;

  /**
   * Model identifier (provider-specific)
   * Examples: 'claude-sonnet-4-5-20250929', 'gpt-4-turbo'
   */
  model: string;

  /**
   * Maximum tokens to generate in response
   * @default 4096
   */
  maxTokens?: number;

  /**
   * Sampling temperature (0-1)
   * Higher = more creative, lower = more deterministic
   * @default 1.0
   */
  temperature?: number;

  /**
   * Stop sequences to end generation
   */
  stopSequences?: string[];

  /**
   * System prompt (context/instructions)
   * Maps to system message in most providers
   */
  systemPrompt?: string;
}

/**
 * Completion response from LLM provider
 *
 * Normalized response format with token usage and metadata.
 */
export interface CompletionResponse {
  /**
   * Generated text content
   */
  text: string;

  /**
   * Model used for generation (may differ from request if fallback occurred)
   */
  model: string;

  /**
   * Token usage breakdown
   */
  tokens: {
    /** Input tokens (prompt + system) */
    prompt: number;
    /** Output tokens (completion) */
    completion: number;
    /** Total tokens used */
    total: number;
  };

  /**
   * Reason generation stopped
   */
  finishReason: 'stop' | 'length' | 'error';
}

/**
 * Streaming chunk from LLM provider
 *
 * Emitted progressively during streaming completions.
 */
export interface StreamChunk {
  /**
   * Text delta (incremental content)
   */
  text: string;

  /**
   * Whether this is the final chunk
   */
  isComplete: boolean;
}

/**
 * LLM Provider Interface
 *
 * Contract that all LLM providers must implement to integrate with Cognition Σ.
 *
 * IMPLEMENTATION REQUIREMENTS:
 * - Must implement complete() for basic completions
 * - Should implement stream() for better UX (optional but recommended)
 * - Should implement estimateCost() for budget tracking (optional)
 * - Must implement isAvailable() for health monitoring
 *
 * @example
 * // Using a provider
 * const provider: LLMProvider = new ClaudeProvider();
 *
 * const response = await provider.complete({
 *   prompt: 'Explain quantum computing',
 *   model: 'claude-sonnet-4-5-20250929',
 *   maxTokens: 1000
 * });
 *
 * console.log(response.text);
 * console.log(`Cost: $${provider.estimateCost(response.tokens.total, response.model)}`);
 */
export interface LLMProvider {
  /**
   * Provider name (unique identifier)
   * Examples: 'claude', 'openai', 'local'
   */
  name: string;

  /**
   * Supported models
   * List of model identifiers this provider can use
   */
  models: string[];

  /**
   * Generate completion (non-streaming)
   *
   * @param request - Completion request parameters
   * @returns Promise resolving to completion response
   *
   * @example
   * const response = await provider.complete({
   *   prompt: 'What is TypeScript?',
   *   model: 'claude-sonnet-4-5-20250929',
   *   maxTokens: 500
   * });
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Generate streaming completion (optional)
   *
   * Yields incremental chunks as they're generated.
   * Provides better UX for long responses.
   *
   * @param request - Completion request parameters
   * @returns Async generator of stream chunks
   *
   * @example
   * for await (const chunk of provider.stream(request)) {
   *   process.stdout.write(chunk.text);
   *   if (chunk.isComplete) break;
   * }
   */
  stream?(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, undefined>;

  /**
   * Estimate cost in USD (optional)
   *
   * Provides rough cost estimate based on token usage.
   * Useful for budget tracking and provider comparison.
   *
   * @param tokens - Total token count
   * @param model - Model identifier
   * @returns Estimated cost in USD
   *
   * @example
   * const cost = provider.estimateCost(10000, 'gpt-4-turbo');
   * console.log(`Estimated cost: $${cost.toFixed(4)}`);
   */
  estimateCost?(tokens: number, model: string): number;

  /**
   * Check provider availability
   *
   * Performs health check to verify provider is accessible.
   * Used for provider selection and failover logic.
   *
   * @returns Promise resolving to availability status
   *
   * @example
   * const available = await provider.isAvailable();
   * if (!available) {
   *   console.warn('Provider unavailable, using fallback');
   * }
   */
  isAvailable(): Promise<boolean>;
}
