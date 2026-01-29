/**
 * Tests for SDKMessageProcessor
 *
 * Week 2 Day 6-8: Extract SDK Layer
 */

import { describe, it, expect } from 'vitest';
import {
  extractSessionId,
  processAssistantMessage,
  processStreamEvent,
  processToolProgress,
  processResult,
  processSystemMessage,
  processSDKMessage,
} from '../../../sdk/SDKMessageProcessor.js';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

describe('SDKMessageProcessor', () => {
  describe('extractSessionId()', () => {
    it('extracts session ID from SDK message', () => {
      const message = {
        type: 'assistant',
        session_id: 'test-session-123',
        message: { content: [] },
      } as unknown as SDKMessage;

      expect(extractSessionId(message)).toBe('test-session-123');
    });

    it('returns undefined if no session ID', () => {
      const message = {
        type: 'assistant',
        message: { content: [] },
      } as unknown as SDKMessage;

      expect(extractSessionId(message)).toBeUndefined();
    });

    it('returns undefined if session ID is empty', () => {
      const message = {
        type: 'assistant',
        session_id: '',
        message: { content: [] },
      } as unknown as SDKMessage;

      expect(extractSessionId(message)).toBeUndefined();
    });
  });

  describe('processAssistantMessage()', () => {
    it('returns empty array if not assistant message', () => {
      const message = {
        type: 'system',
        subtype: 'init',
        model: 'claude-3-5-sonnet-20250219',
      } as unknown as SDKMessage;

      expect(processAssistantMessage(message)).toEqual([]);
    });

    it('returns empty array if no tool uses', () => {
      const message = {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Hello' }],
        },
      } as unknown as SDKMessage;

      expect(processAssistantMessage(message)).toEqual([]);
    });

    it('processes tool uses', () => {
      const message = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/test/file.ts' },
            },
          ],
        },
      } as unknown as SDKMessage;

      const result = processAssistantMessage(message);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('tool_progress');
      expect(result[0].content).toContain('Read');
      expect(result[0].content).toContain('/test/file.ts');
    });

    it('processes multiple tool uses', () => {
      const message = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/test/file1.ts' },
            },
            {
              type: 'tool_use',
              name: 'Edit',
              input: {
                file_path: '/test/file2.ts',
                description: 'Update code',
              },
            },
          ],
        },
      } as unknown as SDKMessage;

      const result = processAssistantMessage(message);
      expect(result).toHaveLength(2);
      expect(result[0].content).toContain('Read');
      expect(result[1].content).toContain('Edit');
    });
  });

  describe('processStreamEvent()', () => {
    it('returns unknown for non-stream events', () => {
      const message = {
        type: 'assistant',
        message: { content: [] },
      } as unknown as SDKMessage;

      expect(processStreamEvent(message)).toEqual({ type: 'unknown' });
    });

    it('processes message_delta with token usage', () => {
      const message = {
        type: 'stream_event',
        event: {
          type: 'message_delta',
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
            cache_creation_input_tokens: 100,
            cache_read_input_tokens: 50,
          },
        },
      } as unknown as SDKMessage;

      const result = processStreamEvent(message);
      expect(result.type).toBe('token_update');
      expect(result.tokenUpdate).toEqual({
        input: 1150, // 1000 + 100 + 50
        output: 500,
        total: 1650, // 1150 + 500
      });
    });

    it('processes content_block_start for tool use', () => {
      const message = {
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          content_block: {
            type: 'tool_use',
            name: 'Bash',
          },
        },
      } as unknown as SDKMessage;

      const result = processStreamEvent(message);
      expect(result.type).toBe('tool_start');
      expect(result.toolName).toBe('Bash');
    });

    it('processes content_block_delta with text', () => {
      const message = {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: {
            type: 'text_delta',
            text: 'Hello world',
          },
        },
      } as unknown as SDKMessage;

      const result = processStreamEvent(message);
      expect(result.type).toBe('text_delta');
      expect(result.textDelta).toBe('Hello world');
    });

    it('strips ANSI codes from text delta', () => {
      const message = {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: {
            type: 'text_delta',
            text: '\x1b[32mGreen text\x1b[0m',
          },
        },
      } as unknown as SDKMessage;

      const result = processStreamEvent(message);
      expect(result.type).toBe('text_delta');
      expect(result.textDelta).toBe('Green text');
    });

    it('returns unknown for unhandled stream event types', () => {
      const message = {
        type: 'stream_event',
        event: {
          type: 'some_other_event',
        },
      } as unknown as SDKMessage;

      expect(processStreamEvent(message)).toEqual({ type: 'unknown' });
    });
  });

  describe('processToolProgress()', () => {
    it('returns null for non-tool-progress messages', () => {
      const message = {
        type: 'assistant',
        message: { content: [] },
      } as unknown as SDKMessage;

      expect(processToolProgress(message)).toBeNull();
    });

    it('processes tool progress', () => {
      const message = {
        type: 'tool_progress',
        tool_name: 'Bash',
        elapsed_time_seconds: 2.5,
      } as unknown as SDKMessage;

      const result = processToolProgress(message);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('tool_progress');
      expect(result!.content).toContain('Bash');
      expect(result!.content).toContain('3s'); // Rounded from 2.5
    });

    it('rounds elapsed time', () => {
      const message = {
        type: 'tool_progress',
        tool_name: 'Test',
        elapsed_time_seconds: 1.234,
      } as unknown as SDKMessage;

      const result = processToolProgress(message);
      expect(result!.content).toContain('1s');
    });
  });

  describe('processResult()', () => {
    it('returns null for non-result messages', () => {
      const message = {
        type: 'assistant',
        message: { content: [] },
      } as unknown as SDKMessage;

      expect(processResult(message)).toBeNull();
    });

    it('processes successful result', () => {
      const message = {
        type: 'result',
        subtype: 'success',
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
        },
        num_turns: 3,
        total_cost_usd: 0.0456,
      } as unknown as SDKMessage;

      const result = processResult(message);
      expect(result).not.toBeNull();
      expect(result!.message.type).toBe('system');
      expect(result!.message.content).toContain('Complete');
      expect(result!.message.content).toContain('3 turns');
      expect(result!.message.content).toContain('0.0456');
      expect(result!.tokenUpdate).toEqual({
        input: 1000,
        output: 500,
        total: 1500,
      });
    });

    it('processes error result', () => {
      const message = {
        type: 'result',
        subtype: 'error',
      } as unknown as SDKMessage;

      const result = processResult(message);
      expect(result).not.toBeNull();
      expect(result!.message.type).toBe('system');
      expect(result!.message.content).toContain('Error');
      expect(result!.tokenUpdate).toBeUndefined();
    });
  });

  describe('processSystemMessage()', () => {
    it('returns null for non-system messages', () => {
      const message = {
        type: 'assistant',
        message: { content: [] },
      } as unknown as SDKMessage;

      expect(processSystemMessage(message)).toBeNull();
    });

    it('processes init system message', () => {
      const message = {
        type: 'system',
        subtype: 'init',
        model: 'claude-3-5-sonnet-20250219',
      } as unknown as SDKMessage;

      const result = processSystemMessage(message);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('system');
      expect(result!.content).toContain('Connected to Claude');
      expect(result!.content).toContain('claude-3-5-sonnet-20250219');
    });

    it('returns null for unhandled system message subtypes', () => {
      const message = {
        type: 'system',
        subtype: 'other',
      } as unknown as SDKMessage;

      expect(processSystemMessage(message)).toBeNull();
    });
  });

  describe('processSDKMessage()', () => {
    it('extracts session ID from all message types', () => {
      const message = {
        type: 'assistant',
        session_id: 'session-123',
        message: { content: [] },
      } as unknown as SDKMessage;

      const result = processSDKMessage(message);
      expect(result.sessionId).toBe('session-123');
    });

    it('processes assistant message with tools', () => {
      const message = {
        type: 'assistant',
        session_id: 'session-123',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/test.ts' },
            },
          ],
        },
      } as unknown as SDKMessage;

      const result = processSDKMessage(message);
      expect(result.sessionId).toBe('session-123');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe('tool_progress');
    });

    it('processes stream event with token update', () => {
      const message = {
        type: 'stream_event',
        session_id: 'session-123',
        event: {
          type: 'message_delta',
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
          },
        },
      } as unknown as SDKMessage;

      const result = processSDKMessage(message);
      expect(result.sessionId).toBe('session-123');
      expect(result.tokenUpdate).toEqual({
        input: 1000,
        output: 500,
        total: 1500,
      });
    });

    it('processes successful result with tokens', () => {
      const message = {
        type: 'result',
        session_id: 'session-123',
        subtype: 'success',
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
        },
        num_turns: 1,
        total_cost_usd: 0.01,
      } as unknown as SDKMessage;

      const result = processSDKMessage(message);
      expect(result.sessionId).toBe('session-123');
      expect(result.messages).toHaveLength(1);
      expect(result.tokenUpdate).toBeDefined();
    });

    it('processes system init message', () => {
      const message = {
        type: 'system',
        session_id: 'session-123',
        subtype: 'init',
        model: 'claude-3-5-sonnet-20250219',
      } as unknown as SDKMessage;

      const result = processSDKMessage(message);
      expect(result.sessionId).toBe('session-123');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Connected to Claude');
    });

    it('processes tool progress message', () => {
      const message = {
        type: 'tool_progress',
        session_id: 'session-123',
        tool_name: 'Bash',
        elapsed_time_seconds: 1.5,
      } as unknown as SDKMessage;

      const result = processSDKMessage(message);
      expect(result.sessionId).toBe('session-123');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe('tool_progress');
    });
  });
});
