/**
 * TUI Sync State Machine
 *
 * Orchestrates synchronization between background agents and the TUI.
 */

import {
  TUISyncStatus,
  TUISyncState,
  TUISyncEvent,
  TUISyncStateListener,
  OverlayScores,
  OnboardingState,
} from './types.js';
import { systemDiagnosticsService } from '../../services/diagnostics/SystemDiagnosticsService.js';

/**
 * Initial empty scores
 */
export const EMPTY_SCORES: OverlayScores = {
  O1_structural: 0,
  O2_security: 0,
  O3_lineage: 0,
  O4_mission: 0,
  O5_operational: 0,
  O6_mathematical: 0,
  O7_strategic: 0,
};

/**
 * Initial onboarding state
 */
export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  step: 'idle',
  sourceDirs: [],
  strategicDocs: [],
  ingestedDocs: [],
  currentOverlay: null,
  completedOverlays: [],
  skippedOverlays: [],
  error: null,
  needsGenesis: false,
  needsDocs: false,
  missingOverlays: [],
  confirmation: null,
};

/**
 * TUISyncStateMachine manages the TUI state and synchronization events.
 */
export class TUISyncStateMachine {
  private status: TUISyncStatus = TUISyncStatus.IDLE;
  private state: TUISyncState;
  private listeners: Set<TUISyncStateListener> = new Set();
  private error: Error | null = null;

