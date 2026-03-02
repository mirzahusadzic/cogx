import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUnifiedTools } from '../../../tools/unified-tools.js';

// Mock tool executors
vi.mock('../../tool-executors.js', () => ({
  executeReadFile: vi.fn(),
  executeWriteFile: vi.fn(),
  executeGlob: vi.fn(),
  executeGrep: vi.fn(),
  executeBash: vi.fn(),
  executeEditFile: vi.fn(),
  executeSigmaTaskUpdate: vi.fn().mockResolvedValue('Tasks updated'),
}));

describe('SigmaTaskUpdate Gemini Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const context = {
    cwd: process.cwd(),
    projectRoot: process.cwd(),
    agentId: 'agent-1',
    anchorId: 'session-1',
    workbenchUrl: 'http://localhost:3000',
  };

  it('should clean null values from todos before execution', async () => {
    const tools = getUnifiedTools(context, 'gemini');

    const sigmaTaskUpdate = tools.find(
      (t) => (t as { name: string }).name === 'SigmaTaskUpdate'
    ) as unknown as {
      runAsync: (opts: {
        args: Record<string, unknown>;
        toolContext: unknown;
      }) => Promise<void>;
    };
    expect(sigmaTaskUpdate).toBeDefined();

    const { executeSigmaTaskUpdate } = await import('../../tool-executors.js');

    const rawInput = {
      todos: [
        {
          id: 'task-1',
          content: 'Do something',
          activeForm: 'Doing something',
          status: 'pending',
          acceptance_criteria: null,
          delegated_to: null,
        },
      ],
    };

    await sigmaTaskUpdate.runAsync({
      args: rawInput as Record<string, unknown>,
      toolContext: {},
    });

    expect(executeSigmaTaskUpdate).toHaveBeenCalledWith(
      [
        {
          id: 'task-1',
          content: 'Do something',
          activeForm: 'Doing something',
          status: 'pending',
        },
      ],
      process.cwd(),
      'session-1'
    );
  });

  it('should handle top-level null grounding by not adding grounding property if no match found', async () => {
    const tools = getUnifiedTools(context, 'gemini');

    const sigmaTaskUpdate = tools.find(
      (t) => (t as { name: string }).name === 'SigmaTaskUpdate'
    ) as unknown as {
      runAsync: (opts: {
        args: Record<string, unknown>;
        toolContext: unknown;
      }) => Promise<void>;
    };
    const { executeSigmaTaskUpdate } = await import('../../tool-executors.js');

    const rawInput = {
      todos: [
        {
          id: 'task-3',
          content: 'Null grounding',
          activeForm: 'Null grounding',
          status: 'completed',
          result_summary:
            'I have successfully completed this very important task for grounding',
        },
      ],
      grounding: [
        {
          id: 'task-non-existent',
          strategy: 'pgc_first',
          evidence_required: true,
        },
      ],
    };

    await sigmaTaskUpdate.runAsync({
      args: rawInput as Record<string, unknown>,
      toolContext: {},
    });

    expect(executeSigmaTaskUpdate).toHaveBeenCalledWith(
      [
        {
          id: 'task-3',
          content: 'Null grounding',
          activeForm: 'Null grounding',
          status: 'completed',
          result_summary:
            'I have successfully completed this very important task for grounding',
        },
      ],
      process.cwd(),
      'session-1'
    );
  });

  it('should correctly merge top-level grounding and grounding_evidence into todos', async () => {
    const tools = getUnifiedTools(context, 'gemini');

    const sigmaTaskUpdate = tools.find(
      (t) => (t as { name: string }).name === 'SigmaTaskUpdate'
    ) as unknown as {
      runAsync: (opts: {
        args: Record<string, unknown>;
        toolContext: unknown;
      }) => Promise<void>;
    };
    const { executeSigmaTaskUpdate } = await import('../../tool-executors.js');

    const rawInput = {
      todos: [
        {
          id: 'task-4',
          content: 'Perform a grounded task',
          activeForm: 'Performing a grounded task',
          status: 'in_progress',
        },
        {
          id: 'task-5',
          content: 'Review evidence',
          activeForm: 'Reviewing evidence',
          status: 'completed',
          result_summary:
            'I have successfully completed this very important task for grounding',
        },
      ],
      grounding: [
        {
          id: 'task-4',
          strategy: 'pgc_first',
          evidence_required: true,
          query_hints: ['new feature', 'user auth'],
        },
      ],
      grounding_evidence: [
        {
          id: 'task-5',
          queries_executed: ['search for old auth flow'],
          overlays_consulted: ['O1', 'O2'],
          citations: [
            {
              overlay: 'O1',
              content: 'Auth flow details...',
              relevance: 'high',
              file_path: '/src/auth/service.ts',
            },
          ],
          grounding_confidence: 'high',
        },
      ],
    };

    await sigmaTaskUpdate.runAsync({
      args: rawInput as Record<string, unknown>,
      toolContext: {},
    });

    expect(executeSigmaTaskUpdate).toHaveBeenCalledWith(
      [
        {
          id: 'task-4',
          content: 'Perform a grounded task',
          activeForm: 'Performing a grounded task',
          status: 'in_progress',
          grounding: {
            strategy: 'pgc_first',
            evidence_required: true,
            query_hints: ['new feature', 'user auth'],
          },
        },
        {
          id: 'task-5',
          content: 'Review evidence',
          activeForm: 'Reviewing evidence',
          status: 'completed',
          result_summary:
            'I have successfully completed this very important task for grounding',
          grounding_evidence: {
            queries_executed: ['search for old auth flow'],
            overlays_consulted: ['O1', 'O2'],
            citations: [
              {
                overlay: 'O1',
                content: 'Auth flow details...',
                relevance: 'high',
                file_path: '/src/auth/service.ts',
              },
            ],
            grounding_confidence: 'high',
          },
        },
      ],
      process.cwd(),
      'session-1'
    );
  });

  it('should allow partial updates (omitting content/activeForm) without adding undefined', async () => {
    const tools = getUnifiedTools(context, 'gemini');

    const sigmaTaskUpdate = tools.find(
      (t) => (t as { name: string }).name === 'SigmaTaskUpdate'
    ) as unknown as {
      runAsync: (opts: {
        args: Record<string, unknown>;
        toolContext: unknown;
      }) => Promise<void>;
    };
    const { executeSigmaTaskUpdate } = await import('../../tool-executors.js');

    const rawInput = {
      todos: [
        {
          id: 'task-partial',
          status: 'completed',
          result_summary: 'Partial update summary',
        },
      ],
    };

    await sigmaTaskUpdate.runAsync({
      args: rawInput as Record<string, unknown>,
      toolContext: {},
    });

    const mockedExecute = vi.mocked(executeSigmaTaskUpdate);
    const calledArgs = mockedExecute.mock.calls[0][0];
    expect(calledArgs[0]).toEqual({
      id: 'task-partial',
      status: 'completed',
      result_summary: 'Partial update summary',
    });
    // Ensure no undefined keys were added
    expect(calledArgs[0]).not.toHaveProperty('content');
    expect(calledArgs[0]).not.toHaveProperty('activeForm');
  });
});
