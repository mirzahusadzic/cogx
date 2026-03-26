import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import crypto from 'node:crypto';
import { PGCManager } from '../../pgc/manager.js';
import { TransformCompactor } from '../transform-compactor.js';
import { ProvenanceService } from '../provenance-service.js';
import { RehydrateService } from '../rehydrate-service.js';
import { StructuralMiner } from '../../orchestrators/miners/structural.js';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import { GenesisOrchestrator } from '../../orchestrators/genesis.js';
import { UpdateOrchestrator } from '../../orchestrators/update.js';
import { StructuralOracle } from '../../pgc/oracles/overlay.js';
import type { StructuralData } from '../../types/structural.js';
import type { Transformation } from '../../types/transform.js';
import { DirtyStateManager } from '../../watcher/dirty-state.js';

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
vi.mock('../../lineage/intent-resolver.js', () => ({
  IntentResolver: vi.fn().mockImplementation(() => ({
    resolve: vi.fn(async () => ({ intent: 'test intent' })),
  })),
}));

vi.mock('../../lineage/egemma-client.js', () => ({
  EGemmaClient: vi.fn().mockImplementation(() => ({})),
}));

describe('TransformCompactor E2E', () => {
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

    const genesis = new GenesisOrchestrator(
      pgc,
      miner,
      workbench,
      oracle,
      projectRoot
    );
    await genesis.executeBottomUpAggregation(['src']);

    // 2. Multiple Updates (Non-structural to avoid invalidation)
    const updateOrchestrator = new UpdateOrchestrator(
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
    const compactor = new TransformCompactor(
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
});