  /**
   * Create a new TUISyncStateMachine
   */
  constructor() {
    this.state = {
      status: TUISyncStatus.IDLE,
      onboarding: { ...INITIAL_ONBOARDING_STATE },
      overlayScores: { ...EMPTY_SCORES },
      sigmaStats: {
        nodes: 0,
        edges: 0,
        paradigmShifts: 0,
        avgNovelty: 0,
        avgImportance: 0,
      },
      messages: [],
      pendingMessageCount: 0,
      monitorError: null,
      workbenchHealth: null,
      activeTask: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get the current TUI sync status
   */
  public getStatus(): TUISyncStatus {
    return this.status;
  }

  /**
   * Get the current state
   */
  public getState(): TUISyncState {
    return this.state;
  }

  /**
   * Subscribe to state transitions
   *
   * @param listener - Function to call on transition
   * @returns Unsubscribe function
   */
  public subscribe(listener: TUISyncStateListener): () => void {
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
          'tui-sync',
          'Error in TUI sync state listener',
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
    newStatus: TUISyncStatus,
    newState?: Partial<TUISyncState>,
    error?: Error
  ): void {
    const oldStatus = this.status;
    this.status = newStatus;

    if (newState) {
      this.state = {
        ...this.state,
        ...newState,
        status: newStatus,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      this.state = {
        ...this.state,
        status: newStatus,
        lastUpdated: new Date().toISOString(),
      };
    }

    if (error !== undefined) {
      this.error = error;
    } else if (newStatus !== TUISyncStatus.ERROR) {
      this.error = null;
    }

    systemDiagnosticsService.systemLog(
      'tui-sync',
      `Transition: ${oldStatus} -> ${newStatus}`,
      {
        step: this.state.onboarding.step,
        error: error?.message,
      },
      'debug'
    );

    this.notify();
  }

  /**
   * Handle a TUI sync event and trigger state transitions
   *
   * @param event - The event to handle
   */
  public handleEvent(event: TUISyncEvent): void {
    switch (event.type) {
      case 'WIZARD_START':
        this.transition(TUISyncStatus.ONBOARDING, {
          onboarding: {
            ...this.state.onboarding,
            step: 'detect',
            sourceDirs: event.sourceDirs || this.state.onboarding.sourceDirs,
          },
        });
        break;

      case 'WIZARD_STEP_CHANGE':
        this.transition(TUISyncStatus.ONBOARDING, {
          onboarding: {
            ...this.state.onboarding,
            step: event.step,
          },
        });
        break;

      case 'WIZARD_CONFIRM_SHOW':
        this.transition(TUISyncStatus.ONBOARDING, {
          onboarding: {
            ...this.state.onboarding,
            confirmation: event.confirmation,
          },
        });
        break;

      case 'WIZARD_CONFIRM_ACTION':
        this.transition(TUISyncStatus.ONBOARDING, {
          onboarding: {
            ...this.state.onboarding,
            confirmation: this.state.onboarding.confirmation
              ? { ...this.state.onboarding.confirmation, pending: false }
              : null,
          },
        });
        break;

      case 'WIZARD_SELECTION_MOVE': {
        const confirmation = this.state.onboarding.confirmation;
        if (
          !confirmation ||
          confirmation.mode !== 'select' ||
          !confirmation.items
        )
          break;

        const currentIdx = confirmation.selectedIndex ?? 0;
        let newIdx;
        if (event.direction === 'up') {
          newIdx =
            currentIdx > 0 ? currentIdx - 1 : confirmation.items.length - 1;
        } else {
          newIdx =
            currentIdx < confirmation.items.length - 1 ? currentIdx + 1 : 0;
        }

        this.transition(TUISyncStatus.ONBOARDING, {
          onboarding: {
            ...this.state.onboarding,
            confirmation: {
              ...confirmation,
              selectedIndex: newIdx,
            },
          },
        });
        break;
      }

      case 'WIZARD_SELECTION_TOGGLE': {
        const confirmation = this.state.onboarding.confirmation;
        if (
          !confirmation ||
          confirmation.mode !== 'select' ||
          !confirmation.items
        )
          break;

        const currentIdx = confirmation.selectedIndex ?? 0;
        const newItems = [...confirmation.items];
        newItems[currentIdx] = {
          ...newItems[currentIdx],
          selected: !newItems[currentIdx].selected,
        };

        this.transition(TUISyncStatus.ONBOARDING, {
          onboarding: {
            ...this.state.onboarding,
            confirmation: {
              ...confirmation,
              items: newItems,
            },
          },
        });
        break;
      }

      case 'WIZARD_ERROR':
        this.transition(TUISyncStatus.ONBOARDING, {
          onboarding: {
            ...this.state.onboarding,
            error: event.error,
          },
        });
        break;

      case 'WIZARD_COMPLETE':
        this.transition(TUISyncStatus.ACTIVE, {
          onboarding: {
            ...this.state.onboarding,
            step: 'complete',
            confirmation: null,
          },
        });
        break;

      case 'OVERLAY_SCORES_UPDATE':
        this.transition(this.status, {
          overlayScores: event.scores,
        });
        break;

      case 'SIGMA_STATS_UPDATE':
        this.transition(this.status, {
          sigmaStats: event.stats,
        });
        break;

      case 'MESSAGE_ADD': {
        const messages = [...this.state.messages, event.message];
        // Keep only last 1000 messages for performance
        if (messages.length > 1000) {
          messages.shift();
        }
        this.transition(this.status, {
          messages,
        });
        break;
      }

      case 'MESSAGES_CLEAR':
        this.transition(this.status, {
          messages: [],
        });
        break;

      case 'PENDING_MESSAGES_UPDATE':
        this.transition(this.status, {
          pendingMessageCount: event.count,
        });
        break;

      case 'MONITOR_ERROR':
        this.transition(this.status, {
          monitorError: event.error,
        });
        break;

      case 'WORKBENCH_HEALTH_UPDATE':
        this.transition(this.status, {
          workbenchHealth: event.health,
        });
        break;

      case 'ACTIVE_TASK_UPDATE':
        this.transition(this.status, {
          activeTask: event.task,
        });
        break;

      case 'SYNC_ERROR':
        this.transition(TUISyncStatus.ERROR, undefined, event.error);
        break;

      default:
        systemDiagnosticsService.systemLog(
          'tui-sync',
          `Unknown event type: ${(event as { type: string }).type}`,
          {},
          'error'
        );
    }
  }

  /**
   * Update onboarding data from external detection or background tasks
   */
  public updateOnboarding(data: Partial<OnboardingState>): void {
    this.transition(this.status, {
      onboarding: {
        ...this.state.onboarding,
        ...data,
      },
    });
  }
}
