/**
 * useBackgroundTaskManager Hook
 *
 * React hook wrapper around BackgroundTaskManager for use in TUI components.
 * Provides reactive state updates when tasks change.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { systemLog } from '../../utils/debug-logger.js';
import {
  BackgroundTaskManager,
  getBackgroundTaskManager,
  type BackgroundTask,
} from '../services/BackgroundTaskManager.js';

export interface UseBackgroundTaskManagerOptions {
  /** Project root directory */
  projectRoot: string;
  /** Workbench URL for genesis/overlay operations */
  workbenchUrl?: string;
  /** Workbench API key for authentication */
  workbenchApiKey?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseBackgroundTaskManagerResult {
  /** All tasks */
  tasks: BackgroundTask[];
  /** Currently active task (if any) */
  activeTask: BackgroundTask | null;
  /** Task summary stats */
  summary: {
    total: number;
    active: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  /** Start genesis operation */
  startGenesis: (sourceDirs: string[]) => Promise<string>;
  /** Start genesis:docs operation */
  startGenesisDocs: (docPaths: string[]) => Promise<string>;
  /** Start overlay generation */
  startOverlay: (overlayType: string) => Promise<string>;
  /** Cancel a task */
  cancelTask: (taskId: string) => boolean;
  /** Clear completed/failed tasks from history */
  clearHistory: () => void;
  /** Get the manager instance (for MCP tool) */
  getManager: () => BackgroundTaskManager | null;
}

/**
 * React hook for managing background tasks in the TUI.
 *
 * Wraps BackgroundTaskManager with React state management,
 * providing reactive updates when tasks change.
 *
 * @param options - Hook configuration
 * @returns Object with tasks, actions, and manager reference
 *
 * @example
 * const { tasks, activeTask, startGenesis, startOverlay } = useBackgroundTaskManager({
 *   projectRoot: '/path/to/project',
 *   debug: true,
 * });
 *
 * // Start genesis
 * await startGenesis(['src']);
 *
 * // Check active task
 * if (activeTask) {
 *   systemLog('tui', `${activeTask.type}: ${activeTask.progress}%`);
 * }
 */
export function useBackgroundTaskManager(
  options: UseBackgroundTaskManagerOptions
): UseBackgroundTaskManagerResult {
  const { projectRoot, workbenchUrl, workbenchApiKey, debug } = options;

  // Manager instance ref (stable across renders)
  const managerRef = useRef<BackgroundTaskManager | null>(null);

  // Reactive state
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [activeTask, setActiveTask] = useState<BackgroundTask | null>(null);

  // Initialize manager on mount
  useEffect(() => {
    try {
      managerRef.current = getBackgroundTaskManager(
        projectRoot,
        workbenchUrl,
        workbenchApiKey
      );

      // Set initial state
      setTasks(managerRef.current.getAllTasks());
      setActiveTask(managerRef.current.getActiveTask());

      // Subscribe to updates
      const unsubUpdate = managerRef.current.onTaskUpdate((task) => {
        if (debug) {
          systemLog(
            'tui',
            `[BackgroundTaskManager] Task update: ${task.id} ${task.status}`
          );
        }
        setTasks(managerRef.current!.getAllTasks());
        setActiveTask(managerRef.current!.getActiveTask());
      });

      const unsubComplete = managerRef.current.onTaskComplete((task) => {
        if (debug) {
          systemLog(
            'tui',
            `[BackgroundTaskManager] Task complete: ${task.id} ${task.status}`
          );
        }
        setTasks(managerRef.current!.getAllTasks());
        setActiveTask(managerRef.current!.getActiveTask());
      });

      // Cleanup on unmount
      return () => {
        unsubUpdate();
        unsubComplete();
        // Note: Don't shutdown manager here - it may be shared
      };
    } catch (err) {
      if (debug) {
        systemLog(
          'tui',
          `[BackgroundTaskManager] Init error: ${err}`,
          {},
          'error'
        );
      }
    }
  }, [projectRoot, workbenchUrl, workbenchApiKey, debug]);

  // Compute summary
  const summary = useMemo(
    () =>
      managerRef.current?.getSummary() ?? {
        total: 0,
        active: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      },
    [tasks] // Update summary whenever tasks state changes
  );

  // Action: Start genesis
  const startGenesis = useCallback(
    async (sourceDirs: string[]): Promise<string> => {
      if (!managerRef.current) {
        throw new Error('BackgroundTaskManager not initialized');
      }
      return managerRef.current.startGenesis(sourceDirs);
    },
    []
  );

  // Action: Start genesis:docs
  const startGenesisDocs = useCallback(
    async (docPaths: string[]): Promise<string> => {
      if (!managerRef.current) {
        throw new Error('BackgroundTaskManager not initialized');
      }
      return managerRef.current.startGenesisDocs(docPaths);
    },
    []
  );

  // Action: Start overlay generation
  const startOverlay = useCallback(
    async (overlayType: string): Promise<string> => {
      if (!managerRef.current) {
        throw new Error('BackgroundTaskManager not initialized');
      }
      return managerRef.current.startOverlay(overlayType);
    },
    []
  );

  // Action: Cancel task
  const cancelTask = useCallback((taskId: string): boolean => {
    if (!managerRef.current) {
      return false;
    }
    return managerRef.current.cancelTask(taskId);
  }, []);

  // Action: Clear history
  const clearHistory = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.clearHistory();
      setTasks(managerRef.current.getAllTasks());
    }
  }, []);

  // Getter for manager (for MCP tool)
  const getManager = useCallback(() => managerRef.current, []);

  return useMemo(
    () => ({
      tasks,
      activeTask,
      summary,
      startGenesis,
      startGenesisDocs,
      startOverlay,
      cancelTask,
      clearHistory,
      getManager,
    }),
    [
      tasks,
      activeTask,
      summary,
      startGenesis,
      startGenesisDocs,
      startOverlay,
      cancelTask,
      clearHistory,
      getManager,
    ]
  );
}
