import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ProvenanceService } from '../provenance.js';
import { TransformLog } from '../../../pgc/transform-log.js';
import { TransformDAG } from '../../../pgc/transform-dag.js';
import { ObjectStore } from '../../../pgc/object-store.js';
import { Index } from '../../../pgc/index.js';
import { ReverseDeps } from '../../../pgc/reverse-deps.js';
import type { IndexData } from '../../../types/index.js';

describe('ProvenanceService', () => {
  let tempDir: string;
  let transformLog: TransformLog;
  let dag: TransformDAG;
  let objectStore: ObjectStore;
  let index: Index;
  let reverseDeps: ReverseDeps;
  let service: ProvenanceService;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      `provenance-test-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(tempDir);

    transformLog = new TransformLog(tempDir);
    dag = new TransformDAG(tempDir);
    objectStore = new ObjectStore(tempDir);
    index = new Index(tempDir);
    reverseDeps = new ReverseDeps(tempDir);

    service = new ProvenanceService(
      transformLog,
      dag,
      objectStore,
      index,
      reverseDeps
    );
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async function recordTransform(
    type: string,
    inputs: { hash: string; path?: string }[],
    outputs: { hash: string; path?: string }[]
  ): Promise<string> {
    const id = await transformLog.record({
      type,
      timestamp: new Date().toISOString(),
      method: 'ast_native',
      inputs,
      outputs,
    });
    await dag.link(id, {
      type,
      timestamp: new Date().toISOString(),
      method: 'ast_native',
      inputs,
      outputs,
      phi: 1.0,
      verification_result: { success: true, messages: [] },
    });
    // Register in reverse deps (mirrors what structural-processing.ts does)
    for (const i of inputs) await reverseDeps.add(i.hash, id);
    for (const o of outputs) await reverseDeps.add(o.hash, id);
    return id;
  }

  // ─── traceForward ─────────────────────────────────────────────────────────

  describe('traceForward', () => {
    it('returns empty chain when no transforms reference the hash', async () => {
      const chain = await service.traceForward('unknown-hash');
      expect(chain.links).toHaveLength(0);
      expect(chain.rootHash).toBe('unknown-hash');
    });

    it('traces from source file content hash to structural transform', async () => {
      const contentHash = 'content-hash-001';
      const structHash = 'struct-hash-001';

      await recordTransform(
        'genesis',
        [{ hash: contentHash, path: 'src/auth.ts' }],
        [{ hash: structHash, path: '.open_cognition/objects/...' }]
      );

      const chain = await service.traceForward(contentHash);
      expect(chain.links).toHaveLength(1);
      expect(chain.links[0].inputHashes).toContain(contentHash);
      expect(chain.links[0].outputHashes).toContain(structHash);
      expect(chain.links[0].transformType).toBe('genesis');
    });

    it('follows a multi-step chain: file → structural → overlay', async () => {
      const contentHash = 'c-hash';
      const structHash = 's-hash';
      const overlayHash = 'o-hash';

      await recordTransform(
        'genesis',
        [{ hash: contentHash }],
        [{ hash: structHash }]
      );
      await recordTransform(
        'embed',
        [{ hash: structHash }],
        [{ hash: overlayHash }]
      );

      const chain = await service.traceForward(contentHash);
      expect(chain.links).toHaveLength(2);
      const types = chain.links.map((l) => l.transformType);
      expect(types).toContain('genesis');
      expect(types).toContain('embed');
    });
  });

  // ─── traceBackward ────────────────────────────────────────────────────────

  describe('traceBackward', () => {
    it('returns empty chain for a hash not produced by any transform', async () => {
      const chain = await service.traceBackward('no-producer');
      expect(chain.links).toHaveLength(0);
    });

    it('traces from O₁ pattern hash back to source file', async () => {
      const contentHash = 'c-hash-back';
      const structHash = 's-hash-back';
      const overlayHash = 'o-hash-back';

      await recordTransform(
        'genesis',
        [{ hash: contentHash }],
        [{ hash: structHash }]
      );
      const t2 = await recordTransform(
        'embed',
        [{ hash: structHash }],
        [{ hash: overlayHash }]
      );

      const chain = await service.traceBackward(overlayHash);
      expect(chain.links.length).toBeGreaterThanOrEqual(1);
      const transformIds = chain.links.map((l) => l.transformId);
      expect(transformIds).toContain(t2);
    });
  });

  // ─── verifyChain ──────────────────────────────────────────────────────────

  describe('verifyChain', () => {
    it('returns success=true when all objects are present', async () => {
      const content = 'export const x = 1;';
      const contentHash = objectStore.computeHash(content);
      await objectStore.store(content);

      const structContent = JSON.stringify({ classes: [] });
      const structHash = objectStore.computeHash(structContent);
      await objectStore.store(structContent);

      await recordTransform(
        'genesis',
        [{ hash: contentHash, path: 'src/x.ts' }],
        [{ hash: structHash }]
      );

      const chain = await service.traceForward(contentHash);
      const result = await service.verifyChain(chain);

      expect(result.success).toBe(true);
      expect(result.missingObjects).toHaveLength(0);
      expect(result.totalLinks).toBe(1);
    });

    it('reports BROKEN when an object is missing', async () => {
      const contentHash = 'missing-content-hash';
      const structHash = 'missing-struct-hash';

      await recordTransform(
        'genesis',
        [{ hash: contentHash }],
        [{ hash: structHash }]
      );

      const chain = await service.traceForward(contentHash);
      const result = await service.verifyChain(chain);

      expect(result.success).toBe(false);
      expect(result.missingObjects).toContain(contentHash);
      expect(result.missingObjects).toContain(structHash);
    });
  });

  // ─── getFileHistory ───────────────────────────────────────────────────────

  describe('getFileHistory', () => {
    it('returns empty transforms for a file not in index', async () => {
      const history = await service.getFileHistory('src/nonexistent.ts');
      expect(history.filePath).toBe('src/nonexistent.ts');
      expect(history.transforms).toHaveLength(0);
    });

    it('returns transforms in chronological order', async () => {
      const t1id = await transformLog.record({
        type: 'genesis',
        timestamp: '2025-01-01T00:00:00.000Z',
        method: 'ast_native',
        inputs: [],
        outputs: [],
      });
      const t2id = await transformLog.record({
        type: 'update',
        timestamp: '2025-06-01T00:00:00.000Z',
        method: 'ast_native',
        inputs: [],
        outputs: [],
      });

      // Write index entry with history
      const indexEntry: IndexData = {
        path: 'src/file.ts',
        content_hash: 'ch1',
        structural_hash: 'sh1',
        status: 'Valid',
        history: [t2id, t1id], // intentionally reversed
      };
      await index.set('src/file.ts', indexEntry);

      const history = await service.getFileHistory('src/file.ts');
      expect(history.transforms).toHaveLength(2);
      // Should be sorted oldest → newest
      expect(history.transforms[0].timestamp).toBe('2025-01-01T00:00:00.000Z');
      expect(history.transforms[1].timestamp).toBe('2025-06-01T00:00:00.000Z');
    });
  });

  // ─── analyzeImpact ────────────────────────────────────────────────────────

  describe('analyzeImpact', () => {
    it('returns zero counts for a file with no consumers', async () => {
      const entry: IndexData = {
        path: 'src/standalone.ts',
        content_hash: 'ch-s',
        structural_hash: 'sh-s',
        status: 'Valid',
        history: [],
        structuralData: {
          language: 'typescript',
          docstring: '',
          imports: [],
          classes: [],
          functions: [],
          interfaces: [],
          exports: [],
          dependencies: [],
          extraction_method: 'ast_native',
          fidelity: 1.0,
        },
      };
      await index.set('src/standalone.ts', entry);

      const impact = await service.analyzeImpact('src/standalone.ts');
      expect(impact.consumerCount).toBe(0);
      expect(impact.maxDepth).toBe(0);
      expect(impact.directConsumers).toHaveLength(0);
    });

    it('counts direct consumers from relative imports', async () => {
      // consumer.ts imports from utils.ts
      const utils: IndexData = {
        path: 'src/utils.ts',
        content_hash: 'ch-utils',
        structural_hash: 'sh-utils',
        status: 'Valid',
        history: [],
        structuralData: {
          language: 'typescript',
          docstring: '',
          imports: [],
          classes: [],
          functions: [],
          interfaces: [],
          exports: [],
          dependencies: [],
          extraction_method: 'ast_native',
          fidelity: 1.0,
        },
      };
      const consumer: IndexData = {
        path: 'src/consumer.ts',
        content_hash: 'ch-consumer',
        structural_hash: 'sh-consumer',
        status: 'Valid',
        history: [],
        structuralData: {
          language: 'typescript',
          docstring: '',
          imports: ['./utils'],
          classes: [],
          functions: [],
          interfaces: [],
          exports: [],
          dependencies: [],
          extraction_method: 'ast_native',
          fidelity: 1.0,
        },
      };
      await index.set('src/utils.ts', utils);
      await index.set('src/consumer.ts', consumer);

      const impact = await service.analyzeImpact('src/utils.ts');
      expect(impact.consumerCount).toBe(1);
      expect(impact.directConsumers).toContain('src/consumer.ts');
      expect(impact.maxDepth).toBe(1);
    });

    it('computes transitive consumer count and max depth', async () => {
      // a.ts ← b.ts ← c.ts  (c depends on b which depends on a)
      const makeEntry = (filePath: string, imports: string[]): IndexData => ({
        path: filePath,
        content_hash: `ch-${filePath}`,
        structural_hash: `sh-${filePath}`,
        status: 'Valid',
        history: [],
        structuralData: {
          language: 'typescript',
          docstring: '',
          imports,
          classes: [],
          functions: [],
          interfaces: [],
          exports: [],
          dependencies: [],
          extraction_method: 'ast_native',
          fidelity: 1.0,
        },
      });

      await index.set('src/a.ts', makeEntry('src/a.ts', []));
      await index.set('src/b.ts', makeEntry('src/b.ts', ['./a']));
      await index.set('src/c.ts', makeEntry('src/c.ts', ['./b']));

      const impact = await service.analyzeImpact('src/a.ts');
      expect(impact.consumerCount).toBe(2); // b and c
      expect(impact.directConsumers).toContain('src/b.ts');
      expect(impact.allConsumers).toContain('src/c.ts');
      expect(impact.maxDepth).toBe(2);
    });
  });
});
