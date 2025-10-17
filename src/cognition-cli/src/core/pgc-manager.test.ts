import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import { PGCManager } from './pgc-manager.js';
import { ObjectStore } from './object-store.js';
import { GenesisOrchestrator } from '../orchestrators/genesis-orchestrator.js';
import { StructuralMiner } from '../miners/structural-miner.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { StructuralOracle } from './oracles/structural-oracle.js';

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
    },
  };
});

describe('PGCManager Garbage Collection', () => {
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
    await genesisOrchestrator['garbageCollect']([]); // Pass empty array as no processed files

    // Verify empty directories are removed
    expect(vol.existsSync(emptyObjectDir)).toBe(false);
    expect(vol.existsSync(emptyObjectDir2)).toBe(false);
    expect(vol.existsSync(emptyReverseDepDir)).toBe(false);
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
});
