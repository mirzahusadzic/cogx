/**
 * Base LLM Provider Interface
 *
 * Defines the contract for all LLM providers in the Cognition system.
 * Providers implement this interface to enable basic completions, streaming,
 * cost estimation, and availability checking.
 *
 * This is the foundation interface. For agent-specific features (tool calling,
 * MCP servers, session management), see AgentProvider in agent-provider-interface.ts.
 *
 * @example
 * ```typescript
 * class MyProvider implements LLMProvider {
 *   name = 'my-provider';
 *   models = ['my-model-1', 'my-model-2'];
 *
 *   async complete(request: CompletionRequest): Promise<CompletionResponse> {
 *     // Implementation
 *   }
 *
 *   async isAvailable(): Promise<boolean> {
 *     return true;
 *   }
 * }
 * ```
 */

/**
 * Basic completion request
 */
export interface CompletionRequest {
  /** User prompt */
  prompt: string;

  /** Model identifier (provider-specific) */
  model: string;

  /** System prompt (optional) */
  systemPrompt?: string;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Temperature (0-1, lower = more deterministic) */
  temperature?: number;

  /** Stop sequences */
  stopSequences?: string[];
}

/**
 * Basic completion response
 */
export interface CompletionResponse {
  /** Generated text */
  text: string;

  /** Model used */
  model: string;

  /** Token usage */
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };

  /** Finish reason */
  finishReason: 'stop' | 'length' | 'error';
}

/**
 * Streaming chunk
 */
export interface StreamChunk {
  /** Delta text */
  delta: string;

  /** Cumulative text so far */
  text: string;

  /** Whether this is the final chunk */
  done: boolean;

  /** Token usage (only present in final chunk) */
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * Base LLM Provider Interface
 *
 * All LLM providers must implement this interface to enable basic completions
 * across Claude, Gemini, and other providers.
 */
export interface LLMProvider {
  /** Provider name (e.g., 'claude', 'gemini') */
  name: string;

  /** Available models */
  models: string[];

  /**
   * Generate a completion
   *
   * @param request - Completion request
   * @returns Completion response
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Stream a completion (optional)
   *
   * Providers that support streaming should implement this method.
   * Returns async generator of text deltas.
   *
   * @param request - Completion request
   * @returns Async generator of stream chunks
   */
  stream?(request: CompletionRequest): AsyncGenerator<StreamChunk>;

  /**
   * Check if provider is available
   *
   * Verifies API keys, network connectivity, etc.
   *
   * @returns True if provider can be used
   */
  isAvailable(): Promise<boolean>;

  /**
   * Estimate cost for token usage (optional)
   *
   * Returns estimated cost in USD.
   *
   * @param tokens - Number of tokens
   * @param model - Model identifier
   * @returns Estimated cost in USD
   */
  estimateCost?(tokens: number, model: string): number;
}
