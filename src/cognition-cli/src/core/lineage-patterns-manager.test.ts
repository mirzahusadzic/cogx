import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import { PGCManager } from './pgc-manager';
import { LineagePatternsManager } from './lineage-patterns-manager';
import { LanceVectorStore } from '../lib/patterns/vector-db/lance-vector-store';
import { WorkbenchClient } from '../executors/workbench-client';
import { StructuralData } from '../types/structural';

vi.mock('fs/promises', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

describe('LineagePatternsManager', () => {
  let pgcManager: PGCManager;
  let vectorDB: LanceVectorStore;
  let workbench: WorkbenchClient;
  let lineagePatternsManager: LineagePatternsManager;
  const pgcRoot = '/test-project/.open_cognition';
  const overlayPath = path.join(pgcRoot, 'overlays', 'structural_patterns');

  beforeEach(() => {
    vol.reset();
    // Mock the dependencies
    pgcManager = {
      getLineageForStructuralData: vi.fn(),
      pgcRoot: pgcRoot,
      objectStore: {
        computeHash: vi.fn((data) => `hash(${data})`),
        retrieve: vi.fn(),
      },
      overlays: { update: vi.fn(), get: vi.fn() },
    } as unknown as PGCManager;

    vectorDB = {
      initialize: vi.fn(),
      storeVector: vi.fn(),
    } as unknown as LanceVectorStore;

    workbench = {
      embed: vi.fn(),
    } as unknown as WorkbenchClient;

    lineagePatternsManager = new LineagePatternsManager(
      pgcManager,
      vectorDB,
      workbench
    );
  });

  it('should generate lineage for all patterns from a manifest', async () => {
    // Arrange
    const mockManifest = {
      SymbolA: 'src/a.ts',
    };

    const mockStructuralDataA: StructuralData = {
      language: 'typescript',
      docstring: 'Symbol A',
      imports: [],
      classes: [
        {
          name: 'SymbolA',
          docstring: '',
          base_classes: [],
          methods: [],
          decorators: [],
        },
      ],
      functions: [],
      fidelity: 1,
      extraction_method: 'ast_native',
    };

    const mockLineageResult = {
      initialContext: [mockStructuralDataA],
      dependencies: [],
    };

    // Set up the virtual file system
    const manifestPath = path.join(overlayPath, 'manifest.json');
    const structuralDataPath = path.join(overlayPath, 'src/a.ts#SymbolA.json');
    vol.mkdirSync(path.dirname(structuralDataPath), { recursive: true });
    vol.writeFileSync(manifestPath, JSON.stringify(mockManifest));
    vol.writeFileSync(structuralDataPath, JSON.stringify(mockStructuralDataA));

    // Mock PGCManager response
    (pgcManager.getLineageForStructuralData as vi.Mock).mockResolvedValue(
      mockLineageResult
    );

    const mockStructuralPatternMetadata = {
      symbolStructuralDataHash: 'hash(mockStructuralDataA)',
      validation: { sourceHash: 'mockSourceHash' },
    };

    (pgcManager.overlays.get as vi.Mock).mockResolvedValue(
      mockStructuralPatternMetadata
    );

    (pgcManager.objectStore.retrieve as vi.Mock).mockImplementation((hash) => {
      if (hash === 'hash(mockStructuralDataA)') {
        return Promise.resolve(
          Buffer.from(JSON.stringify(mockStructuralDataA))
        );
      }
      return Promise.resolve(null);
    });

    // Mock Workbench response
    (workbench.embed as vi.Mock).mockResolvedValue({
      embedding_768d: [0.1, 0.2],
    });

    // Act
    await lineagePatternsManager.generateLineageForAllPatterns();

    // Assert
    expect(pgcManager.getLineageForStructuralData).toHaveBeenCalled();
    expect(workbench.embed).toHaveBeenCalled();
    expect(vectorDB.storeVector).toHaveBeenCalled();
    expect(pgcManager.overlays.update).toHaveBeenCalled();
  });
});
