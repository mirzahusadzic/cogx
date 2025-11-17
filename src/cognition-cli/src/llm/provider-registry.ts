/**
 * LLM Provider Registry
 *
 * Central registry for managing multiple LLM providers within Cognition Σ.
 * Provides provider registration, lookup, and lifecycle management.
 *
 * DESIGN:
 * - Singleton pattern: Global registry instance
 * - Type-safe: TypeScript-enforced provider contract
 * - Dynamic: Register providers at runtime
 * - Observable: Health check and listing capabilities
 * - Configurable: Default provider selection
 *
 * USAGE:
 * 1. Register providers at application startup
 * 2. Set default provider (optional)
 * 3. Get providers by name when needed
 * 4. Perform health checks before critical operations
 *
 * @example
 * // Initialize registry
 * import { registry } from './provider-registry.js';
 * import { ClaudeProvider } from './providers/claude-provider.js';
 *
 * const claude = new ClaudeProvider();
 * registry.register(claude);
 * registry.setDefault('claude');
 *
 * // Use provider
 * const provider = registry.getDefault();
 * const response = await provider.complete({ prompt: '...', model: '...' });
 */

import type { LLMProvider } from './provider-interface.js';

/**
 * Provider Registry
 *
 * Manages the collection of available LLM providers.
 * Handles registration, retrieval, and configuration of providers.
 *
 * ARCHITECTURE:
 * - Map-based storage for O(1) lookup
 * - Explicit default provider management
 * - Error handling for missing providers
 * - Health check orchestration
 *
 * @example
 * const registry = new ProviderRegistry();
 *
 * // Register providers
 * registry.register(new ClaudeProvider());
 * registry.register(new OpenAIProvider());
 *
 * // Configure default
 * registry.setDefault('claude');
 *
 * // Retrieve and use
 * const provider = registry.get('openai');
 * const available = await registry.healthCheck('openai');
 */
export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();
  private defaultProvider: string = 'claude';

  /**
   * Register a new LLM provider
   *
   * Adds the provider to the registry, making it available for use.
   * If this is the first provider registered, it becomes the default.
   *
   * @param provider - Provider instance to register
   * @throws Error if provider with same name already registered
   *
   * @example
   * const claude = new ClaudeProvider(apiKey);
   * registry.register(claude);
   */
  register(provider: LLMProvider): void {
    if (this.providers.has(provider.name)) {
      throw new Error(
        `Provider '${provider.name}' is already registered. Unregister first if you want to replace it.`
      );
    }

    this.providers.set(provider.name, provider);

    // Set as default if it's the first provider
    if (this.providers.size === 1) {
      this.defaultProvider = provider.name;
    }
  }

  /**
   * Unregister a provider
   *
   * Removes provider from registry. If removing the default provider,
   * the default is automatically switched to another available provider.
   *
   * @param name - Name of provider to unregister
   * @returns True if provider was unregistered, false if not found
   *
   * @example
   * registry.unregister('openai');
   */
  unregister(name: string): boolean {
    const removed = this.providers.delete(name);

    if (removed && this.defaultProvider === name) {
      // Reset default to first available provider
      const firstProvider = this.providers.keys().next().value;
      this.defaultProvider = firstProvider || 'claude';
    }

    return removed;
  }

  /**
   * Get provider by name
   *
   * Retrieves a registered provider for use.
   *
   * @param name - Provider name
   * @returns Provider instance
   * @throws Error if provider not found
   *
   * @example
   * const claude = registry.get('claude');
   * const response = await claude.complete(request);
   */
  get(name: string): LLMProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      const available = Array.from(this.providers.keys()).join(', ');
      throw new Error(
        `Provider '${name}' not registered. Available providers: ${available || 'none'}`
      );
    }
    return provider;
  }

  /**
   * Get default provider
   *
   * Returns the currently configured default provider.
   * Useful for operations that don't specify a provider.
   *
   * @returns Default provider instance
   * @throws Error if no providers registered
   *
   * @example
   * const provider = registry.getDefault();
   * await provider.complete(request);
   */
  getDefault(): LLMProvider {
    if (this.providers.size === 0) {
      throw new Error(
        'No providers registered. Register at least one provider before use.'
      );
    }
    return this.get(this.defaultProvider);
  }

  /**
   * Set default provider
   *
   * Configures which provider to use when none is explicitly specified.
   *
   * @param name - Provider name to set as default
   * @throws Error if provider not registered
   *
   * @example
   * registry.setDefault('openai');
   * const provider = registry.getDefault(); // Returns OpenAI provider
   */
  setDefault(name: string): void {
    if (!this.providers.has(name)) {
      const available = Array.from(this.providers.keys()).join(', ');
      throw new Error(
        `Cannot set default to unregistered provider '${name}'. ` +
          `Available providers: ${available || 'none'}`
      );
    }
    this.defaultProvider = name;
  }

  /**
   * Get name of default provider
   *
   * @returns Name of current default provider
   */
  getDefaultName(): string {
    return this.defaultProvider;
  }

  /**
   * List all registered providers
   *
   * Returns names of all available providers.
   *
   * @returns Array of provider names
   *
   * @example
   * const providers = registry.list();
   * console.log(`Available: ${providers.join(', ')}`);
   */
  list(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if provider is registered
   *
   * @param name - Provider name to check
   * @returns True if provider exists in registry
   *
   * @example
   * if (registry.has('openai')) {
   *   const provider = registry.get('openai');
   * }
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Get count of registered providers
   *
   * @returns Number of providers in registry
   */
  count(): number {
    return this.providers.size;
  }

  /**
   * Health check for specific provider
   *
   * Tests whether a provider is currently available and operational.
   *
   * @param name - Provider name to check
   * @returns Promise resolving to availability status
   * @throws Error if provider not registered
   *
   * @example
   * const available = await registry.healthCheck('claude');
   * if (!available) {
   *   console.warn('Claude unavailable, switching to OpenAI');
   *   registry.setDefault('openai');
   * }
   */
  async healthCheck(name: string): Promise<boolean> {
    const provider = this.get(name);
    try {
      return await provider.isAvailable();
    } catch (error) {
      // Health check failed
      console.error(
        `Health check failed for ${name}:`,
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  /**
   * Health check all providers
   *
   * Tests availability of all registered providers.
   *
   * @returns Promise resolving to map of provider names to availability status
   *
   * @example
   * const health = await registry.healthCheckAll();
   * console.log('Claude:', health.claude ? '✓' : '✗');
   * console.log('OpenAI:', health.openai ? '✓' : '✗');
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    const checks = Array.from(this.providers.keys()).map(async (name) => {
      results[name] = await this.healthCheck(name);
    });

    await Promise.all(checks);
    return results;
  }

  /**
   * Clear all providers
   *
   * Removes all registered providers. Useful for testing.
   *
   * @example
   * // In test teardown
   * registry.clear();
   */
  clear(): void {
    this.providers.clear();
    this.defaultProvider = 'claude';
  }
}

/**
 * Global provider registry instance
 *
 * Singleton registry for application-wide provider management.
 * Import and use this instance throughout the application.
 *
 * @example
 * import { registry } from './llm/provider-registry.js';
 *
 * // In initialization
 * registry.register(new ClaudeProvider());
 *
 * // In application code
 * const provider = registry.getDefault();
 */
export const registry = new ProviderRegistry();
