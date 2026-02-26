/**
 * Claude Agent Provider Tests
 *
 * Tests the ClaudeProvider implementation for both LLMProvider and AgentProvider interfaces.
 * Covers basic completions, streaming, agent workflows, interruption, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock functions that persist across tests
const mockCreate = vi.fn();

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

// Mock the Claude Agent SDK - dynamically imported
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('ClaudeProvider', () => {
  let ClaudeProvider: typeof import('../agent-provider.js').ClaudeProvider;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to get fresh instance with mocks
    vi.resetModules();
    const module = await import('../agent-provider.js');
    ClaudeProvider = module.ClaudeProvider;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Constructor', () => {
    it('should create instance with API key', () => {
      const provider = new ClaudeProvider('test-api-key');
      expect(provider).toBeDefined();
      expect(provider.name).toBe('claude');
    });

    it('should create instance without API key (uses env var)', () => {
      process.env.ANTHROPIC_API_KEY = 'env-api-key';
      const provider = new ClaudeProvider();
      expect(provider).toBeDefined();
    });

    it('should have correct model list', () => {
      const provider = new ClaudeProvider('test-key');
      expect(provider.models).toContain('claude-opus-4-5-20251101');
      expect(provider.models).toContain('claude-sonnet-4-5-20250929');
    });
  });

  describe('LLMProvider Interface', () => {
    describe('complete()', () => {
      it('should generate a basic completion', async () => {
        const provider = new ClaudeProvider('test-key');

        // Mock the response
        mockCreate.mockResolvedValue({
          content: [{ type: 'text', text: 'Hello! How can I help you?' }],
          model: 'claude-sonnet-4-5-20250929',
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
          stop_reason: 'end_turn',
        });

        const response = await provider.complete({
          prompt: 'Hello!',
          model: 'claude-sonnet-4-5-20250929',
        });

        expect(response.text).toBe('Hello! How can I help you?');
        expect(response.model).toBe('claude-sonnet-4-5-20250929');
        expect(response.tokens.prompt).toBe(10);
        expect(response.tokens.completion).toBe(20);
        expect(response.tokens.total).toBe(30);
        expect(response.finishReason).toBe('stop');
      });

      it('should pass optional parameters', async () => {
        const provider = new ClaudeProvider('test-key');

        mockCreate.mockResolvedValue({
          content: [{ type: 'text', text: 'Response' }],
          model: 'claude-sonnet-4-5-20250929',
          usage: { input_tokens: 5, output_tokens: 5 },
          stop_reason: 'end_turn',
        });

        await provider.complete({
          prompt: 'Test',
          model: 'claude-sonnet-4-5-20250929',
          maxTokens: 1000,
          temperature: 0.7,
          systemPrompt: 'You are a test assistant',
          stopSequences: ['END'],
        });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 1000,
            temperature: 0.7,
            system: 'You are a test assistant',
            stop_sequences: ['END'],
          })
        );
      });

      it('should handle multiple text blocks', async () => {
        const provider = new ClaudeProvider('test-key');

        mockCreate.mockResolvedValue({
          content: [
            { type: 'text', text: 'First part. ' },
            { type: 'text', text: 'Second part.' },
          ],
          model: 'claude-sonnet-4-5-20250929',
          usage: { input_tokens: 10, output_tokens: 20 },
          stop_reason: 'end_turn',
        });

        const response = await provider.complete({
          prompt: 'Hello!',
          model: 'claude-sonnet-4-5-20250929',
        });

        expect(response.text).toBe('First part. \nSecond part.');
      });

      it('should handle length finish reason', async () => {
        const provider = new ClaudeProvider('test-key');

        mockCreate.mockResolvedValue({
          content: [{ type: 'text', text: 'Truncated...' }],
          model: 'claude-sonnet-4-5-20250929',
          usage: { input_tokens: 10, output_tokens: 4096 },
          stop_reason: 'max_tokens',
        });

        const response = await provider.complete({
          prompt: 'Write a long story',
          model: 'claude-sonnet-4-5-20250929',
        });

        expect(response.finishReason).toBe('length');
      });

      it('should throw on API error', async () => {
        const provider = new ClaudeProvider('test-key');

        mockCreate.mockRejectedValue(new Error('API rate limit'));

        await expect(
          provider.complete({
            prompt: 'Hello',
            model: 'claude-sonnet-4-5-20250929',
          })
        ).rejects.toThrow('Claude completion failed: API rate limit');
      });
    });

    describe('stream()', () => {
      it('should stream text deltas', async () => {
        const provider = new ClaudeProvider('test-key');

        // Create async iterable mock
        const streamEvents = [
          { type: 'message_start', message: { usage: { input_tokens: 10 } } },
          {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello' },
          },
          {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: ' world!' },
          },
          { type: 'message_delta', usage: { output_tokens: 5 } },
          { type: 'message_stop' },
        ];

        mockCreate.mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            for (const event of streamEvents) {
              yield event;
            }
          },
        });

        const chunks: Array<{ delta: string; text: string; done: boolean }> =
          [];
        for await (const chunk of provider.stream({
          prompt: 'Hi',
          model: 'claude-sonnet-4-5-20250929',
        })) {
          chunks.push(chunk);
        }

        // Should have: 2 text deltas + 1 final
        expect(chunks.length).toBe(3);
        expect(chunks[0].delta).toBe('Hello');
        expect(chunks[0].text).toBe('Hello');
        expect(chunks[0].done).toBe(false);

        expect(chunks[1].delta).toBe(' world!');
        expect(chunks[1].text).toBe('Hello world!');
        expect(chunks[1].done).toBe(false);

        expect(chunks[2].done).toBe(true);
        expect(chunks[2].tokens?.total).toBe(15);
      });

      it('should throw on stream error', async () => {
        const provider = new ClaudeProvider('test-key');

        mockCreate.mockRejectedValue(new Error('Connection lost'));

        await expect(async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for await (const _chunk of provider.stream({
            prompt: 'Hi',
            model: 'claude-sonnet-4-5-20250929',
          })) {
            // consume stream
          }
        }).rejects.toThrow('Claude streaming failed: Connection lost');
      });
    });

    describe('isAvailable()', () => {
      it('should return true when Agent SDK is available', async () => {
        const provider = new ClaudeProvider('test-key');
        // Wait for SDK loading
        await provider.ensureAgentModeReady();
        const available = await provider.isAvailable();
        expect(available).toBe(true);
      });
    });

    describe('estimateCost()', () => {
      it('should calculate cost for Sonnet 4.5 pricing', () => {
        const provider = new ClaudeProvider('test-key');

        // 1 million tokens
        const cost = provider.estimateCost(
          { prompt: 400000, completion: 600000, total: 1000000 },
          'claude-sonnet-4-5-20250929'
        );

        // 40% input = 0.4 MTok * $3 = $1.2
        // 60% output = 0.6 MTok * $15 = $9
        // Total = $10.2
        expect(cost).toBeCloseTo(10.2, 1);
      });

      it('should handle small token counts', () => {
        const provider = new ClaudeProvider('test-key');
        const cost = provider.estimateCost(
          { prompt: 400, completion: 600, total: 1000 },
          'claude-sonnet-4-5-20250929'
        );
        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeLessThan(0.1);
      });
    });
  });

  describe('AgentProvider Interface', () => {
    describe('supportsAgentMode()', () => {
      it('should return true when SDK is loaded', async () => {
        const provider = new ClaudeProvider('test-key');
        await provider.ensureAgentModeReady();
        expect(provider.supportsAgentMode()).toBe(true);
      });
    });

    describe('ensureAgentModeReady()', () => {
      it('should return true when SDK loads successfully', async () => {
        const provider = new ClaudeProvider('test-key');
        const ready = await provider.ensureAgentModeReady();
        expect(ready).toBe(true);
      });
    });

    describe('executeAgent()', () => {
      it('should throw if SDK is not available', async () => {
        // Create a provider where SDK loading fails
        vi.doMock('@anthropic-ai/claude-agent-sdk', () => {
          throw new Error('Module not found');
        });

        vi.resetModules();
        const module = await import('../agent-provider.js');
        const provider = new module.ClaudeProvider('test-key');

        // Wait for SDK loading to complete (it should fail)
        await provider.ensureAgentModeReady();

        // This should throw because SDK is not available
        const generator = provider.executeAgent({
          prompt: 'Hello',
          model: 'claude-sonnet-4-5-20250929',
          cwd: '/test',
        });

        await expect(generator.next()).rejects.toThrow(
          'Claude Agent SDK is not installed'
        );

        // Reset the mock
        vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({
          query: vi.fn(),
        }));
      });
    });

    describe('interrupt()', () => {
      it('should be callable without error', async () => {
        const provider = new ClaudeProvider('test-key');
        // interrupt() should not throw even when no query is active
        await expect(provider.interrupt()).resolves.not.toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    describe('Authentication Errors', () => {
      it('should throw friendly error for invalid API key', async () => {
        const provider = new ClaudeProvider('test-key');
        await provider.ensureAgentModeReady();

        const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
        (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
          () => ({
            // eslint-disable-next-line require-yield
            [Symbol.asyncIterator]: async function* () {
              throw new Error('authentication_error: invalid_api_key');
            },
          })
        );

        const generator = provider.executeAgent({
          prompt: 'Hello',
          model: 'claude-sonnet-4-5-20250929',
          cwd: '/test',
        });

        await expect(generator.next()).rejects.toThrow('Authentication failed');
      });
    });

    describe('Rate Limiting', () => {
      it('should throw friendly error for rate limits', async () => {
        const provider = new ClaudeProvider('test-key');
        await provider.ensureAgentModeReady();

        const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
        (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
          () => ({
            // eslint-disable-next-line require-yield
            [Symbol.asyncIterator]: async function* () {
              throw new Error('rate_limit exceeded');
            },
          })
        );

        const generator = provider.executeAgent({
          prompt: 'Hello',
          model: 'claude-sonnet-4-5-20250929',
          cwd: '/test',
        });

        await expect(generator.next()).rejects.toThrow('Rate limit exceeded');
      });
    });

    describe('Process Exit Errors', () => {
      it('should throw helpful error for process exit code 1', async () => {
        const provider = new ClaudeProvider('test-key');
        await provider.ensureAgentModeReady();

        const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
        (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
          () => ({
            // eslint-disable-next-line require-yield
            [Symbol.asyncIterator]: async function* () {
              throw new Error('process exited with code 1');
            },
          })
        );

        const generator = provider.executeAgent({
          prompt: 'Hello',
          model: 'claude-sonnet-4-5-20250929',
          cwd: '/test',
        });

        await expect(generator.next()).rejects.toThrow(
          'Claude Code exited unexpectedly'
        );
      });
    });

    describe('Abort Handling', () => {
      it('should handle abort gracefully', async () => {
        const provider = new ClaudeProvider('test-key');
        await provider.ensureAgentModeReady();

        const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
        (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
          () => ({
            // eslint-disable-next-line require-yield
            [Symbol.asyncIterator]: async function* () {
              const abortError = new Error('aborted by user');
              abortError.name = 'AbortError';
              throw abortError;
            },
          })
        );

        const generator = provider.executeAgent({
          prompt: 'Hello',
          model: 'claude-sonnet-4-5-20250929',
          cwd: '/test',
        });

        // Should resolve with stop status, not throw
        const result = await generator.next();
        expect(result.done).toBe(false);
        expect(result.value?.finishReason).toBe('stop');
      });
    });
  });

  describe('Message Conversion', () => {
    it('should handle assistant text messages', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
      (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'stream_event',
              event: {
                type: 'content_block_delta',
                delta: { type: 'text_delta', text: 'Hello!' },
              },
            };
            yield {
              type: 'result',
              subtype: 'success',
              usage: { input_tokens: 10, output_tokens: 5 },
            };
          },
        })
      );

      const generator = provider.executeAgent({
        prompt: 'Hi',
        model: 'claude-sonnet-4-5-20250929',
        cwd: '/test',
      });

      const responses: Array<{ messages: unknown[] }> = [];
      for await (const response of generator) {
        responses.push(response);
      }

      expect(responses.length).toBeGreaterThan(0);
      // First response should have the text message
      expect(responses[0].messages.length).toBe(1);
    });

    it('should handle tool_use messages', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
      (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'assistant',
              message: {
                content: [
                  {
                    type: 'tool_use',
                    id: 'tool_123',
                    name: 'read_file',
                    input: { path: '/test.txt' },
                  },
                ],
              },
            };
            yield {
              type: 'result',
              subtype: 'success',
              usage: { input_tokens: 10, output_tokens: 5 },
            };
          },
        })
      );

      const generator = provider.executeAgent({
        prompt: 'Read test.txt',
        model: 'claude-sonnet-4-5-20250929',
        cwd: '/test',
      });

      const responses: Array<{
        messages: Array<{ type: string; content: unknown }>;
      }> = [];
      for await (const response of generator) {
        responses.push(response);
      }

      expect(responses.length).toBeGreaterThan(0);
      const toolMessage = responses[0].messages[0];
      expect(toolMessage.type).toBe('assistant');
    });

    it('should handle thinking blocks', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
      (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'assistant',
              message: {
                content: [
                  {
                    type: 'thinking',
                    thinking: 'Let me analyze this...',
                  },
                ],
              },
            };
            yield {
              type: 'result',
              subtype: 'success',
              usage: { input_tokens: 10, output_tokens: 5 },
            };
          },
        })
      );

      const generator = provider.executeAgent({
        prompt: 'Think about this',
        model: 'claude-sonnet-4-5-20250929',
        cwd: '/test',
        maxThinkingTokens: 5000,
      });

      const responses: Array<{
        messages: Array<{
          content: Array<{ type: string; thinking?: string }>;
        }>;
      }> = [];
      for await (const response of generator) {
        responses.push(response);
      }

      expect(responses.length).toBeGreaterThan(0);
      const thinkingMessage = responses[0].messages[0];
      expect(thinkingMessage.content[0].type).toBe('thinking');
      expect(thinkingMessage.content[0].thinking).toBe(
        'Let me analyze this...'
      );
    });

    it('should extract session ID from messages', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
      (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'system',
              session_id: 'session_abc123',
            };
            yield {
              type: 'result',
              subtype: 'success',
              usage: { input_tokens: 10, output_tokens: 5 },
            };
          },
        })
      );

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'claude-sonnet-4-5-20250929',
        cwd: '/test',
      });

      let sessionId = '';
      for await (const response of generator) {
        sessionId = response.sessionId;
      }

      expect(sessionId).toBe('session_abc123');
    });

    it('should handle tool_progress messages', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
      (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'tool_progress',
              tool_name: 'read_file',
              elapsed_time_seconds: 1.5,
            };
            yield {
              type: 'result',
              subtype: 'success',
              usage: { input_tokens: 10, output_tokens: 5 },
            };
          },
        })
      );

      const generator = provider.executeAgent({
        prompt: 'Read file',
        model: 'claude-sonnet-4-5-20250929',
        cwd: '/test',
      });

      const responses: Array<{
        messages: Array<{ type: string; content: string }>;
      }> = [];
      for await (const response of generator) {
        responses.push(response);
      }

      expect(responses.length).toBeGreaterThan(0);
      const progressMessage = responses[0].messages[0];
      expect(progressMessage.type).toBe('tool_use');
      expect(progressMessage.content).toContain('read_file');
    });
  });

  describe('Token Tracking', () => {
    it('should track tokens from message_delta events', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
      (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'stream_event',
              event: {
                type: 'message_delta',
                usage: {
                  input_tokens: 100,
                  output_tokens: 50,
                  cache_creation_input_tokens: 20,
                  cache_read_input_tokens: 10,
                },
              },
            };
            yield {
              type: 'result',
              subtype: 'success',
              usage: { input_tokens: 130, output_tokens: 50 },
            };
          },
        })
      );

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'claude-sonnet-4-5-20250929',
        cwd: '/test',
      });

      let finalTokens = { prompt: 0, completion: 0, total: 0 };
      for await (const response of generator) {
        finalTokens = response.tokens;
      }

      // Should include cache tokens
      expect(finalTokens.prompt).toBe(130); // from result
      expect(finalTokens.completion).toBe(50);
      expect(finalTokens.total).toBe(180);
    });

    it('should extract num_turns from result', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
      (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'result',
              subtype: 'success',
              num_turns: 3,
              usage: { input_tokens: 100, output_tokens: 50 },
            };
          },
        })
      );

      const generator = provider.executeAgent({
        prompt: 'Multi-turn conversation',
        model: 'claude-sonnet-4-5-20250929',
        cwd: '/test',
      });

      let numTurns = 0;
      for await (const response of generator) {
        numTurns = response.numTurns;
      }

      expect(numTurns).toBe(3);
    });
  });

  describe('Finish Reason', () => {
    it('should return stop for successful result', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
      (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'result',
              subtype: 'success',
              usage: { input_tokens: 10, output_tokens: 5 },
            };
          },
        })
      );

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'claude-sonnet-4-5-20250929',
        cwd: '/test',
      });

      let finishReason = '';
      for await (const response of generator) {
        finishReason = response.finishReason;
      }

      expect(finishReason).toBe('stop');
    });

    it('should return error for failed result', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
      (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'result',
              subtype: 'error',
              error: 'Something failed',
            };
          },
        })
      );

      const generator = provider.executeAgent({
        prompt: 'Hello',
        model: 'claude-sonnet-4-5-20250929',
        cwd: '/test',
      });

      let finishReason = '';
      for await (const response of generator) {
        finishReason = response.finishReason;
      }

      expect(finishReason).toBe('error');
    });

    it('should return tool_use when tool is used', async () => {
      const provider = new ClaudeProvider('test-key');
      await provider.ensureAgentModeReady();

      const claudeAgentSdk = await import('@anthropic-ai/claude-agent-sdk');
      (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'assistant',
              message: {
                content: [
                  { type: 'tool_use', id: 't1', name: 'read', input: {} },
                ],
              },
            };
          },
        })
      );

      const generator = provider.executeAgent({
        prompt: 'Use a tool',
        model: 'claude-sonnet-4-5-20250929',
        cwd: '/test',
      });

      let finishReason = '';
      for await (const response of generator) {
        finishReason = response.finishReason;
      }

      expect(finishReason).toBe('tool_use');
    });
  });
});
