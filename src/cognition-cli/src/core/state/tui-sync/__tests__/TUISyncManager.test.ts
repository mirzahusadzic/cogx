import { describe, it, expect } from 'vitest';
import { TUISyncManager } from '../TUISyncManager.js';
import { TUISyncStateMachine } from '../TUISyncStateMachine.js';

describe('TUISyncManager', () => {
  it('should return a singleton instance', () => {
    const sm1 = TUISyncManager.getInstance();
    const sm2 = TUISyncManager.getInstance();
    expect(sm1).toBeInstanceOf(TUISyncStateMachine);
    expect(sm1).toBe(sm2);
  });

  it('should reset the singleton instance', () => {
    const sm1 = TUISyncManager.getInstance();
    TUISyncManager.reset();
    const sm2 = TUISyncManager.getInstance();
    expect(sm1).not.toBe(sm2);
  });

  it('should compute overlay scores correctly', () => {
    const analyses = [
      {
        overlay_scores: {
          O1_structural: 1,
          O2_security: 0.5,
          O3_lineage: 0.8,
          O4_mission: 0.2,
          O5_operational: 0.4,
          O6_mathematical: 0.6,
          O7_strategic: 1,
        },
      },
      {
        overlay_scores: {
          O1_structural: 0,
          O2_security: 0.5,
          O3_lineage: 0.2,
          O4_mission: 0.8,
          O5_operational: 0.6,
          O6_mathematical: 0.4,
          O7_strategic: 0,
        },
      },
    ];

    const scores = TUISyncManager.computeOverlayScores(analyses);

    expect(scores.O1_structural).toBe(0.5);
    expect(scores.O2_security).toBe(0.5);
    expect(scores.O3_lineage).toBe(0.5);
    expect(scores.O4_mission).toBe(0.5);
    expect(scores.O5_operational).toBe(0.5);
    expect(scores.O6_mathematical).toBe(0.5);
    expect(scores.O7_strategic).toBe(0.5);
  });

  it('should return empty scores for empty analyses', () => {
    const scores = TUISyncManager.computeOverlayScores([]);
    expect(scores.O1_structural).toBe(0);
    expect(scores.O2_security).toBe(0);
  });

  it('should handle missing scores in analyses', () => {
    const analyses = [
      {
        overlay_scores: {
          O1_structural: 1,
        },
      },
      {},
    ];

    const scores = TUISyncManager.computeOverlayScores(analyses);
    expect(scores.O1_structural).toBe(0.5);
    expect(scores.O2_security).toBe(0);
  });
});
