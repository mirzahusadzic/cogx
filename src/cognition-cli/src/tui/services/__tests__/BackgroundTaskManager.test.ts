/**
 * Tests for BackgroundTaskManager
 *
 * Unit tests for the central state manager for background operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

// Create mock process factory
function createMockProcess(): ChildProcess {
  const proc = new EventEmitter() as ChildProcess & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    killed: boolean;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.killed = false;
  proc.kill = vi.fn((signal?: NodeJS.Signals | number) => {
    proc.killed = true;
    proc.emit('close', signal === 'SIGTERM' ? null : 1);
    return true;
  });
  // Add default error handlers to prevent "Unhandled 'error' event" crashes
  // These will be overwritten when BackgroundTaskManager attaches its handlers
  proc.on('error', () => {});
  proc.stdout.on('error', () => {});
  proc.stderr.on('error', () => {});
  return proc;
}

// Mock child_process
const mockSpawn = vi.fn();
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: (...args: unknown[]) => mockSpawn(...args),
  };
});

// Mock progress protocol
const mockParseProgressChunk = vi.fn();
const mockIsStartEvent = vi.fn();
const mockIsProgressEvent = vi.fn();
const mockIsCompleteEvent = vi.fn();
const mockIsErrorEvent = vi.fn();
const mockIsWarningEvent = vi.fn();

vi.mock('../../../utils/progress-protocol.js', () => ({
  parseProgressChunk: (chunk: string, buffer: string) =>
    mockParseProgressChunk(chunk, buffer),
  isStartEvent: (e: unknown) => mockIsStartEvent(e),
  isProgressEvent: (e: unknown) => mockIsProgressEvent(e),
  isCompleteEvent: (e: unknown) => mockIsCompleteEvent(e),
  isErrorEvent: (e: unknown) => mockIsErrorEvent(e),
  isWarningEvent: (e: unknown) => mockIsWarningEvent(e),
}));

// Import after mocking
import {
  BackgroundTaskManager,
  getBackgroundTaskManager,
  resetBackgroundTaskManager,
} from '../BackgroundTaskManager.js';

describe('BackgroundTaskManager', () => {
  let mockProcess: ReturnType<typeof createMockProcess>;
  const projectRoot = '/test/project';
  const workbenchUrl = 'http://localhost:8000';
  const workbenchApiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    resetBackgroundTaskManager();

    mockProcess = createMockProcess();
    mockSpawn.mockReturnValue(mockProcess);

    // Default progress chunk parsing - returns empty events
    mockParseProgressChunk.mockReturnValue({ events: [], remainder: '' });

    // Default event type checks - all false
    mockIsStartEvent.mockReturnValue(false);
    mockIsProgressEvent.mockReturnValue(false);
    mockIsCompleteEvent.mockReturnValue(false);
    mockIsErrorEvent.mockReturnValue(false);
    mockIsWarningEvent.mockReturnValue(false);
  });

  afterEach(() => {
    resetBackgroundTaskManager();
    // Clean up event listeners to prevent memory leaks
    if (mockProcess) {
      mockProcess.removeAllListeners();
      mockProcess.stdout?.removeAllListeners();
      mockProcess.stderr?.removeAllListeners();
    }
  });

  describe('constructor', () => {
    it('should create instance with projectRoot', () => {
      const manager = new BackgroundTaskManager(projectRoot);
      expect(manager).toBeInstanceOf(BackgroundTaskManager);
    });

    it('should create instance with all parameters', () => {
      const manager = new BackgroundTaskManager(
        projectRoot,
        workbenchUrl,
        workbenchApiKey
      );
      expect(manager).toBeInstanceOf(BackgroundTaskManager);
    });

    it('should use environment variables as fallback', () => {
      const originalEnv = { ...process.env };
      process.env.WORKBENCH_URL = 'http://env-url:9000';
      process.env.WORKBENCH_API_KEY = 'env-key';

      const manager = new BackgroundTaskManager(projectRoot);
      expect(manager).toBeInstanceOf(BackgroundTaskManager);

      // Restore environment
      process.env = originalEnv;
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance on subsequent calls', () => {
      const instance1 = getBackgroundTaskManager(
        projectRoot,
        workbenchUrl,
        workbenchApiKey
      );
      const instance2 = getBackgroundTaskManager();

      expect(instance1).toBe(instance2);
    });

    it('should throw if called without projectRoot before initialization', () => {
      expect(() => getBackgroundTaskManager()).toThrow(
        'BackgroundTaskManager not initialized'
      );
    });

    it('should reset singleton properly', () => {
      getBackgroundTaskManager(projectRoot);
      resetBackgroundTaskManager();

      expect(() => getBackgroundTaskManager()).toThrow(
        'BackgroundTaskManager not initialized'
      );
    });
  });

  describe('getAllTasks', () => {
    it('should return empty array initially', () => {
      const manager = new BackgroundTaskManager(projectRoot);
      expect(manager.getAllTasks()).toEqual([]);
    });

    it('should return all tasks after creation', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src']);
      const tasks = manager.getAllTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].type).toBe('genesis');
    });
  });

  describe('getActiveTask', () => {
    it('should return null when no tasks are running', () => {
      const manager = new BackgroundTaskManager(projectRoot);
      expect(manager.getActiveTask()).toBeNull();
    });

    it('should return running task', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src']);

      const activeTask = manager.getActiveTask();
      expect(activeTask).not.toBeNull();
      expect(activeTask?.status).toBe('running');
    });
  });

  describe('getTask', () => {
    it('should return undefined for nonexistent task', () => {
      const manager = new BackgroundTaskManager(projectRoot);
      expect(manager.getTask('nonexistent')).toBeUndefined();
    });

    it('should return task by ID', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const taskId = await manager.startGenesis(['src']);

      const task = manager.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.id).toBe(taskId);
    });
  });

  describe('startGenesis', () => {
    it('should create pending task initially', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const taskId = await manager.startGenesis(['src']);

      const task = manager.getTask(taskId);
      expect(task?.type).toBe('genesis');
      expect(task?.id).toContain('genesis-');
      expect(task?.startedAt).toBeInstanceOf(Date);
    });

    it('should spawn process with correct arguments', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src', 'lib']);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        ['genesis', '--json', 'src', 'lib'],
        expect.objectContaining({
          cwd: projectRoot,
          env: expect.objectContaining({
            COGNITION_FORMAT: 'json',
          }),
        })
      );
    });

    it('should use COGNITION_CLI_PATH if set', async () => {
      const originalEnv = { ...process.env };
      process.env.COGNITION_CLI_PATH = '/custom/cli/path';

      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src']);

      expect(mockSpawn).toHaveBeenCalledWith(
        '/custom/cli/path',
        expect.any(Array),
        expect.any(Object)
      );

      process.env = originalEnv;
    });

    it('should update task to running status after spawn', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const taskId = await manager.startGenesis(['src']);

      const task = manager.getTask(taskId);
      expect(task?.status).toBe('running');
    });
  });

  describe('startGenesisDocs', () => {
    it('should create genesis-docs task', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const taskId = await manager.startGenesisDocs(['docs/README.md']);

      const task = manager.getTask(taskId);
      expect(task?.type).toBe('genesis-docs');
      expect(task?.id).toContain('genesis-docs-');
    });

    it('should spawn process with genesis:docs command', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesisDocs(['docs/VISION.md', 'docs/SECURITY.md']);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        ['genesis:docs', '--json', 'docs/VISION.md', 'docs/SECURITY.md'],
        expect.any(Object)
      );
    });
  });

  describe('startOverlay', () => {
    it('should create overlay task', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const taskId = await manager.startOverlay('structural_patterns');

      const task = manager.getTask(taskId);
      expect(task?.type).toBe('overlay');
      expect(task?.overlay).toBe('structural_patterns');
      expect(task?.id).toContain('overlay-structural_patterns-');
    });

    it('should spawn process with overlay command', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startOverlay('invariants');

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        ['overlay', 'generate', 'invariants', '--json'],
        expect.any(Object)
      );
    });
  });

  describe('cancelTask', () => {
    it('should return false for nonexistent task', () => {
      const manager = new BackgroundTaskManager(projectRoot);
      expect(manager.cancelTask('nonexistent')).toBe(false);
    });

    it('should return false for already completed task', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const taskId = await manager.startGenesis(['src']);

      // Simulate completion
      const task = manager.getTask(taskId)!;
      task.status = 'completed';

      expect(manager.cancelTask(taskId)).toBe(false);
    });

    it('should cancel running task', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const taskId = await manager.startGenesis(['src']);

      const result = manager.cancelTask(taskId);

      expect(result).toBe(true);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      const task = manager.getTask(taskId);
      expect(task?.status).toBe('cancelled');
      expect(task?.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('onTaskUpdate', () => {
    it('should subscribe to task updates', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const callback = vi.fn();

      manager.onTaskUpdate(callback);
      await manager.startGenesis(['src']);

      // Should be called for initial pending and then running
      expect(callback).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const callback = vi.fn();

      const unsubscribe = manager.onTaskUpdate(callback);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should not call callback after unsubscribe', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const callback = vi.fn();

      const unsubscribe = manager.onTaskUpdate(callback);
      unsubscribe();

      await manager.startGenesis(['src']);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple subscribers', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      manager.onTaskUpdate(callback1);
      manager.onTaskUpdate(callback2);

      await manager.startGenesis(['src']);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should catch callback errors without breaking', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      manager.onTaskUpdate(errorCallback);
      manager.onTaskUpdate(normalCallback);

      await manager.startGenesis(['src']);

      expect(normalCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('onTaskComplete', () => {
    it('should subscribe to task completions', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const callback = vi.fn();

      manager.onTaskComplete(callback);
      const taskId = await manager.startGenesis(['src']);

      // Simulate process exit with success
      mockProcess.emit('close', 0);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: taskId,
          status: 'completed',
        })
      );
    });

    it('should return unsubscribe function', () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const callback = vi.fn();

      const unsubscribe = manager.onTaskComplete(callback);
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getSummary', () => {
    it('should return empty summary initially', () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const summary = manager.getSummary();

      expect(summary).toEqual({
        total: 0,
        active: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      });
    });

    it('should count active tasks correctly', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src']);
      await manager.startOverlay('invariants');

      const summary = manager.getSummary();
      expect(summary.total).toBe(2);
      expect(summary.active).toBe(2);
    });

    it('should count completed tasks correctly', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src']);

      mockProcess.emit('close', 0);

      const summary = manager.getSummary();
      expect(summary.completed).toBe(1);
      expect(summary.active).toBe(0);
    });

    it('should count failed tasks correctly', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src']);

      mockProcess.emit('close', 1);

      const summary = manager.getSummary();
      expect(summary.failed).toBe(1);
    });

    it('should count cancelled tasks correctly', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const taskId = await manager.startGenesis(['src']);
      manager.cancelTask(taskId);

      const summary = manager.getSummary();
      expect(summary.cancelled).toBe(1);
    });
  });

  describe('clearHistory', () => {
    it('should clear completed tasks', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src']);
      mockProcess.emit('close', 0);

      expect(manager.getAllTasks()).toHaveLength(1);

      manager.clearHistory();

      expect(manager.getAllTasks()).toHaveLength(0);
    });

    it('should clear failed tasks', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src']);
      mockProcess.emit('close', 1);

      manager.clearHistory();

      expect(manager.getAllTasks()).toHaveLength(0);
    });

    it('should clear cancelled tasks', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const taskId = await manager.startGenesis(['src']);
      manager.cancelTask(taskId);

      manager.clearHistory();

      expect(manager.getAllTasks()).toHaveLength(0);
    });

    it('should keep running tasks', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src']);

      manager.clearHistory();

      expect(manager.getAllTasks()).toHaveLength(1);
    });
  });

  describe('shutdown', () => {
    it('should cancel all running tasks', async () => {
      // Create fresh mock processes for each spawn call
      const mockProcess1 = createMockProcess();
      const mockProcess2 = createMockProcess();
      mockSpawn
        .mockReturnValueOnce(mockProcess1)
        .mockReturnValueOnce(mockProcess2);

      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src']);
      await manager.startOverlay('invariants');

      manager.shutdown();

      const tasks = manager.getAllTasks();
      expect(tasks.every((t) => t.status === 'cancelled')).toBe(true);
    });

    it('should clear all callbacks', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const updateCallback = vi.fn();
      const completeCallback = vi.fn();

      manager.onTaskUpdate(updateCallback);
      manager.onTaskComplete(completeCallback);

      manager.shutdown();

      // New tasks should not trigger callbacks
      await manager.startGenesis(['src']);
      expect(updateCallback).not.toHaveBeenCalled();
    });
  });

  describe('progress event handling', () => {
    it('should handle start event', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const updateCallback = vi.fn();
      manager.onTaskUpdate(updateCallback);

      const startEvent = { type: 'start', message: 'Starting analysis...' };
      mockParseProgressChunk.mockReturnValue({
        events: [startEvent],
        remainder: '',
      });
      mockIsStartEvent.mockReturnValue(true);

      await manager.startGenesis(['src']);

      // Simulate stdout data
      mockProcess.stdout.emit('data', Buffer.from('{"type":"start"}\n'));

      const task = manager.getTask(manager.getAllTasks()[0].id);
      expect(task?.message).toBe('Starting analysis...');
    });

    it('should handle progress event', async () => {
      const manager = new BackgroundTaskManager(projectRoot);

      const progressEvent = {
        type: 'progress',
        percent: 50,
        message: 'Processing files...',
        file: 'src/index.ts',
        phase: 'analysis',
      };
      mockParseProgressChunk.mockReturnValue({
        events: [progressEvent],
        remainder: '',
      });
      mockIsProgressEvent.mockReturnValue(true);

      await manager.startGenesis(['src']);
      mockProcess.stdout.emit('data', Buffer.from('{"type":"progress"}\n'));

      const task = manager.getTask(manager.getAllTasks()[0].id);
      expect(task?.progress).toBe(50);
      expect(task?.message).toBe('Processing files...');
      expect(task?.file).toBe('src/index.ts');
      expect(task?.phase).toBe('analysis');
    });

    it('should handle complete event', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const completeCallback = vi.fn();
      manager.onTaskComplete(completeCallback);

      const completeEvent = {
        type: 'complete',
        message: 'Analysis complete',
        stats: { filesProcessed: 100 },
      };
      mockParseProgressChunk.mockReturnValue({
        events: [completeEvent],
        remainder: '',
      });
      mockIsCompleteEvent.mockReturnValue(true);

      await manager.startGenesis(['src']);
      mockProcess.stdout.emit('data', Buffer.from('{"type":"complete"}\n'));

      const task = manager.getTask(manager.getAllTasks()[0].id);
      expect(task?.status).toBe('completed');
      expect(task?.progress).toBe(100);
      expect(task?.stats).toEqual({ filesProcessed: 100 });
      expect(completeCallback).toHaveBeenCalled();
    });

    it('should handle recoverable error event', async () => {
      const manager = new BackgroundTaskManager(projectRoot);

      const errorEvent = {
        type: 'error',
        message: 'File skipped due to error',
        recoverable: true,
      };
      mockParseProgressChunk.mockReturnValue({
        events: [errorEvent],
        remainder: '',
      });
      mockIsErrorEvent.mockReturnValue(true);

      await manager.startGenesis(['src']);
      mockProcess.stdout.emit('data', Buffer.from('{"type":"error"}\n'));

      const task = manager.getTask(manager.getAllTasks()[0].id);
      expect(task?.status).toBe('running'); // Still running
      expect(task?.message).toBe('File skipped due to error');
    });

    it('should handle non-recoverable error event', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const completeCallback = vi.fn();
      manager.onTaskComplete(completeCallback);

      const errorEvent = {
        type: 'error',
        message: 'Fatal error occurred',
        recoverable: false,
      };
      mockParseProgressChunk.mockReturnValue({
        events: [errorEvent],
        remainder: '',
      });
      mockIsErrorEvent.mockReturnValue(true);

      await manager.startGenesis(['src']);
      mockProcess.stdout.emit('data', Buffer.from('{"type":"error"}\n'));

      const task = manager.getTask(manager.getAllTasks()[0].id);
      expect(task?.status).toBe('failed');
      expect(task?.error).toBe('Fatal error occurred');
      expect(completeCallback).toHaveBeenCalled();
    });

    it('should handle warning event', async () => {
      const manager = new BackgroundTaskManager(projectRoot);

      const warningEvent = {
        type: 'warning',
        message: 'Large file detected',
      };
      mockParseProgressChunk.mockReturnValue({
        events: [warningEvent],
        remainder: '',
      });
      mockIsWarningEvent.mockReturnValue(true);

      await manager.startGenesis(['src']);
      mockProcess.stdout.emit('data', Buffer.from('{"type":"warning"}\n'));

      const task = manager.getTask(manager.getAllTasks()[0].id);
      expect(task?.message).toBe('Warning: Large file detected');
      expect(task?.status).toBe('running'); // Status unchanged
    });
  });

  describe('buffer management', () => {
    it('should buffer incomplete JSON lines', async () => {
      const manager = new BackgroundTaskManager(projectRoot);

      // First chunk is incomplete
      mockParseProgressChunk.mockReturnValueOnce({
        events: [],
        remainder: '{"type":"pro',
      });

      await manager.startGenesis(['src']);
      mockProcess.stdout.emit('data', Buffer.from('{"type":"pro'));

      // Second chunk completes the line
      const progressEvent = { type: 'progress', percent: 50 };
      mockParseProgressChunk.mockReturnValueOnce({
        events: [progressEvent],
        remainder: '',
      });
      mockIsProgressEvent.mockReturnValue(true);

      mockProcess.stdout.emit('data', Buffer.from('gress","percent":50}\n'));

      expect(mockParseProgressChunk).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple events in single chunk', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const updateCallback = vi.fn();
      manager.onTaskUpdate(updateCallback);

      const events = [
        { type: 'start', message: 'Starting' },
        { type: 'progress', percent: 25 },
        { type: 'progress', percent: 50 },
      ];
      mockParseProgressChunk.mockReturnValue({
        events,
        remainder: '',
      });

      mockIsStartEvent.mockImplementation((e) => e.type === 'start');
      mockIsProgressEvent.mockImplementation((e) => e.type === 'progress');

      await manager.startGenesis(['src']);
      mockProcess.stdout.emit('data', Buffer.from('line1\nline2\nline3\n'));

      // Should process all events (3 events + 2 from task creation)
      expect(updateCallback.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('process error handling', () => {
    it('should handle spawn error', async () => {
      const manager = new BackgroundTaskManager(projectRoot);

      await manager.startGenesis(['src']);
      mockProcess.emit('error', new Error('Command not found'));

      const task = manager.getTask(manager.getAllTasks()[0].id);
      expect(task?.status).toBe('failed');
      expect(task?.error).toBe('Command not found');
    });

    it('should log stderr but not fail task', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src']);

      mockProcess.stderr.emit('data', Buffer.from('Warning message\n'));

      const task = manager.getTask(manager.getAllTasks()[0].id);
      expect(task?.status).toBe('running'); // Still running
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle process exit with signal', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src']);

      mockProcess.emit('close', null);

      const task = manager.getTask(manager.getAllTasks()[0].id);
      expect(task?.status).toBe('failed');
      expect(task?.error).toBe('Process terminated by signal');
    });

    it('should not override completed status on exit', async () => {
      const manager = new BackgroundTaskManager(projectRoot);

      const completeEvent = { type: 'complete', message: 'Done' };
      mockParseProgressChunk.mockReturnValue({
        events: [completeEvent],
        remainder: '',
      });
      mockIsCompleteEvent.mockReturnValue(true);

      await manager.startGenesis(['src']);

      // Complete via event
      mockProcess.stdout.emit('data', Buffer.from('{"type":"complete"}\n'));

      // Then exit
      mockProcess.emit('close', 0);

      const task = manager.getTask(manager.getAllTasks()[0].id);
      expect(task?.status).toBe('completed');
      expect(task?.message).toBe('Done'); // Original message preserved
    });

    it('should handle exit code 0 for tasks without completion event', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      await manager.startGenesis(['src']);

      mockProcess.emit('close', 0);

      const task = manager.getTask(manager.getAllTasks()[0].id);
      expect(task?.status).toBe('completed');
      expect(task?.progress).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('should handle missing task in event handler gracefully', async () => {
      const manager = new BackgroundTaskManager(projectRoot);

      mockParseProgressChunk.mockReturnValue({
        events: [{ type: 'progress' }],
        remainder: '',
      });
      mockIsProgressEvent.mockReturnValue(true);

      await manager.startGenesis(['src']);

      // Clear tasks before event is processed
      manager.clearHistory();

      // Should not throw
      mockProcess.stdout.emit('data', Buffer.from('{"type":"progress"}\n'));
    });

    it('should handle empty events list', async () => {
      const manager = new BackgroundTaskManager(projectRoot);
      const updateCallback = vi.fn();
      manager.onTaskUpdate(updateCallback);

      mockParseProgressChunk.mockReturnValue({
        events: [],
        remainder: '',
      });

      await manager.startGenesis(['src']);
      const callCountAfterStart = updateCallback.mock.calls.length;

      mockProcess.stdout.emit('data', Buffer.from('\n'));

      // No additional update calls
      expect(updateCallback.mock.calls.length).toBe(callCountAfterStart);
    });

    it('should handle complete event with no message', async () => {
      const manager = new BackgroundTaskManager(projectRoot);

      const completeEvent = { type: 'complete' };
      mockParseProgressChunk.mockReturnValue({
        events: [completeEvent],
        remainder: '',
      });
      mockIsCompleteEvent.mockReturnValue(true);

      await manager.startGenesis(['src']);
      mockProcess.stdout.emit('data', Buffer.from('{"type":"complete"}\n'));

      const task = manager.getTask(manager.getAllTasks()[0].id);
      expect(task?.message).toBe('Complete'); // Default message
    });
  });

  describe('environment handling', () => {
    it('should pass workbench URL and API key to subprocess', async () => {
      const manager = new BackgroundTaskManager(
        projectRoot,
        'http://custom:9000',
        'custom-key'
      );
      await manager.startGenesis(['src']);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            WORKBENCH_URL: 'http://custom:9000',
            WORKBENCH_API_KEY: 'custom-key',
          }),
        })
      );
    });
  });
});
