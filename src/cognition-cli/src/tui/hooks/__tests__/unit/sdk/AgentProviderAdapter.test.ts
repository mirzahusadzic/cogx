/**
 * Tests for AgentProviderAdapter
 *
 * Tests the adapter that bridges LLM providers with the TUI's useClaudeAgent hook.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable require-yield */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock provider
const mockProvider = {
  models: ['claude-3-opus', 'claude-3-sonnet'],
  executeAgent: vi.fn(),
  interrupt: vi.fn(),
};

// Mock registry
vi.mock('../../../../../llm/index.js', () => ({
  registry: {
    getAgent: vi.fn(() => mockProvider),
  },
}));

// Import after mocking
import { AgentProviderAdapter } from '../../../sdk/AgentProviderAdapter.js';

describe('AgentProviderAdapter', () => {
  const defaultOptions = {
    cwd: '/test/project',
    provider: 'claude',
    model: 'claude-3-opus',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider.executeAgent.mockImplementation(async function* () {
      yield {
        messages: [{ type: 'assistant', content: 'Hello!' }],
        sessionId: 'session-123',
        tokens: { total: 100, input: 50, output: 50 },
      };
    });
    mockProvider.interrupt.mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('should create adapter with default provider', () => {
      const adapter = new AgentProviderAdapter({ cwd: '/test' });

      expect(adapter.getProviderName()).toBe('claude');
    });

    it('should use specified provider', () => {
      const adapter = new AgentProviderAdapter({
        cwd: '/test',
        provider: 'openai',
      });

      expect(adapter.getProviderName()).toBe('openai');
    });

    it('should use specified model', () => {
      const adapter = new AgentProviderAdapter({
        cwd: '/test',
        model: 'claude-3-sonnet',
      });

      expect(adapter.getModel()).toBe('claude-3-sonnet');
    });

    it('should auto-select first model if not specified', () => {
      const adapter = new AgentProviderAdapter({ cwd: '/test' });

      expect(adapter.getModel()).toBe('claude-3-opus');
    });
  });

  describe('query', () => {
    it('should execute agent query', async () => {
      const adapter = new AgentProviderAdapter(defaultOptions);

      const responses: unknown[] = [];
      for await (const response of adapter.query('Hello, Claude!')) {
        responses.push(response);
      }

      expect(mockProvider.executeAgent).toHaveBeenCalled();
      expect(responses).toHaveLength(1);
    });

    it('should pass prompt to provider', async () => {
      const adapter = new AgentProviderAdapter(defaultOptions);

      for await (const _ of adapter.query('Test prompt')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test prompt',
        })
      );
    });

    it('should pass model to provider', async () => {
      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        model: 'claude-3-sonnet',
      });

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-sonnet',
        })
      );
    });

    it('should pass cwd to provider', async () => {
      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        cwd: '/custom/path',
      });

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: '/custom/path',
        })
      );
    });

    it('should pass resumeSessionId to provider', async () => {
      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        resumeSessionId: 'session-abc',
      });

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeSessionId: 'session-abc',
        })
      );
    });

    it('should pass maxThinkingTokens to provider', async () => {
      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        maxThinkingTokens: 10000,
      });

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          maxThinkingTokens: 10000,
        })
      );
    });

    it('should yield responses from provider', async () => {
      mockProvider.executeAgent.mockImplementation(async function* () {
        yield {
          messages: [{ type: 'assistant', content: 'First' }],
          sessionId: 'session-1',
          tokens: { total: 50 },
        };
        yield {
          messages: [
            { type: 'assistant', content: 'First' },
            { type: 'assistant', content: 'Second' },
          ],
          sessionId: 'session-1',
          tokens: { total: 100 },
        };
      });

      const adapter = new AgentProviderAdapter(defaultOptions);

      const responses: unknown[] = [];
      for await (const response of adapter.query('Test')) {
        responses.push(response);
      }

      expect(responses).toHaveLength(2);
    });

    it('should handle errors and call onStderr', async () => {
      const onStderr = vi.fn();
      mockProvider.executeAgent.mockImplementation(async function* () {
        throw new Error('Provider error');
      });

      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        onStderr,
      });

      await expect(async () => {
        for await (const _ of adapter.query('Test')) {
          // consume generator
        }
      }).rejects.toThrow('Provider error');

      expect(onStderr).toHaveBeenCalledWith('Provider error');
    });

    it('should include system prompt configuration', async () => {
      const adapter = new AgentProviderAdapter(defaultOptions);

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.objectContaining({
            type: 'preset',
            preset: 'claude_code',
          }),
        })
      );
    });

    it('should append SigmaTaskUpdate info for claude provider', async () => {
      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        provider: 'claude',
      });

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.objectContaining({
            append: expect.stringContaining('SigmaTaskUpdate'),
          }),
        })
      );
    });

    it('should include partial messages flag', async () => {
      const adapter = new AgentProviderAdapter(defaultOptions);

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          includePartialMessages: true,
        })
      );
    });
  });

  describe('interrupt', () => {
    it('should call provider interrupt', async () => {
      const adapter = new AgentProviderAdapter(defaultOptions);

      await adapter.interrupt();

      expect(mockProvider.interrupt).toHaveBeenCalled();
    });

    it('should handle providers without interrupt', async () => {
      const providerWithoutInterrupt = {
        ...mockProvider,
        interrupt: undefined,
      };

      const { registry } = await import('../../../../../llm/index.js');
      (registry.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(
        providerWithoutInterrupt
      );

      const adapter = new AgentProviderAdapter(defaultOptions);

      // Should not throw
      await adapter.interrupt();
    });
  });

  describe('getProviderName', () => {
    it('should return current provider name', () => {
      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        provider: 'openai',
      });

      expect(adapter.getProviderName()).toBe('openai');
    });
  });

  describe('getModel', () => {
    it('should return current model', () => {
      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        model: 'claude-3-sonnet',
      });

      expect(adapter.getModel()).toBe('claude-3-sonnet');
    });
  });

  describe('withProvider (static factory)', () => {
    it('should create adapter with specified provider', () => {
      const adapter = AgentProviderAdapter.withProvider('openai', {
        cwd: '/test',
        model: 'gpt-4',
      });

      expect(adapter.getProviderName()).toBe('openai');
    });

    it('should override provider option', () => {
      const adapter = AgentProviderAdapter.withProvider('gemini', {
        cwd: '/test',
        provider: 'claude', // This should be overridden
      });

      expect(adapter.getProviderName()).toBe('gemini');
    });
  });

  describe('options passing', () => {
    it('should pass onCanUseTool callback', async () => {
      const onCanUseTool = vi.fn().mockResolvedValue({ behavior: 'allow' });

      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        onCanUseTool,
      });

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          onCanUseTool,
        })
      );
    });

    it('should pass MCP servers', async () => {
      const mcpServers = { server1: { command: 'node', args: ['server.js'] } };

      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        mcpServers,
      });

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpServers,
        })
      );
    });

    it('should pass workbenchUrl', async () => {
      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        workbenchUrl: 'http://localhost:8000',
      });

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          workbenchUrl: 'http://localhost:8000',
        })
      );
    });

    it('should pass getTaskManager callback', async () => {
      const getTaskManager = vi.fn();

      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        getTaskManager,
      });

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          getTaskManager,
        })
      );
    });

    it('should pass agentId', async () => {
      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        agentId: 'agent-123',
      });

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-123',
        })
      );
    });

    it('should pass anchorId', async () => {
      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        anchorId: 'anchor-456',
      });

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          anchorId: 'anchor-456',
        })
      );
    });

    it('should use projectRoot or fall back to cwd', async () => {
      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        projectRoot: '/project/root',
      });

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          projectRoot: '/project/root',
        })
      );
    });

    it('should fall back to cwd when projectRoot not provided', async () => {
      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        cwd: '/fallback/cwd',
      });

      for await (const _ of adapter.query('Test')) {
        // consume generator
      }

      expect(mockProvider.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          projectRoot: '/fallback/cwd',
        })
      );
    });
  });

  describe('debug mode', () => {
    it('should log query info when debug is true', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        debug: true,
      });

      for await (const _ of adapter.query('Test prompt')) {
        // consume generator
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AgentAdapter]'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should log errors when debug is true', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockProvider.executeAgent.mockImplementation(async function* () {
        throw new Error('Test error');
      });

      const adapter = new AgentProviderAdapter({
        ...defaultOptions,
        debug: true,
      });

      try {
        for await (const _ of adapter.query('Test')) {
          // consume generator
        }
      } catch {
        // Expected error
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AgentAdapter]'),
        'Test error'
      );

      consoleSpy.mockRestore();
    });
  });
});
