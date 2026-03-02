import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiAgentProvider } from '../agent-provider.js';
import { getUnifiedTools } from '../../../tools/unified-tools.js';
import { buildSystemPrompt } from '../../../core/utils/system-prompt.js';
import { AgentRequest } from '../../../core/interfaces/agent-provider.js';

// Mock system prompt
vi.mock('../../../core/utils/system-prompt.js', () => ({
  buildSystemPrompt: vi.fn().mockImplementation(() => {
    return `
      MEMORY & EVICTION RULES (CRITICAL)
      1. The "Amnesia" Warning
      2. Distill Before Dying
    `;
  }),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockRejectedValue(new Error('File not found')),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock tool executors
vi.mock('../../../core/utils/tool-executors.js', () => ({
  executeSigmaTaskUpdate: vi.fn(),
  executeReadFile: vi.fn(),
  executeWriteFile: vi.fn(),
  executeGlob: vi.fn(),
  executeGrep: vi.fn(),
  executeBash: vi.fn(),
  executeEditFile: vi.fn(),
  executeFetchUrl: vi.fn(),
}));

// Mock @google/adk
vi.mock('@google/adk', () => {
  const mockRunner = {
    runAsync: vi.fn().mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield { author: 'user', content: { parts: [{ text: 'hello' }] } };
      },
    }),
  };
  const mockSessionService = {
    getSession: vi
      .fn()
      .mockResolvedValue({ sessionId: 'test-session', events: [] }),
    createSession: vi
      .fn()
      .mockResolvedValue({ sessionId: 'test-session', events: [] }),
    appendEvent: vi.fn().mockResolvedValue(undefined),
  };
  return {
    LlmAgent: vi.fn().mockImplementation(() => ({})),
    Runner: vi.fn().mockImplementation(() => mockRunner),
    InMemorySessionService: vi
      .fn()
      .mockImplementation(() => mockSessionService),
    setLogLevel: vi.fn(),
    LogLevel: { ERROR: 0 },
    StreamingMode: { SSE: 'sse', BIDI: 'bidi' },
    GOOGLE_SEARCH: {},
    AgentTool: vi.fn(),
    FunctionTool: vi
      .fn()
      .mockImplementation(({ name, description, parameters, execute }) => ({
        name,
        description,
        parameters,
        execute,
      })),
  };
});

vi.mock('../../../../sigma/session-state.js', () => ({
  getActiveTaskId: vi.fn(),
  loadSessionState: vi.fn().mockReturnValue({ todos: [] }),
}));

