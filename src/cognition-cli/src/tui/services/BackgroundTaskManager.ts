/**
 * BackgroundTaskManager
 *
 * Central state manager for all background operations in the TUI.
 * Spawns child processes for genesis and overlay generation,
 * parses JSON progress events, and notifies subscribers of updates.
 *
 * @example
 * const manager = new BackgroundTaskManager('/path/to/project');
 * manager.onTaskUpdate((task) => systemLog('tui', `Update: ${task}`));
 * await manager.startGenesis(['src']);
 */

import { spawn, ChildProcess } from 'child_process';
import {
  parseProgressChunk,
  type AnyProgressEvent,
  isStartEvent,
  isProgressEvent,
  isCompleteEvent,
  isErrorEvent,
  isWarningEvent,
} from '../../utils/progress-protocol.js';
import { systemLog } from '../../utils/debug-logger.js';

/**
 * Represents a background task (genesis or overlay generation)
 */
export interface BackgroundTask {
  /** Unique task identifier */
  id: string;
  /** Task type */
  type: 'genesis' | 'genesis-docs' | 'overlay';
  /** Overlay type (if type === 'overlay') */
  overlay?: string;
  /** Current task status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** Progress percentage (0-100) */
  progress?: number;
  /** Current operation description */
  message?: string;
  /** Current phase within the task */
  phase?: string;
  /** Current file being processed */
  file?: string;
  /** Timestamp when task started */
  startedAt: Date;
  /** Timestamp when task completed/failed */
  completedAt?: Date;
  /** Error message (if failed) */
  error?: string;
  /** Task-specific statistics */
  stats?: Record<string, number>;
}

/**
 * Callback type for task updates
 */
export type TaskUpdateCallback = (task: BackgroundTask) => void;

/**
 * Callback type for task completion
 */
export type TaskCompleteCallback = (task: BackgroundTask) => void;

/**
 * Background task manager for TUI
 */
export class BackgroundTaskManager {
  private tasks: Map<string, BackgroundTask> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private buffers: Map<string, string> = new Map();
  private updateCallbacks: Set<TaskUpdateCallback> = new Set();
  private completeCallbacks: Set<TaskCompleteCallback> = new Set();
  private projectRoot: string;
  private cliPath: string;
  private workbenchUrl: string;
  private workbenchApiKey: string;

  constructor(
    projectRoot: string,
    workbenchUrl?: string,
    workbenchApiKey?: string
  ) {
    this.projectRoot = projectRoot;
    // Resolve CLI path - in production this would be the installed binary
    // For development, use the local build
    this.cliPath = process.env.COGNITION_CLI_PATH || 'cognition-cli';
    // Default to localhost:8000 or environment variable
    this.workbenchUrl =
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000';
    // API key from parameter or environment
    this.workbenchApiKey =
      workbenchApiKey || process.env.WORKBENCH_API_KEY || '';
  }

