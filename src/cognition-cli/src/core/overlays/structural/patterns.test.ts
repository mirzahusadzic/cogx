import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { StructuralPatternsManager } from './patterns.js';
import type { PGCManager } from '../../pgc/manager.js';
import type { LanceVectorStore } from '../vector-db/lance-store.js';
import type { WorkbenchClient } from '../../executors/workbench-client.js';

// Mock fs-extra to use memfs
vi.mock('fs-extra', async () => {
  const actualMemfs = await vi.importActual<typeof import('memfs')>('memfs');
  const actualVol = actualMemfs.vol;

  return {
    default: {
      ensureDir: (dirPath: string) =>
        actualVol.promises.mkdir(dirPath, { recursive: true }),
      pathExists: (filePath: string) =>
        actualVol.promises
          .access(filePath)
          .then(() => true)
          .catch(() => false),
      writeJSON: (
        filePath: string,
        data: unknown,
        options?: { spaces?: number }
      ) =>
        actualVol.promises.writeFile(
          filePath,
          JSON.stringify(data, null, options?.spaces || 0)
        ),
      readJSON: async (filePath: string) =>
        JSON.parse(await actualVol.promises.readFile(filePath, 'utf8')),
      readFile: (filePath: string, encoding: string) =>
        actualVol.promises.readFile(filePath, encoding),
      writeFile: (filePath: string, content: string) =>
        actualVol.promises.writeFile(filePath, content),
      remove: (filePath: string) =>
        actualVol.promises.rm(filePath, { recursive: true, force: true }),
    },
  };
});

// Mock proper-lockfile
vi.mock('proper-lockfile', () => ({
  lock: vi.fn(async () => vi.fn(async () => {})),
}));

// Mock workerpool
vi.mock('workerpool', () => ({
  pool: vi.fn(() => ({
    exec: vi.fn(),
    terminate: vi.fn(),
  })),
}));

describe('StructuralPatternsManager - Transaction Ordering', () => {
  let manager: StructuralPatternsManager;
  let mockPgc: PGCManager;
  let mockVectorDB: LanceVectorStore;
  let mockWorkbench: WorkbenchClient;
  let overlayUpdateSpy: ReturnType<typeof vi.fn>;
  let manifestUpdateSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vol.reset();
    vol.fromJSON({
      '/test-project/.open_cognition/pgc/objects/.gitkeep': '',
      '/test-project/.open_cognition/pgc/index/.gitkeep': '',
    });

    // Create mock PGC with spy-able methods
    overlayUpdateSpy = vi.fn(async () => {});
    manifestUpdateSpy = vi.fn(async () => {});

    mockPgc = {
      projectRoot: '/test-project',
      pgcRoot: '/test-project/.open_cognition/pgc',
      overlays: {
        update: overlayUpdateSpy,
        updateManifest: manifestUpdateSpy,
        get: vi.fn(async () => null),
        exists: vi.fn(async () => false),
      },
      objectStore: {
        computeHash: vi.fn((data: string) => `hash_${data.slice(0, 10)}`),
        exists: vi.fn(async () => true),
        store: vi.fn(async () => 'test-hash'),
      },
    } as Partial<PGCManager> as PGCManager;

    mockVectorDB = {
      initialize: vi.fn(async () => {}),
      storeVector: vi.fn(async () => {}),
    } as Partial<LanceVectorStore> as LanceVectorStore;

    mockWorkbench = {
      embed: vi.fn(async () => ({
        embedding_768d: new Array(768).fill(0.1),
      })),
    } as Partial<WorkbenchClient> as WorkbenchClient;

    manager = new StructuralPatternsManager(
      mockPgc,
      mockVectorDB,
      mockWorkbench
    );
  });

  afterEach(() => {
    vol.reset();
  });

  it('CRITICAL: should write overlay BEFORE manifest to prevent orphaned entries', async () => {
    // Track call order
    const callOrder: string[] = [];

    overlayUpdateSpy.mockImplementation(async () => {
      callOrder.push('overlay');
    });

    manifestUpdateSpy.mockImplementation(async () => {
      callOrder.push('manifest');
    });

    const result = {
      symbolName: 'TestClass',
      filePath: 'src/test.ts',
      signature: 'class:TestClass',
      architecturalRole: 'component',
      structuralData: {
        extraction_method: 'ast_native',
        fidelity: 1.0,
        classes: [
          { name: 'TestClass', methods: [], properties: [], decorators: [] },
        ],
      },
      contentHash: 'abc123',
      structuralHash: 'def456',
      status: 'success' as const,
    };

    await manager['generateAndStoreEmbedding'](result);

    // Assert: overlay must be called BEFORE manifest
    expect(callOrder).toEqual(['overlay', 'manifest']);
    expect(overlayUpdateSpy).toHaveBeenCalledTimes(1);
    expect(manifestUpdateSpy).toHaveBeenCalledTimes(1);
  });

  it('CRITICAL: should NOT update manifest if overlay update fails', async () => {
    overlayUpdateSpy.mockRejectedValue(new Error('Disk full'));

    const result = {
      symbolName: 'TestClass',
      filePath: 'src/test.ts',
      signature: 'class:TestClass',
      architecturalRole: 'component',
      structuralData: {
        extraction_method: 'ast_native',
        fidelity: 1.0,
        classes: [
          { name: 'TestClass', methods: [], properties: [], decorators: [] },
        ],
      },
      contentHash: 'abc123',
      structuralHash: 'def456',
      status: 'success' as const,
    };

    // Should throw and not call manifest update
    await expect(manager['generateAndStoreEmbedding'](result)).rejects.toThrow(
      'Disk full'
    );

    expect(overlayUpdateSpy).toHaveBeenCalled();
    expect(manifestUpdateSpy).not.toHaveBeenCalled();
  });

  it('should include extractionMethod and fidelity in validation metadata', async () => {
    const result = {
      symbolName: 'TestClass',
      filePath: 'src/test.ts',
      signature: 'class:TestClass',
      architecturalRole: 'component',
      structuralData: {
        extraction_method: 'ast_native',
        fidelity: 1.0,
        classes: [
          { name: 'TestClass', methods: [], properties: [], decorators: [] },
        ],
      },
      contentHash: 'abc123',
      structuralHash: 'def456',
      status: 'success' as const,
    };

    await manager['generateAndStoreEmbedding'](result);

    const overlayCall = overlayUpdateSpy.mock.calls[0];
    const metadata = overlayCall[2];

    expect(metadata.validation).toMatchObject({
      sourceHash: 'abc123',
      embeddingModelVersion: expect.any(String),
      extractionMethod: 'ast_native',
      fidelity: 1.0,
    });
  });
});
