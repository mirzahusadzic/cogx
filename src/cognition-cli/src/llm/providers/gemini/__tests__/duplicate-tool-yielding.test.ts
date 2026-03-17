import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiAgentProvider } from '../agent-provider.js';
import { Runner } from '@google/adk';
import * as sessionState from '../../../../sigma/session-state.js';

// Mock ADK Runner
vi.mock('@google/adk', async () => {
  const actual = await vi.importActual('@google/adk');
  return {
    ...actual,
    Runner: vi.fn(),
  };
});

// Mock getActiveTaskId
vi.mock('../../../../sigma/session-state.js', async () => {
  const actual = await vi.importActual('../../../../sigma/session-state.js');
  return {
    ...actual,
    getActiveTaskId: vi.fn(),
  };
});

const runIntegration = process.env.COGNITION_TEST_INTEGRATION === 'true';

describe.skipIf(!runIntegration)(
  'GeminiAgentProvider Duplicate Yielding',
  () => {
    let provider: GeminiAgentProvider;

    beforeEach(() => {
      vi.clearAllMocks();
      provider = new GeminiAgentProvider('test-key');
      // @ts-expect-error - access private for testing
      provider.apiKey = 'test-key';
    });

    it('should not yield duplicate tool calls or responses in a single turn', async () => {
      const mockRunAsync = vi.fn();
      vi.mocked(Runner).mockImplementation(
        () =>
          ({
            runAsync: mockRunAsync,
          }) as unknown as Runner
      );

      vi.mocked(sessionState.getActiveTaskId).mockReturnValue('test-task');

      // Mock sequence of ADK events simulating cumulative parts
      const events = [
        // Event 1: Tool 1 call
        {
          author: 'cognition_agent',
          content: {
            parts: [
              {
                functionCall: {
                  id: 'call1',
                  name: 'read_file',
                  args: { file_path: 'a.ts' },
                },
              },
            ],
          },
        },
        // Event 2: Tool 1 response
        {
          author: 'cognition_agent',
          content: {
            parts: [
              {
                functionCall: {
                  id: 'call1',
                  name: 'read_file',
                  args: { file_path: 'a.ts' },
                },
              },
              {
                functionResponse: {
                  id: 'call1',
                  name: 'read_file',
                  response: { content: 'a' },
                },
              },
            ],
          },
        },
        // Event 3: Tool 2 call
        {
          author: 'cognition_agent',
          content: {
            parts: [
              {
                functionCall: {
                  id: 'call1',
                  name: 'read_file',
                  args: { file_path: 'a.ts' },
                },
              },
              {
                functionResponse: {
                  id: 'call1',
                  name: 'read_file',
                  response: { content: 'a' },
                },
              },
              {
                functionCall: {
                  id: 'call2',
                  name: 'read_file',
                  args: { file_path: 'b.ts' },
                },
              },
            ],
          },
        },
      ];

      async function* mockGenerator() {
        for (const event of events) {
          yield event;
        }
      }

      mockRunAsync.mockReturnValue(mockGenerator());

      // Spy on rollingPruneTaskLogs
      const pruneSpy = vi.spyOn(
        provider as unknown as { rollingPruneTaskLogs: () => Promise<void> },
        'rollingPruneTaskLogs'
      );
      pruneSpy.mockResolvedValue(undefined);

      const generator = provider.executeAgent({
        prompt: 'test',
        model: 'gemini-3-flash-preview',
        cwd: process.cwd(),
        anchorId: 'test-anchor',
      });

      const snapshots = [];
      for await (const snapshot of generator) {
        snapshots.push(snapshot);
      }

      // Check last snapshot messages
      const lastSnapshot = snapshots[snapshots.length - 1];
      const toolUses = lastSnapshot.messages.filter(
        (m) => m.type === 'tool_use'
      );
      const toolResults = lastSnapshot.messages.filter(
        (m) => m.type === 'tool_result'
      );

      // Should only have 2 tool calls and 1 response (from the events above)
      // call1, resp1, call2
      expect(toolUses.length).toBe(2);
      expect(toolResults.length).toBe(1);

      expect(toolUses[0].toolCallId).toBe('call1');
      expect(toolUses[1].toolCallId).toBe('call2');
      expect(toolResults[0].toolCallId).toBe('call1');

      // Should only have called prune ONCE (for call1/resp1)
      // Event 2 has call1/resp1 -> Prune
      // Event 3 has call1/resp1, call2 -> Should SKIP prune for call1/resp1 as it was already yielded
      expect(pruneSpy).toHaveBeenCalledTimes(1);
    });
  }
);
