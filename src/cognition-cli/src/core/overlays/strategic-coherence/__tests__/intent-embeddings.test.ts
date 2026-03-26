import { describe, it, expect, vi } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import crypto from 'node:crypto';
import { IntentEmbeddingGenerator } from '../intent-embeddings.js';
import { Index } from '../../../pgc/index.js';
import { TransformLog } from '../../../pgc/transform-log.js';
import type { WorkbenchClient } from '../../../executors/workbench-client.js';

// Mock workerpool to prevent Vite worker parsing errors
vi.mock('workerpool', () => ({
  default: {
    pool: vi.fn(() => ({
      exec: vi.fn(),
      terminate: vi.fn(),
    })),
  },
  pool: vi.fn(() => ({
    exec: vi.fn(),
    terminate: vi.fn(),
  })),
}));

function makeWorkbenchMock(
  embedding: number[] = new Array(768).fill(0.1)
): WorkbenchClient {
  return {
    embed: vi
      .fn()
      .mockResolvedValue({ embedding, model: 'test', dimensions: 768 }),
  } as unknown as WorkbenchClient;
}

async function makeTempPgcRoot(): Promise<string> {
  const dir = path.join(
    os.tmpdir(),
    `intent-test-${crypto.randomBytes(6).toString('hex')}`
  );
  await fs.ensureDir(dir);
  return dir;
}

/** Minimal valid IndexData entry */
function makeIndexEntry(filePath: string, history: string[]) {
  return {
    path: filePath,
    content_hash: 'abc123',
    structural_hash: 'def456',
    status: 'Valid' as const,
    history,
  };
}

