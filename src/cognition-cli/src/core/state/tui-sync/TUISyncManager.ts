/**
 * TUI Sync Manager
 *
 * Singleton manager for the TUI sync state machine.
 */

import { TUISyncStateMachine } from './TUISyncStateMachine.js';
import { OverlayScores } from './types.js';

/**
 * TUISyncManager provides a singleton instance of the TUISyncStateMachine.
 */
export class TUISyncManager {
  private static instance: TUISyncStateMachine | null = null;

  /**
   * Get the singleton instance of the TUISyncStateMachine
   */
  public static getInstance(): TUISyncStateMachine {
    if (!this.instance) {
      this.instance = new TUISyncStateMachine();
    }
    return this.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  public static reset(): void {
    this.instance = null;
    tuiSyncManager = this.getInstance();
  }

  /**
   * Compute overlay scores from a list of turn analyses.
   *
   * @param analyses - List of turn analyses
   * @returns Computed average overlay scores
   */
  public static computeOverlayScores(
    analyses: Array<{
      overlay_scores?: Record<string, number | undefined> | unknown;
    }>
  ): OverlayScores {
    if (analyses.length === 0) {
      return {
        O1_structural: 0,
        O2_security: 0,
        O3_lineage: 0,
        O4_mission: 0,
        O5_operational: 0,
        O6_mathematical: 0,
        O7_strategic: 0,
      };
    }

    const totalTurns = analyses.length;
    const scores = {
      O1_structural: 0,
      O2_security: 0,
      O3_lineage: 0,
      O4_mission: 0,
      O5_operational: 0,
      O6_mathematical: 0,
      O7_strategic: 0,
    };

    for (const analysis of analyses) {
      const os = (analysis.overlay_scores || {}) as Record<
        string,
        number | undefined
      >;
      scores.O1_structural += os.O1_structural || 0;
      scores.O2_security += os.O2_security || 0;
      scores.O3_lineage += os.O3_lineage || 0;
      scores.O4_mission += os.O4_mission || 0;
      scores.O5_operational += os.O5_operational || 0;
      scores.O6_mathematical += os.O6_mathematical || 0;
      scores.O7_strategic += os.O7_strategic || 0;
    }

    return {
      O1_structural: scores.O1_structural / totalTurns,
      O2_security: scores.O2_security / totalTurns,
      O3_lineage: scores.O3_lineage / totalTurns,
      O4_mission: scores.O4_mission / totalTurns,
      O5_operational: scores.O5_operational / totalTurns,
      O6_mathematical: scores.O6_mathematical / totalTurns,
      O7_strategic: scores.O7_strategic / totalTurns,
    };
  }
}

/**
 * Global singleton instance
 */
export let tuiSyncManager = TUISyncManager.getInstance();
