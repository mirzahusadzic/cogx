import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeMinimaxTool } from '../agent-tools.js';
import { executeSigmaTaskUpdate } from '../../tool-executors.js';

vi.mock('../../tool-executors.js', () => ({
  executeSigmaTaskUpdate: vi.fn().mockResolvedValue('Task list updated'),
  executeReadFile: vi.fn(),
  executeWriteFile: vi.fn(),
  executeGlob: vi.fn(),
  executeGrep: vi.fn(),
  executeBash: vi.fn(),
  executeEditFile: vi.fn(),
  executeFetchUrl: vi.fn(),
  executeWebSearch: vi.fn(),
}));

describe('Minimax Tool Execution - SigmaTaskUpdate', () => {
  const mockContext = {
    cwd: '/test/cwd',
    anchorId: 'test-anchor',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process SigmaTaskUpdate correctly', async () => {
    const input = {
      todos: [
        {
          id: 'task-1',
          content: 'Test task',
          status: 'completed',
          result_summary: 'This is a valid summary of the task findings.',
        },
      ],
    };

    const result = await executeMinimaxTool(
      'SigmaTaskUpdate',
      input,
      mockContext as never
    );

    expect(executeSigmaTaskUpdate).toHaveBeenCalled();
    expect(result).toContain('Task list updated');
  });

  it('should throw error if result_summary is missing for completed task', async () => {
    const input = {
      todos: [
        {
          id: 'task-1',
          content: 'Test task',
          status: 'completed',
        },
      ],
    };

    // The validation happens in processSigmaTaskUpdateInput which is called by executeMinimaxTool
    const result = await executeMinimaxTool(
      'SigmaTaskUpdate',
      input,
      mockContext as never
    );
    expect(result).toContain('Error');
    expect(result).toContain('result_summary');
  });
});
