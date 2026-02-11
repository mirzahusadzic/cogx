/**
 * LLM Configuration Module
 *
 * Manages LLM provider configuration from environment variables and config files.
 * Provides a unified interface for accessing provider settings.
 *
 * CONFIGURATION SOURCES (priority order):
 * 1. Environment variables (highest priority)
 * 2. ~/.cognition-cli/settings.json (persistent user settings)
 * 3. Default values (fallback)
 *
 * ENVIRONMENT VARIABLES:
 * - COGNITION_LLM_PROVIDER: Default provider ('claude' | 'gemini' | 'openai')
 * - ANTHROPIC_API_KEY: Claude API key
 * - COGNITION_CLAUDE_MODEL: Default Claude model
 * - GEMINI_API_KEY: Gemini API key
 * - COGNITION_GEMINI_MODEL: Default Gemini model
 * - OPENAI_API_KEY: OpenAI API key
 * - OPENAI_BASE_URL: Custom endpoint for OpenAI-compatible APIs (e.g., eGemma)
 * - COGNITION_OPENAI_MODEL: Default OpenAI model
 *
 * @example
 * // Load configuration
 * const config = loadLLMConfig();
 *
 * console.log(`Default provider: ${config.defaultProvider}`);
 * console.log(`Claude model: ${config.providers.claude?.defaultModel}`);
 */

import { loadSettings } from '../core/security/security-bootstrap.js';

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  /**
   * API key for the provider
   * Should be loaded from environment variables
   */
  apiKey?: string;

  /**
   * Default model to use with this provider
   */
  defaultModel?: string;
}

/**
 * OpenAI-specific configuration
 */
export interface OpenAIProviderConfig extends ProviderConfig {
  /**
   * Base URL for OpenAI-compatible API
   * Defaults to OpenAI's API, can be set to local endpoints like eGemma
   */
  baseUrl?: string;
}

/**
 * LLM configuration object
 */
export interface LLMConfig {
  /**
   * Default provider to use
   * @default 'claude'
   */
  defaultProvider: 'claude' | 'gemini' | 'openai' | string;

  /**
   * Provider-specific configurations
   */
  providers: {
    /** Claude configuration */
    claude?: ProviderConfig;

    /** Gemini configuration */
    gemini?: ProviderConfig;

    /** OpenAI configuration (also works with OpenAI-compatible endpoints like eGemma) */
    openai?: OpenAIProviderConfig;
  };
}

/**
 * Default Claude models by use case
 */
export const CLAUDE_MODELS = {
  /** Most capable Opus model (default) */
  latest: 'claude-opus-4-5-20251101',

  /** Balanced performance and cost */
  balanced: 'claude-sonnet-4-5-20250929',
} as const;

/**
 * Default Gemini models by use case
 */
export const GEMINI_MODELS = {
  /** Latest and most capable model - Gemini 3.0 Flash Preview (Primary Economical) */
  latest: 'gemini-3-flash-preview',

  /** Gemini 3.0 Flash Preview with advanced reasoning */
  flashPreview: 'gemini-3-flash-preview',

  /** Most capable Pro model */
  powerful: 'gemini-3.0-pro-preview',

  /** Balanced performance and cost - Defaulting to Gemini 3 Flash as 2.x reaches EOL */
  balanced: 'gemini-3-flash-preview',
} as const;

/**
 * Default OpenAI models by use case
 */
export const OPENAI_MODELS = {
  /** GPT-4o - latest and most capable */
  latest: 'gpt-4o',

  /** GPT-4o mini - fast and affordable */
  fast: 'gpt-4o-mini',

  /** o1 - reasoning model */
  reasoning: 'o1',

  /** o3 - next-gen reasoning */
  reasoningNext: 'o3',
} as const;

/**
 * Local models (OpenAI-compatible via eGemma)
 */
export const LOCAL_MODELS = {
  /** GPT-OSS 20B */
  gptOss20b: 'gpt-oss-20b',

  /** GPT-OSS 120B */
  gptOss120b: 'gpt-oss-120b',
} as const;

/**
 * Load LLM configuration
 *
 * Reads configuration from environment variables and settings file.
 * This function does not throw errors - it returns defaults for missing values.
 *
 * PRECEDENCE (highest to lowest):
 * 1. Environment variables
 * 2. ~/.cognition-cli/settings.json
 * 3. Default values
 *
 * @returns LLM configuration object
 *
 * @example
 * // Load configuration
 * const config = loadLLMConfig();
 *
 * // Check if Claude is configured
 * if (config.providers.claude?.apiKey) {
 *   console.log('Claude is configured');
 * }
 *
 * // Get default model
 * const model = config.providers.claude?.defaultModel || CLAUDE_MODELS.latest;
 */
export function loadLLMConfig(): LLMConfig {
  // Load persistent settings
  const settings = loadSettings();

  return {
    // Default provider: env var > settings file > 'gemini'
    defaultProvider:
      process.env.COGNITION_LLM_PROVIDER ||
      settings.defaultProvider ||
      'gemini',

    providers: {
      // Claude configuration
      claude: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        defaultModel:
          process.env.COGNITION_CLAUDE_MODEL || CLAUDE_MODELS.latest,
      },

      // Gemini configuration
      gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        defaultModel:
          process.env.COGNITION_GEMINI_MODEL || GEMINI_MODELS.latest,
      },

      // OpenAI configuration (also works with OpenAI-compatible endpoints)
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
        defaultModel:
          process.env.COGNITION_OPENAI_MODEL || OPENAI_MODELS.latest,
      },
    },
  };
}

