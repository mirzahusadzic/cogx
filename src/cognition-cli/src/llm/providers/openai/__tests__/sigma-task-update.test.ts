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

describe('SigmaTaskUpdate OpenAI Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const context = {
    cwd: process.cwd(),
    anchorId: 'session-1',
    agentId: 'agent-1',
    projectRoot: process.cwd(),
    workbenchUrl: 'http://localhost:3000',
  };

  it('should correctly merge top-level grounding and grounding_evidence into todos', async () => {
    const tools = getUnifiedTools(context, 'openai');

    const sigmaTaskUpdate = tools.find(
      (t) => (t as { name: string }).name === 'SigmaTaskUpdate'
    ) as unknown as {
      invoke: (ctx: unknown, input: string) => Promise<unknown>;
    };
    expect(sigmaTaskUpdate).toBeDefined();

    const { executeSigmaTaskUpdate } = await import('../../tool-executors.js');

    const rawInput = {
      todos: [
        {
          id: 'task-1',
          content: 'Perform a grounded task',
          activeForm: 'Performing a grounded task',
          status: 'in_progress',
          acceptance_criteria: null,
          delegated_to: null,
          context: null,
          delegate_session_id: null,
          result_summary: null,
        },
        {
          id: 'task-2',
          content: 'Review evidence',
          activeForm: 'Reviewing evidence',
          status: 'completed',
          result_summary:
            'I have successfully completed this very important task for grounding',
          acceptance_criteria: null,
          delegated_to: null,
          context: null,
          delegate_session_id: null,
        },
      ],
      grounding: [
        {
          id: 'task-1',
          strategy: 'pgc_first',
          evidence_required: true,
          query_hints: ['new feature', 'user auth'],
          overlay_hints: null,
        },
      ],
      grounding_evidence: [
        {
          id: 'task-2',
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
          overlay_warnings: null,
        },
      ],
    };

    // OpenAI tool uses invoke(context, inputString)
    await (
      sigmaTaskUpdate as {
        invoke: (ctx: unknown, input: string) => Promise<unknown>;
      }
    ).invoke({} as unknown, JSON.stringify(rawInput));

    expect(executeSigmaTaskUpdate).toHaveBeenCalledWith(
      [
        {
          id: 'task-1',
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
          id: 'task-2',
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

  it('should handle null values in todos by cleaning them', async () => {
    const tools = getUnifiedTools(context, 'openai');
    const sigmaTaskUpdate = tools.find(
      (t) => (t as { name: string }).name === 'SigmaTaskUpdate'
    ) as unknown as {
      invoke: (ctx: unknown, input: string) => Promise<unknown>;
    };
    const { executeSigmaTaskUpdate } = await import('../../tool-executors.js');

    const rawInput = {
      todos: [
        {
          id: 'task-3',
          content: 'Task with nulls',
          activeForm: 'Tasking with nulls',
          status: 'pending',
          acceptance_criteria: null,
          delegated_to: null,
          context: null,
          delegate_session_id: null,
          result_summary: null,
        },
      ],
      grounding: null,
      grounding_evidence: null,
    };

    await (
      sigmaTaskUpdate as {
        invoke: (ctx: unknown, input: string) => Promise<unknown>;
      }
    ).invoke({} as unknown, JSON.stringify(rawInput));

    expect(executeSigmaTaskUpdate).toHaveBeenCalledWith(
      [
        {
          id: 'task-3',
          content: 'Task with nulls',
          activeForm: 'Tasking with nulls',
          status: 'pending',
        },
      ],
      process.cwd(),
      'session-1'
    );
  });
});
