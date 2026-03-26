import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'node:crypto';
import { TransformLog } from '../../pgc/transform-log.js';
import { TransformCompactor } from '../transform-compactor.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a transform in the log with configurable metadata.
 */
async function createTransform(
  log: TransformLog,
  opts: {
    timestamp?: string;
    sourceType?: 'developer' | 'ai_agent' | 'automated' | 'system';
    intent?: string;
    filePath?: string;
    invalidate?: boolean;
  }
): Promise<string> {
  const id = await log.record({
    type: 'update',
    timestamp: opts.timestamp ?? new Date().toISOString(),
    source: opts.sourceType ? { type: opts.sourceType } : undefined,
    reasoning: opts.intent ? { intent: opts.intent } : undefined,
    inputs: [
      {
        path: opts.filePath ?? 'src/foo.ts',
        hash: crypto.randomBytes(16).toString('hex'),
      },
    ],
    outputs: [
      {
        path: opts.filePath ?? 'src/foo.ts',
        hash: crypto.randomBytes(16).toString('hex'),
      },
    ],
    goal: { objective: 'test', criteria: [], phimin: 0.8 },
    method: 'test',
  });
  if (opts.invalidate) await log.invalidate(id, 'test invalidation');
  return id;
}

/** ISO timestamp N days ago */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

// ─── Setup ──────────────────────────────────────────────────────────────────

