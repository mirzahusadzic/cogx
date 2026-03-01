/**
 * LLM Provider Module
 *
 * Main entry point for the LLM provider abstraction layer.
 * Provides initialization, registry access, and convenience functions.
 *
 * USAGE:
 * 1. Call initializeProviders() at application startup
 * 2. Use registry to access providers
 * 3. Use complete() convenience function for simple completions
 *
 * @example
 * // Initialize providers
 * import { initializeProviders, registry, complete } from './llm/index.js';
 *
 * initializeProviders();
 *
 * // Simple completion
 * const text = await complete('What is TypeScript?');
 *
 * // Custom provider/model
 * const text = await complete('Explain quantum computing', {
 *   provider: 'gemini',
 *   model: 'gemini-3-flash-preview',
 *   maxTokens: 1000
 * });
 *
 * // Direct provider access
 * const claude = registry.get('claude');
 * const response = await claude.complete({ prompt: '...', model: '...' });
 */

import { registry } from './provider-registry.js';
import { GeminiAgentProvider } from './providers/gemini/agent-provider.js';
import { OpenAIAgentProvider } from './providers/openai/agent-provider.js';
import { MinimaxAgentProvider } from './providers/minimax/agent-provider.js';
import { systemLog } from '../utils/debug-logger.js';

