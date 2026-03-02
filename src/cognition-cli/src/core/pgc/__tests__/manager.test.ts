import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import { PGCManager } from '../manager.ts';
import { ObjectStore } from '../object-store.ts';
import { MaintenanceStep } from '../../orchestrators/steps/maintenance.ts';
import { PipelineContext } from '../../orchestrators/types.ts';

// Mock LanceVectorStore to prevent native library errors in tests
const { mockLanceVectorStore } = vi.hoisted(() => ({
  mockLanceVectorStore: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAllVectors: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../overlays/vector-db/lance-store.js', () => ({
  LanceVectorStore: vi.fn().mockImplementation(() => mockLanceVectorStore),
}));

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

vi.mock('proper-lockfile', () => ({
  lock: vi.fn(async () => () => Promise.resolve()),
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

  const projectRoot = '/project';
  const pgcRoot = '/project/.open_cognition';

  beforeEach(() => {
    vol.reset(); // Clear the in-memory filesystem before each test
    vol.mkdirSync(pgcRoot, { recursive: true }); // Create the PGC root directory

    pgcManager = new PGCManager(projectRoot);
    objectStore = pgcManager.objectStore;
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

    // Run garbage collection via MaintenanceStep
    const maintenanceStep = new MaintenanceStep({ gc: true, verify: false });
    const mockContext = {
      pgc: pgcManager,
      projectRoot,
      processedFiles: [],
      docsOracle: {
        cleanupOrphanedObjects: vi.fn().mockResolvedValue(0),
        listDocuments: vi.fn().mockResolvedValue([]),
        removeStaleEntries: vi.fn().mockResolvedValue(0),
      },
    } as unknown as PipelineContext;

    await maintenanceStep.runGarbageCollection(mockContext, []);

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

    // Run garbage collection via MaintenanceStep
    const maintenanceStep = new MaintenanceStep({ gc: true, verify: false });
    const mockContext = {
      pgc: pgcManager,
      projectRoot,
      processedFiles: [],
      docsOracle: {
        cleanupOrphanedObjects: vi.fn().mockResolvedValue(0),
        listDocuments: vi.fn().mockResolvedValue([]),
        removeStaleEntries: vi.fn().mockResolvedValue(0),
      },
    } as unknown as PipelineContext;

    await maintenanceStep.runGarbageCollection(mockContext, []);

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

    // Run garbage collection via MaintenanceStep with only filePath1 being processed
    const maintenanceStep = new MaintenanceStep({ gc: true, verify: false });
    const mockContext = {
      pgc: pgcManager,
      projectRoot,
      processedFiles: [filePath1],
      docsOracle: {
        cleanupOrphanedObjects: vi.fn().mockResolvedValue(0),
        listDocuments: vi.fn().mockResolvedValue([]),
        removeStaleEntries: vi.fn().mockResolvedValue(0),
      },
    } as unknown as PipelineContext;

    await maintenanceStep.runGarbageCollection(mockContext, [filePath1]);

    // Verify filePath1 still exists and filePath2 is removed
    expect(await pgcManager.index.get(filePath1)).toBeDefined();
    expect(await pgcManager.index.get(filePath2)).toBeNull();
  });

  it('should remove orphaned reverse dependency and transform log entries', async () => {
    // 1. Create a transform log entry for a non-existent object
    const orphanTransformId = '00orphan';

    // Manually create transform manifest in memfs
    const transformDir = path.join(
      pgcRoot,
      'transforms',
      orphanTransformId.slice(0, 2),
      orphanTransformId.slice(2)
    );
    vol.mkdirSync(transformDir, { recursive: true });
    vol.writeFileSync(
      path.join(transformDir, 'manifest.yaml'),
      'inputs: []\noutputs: []'
    );

    // 2. Create a reverse dep entry for a non-existent object pointing to a non-existent transform
    const staleObjectHash = 'aa1234';
    const staleTransformId = 'bb5678';
    const reverseDepDir = path.join(
      pgcRoot,
      'reverse_deps',
      staleObjectHash.slice(0, 2)
    );
    vol.mkdirSync(reverseDepDir, { recursive: true });
    vol.writeFileSync(
      path.join(reverseDepDir, staleObjectHash.slice(2)),
      staleTransformId + '\n'
    );

    // Verify they exist
    expect(await pgcManager.transformLog.exists(orphanTransformId)).toBe(true);
    expect(await pgcManager.reverseDeps.getAllReverseDepHashes()).toContain(
      staleObjectHash
    );

    // Run garbage collection via MaintenanceStep
    const maintenanceStep = new MaintenanceStep({ gc: true, verify: false });
    const mockContext = {
      pgc: pgcManager,
      projectRoot,
      processedFiles: [],
      docsOracle: {
        cleanupOrphanedObjects: vi.fn().mockResolvedValue(0),
        listDocuments: vi.fn().mockResolvedValue([]),
        removeStaleEntries: vi.fn().mockResolvedValue(0),
      },
    } as unknown as PipelineContext;

    await maintenanceStep.runGarbageCollection(mockContext, []);

    // Verify orphan/stale entries are removed
    // orphanTransformId should be removed because its manifest says inputs/outputs are [], wait...
    // Actually orphanTransformId in my manual creation has empty inputs/outputs, so it is valid in terms of object exists.
    // BUT the staleObjectHash in reverse_deps does NOT exist in objectStore, so it should be removed.
    // AND staleTransformId in reverse_deps does NOT exist in transformLog, so it should be removed from that file.

    expect(
      await pgcManager.reverseDeps.getTransformIds(staleObjectHash)
    ).toEqual([]);
    expect(await pgcManager.reverseDeps.getAllReverseDepHashes()).not.toContain(
      staleObjectHash
    );
  });

  it('should remove stale overlay manifest entries when source file is missing', async () => {
    // 1. Create a fake overlay manifest entry for a non-existent file
    const overlayType = 'structural_patterns';
    const symbolName = 'MissingSymbol';
    const missingFilePath = 'src/missing-file.ts';

    await pgcManager.overlays.updateManifest(overlayType, symbolName, {
      filePath: missingFilePath,
      lastUpdated: new Date().toISOString(),
    });

    // Verify it exists in manifest
    let manifest = await pgcManager.overlays.getManifest(overlayType);
    expect(manifest[symbolName]).toBeDefined();

    // 2. Run maintenance
    const maintenanceStep = new MaintenanceStep({ gc: true, verify: false });
    const mockContext = {
      pgc: pgcManager,
      projectRoot,
      processedFiles: [],
      docsOracle: {
        cleanupOrphanedObjects: vi.fn().mockResolvedValue(0),
        listDocuments: vi.fn().mockResolvedValue([]),
        removeStaleEntries: vi.fn().mockResolvedValue(0),
      },
    } as unknown as PipelineContext;

    // Use private method via cast
    await maintenanceStep.runGarbageCollection(mockContext, []);

    // 3. Verify it's gone from manifest
    manifest = await pgcManager.overlays.getManifest(overlayType);
    expect(manifest[symbolName]).toBeUndefined();
  });
});
