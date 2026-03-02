import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import type { AgentResponse } from '../../../core/interfaces/agent-provider.js';
import type { StreamChunk } from '../../../core/interfaces/provider.js';

// Use vi.hoisted for variables that need to be accessed in vi.mock factories
const { sdkControl } = vi.hoisted(() => ({
  sdkControl: { failLoad: false },
}));

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

// Mock the Claude Agent SDK - dynamically imported
vi.mock(
  '@anthropic-ai/claude-agent-sdk',
  () => {
    if (sdkControl.failLoad) {
      throw new Error('Claude Agent SDK is not installed');
    }
    const mockQuery = vi.fn();
    return {
      query: mockQuery,
    };
  },
  { virtual: true }
);

// Import after mocks
import { ClaudeProvider } from '../agent-provider.js';
// @ts-expect-error - Virtual mock for dynamic import
import { query } from '@anthropic-ai/claude-agent-sdk';

describe('ClaudeProvider', () => {
  // Use dangerouslyAllowBrowser to avoid Anthropic SDK browser check if it's not fully mocked
  const mockMessagesCreate = vi.mocked(
    new Anthropic({ apiKey: 'k', dangerouslyAllowBrowser: true }).messages
      .create
  );
  const mockAgentSdkQuery = vi.mocked(query);

  beforeEach(async () => {
    vi.clearAllMocks();
    sdkControl.failLoad = false;

    // Default mock for agent SDK query
    mockAgentSdkQuery.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: 'result',
          subtype: 'success',
          usage: { input_tokens: 0, output_tokens: 0 },
        };
      },
    });
  });

  describe('Constructor', () => {
    it('should create instance with API key', () => {
      const provider = new ClaudeProvider('test-api-key');
      expect(provider).toBeDefined();
      expect(provider.name).toBe('claude');
    });
  });

  describe('LLMProvider Interface', () => {
    describe('complete()', () => {
      it('should generate a basic completion', async () => {
        const provider = new ClaudeProvider('test-key');

        mockMessagesCreate.mockResolvedValue({
          content: [{ type: 'text', text: 'Hello!' }],
          model: 'claude-sonnet-4-5-20250929',
          usage: { input_tokens: 10, output_tokens: 20 },
          stop_reason: 'end_turn',
        });

        const response = await provider.complete({
          prompt: 'Hello!',
          model: 'claude-sonnet-4-5-20250929',
        });

        expect(response.text).toBe('Hello!');
        expect(response.tokens.total).toBe(30);
        expect(response.finishReason).toBe('stop');
      });

      it('should handle multiple text blocks', async () => {
        const provider = new ClaudeProvider('test-key');

        mockMessagesCreate.mockResolvedValue({
          content: [
            { type: 'text', text: 'Part 1.' },
            { type: 'text', text: 'Part 2.' },
          ],
          model: 'claude-sonnet-4-5-20250929',
          usage: { input_tokens: 5, output_tokens: 5 },
          stop_reason: 'end_turn',
        });

        const response = await provider.complete({
          prompt: 'Test',
          model: 'claude-sonnet-4-5-20250929',
        });

        expect(response.text).toBe('Part 1.\nPart 2.');
      });

      it('should throw on API error', async () => {
        const provider = new ClaudeProvider('test-key');
        mockMessagesCreate.mockRejectedValue(new Error('API Error'));

        await expect(
          provider.complete({
            prompt: 'Test',
            model: 'claude-sonnet-4-5-20250929',
          })
        ).rejects.toThrow('Claude completion failed: API Error');
      });
    });

    describe('stream()', () => {
      it('should stream text deltas', async () => {
        const provider = new ClaudeProvider('test-key');

        mockMessagesCreate.mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'message_start',
              message: { usage: { input_tokens: 5 } },
            };
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Hello' },
            };
            yield { type: 'message_delta', usage: { output_tokens: 10 } };
            yield { type: 'message_stop' };
          },
        });

        const chunks: StreamChunk[] = [];
        for await (const chunk of provider.stream({
          prompt: 'Hi',
          model: 'claude-sonnet-4-5-20250929',
        })) {
          chunks.push(chunk);
        }

        const text = chunks
          .filter((c) => !c.done)
          .map((c) => c.delta)
          .join('');
        expect(text).toBe('Hello');
        expect(chunks.find((c) => c.done)?.tokens.total).toBe(15);
      });
    });
  });

  describe('AgentProvider Interface', () => {
    it('should return true for supportsAgentMode after loading', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();
      expect(provider.supportsAgentMode()).toBe(true);
    });

    it('should return false for supportsAgentMode if SDK fails to load', async () => {
      // Mock the private initAgentSdk method to simulate failure
      const spy = vi
        .spyOn(
          ClaudeProvider.prototype as unknown as {
            initAgentSdk: () => Promise<void>;
          },
          'initAgentSdk'
        )
        .mockImplementation(async function (this: unknown) {
          const self = this as {
            claudeAgentSdk: unknown;
            agentSdkLoadingPromise: Promise<void>;
          };
          self.claudeAgentSdk = undefined;
          self.agentSdkLoadingPromise = Promise.resolve();
        });

      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();
      expect(provider.supportsAgentMode()).toBe(false);

      spy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should yield error response for authentication failure', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      mockAgentSdkQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'result',
            subtype: 'error',
            error: 'authentication_error: invalid',
          };
        },
      }));

      const generator = provider.executeAgent({ prompt: 'Hi', model: 'm' });
      await generator.next(); // Skip initial snapshot
      const result = await generator.next();

      expect(result.value?.finishReason).toBe('error');
      expect(
        result.value?.messages[result.value.messages.length - 1].content
      ).toContain('Authentication failed');
    });

    it('should handle abort gracefully', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      mockAgentSdkQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          // eslint-disable-next-line no-constant-condition
          if (false) yield {}; // Satisfy require-yield
          const err = new Error('aborted');
          err.name = 'AbortError';
          throw err;
        },
      }));

      const generator = provider.executeAgent({ prompt: 'Hi', model: 'm' });
      await generator.next(); // Skip initial snapshot
      const result = await generator.next();

      expect(result.value?.finishReason).toBe('stop');
    });
  });

  describe('Message Conversion', () => {
    it('should handle thinking blocks', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      mockAgentSdkQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [{ type: 'thinking', thinking: 'Thought' }],
            },
          };
        },
      }));

      const generator = provider.executeAgent({ prompt: 'Hi', model: 'm' });
      const responses: AgentResponse[] = [];
      for await (const r of generator) responses.push(r);

      const thinking = responses.find((r) =>
        r.messages.some((m) => m.type === 'thinking')
      );
      expect(thinking).toBeDefined();
      expect(
        thinking?.messages.find((m) => m.type === 'thinking')?.thinking
      ).toBe('Thought');
    });

    it('should handle content_block_delta from stream_event', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      mockAgentSdkQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'stream_event',
            event: {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Hello!' },
            },
          };
        },
      }));

      const generator = provider.executeAgent({ prompt: 'Hi', model: 'm' });
      const responses: AgentResponse[] = [];
      for await (const r of generator) responses.push(r);

      const assistant = responses.find((r) =>
        r.messages.some((m) => m.role === 'assistant')
      );
      expect(assistant).toBeDefined();
    });

    it('should handle tool_progress', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      mockAgentSdkQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'tool_progress', tool_name: 'test_tool' };
        },
      }));

      const generator = provider.executeAgent({ prompt: 'Hi', model: 'm' });
      const responses: AgentResponse[] = [];
      for await (const r of generator) responses.push(r);

      const toolUse = responses.find((r) =>
        r.messages.some((m) => m.type === 'tool_use')
      );
      expect(toolUse).toBeDefined();
      expect(
        toolUse?.messages.find((m) => m.type === 'tool_use')?.toolName
      ).toBe('test_tool');
    });

    it('should extract session ID', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      mockAgentSdkQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'system', session_id: 'session-123' };
        },
      }));

      const generator = provider.executeAgent({ prompt: 'Hi', model: 'm' });
      let finalResponse: AgentResponse | undefined;
      for await (const r of generator) finalResponse = r;

      expect(finalResponse?.sessionId).toBe('session-123');
    });
  });

  describe('Token Tracking', () => {
    it('should track cumulative tokens', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      mockAgentSdkQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'stream_event',
            event: {
              type: 'message_delta',
              usage: { input_tokens: 10, output_tokens: 5 },
            },
          };
          yield {
            type: 'result',
            subtype: 'success',
            usage: { input_tokens: 100, output_tokens: 50 },
          };
        },
      }));

      const generator = provider.executeAgent({ prompt: 'Hi', model: 'm' });
      let finalResponse: AgentResponse | undefined;
      for await (const r of generator) finalResponse = r;

      expect(finalResponse?.tokens.total).toBe(150);
    });

    it('should extract num_turns', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      mockAgentSdkQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'result', subtype: 'success', num_turns: 5 };
        },
      }));

      const generator = provider.executeAgent({ prompt: 'Hi', model: 'm' });
      let finalResponse: AgentResponse | undefined;
      for await (const r of generator) finalResponse = r;

      expect(finalResponse?.numTurns).toBe(5);
    });
  });
});
