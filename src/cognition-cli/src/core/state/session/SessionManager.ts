/**
 * Session Manager
 *
 * Singleton that manages active SessionStateMachines.
 */

import { SessionStateMachine } from './SessionStateMachine.js';
import { loadSessionState } from './SessionPersistence.js';

export class SessionManager {
  private static instance: SessionManager;
  private machines: Map<string, SessionStateMachine> = new Map();

  private constructor() {}

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Get or create a SessionStateMachine for the given anchor ID
   *
   * @param anchorId - Session anchor ID
   * @param projectRoot - Project root directory
   * @returns SessionStateMachine instance
   */
  public getStateMachine(
    anchorId: string,
    projectRoot: string
  ): SessionStateMachine {
    let machine = this.machines.get(anchorId);
    if (!machine) {
      const state = loadSessionState(anchorId, projectRoot);
      machine = new SessionStateMachine(state || undefined, projectRoot);
      this.machines.set(anchorId, machine);
    }
    return machine;
  }

  /**
   * Remove a machine from the manager
   */
  public dropStateMachine(anchorId: string): void {
    this.machines.delete(anchorId);
  }
}

export const sessionManager = SessionManager.getInstance();