/**
 * Validate LLM configuration
 *
 * Checks if the configuration is valid and all required values are present.
 * Returns validation errors if any.
 *
 * @param config - Configuration to validate
 * @returns Array of validation error messages (empty if valid)
 *
 * @example
 * const config = loadLLMConfig();
 * const errors = validateLLMConfig(config);
 *
 * if (errors.length > 0) {
 *   console.error('Configuration errors:', errors);
 *   process.exit(1);
 * }
 */
export function validateLLMConfig(config: LLMConfig): string[] {
  const errors: string[] = [];

  // Check if default provider is configured
  const defaultProvider = config.defaultProvider;
  const providerConfig =
    config.providers[defaultProvider as keyof typeof config.providers];

  if (!providerConfig) {
    errors.push(
      `Default provider '${defaultProvider}' is not configured in providers section`
    );
    return errors;
  }

  // OpenAI with custom base URL doesn't require API key
  const isOpenAIWithCustomUrl =
    defaultProvider === 'openai' &&
    (config.providers.openai as OpenAIProviderConfig)?.baseUrl;

  // Gemini with Vertex AI doesn't require GEMINI_API_KEY
  const isGeminiVertex =
    defaultProvider === 'gemini' &&
    process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';

  if (!providerConfig.apiKey && !isOpenAIWithCustomUrl && !isGeminiVertex) {
    const envVarMap: Record<string, string> = {
      claude: 'ANTHROPIC_API_KEY',
      gemini: 'GEMINI_API_KEY',
      openai: 'OPENAI_API_KEY',
    };
    const envVarName = envVarMap[defaultProvider] || 'API_KEY';
    errors.push(
      `Default provider '${defaultProvider}' is missing API key. ` +
        `Set ${envVarName} environment variable.`
    );
  }

  // Validate model configuration
  if (!providerConfig.defaultModel) {
    errors.push(
      `Default provider '${defaultProvider}' is missing default model configuration`
    );
  }

  return errors;
}

/**
 * Get API key for a specific provider
 *
 * Convenience function to retrieve API key for a provider from config.
 *
 * @param provider - Provider name ('claude' | 'gemini')
 * @returns API key or undefined if not configured
 *
 * @example
 * const claudeKey = getProviderApiKey('claude');
 * if (!claudeKey) {
 *   console.warn('Claude API key not configured');
 * }
 */
export function getProviderApiKey(
  provider: 'claude' | 'gemini' | 'openai'
): string | undefined {
  const config = loadLLMConfig();
  return config.providers[provider]?.apiKey;
}

/**
 * Get default model for a specific provider
 *
 * Convenience function to retrieve default model for a provider from config.
 *
 * @param provider - Provider name ('claude' | 'gemini')
 * @returns Default model or undefined if not configured
 *
 * @example
 * const claudeModel = getProviderDefaultModel('claude');
 * console.log(`Using Claude model: ${claudeModel}`);
 */
export function getProviderDefaultModel(
  provider: 'claude' | 'gemini' | 'openai'
): string | undefined {
  const config = loadLLMConfig();
  return config.providers[provider]?.defaultModel;
}

/**
 * Check if a provider is configured
 *
 * Determines if a provider has the minimum required configuration (API key).
 *
 * @param provider - Provider name ('claude' | 'gemini')
 * @returns True if provider is configured and usable
 *
 * @example
 * if (isProviderConfigured('gemini')) {
 *   console.log('Gemini is available');
 * } else {
 *   console.log('Gemini not configured, falling back to Claude');
 * }
 */
export function isProviderConfigured(
  provider: 'claude' | 'gemini' | 'openai'
): boolean {
  const config = loadLLMConfig();
  const providerConfig = config.providers[provider];

  // OpenAI is considered configured if it has an API key OR a custom base URL
  if (provider === 'openai') {
    const openaiConfig = providerConfig as OpenAIProviderConfig | undefined;
    return !!(openaiConfig?.apiKey || openaiConfig?.baseUrl);
  }

  // Gemini is considered configured if it has an API key OR Vertex AI is enabled
  if (provider === 'gemini') {
    const isVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
    return !!(providerConfig?.apiKey || isVertex);
  }

  return !!providerConfig?.apiKey;
}

/**
 * Get list of configured providers
 *
 * Returns names of all providers that have valid API keys.
 *
 * @returns Array of configured provider names
 *
 * @example
 * const available = getConfiguredProviders();
 * console.log(`Available providers: ${available.join(', ')}`);
 */
export function getConfiguredProviders(): string[] {
  const providers: string[] = [];

  if (isProviderConfigured('claude')) {
    providers.push('claude');
  }

  if (isProviderConfigured('gemini')) {
    providers.push('gemini');
  }

  if (isProviderConfigured('openai')) {
    providers.push('openai');
  }

  return providers;
}
