import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import { PGCManager } from './manager.ts';
import { ObjectStore } from './object-store.ts';
import { GenesisOrchestrator } from '../orchestrators/genesis.ts';
import { StructuralMiner } from '../../orchestrators/miners/structural.ts';
import { WorkbenchClient } from '../../executors/workbench-client.ts';
import { StructuralOracle } from './oracles/overlay.ts';

// Mock workerpool to prevent real worker creation in tests
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

vi.mock('fs/promises', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

// Mock the fs-extra module to use memfs
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
      readdir: promises.readdir,
      readFile: promises.readFile,
      writeFile: promises.writeFile,
      stat: promises.stat,
      writeJSON: (
        filePath: string,
        data: object,
        options?: { spaces?: number }
      ) =>
        promises.writeFile(
          filePath,
          JSON.stringify(data, null, options?.spaces || 0)
        ),
      readJSON: (filePath: string) =>
        promises
          .readFile(filePath, 'utf-8')
          .then((content) => JSON.parse(content.toString())),
    },
  };
});

describe('GenesisOrchestrator Garbage Collection', () => {
  let pgcManager: PGCManager;
  let objectStore: ObjectStore;
  let genesisOrchestrator: GenesisOrchestrator;

  const projectRoot = '/project';
  const pgcRoot = '/project/.open_cognition';

  beforeEach(() => {
    vol.reset(); // Clear the in-memory filesystem before each test
    vol.mkdirSync(pgcRoot, { recursive: true }); // Create the PGC root directory

    pgcManager = new PGCManager(projectRoot);
    objectStore = pgcManager.objectStore;

    // Mock dependencies for GenesisOrchestrator
    const mockMiner = {} as StructuralMiner;
    const mockWorkbench = {
      health: vi.fn().mockResolvedValue(true),
      getBaseUrl: vi.fn().mockReturnValue('http://localhost:8000'),
    } as unknown as WorkbenchClient;
    const mockStructuralOracle = {
      verify: vi.fn().mockResolvedValue({ success: true, messages: [] }),
    } as unknown as StructuralOracle;

    genesisOrchestrator = new GenesisOrchestrator(
      pgcManager,
      mockMiner,
      mockWorkbench,
      mockStructuralOracle,
      projectRoot
    );
  });

  it('should remove empty sharded directories during garbage collection', async () => {
    // Create some empty sharded directories in object store
    const emptyObjectDir = '/project/.open_cognition/objects/0a';
    vol.mkdirSync(emptyObjectDir, { recursive: true });
    const emptyObjectDir2 = '/project/.open_cognition/objects/ff';
    vol.mkdirSync(emptyObjectDir2, { recursive: true });

    // Create some empty sharded directories in reverse deps
    const emptyReverseDepDir = '/project/.open_cognition/reverse_deps/1b';
    vol.mkdirSync(emptyReverseDepDir, { recursive: true });

    // Verify they exist before GC
    expect(vol.existsSync(emptyObjectDir)).toBe(true);
    expect(vol.existsSync(emptyObjectDir2)).toBe(true);
    expect(vol.existsSync(emptyReverseDepDir)).toBe(true);

    // Run garbage collection
    const summary = await genesisOrchestrator['garbageCollect']([]); // Pass empty array as no processed files

    // Verify empty directories are removed
    expect(vol.existsSync(emptyObjectDir)).toBe(false);
    expect(vol.existsSync(emptyObjectDir2)).toBe(false);
    expect(vol.existsSync(emptyReverseDepDir)).toBe(false);
    expect(summary.staleEntries).toBe(0);
  });

  it('should not remove sharded directories that contain files', async () => {
    const content = 'some content';
    const hash = objectStore.computeHash(content);
    const shardedDir = path.join(pgcRoot, 'objects', hash.slice(0, 2));
    const objectPath = path.join(shardedDir, hash.slice(2));

    // Create a file in a sharded directory
    vol.mkdirSync(shardedDir, { recursive: true });
    vol.writeFileSync(objectPath, content);

    // Verify it exists before GC
    expect(vol.existsSync(shardedDir)).toBe(true);
    expect(vol.existsSync(objectPath)).toBe(true);

    // Run garbage collection
    await genesisOrchestrator['garbageCollect']([]);

    // Verify the directory and file still exist
    expect(vol.existsSync(shardedDir)).toBe(true);
    expect(vol.existsSync(objectPath)).toBe(true);
  });

  it('should remove stale index entries during garbage collection', async () => {
    const filePath1 = 'src_file1.ts';
    const filePath2 = 'src_file2.ts';

    // Add two entries to the index
    await pgcManager.index.set(filePath1, {
      path: filePath1,
      content_hash: 'hash1',
      structural_hash: 'shash1',
      status: 'Valid',
      history: ['transform1'],
    });
    await pgcManager.index.set(filePath2, {
      path: filePath2,
      content_hash: 'hash2',
      structural_hash: 'shash2',
      status: 'Valid',
      history: ['transform2'],
    });

    // Verify both entries exist
    expect(await pgcManager.index.get(filePath1)).toBeDefined();
    expect(await pgcManager.index.get(filePath2)).toBeDefined();

    // Simulate garbage collection with only filePath1 being processed
    const summary = await genesisOrchestrator['garbageCollect']([filePath1]);

    // Verify filePath1 still exists and filePath2 is removed
    expect(await pgcManager.index.get(filePath1)).toBeDefined();
    expect(await pgcManager.index.get(filePath2)).toBeNull();
    expect(summary.staleEntries).toBe(1);
  });
});
