import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockToolExecutor } = vi.hoisted(() => ({
  mockToolExecutor: vi.fn().mockResolvedValue('Task list updated'),
}));

vi.mock('../../llm/providers/tool-executors.js', () => ({
  executeSigmaTaskUpdate: mockToolExecutor,
}));

import { createSigmaTaskUpdateMcpServer } from '../sigma-task-update-tool.js';

describe('SigmaTaskUpdateTool', () => {
  const cwd = '/tmp';
  const anchorId = 'test-anchor';

  const mockSdk = {
    tool: vi
      .fn()
      .mockImplementation((name, desc, schema, action) => ({ name, action })),
    createSdkMcpServer: vi.fn().mockImplementation((config) => config),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return undefined if SDK is missing', () => {
    expect(
      createSigmaTaskUpdateMcpServer(cwd, anchorId, undefined)
    ).toBeUndefined();
  });

  it('should create MCP server with SigmaTaskUpdate tool', () => {
    const server = createSigmaTaskUpdateMcpServer(
      cwd,
      anchorId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock SDK
      mockSdk as any
    );

    expect(server).toBeDefined();
    expect(mockSdk.tool).toHaveBeenCalledWith(
      'SigmaTaskUpdate',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(mockSdk.createSdkMcpServer).toHaveBeenCalled();
  });

  it('should validate delegation requirements in tool action', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing internal tools
    const server: any = createSigmaTaskUpdateMcpServer(
      cwd,
      anchorId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock SDK
      mockSdk as any
    );
    const toolAction = server.tools[0].action;

    // Test missing acceptance criteria for delegated task
    const result = await toolAction({
      todos: [
        {
          id: 't1',
          content: 'delegated task',
          activeForm: 'delegating',
          status: 'delegated',
          delegated_to: 'agent1',
        },
      ],
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("missing 'acceptance_criteria'");

    // Test missing delegated_to for delegated task
    const result2 = await toolAction({
      todos: [
        {
          id: 't1',
          content: 'delegated task',
          activeForm: 'delegating',
          status: 'delegated',
          acceptance_criteria: ['done'],
        },
      ],
    });

    expect(result2.isError).toBe(true);
    expect(result2.content[0].text).toContain("missing 'delegated_to'");
  });

  it('should call executor and return success message', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing internal tools
    const server: any = createSigmaTaskUpdateMcpServer(
      cwd,
      anchorId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock SDK
      mockSdk as any
    );
    const toolAction = server.tools[0].action;

    await toolAction({
      todos: [
        {
          id: 't1',
          content: 'test task',
          activeForm: 'testing',
          status: 'in_progress',
        },
      ],
    });

    expect(mockToolExecutor).toHaveBeenCalled();
  });
});
