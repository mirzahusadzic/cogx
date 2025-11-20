/**
 * LLM Provider Abstraction Layer
 *
 * Central module for LLM provider management in Cognition.
 * Exports provider interfaces, implementations, and the global registry.
 *
 * Usage:
 * ```typescript
 * import { registry } from './llm/index.js';
 *
 * // Initialize providers
 * await initializeProviders();
 *
 * // Use in TUI
 * const agent = registry.getAgent('claude');
 * ```
 */

export * from './provider-interface.js';
export * from './agent-provider-interface.js';
export * from './provider-registry.js';
export * from './providers/claude-provider.js';

import { registry } from './provider-registry.js';
import { ClaudeProvider } from './providers/claude-provider.js';

/**
 * Initialize default providers
 *
 * Registers Claude provider with API key from environment.
 * Call this once at application startup.
 *
 * @example
 * ```typescript
 * await initializeProviders();
 * ```
 */
export async function initializeProviders(): Promise<void> {
  // Register Claude provider
  const claude = new ClaudeProvider(process.env.ANTHROPIC_API_KEY);
  registry.register(claude);
  registry.setDefault('claude');
}

export { registry };
