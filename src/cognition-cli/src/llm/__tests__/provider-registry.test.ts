/**
 * Provider Registry Tests
 *
 * Unit tests for the LLM provider registry.
 * Tests registration, retrieval, and management of providers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from '../provider-registry.js';
import type {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
} from '../provider-interface.js';

/**
 * Mock provider for testing
 */
class MockProvider implements LLMProvider {
  constructor(
    public name: string,
    public models: string[] = ['mock-model-v1']
  ) {}

  async complete(_request: CompletionRequest): Promise<CompletionResponse> {
    return {
      text: 'mock response',
      model: this.models[0],
      tokens: { prompt: 10, completion: 10, total: 20 },
      finishReason: 'stop' as const,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

/**
 * Mock unavailable provider for testing
 */
class UnavailableProvider extends MockProvider {
  async isAvailable(): Promise<boolean> {
    return false;
  }
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('register()', () => {
    it('should register a provider', () => {
      const provider = new MockProvider('test');
      registry.register(provider);

      expect(registry.has('test')).toBe(true);
      expect(registry.get('test')).toBe(provider);
    });

    it('should set first registered provider as default', () => {
      const provider = new MockProvider('test');
      registry.register(provider);

      expect(registry.getDefaultName()).toBe('test');
    });

    it('should throw when registering duplicate provider', () => {
      const provider1 = new MockProvider('test');
      const provider2 = new MockProvider('test');

      registry.register(provider1);

      expect(() => registry.register(provider2)).toThrow(/already registered/);
    });

    it('should not change default when registering second provider', () => {
      const provider1 = new MockProvider('first');
      const provider2 = new MockProvider('second');

      registry.register(provider1);
      registry.register(provider2);

      expect(registry.getDefaultName()).toBe('first');
    });
  });

  describe('unregister()', () => {
    it('should unregister a provider', () => {
      const provider = new MockProvider('test');
      registry.register(provider);

      const result = registry.unregister('test');

      expect(result).toBe(true);
      expect(registry.has('test')).toBe(false);
    });

    it('should return false when unregistering non-existent provider', () => {
      const result = registry.unregister('nonexistent');

      expect(result).toBe(false);
    });

    it('should update default when unregistering default provider', () => {
      const provider1 = new MockProvider('first');
      const provider2 = new MockProvider('second');

      registry.register(provider1);
      registry.register(provider2);

      registry.unregister('first');

      expect(registry.getDefaultName()).toBe('second');
    });
  });

  describe('get()', () => {
    it('should retrieve registered provider', () => {
      const provider = new MockProvider('test');
      registry.register(provider);

      const retrieved = registry.get('test');

      expect(retrieved).toBe(provider);
    });

    it('should throw when getting unregistered provider', () => {
      expect(() => registry.get('nonexistent')).toThrow(
        /Provider 'nonexistent' not registered/
      );
    });

    it('should include available providers in error message', () => {
      const provider = new MockProvider('test');
      registry.register(provider);

      expect(() => registry.get('wrong')).toThrow(/Available providers: test/);
    });
  });

  describe('getDefault()', () => {
    it('should return default provider', () => {
      const provider = new MockProvider('test');
      registry.register(provider);

      const defaultProvider = registry.getDefault();

      expect(defaultProvider).toBe(provider);
    });

    it('should throw when no providers registered', () => {
      expect(() => registry.getDefault()).toThrow(
        /No providers registered/
      );
    });
  });

  describe('setDefault()', () => {
    it('should set default provider', () => {
      const provider1 = new MockProvider('first');
      const provider2 = new MockProvider('second');

      registry.register(provider1);
      registry.register(provider2);

      registry.setDefault('second');

      expect(registry.getDefaultName()).toBe('second');
      expect(registry.getDefault()).toBe(provider2);
    });

    it('should throw when setting unregistered provider as default', () => {
      expect(() => registry.setDefault('nonexistent')).toThrow(
        /Cannot set default to unregistered provider/
      );
    });
  });

  describe('list()', () => {
    it('should return empty array when no providers', () => {
      const providers = registry.list();

      expect(providers).toEqual([]);
    });

    it('should return all registered provider names', () => {
      registry.register(new MockProvider('provider1'));
      registry.register(new MockProvider('provider2'));

      const providers = registry.list();

      expect(providers).toContain('provider1');
      expect(providers).toContain('provider2');
      expect(providers).toHaveLength(2);
    });
  });

  describe('has()', () => {
    it('should return true for registered provider', () => {
      const provider = new MockProvider('test');
      registry.register(provider);

      expect(registry.has('test')).toBe(true);
    });

    it('should return false for unregistered provider', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('count()', () => {
    it('should return zero when no providers', () => {
      expect(registry.count()).toBe(0);
    });

    it('should return correct count', () => {
      registry.register(new MockProvider('provider1'));
      registry.register(new MockProvider('provider2'));

      expect(registry.count()).toBe(2);
    });
  });

  describe('healthCheck()', () => {
    it('should return true for available provider', async () => {
      const provider = new MockProvider('test');
      registry.register(provider);

      const result = await registry.healthCheck('test');

      expect(result).toBe(true);
    });

    it('should return false for unavailable provider', async () => {
      const provider = new UnavailableProvider('test');
      registry.register(provider);

      const result = await registry.healthCheck('test');

      expect(result).toBe(false);
    });

    it('should throw for unregistered provider', async () => {
      await expect(registry.healthCheck('nonexistent')).rejects.toThrow();
    });
  });

  describe('healthCheckAll()', () => {
    it('should return empty object when no providers', async () => {
      const result = await registry.healthCheckAll();

      expect(result).toEqual({});
    });

    it('should check all providers', async () => {
      registry.register(new MockProvider('available'));
      registry.register(new UnavailableProvider('unavailable'));

      const result = await registry.healthCheckAll();

      expect(result.available).toBe(true);
      expect(result.unavailable).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should remove all providers', () => {
      registry.register(new MockProvider('provider1'));
      registry.register(new MockProvider('provider2'));

      registry.clear();

      expect(registry.count()).toBe(0);
      expect(registry.list()).toEqual([]);
    });

    it('should reset default to claude', () => {
      registry.register(new MockProvider('test'));
      registry.setDefault('test');

      registry.clear();

      expect(registry.getDefaultName()).toBe('claude');
    });
  });
});
