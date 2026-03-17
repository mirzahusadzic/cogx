import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FunctionTool, type ToolContext } from '@google/adk';
import { AsyncMutex } from '../../../sigma/utils/AsyncMutex.js';

// Mock the executors BEFORE importing getUnifiedTools
vi.mock('../../core/utils/tool-executors.js', () => ({
  executeReadFile: vi.fn(),
  executeWriteFile: vi.fn(),
  executeGlob: vi.fn(),
  executeGrep: vi.fn(),
  executeBash: vi.fn(),
  executeEditFile: vi.fn(),
  executeFetchUrl: vi.fn(),
  executeWebSearch: vi.fn(),
  executeSigmaTaskUpdate: vi.fn(),
}));

import { getUnifiedTools, UnifiedToolsContext } from '../unified-tools.js';
import * as executors from '../../core/utils/tool-executors.js';

describe('Tool Mutex Concurrency & Heartbeats', () => {
  let context: UnifiedToolsContext;
  const onToolOutput = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    onToolOutput.mockClear();
    vi.mocked(executors.executeReadFile).mockClear();
    vi.mocked(executors.executeWriteFile).mockClear();

    context = {
      cwd: '/test',
      toolMutex: new AsyncMutex(),
      onToolOutput,
    } as unknown as UnifiedToolsContext;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should serialize concurrent tool executions and emit heartbeats', async () => {
    const executionOrder: string[] = [];

    // Setup mocks
    vi.mocked(executors.executeReadFile).mockImplementation(async () => {
      executionOrder.push('readFile-start');
      await Promise.resolve();
      executionOrder.push('readFile-end');
      return 'read success';
    });

    vi.mocked(executors.executeWriteFile).mockImplementation(async () => {
      executionOrder.push('writeFile-start');
      await Promise.resolve();
      executionOrder.push('writeFile-end');
      return 'write success';
    });

    const tools = getUnifiedTools(context, 'gemini');
    // For gemini, tools are returned in a specific format. Let's find them by name.
    const readFileTool = tools.find(
      (t) => (t as FunctionTool).name === 'read_file'
    ) as FunctionTool;
    const writeFileTool = tools.find(
      (t) => (t as FunctionTool).name === 'write_file'
    ) as FunctionTool;

    if (
      !readFileTool ||
      !writeFileTool ||
      !readFileTool.execute ||
      !writeFileTool.execute
    ) {
      throw new Error('Tools not found');
    }

    // Start both concurrently
    const p1 = readFileTool.execute({ file_path: 'file1.txt' }, {
      functionCallId: 'call1',
    } as unknown as ToolContext);
    const p2 = writeFileTool.execute(
      { file_path: 'file2.txt', content: 'hello' },
      { functionCallId: 'call2' } as unknown as ToolContext
    );

    // Let the async code reach the tool execution (and the mutex wait)
    // We need multiple ticks because of the nested async calls in sequentialExecutor
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Advance time to trigger heartbeats
    vi.advanceTimersByTime(15000);

    expect(onToolOutput).toHaveBeenCalledWith({ type: 'heartbeat' }, 'call1');
    expect(onToolOutput).toHaveBeenCalledWith({ type: 'heartbeat' }, 'call2');

    // Wait for everything to finish
    await Promise.all([p1, p2]);

    // Verify sequential execution: p2 should only start after p1 ends
    expect(executionOrder).toEqual([
      'readFile-start',
      'readFile-end',
      'writeFile-start',
      'writeFile-end',
    ]);
  });
});
