/**
 * Session State Machine
 *
 * Formalizes the session lifecycle and manages state transitions.
 */

import {
  SessionStatus,
  SessionEvent,
  SessionStateListener,
  SessionState,
  SigmaTask,
} from './types.js';
import { systemDiagnosticsService } from '../../services/diagnostics/SystemDiagnosticsService.js';
import { validateTaskCompletion } from '../../../sigma/validation-service.js';
import {
  SYSTEM_PROMPT_MAX_COMPLETED_TASKS,
  SYSTEM_PROMPT_MAX_PENDING_TASKS,
} from '../../../config.js';
import { saveSessionState } from './SessionPersistence.js';

/**
 * SessionStateMachine manages the lifecycle of a Sigma session.
 */
export class SessionStateMachine {
  private status: SessionStatus = SessionStatus.INITIALIZING;
  private state: SessionState | null = null;
  private listeners: Set<SessionStateListener> = new Set();
  private error: Error | null = null;
  private projectRoot: string | null = null;

  /**
   * Create a new SessionStateMachine
   *
   * @param initialState - Optional initial session state
   * @param projectRoot - Optional project root for persistence
   */
  constructor(initialState?: SessionState, projectRoot?: string) {
    if (initialState) {
      this.state = initialState;
      this.status = SessionStatus.ACTIVE;
    }
    if (projectRoot) {
      this.projectRoot = projectRoot;
    }
  }

  /**
   * Set the project root for persistence
   */
  public setProjectRoot(projectRoot: string): void {
    this.projectRoot = projectRoot;
  }

  /**
   * Get the current session status
   */
  public getStatus(): SessionStatus {
    return this.status;
  }

  /**
   * Get the current session state
   */
  public getState(): SessionState | null {
    return this.state;
  }

  /**
   * Get the last error that occurred
   */
  public getLastError(): Error | null {
    return this.error;
  }

