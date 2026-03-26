import path from 'path';
import fs from 'fs-extra';

export interface CoherenceDelta {
  before: number;
  after: number;
  drift: number;
  drifted_symbols: string[];
  aligned_symbols: string[];
  timestamp: string;
}

export class CoherenceDriftDetector {
  constructor(private pgcRoot: string) {}

  async snapshot(): Promise<number | null> {
    const manifestPath = path.join(
      this.pgcRoot,
      'overlays',
      'strategic_coherence',
      'manifest.json'
    );
    if (!(await fs.pathExists(manifestPath))) {
      return null;
    }
    try {
      const data = await fs.readJson(manifestPath);
      if (typeof data?.coherenceScore === 'number') {
        return data.coherenceScore;
      }
      if (typeof data?.overall_metrics?.lattice_coherence === 'number') {
        return data.overall_metrics.lattice_coherence;
      }
      return null;
    } catch {
      return null;
    }
  }

  async computeDelta(beforeScore: number): Promise<CoherenceDelta> {
    const afterScore = await this.snapshot();
    if (afterScore === null) {
      return {
        before: beforeScore,
        after: beforeScore,
        drift: 0,
        drifted_symbols: [],
        aligned_symbols: [],
        timestamp: new Date().toISOString(),
      };
    }
    return {
      before: beforeScore,
      after: afterScore,
      drift: afterScore - beforeScore,
      drifted_symbols: [],
      aligned_symbols: [],
      timestamp: new Date().toISOString(),
    };
  }
}
