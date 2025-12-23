/**
 * Tests for background-tasks-tool.ts
 *
 * Unit tests for the MCP tool that queries background task status.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BackgroundTask } from '../../services/BackgroundTaskManager.js';

// Import after mocking
import { createBackgroundTasksMcpServer } from '../background-tasks-tool.js';

describe('createBackgroundTasksMcpServer', () => {
  // Mock SDK
  let mockToolFn: ReturnType<typeof vi.fn>;
  let mockCreateSdkMcpServer: ReturnType<typeof vi.fn>;
  let claudeAgentSdk: {
    tool: typeof mockToolFn;
    createSdkMcpServer: typeof mockCreateSdkMcpServer;
  };
  let registeredTools: Map<
    string,
    {
      name: string;
      description: string;
      action: (args: unknown) => Promise<unknown>;
    }
  >;

  // Mock task manager
  let mockTaskManager: {
    getAllTasks: ReturnType<typeof vi.fn>;
    getActiveTask: ReturnType<typeof vi.fn>;
    getSummary: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    registeredTools = new Map();

    // Mock tool function
    mockToolFn = vi.fn(
      (
        name: string,
        description: string,
        _schema: unknown,
        action: (args: unknown) => Promise<unknown>
      ) => {
        const toolObj = { name, description, action };
        registeredTools.set(name, toolObj);
        return toolObj;
      }
    );

    mockCreateSdkMcpServer = vi.fn((config) => ({
      ...config,
      _isMcpServer: true,
    }));

    claudeAgentSdk = {
      tool: mockToolFn,
      createSdkMcpServer: mockCreateSdkMcpServer,
    };

    // Mock task manager
    mockTaskManager = {
      getAllTasks: vi.fn().mockReturnValue([]),
      getActiveTask: vi.fn().mockReturnValue(null),
      getSummary: vi.fn().mockReturnValue({
        total: 0,
        active: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      }),
    };
  });

  describe('initialization', () => {
    it('should return undefined if claudeAgentSdk is undefined', () => {
      const result = createBackgroundTasksMcpServer(
        () => mockTaskManager,
        undefined
      );

      expect(result).toBeUndefined();
    });

    it('should return MCP server with correct metadata', () => {
      const result = createBackgroundTasksMcpServer(
        () => mockTaskManager,
        claudeAgentSdk
      );

      expect(result).toBeDefined();
      expect(mockCreateSdkMcpServer).toHaveBeenCalledWith({
        name: 'background-tasks',
        version: '1.0.0',
        tools: expect.any(Array),
      });
    });

    it('should register get_background_tasks tool', () => {
      createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

      expect(registeredTools.size).toBe(1);
      expect(registeredTools.has('get_background_tasks')).toBe(true);
    });
  });

  describe('get_background_tasks tool', () => {
    describe('when manager is not initialized', () => {
      it('should return appropriate message', async () => {
        createBackgroundTasksMcpServer(() => null, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({})) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain(
          'Background task manager not initialized'
        );
      });
    });

    describe('filtering', () => {
      const createTasks = (): BackgroundTask[] => [
        {
          id: 'task-1',
          type: 'genesis',
          status: 'running',
          progress: 50,
          startedAt: new Date('2024-01-01T00:00:00Z'),
          message: 'Analyzing files...',
        },
        {
          id: 'task-2',
          type: 'genesis',
          status: 'pending',
          startedAt: new Date('2024-01-01T00:01:00Z'),
        },
        {
          id: 'task-3',
          type: 'overlay',
          overlay: 'invariants',
          status: 'completed',
          progress: 100,
          startedAt: new Date('2024-01-01T00:00:00Z'),
          completedAt: new Date('2024-01-01T00:05:00Z'),
        },
        {
          id: 'task-4',
          type: 'genesis-docs',
          status: 'failed',
          error: 'File not found',
          startedAt: new Date('2024-01-01T00:00:00Z'),
          completedAt: new Date('2024-01-01T00:02:00Z'),
        },
        {
          id: 'task-5',
          type: 'genesis',
          status: 'cancelled',
          startedAt: new Date('2024-01-01T00:00:00Z'),
          completedAt: new Date('2024-01-01T00:01:00Z'),
        },
      ];

      beforeEach(() => {
        mockTaskManager.getAllTasks.mockReturnValue(createTasks());
        mockTaskManager.getSummary.mockReturnValue({
          total: 5,
          active: 2,
          completed: 1,
          failed: 1,
          cancelled: 1,
        });
      });

      it('should return all tasks by default', async () => {
        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({})) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('5 total tasks');
      });

      it('should filter active tasks (running + pending)', async () => {
        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({ filter: 'active' })) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('Active Tasks');
        expect(result.content[0].text).toContain('(2)');
      });

      it('should filter completed tasks', async () => {
        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({ filter: 'completed' })) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('Completed Tasks');
        expect(result.content[0].text).toContain('(1)');
      });

      it('should filter failed tasks (failed + cancelled)', async () => {
        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({ filter: 'failed' })) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('Failed Tasks');
        expect(result.content[0].text).toContain('(2)');
      });
    });

    describe('active task display', () => {
      it('should show no active tasks message when idle', async () => {
        mockTaskManager.getActiveTask.mockReturnValue(null);

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({})) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('**No active tasks**');
        expect(result.content[0].text).toContain('idle');
      });

      it('should show active task with progress', async () => {
        const activeTask: BackgroundTask = {
          id: 'task-1',
          type: 'genesis',
          status: 'running',
          progress: 67,
          message: 'Processing src/index.ts',
          startedAt: new Date(),
        };
        mockTaskManager.getActiveTask.mockReturnValue(activeTask);

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({})) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('**Active Task**');
        expect(result.content[0].text).toContain('(67%)');
        expect(result.content[0].text).toContain('Processing src/index.ts');
      });

      it('should handle undefined progress', async () => {
        const activeTask: BackgroundTask = {
          id: 'task-1',
          type: 'genesis',
          status: 'running',
          startedAt: new Date(),
        };
        mockTaskManager.getActiveTask.mockReturnValue(activeTask);

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({})) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('**Active Task**');
        expect(result.content[0].text).not.toContain('%');
      });
    });

    describe('task type formatting', () => {
      it('should format genesis type', async () => {
        const task: BackgroundTask = {
          id: 'task-1',
          type: 'genesis',
          status: 'running',
          startedAt: new Date(),
        };
        mockTaskManager.getAllTasks.mockReturnValue([task]);
        mockTaskManager.getActiveTask.mockReturnValue(task);

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({})) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('Genesis (code analysis)');
      });

      it('should format genesis-docs type', async () => {
        const task: BackgroundTask = {
          id: 'task-1',
          type: 'genesis-docs',
          status: 'running',
          startedAt: new Date(),
        };
        mockTaskManager.getAllTasks.mockReturnValue([task]);
        mockTaskManager.getActiveTask.mockReturnValue(task);

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({})) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('Document Ingestion');
      });

      it('should format overlay type with overlay name', async () => {
        const task: BackgroundTask = {
          id: 'task-1',
          type: 'overlay',
          overlay: 'invariants',
          status: 'running',
          startedAt: new Date(),
        };
        mockTaskManager.getAllTasks.mockReturnValue([task]);
        mockTaskManager.getActiveTask.mockReturnValue(task);

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({})) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain(
          'invariants Overlay Generation'
        );
      });

      it('should format overlay type without overlay name', async () => {
        const task: BackgroundTask = {
          id: 'task-1',
          type: 'overlay',
          status: 'running',
          startedAt: new Date(),
        };
        mockTaskManager.getAllTasks.mockReturnValue([task]);
        mockTaskManager.getActiveTask.mockReturnValue(task);

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({})) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('Overlay Generation');
      });
    });

    describe('duration formatting', () => {
      it('should format duration in milliseconds', async () => {
        const start = new Date('2024-01-01T00:00:00.000Z');
        const end = new Date('2024-01-01T00:00:00.500Z'); // 500ms later

        const task: BackgroundTask = {
          id: 'task-1',
          type: 'genesis',
          status: 'completed',
          progress: 100,
          startedAt: start,
          completedAt: end,
        };
        mockTaskManager.getAllTasks.mockReturnValue([task]);

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({ filter: 'completed' })) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('500ms');
      });

      it('should format duration in seconds', async () => {
        const start = new Date('2024-01-01T00:00:00.000Z');
        const end = new Date('2024-01-01T00:00:30.000Z'); // 30s later

        const task: BackgroundTask = {
          id: 'task-1',
          type: 'genesis',
          status: 'completed',
          progress: 100,
          startedAt: start,
          completedAt: end,
        };
        mockTaskManager.getAllTasks.mockReturnValue([task]);

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({ filter: 'completed' })) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('30.0s');
      });

      it('should format duration in minutes', async () => {
        const start = new Date('2024-01-01T00:00:00.000Z');
        const end = new Date('2024-01-01T00:05:00.000Z'); // 5 minutes later

        const task: BackgroundTask = {
          id: 'task-1',
          type: 'genesis',
          status: 'completed',
          progress: 100,
          startedAt: start,
          completedAt: end,
        };
        mockTaskManager.getAllTasks.mockReturnValue([task]);

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({ filter: 'completed' })) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('5.0m');
      });

      it('should format duration in hours', async () => {
        const start = new Date('2024-01-01T00:00:00.000Z');
        const end = new Date('2024-01-01T02:00:00.000Z'); // 2 hours later

        const task: BackgroundTask = {
          id: 'task-1',
          type: 'genesis',
          status: 'completed',
          progress: 100,
          startedAt: start,
          completedAt: end,
        };
        mockTaskManager.getAllTasks.mockReturnValue([task]);

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({ filter: 'completed' })) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('2.0h');
      });
    });

    describe('error display', () => {
      it('should show error message for failed tasks', async () => {
        const task: BackgroundTask = {
          id: 'task-1',
          type: 'genesis',
          status: 'failed',
          error: 'Permission denied',
          startedAt: new Date(),
          completedAt: new Date(),
        };
        mockTaskManager.getAllTasks.mockReturnValue([task]);
        mockTaskManager.getSummary.mockReturnValue({
          total: 1,
          active: 0,
          completed: 0,
          failed: 1,
          cancelled: 0,
        });

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({ filter: 'failed' })) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('Error: Permission denied');
      });
    });

    describe('summary display', () => {
      it('should show task counts', async () => {
        mockTaskManager.getSummary.mockReturnValue({
          total: 10,
          active: 2,
          completed: 5,
          failed: 2,
          cancelled: 1,
        });

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({})) as {
          content: { type: string; text: string }[];
        };

        expect(result.content[0].text).toContain('**Summary**: 10 total tasks');
        expect(result.content[0].text).toContain('Active: 2');
        expect(result.content[0].text).toContain('Completed: 5');
        expect(result.content[0].text).toContain('Failed: 2');
        expect(result.content[0].text).toContain('Cancelled: 1');
      });
    });

    describe('error handling', () => {
      it('should catch and return error response', async () => {
        mockTaskManager.getAllTasks.mockImplementation(() => {
          throw new Error('Database connection failed');
        });

        createBackgroundTasksMcpServer(() => mockTaskManager, claudeAgentSdk);

        const tool = registeredTools.get('get_background_tasks')!;
        const result = (await tool.action({})) as {
          content: { type: string; text: string }[];
          isError: boolean;
        };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Database connection failed');
      });
    });
  });
});