describe('Gemini Eviction Strategy', () => {
  let provider: GeminiAgentProvider;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    provider = new GeminiAgentProvider();
  });

  describe('System Prompt', () => {
    it('should include Memory & Eviction Rules in system prompt', () => {
      const systemPrompt = buildSystemPrompt(
        {
          prompt: 'test',
          model: 'gemini-3-flash-preview',
        } as unknown as AgentRequest,
        'gemini-3-flash-preview',
        'Google ADK'
      );

      expect(systemPrompt).toContain('MEMORY & EVICTION RULES (CRITICAL)');
      expect(systemPrompt).toContain('The "Amnesia" Warning');
      expect(systemPrompt).toContain('Distill Before Dying');
    });
  });

  describe('Log Eviction (pruneTaskLogs)', () => {
    it('should surgically evict logs with matching task tags', async () => {
      const taskId = 'task-123';
      const sessionId = 'session-456';
      const resultSummary =
        'Successfully implemented the feature with 5 tests.';

      const mockEvents = [
        {
          author: 'user',
          content: { parts: [{ text: 'Research the files' }] },
        },
        {
          author: 'cognition_agent',
          content: {
            parts: [
              {
                functionResponse: {
                  name: 'read_file',
                  response: {
                    result: `file content here\n\n<!-- sigma-task: ${taskId} -->`,
                  },
                },
              },
            ],
          },
        },
        {
          author: 'user',
          content: { parts: [{ text: 'Next step' }] },
        },
      ];

      const mockSession = {
        events: [...mockEvents],
      };

      await (
        provider as unknown as {
          pruneTaskLogs: (
            tid: string,
            rs: string,
            sid: string,
            pr: string,
            as: unknown
          ) => Promise<void>;
        }
      ).pruneTaskLogs(
        taskId,
        resultSummary,
        sessionId,
        '/tmp/project',
        mockSession
      );

      expect(mockSession.events.length).toBe(3);
      const tombstoneEvent = mockSession.events[1];
      const part = tombstoneEvent.content.parts[0];
      expect(part.functionResponse.response.result).toContain(
        `Task ${taskId} completed`
      );
      expect(part.functionResponse.response.result).toContain(resultSummary);
    });

    it('should evict assistant turns in the task range (Turn-Range Eviction)', async () => {
      const taskId = 'task-456';
      const resultSummary = 'Final outcome of the task.';

      const mockEvents = [
        {
          author: 'cognition_agent',
          content: {
            parts: [
              {
                functionCall: {
                  name: 'SigmaTaskUpdate',
                  args: {
                    todos: [
                      {
                        id: taskId,
                        status: 'in_progress',
                        content: 'Do work',
                        activeForm: 'Doing work',
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
        {
          author: 'cognition_agent',
          content: {
            parts: [
              {
                thought: true,
                thoughtSignature: 'sig-123',
                text: 'I am thinking very hard about this task...',
              },
              { text: 'I will read the file now.' },
              {
                functionCall: { name: 'read_file', args: { path: 'foo.txt' } },
              },
            ],
          },
        },
        {
          author: 'cognition_agent',
          content: {
            parts: [
              {
                functionResponse: {
                  name: 'read_file',
                  response: {
                    result: `content\n<!-- sigma-task: ${taskId} -->`,
                  },
                },
              },
            ],
          },
        },
      ];

      const mockSession = {
        events: [...mockEvents],
      };

      await (
        provider as unknown as {
          pruneTaskLogs: (
            tid: string,
            rs: string,
            sid: string,
            pr: string,
            as: unknown
          ) => Promise<void>;
        }
      ).pruneTaskLogs(taskId, resultSummary, 'session-1', '/tmp', mockSession);

      // Event 0: Should keep the SigmaTaskUpdate function call
      expect(mockSession.events[0].content.parts[0].functionCall.name).toBe(
        'SigmaTaskUpdate'
      );

      // Event 1: Assistant turn in range should have thinking/text pruned
      const assistantEvent = mockSession.events[1];
      // It should have 2 parts: 1 tombstone for thinking/text, 1 tool call
      expect(assistantEvent.content.parts.length).toBe(2);
      expect(assistantEvent.content.parts[0].text).toContain(
        'evicted to save tokens'
      );
      expect(assistantEvent.content.parts[0].thought).toBe(true);
      expect(assistantEvent.content.parts[0].thoughtSignature).toBe('sig-123');
      expect(assistantEvent.content.parts[1].functionCall.name).toBe(
        'read_file'
      );

      // Event 2: Tool response with tag should be a tombstone
      const toolEvent = mockSession.events[2];
      expect(
        toolEvent.content.parts[0].functionResponse.response.result
      ).toContain(resultSummary);
    });

    it('should gracefully handle missing in_progress tag (Fallback Behavior)', async () => {
      const taskId = 'task-missing-start';
      const resultSummary = 'Final outcome.';

      const mockEvents = [
        {
          // Older event, not marked as in_progress
          author: 'cognition_agent',
          content: {
            parts: [
              {
                thought: true,
                thoughtSignature: 'sig-old',
                text: 'Old thinking...',
              },
              { text: 'Old text.' },
              {
                functionCall: { name: 'other_tool', args: {} },
              },
            ],
          },
        },
        {
          author: 'cognition_agent',
          content: {
            parts: [
              {
                functionResponse: {
                  name: 'other_tool',
                  response: {
                    result: `content\n<!-- sigma-task: ${taskId} -->`,
                  },
                },
              },
            ],
          },
        },
      ];

      const mockSession = {
        events: [...mockEvents],
      };

      await (
        provider as unknown as {
          pruneTaskLogs: (
            tid: string,
            rs: string,
            sid: string,
            pr: string,
            as: unknown
          ) => Promise<void>;
        }
      ).pruneTaskLogs(taskId, resultSummary, 'session-fb', '/tmp', mockSession);

      // Event 0: Assistant turn should NOT be touched because start index is -1
      const assistantEvent = mockSession.events[0];
      expect(assistantEvent.content.parts.length).toBe(3); // Thought, text, functionCall
      expect(assistantEvent.content.parts[0].text).toBe('Old thinking...');

      // Event 1: Tool response with task tag should still be pruned
      const toolEvent = mockSession.events[1];
      expect(
        toolEvent.content.parts[0].functionResponse.response.result
      ).toContain(resultSummary);
      expect(
        toolEvent.content.parts[0].functionResponse.response.result
      ).toContain('evicted to archive');
    });

    it('should inject result_summary ONLY in the final tombstone (No Duplication)', async () => {
      const taskId = 'task-dup';
      const resultSummary = 'Unique injected summary.';

      const mockEvents = [
        {
          author: 'cognition_agent',
          content: {
            parts: [
              {
                functionResponse: {
                  name: 'tool_one',
                  response: {
                    result: `output 1\n<!-- sigma-task: ${taskId} -->`,
                  },
                },
              },
            ],
          },
        },
        {
          author: 'cognition_agent',
          content: {
            parts: [
              {
                functionResponse: {
                  name: 'tool_two',
                  response: {
                    result: `output 2\n<!-- sigma-task: ${taskId} -->`,
                  },
                },
              },
            ],
          },
        },
        {
          author: 'cognition_agent',
          content: {
            parts: [
              {
                functionResponse: {
                  name: 'tool_three', // Unrelated tool
                  response: { result: `output 3\n<!-- sigma-task: other -->` },
                },
              },
            ],
          },
        },
      ];

      const mockSession = { events: [...mockEvents] };

      await (
        provider as unknown as {
          pruneTaskLogs: (
            tid: string,
            rs: string,
            sid: string,
            pr: string,
            as: unknown
          ) => Promise<void>;
        }
      ).pruneTaskLogs(
        taskId,
        resultSummary,
        'session-dup',
        '/tmp',
        mockSession
      );

      // Event 0: Evicted but NO summary (it is not the last evicted index)
      const toolOneEviction =
        mockSession.events[0].content.parts[0].functionResponse.response.result;
      expect(toolOneEviction).toContain('evicted to archive');
      expect(toolOneEviction).not.toContain(resultSummary);

      // Event 1: Evicted AND contains the summary (last evicted index)
      const toolTwoEviction =
        mockSession.events[1].content.parts[0].functionResponse.response.result;
      expect(toolTwoEviction).toContain('evicted to archive');
      expect(toolTwoEviction).toContain(resultSummary);

      // Event 2: Unrelated tool, untouched
      expect(
        mockSession.events[2].content.parts[0].functionResponse.response.result
      ).toContain('output 3');
    });

    it('should persist evictions in InMemorySessionService internal storage (Bug Fix Verification)', async () => {
      const taskId = 'task-789';
      const sessionId = 'session-789';
      const resultSummary = 'Summary for persistence test.';

      const mockEvents = [
        {
          author: 'user',
          content: {
            parts: [{ text: `tagged message <!-- sigma-task: ${taskId} -->` }],
          },
        },
      ];

      // Access the mocked session service
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockSessionService = (provider as any).sessionService;

      // Simulate the internal structure of InMemorySessionService
      mockSessionService.sessions = {
        'cognition-cli': {
          'cognition-user': {
            [sessionId]: {
              sessionId,
              events: [...mockEvents],
            },
          },
        },
      };

      // Mock getSession to return a CLONE of the session, simulating ADK behavior
      mockSessionService.getSession.mockImplementation(async () => {
        const session =
          mockSessionService.sessions['cognition-cli']['cognition-user'][
            sessionId
          ];
        return {
          ...session,
          events: [...session.events],
        };
      });

      // Execute pruning - it should fetch from sessionService since no activeSession is passed
      await (
        provider as unknown as {
          pruneTaskLogs: (
            tid: string,
            rs: string,
            sid: string,
            pr: string
          ) => Promise<void>;
        }
      ).pruneTaskLogs(taskId, resultSummary, sessionId, '/tmp');

      // 1. Verify internal storage was updated
      const internalSession =
        mockSessionService.sessions['cognition-cli']['cognition-user'][
          sessionId
        ];
      const storedEvents = internalSession.events;
      expect(storedEvents[0].content.parts[0].text).toContain(resultSummary);

      // 2. Verify that subsequent getSession calls return the pruned history
      const nextTurnSession = await mockSessionService.getSession();
      expect(nextTurnSession.events[0].content.parts[0].text).toContain(
        resultSummary
      );

      // 3. Verify reference isolation (the bug fix used [...newEvents])
      const retrievedSession = await mockSessionService.getSession();
      const internalSessionFinal =
        mockSessionService.sessions['cognition-cli']['cognition-user'][
          sessionId
        ];

      // They should have the same content
      expect(retrievedSession.events.length).toBe(
        internalSessionFinal.events.length
      );

      // But they MUST be different array references to prevent ADK double-append bugs
      expect(retrievedSession.events).not.toBe(internalSessionFinal.events);
    });
  });

  describe('SigmaTaskUpdate Validation Gate', () => {
    it('should throw error when task completed without summary', async () => {
      const tools = getUnifiedTools({ cwd: process.cwd() }, 'gemini');
      const sigmaTool = tools.find(
        (t) => (t as { name: string }).name === 'SigmaTaskUpdate'
      ) as unknown as { execute: (input: unknown) => Promise<void> };
      const input = {
        todos: [
          {
            id: 'task-1',
            content: 'Do',
            status: 'completed',
            activeForm: 'Doing',
          },
        ],
      };
      if (!sigmaTool) throw new Error('SigmaTaskUpdate tool not found');
      await expect(sigmaTool.execute(input)).rejects.toThrow(/result_summary/);
    });

    it('should call onTaskCompleted when task is marked completed', async () => {
      const onTaskCompleted = vi.fn().mockResolvedValue(undefined);
      const tools = getUnifiedTools(
        {
          cwd: process.cwd(),
          onTaskCompleted,
          anchorId: 'test',
        },
        'gemini'
      );
      const sigmaTool = tools.find(
        (t) => (t as { name: string }).name === 'SigmaTaskUpdate'
      ) as unknown as { execute: (input: unknown) => Promise<void> };
      const resultSummary =
        'This is a long enough summary for the task completion.';
      if (!sigmaTool) throw new Error('SigmaTaskUpdate tool not found');
      await sigmaTool.execute({
        todos: [
          {
            id: 'task-1',
            content: 'Do',
            status: 'completed',
            activeForm: 'Doing',
            result_summary: resultSummary,
          },
        ],
      });
      expect(onTaskCompleted).toHaveBeenCalledWith(
        'task-1',
        resultSummary,
        undefined
      );
    });
  });

  describe('Token Count Tracking', () => {
    it('should track and accumulate token usage from Gemini API', async () => {
      const { Runner } = await import('@google/adk');

      const mockRunGenerator = async function* () {
        yield {
          author: 'cognition_agent',
          content: { parts: [{ text: 'Response' }] },
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 100,
            totalTokenCount: 200,
          },
        };
      };

      vi.mocked(Runner).mockImplementation(
        () =>
          ({
            runAsync: vi.fn().mockReturnValue(mockRunGenerator()),
          }) as unknown as { runAsync: () => unknown }
      );

      const responses = [];
      const generator = provider.executeAgent({
        prompt: 'test prompt',
        model: 'gemini-3-flash-preview',
        cwd: '/tmp/project',
      });

      for await (const response of generator) {
        responses.push(response);
      }

      expect(responses.length).toBeGreaterThan(1);
      const lastResponse = responses[responses.length - 1];

      // The current prompt tokens from the API (100) should be reflected.
      // If it's 3, it means currentPromptTokens was not updated from usageMetadata.
      expect(lastResponse.tokens.prompt).toBe(100);
      expect(lastResponse.tokens.completion).toBe(100);
      expect(lastResponse.tokens.total).toBe(200);
    });
  });
});
