import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import crypto from 'node:crypto';
import { PGCManager } from '../../../pgc/manager.js';
import { TransformCompactionService } from '../compaction.js';
import { ProvenanceService } from '../provenance.js';
import { RehydrateService } from '../rehydrate.js';
import { StructuralMiner } from '../../../orchestrators/miners/structural.js';
import { WorkbenchClient } from '../../../executors/workbench-client.js';
import { GenesisService } from '../../orchestration/genesis.js';
import { IncrementalUpdateService } from '../../orchestration/update.js';
import { StructuralOracle } from '../../../pgc/oracles/overlay.js';
import type { StructuralData } from '../../../types/structural.js';
import type { Transformation } from '../../../types/transform.js';
import { DirtyStateManager } from '../../../watcher/dirty-state.js';

// Mock workerpool to avoid real worker creation in tests
vi.mock('workerpool', () => ({
  pool: vi.fn(() => ({
    exec: vi.fn(async () => ({
      status: 'success',
      relativePath: 'mocked',
      structuralData: null,
    })),
    terminate: vi.fn(async () => {}),
  })),
}));

// Mock proper-lockfile
vi.mock('proper-lockfile', () => ({
  default: {
    lock: vi.fn(async () => vi.fn(async () => {})),
  },
}));

// Mock IntentResolver and EGemmaClient to avoid real LLM calls
vi.mock('../../../lineage/intent-resolver.js', () => ({
  IntentResolver: class {
    async resolve() {
      return { intent: 'test intent' };
    }
  },
}));

vi.mock('../../../lineage/egemma-client.js', () => ({
  EGemmaClient: class {},
}));

