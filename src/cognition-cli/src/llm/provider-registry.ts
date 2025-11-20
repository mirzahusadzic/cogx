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
 * console.log('Available agents:', agents);
 * ```
 */

import type { LLMProvider } from './provider-interface.js';
import type { AgentProvider } from './agent-provider-interface.js';
import { isAgentProvider } from './agent-provider-interface.js';

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
   *
   * @example
   * ```typescript
   * const claude = new ClaudeProvider(apiKey);
   * registry.register(claude);
   * ```
   */
  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Get provider by name
   *
   * @param name - Provider name
   * @returns Provider instance
   * @throws Error if provider not found
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
      throw new Error(
        `Provider '${name}' not found. Available providers: ${this.list().join(', ')}`
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
   *
   * @example
   * ```typescript
   * const provider = registry.getDefault();
   * ```
   */
  getDefault(): LLMProvider {
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
   *
   * @example
   * ```typescript
   * registry.setDefault('openai');
   * ```
   */
  setDefault(name: string): void {
    // Verify provider exists
    this.get(name);
    this.defaultProvider = name;
  }

  /**
   * List all registered providers
   *
   * @returns Array of provider names
   *
   * @example
   * ```typescript
   * const providers = registry.list();
   * console.log('Available:', providers);
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
   * console.log('Agent providers:', agents);
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
   * if (registry.has('openai')) {
   *   // Use OpenAI
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
   *
   * @example
   * ```typescript
   * registry.unregister('old-provider');
   * ```
   */
  unregister(name: string): void {
    this.providers.delete(name);
  }

  /**
   * Clear all providers
   *
   * @example
   * ```typescript
   * registry.clear();
   * ```
   */
  clear(): void {
    this.providers.clear();
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
