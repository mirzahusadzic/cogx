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
  GEMINI_MODELS,
} from '../llm-config.js';

describe('LLM Configuration', () => {
  // Save original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.COGNITION_LLM_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.COGNITION_CLAUDE_MODEL;
    delete process.env.GEMINI_API_KEY;
    delete process.env.COGNITION_GEMINI_MODEL;
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
      expect(config.providers.gemini).toBeDefined();
    });

    it('should load provider from COGNITION_LLM_PROVIDER', () => {
      process.env.COGNITION_LLM_PROVIDER = 'gemini';

      const config = loadLLMConfig();

      expect(config.defaultProvider).toBe('gemini');
    });

    it('should load Claude API key from ANTHROPIC_API_KEY', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test123';

      const config = loadLLMConfig();

      expect(config.providers.claude?.apiKey).toBe('sk-ant-test123');
    });

    it('should load Gemini API key from GEMINI_API_KEY', () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';

      const config = loadLLMConfig();

      expect(config.providers.gemini?.apiKey).toBe('test-gemini-key');
    });

    it('should load Claude default model from COGNITION_CLAUDE_MODEL', () => {
      process.env.COGNITION_CLAUDE_MODEL = 'claude-3-opus-20240229';

      const config = loadLLMConfig();

      expect(config.providers.claude?.defaultModel).toBe(
        'claude-3-opus-20240229'
      );
    });

    it('should load Gemini default model from COGNITION_GEMINI_MODEL', () => {
      process.env.COGNITION_GEMINI_MODEL = 'gemini-2.0-flash-exp';

      const config = loadLLMConfig();

      expect(config.providers.gemini?.defaultModel).toBe(
        'gemini-2.0-flash-exp'
      );
    });

    it('should use default models when not specified', () => {
      const config = loadLLMConfig();

      expect(config.providers.claude?.defaultModel).toBe(CLAUDE_MODELS.latest);
      expect(config.providers.gemini?.defaultModel).toBe(GEMINI_MODELS.latest);
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

    it('should validate Gemini when set as default', () => {
      process.env.COGNITION_LLM_PROVIDER = 'gemini';
      const config = loadLLMConfig();

      const errors = validateLLMConfig(config);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('GEMINI_API_KEY');
    });
  });

  describe('isProviderConfigured()', () => {
    it('should return false when API key not set', () => {
      expect(isProviderConfigured('claude')).toBe(false);
      expect(isProviderConfigured('gemini')).toBe(false);
    });

    it('should return true when Claude API key is set', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

      expect(isProviderConfigured('claude')).toBe(true);
    });

    it('should return true when Gemini API key is set', () => {
      process.env.GEMINI_API_KEY = 'test-key';

      expect(isProviderConfigured('gemini')).toBe(true);
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

    it('should return only Gemini when only Gemini configured', () => {
      process.env.GEMINI_API_KEY = 'test-key';

      const providers = getConfiguredProviders();

      expect(providers).toEqual(['gemini']);
    });

    it('should return both when both configured', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.GEMINI_API_KEY = 'test-key';

      const providers = getConfiguredProviders();

      expect(providers).toContain('claude');
      expect(providers).toContain('gemini');
      expect(providers).toHaveLength(2);
    });
  });

  describe('getProviderApiKey()', () => {
    it('should return undefined when not configured', () => {
      expect(getProviderApiKey('claude')).toBeUndefined();
      expect(getProviderApiKey('gemini')).toBeUndefined();
    });

    it('should return API key when configured', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.GEMINI_API_KEY = 'test-key';

      expect(getProviderApiKey('claude')).toBe('sk-ant-test');
      expect(getProviderApiKey('gemini')).toBe('test-key');
    });
  });

  describe('getProviderDefaultModel()', () => {
    it('should return default model when not customized', () => {
      const claudeModel = getProviderDefaultModel('claude');
      const geminiModel = getProviderDefaultModel('gemini');

      expect(claudeModel).toBe(CLAUDE_MODELS.latest);
      expect(geminiModel).toBe(GEMINI_MODELS.latest);
    });

    it('should return custom model when configured', () => {
      process.env.COGNITION_CLAUDE_MODEL = 'claude-3-haiku-20240307';
      process.env.COGNITION_GEMINI_MODEL = 'gemini-2.0-flash-exp';

      expect(getProviderDefaultModel('claude')).toBe('claude-3-haiku-20240307');
      expect(getProviderDefaultModel('gemini')).toBe('gemini-2.0-flash-exp');
    });
  });

  describe('Model constants', () => {
    it('should have Claude model presets', () => {
      expect(CLAUDE_MODELS.latest).toBe('claude-sonnet-4-5-20250929');
      expect(CLAUDE_MODELS.balanced).toBe('claude-3-5-sonnet-20241022');
      expect(CLAUDE_MODELS.powerful).toBe('claude-3-opus-20240229');
      expect(CLAUDE_MODELS.fast).toBe('claude-3-haiku-20240307');
    });

    it('should have Gemini model presets', () => {
      expect(GEMINI_MODELS.latest).toBe('gemini-2.5-flash');
      expect(GEMINI_MODELS.balanced).toBe('gemini-2.0-flash');
      expect(GEMINI_MODELS.powerful).toBe('gemini-2.5-pro');
      expect(GEMINI_MODELS.thinking).toBe(
        'gemini-2.0-flash-thinking-exp-01-21'
      );
    });
  });
});
