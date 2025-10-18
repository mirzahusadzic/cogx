import { vi, describe, it, expect, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { auditCommand } from './audit';
import { PGCManager } from '../core/pgc-manager';
import { TransformLog } from '../core/transform-log';
import { IndexData } from '../types';
import { TransformData } from '../types/transform';

vi.mock('fs-extra', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  const promises = memfs.fs.promises;

  const pathExists = async (path: string) => {
    try {
      await promises.access(path);
      return true;
    } catch {
      return false;
    }
  };

  return {
    default: {
      ...promises,
      pathExists: pathExists,
      ensureDir: (path: string) => promises.mkdir(path, { recursive: true }),
      remove: (path: string) =>
        promises.rm(path, { recursive: true, force: true }),
      writeFile: (path: string, data: string) => promises.writeFile(path, data),
      readFile: (path: string) => promises.readFile(path, 'utf-8'),
      writeJSON: (path: string, data: unknown) =>
        promises.writeFile(path, JSON.stringify(data, null, 2)),
      readJSON: async (path: string) => {
        const content = await promises.readFile(path, 'utf-8');
        return JSON.parse(content as string);
      },
    },
  };
});

describe('auditCommand', () => {
  const projectRoot = '/test-project';

  beforeEach(() => {
    vol.reset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should audit the transformation history of a file', async () => {
    // 1. Setup mock PGC
    const pgc = new PGCManager(projectRoot);
    const transformLog = new TransformLog(pgc.pgcRoot);

    const filePath = 'src/app.ts';
    const transformHash1 = 'abc1';
    const transformHash2 = 'def2';

    const indexData: IndexData = {
      path: filePath,
      structural_hash: 'some-structural-hash',
      history: [transformHash1, transformHash2],
    };

    const transformData1: TransformData = {
      goal: 'Initial implementation',
      phi: 0.9,
      verification_result: { status: 'Success' },
      inputs: [{ path: 'src/app.ts', hash: 'input-hash-1' }],
      outputs: [{ path: 'src/app.ts', hash: 'output-hash-1' }],
    };

    const transformData2: TransformData = {
      goal: 'Refactor feature',
      phi: 0.95,
      verification_result: { status: 'Success' },
      inputs: [{ path: 'src/app.ts', hash: 'output-hash-1' }],
      outputs: [{ path: 'src/app.ts', hash: 'output-hash-2' }],
    };

    await pgc.index.set(filePath, indexData);
    await transformLog.set(transformHash1, transformData1);
    await transformLog.set(transformHash2, transformData2);

    // 2. Run the command
    await auditCommand(filePath, { projectRoot, limit: '5' });

    // 3. Assertions
    expect(console.log).toHaveBeenCalledWith(
      'Auditing last 2 transformations for: src/app.ts'
    );
    expect(console.log).toHaveBeenCalledWith(
      '\n--- Iteration 1 (Transform: abc1) ---'
    );
    expect(console.log).toHaveBeenCalledWith('  Goal: Initial implementation');
    expect(console.log).toHaveBeenCalledWith(
      '\n--- Iteration 2 (Transform: def2) ---'
    );
    expect(console.log).toHaveBeenCalledWith('  Goal: Refactor feature');
  });

  it('should handle files with no history', async () => {
    const pgc = new PGCManager(projectRoot);
    const filePath = 'src/empty.ts';
    const indexData: IndexData = {
      path: filePath,
      structural_hash: 'empty-hash',
      history: [],
    };
    await pgc.index.set(filePath, indexData);

    await auditCommand(filePath, { projectRoot, limit: '5' });

    expect(console.log).toHaveBeenCalledWith(
      'No transformation history found for file: src/empty.ts'
    );
  });

  it('should handle files not in the index', async () => {
    await auditCommand('src/nonexistent.ts', { projectRoot, limit: '5' });

    expect(console.log).toHaveBeenCalledWith(
      'No index data found for file: src/nonexistent.ts'
    );
  });
});
