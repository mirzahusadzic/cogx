import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiAgentProvider } from '../gemini-agent-provider.js';
import { getCognitionTools } from '../gemini-adk-tools.js';
import * as fs from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockRejectedValue(new Error('File not found')),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock tool executors
vi.mock('../tool-executors.js', () => ({
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

vi.mock('../../../sigma/session-state.js', () => ({
  getActiveTaskId: vi.fn(),
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
      const systemPrompt = (
        provider as unknown as {
          buildSystemPrompt: (req: unknown, sid: string) => string;
        }
      ).buildSystemPrompt(
        {
          prompt: 'test',
          model: 'gemini-3-flash-preview',
        },
        'test-session'
      );

      expect(systemPrompt).toContain('MEMORY & EVICTION RULES (CRITICAL)');
      expect(systemPrompt).toContain('The "Amnesia" Warning');
      expect(systemPrompt).toContain('Distill Before Dying');
      expect(systemPrompt).toContain('Context Grooming');
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
      expect(assistantEvent.content.parts[1].functionCall.name).toBe(
        'read_file'
      );

      // Event 2: Tool response with tag should be a tombstone
      const toolEvent = mockSession.events[2];
      expect(
        toolEvent.content.parts[0].functionResponse.response.result
      ).toContain(resultSummary);
    });
  });

  describe('SigmaTaskUpdate Validation Gate', () => {
    it('should throw error when task completed without summary', async () => {
      const tools = getCognitionTools();
      const sigmaTool = tools.find(
        (t: { name: string }) => t.name === 'SigmaTaskUpdate'
      );
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
      const tools = getCognitionTools(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { onTaskCompleted, anchorId: 'test', provider: 'gemini' }
      );
      const sigmaTool = tools.find(
        (t: { name: string }) => t.name === 'SigmaTaskUpdate'
      );
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

  describe('Active Context Loading', () => {
    it('should load active_context.md into the instruction when it exists', async () => {
      const { LlmAgent } = await import('@google/adk');
      const activeContextContent =
        'Existing critical finding: API key is in config.ts';
      vi.mocked(fs.readFile).mockResolvedValue(activeContextContent);

      const generator = provider.executeAgent({
        prompt: 'test prompt',
        model: 'gemini-3-flash-preview',
        cwd: '/tmp/project',
        resumeSessionId: 'session-123',
      });

      // Consume until cognition_agent is created
      for await (const response of generator) {
        if (
          vi
            .mocked(LlmAgent)
            .mock.calls.some((c) => c[0].name === 'cognition_agent')
        ) {
          expect(response).toBeDefined();
          break;
        }
      }

      const cognitionAgentCall = vi
        .mocked(LlmAgent)
        .mock.calls.find((c) => c[0].name === 'cognition_agent');
      expect(cognitionAgentCall).toBeDefined();
      expect(cognitionAgentCall![0].instruction).toContain(
        'Long Term Working Memory'
      );
      expect(cognitionAgentCall![0].instruction).toContain(
        activeContextContent
      );
    });
  });
});
