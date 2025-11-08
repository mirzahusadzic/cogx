import path from 'path';
import yaml from 'js-yaml';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { auditCommand } from './audit';
import { PGCManager } from '../core/pgc/manager';
import { IndexData } from '../core/types';
import { TransformData } from '../core/types/transform';

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
      readFile: (path: string, encoding: string) =>
        promises.readFile(path, encoding),
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
    const filePath = 'src/app.ts';
    const canonicalKey = pgc.index.getCanonicalKey(filePath);
    const indexPath = path.join(pgc.pgcRoot, 'index', `${canonicalKey}.json`);

    const transformHash1 = 'abc1';
    const transformHash2 = 'def2';
    // Git-style sharding: transforms/{shard}/{rest}/manifest.yaml
    const shard1 = transformHash1.slice(0, 2); // 'ab'
    const rest1 = transformHash1.slice(2); // 'c1'
    const shard2 = transformHash2.slice(0, 2); // 'de'
    const rest2 = transformHash2.slice(2); // 'f2'
    const manifestPath1 = path.join(
      pgc.pgcRoot,
      'transforms',
      shard1,
      rest1,
      'manifest.yaml'
    );
    const manifestPath2 = path.join(
      pgc.pgcRoot,
      'transforms',
      shard2,
      rest2,
      'manifest.yaml'
    );

    const indexData: IndexData = {
      path: filePath,
      content_hash: 'some-content-hash',
      structural_hash: 'some-structural-hash',
      status: 'Valid',
      history: [transformHash1, transformHash2],
    };

    const transformData1: TransformData = {
      goal: { objective: 'Initial implementation', criteria: [], phimin: 0.8 },
      phi: 0.9,
      verification_result: { status: 'Success' },
      inputs: [{ path: 'src/app.ts', hash: 'input-hash-1' }],
      outputs: [{ path: 'src/app.ts', hash: 'output-hash-1' }],
    };

    const transformData2: TransformData = {
      goal: { objective: 'Refactor feature', criteria: [], phimin: 0.8 },
      phi: 0.95,
      verification_result: { status: 'Success' },
      inputs: [{ path: 'src/app.ts', hash: 'output-hash-1' }],
      outputs: [{ path: 'src/app.ts', hash: 'output-hash-2' }],
    };

    // Directly write to memfs
    vol.fromJSON({
      [indexPath]: JSON.stringify(indexData),
      [manifestPath1]: yaml.dump(transformData1),
      [manifestPath2]: yaml.dump(transformData2),
    });

    // 2. Run the command
    await auditCommand(filePath, { projectRoot, limit: '5' });

    // 3. Assertions
    expect(console.log).toHaveBeenCalledWith(
      'Auditing last 2 transformations for: src/app.ts'
    );
    expect(console.log).toHaveBeenCalledWith(
      '\n--- Iteration 1 (Transform: abc1) ---'
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Goal:'));
    expect(console.log).toHaveBeenCalledWith(
      '\n--- Iteration 2 (Transform: def2) ---'
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Goal:'));
  });

  it('should handle files with no history', async () => {
    const pgc = new PGCManager(projectRoot);
    const filePath = 'src/empty.ts';
    const canonicalKey = pgc.index.getCanonicalKey(filePath);
    const indexPath = path.join(pgc.pgcRoot, 'index', `${canonicalKey}.json`);

    const indexData: IndexData = {
      path: filePath,
      content_hash: 'empty-hash',
      structural_hash: 'empty-hash',
      status: 'Valid',
      history: [],
    };
    vol.fromJSON({
      [indexPath]: JSON.stringify(indexData),
    });

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