  /**
   * Get all tasks
   */
  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get currently active task (if any)
   */
  getActiveTask(): BackgroundTask | null {
    for (const task of this.tasks.values()) {
      if (task.status === 'running') {
        return task;
      }
    }
    return null;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Start genesis operation
   */
  async startGenesis(sourceDirs: string[]): Promise<string> {
    const taskId = `genesis-${Date.now()}`;
    const task: BackgroundTask = {
      id: taskId,
      type: 'genesis',
      status: 'pending',
      startedAt: new Date(),
      message: 'Starting genesis...',
    };

    this.tasks.set(taskId, task);
    this.notifyUpdate(task);

    const args = ['genesis', '--json', ...sourceDirs];
    await this.spawnTask(taskId, args);

    return taskId;
  }

  /**
   * Start genesis:docs operation
   */
  async startGenesisDocs(docPaths: string[]): Promise<string> {
    const taskId = `genesis-docs-${Date.now()}`;
    const task: BackgroundTask = {
      id: taskId,
      type: 'genesis-docs',
      status: 'pending',
      startedAt: new Date(),
      message: 'Starting document ingestion...',
    };

    this.tasks.set(taskId, task);
    this.notifyUpdate(task);

    const args = ['genesis:docs', '--json', ...docPaths];
    await this.spawnTask(taskId, args);

    return taskId;
  }

  /**
   * Start overlay generation
   */
  async startOverlay(overlayType: string): Promise<string> {
    const taskId = `overlay-${overlayType}-${Date.now()}`;
    const task: BackgroundTask = {
      id: taskId,
      type: 'overlay',
      overlay: overlayType,
      status: 'pending',
      startedAt: new Date(),
      message: `Starting ${overlayType} overlay generation...`,
    };

    this.tasks.set(taskId, task);
    this.notifyUpdate(task);

    const args = ['overlay', 'generate', overlayType, '--json'];
    await this.spawnTask(taskId, args);

    return taskId;
  }

  /**
   * Cancel a running task
   */
  cancelTask(taskId: string): boolean {
    const proc = this.processes.get(taskId);
    const task = this.tasks.get(taskId);

    if (!proc || !task) {
      return false;
    }

    if (task.status !== 'running' && task.status !== 'pending') {
      return false;
    }

    // Send SIGTERM to gracefully terminate
    proc.kill('SIGTERM');

    // Update task status
    task.status = 'cancelled';
    task.completedAt = new Date();
    task.message = 'Cancelled by user';

    this.notifyUpdate(task);
    this.notifyComplete(task);

    return true;
  }

  /**
   * Subscribe to task updates
   */
  onTaskUpdate(callback: TaskUpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  /**
   * Subscribe to task completions (success, failure, or cancellation)
   */
  onTaskComplete(callback: TaskCompleteCallback): () => void {
    this.completeCallbacks.add(callback);
    return () => this.completeCallbacks.delete(callback);
  }

  /**
   * Get summary of all tasks
   */
  getSummary(): {
    total: number;
    active: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    let active = 0;
    let completed = 0;
    let failed = 0;
    let cancelled = 0;

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case 'running':
        case 'pending':
          active++;
          break;
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
        case 'cancelled':
          cancelled++;
          break;
      }
    }

    return {
      total: this.tasks.size,
      active,
      completed,
      failed,
      cancelled,
    };
  }

  /**
   * Clear completed/failed/cancelled tasks from history
   */
  clearHistory(): void {
    for (const [id, task] of this.tasks) {
      if (
        task.status === 'completed' ||
        task.status === 'failed' ||
        task.status === 'cancelled'
      ) {
        this.tasks.delete(id);
        this.processes.delete(id);
        this.buffers.delete(id);
      }
    }
  }

