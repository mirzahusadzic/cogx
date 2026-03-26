import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TransformLog } from '../transform-log.js';
import { Transformation } from '../../types/transform.js';

describe('TransformLog', () => {
  let tempDir: string;
  let log: TransformLog;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      `sigma-test-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(tempDir);
    log = new TransformLog(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  const sampleData: Omit<Transformation, 'phi' | 'verification_result'> = {
    type: 'genesis_doc',
    timestamp: new Date().toISOString(),
    method: 'markdown-ast-parse',
    inputs: [{ path: 'src/file.ts', hash: 'abc123' }],
    outputs: [{ path: '.pgc/file.json', hash: 'def456' }],
  };

  it('should record and retrieve transformations', async () => {
    const hash = await log.record(sampleData);
    expect(hash).toBeDefined();

    const retrieved = await log.getTransformation(hash);
    expect(retrieved).toBeDefined();
    expect(retrieved?.type).toBe('genesis_doc');
  });

  it('should invalidate a transform (soft delete)', async () => {
    const hash = await log.record(sampleData);
    expect(await log.isInvalidated(hash)).toBe(false);

    await log.invalidate(hash, 'Test invalidation');
    expect(await log.isInvalidated(hash)).toBe(true);

    const retrieved = await log.getTransformation(hash);
    expect(retrieved).toBeDefined(); // Still exists in the log
  });

  it('should purge a transform (hard delete)', async () => {
    const hash = await log.record(sampleData);
    expect(await log.exists(hash)).toBe(true);

    await log.purge(hash);
    expect(await log.exists(hash)).toBe(false);
    expect(await log.getTransformation(hash)).toBeNull();
  });

  it('should handle non-existent hashes for invalidation and purge', async () => {
    const fakeHash =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    await expect(log.invalidate(fakeHash, 'No reason')).resolves.not.toThrow();
    await expect(log.purge(fakeHash)).resolves.not.toThrow();
  });
});
