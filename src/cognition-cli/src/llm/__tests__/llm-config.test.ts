/**
 * LLM Configuration Tests
 *
 * Unit tests for LLM configuration loading and validation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadLLMConfig,
  validateLLMConfig,
  isProviderConfigured,
  getConfiguredProviders,
  getProviderApiKey,
  getProviderDefaultModel,
  CLAUDE_MODELS,
  OPENAI_MODELS,
} from '../llm-config.js';

describe('LLM Configuration', () => {
  // Save original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.COGNITION_LLM_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.COGNITION_CLAUDE_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.COGNITION_OPENAI_MODEL;
  });

  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv };
  });

  describe('loadLLMConfig()', () => {
    it('should return default configuration when no env vars set', () => {
      const config = loadLLMConfig();

      expect(config.defaultProvider).toBe('claude');
      expect(config.providers.claude).toBeDefined();
      expect(config.providers.openai).toBeDefined();
    });

    it('should load provider from COGNITION_LLM_PROVIDER', () => {
      process.env.COGNITION_LLM_PROVIDER = 'openai';

      const config = loadLLMConfig();

      expect(config.defaultProvider).toBe('openai');
    });

    it('should load Claude API key from ANTHROPIC_API_KEY', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test123';

      const config = loadLLMConfig();

      expect(config.providers.claude?.apiKey).toBe('sk-ant-test123');
    });

    it('should load OpenAI API key from OPENAI_API_KEY', () => {
      process.env.OPENAI_API_KEY = 'sk-test456';

      const config = loadLLMConfig();

      expect(config.providers.openai?.apiKey).toBe('sk-test456');
    });

    it('should load Claude default model from COGNITION_CLAUDE_MODEL', () => {
      process.env.COGNITION_CLAUDE_MODEL = 'claude-3-opus-20240229';

      const config = loadLLMConfig();

      expect(config.providers.claude?.defaultModel).toBe(
        'claude-3-opus-20240229'
      );
    });

    it('should load OpenAI default model from COGNITION_OPENAI_MODEL', () => {
      process.env.COGNITION_OPENAI_MODEL = 'gpt-4';

      const config = loadLLMConfig();

      expect(config.providers.openai?.defaultModel).toBe('gpt-4');
    });

    it('should use default models when not specified', () => {
      const config = loadLLMConfig();

      expect(config.providers.claude?.defaultModel).toBe(CLAUDE_MODELS.latest);
      expect(config.providers.openai?.defaultModel).toBe(
        OPENAI_MODELS.balanced
      );
    });
  });

  describe('validateLLMConfig()', () => {
    it('should return empty errors for valid configuration', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      const config = loadLLMConfig();

      const errors = validateLLMConfig(config);

      expect(errors).toEqual([]);
    });

    it('should return error when default provider has no API key', () => {
      const config = loadLLMConfig();

      const errors = validateLLMConfig(config);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('API key');
    });

    it('should validate OpenAI when set as default', () => {
      process.env.COGNITION_LLM_PROVIDER = 'openai';
      const config = loadLLMConfig();

      const errors = validateLLMConfig(config);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('OPENAI_API_KEY');
    });
  });

  describe('isProviderConfigured()', () => {
    it('should return false when API key not set', () => {
      expect(isProviderConfigured('claude')).toBe(false);
      expect(isProviderConfigured('openai')).toBe(false);
    });

    it('should return true when Claude API key is set', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

      expect(isProviderConfigured('claude')).toBe(true);
    });

    it('should return true when OpenAI API key is set', () => {
      process.env.OPENAI_API_KEY = 'sk-test';

      expect(isProviderConfigured('openai')).toBe(true);
    });
  });

  describe('getConfiguredProviders()', () => {
    it('should return empty array when no providers configured', () => {
      const providers = getConfiguredProviders();

      expect(providers).toEqual([]);
    });

    it('should return only Claude when only Claude configured', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

      const providers = getConfiguredProviders();

      expect(providers).toEqual(['claude']);
    });

    it('should return only OpenAI when only OpenAI configured', () => {
      process.env.OPENAI_API_KEY = 'sk-test';

      const providers = getConfiguredProviders();

      expect(providers).toEqual(['openai']);
    });

    it('should return both when both configured', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.OPENAI_API_KEY = 'sk-test';

      const providers = getConfiguredProviders();

      expect(providers).toContain('claude');
      expect(providers).toContain('openai');
      expect(providers).toHaveLength(2);
    });
  });

  describe('getProviderApiKey()', () => {
    it('should return undefined when not configured', () => {
      expect(getProviderApiKey('claude')).toBeUndefined();
      expect(getProviderApiKey('openai')).toBeUndefined();
    });

    it('should return API key when configured', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.OPENAI_API_KEY = 'sk-test';

      expect(getProviderApiKey('claude')).toBe('sk-ant-test');
      expect(getProviderApiKey('openai')).toBe('sk-test');
    });
  });

  describe('getProviderDefaultModel()', () => {
    it('should return default model when not customized', () => {
      const claudeModel = getProviderDefaultModel('claude');
      const openaiModel = getProviderDefaultModel('openai');

      expect(claudeModel).toBe(CLAUDE_MODELS.latest);
      expect(openaiModel).toBe(OPENAI_MODELS.balanced);
    });

    it('should return custom model when configured', () => {
      process.env.COGNITION_CLAUDE_MODEL = 'claude-3-haiku-20240307';
      process.env.COGNITION_OPENAI_MODEL = 'gpt-3.5-turbo';

      expect(getProviderDefaultModel('claude')).toBe('claude-3-haiku-20240307');
      expect(getProviderDefaultModel('openai')).toBe('gpt-3.5-turbo');
    });
  });

  describe('Model constants', () => {
    it('should have Claude model presets', () => {
      expect(CLAUDE_MODELS.latest).toBe('claude-sonnet-4-5-20250929');
      expect(CLAUDE_MODELS.balanced).toBe('claude-3-5-sonnet-20241022');
      expect(CLAUDE_MODELS.powerful).toBe('claude-3-opus-20240229');
      expect(CLAUDE_MODELS.fast).toBe('claude-3-haiku-20240307');
    });

    it('should have OpenAI model presets', () => {
      expect(OPENAI_MODELS.latest).toBe('gpt-4o');
      expect(OPENAI_MODELS.balanced).toBe('gpt-4-turbo');
      expect(OPENAI_MODELS.powerful).toBe('gpt-4');
      expect(OPENAI_MODELS.fast).toBe('gpt-3.5-turbo');
    });
  });
});
