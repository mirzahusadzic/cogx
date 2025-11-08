import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { OverlayOracle } from './overlay.js';
import type { PGCManager } from '../manager.js';

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
    },
  };
});

describe('OverlayOracle - Validation', () => {
  let oracle: OverlayOracle;
  let mockPgc: PGCManager;

  beforeEach(async () => {
    vol.reset();
    vol.fromJSON({
      '/test/.open_cognition/pgc/.gitkeep': '',
    });

    mockPgc = {
      pgcRoot: '/test/.open_cognition/pgc',
      overlays: {
        get: vi.fn(),
        getManifest: vi.fn(),
      },
      objectStore: {
        exists: vi.fn(async () => true),
      },
    } as Partial<PGCManager> as PGCManager;

    oracle = new OverlayOracle(mockPgc);
  });

  afterEach(() => {
    vol.reset();
  });

  it('should PASS when all required fields are present', async () => {
    const validMetadata = {
      symbol: 'TestClass',
      anchor: 'src/test.ts',
      symbolStructuralDataHash: 'hash123',
      embeddingHash: 'embedhash456',
      structuralSignature: 'class:TestClass',
      architecturalRole: 'component',
      computedAt: new Date().toISOString(),
      vectorId: 'vec_test',
      validation: {
        sourceHash: 'sourcehash789',
        embeddingModelVersion: 'google/embeddinggemma-300m',
        extractionMethod: 'ast_native',
        fidelity: 1.0,
      },
    };

    mockPgc.overlays.getManifest = vi
      .fn()
      .mockResolvedValueOnce({ TestClass: 'src/test.ts' }); // manifest
    mockPgc.overlays.get = vi.fn().mockResolvedValueOnce(validMetadata); // overlay metadata

    const result = await oracle.verifyStructuralPatternsOverlay();

    expect(result.success).toBe(true);
    expect(result.messages).toHaveLength(0);
  });

  it('should FAIL when extractionMethod is missing (schema validation)', async () => {
    // When schema validation fails in overlays.get(), it returns null
    // So this is treated as missing metadata

    mockPgc.overlays.getManifest = vi
      .fn()
      .mockResolvedValueOnce({ TestClass: 'src/test.ts' }); // manifest
    mockPgc.overlays.get = vi.fn().mockResolvedValueOnce(null); // schema parse failed -> null

    const result = await oracle.verifyStructuralPatternsOverlay();

    expect(result.success).toBe(false);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]).toContain('src/test.ts#TestClass');
  });

  it('should FAIL when overlay metadata is missing but manifest has entry', async () => {
    mockPgc.overlays.getManifest = vi
      .fn()
      .mockResolvedValueOnce({ TestClass: 'src/test.ts' }); // manifest exists
    mockPgc.overlays.get = vi.fn().mockResolvedValueOnce(null); // overlay missing - ORPHANED ENTRY

    const result = await oracle.verifyStructuralPatternsOverlay();

    expect(result.success).toBe(false);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]).toContain('src/test.ts#TestClass');
  });

  it('should FAIL when symbolStructuralDataHash not in object store', async () => {
    const metadata = {
      symbol: 'TestClass',
      anchor: 'src/test.ts',
      symbolStructuralDataHash: 'missing_hash',
      embeddingHash: 'embedhash456',
      structuralSignature: 'class:TestClass',
      architecturalRole: 'component',
      computedAt: new Date().toISOString(),
      vectorId: 'vec_test',
      validation: {
        sourceHash: 'sourcehash789',
        embeddingModelVersion: 'google/embeddinggemma-300m',
        extractionMethod: 'ast_native',
        fidelity: 1.0,
      },
    };

    mockPgc.overlays.getManifest = vi
      .fn()
      .mockResolvedValueOnce({ TestClass: 'src/test.ts' });
    mockPgc.overlays.get = vi.fn().mockResolvedValueOnce(metadata);

    mockPgc.objectStore.exists = vi.fn(async (hash: string) => {
      return hash !== 'missing_hash'; // symbolStructuralDataHash is missing
    });

    const result = await oracle.verifyStructuralPatternsOverlay();

    expect(result.success).toBe(false);
    expect(
      result.messages.some(
        (m: string) =>
          m.includes('symbolStructuralDataHash') && m.includes('missing_hash')
      )
    ).toBe(true);
  });

  it('should FAIL when sourceHash not in object store', async () => {
    const metadata = {
      symbol: 'TestClass',
      anchor: 'src/test.ts',
      symbolStructuralDataHash: 'hash123',
      embeddingHash: 'embedhash456',
      structuralSignature: 'class:TestClass',
      architecturalRole: 'component',
      computedAt: new Date().toISOString(),
      vectorId: 'vec_test',
      validation: {
        sourceHash: 'missing_source_hash',
        embeddingModelVersion: 'google/embeddinggemma-300m',
        extractionMethod: 'ast_native',
        fidelity: 1.0,
      },
    };

    mockPgc.overlays.getManifest = vi
      .fn()
      .mockResolvedValueOnce({ TestClass: 'src/test.ts' });
    mockPgc.overlays.get = vi.fn().mockResolvedValueOnce(metadata);

    mockPgc.objectStore.exists = vi.fn(async (hash: string) => {
      return hash !== 'missing_source_hash';
    });

    const result = await oracle.verifyStructuralPatternsOverlay();

    expect(result.success).toBe(false);
    expect(
      result.messages.some(
        (m: string) =>
          m.includes('sourceHash') && m.includes('missing_source_hash')
      )
    ).toBe(true);
  });
});
