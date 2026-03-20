import type { LLMProvider } from './interfaces/provider.js';
import type { AgentProvider } from './interfaces/agent-provider.js';
import { isAgentProvider } from './interfaces/agent-provider.js';
import { systemDiagnosticsService } from '../../core/services/diagnostics/SystemDiagnosticsService.js';
import { BaseRegistry } from '../../core/common/registry.js';

/**
 * Provider Registry
 *
 * Singleton registry for LLM providers. Manages provider lifecycle
 * and provides convenient access methods.
 */
export class ProviderRegistry extends BaseRegistry<LLMProvider> {
  private defaultProvider = 'claude';

  constructor() {
    super('ProviderRegistry');
  }

  /**
   * Register a provider
   *
   * @param provider - Provider instance to register
   * @throws RegistryError if provider with same name already registered
   */
  registerProvider(provider: LLMProvider): void {
    super.register(provider.name, provider);

    // Set as default if it's the first provider
    if (this.items.size === 1) {
      this.defaultProvider = provider.name;
    }
  }

  /**
   * Get provider as AgentProvider (throws if not supported)
   *
   * @param name - Provider name
   * @returns AgentProvider instance
   * @throws Error if provider doesn't support agent mode
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
   */
  getDefault(): LLMProvider {
    if (this.items.size === 0) {
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
   */
  getDefaultAgent(): AgentProvider {
    return this.getAgent(this.defaultProvider);
  }

  /**
   * Set default provider
   *
   * @param name - Provider name to set as default
   * @throws Error if provider not registered
   */
  setDefault(name: string): void {
    if (!this.has(name)) {
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
   */
  async healthCheck(name: string): Promise<boolean> {
    const provider = this.get(name);
    const available = await provider.isAvailable();
    if (!available) {
      systemDiagnosticsService.systemLog(
        'llm',
        `Provider '${name}' is unavailable`,
        undefined,
        'warn'
      );
    }
    return available;
  }

  /**
   * List providers that support agent mode
   *
   * @returns Array of agent provider names
   */
  listAgentProviders(): string[] {
    return this.list().filter((name) => {
      const provider = this.items.get(name);
      return provider && isAgentProvider(provider);
    });
  }

  /**
   * Check if provider supports agent workflows
   *
   * @param name - Provider name
   * @returns True if provider supports agent mode
   */
  supportsAgent(name: string): boolean {
    const provider = this.items.get(name);
    return !!provider && isAgentProvider(provider);
  }

  /**
   * Remove provider from registry
   *
   * @param name - Provider name
   * @returns True if provider was removed, false if not found
   */
  override unregister(name: string): boolean {
    const removed = super.unregister(name);

    if (removed && this.defaultProvider === name) {
      // Reset default to first available provider or 'claude'
      const firstProvider = this.items.keys().next().value;
      this.defaultProvider = firstProvider || 'claude';
    }

    return removed;
  }

  /**
   * Clear all providers
   *
   * Removes all registered providers and resets default to 'claude'.
   */
  override clear(): void {
    super.clear();
    this.defaultProvider = 'claude';
  }

  /**
   * Get count of registered providers
   *
   * @returns Number of registered providers
   */
  count(): number {
    return this.items.size;
  }

  /**
   * Health check all providers
   *
   * Checks availability of all registered providers.
   *
   * @returns Object mapping provider names to availability status
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
 */
export const registry = new ProviderRegistry();