describe('TransformCompactor', () => {
  let tempDir: string;
  let log: TransformLog;
  let compactor: TransformCompactor;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      `compactor-test-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(tempDir);
    log = new TransformLog(tempDir);
    compactor = new TransformCompactor(log);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  // ─── scan() tests ─────────────────────────────────────────────────────────

  it('scan() with empty transform log returns an empty plan (all zeros)', async () => {
    const plan = await compactor.scan({});
    expect(plan.toInvalidated).toHaveLength(0);
    expect(plan.toIntermediate).toHaveLength(0);
    expect(plan.endpointsPreserved).toHaveLength(0);
    expect(plan.skippedAiAgent).toBe(0);
    expect(plan.skippedTooRecent).toBe(0);
    expect(plan.squashGroups.size).toBe(0);
  });

  it('scan() skips ai_agent transforms and counts them in skippedAiAgent', async () => {
    await createTransform(log, {
      timestamp: daysAgo(120),
      sourceType: 'ai_agent',
      filePath: 'src/agent.ts',
    });
    await createTransform(log, {
      timestamp: daysAgo(120),
      sourceType: 'developer',
      filePath: 'src/agent.ts',
    });

    const plan = await compactor.scan({ minAgeDays: 90 });

    expect(plan.skippedAiAgent).toBe(1);
    // The developer transform is an endpoint (only one in its group)
    expect(plan.endpointsPreserved).toHaveLength(1);
  });

  it('scan() skips transforms newer than minAgeDays and counts them in skippedTooRecent', async () => {
    await createTransform(log, {
      timestamp: daysAgo(10),
      filePath: 'src/new.ts',
    });
    await createTransform(log, {
      timestamp: daysAgo(200),
      filePath: 'src/old.ts',
    });

    const plan = await compactor.scan({ minAgeDays: 90 });

    expect(plan.skippedTooRecent).toBe(1);
    expect(plan.endpointsPreserved).toHaveLength(1);
  });

  it('scan() skips transforms newer than the `before` date', async () => {
    const before = new Date('2025-01-01');
    await createTransform(log, {
      timestamp: '2025-03-01T00:00:00.000Z',
      filePath: 'src/after.ts',
    });
    await createTransform(log, {
      timestamp: '2024-06-01T00:00:00.000Z',
      filePath: 'src/before.ts',
    });

    const plan = await compactor.scan({ before, minAgeDays: 0 });

    // The march 2025 transform should be skipped
    expect(plan.skippedTooRecent).toBe(1);
    expect(plan.endpointsPreserved).toHaveLength(1);
  });

  it('scan() preserves first and last transform per file as endpoints', async () => {
    const file = 'src/multi.ts';
    const id1 = await createTransform(log, {
      timestamp: daysAgo(300),
      filePath: file,
    });
    const id2 = await createTransform(log, {
      timestamp: daysAgo(200),
      filePath: file,
    });
    const id3 = await createTransform(log, {
      timestamp: daysAgo(100),
      filePath: file,
    });

    const plan = await compactor.scan({ minAgeDays: 90 });

    expect(plan.endpointsPreserved).toContain(id1);
    expect(plan.endpointsPreserved).toContain(id3);
    expect(plan.endpointsPreserved).not.toContain(id2);
  });

  it('scan() identifies middle transforms as intermediate (squashable)', async () => {
    const file = 'src/squash.ts';
    await createTransform(log, { timestamp: daysAgo(300), filePath: file });
    const middle = await createTransform(log, {
      timestamp: daysAgo(200),
      filePath: file,
    });
    await createTransform(log, { timestamp: daysAgo(100), filePath: file });

    const plan = await compactor.scan({ minAgeDays: 90 });

    expect(plan.toIntermediate).toContain(middle);
    expect(plan.squashGroups.get(file)).toContain(middle);
  });

  it('scan() puts invalidated transforms in toInvalidated', async () => {
    const id = await createTransform(log, {
      timestamp: daysAgo(200),
      filePath: 'src/inv.ts',
      invalidate: true,
    });

    const plan = await compactor.scan({ minAgeDays: 90 });

    expect(plan.toInvalidated).toContain(id);
    expect(plan.toIntermediate).not.toContain(id);
    expect(plan.endpointsPreserved).not.toContain(id);
  });

  it('scan() handles transforms with no inputs (groups under __no_input__)', async () => {
    // Record a transform with empty inputs array directly
    const id = await log.record({
      type: 'update',
      timestamp: daysAgo(200),
      inputs: [],
      outputs: [],
      goal: { objective: 'test', criteria: [], phimin: 0.8 },
      method: 'test',
    });

    const plan = await compactor.scan({ minAgeDays: 90 });

    expect(plan.endpointsPreserved).toContain(id);
    // Group key is __no_input__
    const group = plan.squashGroups.get('__no_input__');
    // Only one transform in group → endpoint only, no intermediates
    expect(group).toBeUndefined();
  });

  // ─── compact() tests ──────────────────────────────────────────────────────

  it('compact() dryRun: purged/squashed/summariesGenerated = 0, dryRun = true', async () => {
    const file = 'src/dry.ts';
    await createTransform(log, { timestamp: daysAgo(300), filePath: file });
    await createTransform(log, { timestamp: daysAgo(200), filePath: file });
    await createTransform(log, { timestamp: daysAgo(100), filePath: file });
    await createTransform(log, {
      timestamp: daysAgo(150),
      filePath: file,
      invalidate: true,
    });

    const plan = await compactor.scan({ minAgeDays: 90 });
    const result = await compactor.compact(plan, { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.purged).toBe(0);
    expect(result.squashed).toBe(0);
    expect(result.summariesGenerated).toBe(0);
  });

  it('compact() purges all invalidated transforms', async () => {
    const inv1 = await createTransform(log, {
      timestamp: daysAgo(200),
      invalidate: true,
    });
    const inv2 = await createTransform(log, {
      timestamp: daysAgo(300),
      invalidate: true,
    });

    const plan = await compactor.scan({ minAgeDays: 90 });
    const result = await compactor.compact(plan, { dryRun: false });

    expect(result.purged).toBe(2);
    expect(await log.exists(inv1)).toBe(false);
    expect(await log.exists(inv2)).toBe(false);
  });

  it('compact() squashes intermediates: middle transforms purged', async () => {
    const file = 'src/squash2.ts';
    await createTransform(log, { timestamp: daysAgo(300), filePath: file });
    const middle = await createTransform(log, {
      timestamp: daysAgo(200),
      filePath: file,
    });
    await createTransform(log, { timestamp: daysAgo(100), filePath: file });

    const plan = await compactor.scan({ minAgeDays: 90 });
    await compactor.compact(plan, { dryRun: false });

    expect(await log.exists(middle)).toBe(false);
  });

  it('compact() generates summary transforms with concatenated intent narrative', async () => {
    const file = 'src/narrative.ts';
    await createTransform(log, {
      timestamp: daysAgo(300),
      filePath: file,
      intent: 'first',
    });
    await createTransform(log, {
      timestamp: daysAgo(200),
      filePath: file,
      intent: 'middle',
    });
    await createTransform(log, {
      timestamp: daysAgo(100),
      filePath: file,
      intent: 'last',
    });

    const plan = await compactor.scan({ minAgeDays: 90 });
    const result = await compactor.compact(plan, { dryRun: false });

    expect(result.summariesGenerated).toBe(1);

    // Load all transforms and find the squash_summary
    const ids = await log.getAllTransformIds();
    let summaryTx = null;
    for (const id of ids) {
      const tx = await log.getTransformation(id);
      if (tx?.type === 'squash_summary') {
        summaryTx = tx;
        break;
      }
    }
    expect(summaryTx).not.toBeNull();
    expect(summaryTx!.reasoning?.intent).toBe('middle');
  });

  it('compact() preserves endpoint transforms (first + last not purged)', async () => {
    const file = 'src/endpoints.ts';
    const first = await createTransform(log, {
      timestamp: daysAgo(300),
      filePath: file,
    });
    await createTransform(log, { timestamp: daysAgo(200), filePath: file });
    const last = await createTransform(log, {
      timestamp: daysAgo(100),
      filePath: file,
    });

    const plan = await compactor.scan({ minAgeDays: 90 });
    await compactor.compact(plan, { dryRun: false });

    expect(await log.exists(first)).toBe(true);
    expect(await log.exists(last)).toBe(true);
  });

  it('compact() summary transform has source.type = "system"', async () => {
    const file = 'src/source.ts';
    await createTransform(log, { timestamp: daysAgo(300), filePath: file });
    await createTransform(log, { timestamp: daysAgo(200), filePath: file });
    await createTransform(log, { timestamp: daysAgo(100), filePath: file });

    const plan = await compactor.scan({ minAgeDays: 90 });
    await compactor.compact(plan, { dryRun: false });

    const ids = await log.getAllTransformIds();
    let summaryTx = null;
    for (const id of ids) {
      const tx = await log.getTransformation(id);
      if (tx?.type === 'squash_summary') {
        summaryTx = tx;
        break;
      }
    }
    expect(summaryTx).not.toBeNull();
    expect(summaryTx!.source?.type).toBe('system');
    expect(summaryTx!.source?.identifier).toBe('transform-compactor');
  });

  it('compact() summary transform reasoning.intent contains parts of original intents', async () => {
    const file = 'src/intents.ts';
    await createTransform(log, {
      timestamp: daysAgo(400),
      filePath: file,
      intent: 'alpha intent',
    });
    await createTransform(log, {
      timestamp: daysAgo(300),
      filePath: file,
      intent: 'beta intent',
    });
    await createTransform(log, {
      timestamp: daysAgo(200),
      filePath: file,
      intent: 'gamma intent',
    });
    await createTransform(log, {
      timestamp: daysAgo(100),
      filePath: file,
      intent: 'delta intent',
    });

    const plan = await compactor.scan({ minAgeDays: 90 });
    await compactor.compact(plan, { dryRun: false });

    const ids = await log.getAllTransformIds();
    let summaryTx = null;
    for (const id of ids) {
      const tx = await log.getTransformation(id);
      if (tx?.type === 'squash_summary') {
        summaryTx = tx;
        break;
      }
    }
    expect(summaryTx).not.toBeNull();
    const intent = summaryTx!.reasoning?.intent ?? '';
    // Middle intents (beta and gamma) should appear; alpha and delta are endpoints
    expect(intent).toContain('beta intent');
    expect(intent).toContain('gamma intent');
  });

  it('compact() returns correct skippedAiAgent count from plan', async () => {
    await createTransform(log, {
      timestamp: daysAgo(200),
      sourceType: 'ai_agent',
    });
    await createTransform(log, {
      timestamp: daysAgo(200),
      sourceType: 'developer',
    });

    const plan = await compactor.scan({ minAgeDays: 90 });
    const result = await compactor.compact(plan, { dryRun: false });

    expect(result.skippedAiAgent).toBe(1);
  });

  it('compact() returns correct endpointsPreserved count', async () => {
    const file = 'src/ep.ts';
    await createTransform(log, { timestamp: daysAgo(300), filePath: file });
    await createTransform(log, { timestamp: daysAgo(200), filePath: file });
    await createTransform(log, { timestamp: daysAgo(100), filePath: file });

    const plan = await compactor.scan({ minAgeDays: 90 });
    const result = await compactor.compact(plan, { dryRun: false });

    expect(result.endpointsPreserved).toBe(2);
  });
});
