/**
 * Google ADK Integration Tests
 *
 * Tests basic ADK functionality for Gemini agent support.
 */

import { describe, it, expect } from 'vitest';

describe('Google ADK', () => {
  describe('Package Import', () => {
    it('should import LlmAgent from @google/adk', async () => {
      const { LlmAgent } = await import('@google/adk');
      expect(LlmAgent).toBeDefined();
      expect(typeof LlmAgent).toBe('function');
    });

    it('should import FunctionTool from @google/adk', async () => {
      const { FunctionTool } = await import('@google/adk');
      expect(FunctionTool).toBeDefined();
    });

    it('should import Runner from @google/adk', async () => {
      const { Runner } = await import('@google/adk');
      expect(Runner).toBeDefined();
    });
  });

  describe('Agent Creation', () => {
    it('should create a basic LlmAgent', async () => {
      const { LlmAgent } = await import('@google/adk');

      const agent = new LlmAgent({
        name: 'test_agent',
        model: 'gemini-2.5-flash',
        instruction: 'You are a helpful assistant for testing.',
        tools: [],
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('test_agent');
    });
  });

  describe('Tool Creation', () => {
    it('should create a FunctionTool with zod schema', async () => {
      const { FunctionTool } = await import('@google/adk');
      const { z } = await import('zod');

      const readTool = new FunctionTool({
        name: 'read_file',
        description: 'Read contents of a file',
        parameters: z.object({
          file_path: z.string().describe('Path to the file'),
        }),
        execute: async (params) => {
          return { content: `Mock content of ${params.file_path}` };
        },
      });

      expect(readTool).toBeDefined();
      expect(readTool.name).toBe('read_file');
    });
  });
});

describe('GeminiAgentProvider', () => {
  it('should import GeminiAgentProvider', async () => {
    const { GeminiAgentProvider } = await import('../gemini-agent-provider.js');
    expect(GeminiAgentProvider).toBeDefined();
  });

  it('should support agent mode', async () => {
    const { GeminiAgentProvider } = await import('../gemini-agent-provider.js');

    // Mock API key for testing
    process.env.GEMINI_API_KEY = 'test-key';

    const provider = new GeminiAgentProvider();
    expect(provider.supportsAgentMode()).toBe(true);
  });

  it('should implement executeAgent method', async () => {
    const { GeminiAgentProvider } = await import('../gemini-agent-provider.js');

    process.env.GEMINI_API_KEY = 'test-key';

    const provider = new GeminiAgentProvider();
    expect(typeof provider.executeAgent).toBe('function');
  });
});
