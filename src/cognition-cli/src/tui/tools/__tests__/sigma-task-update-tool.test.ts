import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockToolExecutor } = vi.hoisted(() => ({
  mockToolExecutor: vi.fn().mockResolvedValue('Task list updated'),
}));

vi.mock('../../../llm/core/utils/tool-executors.js', () => ({
  executeSigmaTaskUpdate: mockToolExecutor,
}));

import {
  createSigmaTaskUpdateMcpServer,
  type ClaudeAgentSdk,
} from '../sigma-task-update-tool.js';

interface SigmaTaskUpdateToolArgs {
  todos: Array<{
    id: string;
    content: string;
    status: string;
    activeForm: string;
    acceptance_criteria?: string[];
    delegated_to?: string;
    context?: string;
    delegate_session_id?: string;
    result_summary?: string;
  }>;
  grounding?: Array<{
    id: string;
    strategy: 'pgc_first' | 'pgc_verify' | 'pgc_cite' | 'none';
    overlay_hints?: Array<
      'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'
    > | null;
    query_hints?: string[] | null;
    evidence_required?: boolean | string | null;
  }> | null;
  grounding_evidence?: Array<{
    id: string;
    queries_executed: string[];
    overlays_consulted: Array<'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'>;
    citations: Array<{
      overlay: string;
      content: string;
      relevance: string;
      file_path?: string;
    }>;
    grounding_confidence: 'high' | 'medium' | 'low';
    overlay_warnings?: string[] | null;
  }> | null;
}

interface SigmaTaskUpdateActionResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

interface MockMcpServerInstance {
  tools: Array<{
    action: (
      args: SigmaTaskUpdateToolArgs
    ) => Promise<SigmaTaskUpdateActionResult>;
  }>;
}

describe('SigmaTaskUpdateTool', () => {
  const cwd = '/tmp';
  const anchorId = 'test-anchor';

  const mockSdk: ClaudeAgentSdk = {
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
      mockSdk
    ) as MockMcpServerInstance;
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
    const server = createSigmaTaskUpdateMcpServer(
      cwd,
      anchorId,
      mockSdk
    ) as MockMcpServerInstance;
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

  it('should correctly merge top-level grounding and grounding_evidence into todos', async () => {
    const server = createSigmaTaskUpdateMcpServer(
      cwd,
      anchorId,
      mockSdk
    ) as MockMcpServerInstance;
    const toolAction = server.tools[0].action;

    await toolAction({
      todos: [
        {
          id: 'task-1',
          content: 'Perform a grounded task',
          activeForm: 'Performing a grounded task',
          status: 'in_progress',
        },
        {
          id: 'task-2',
          content: 'Review evidence',
          activeForm: 'Reviewing evidence',
          status: 'completed',
        },
      ],
      grounding: [
        {
          id: 'task-1',
          strategy: 'pgc_first',
          evidence_required: true,
          query_hints: ['hint1'],
        },
      ],
      grounding_evidence: [
        {
          id: 'task-2',
          queries_executed: ['q1'],
          overlays_consulted: ['O1'],
          citations: [
            {
              overlay: 'O1',
              content: 'content',
              relevance: 'high',
              file_path: 'file.ts',
            },
          ],
          grounding_confidence: 'high',
        },
      ],
    });

    expect(mockToolExecutor).toHaveBeenCalledWith(
      [
        {
          id: 'task-1',
          content: 'Perform a grounded task',
          activeForm: 'Performing a grounded task',
          status: 'in_progress',
          grounding: {
            strategy: 'pgc_first',
            evidence_required: true,
            query_hints: ['hint1'],
          },
        },
        {
          id: 'task-2',
          content: 'Review evidence',
          activeForm: 'Reviewing evidence',
          status: 'completed',
          grounding_evidence: {
            queries_executed: ['q1'],
            overlays_consulted: ['O1'],
            citations: [
              {
                overlay: 'O1',
                content: 'content',
                relevance: 'high',
                file_path: 'file.ts',
              },
            ],
            grounding_confidence: 'high',
          },
        },
      ],
      cwd,
      anchorId
    );
  });

  it('should handle null values in grounding hints by omitting them', async () => {
    const server = createSigmaTaskUpdateMcpServer(
      cwd,
      anchorId,
      mockSdk
    ) as MockMcpServerInstance;
    const toolAction = server.tools[0].action;

    await toolAction({
      todos: [
        {
          id: 'task-3',
          content: 'Null grounding',
          activeForm: 'Null grounding',
          status: 'pending',
        },
      ],
      grounding: [
        {
          id: 'task-3',
          strategy: 'pgc_cite',
          overlay_hints: null, // explicit null
          query_hints: null, // explicit null
          evidence_required: null, // explicit null
        },
      ],
    });

    expect(mockToolExecutor).toHaveBeenCalledWith(
      [
        {
          id: 'task-3',
          content: 'Null grounding',
          activeForm: 'Null grounding',
          status: 'pending',
          grounding: {
            strategy: 'pgc_cite',
            // fields should be missing/undefined, not null
          },
        },
      ],
      cwd,
      anchorId
    );
  });
});