describe('IntentEmbeddingGenerator', () => {
  it('returns null when file is not in index', async () => {
    const pgcRoot = await makeTempPgcRoot();
    const index = new Index(pgcRoot);
    const transformLog = new TransformLog(pgcRoot);
    const workbench = makeWorkbenchMock();

    const gen = new IntentEmbeddingGenerator(index, transformLog, workbench);
    const result = await gen.generateForSymbol('MyClass', '/src/my-class.ts');

    expect(result).toBeNull();
    await fs.remove(pgcRoot);
  });

  it('returns null when file is in index but transforms have no reasoning', async () => {
    const pgcRoot = await makeTempPgcRoot();
    const index = new Index(pgcRoot);
    const transformLog = new TransformLog(pgcRoot);
    const workbench = makeWorkbenchMock();

    const transformId = await transformLog.record({
      type: 'genesis',
      timestamp: new Date().toISOString(),
      method: 'ast_native',
      goal: {
        objective: 'Extract structure',
        criteria: ['done'],
        phimin: 0.9,
      },
      inputs: [],
      outputs: [],
    });

    await index.set(
      '/src/my-class.ts',
      makeIndexEntry('/src/my-class.ts', [transformId])
    );

    const gen = new IntentEmbeddingGenerator(index, transformLog, workbench);
    const result = await gen.generateForSymbol('MyClass', '/src/my-class.ts');

    expect(result).toBeNull();
    await fs.remove(pgcRoot);
  });

  it('returns IntentEmbedding when intents exist in transform lineage', async () => {
    const pgcRoot = await makeTempPgcRoot();
    const index = new Index(pgcRoot);
    const transformLog = new TransformLog(pgcRoot);
    const mockEmbedding = new Array(768).fill(0.5);
    const workbench = makeWorkbenchMock(mockEmbedding);

    const transformId = await transformLog.record({
      type: 'genesis',
      timestamp: new Date().toISOString(),
      method: 'llm_supervised',
      goal: {
        objective: 'Extract intent',
        criteria: ['captured'],
        phimin: 0.8,
      },
      inputs: [],
      outputs: [],
      reasoning: {
        intent: 'Enable verifiable provenance for all transformations',
        confidence: 0.9,
      },
    });

    await index.set(
      '/src/my-class.ts',
      makeIndexEntry('/src/my-class.ts', [transformId])
    );

    const gen = new IntentEmbeddingGenerator(index, transformLog, workbench);
    const result = await gen.generateForSymbol('MyClass', '/src/my-class.ts');

    expect(result).not.toBeNull();
    expect(result!.symbol).toBe('MyClass');
    expect(result!.filePath).toBe('/src/my-class.ts');
    expect(result!.intent_count).toBe(1);
    expect(result!.embedding).toEqual(mockEmbedding);
    expect(result!.narrative).toContain('Enable verifiable provenance');
    await fs.remove(pgcRoot);
  });

  it('synthesizeNarrative joins intents with ". "', async () => {
    const pgcRoot = await makeTempPgcRoot();
    const index = new Index(pgcRoot);
    const transformLog = new TransformLog(pgcRoot);
    const workbench = makeWorkbenchMock();

    const id1 = await transformLog.record({
      type: 'update',
      timestamp: new Date().toISOString(),
      method: 'llm_supervised',
      goal: { objective: 'test', criteria: [], phimin: 0.5 },
      inputs: [],
      outputs: [],
      reasoning: { intent: 'First intent', confidence: 0.8 },
    });

    const id2 = await transformLog.record({
      type: 'update',
      timestamp: new Date().toISOString(),
      method: 'llm_supervised',
      goal: { objective: 'test', criteria: [], phimin: 0.5 },
      inputs: [],
      outputs: [],
      reasoning: { intent: 'Second intent', confidence: 0.7 },
    });

    await index.set(
      '/src/combined.ts',
      makeIndexEntry('/src/combined.ts', [id1, id2])
    );

    const gen = new IntentEmbeddingGenerator(index, transformLog, workbench);
    const result = await gen.generateForSymbol('Combined', '/src/combined.ts');

    expect(result).not.toBeNull();
    expect(result!.narrative).toBe('First intent. Second intent.');
    await fs.remove(pgcRoot);
  });

  it('computeConfidence: git_rehydration method uses weight 0.3', async () => {
    const pgcRoot = await makeTempPgcRoot();
    const index = new Index(pgcRoot);
    const transformLog = new TransformLog(pgcRoot);
    const workbench = makeWorkbenchMock();

    const id = await transformLog.record({
      type: 'genesis',
      timestamp: new Date().toISOString(),
      method: 'git_rehydration',
      goal: { objective: 'test', criteria: [], phimin: 0.5 },
      inputs: [],
      outputs: [],
      reasoning: { intent: 'Git-rehydrated intent', confidence: 1.0 },
    });

    await index.set(
      '/src/rehydrated.ts',
      makeIndexEntry('/src/rehydrated.ts', [id])
    );

    const gen = new IntentEmbeddingGenerator(index, transformLog, workbench);
    const result = await gen.generateForSymbol(
      'Rehydrated',
      '/src/rehydrated.ts'
    );

    expect(result).not.toBeNull();
    // confidence = (1.0 * 0.3) / 0.3 = 1.0 (single entry, weight normalised out)
    expect(result!.confidence).toBeCloseTo(1.0, 5);
    await fs.remove(pgcRoot);
  });

  it('computeConfidence: ast method uses weight 0.5', async () => {
    const pgcRoot = await makeTempPgcRoot();
    const index = new Index(pgcRoot);
    const transformLog = new TransformLog(pgcRoot);
    const workbench = makeWorkbenchMock();

    const id = await transformLog.record({
      type: 'genesis',
      timestamp: new Date().toISOString(),
      method: 'ast_native',
      goal: { objective: 'test', criteria: [], phimin: 0.5 },
      inputs: [],
      outputs: [],
      reasoning: { intent: 'AST intent', confidence: 0.6 },
    });

    await index.set(
      '/src/ast-file.ts',
      makeIndexEntry('/src/ast-file.ts', [id])
    );

    const gen = new IntentEmbeddingGenerator(index, transformLog, workbench);
    const result = await gen.generateForSymbol('AstFile', '/src/ast-file.ts');

    expect(result).not.toBeNull();
    // weighted avg with single entry: (0.6 * 0.5) / 0.5 = 0.6
    expect(result!.confidence).toBeCloseTo(0.6, 5);
    await fs.remove(pgcRoot);
  });

  it('computeConfidence: other method uses weight 1.0', async () => {
    const pgcRoot = await makeTempPgcRoot();
    const index = new Index(pgcRoot);
    const transformLog = new TransformLog(pgcRoot);
    const workbench = makeWorkbenchMock();

    const id = await transformLog.record({
      type: 'genesis',
      timestamp: new Date().toISOString(),
      method: 'manual',
      goal: { objective: 'test', criteria: [], phimin: 0.5 },
      inputs: [],
      outputs: [],
      reasoning: { intent: 'Manual intent', confidence: 0.75 },
    });

    await index.set('/src/manual.ts', makeIndexEntry('/src/manual.ts', [id]));

    const gen = new IntentEmbeddingGenerator(index, transformLog, workbench);
    const result = await gen.generateForSymbol('Manual', '/src/manual.ts');

    expect(result).not.toBeNull();
    // single entry, weight 1.0: (0.75 * 1.0) / 1.0 = 0.75
    expect(result!.confidence).toBeCloseTo(0.75, 5);
    await fs.remove(pgcRoot);
  });

  it('computeConfidence: multiple intents produce weighted average', async () => {
    const pgcRoot = await makeTempPgcRoot();
    const index = new Index(pgcRoot);
    const transformLog = new TransformLog(pgcRoot);
    const workbench = makeWorkbenchMock();

    // git_rehydration (weight 0.3) + manual (weight 1.0)
    const id1 = await transformLog.record({
      type: 'genesis',
      timestamp: new Date().toISOString(),
      method: 'git_rehydration',
      goal: { objective: 'test', criteria: [], phimin: 0.5 },
      inputs: [],
      outputs: [],
      reasoning: { intent: 'Git intent', confidence: 1.0 },
    });

    const id2 = await transformLog.record({
      type: 'update',
      timestamp: new Date().toISOString(),
      method: 'manual',
      goal: { objective: 'test', criteria: [], phimin: 0.5 },
      inputs: [],
      outputs: [],
      reasoning: { intent: 'Manual intent', confidence: 0.6 },
    });

    await index.set(
      '/src/mixed.ts',
      makeIndexEntry('/src/mixed.ts', [id1, id2])
    );

    const gen = new IntentEmbeddingGenerator(index, transformLog, workbench);
    const result = await gen.generateForSymbol('Mixed', '/src/mixed.ts');

    expect(result).not.toBeNull();
    // weighted avg: (1.0*0.3 + 0.6*1.0) / (0.3 + 1.0) = 0.9 / 1.3 ≈ 0.6923
    expect(result!.confidence).toBeCloseTo(0.9 / 1.3, 4);
    await fs.remove(pgcRoot);
  });

  it('embedding dimensions match workbench response', async () => {
    const pgcRoot = await makeTempPgcRoot();
    const index = new Index(pgcRoot);
    const transformLog = new TransformLog(pgcRoot);
    const expectedEmbedding = new Array(768).fill(0.42);
    const workbench = makeWorkbenchMock(expectedEmbedding);

    const id = await transformLog.record({
      type: 'genesis',
      timestamp: new Date().toISOString(),
      method: 'llm_supervised',
      goal: { objective: 'test', criteria: [], phimin: 0.5 },
      inputs: [],
      outputs: [],
      reasoning: { intent: 'Dimension test intent', confidence: 0.9 },
    });

    await index.set('/src/dims.ts', makeIndexEntry('/src/dims.ts', [id]));

    const gen = new IntentEmbeddingGenerator(index, transformLog, workbench);
    const result = await gen.generateForSymbol('Dims', '/src/dims.ts');

    expect(result).not.toBeNull();
    expect(result!.embedding.length).toBe(768);
    expect(result!.embedding[0]).toBeCloseTo(0.42, 5);
    await fs.remove(pgcRoot);
  });

  it('graceful fallback: embed throws → returns null without crashing', async () => {
    const pgcRoot = await makeTempPgcRoot();
    const index = new Index(pgcRoot);
    const transformLog = new TransformLog(pgcRoot);
    const workbench = {
      embed: vi.fn().mockRejectedValue(new Error('Workbench unreachable')),
    } as unknown as WorkbenchClient;

    const id = await transformLog.record({
      type: 'genesis',
      timestamp: new Date().toISOString(),
      method: 'llm_supervised',
      goal: { objective: 'test', criteria: [], phimin: 0.5 },
      inputs: [],
      outputs: [],
      reasoning: { intent: 'Will fail to embed', confidence: 0.9 },
    });

    await index.set('/src/failing.ts', makeIndexEntry('/src/failing.ts', [id]));

    const gen = new IntentEmbeddingGenerator(index, transformLog, workbench);
    const result = await gen.generateForSymbol('Failing', '/src/failing.ts');

    // Should return null gracefully, not throw
    expect(result).toBeNull();
    await fs.remove(pgcRoot);
  });
});