  /**
   * Spawn a child process for a task
   */
  private async spawnTask(taskId: string, args: string[]): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const proc = spawn(this.cliPath, args, {
      cwd: this.projectRoot,
      env: {
        ...process.env,
        COGNITION_FORMAT: 'json', // Ensure JSON output
        WORKBENCH_URL: this.workbenchUrl, // Pass workbench URL to subprocess
        WORKBENCH_API_KEY: this.workbenchApiKey, // Pass API key to subprocess
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.processes.set(taskId, proc);
    this.buffers.set(taskId, '');

    // Update status to running
    task.status = 'running';
    this.notifyUpdate(task);

    // Handle stdout (progress events)
    proc.stdout?.on('data', (chunk: Buffer) => {
      this.handleStdout(taskId, chunk.toString());
    });

    // Handle stderr (errors and warnings)
    proc.stderr?.on('data', (chunk: Buffer) => {
      // Log stderr but don't treat as fatal
      const message = chunk.toString().trim();
      if (message) {
        systemLog('tui', `[${taskId}] stderr: ${message}`, undefined, 'error');
      }
    });

    // Handle process exit
    proc.on('close', (code: number | null) => {
      this.handleProcessExit(taskId, code);
    });

    proc.on('error', (error: Error) => {
      this.handleProcessError(taskId, error);
    });
  }

  /**
   * Handle stdout data from child process
   */
  private handleStdout(taskId: string, chunk: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const buffer = this.buffers.get(taskId) || '';
    const { events, remainder } = parseProgressChunk(chunk, buffer);
    this.buffers.set(taskId, remainder);

    for (const event of events) {
      this.handleProgressEvent(taskId, event);
    }
  }

  /**
   * Handle a parsed progress event
   */
  private handleProgressEvent(taskId: string, event: AnyProgressEvent): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (isStartEvent(event)) {
      task.message = event.message;
      this.notifyUpdate(task);
    } else if (isProgressEvent(event)) {
      task.progress = event.percent;
      task.message = event.message;
      task.file = event.file;
      task.phase = event.phase;
      this.notifyUpdate(task);
    } else if (isCompleteEvent(event)) {
      task.status = 'completed';
      task.progress = 100;
      task.completedAt = new Date();
      task.message = event.message || 'Complete';
      task.stats = event.stats;
      this.notifyUpdate(task);
      this.notifyComplete(task);
    } else if (isErrorEvent(event)) {
      if (!event.recoverable) {
        task.status = 'failed';
        task.completedAt = new Date();
        task.error = event.message;
      }
      task.message = event.message;
      this.notifyUpdate(task);
      if (!event.recoverable) {
        this.notifyComplete(task);
      }
    } else if (isWarningEvent(event)) {
      // Log warning but don't update status
      task.message = `Warning: ${event.message}`;
      this.notifyUpdate(task);
    }
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(taskId: string, code: number | null): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Clean up
    this.processes.delete(taskId);
    this.buffers.delete(taskId);

    // If task already completed/failed via event, don't override
    if (task.status === 'completed' || task.status === 'failed') {
      return;
    }

    // Task didn't send completion event - infer from exit code
    if (code === 0) {
      task.status = 'completed';
      task.progress = 100;
      task.message = 'Complete';
    } else if (task.status !== 'cancelled') {
      task.status = 'failed';
      task.error =
        code === null
          ? 'Process terminated by signal'
          : `Process exited with code ${code}`;
      task.message = task.error;
    }

    task.completedAt = new Date();
    this.notifyUpdate(task);
    this.notifyComplete(task);
  }

  /**
   * Handle process spawn error
   */
  private handleProcessError(taskId: string, error: Error): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'failed';
    task.error = error.message;
    task.message = `Failed to start: ${error.message}`;
    task.completedAt = new Date();

    this.notifyUpdate(task);
    this.notifyComplete(task);

    // Clean up
    this.processes.delete(taskId);
    this.buffers.delete(taskId);
  }

  /**
   * Notify all update subscribers
   */
  private notifyUpdate(task: BackgroundTask): void {
    for (const callback of this.updateCallbacks) {
      try {
        callback(task);
      } catch (error) {
        systemLog(
          'tui',
          'Error in task update callback:',
          {
            error: error instanceof Error ? error.message : String(error),
          },
          'error'
        );
      }
    }
  }

  /**
   * Notify all completion subscribers
   */
  private notifyComplete(task: BackgroundTask): void {
    for (const callback of this.completeCallbacks) {
      try {
        callback(task);
      } catch (error) {
        systemLog(
          'tui',
          'Error in task complete callback:',
          {
            error: error instanceof Error ? error.message : String(error),
          },
          'error'
        );
      }
    }
  }

  /**
   * Shutdown manager, cancel all running tasks
   */
  shutdown(): void {
    for (const taskId of this.processes.keys()) {
      this.cancelTask(taskId);
    }
    this.updateCallbacks.clear();
    this.completeCallbacks.clear();
  }
}

/**
 * Singleton instance factory
 */
let instance: BackgroundTaskManager | null = null;

export function getBackgroundTaskManager(
  projectRoot?: string,
  workbenchUrl?: string,
  workbenchApiKey?: string
): BackgroundTaskManager {
  if (!instance && projectRoot) {
    instance = new BackgroundTaskManager(
      projectRoot,
      workbenchUrl,
      workbenchApiKey
    );
  }
  if (!instance) {
    throw new Error(
      'BackgroundTaskManager not initialized. Call with projectRoot first.'
    );
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetBackgroundTaskManager(): void {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}
