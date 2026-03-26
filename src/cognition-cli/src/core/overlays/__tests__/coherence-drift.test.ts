import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { CoherenceDriftDetector } from '../coherence-drift.js';

describe('CoherenceDriftDetector', () => {
  let tempDir: string;
  let detector: CoherenceDriftDetector;
  let manifestDir: string;
  let manifestPath: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `coherence-drift-test-${Date.now()}`);
    manifestDir = path.join(tempDir, 'overlays', 'strategic_coherence');
    manifestPath = path.join(manifestDir, 'manifest.json');
    await fs.ensureDir(manifestDir);
    detector = new CoherenceDriftDetector(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("snapshot() returns null when overlay doesn't exist", async () => {
    const score = await detector.snapshot();
    expect(score).toBeNull();
  });

  it('snapshot() returns a number when manifest exists with lattice_coherence', async () => {
    await fs.outputJson(manifestPath, {
      coherenceScore: 0.75,
      symbolCount: 10,
    });
    const score = await detector.snapshot();
    expect(typeof score).toBe('number');
    expect(score).toBeCloseTo(0.75);
  });

  it('computeDelta() returns drift = after - before', async () => {
    await fs.outputJson(manifestPath, { coherenceScore: 0.8 });
    const delta = await detector.computeDelta(0.6);

    expect(delta.before).toBeCloseTo(0.6);
    expect(delta.after).toBeCloseTo(0.8);
    expect(delta.drift).toBeCloseTo(0.2);
    expect(delta.timestamp).toBeTruthy();
  });

  it('computeDelta() returns drift = 0 when after is null (no overlay)', async () => {
    const delta = await detector.computeDelta(0.5);

    expect(delta.before).toBeCloseTo(0.5);
    expect(delta.after).toBeCloseTo(0.5);
    expect(delta.drift).toBe(0);
    expect(delta.drifted_symbols).toEqual([]);
    expect(delta.aligned_symbols).toEqual([]);
  });

  it('drift sign: negative when coherence decreases', async () => {
    await fs.outputJson(manifestPath, { coherenceScore: 0.3 });
    const delta = await detector.computeDelta(0.7);

    expect(delta.drift).toBeLessThan(0);
    expect(delta.drift).toBeCloseTo(-0.4);
  });
});
