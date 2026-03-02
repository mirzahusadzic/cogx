/**
 * Provider Registry
 *
 * Central registry for managing LLM providers in the Cognition system.
 * Handles provider registration, lookup, and default provider management.
 *
 * Supports both basic LLMProvider and AgentProvider interfaces, enabling
 * the TUI to work with different LLM providers while maintaining full
 * feature parity.
 *
 * @example
 * ```typescript
 * import { registry } from './llm/index.js';
 *
 * // Get agent provider for TUI
 * const provider = registry.getAgent('claude');
 *
 * // List available agent providers
 * const agents = registry.listAgentProviders();
 * systemLog('llm', 'Available agents:', agents);
 * ```
 */

import type { LLMProvider } from './interfaces/provider.js';
import type { AgentProvider } from './interfaces/agent-provider.js';
import { isAgentProvider } from './interfaces/agent-provider.js';
import { systemLog } from '../../utils/debug-logger.js';

/**
 * Provider Registry
 *
 * Singleton registry for LLM providers. Manages provider lifecycle
 * and provides convenient access methods.
 */
export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();
  private defaultProvider = 'claude';

  /**
   * Register a provider
   *
   * @param provider - Provider instance to register
   * @throws Error if provider with same name already registered
   *
   * @example
   * ```typescript
   * const claude = new ClaudeProvider(apiKey);
   * registry.register(claude);
   * ```
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
   * Get provider by name
   *
   * @param name - Provider name
   * @returns Provider instance
   * @throws Error if provider not registered
   *
   * @example
   * ```typescript
   * const provider = registry.get('claude');
   * await provider.complete(request);
   * ```
   */
  get(name: string): LLMProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      const available = this.list().join(', ') || 'none';
      throw new Error(
        `Provider '${name}' not registered. Available providers: ${available}`
      );
    }
    return provider;
  }

  /**
   * Get provider as AgentProvider (throws if not supported)
   *
   * @param name - Provider name
   * @returns AgentProvider instance
   * @throws Error if provider doesn't support agent mode
   *
   * @example
   * ```typescript
   * const agent = registry.getAgent('claude');
   *
   * for await (const response of agent.executeAgent(request)) {
   *   console.log(response.messages);
   * }
   * ```
   */
  getAgent(name: string): AgentProvider {
    const provider = this.get(name);
    if (!isAgentProvider(provider)) {
      throw new Error(
        `Provider '${name}' does not support agent mode. ` +
          `Available agent providers: ${this.listAgentProviders().join(', ')}`
      );
    }
    return provider;
  }

  /**
   * Get default provider
   *
   * @returns Default provider instance
   * @throws Error if no providers registered
   *
   * @example
   * ```typescript
   * const provider = registry.getDefault();
   * ```
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
   * Get default provider as AgentProvider
   *
   * @returns Default AgentProvider instance
   * @throws Error if default provider doesn't support agent mode
   *
   * @example
   * ```typescript
   * const agent = registry.getDefaultAgent();
   * ```
   */
  getDefaultAgent(): AgentProvider {
    return this.getAgent(this.defaultProvider);
  }

  /**
   * Set default provider
   *
   * @param name - Provider name to set as default
   * @throws Error if provider not registered
   *
   * @example
   * ```typescript
   * registry.setDefault('gemini');
   * ```
   */
  setDefault(name: string): void {
    if (!this.providers.has(name)) {
      const available = this.list().join(', ') || 'none';
      throw new Error(
        `Cannot set default to unregistered provider '${name}'. ` +
          `Available providers: ${available}`
      );
    }
    this.defaultProvider = name;
  }

  /**
   * Get name of default provider
   *
   * @returns Name of current default provider
   *
   * @example
   * ```typescript
   * const defaultName = registry.getDefaultName();
   * systemLog('llm', `Default provider: ${defaultName}`);
   * ```
   */
  getDefaultName(): string {
    return this.defaultProvider;
  }

  /**
   * Health check for provider
   *
   * Tests if provider is available and functional.
   *
   * @param name - Provider name
   * @returns True if provider is available
   * @throws Error if provider not registered
   *
   * @example
   * ```typescript
   * const available = await registry.healthCheck('claude');
   * if (!available) {
   *   console.warn('Claude is unavailable');
   * }
   * ```
   */
  async healthCheck(name: string): Promise<boolean> {
    const provider = this.get(name);
    const available = await provider.isAvailable();
    if (!available) {
      systemLog('llm', `Provider '${name}' is unavailable`, undefined, 'warn');
    }
    return available;
  }

  /**
   * List all registered providers
   *
   * @returns Array of provider names
   *
   * @example
   * ```typescript
   * const providers = registry.list();
   * systemLog('llm', 'Available:', providers);
   * ```
   */
  list(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * List providers that support agent mode
   *
   * @returns Array of agent provider names
   *
   * @example
   * ```typescript
   * const agents = registry.listAgentProviders();
   * systemLog('llm', 'Agent providers:', agents);
   * ```
   */
  listAgentProviders(): string[] {
    return this.list().filter((name) => {
      const provider = this.providers.get(name);
      return provider && isAgentProvider(provider);
    });
  }

  /**
   * Check if provider supports agent workflows
   *
   * @param name - Provider name
   * @returns True if provider supports agent mode
   *
   * @example
   * ```typescript
   * if (registry.supportsAgent('claude')) {
   *   // Use agent features
   * }
   * ```
   */
  supportsAgent(name: string): boolean {
    const provider = this.providers.get(name);
    return !!provider && isAgentProvider(provider);
  }

  /**
   * Check if provider is registered
   *
   * @param name - Provider name
   * @returns True if provider exists
   *
   * @example
   * ```typescript
   * if (registry.has('gemini')) {
   *   // Use Gemini
   * }
   * ```
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Remove provider from registry
   *
   * @param name - Provider name
   * @returns True if provider was removed, false if not found
   *
   * @example
   * ```typescript
   * const removed = registry.unregister('old-provider');
   * if (!removed) {
   *   console.warn('Provider was not registered');
   * }
   * ```
   */
  unregister(name: string): boolean {
    const removed = this.providers.delete(name);

    if (removed && this.defaultProvider === name) {
      // Reset default to first available provider or 'claude'
      const firstProvider = this.providers.keys().next().value;
      this.defaultProvider = firstProvider || 'claude';
    }

    return removed;
  }

  /**
   * Clear all providers
   *
   * Removes all registered providers and resets default to 'claude'.
   *
   * @example
   * ```typescript
   * registry.clear();
   * ```
   */
  clear(): void {
    this.providers.clear();
    this.defaultProvider = 'claude';
  }

  /**
   * Get count of registered providers
   *
   * @returns Number of registered providers
   *
   * @example
   * ```typescript
   * const count = registry.count();
   * systemLog('llm', `${count} providers registered`);
   * ```
   */
  count(): number {
    return this.providers.size;
  }

  /**
   * Health check all providers
   *
   * Checks availability of all registered providers.
   *
   * @returns Object mapping provider names to availability status
   *
   * @example
   * ```typescript
   * const results = await registry.healthCheckAll();
   * for (const [name, available] of Object.entries(results)) {
   *   systemLog('llm', `${name}: ${available ? 'available' : 'unavailable'}`);
   * }
   * ```
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const name of this.list()) {
      try {
        results[name] = await this.healthCheck(name);
      } catch {
        results[name] = false;
      }
    }

    return results;
  }
}

/**
 * Global provider registry instance
 *
 * Import this to access registered providers throughout the application.
 *
 * @example
 * ```typescript
 * import { registry } from './llm/index.js';
 *
 * const provider = registry.getAgent('claude');
 * ```
 */
export const registry = new ProviderRegistry();
