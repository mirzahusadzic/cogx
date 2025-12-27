import { describe, it, expect, vi } from 'vitest';
import { getCognitionTools } from '../gemini-adk-tools.js';

// Mock tool executors
vi.mock('../tool-executors.js', () => ({
  executeReadFile: vi.fn(),
  executeWriteFile: vi.fn(),
  executeGlob: vi.fn(),
  executeGrep: vi.fn(),
  executeBash: vi.fn(),
  executeEditFile: vi.fn(),
  executeSigmaTaskUpdate: vi.fn().mockResolvedValue('Tasks updated'),
}));

describe('SigmaTaskUpdate Gemini Tool', () => {
  it('should clean null values from todos before execution', async () => {
    const tools = getCognitionTools(
      undefined, // conversationRegistry
      'http://localhost:3000', // workbenchUrl
      undefined, // onCanUseTool
      undefined, // getTaskManager
      undefined, // getMessagePublisher
      undefined, // getMessageQueue
      process.cwd(), // projectRoot
      'agent-1', // currentAgentId
      { provider: 'gemini', anchorId: 'session-1' }
    );

    const sigmaTaskUpdate = tools.find((t) => t.name === 'SigmaTaskUpdate');
    expect(sigmaTaskUpdate).toBeDefined();

    const { executeSigmaTaskUpdate } = await import('../tool-executors.js');

    const rawInput = {
      todos: [
        {
          id: 'task-1',
          content: 'Do something',
          activeForm: 'Doing something',
          status: 'pending',
          acceptance_criteria: null, // Gemini 2.5 Flash might send this
          delegated_to: null,
        },
      ],
    };

    // @ts-expect-error - calling private/internal runAsync logic via execute if possible,
    // but getCognitionTools returns FunctionTool which has execute property in options passed to constructor
    // In our implementation, we define it in the constructor. ADK FunctionTool stores it in this.execute.
    // However, FunctionTool.runAsync is what we should call to simulate a real call.

    await sigmaTaskUpdate!.runAsync({
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
          // acceptance_criteria and delegated_to should be removed
        },
      ],
      process.cwd(),
      'session-1'
    );
  });
});
