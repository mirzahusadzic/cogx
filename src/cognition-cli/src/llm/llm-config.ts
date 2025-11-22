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
 * - COGNITION_LLM_PROVIDER: Default provider ('claude' | 'gemini')
 * - ANTHROPIC_API_KEY: Claude API key
 * - COGNITION_CLAUDE_MODEL: Default Claude model
 * - GEMINI_API_KEY: Gemini API key
 * - COGNITION_GEMINI_MODEL: Default Gemini model
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
 * LLM configuration object
 */
export interface LLMConfig {
  /**
   * Default provider to use
   * @default 'claude'
   */
  defaultProvider: 'claude' | 'gemini' | string;

  /**
   * Provider-specific configurations
   */
  providers: {
    /** Claude configuration */
    claude?: ProviderConfig;

    /** Gemini configuration */
    gemini?: ProviderConfig;
  };
}

/**
 * Default Claude models by use case
 */
export const CLAUDE_MODELS = {
  /** Latest and most capable Sonnet model */
  latest: 'claude-sonnet-4-5-20250929',

  /** Balanced performance and cost */
  balanced: 'claude-3-5-sonnet-20241022',

  /** Most capable, highest cost */
  powerful: 'claude-3-opus-20240229',

  /** Fastest, lowest cost */
  fast: 'claude-3-haiku-20240307',
} as const;

/**
 * Default Gemini models by use case
 */
export const GEMINI_MODELS = {
  /** Latest and most capable Flash model */
  latest: 'gemini-2.5-flash',

  /** Balanced performance and cost */
  balanced: 'gemini-2.0-flash',

  /** Most capable Pro model */
  powerful: 'gemini-2.5-pro',

  /** Experimental thinking mode */
  thinking: 'gemini-2.0-flash-thinking-exp-01-21',
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

  if (!providerConfig.apiKey) {
    const envVarName =
      defaultProvider === 'claude' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY';
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
  provider: 'claude' | 'gemini'
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
  provider: 'claude' | 'gemini'
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
export function isProviderConfigured(provider: 'claude' | 'gemini'): boolean {
  const config = loadLLMConfig();
  const providerConfig = config.providers[provider];
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

  return providers;
}
