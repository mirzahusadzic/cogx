/**
 * Tests for useBackgroundTaskManager hook
 *
 * Tests React hook wrapper around BackgroundTaskManager for TUI components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the BackgroundTaskManager
const mockGetAllTasks = vi.fn();
const mockGetActiveTask = vi.fn();
const mockGetSummary = vi.fn();
const mockStartGenesis = vi.fn();
const mockStartGenesisDocs = vi.fn();
const mockStartOverlay = vi.fn();
const mockCancelTask = vi.fn();
const mockClearHistory = vi.fn();
const mockOnTaskUpdate = vi.fn();
const mockOnTaskComplete = vi.fn();

const mockManager = {
  getAllTasks: mockGetAllTasks,
  getActiveTask: mockGetActiveTask,
  getSummary: mockGetSummary,
  startGenesis: mockStartGenesis,
  startGenesisDocs: mockStartGenesisDocs,
  startOverlay: mockStartOverlay,
  cancelTask: mockCancelTask,
  clearHistory: mockClearHistory,
  onTaskUpdate: mockOnTaskUpdate,
  onTaskComplete: mockOnTaskComplete,
};

vi.mock('../../../services/BackgroundTaskManager.js', () => ({
  BackgroundTaskManager: vi.fn(),
  getBackgroundTaskManager: vi.fn(() => mockManager),
}));

// Import after mocking
import { useBackgroundTaskManager } from '../../useBackgroundTaskManager.js';
import { getBackgroundTaskManager } from '../../../services/BackgroundTaskManager.js';

describe('useBackgroundTaskManager', () => {
  const defaultOptions = {
    projectRoot: '/test/project',
    workbenchUrl: 'http://localhost:8000',
    workbenchApiKey: 'test-key',
    debug: false,
  };

  let updateCallback: ((task: unknown) => void) | null = null;
  let completeCallback: ((task: unknown) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    updateCallback = null;
    completeCallback = null;

    // Reset the getBackgroundTaskManager mock to return mockManager
    (getBackgroundTaskManager as ReturnType<typeof vi.fn>).mockImplementation(
      () => mockManager
    );

    // Default mock implementations
    mockGetAllTasks.mockReturnValue([]);
    mockGetActiveTask.mockReturnValue(null);
    mockGetSummary.mockReturnValue({
      total: 0,
      active: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    });

    mockOnTaskUpdate.mockImplementation((callback: (task: unknown) => void) => {
      updateCallback = callback;
      return () => {
        updateCallback = null;
      };
    });

    mockOnTaskComplete.mockImplementation(
      (callback: (task: unknown) => void) => {
        completeCallback = callback;
        return () => {
          completeCallback = null;
        };
      }
    );

    mockStartGenesis.mockResolvedValue('task-genesis-1');
    mockStartGenesisDocs.mockResolvedValue('task-docs-1');
    mockStartOverlay.mockResolvedValue('task-overlay-1');
    mockCancelTask.mockReturnValue(true);
  });

  describe('initialization', () => {
    it('should initialize with empty tasks', () => {
      const { result } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      expect(result.current.tasks).toEqual([]);
      expect(result.current.activeTask).toBeNull();
    });

    it('should provide initial summary', () => {
      const { result } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      expect(result.current.summary).toEqual({
        total: 0,
        active: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      });
    });

    it('should subscribe to task updates', () => {
      renderHook(() => useBackgroundTaskManager(defaultOptions));

      expect(mockOnTaskUpdate).toHaveBeenCalled();
      expect(mockOnTaskComplete).toHaveBeenCalled();
    });

    it('should unsubscribe on unmount', () => {
      const unsubUpdate = vi.fn();
      const unsubComplete = vi.fn();

      mockOnTaskUpdate.mockReturnValue(unsubUpdate);
      mockOnTaskComplete.mockReturnValue(unsubComplete);

      const { unmount } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      unmount();

      expect(unsubUpdate).toHaveBeenCalled();
      expect(unsubComplete).toHaveBeenCalled();
    });
  });

  describe('task state updates', () => {
    it('should update tasks on task update event', async () => {
      const tasks = [
        { id: 'task-1', type: 'genesis', status: 'running', progress: 50 },
      ];
      mockGetAllTasks.mockReturnValue(tasks);
      mockGetActiveTask.mockReturnValue(tasks[0]);

      const { result } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      act(() => {
        if (updateCallback) {
          updateCallback(tasks[0]);
        }
      });

      await waitFor(() => {
        expect(result.current.tasks).toEqual(tasks);
        expect(result.current.activeTask).toEqual(tasks[0]);
      });
    });

    it('should update tasks on task complete event', async () => {
      const completedTask = {
        id: 'task-1',
        type: 'genesis',
        status: 'completed',
        progress: 100,
      };
      mockGetAllTasks.mockReturnValue([completedTask]);
      mockGetActiveTask.mockReturnValue(null);

      const { result } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      act(() => {
        if (completeCallback) {
          completeCallback(completedTask);
        }
      });

      await waitFor(() => {
        expect(result.current.tasks).toContainEqual(completedTask);
        expect(result.current.activeTask).toBeNull();
      });
    });
  });

  describe('startGenesis', () => {
    it('should start genesis operation', async () => {
      const { result } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      let taskId: string | undefined;
      await act(async () => {
        taskId = await result.current.startGenesis(['src', 'lib']);
      });

      expect(mockStartGenesis).toHaveBeenCalledWith(['src', 'lib']);
      expect(taskId).toBe('task-genesis-1');
    });

    it('should throw if manager not initialized', async () => {
      const { getBackgroundTaskManager } =
        await import('../../../services/BackgroundTaskManager.js');
      (getBackgroundTaskManager as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('Not initialized');
        }
      );

      const { result } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      // The hook catches init errors, so startGenesis should throw
      await expect(result.current.startGenesis(['src'])).rejects.toThrow(
        'BackgroundTaskManager not initialized'
      );
    });
  });

  describe('startGenesisDocs', () => {
    it('should start genesis:docs operation', async () => {
      const { result } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      let taskId: string | undefined;
      await act(async () => {
        taskId = await result.current.startGenesisDocs([
          'docs/VISION.md',
          'docs/SECURITY.md',
        ]);
      });

      expect(mockStartGenesisDocs).toHaveBeenCalledWith([
        'docs/VISION.md',
        'docs/SECURITY.md',
      ]);
      expect(taskId).toBe('task-docs-1');
    });
  });

  describe('startOverlay', () => {
    it('should start overlay generation', async () => {
      const { result } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      let taskId: string | undefined;
      await act(async () => {
        taskId = await result.current.startOverlay('structural_patterns');
      });

      expect(mockStartOverlay).toHaveBeenCalledWith('structural_patterns');
      expect(taskId).toBe('task-overlay-1');
    });
  });

  describe('cancelTask', () => {
    it('should cancel a task', async () => {
      const { result } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.getManager()).not.toBeNull();
      });

      let cancelled: boolean | undefined;
      act(() => {
        cancelled = result.current.cancelTask('task-1');
      });

      expect(mockCancelTask).toHaveBeenCalledWith('task-1');
      expect(cancelled).toBe(true);
    });

    it('should return false if cancel fails', async () => {
      mockCancelTask.mockReturnValue(false);

      const { result } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.getManager()).not.toBeNull();
      });

      let cancelled: boolean | undefined;
      act(() => {
        cancelled = result.current.cancelTask('nonexistent');
      });

      expect(cancelled).toBe(false);
    });
  });

  describe('clearHistory', () => {
    it('should clear completed/failed tasks', async () => {
      mockGetAllTasks
        .mockReturnValueOnce([
          { id: 'task-1', status: 'completed' },
          { id: 'task-2', status: 'failed' },
        ])
        .mockReturnValueOnce([]);

      const { result } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.getManager()).not.toBeNull();
      });

      act(() => {
        result.current.clearHistory();
      });

      expect(mockClearHistory).toHaveBeenCalled();
      expect(mockGetAllTasks).toHaveBeenCalled();
    });
  });

  describe('getManager', () => {
    it('should return the manager instance', async () => {
      const { result } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.getManager()).not.toBeNull();
      });

      const manager = result.current.getManager();
      expect(manager).toBe(mockManager);
    });
  });

  describe('summary updates', () => {
    it('should reflect current summary from manager', async () => {
      mockGetSummary.mockReturnValue({
        total: 5,
        active: 1,
        completed: 3,
        failed: 1,
        cancelled: 0,
      });

      const { result } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.getManager()).not.toBeNull();
      });

      expect(result.current.summary).toEqual({
        total: 5,
        active: 1,
        completed: 3,
        failed: 1,
        cancelled: 0,
      });
    });
  });

  describe('options handling', () => {
    it('should pass options to getBackgroundTaskManager', async () => {
      const { getBackgroundTaskManager } =
        await import('../../../services/BackgroundTaskManager.js');

      renderHook(() =>
        useBackgroundTaskManager({
          projectRoot: '/custom/project',
          workbenchUrl: 'http://custom:9000',
          workbenchApiKey: 'custom-key',
        })
      );

      expect(getBackgroundTaskManager).toHaveBeenCalledWith(
        '/custom/project',
        'http://custom:9000',
        'custom-key'
      );
    });
  });

  describe('debug mode', () => {
    it('should log updates when debug is true', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useBackgroundTaskManager({ ...defaultOptions, debug: true })
      );

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.getManager()).not.toBeNull();
      });

      const task = { id: 'task-1', type: 'genesis', status: 'running' };

      act(() => {
        if (updateCallback) {
          updateCallback(task);
        }
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[BackgroundTaskManager]'),
        expect.anything(),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const { getBackgroundTaskManager } =
        await import('../../../services/BackgroundTaskManager.js');
      (getBackgroundTaskManager as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('Init failed');
        }
      );

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Should not throw
      const { result } = renderHook(() =>
        useBackgroundTaskManager({ ...defaultOptions, debug: true })
      );

      expect(result.current.tasks).toEqual([]);

      consoleSpy.mockRestore();
    });
  });

  describe('stable callbacks', () => {
    it('should maintain stable callback references', () => {
      const { result, rerender } = renderHook(() =>
        useBackgroundTaskManager(defaultOptions)
      );

      const firstStartGenesis = result.current.startGenesis;
      const firstCancelTask = result.current.cancelTask;

      rerender();

      expect(result.current.startGenesis).toBe(firstStartGenesis);
      expect(result.current.cancelTask).toBe(firstCancelTask);
    });
  });
});