  /**
   * Subscribe to state transitions
   *
   * @param listener - Function to call on transition
   * @returns Unsubscribe function
   */
  public subscribe(listener: SessionStateListener): () => void {
    this.listeners.add(listener);
    // Initial notification
    listener(this.status, this.state, this.error || undefined);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of a state change
   */
  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.status, this.state, this.error || undefined);
      } catch (err) {
        systemDiagnosticsService.systemLog(
          'session-state',
          'Error in session state listener',
          { error: err instanceof Error ? err.message : String(err) },
          'error'
        );
      }
    }
  }

  /**
   * Internal transition method
   */
  private transition(
    newStatus: SessionStatus,
    newState?: SessionState,
    error?: Error
  ): void {
    const oldStatus = this.status;
    this.status = newStatus;

    if (newState !== undefined) {
      this.state = newState;
    }

    if (error !== undefined) {
      this.error = error;
    } else if (newStatus !== SessionStatus.ERROR) {
      this.error = null;
    }

    systemDiagnosticsService.systemLog(
      'session-state',
      `Transition: ${oldStatus} -> ${newStatus}`,
      {
        anchor_id: this.state?.anchor_id,
        error: error?.message,
      },
      'debug'
    );

    this.notify();
  }

  /**
   * Handle a session event and trigger state transitions
   *
   * @param event - The event to handle
   */
  public handleEvent(event: SessionEvent): void {
    switch (event.type) {
      case 'LOAD_START':
        this.transition(SessionStatus.INITIALIZING);
        break;

      case 'LOAD_SUCCESS':
        this.transition(SessionStatus.ACTIVE, event.state);
        break;

      case 'LOAD_FAILURE':
        this.transition(SessionStatus.ERROR, undefined, event.error);
        break;

      case 'TASK_START':
        if (
          this.status !== SessionStatus.ACTIVE &&
          this.status !== SessionStatus.TASK_PROCESSING
        ) {
          systemDiagnosticsService.systemLog(
            'session-state',
            `Warning: TASK_START event while in ${this.status} state`,
            {},
            'warn'
          );
        }
        this.transition(SessionStatus.TASK_PROCESSING);
        break;

      case 'TASK_COMPLETE':
        // Task completion usually triggers a PRUNING state before returning to ACTIVE
        this.transition(SessionStatus.ACTIVE);
        break;

      case 'TASK_FAIL':
        this.transition(SessionStatus.ACTIVE, undefined, event.error);
        break;

      case 'PRUNE_START':
        this.transition(SessionStatus.PRUNING);
        break;

      case 'PRUNE_COMPLETE':
        this.transition(SessionStatus.ACTIVE);
        break;

      case 'PERSIST_START':
        this.transition(SessionStatus.PERSISTING);
        break;

      case 'PERSIST_SUCCESS':
        this.transition(SessionStatus.ACTIVE);
        break;

      case 'PERSIST_FAILURE':
        // Don't transition to ERROR on persist failure to keep session alive,
        // but log the error and stay in ACTIVE (or previous state)
        systemDiagnosticsService.systemLog(
          'session-state',
          'Failed to persist session state',
          { error: event.error.message },
          'error'
        );
        this.transition(SessionStatus.ACTIVE, undefined, event.error);
        break;

      case 'TERMINATE':
        this.transition(SessionStatus.TERMINATED);
        break;

      default:
        systemDiagnosticsService.systemLog(
          'session-state',
          `Unknown event type: ${(event as { type: string }).type}`,
          {},
          'error'
        );
    }
  }

  /**
   * Persist the current session state to disk
   */
  public persist(): void {
    if (!this.state || !this.projectRoot) return;

    this.handleEvent({ type: 'PERSIST_START' });
    try {
      saveSessionState(this.state, this.projectRoot);
      this.handleEvent({ type: 'PERSIST_SUCCESS' });
    } catch (err) {
      this.handleEvent({
        type: 'PERSIST_FAILURE',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  /**
   * Update the task list for the session
   *
   * Performs validation and triggers state transitions.
   *
   * @param updates - Array of task updates
   * @param replace - Whether to replace the entire list (default: false)
   * @returns Success message summary
   */
  public async updateTasks(
    updates: Partial<SigmaTask>[],
    replace: boolean = false
  ): Promise<string> {
    if (!this.state) {
      throw new Error('Cannot update tasks: No active session state');
    }

    const currentState = this.state;

    // 1. Validate 'in_progress' count
    const inProgressCount = updates.filter(
      (t) => t.status === 'in_progress'
    ).length;
    if (inProgressCount > 1) {
      const inProgressIds = updates
        .filter((t) => t.status === 'in_progress')
        .map((t) => t.id)
        .join("', '");
      throw new Error(
        `Only ONE task can be in_progress at a time. You attempted to set ${inProgressCount} tasks to in_progress ('${inProgressIds}').\n\n` +
          `RECOVERY: Mark exactly one task as 'in_progress' (and provide an 'activeForm'). If you are switching, mark the current one as 'completed' (with a result_summary) in the same call.`
      );
    }

    // 2. Enforce Strict Sequential Task Management (only if NOT replacing everything)
    if (!replace && currentState.todos) {
      const currentInProgress = currentState.todos.find(
        (t) => t.status === 'in_progress'
      );
      if (currentInProgress) {
        const matchingUpdate = updates.find(
          (t) => t.id === currentInProgress.id
        );
        const isCompletingCurrent = matchingUpdate?.status === 'completed';

        // 2a. Prevent starting a NEW task before completing current one
        const startingNew = updates.find(
          (t) => t.id !== currentInProgress.id && t.status === 'in_progress'
        );
        if (startingNew && !isCompletingCurrent) {
          const activeForm =
            startingNew.activeForm ||
            (startingNew.content ? `Doing ${startingNew.content}` : '...ing');
          throw new Error(
            `Strict Sequential Workflow: You must complete task '${currentInProgress.id}' (set status to 'completed') before starting '${startingNew.id}'.\n\n` +
              `RECOVERY: To switch tasks, include both in your update:\n` +
              `{\n` +
              `  "todos": [\n` +
              `    { "id": "${currentInProgress.id}", "status": "completed", "result_summary": "Summary of work done..." },\n` +
              `    { "id": "${startingNew.id}", "status": "in_progress", "activeForm": "${activeForm}" }\n` +
              `  ]\n` +
              `}`
          );
        }

        // 2b. Prevent adding NEW tasks to the list while one is in_progress
        const newTasks = updates.filter(
          (t) => !currentState.todos!.some((old) => old.id === t.id)
        );
        if (!isCompletingCurrent && newTasks.length > 0) {
          throw new Error(
            `Strict Sequential Workflow: You cannot create NEW tasks while task '${currentInProgress.id}' is still in_progress.\n\n` +
              `RECOVERY: Complete '${currentInProgress.id}' first, or include its completion in this call.`
          );
        }
      }
    }

    // 3. Process task completion validation
    let newlyCompletedTaskId: string | null = null;
    let taskSummaryToPass: string | null = null;

    for (const update of updates) {
      const oldTodo = currentState.todos?.find((t) => t.id === update.id);

      if (
        update.status === 'completed' &&
        (!oldTodo || oldTodo.status !== 'completed') &&
        update.result_summary
      ) {
        newlyCompletedTaskId = update.id || `task-${Date.now()}`;
        taskSummaryToPass = update.result_summary;

        const validation = await validateTaskCompletion(
          { ...(oldTodo || {}), ...update } as SigmaTask,
          update.result_summary
        );

        if (!validation.isValid) {
          const warning = `\n\n⚠️ [Sigma Validation] Missing criteria: ${validation.missing_criteria?.join(', ')}`;
          update.result_summary += warning;
        } else {
          const success = `\n\n✅ [Sigma Validation] All criteria met (Score: ${validation.score.toFixed(2)})`;
          update.result_summary += success;
        }
      }
    }

    // 4. Merge or replace updates into state
    const finalTodos = replace ? [] : [...(currentState.todos || [])];
    for (const update of updates) {
      const id = update.id;
      const existingIndex = id ? finalTodos.findIndex((t) => t.id === id) : -1;

      if (existingIndex !== -1) {
        // Partial merge
        const filteredUpdate = Object.fromEntries(
          Object.entries(update).filter(([, v]) => v !== undefined)
        );
        finalTodos[existingIndex] = {
          ...finalTodos[existingIndex],
          ...filteredUpdate,
        } as SigmaTask;
      } else {
        // Add new
        if (update.content && update.activeForm && update.status) {
          const newTask = {
            ...update,
            id:
              update.id ||
              `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          } as SigmaTask;
          finalTodos.push(newTask);
        }
      }
    }

    // 5. Update state
    this.state = {
      ...currentState,
      todos: finalTodos,
      last_updated: new Date().toISOString(),
    };

    // 6. Handle transitions
    if (newlyCompletedTaskId) {
      this.handleEvent({
        type: 'TASK_COMPLETE',
        taskId: newlyCompletedTaskId,
        summary: taskSummaryToPass || '',
      });
      // Optionally trigger PRUNING state
      this.handleEvent({ type: 'PRUNE_START' });
      // In a real scenario, the provider would perform pruning and then call PRUNE_COMPLETE
      // For now, we return to ACTIVE
      this.handleEvent({ type: 'PRUNE_COMPLETE' });
    } else if (updates.some((t) => t.status === 'in_progress')) {
      const inProgressTask = updates.find((t) => t.status === 'in_progress')!;
      if (inProgressTask.id) {
        this.handleEvent({ type: 'TASK_START', taskId: inProgressTask.id });
      }
    }

    // 7. Persist
    this.persist();

    // 8. Format summary
    const summary = finalTodos
      .map((t) => {
        const icon =
          t.status === 'completed'
            ? '✓'
            : t.status === 'in_progress'
              ? '→'
              : t.status === 'delegated'
                ? '⇨'
                : '○';
        const text = t.status === 'in_progress' ? t.activeForm : t.content;
        return `[${icon}] ${text}${t.status === 'delegated' && t.delegated_to ? ` (→ ${t.delegated_to})` : ''}`;
      })
      .join('\n');

    return `Task list updated (${finalTodos.length} items):\n${summary}`;
  }

  /**
   * Formats a concise context of the task list for the system prompt.
   */
  public getTaskContextForPrompt(): string {
    if (!this.state || !this.state.todos || this.state.todos.length === 0) {
      return '[No active task]';
    }

    const todos = this.state.todos;
    const activeTask = todos.find((t) => t.status === 'in_progress');
    const completedTasks = todos
      .filter((t) => t.status === 'completed')
      .slice(-SYSTEM_PROMPT_MAX_COMPLETED_TASKS);
    const pendingTasks = todos
      .filter((t) => t.status === 'pending')
      .slice(0, SYSTEM_PROMPT_MAX_PENDING_TASKS);
    const delegatedTasks = todos.filter((t) => t.status === 'delegated');

    let prompt = '';

    if (activeTask) {
      prompt += `📋 CURRENT ACTIVE TASK\n[${activeTask.id}] ${activeTask.content}\nStatus: ${activeTask.activeForm}...\n\n`;
    } else {
      prompt += `📋 NO ACTIVE TASK (You must start one before using other tools)\n\n`;
    }

    if (pendingTasks.length > 0) {
      prompt += `⏳ UPCOMING PENDING TASKS (Next in plan):\n`;
      pendingTasks.forEach((t) => {
        prompt += `- [${t.id}] ${t.content}\n`;
      });
      const totalPending = todos.filter((t) => t.status === 'pending').length;
      if (totalPending > pendingTasks.length) {
        prompt += `  ... (${totalPending - pendingTasks.length} more pending tasks hidden)\n`;
      }
      prompt += `\n`;
    }

    if (delegatedTasks.length > 0) {
      prompt += `🤖 DELEGATED TASKS (Waiting for worker reports):\n`;
      delegatedTasks.forEach((t) => {
        prompt += `- [${t.id}] ${t.content} (Owner: ${t.delegated_to || 'unknown'})\n`;
      });
      prompt += `\n`;
    }

    if (completedTasks.length > 0) {
      prompt += `✅ RECENTLY COMPLETED TASKS (Essential Findings):\n`;
      completedTasks.forEach((t) => {
        prompt += `- [${t.id}] ${t.content}\n  Summary: ${t.result_summary || 'No summary provided.'}\n`;
      });
      const totalCompleted = todos.filter(
        (t) => t.status === 'completed'
      ).length;
      if (totalCompleted > completedTasks.length) {
        prompt += `  ... (${totalCompleted - completedTasks.length} older completed tasks hidden)\n`;
      }
      prompt += `\n(Use these summaries to recall details that were evicted from your context window)\n`;
    }

    return prompt.trim();
  }

  /**
   * Update session state with new SDK session
   * (after compression, expiration, or restart)
   */
  public updateSDKSession(
    newSdkSession: string,
    reason: 'compression' | 'expiration' | 'restart',
    tokens?: number
  ): void {
    if (!this.state) return;

    const state = this.state;
    const lastEntry =
      state.compression_history[state.compression_history.length - 1];
    if (lastEntry && lastEntry.sdk_session === newSdkSession) {
      return;
    }

    this.state = {
      ...state,
      current_session: newSdkSession,
      last_updated: new Date().toISOString(),
      compression_history: [
        ...state.compression_history,
        {
          sdk_session: newSdkSession,
          timestamp: new Date().toISOString(),
          reason,
          tokens,
        },
      ],
    };

    this.notify();
    this.persist();
  }

  /**
   * Update session statistics
   */
  public updateStats(stats: SessionState['stats']): void {
    if (!this.state) return;

    this.state = {
      ...this.state,
      stats,
      last_updated: new Date().toISOString(),
    };

    this.notify();
    this.persist();
  }
}