// Re-export core types and classes
export { registry } from './provider-registry.js';
export type {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from './provider-interface.js';
export type { AgentProvider } from './agent-provider-interface.js';
export { isAgentProvider } from './agent-provider-interface.js';
export { BaseAgentProvider } from './providers/base-agent-provider.js';
export type { UnifiedStreamingChunk } from './types.js';
export { GeminiAgentProvider } from './providers/gemini/agent-provider.js';
export { OpenAIAgentProvider } from './providers/openai/agent-provider.js';
export { MinimaxAgentProvider } from './providers/minimax/agent-provider.js';

// Claude provider is dynamically imported to make it optional
export type { ClaudeProvider } from './providers/claude/agent-provider.js';

/**
 * Provider initialization options
 */
export interface InitializeOptions {
  /**
   * Anthropic API key (optional, defaults to ANTHROPIC_API_KEY env var)
   */
  anthropicApiKey?: string;

  /**
   * Google API key for Gemini (optional, defaults to GEMINI_API_KEY env var)
   */
  googleApiKey?: string;

  /**
   * OpenAI API key (optional, defaults to OPENAI_API_KEY env var)
   */
  openaiApiKey?: string;

  /**
   * OpenAI base URL for custom endpoints like eGemma (optional, defaults to OPENAI_BASE_URL env var)
   */
  openaiBaseUrl?: string;

  /**
   * Minimax API key (optional, defaults to MINIMAX_API_KEY env var)
   */
  minimaxApiKey?: string;

  /**
   * Default provider to use
   * @default 'gemini'
   */
  defaultProvider?: 'claude' | 'gemini' | 'openai' | string;

  /**
   * Whether to skip provider initialization if API keys missing
   * @default false (throws error if keys missing)
   */
  skipMissingProviders?: boolean;
}

/**
 * Initialize LLM providers
 *
 * Registers available providers with the registry.
 * Call this at application startup.
 *
 * BEHAVIOR:
 * - Attempts to register Claude if ANTHROPIC_API_KEY is set
 * - Attempts to register Gemini if GEMINI_API_KEY is set
 * - Sets default provider based on options or first available
 *
 * @param options - Initialization options
 * @throws Error if required API keys are missing and skipMissingProviders is false
 *
 * @example
 * // Initialize with environment variables
 * initializeProviders();
 *
 * @example
 * // Initialize with explicit keys
 * initializeProviders({
 *   anthropicApiKey: 'sk-ant-...',
 *   googleApiKey: 'AIza...',
 *   defaultProvider: 'gemini'
 * });
 *
 * @example
 * // Skip missing providers
 * initializeProviders({
 *   skipMissingProviders: true
 * });
 */
export async function initializeProviders(
  options: InitializeOptions = {}
): Promise<void> {
  const {
    anthropicApiKey,
    googleApiKey,
    openaiApiKey,
    openaiBaseUrl,
    minimaxApiKey,
    defaultProvider = 'gemini',
    skipMissingProviders = true, // Changed default to true
  } = options;

  // Skip re-initialization if providers are already registered
  if (registry.list().length > 0) {
    return;
  }

  // Track which providers were successfully registered
  const registered: string[] = [];

  // Register Claude (optional - requires optional peer dependency and API key)
  if (!registry.has('claude')) {
    try {
      const apiKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;

      if (apiKey) {
        // Dynamic import to make Claude SDK optional
        const { ClaudeProvider } =
          await import('./providers/claude/agent-provider.js');

        const claude = new ClaudeProvider(apiKey);

        // Always register the provider (basic completions work without Agent SDK)
        registry.register(claude);
        registered.push('claude');

        // Check if agent mode is available (requires optional Claude Agent SDK)
        await claude.ensureAgentModeReady();
        // Note: If SDK is not available, agent mode will be disabled silently
      }
    } catch (error) {
      if (skipMissingProviders) {
        // Silent skip if SDK not installed
        if (
          error instanceof Error &&
          error.message.includes('Cannot find module')
        ) {
          // SDK not installed - this is OK
        } else {
          systemLog(
            'llm',
            'Failed to load Claude provider due to dynamic import error',
            {
              error: error instanceof Error ? error.message : String(error),
              fullError: error, // Log the full error object for more details
            },
            'error'
          );
        }
      } else {
        throw error;
      }
    }
  } else {
    registered.push('claude');
  }

  // Register Gemini (ADK-based agent) if API key is available OR Vertex AI is enabled
  const geminiKey = googleApiKey || process.env.GEMINI_API_KEY;
  const useVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';

  if ((geminiKey || useVertex) && !registry.has('gemini')) {
    try {
      const gemini = new GeminiAgentProvider(geminiKey);
      registry.register(gemini);
      registered.push('gemini');
    } catch (error) {
      if (skipMissingProviders) {
        systemLog(
          'llm',
          'Skipping Gemini provider',
          { error: error instanceof Error ? error.message : String(error) },
          'warn'
        );
      } else {
        throw error;
      }
    }
  } else if (registry.has('gemini')) {
    registered.push('gemini');
  }

  // Register OpenAI (works with OpenAI API or OpenAI-compatible endpoints like eGemma)
  const openaiKey = openaiApiKey || process.env.OPENAI_API_KEY;
  const openaiBase = openaiBaseUrl || process.env.OPENAI_BASE_URL;
  // Register if we have an API key OR a custom base URL (local endpoints may not need keys)
  if ((openaiKey || openaiBase) && !registry.has('openai')) {
    try {
      const openai = new OpenAIAgentProvider({
        apiKey: openaiKey,
        baseUrl: openaiBase,
      });
      registry.register(openai);
      registered.push('openai');
    } catch (error) {
      if (skipMissingProviders) {
        systemLog(
          'llm',
          'Skipping OpenAI provider',
          { error: error instanceof Error ? error.message : String(error) },
          'warn'
        );
      } else {
        throw error;
      }
    }
  } else if (registry.has('openai')) {
    registered.push('openai');
  }

  // Register Minimax (Anthropic-compatible API)
  const minimaxKey = minimaxApiKey || process.env.MINIMAX_API_KEY;
  if (minimaxKey && !registry.has('minimax')) {
    try {
      const minimax = new MinimaxAgentProvider({
        apiKey: minimaxKey,
      });
      registry.register(minimax);
      registered.push('minimax');
    } catch (error) {
      if (skipMissingProviders) {
        systemLog(
          'llm',
          'Skipping Minimax provider',
          { error: error instanceof Error ? error.message : String(error) },
          'warn'
        );
      } else {
        throw error;
      }
    }
  } else if (registry.has('minimax')) {
    registered.push('minimax');
  }

  // Set default provider if it was successfully registered
  if (registered.includes(defaultProvider)) {
    registry.setDefault(defaultProvider);
  } else if (registered.length > 0) {
    // Fallback to first registered provider
    registry.setDefault(registered[0]);
    systemLog(
      'llm',
      `Default provider '${defaultProvider}' not available, using '${registered[0]}' instead`,
      undefined,
      'warn'
    );
  } else {
    throw new Error(
      'No LLM providers could be initialized. Please configure at least one provider.'
    );
  }
}

/**
 * Completion options for convenience function
 */
export interface CompletionOptions {
  /**
   * Provider to use (defaults to registry default)
   */
  provider?: string;

  /**
   * Model to use (defaults to provider's first model)
   */
  model?: string;

  /**
   * System prompt/context
   */
  systemPrompt?: string;

  /**
   * Maximum tokens to generate
   * @default 4096
   */
  maxTokens?: number;

  /**
   * Sampling temperature (0-1)
   * @default 1.0
   */
  temperature?: number;

  /**
   * Stop sequences
   */
  stopSequences?: string[];
}

/**
 * Convenience function for simple completions
 *
 * Wrapper around provider.complete() for common use cases.
 * Automatically selects provider and model if not specified.
 *
 * @param prompt - User prompt
 * @param options - Optional completion parameters
 * @returns Promise resolving to completion text
 *
 * @example
 * // Simple completion (uses default provider and model)
 * const text = await complete('What is TypeScript?');
 *
 * @example
 * // With custom provider and model
 * const text = await complete('Explain quantum computing', {
 *   provider: 'gemini',
 *   model: 'gemini-3-flash-preview',
 *   maxTokens: 1000,
 *   temperature: 0.7
 * });
 *
 * @example
 * // With system prompt
 * const text = await complete('Review this code', {
 *   systemPrompt: 'You are a code reviewer focused on security and performance',
 *   maxTokens: 2000
 * });
 */
export async function complete(
  prompt: string,
  options: CompletionOptions = {}
): Promise<string> {
  const {
    provider: providerName,
    model,
    systemPrompt,
    maxTokens,
    temperature,
    stopSequences,
  } = options;

  // Get provider (default to registry default)
  const provider = providerName
    ? registry.get(providerName)
    : registry.getDefault();

  // Auto-select model if not specified
  const selectedModel = model || provider.models[0];

  // Make completion request
  const response = await provider.complete({
    prompt,
    model: selectedModel,
    systemPrompt,
    maxTokens,
    temperature,
    stopSequences,
  });

  return response.text;
}

/**
 * Streaming completion options
 */
export interface StreamCompletionOptions extends CompletionOptions {
  /**
   * Callback for each chunk
   */
  onChunk?: (chunk: string) => void;
}

/**
 * Convenience function for streaming completions
 *
 * Wrapper around provider.stream() for common use cases.
 * Automatically selects provider and model if not specified.
 *
 * @param prompt - User prompt
 * @param options - Optional completion parameters
 * @returns Async generator of text chunks
 *
 * @example
 * // Stream to console
 * for await (const chunk of streamComplete('Write a story')) {
 *   process.stdout.write(chunk);
 * }
 *
 * @example
 * // With callback
 * let fullText = '';
 * for await (const chunk of streamComplete('Explain AI', {
 *   onChunk: (text) => fullText += text
 * })) {
 *   // Process chunks
 * }
 */
export async function* streamComplete(
  prompt: string,
  options: StreamCompletionOptions = {}
): AsyncGenerator<string, void, undefined> {
  const {
    provider: providerName,
    model,
    systemPrompt,
    maxTokens,
    temperature,
    stopSequences,
    onChunk,
  } = options;

  // Get provider (default to registry default)
  const provider = providerName
    ? registry.get(providerName)
    : registry.getDefault();

  // Check if provider supports streaming
  if (!provider.stream) {
    throw new Error(`Provider '${provider.name}' does not support streaming`);
  }

  // Auto-select model if not specified
  const selectedModel = model || provider.models[0];

  // Stream completion
  for await (const chunk of provider.stream({
    prompt,
    model: selectedModel,
    systemPrompt,
    maxTokens,
    temperature,
    stopSequences,
  })) {
    if (chunk.delta) {
      if (onChunk) {
        onChunk(chunk.delta);
      }
      yield chunk.delta;
    }

    if (chunk.done) {
      break;
    }
  }
}