describe('TransformCompactionService E2E', () => {
  let tempDir: string;
  let pgc: PGCManager;
  let miner: StructuralMiner;
  let workbench: WorkbenchClient;
  let oracle: StructuralOracle;
  let projectRoot: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compactor-e2e-'));
    projectRoot = tempDir;

    // Init git repo
    execSync('git init', { cwd: projectRoot });
    execSync('git config user.email "test@example.com"', { cwd: projectRoot });
    execSync('git config user.name "Test User"', { cwd: projectRoot });

    // Mock services
    miner = {
      extractStructure: vi.fn(async (file) => {
        // Return stable structural data unless it's the very first time?
        // Actually, just return stable data without the content-dependent parts
        return {
          extraction_method: 'ast_native',
          fidelity: 1.0,
          language: file.language,
          docstring: '',
          source_file: {
            path: file.path,
            relativePath: file.relativePath,
            name: file.name,
            language: file.language,
            // DO NOT include content here to keep structural hash stable
          },
          imports: [],
          classes: [],
          functions: [],
          exports: [],
          declarations: [],
          dependencies: [],
        } as unknown as StructuralData;
      }),
    } as unknown as StructuralMiner;

    workbench = {
      health: vi.fn(async () => ({ status: 'ok' })),
      getBaseUrl: vi.fn(() => 'http://localhost:8000'),
    } as unknown as WorkbenchClient;

    oracle = {
      verify: vi.fn(async () => ({ success: true, messages: [] })),
    } as unknown as StructuralOracle;

    pgc = new PGCManager(projectRoot);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
    vi.restoreAllMocks();
  });

  it('should squash a chain of transforms and maintain provenance integrity', async () => {
    const filePath = 'src/test.ts';
    const fullPath = path.join(projectRoot, filePath);
    await fs.ensureDir(path.dirname(fullPath));

    // 1. Genesis
    const content1 = 'export const a = 1;';
    await fs.writeFile(fullPath, content1);
    execSync(`git add ${filePath} && git commit -m "initial commit"`, {
      cwd: projectRoot,
    });

    const genesis = new GenesisService(
      pgc,
      miner,
      workbench,
      oracle,
      projectRoot
    );
    await genesis.executeBottomUpAggregation(['src']);

    // 2. Multiple Updates (Non-structural to avoid invalidation)
    const updateOrchestrator = new IncrementalUpdateService(
      pgc,
      miner,
      workbench,
      oracle,
      projectRoot
    );
    const dirtyManager = new DirtyStateManager(pgc.pgcRoot);

    for (let i = 2; i <= 5; i++) {
      const oldContent = await fs.readFile(fullPath, 'utf-8');
      const tracked_hash = crypto
        .createHash('sha256')
        .update(oldContent)
        .digest('hex');

      // Update with a comment change only (same structural hash from mock)
      const newContent = `export const a = 1; // update ${i}`;
      await fs.writeFile(fullPath, newContent);
      execSync(`git add ${filePath} && git commit -m "update ${i}"`, {
        cwd: projectRoot,
      });

      const current_hash = crypto
        .createHash('sha256')
        .update(newContent)
        .digest('hex');

      // Simulate file watcher writing dirty state
      await dirtyManager.addDirty({
        path: filePath,
        tracked_hash,
        current_hash,
        detected_at: new Date().toISOString(),
        change_type: 'modified',
      });
      await updateOrchestrator.run();
    }

    // Verify initial state
    const allInitialIds = await pgc.transformLog.getAllTransformIds();
    const history: { id: string; tx: Transformation }[] = [];
    for (const id of allInitialIds) {
      const tx = await pgc.transformLog.getTransformation(id);
      if (tx) history.push({ id, tx });
    }
    // Sort by timestamp to identify Genesis and Latest
    history.sort(
      (a, b) =>
        new Date(a.tx.timestamp).getTime() - new Date(b.tx.timestamp).getTime()
    );

    // We expect 5 transforms (Genesis + 4 Updates)
    expect(history.length).toBe(5);

    const genesisId = history[0].id;
    const latestId = history[4].id;

    // Verify ReverseDeps has all of them
    for (const item of history) {
      if (item.tx.outputs[0]) {
        const owners = await pgc.reverseDeps.getTransformIds(
          item.tx.outputs[0].hash
        );
        expect(owners).toContain(item.id);
      }
    }

    // 3. Compact
    const compactor = new TransformCompactionService(
      pgc.transformLog,
      pgc.reverseDeps,
      pgc.transformDAG,
      pgc.index
    );

    // Scan - all should be eligible for squash if we set minAge to 0
    const plan = await compactor.scan({ minAgeDays: 0 });
    expect(plan.toIntermediate.length).toBeGreaterThan(0);
    expect(plan.squashGroups.size).toBe(1); // One group for src/test.ts

    // Execute compaction
    const result = await compactor.compact(plan, { dryRun: false });
    expect(result.summariesGenerated).toBe(1);
    expect(result.squashed).toBe(3); // T2, T3, T4

    // 4. Verify post-compaction state
    const newIds = await pgc.transformLog.getAllTransformIds();
    // Should have: Genesis, Summary, Latest
    expect(newIds.length).toBe(3);

    // Find summary ID
    let summaryId = '';
    for (const id of newIds) {
      const t = await pgc.transformLog.getTransformation(id);
      if (t?.type === 'squash_summary') {
        summaryId = id;
        break;
      }
    }
    expect(summaryId).not.toBe('');

    expect(newIds).toContain(genesisId);
    expect(newIds).toContain(latestId);
    expect(newIds).toContain(summaryId);

    // Verify intermediate IDs are gone from disk
    for (let i = 1; i <= 3; i++) {
      const id = history[i].id;
      expect(newIds).not.toContain(id);
      const exists = await fs.pathExists(
        path.join(
          projectRoot,
          '.open_cognition',
          'transforms',
          id.slice(0, 2),
          id.slice(2)
        )
      );
      expect(exists).toBe(false);
    }

    // Verify ReverseDeps is updated
    const summaryTransform =
      await pgc.transformLog.getTransformation(summaryId);
    expect(summaryTransform).toBeDefined();

    // Check Summary outputs are in ReverseDeps
    for (const output of summaryTransform!.outputs) {
      const owners = await pgc.reverseDeps.getTransformIds(output.hash);
      expect(owners).toContain(summaryId);
    }

    // Check intermediate hashes no longer point to the old transforms
    for (let i = 1; i <= 3; i++) {
      const oldId = history[i].id;
      // We know the outputs of the old transform from our history array
      const oldOutputs = history[i].tx.outputs;
      for (const output of oldOutputs) {
        const owners = await pgc.reverseDeps.getTransformIds(output.hash);
        expect(owners).not.toContain(oldId);
      }
    }

    // 5. Verify Lineage (Index History)
    // Verify we can traverse from latest back to genesis via Index history
    const historyData = await pgc.index.get('src/test.ts');
    expect(historyData).toBeDefined();
    const historyIds = historyData!.history;

    // Should be [Genesis, Summary, Latest]
    expect(historyIds).toHaveLength(3);
    expect(historyIds[0]).toBe(genesisId);
    expect(historyIds[1]).toBe(summaryId);
    expect(historyIds[2]).toBe(latestId);

    // Verify ProvenanceService can still reconstruct the chain
    const provenanceService = new ProvenanceService(
      pgc.transformLog,
      pgc.transformDAG,
      pgc.objectStore,
      pgc.index,
      pgc.reverseDeps
    );
    const fileHistory = await provenanceService.getFileHistory('src/test.ts');
    expect(fileHistory.transforms).toHaveLength(3);
    expect(fileHistory.transforms[1].transformId).toBe(summaryId);

    // 6. Test Rehydrate Interaction
    // If we rehydrate now, it should NOT re-add the intermediate transforms
    // that were just compacted, because they are represented by the summary.
    // However, the current rehydrate logic only checks ReverseDeps.
    // Since we removed intermediates from ReverseDeps, rehydrate might try to add them back.
    const rehydrateService = new RehydrateService(pgc);
    const rehydrateResults = await rehydrateService.rehydrate();

    // We expect 0 new transforms if the system correctly identifies that
    // the Git history is already covered by the summary.
    // (Note: This might fail initially, proving we need a fix)
    expect(rehydrateResults.recordedCount).toBe(0);
  });

  it('should clean up invalidated transforms from Index history', async () => {
    const filePath = 'src/test.ts';
    const fullPath = path.join(projectRoot, filePath);
    await fs.ensureDir(path.dirname(fullPath));

    // 1. Genesis
    await fs.writeFile(fullPath, 'export const a = 1;');
    execSync(`git add ${filePath} && git commit -m "initial commit"`, {
      cwd: projectRoot,
    });
    const genesis = new GenesisService(
      pgc,
      miner,
      workbench,
      oracle,
      projectRoot
    );
    await genesis.executeBottomUpAggregation(['src']);

    // 2. An update that will be invalidated
    const updateOrchestrator = new IncrementalUpdateService(
      pgc,
      miner,
      workbench,
      oracle,
      projectRoot
    );
    const dirtyManager = new DirtyStateManager(pgc.pgcRoot);

    const oldContent = 'export const a = 1;';
    const tracked_hash = crypto
      .createHash('sha256')
      .update(oldContent)
      .digest('hex');
    const newContent = 'export const a = 2;';
    await fs.writeFile(fullPath, newContent);
    execSync(`git add ${filePath} && git commit -m "update to 2"`, {
      cwd: projectRoot,
    });
    const current_hash = crypto
      .createHash('sha256')
      .update(newContent)
      .digest('hex');

    await dirtyManager.addDirty({
      path: filePath,
      tracked_hash,
      current_hash,
      detected_at: new Date().toISOString(),
      change_type: 'modified',
    });
    await updateOrchestrator.run();

    const allIds = await pgc.transformLog.getAllTransformIds();
    expect(allIds).toHaveLength(2);
    const updateId = allIds.find((id) => id !== allIds[0]); // Find the non-genesis ID

    // 3. Manually invalidate the update
    await pgc.transformLog.invalidate(updateId!);

    // 4. Verify it's in history
    const historyBefore = await pgc.index.get(filePath);
    expect(historyBefore!.history).toContain(updateId);

    // 5. Compact
    const compactor = new TransformCompactionService(
      pgc.transformLog,
      pgc.reverseDeps,
      pgc.transformDAG,
      pgc.index
    );
    const plan = await compactor.scan({ minAgeDays: 0 });
    expect(plan.toInvalidated).toContain(updateId);

    await compactor.compact(plan, { dryRun: false });

    // 6. Verify it's removed from history
    const historyAfter = await pgc.index.get(filePath);
    expect(historyAfter!.history).not.toContain(updateId);
    expect(historyAfter!.history).toHaveLength(1); // Only genesis remains
  });

  it('should update Index history for ALL files in a multi-file transform', async () => {
    // This case is harder to simulate because IncrementalUpdateService is per-file.
    // We'll manually record a multi-file transform.
    const fileA = 'src/A.ts';
    const fileB = 'src/B.ts';

    const mockStructuralData = {
      type: 'source_file',
      language: 'typescript',
      docstring: '',
      imports: [],
      classes: [],
      functions: [],
      extraction_method: 'ast_native',
      fidelity: 1,
    };

    // Genesis for both
    await fs.ensureDir(path.join(projectRoot, 'src'));
    await fs.writeFile(path.join(projectRoot, fileA), 'content A');
    await fs.writeFile(path.join(projectRoot, fileB), 'content B');

    // Manually record genesis-like transforms
    const idA1 = await pgc.recordTransform({
      type: 'genesis',
      goal: { objective: 'init A', criteria: [], phimin: 0 },
      phi: 1,
      verification_result: { success: true, messages: [] },
      inputs: [{ path: fileA, hash: 'hashA0' }],
      outputs: [{ path: fileA, hash: 'hashA1' }],
      timestamp: new Date(Date.now() - 10000).toISOString(),
    });
    await pgc.index.set(fileA, {
      path: fileA,
      content_hash: 'hashA1',
      structural_hash: 'structA1',
      status: 'Valid',
      history: [idA1],
      structuralData: mockStructuralData as unknown as StructuralData,
    });

    const idB1 = await pgc.recordTransform({
      type: 'genesis',
      goal: { objective: 'init B', criteria: [], phimin: 0 },
      phi: 1,
      verification_result: { success: true, messages: [] },
      inputs: [{ path: fileB, hash: 'hashB0' }],
      outputs: [{ path: fileB, hash: 'hashB1' }],
      timestamp: new Date(Date.now() - 10000).toISOString(),
    });
    await pgc.index.set(fileB, {
      path: fileB,
      content_hash: 'hashB1',
      structural_hash: 'structB1',
      status: 'Valid',
      history: [idB1],
      structuralData: mockStructuralData as unknown as StructuralData,
    });

    // Record a multi-file intermediate transform
    const idMulti = await pgc.recordTransform({
      type: 'structural',
      goal: { objective: 'update both', criteria: [], phimin: 0 },
      phi: 1,
      verification_result: { success: true, messages: [] },
      inputs: [
        { path: fileA, hash: 'hashA1' },
        { path: fileB, hash: 'hashB1' },
      ],
      outputs: [
        { path: fileA, hash: 'hashA2' },
        { path: fileB, hash: 'hashB2' },
      ],
      timestamp: new Date(Date.now() - 5000).toISOString(),
    });

    // Update indices
    const idxA = await pgc.index.get(fileA);
    await pgc.index.set(fileA, {
      ...idxA!,
      history: [...idxA!.history, idMulti],
      content_hash: 'hashA2',
    });
    const idxB = await pgc.index.get(fileB);
    await pgc.index.set(fileB, {
      ...idxB!,
      history: [...idxB!.history, idMulti],
      content_hash: 'hashB2',
    });

    // Record latest transforms for both (to keep idMulti intermediate)
    const idA3 = await pgc.recordTransform({
      type: 'structural',
      goal: { objective: 'update A', criteria: [], phimin: 0 },
      phi: 1,
      verification_result: { success: true, messages: [] },
      inputs: [{ path: fileA, hash: 'hashA2' }],
      outputs: [{ path: fileA, hash: 'hashA3' }],
      timestamp: new Date().toISOString(),
    });
    const curIdxA = await pgc.index.get(fileA);
    await pgc.index.set(fileA, {
      ...curIdxA!,
      history: [idA1, idMulti, idA3],
      content_hash: 'hashA3',
    });

    const idB3 = await pgc.recordTransform({
      type: 'structural',
      goal: { objective: 'update B', criteria: [], phimin: 0 },
      phi: 1,
      verification_result: { success: true, messages: [] },
      inputs: [{ path: fileB, hash: 'hashB2' }],
      outputs: [{ path: fileB, hash: 'hashB3' }],
      timestamp: new Date().toISOString(),
    });
    const curIdxB = await pgc.index.get(fileB);
    await pgc.index.set(fileB, {
      ...curIdxB!,
      history: [idB1, idMulti, idB3],
      content_hash: 'hashB3',
    });

    // Verify setup
    expect((await pgc.index.get(fileA))!.history).toContain(idMulti);
    expect((await pgc.index.get(fileB))!.history).toContain(idMulti);

    // Compact
    const compactor = new TransformCompactionService(
      pgc.transformLog,
      pgc.reverseDeps,
      pgc.transformDAG,
      pgc.index
    );
    const plan = await compactor.scan({ minAgeDays: 0 });

    // It should identify idMulti as intermediate for fileA (since it's grouping by inputs[0])
    expect(plan.toIntermediate).toContain(idMulti);

    await compactor.compact(plan, { dryRun: false });

    // Verify it's removed from BOTH histories
    const historyA = await pgc.index.get(fileA);
    const historyB = await pgc.index.get(fileB);

    expect(historyA!.history).not.toContain(idMulti);
    expect(historyB!.history).not.toContain(idMulti);

    // Both should have the same summary ID in place of idMulti
    expect(historyA!.history).toHaveLength(3);
    expect(historyB!.history).toHaveLength(3);
    expect(historyA!.history[1]).toBe(historyB!.history[1]);

    const summaryId = historyA!.history[1];
    const summaryTx = await pgc.transformLog.getTransformation(summaryId);
    expect(summaryTx?.type).toBe('squash_summary');
  });
});
