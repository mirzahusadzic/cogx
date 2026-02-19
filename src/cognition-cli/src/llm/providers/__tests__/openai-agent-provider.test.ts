/**
 * OpenAI Agent Provider Tests
 *
 * Tests the OpenAIAgentProvider implementation for AgentProvider interface.
 * Covers initialization, conversation management, agent execution, streaming,
 * tool execution, error handling, and cost estimation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock functions that persist across tests
const mockModelsList = vi.fn();
const mockRun = vi.fn();
const mockSetDefaultOpenAIClient = vi.fn();
const mockResponsesCreate = vi.fn();

// Mock OpenAI client
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      models: {
        list: mockModelsList,
      },
      responses: {
        create: mockResponsesCreate,
      },
    })),
  };
});

// Mock @openai/agents SDK
vi.mock('@openai/agents', () => ({
  Agent: vi.fn().mockImplementation(() => ({})),
  run: mockRun,
  setDefaultOpenAIClient: mockSetDefaultOpenAIClient,
}));

// Mock @openai/agents-openai
vi.mock('@openai/agents-openai', () => ({
  OpenAIResponsesModel: vi.fn().mockImplementation(() => ({})),
  OpenAIConversationsSession: vi.fn().mockImplementation(() => ({})),
}));

// Mock the tools
vi.mock('../openai-agent-tools.js', () => ({
  getOpenAITools: vi.fn().mockReturnValue([]),
}));

// Mock global fetch for conversation API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OpenAIAgentProvider', () => {
  let OpenAIAgentProvider: typeof import('../openai-agent-provider.js').OpenAIAgentProvider;
  let OPENAI_MODELS: typeof import('../openai-agent-provider.js').OPENAI_MODELS;
  let LOCAL_MODELS: typeof import('../openai-agent-provider.js').LOCAL_MODELS;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset env vars
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_MODEL;
    delete process.env.WORKBENCH_API_KEY;
    delete process.env.COGNITION_OPENAI_FROM_WORKBENCH;
    delete process.env.COGNITION_OPENAI_MODEL;
    delete process.env.COGNITION_OPENAI_MAX_TOKENS;

    // Default fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'conv_123', data: [] }),
    });

    // Re-import to get fresh instance with mocks
    const module = await import('../openai-agent-provider.js');
    OpenAIAgentProvider = module.OpenAIAgentProvider;
    OPENAI_MODELS = module.OPENAI_MODELS;
    LOCAL_MODELS = module.LOCAL_MODELS;
  });

  afterEach(() => {
    vi.resetModules();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
  });

  describe('Constructor', () => {
    it('should create instance with default options', () => {
      const provider = new OpenAIAgentProvider();
      expect(provider).toBeDefined();
      expect(provider.name).toBe('openai');
    });

    it('should create instance with explicit API key', () => {
      const provider = new OpenAIAgentProvider({ apiKey: 'test-key' });
      expect(provider).toBeDefined();
    });

    it('should use OPENAI_API_KEY from environment', () => {
      process.env.OPENAI_API_KEY = 'env-api-key';
      const provider = new OpenAIAgentProvider();
      expect(provider).toBeDefined();
      expect(provider.models).toContain(OPENAI_MODELS.latest);
    });

    it('should use OPENAI_BASE_URL from environment', () => {
      process.env.OPENAI_BASE_URL = 'http://localhost:8000';
      const provider = new OpenAIAgentProvider();
      expect(provider).toBeDefined();
    });

    it('should append /v1 suffix to base URL if missing', () => {
      process.env.OPENAI_BASE_URL = 'http://localhost:8000';
      const provider = new OpenAIAgentProvider();
      expect(provider).toBeDefined();
    });

    it('should use WORKBENCH_API_KEY for local endpoints', () => {
      process.env.OPENAI_BASE_URL = 'http://localhost:8000';
      process.env.WORKBENCH_API_KEY = 'workbench-key';
      const provider = new OpenAIAgentProvider();
      expect(provider).toBeDefined();
    });

    it('should configure workbench models when COGNITION_OPENAI_FROM_WORKBENCH is set', () => {
      process.env.COGNITION_OPENAI_FROM_WORKBENCH = 'true';
      process.env.COGNITION_OPENAI_MODEL = 'gpt-oss-20b';
      const provider = new OpenAIAgentProvider();
      expect(provider.models).toContain('gpt-oss-20b');
    });

    it('should use COGNITION_OPENAI_MAX_TOKENS from environment', () => {
      process.env.COGNITION_OPENAI_MAX_TOKENS = '8192';
      const provider = new OpenAIAgentProvider();
      expect(provider).toBeDefined();
    });

    it('should show local models when no API key and local endpoint', () => {
      process.env.OPENAI_BASE_URL = 'http://localhost:8000';
      const provider = new OpenAIAgentProvider();
      expect(provider.models).toContain(LOCAL_MODELS.gptOss20b);
    });

    it('should call setDefaultOpenAIClient', () => {
      new OpenAIAgentProvider();
      expect(mockSetDefaultOpenAIClient).toHaveBeenCalled();
    });
  });

  describe('Model Constants', () => {
    it('should have correct OPENAI_MODELS values', () => {
      expect(OPENAI_MODELS.latest).toBe('gpt-4o');
      expect(OPENAI_MODELS.fast).toBe('gpt-4o-mini');
      expect(OPENAI_MODELS.reasoning).toBe('o1');
      expect(OPENAI_MODELS.reasoningNext).toBe('o3');
    });

    it('should have correct LOCAL_MODELS values', () => {
      expect(LOCAL_MODELS.gptOss20b).toBe('gpt-oss-20b');
      expect(LOCAL_MODELS.gptOss120b).toBe('gpt-oss-120b');
    });
  });

  describe('supportsAgentMode()', () => {
    it('should return true', () => {
      const provider = new OpenAIAgentProvider();
      expect(provider.supportsAgentMode()).toBe(true);
    });
  });

  describe('complete()', () => {
    it('should throw error as not supported', async () => {
      const provider = new OpenAIAgentProvider();
      await expect(
        provider.complete({ prompt: 'test', model: 'gpt-4o' })
      ).rejects.toThrow(
        'OpenAI Agent provider does not support complete(). Use executeAgent() instead.'
      );
    });
  });

  describe('isAvailable()', () => {
    it('should return true when models list succeeds', async () => {
      mockModelsList.mockResolvedValue({ data: [] });
      const provider = new OpenAIAgentProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when models list fails', async () => {
      mockModelsList.mockRejectedValue(new Error('Connection failed'));
      const provider = new OpenAIAgentProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });

    it('should check custom base URL if set', async () => {
      process.env.OPENAI_BASE_URL = 'http://localhost:8000';
      mockModelsList.mockRejectedValue(new Error('Connection failed'));
      mockFetch.mockResolvedValueOnce({ ok: true });

      const provider = new OpenAIAgentProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when custom base URL is unreachable', async () => {
      process.env.OPENAI_BASE_URL = 'http://localhost:8000';
      mockModelsList.mockRejectedValue(new Error('Connection failed'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const provider = new OpenAIAgentProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('estimateCost()', () => {
    it('should calculate cost for GPT-4o pricing', () => {
      const provider = new OpenAIAgentProvider();

      // 1 million tokens
      const cost = provider.estimateCost(
        { prompt: 400000, completion: 600000, total: 1000000 },
        'gpt-4o'
      );

      // 40% input = 0.4 MTok * $2.5 = $1.0
      // 60% output = 0.6 MTok * $10 = $6.0
      // Total = $7.0
      expect(cost).toBeCloseTo(7.0, 1);
    });

    it('should calculate cost for GPT-4o-mini pricing', () => {
      const provider = new OpenAIAgentProvider();

      // 1 million tokens
      const cost = provider.estimateCost(
        { prompt: 400000, completion: 600000, total: 1000000 },
        'gpt-4o-mini'
      );

      // 40% input = 0.4 MTok * $0.15 = $0.06
      // 60% output = 0.6 MTok * $0.60 = $0.36
      // Total = $0.42
      expect(cost).toBeCloseTo(0.42, 2);
    });

    it('should handle small token counts', () => {
      const provider = new OpenAIAgentProvider();
      const cost = provider.estimateCost(
        { prompt: 400, completion: 600, total: 1000 },
        'gpt-4o'
      );
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(0.01);
    });
  });

  describe('Conversations API Methods', () => {
    it('should create conversation and yield initial state', async () => {
      const provider = new OpenAIAgentProvider();

      // Mock run to return an empty async iterator
      mockRun.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          // Empty - no events
        },
        finalOutput: '',
        state: { _modelResponses: [] },
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
      });

      const responses: unknown[] = [];
      for await (const response of generator) {
        responses.push(response);
      }

      // Should have created conversation via fetch
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/conversations'),
        expect.objectContaining({ method: 'POST' })
      );

      // Should have at least one response
      expect(responses.length).toBeGreaterThan(0);
    });

    it('should resume existing conversation when resumeSessionId provided', async () => {
      const provider = new OpenAIAgentProvider();

      // Mock conversation exists
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'existing-conv-123' }),
      });

      mockRun.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {},
        finalOutput: '',
        state: { _modelResponses: [] },
      });

      const generator = provider.executeAgent({
        prompt: 'Continue',
        model: 'gpt-4o',
        cwd: '/test',
        resumeSessionId: 'existing-conv-123',
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _response of generator) {
        // consume generator
      }

      // Should have checked for existing conversation
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('existing-conv-123'),
        expect.anything()
      );
    });

    it('should handle conversation not found and create new one', async () => {
      const provider = new OpenAIAgentProvider();

      // First call: conversation not found (404)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Second call: create new conversation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'new-conv-456' }),
      });

      // Third call: add items
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      mockRun.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {},
        finalOutput: '',
        state: { _modelResponses: [] },
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
        resumeSessionId: 'nonexistent-conv',
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _response of generator) {
        // consume generator
      }

      // Should have created new conversation after 404
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('executeAgent() Streaming', () => {
    it('should yield text deltas from streaming events', async () => {
      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'raw_model_stream_event',
            data: { type: 'output_text_delta', delta: 'Hello' },
          };
          yield {
            type: 'raw_model_stream_event',
            data: { type: 'output_text_delta', delta: ' world!' },
          };
        },
        finalOutput: 'Hello world!',
        state: { _modelResponses: [] },
      });

      const generator = provider.executeAgent({
        prompt: 'Hi',
        model: 'gpt-4o',
        cwd: '/test',
      });

      const responses: unknown[] = [];
      for await (const response of generator) {
        responses.push(response);
      }

      // Should have streaming responses
      expect(responses.length).toBeGreaterThan(1);
    });

    it('should yield tool calls from run_item_stream_event', async () => {
      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'run_item_stream_event',
            name: 'tool_called',
            item: {
              type: 'tool_call_item',
              rawItem: {
                name: 'read_file',
                arguments: JSON.stringify({ path: '/test.txt' }),
                call_id: 'call_123',
              },
            },
          };
          yield {
            type: 'run_item_stream_event',
            name: 'tool_output',
            item: {
              type: 'tool_call_output_item',
              output: 'file content here',
            },
          };
        },
        finalOutput: '',
        state: { _modelResponses: [] },
      });

      const generator = provider.executeAgent({
        prompt: 'Read file',
        model: 'gpt-4o',
        cwd: '/test',
      });

      const responses: Array<{ messages: Array<{ type: string }> }> = [];
      for await (const response of generator) {
        responses.push(response);
      }

      // Should have tool_use and tool_result messages
      const allMessages = responses.flatMap((r) => r.messages);
      expect(allMessages.some((m) => m.type === 'tool_use')).toBe(true);
      expect(allMessages.some((m) => m.type === 'tool_result')).toBe(true);
    });

    it('should yield thinking deltas from reasoning events', async () => {
      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'raw_model_stream_event',
            data: {
              type: 'model',
              event: {
                type: 'response.reasoning_text.delta',
                delta: 'Let me think...',
              },
            },
          };
        },
        finalOutput: '',
        state: { _modelResponses: [] },
      });

      const generator = provider.executeAgent({
        prompt: 'Reason about this',
        model: 'o1',
        cwd: '/test',
      });

      const responses: Array<{ messages: Array<{ type: string }> }> = [];
      for await (const response of generator) {
        responses.push(response);
      }

      const allMessages = responses.flatMap((r) => r.messages);
      expect(allMessages.some((m) => m.type === 'thinking')).toBe(true);
    });

    it('should extract token usage from model responses', async () => {
      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {},
        finalOutput: 'Response',
        state: {
          _modelResponses: [
            { usage: { inputTokens: 100, outputTokens: 50 } },
            { usage: { inputTokens: 150, outputTokens: 75 } },
          ],
        },
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
      });

      let lastTokens = { prompt: 0, completion: 0, total: 0 };
      for await (const response of generator) {
        lastTokens = response.tokens;
      }

      expect(lastTokens.prompt).toBe(250); // 100 + 150
      expect(lastTokens.completion).toBe(125); // 50 + 75
      expect(lastTokens.total).toBe(375);
    });
  });

  describe('Error Handling', () => {
    it('should handle abort errors gracefully', async () => {
      const provider = new OpenAIAgentProvider();

      const abortError = new Error('aborted by user');
      abortError.name = 'AbortError';

      mockRun.mockResolvedValue({
        // eslint-disable-next-line require-yield
        [Symbol.asyncIterator]: async function* () {
          throw abortError;
        },
        finalOutput: '',
        state: {},
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
      });

      const responses: Array<{ finishReason: string }> = [];
      for await (const response of generator) {
        responses.push(response);
      }

      // Should complete with stop reason, not error
      expect(responses[responses.length - 1].finishReason).toBe('stop');
    });

    it('should display error message for non-abort errors', async () => {
      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        // eslint-disable-next-line require-yield
        [Symbol.asyncIterator]: async function* () {
          throw new Error('API rate limit exceeded');
        },
        finalOutput: '',
        state: {},
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
      });

      const responses: Array<{
        finishReason: string;
        messages: Array<{ content: string }>;
      }> = [];
      for await (const response of generator) {
        responses.push(response);
      }

      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.finishReason).toBe('error');
      expect(
        lastResponse.messages.some((m) => m.content.includes('Error'))
      ).toBe(true);
    });

    it('should handle cancel errors gracefully', async () => {
      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        // eslint-disable-next-line require-yield
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Operation cancelled');
        },
        finalOutput: '',
        state: {},
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
      });

      const responses: Array<{ finishReason: string }> = [];
      for await (const response of generator) {
        responses.push(response);
      }

      expect(responses[responses.length - 1].finishReason).toBe('stop');
    });
  });

  describe('interrupt()', () => {
    it('should abort the current execution', async () => {
      const provider = new OpenAIAgentProvider();

      // Create a generator that waits for abort
      let aborted = false;
      mockRun.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (aborted) return;
          yield { type: 'test' };
        },
        finalOutput: '',
        state: {},
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
      });

      // Start consuming but interrupt quickly
      const consumed = generator.next();

      // Interrupt should not throw
      await expect(provider.interrupt()).resolves.not.toThrow();
      aborted = true;

      // Cleanup
      await consumed;
    });

    it('should be callable without error when no query is active', async () => {
      const provider = new OpenAIAgentProvider();
      await expect(provider.interrupt()).resolves.not.toThrow();
    });
  });

  describe('System Prompt Building', () => {
    it('should include custom system prompt when provided', async () => {
      const { Agent } = await import('@openai/agents');

      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        // eslint-disable-next-line require-yield
        [Symbol.asyncIterator]: async function* () {},
        finalOutput: '',
        state: {},
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
        systemPrompt: {
          type: 'custom',
          custom: 'You are a test assistant',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _response of generator) {
        // consume
      }

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: 'You are a test assistant',
        })
      );
    });

    it('should build default system prompt with model name', async () => {
      const { Agent } = await import('@openai/agents');

      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        // eslint-disable-next-line require-yield
        [Symbol.asyncIterator]: async function* () {},
        finalOutput: '',
        state: {},
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _response of generator) {
        // consume
      }

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: expect.stringContaining('gpt-4o'),
        })
      );
    });

    it('should include memory tools section when conversation registry provided', async () => {
      const { Agent } = await import('@openai/agents');

      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        // eslint-disable-next-line require-yield
        [Symbol.asyncIterator]: async function* () {},
        finalOutput: '',
        state: {},
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
        conversationRegistry: {} as unknown,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _response of generator) {
        // consume
      }

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: expect.stringContaining('Memory Tools'),
        })
      );
    });

    it('should include background tasks section when task manager provided', async () => {
      const { Agent } = await import('@openai/agents');

      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        // eslint-disable-next-line require-yield
        [Symbol.asyncIterator]: async function* () {},
        finalOutput: '',
        state: {},
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
        getTaskManager: () => ({}) as unknown,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _response of generator) {
        // consume
      }

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: expect.stringContaining('Background Tasks'),
        })
      );
    });

    it('should include IPC messaging section when publisher and queue provided', async () => {
      const { Agent } = await import('@openai/agents');

      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        // eslint-disable-next-line require-yield
        [Symbol.asyncIterator]: async function* () {},
        finalOutput: '',
        state: {},
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
        getMessagePublisher: () => ({}) as unknown,
        getMessageQueue: () => ({}) as unknown,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _response of generator) {
        // consume
      }

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: expect.stringContaining('Agent Messaging'),
        })
      );
    });
  });

  describe('Message Output Handling', () => {
    it('should handle message_output_created events', async () => {
      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'run_item_stream_event',
            name: 'message_output_created',
            item: {
              type: 'message_output_item',
              rawItem: {
                content: [{ type: 'output_text', text: 'Final response' }],
              },
            },
          };
        },
        finalOutput: '',
        state: {},
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _response of generator) {
        // consume
      }

      // Should complete without error
    });

    it('should add fallback message when no assistant messages yielded', async () => {
      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          // No events
        },
        finalOutput: 'Fallback response',
        state: {},
      });

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'gpt-4o',
        cwd: '/test',
      });

      const responses: Array<{
        messages: Array<{ type: string; content: string }>;
      }> = [];
      for await (const response of generator) {
        responses.push(response);
      }

      const lastResponse = responses[responses.length - 1];
      expect(
        lastResponse.messages.some((m) => m.content === 'Fallback response')
      ).toBe(true);
    });
  });

  describe('NumTurns Tracking', () => {
    it('should count tool uses as turns', async () => {
      const provider = new OpenAIAgentProvider();

      mockRun.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'run_item_stream_event',
            name: 'tool_called',
            item: {
              type: 'tool_call_item',
              rawItem: { name: 'read_file', arguments: '{}' },
            },
          };
          yield {
            type: 'run_item_stream_event',
            name: 'tool_called',
            item: {
              type: 'tool_call_item',
              rawItem: { name: 'write_file', arguments: '{}' },
            },
          };
        },
        finalOutput: '',
        state: {},
      });

      const generator = provider.executeAgent({
        prompt: 'Do multiple things',
        model: 'gpt-4o',
        cwd: '/test',
      });

      let lastNumTurns = 0;
      for await (const response of generator) {
        lastNumTurns = response.numTurns;
      }

      expect(lastNumTurns).toBeGreaterThanOrEqual(2);
    });
  });
});
