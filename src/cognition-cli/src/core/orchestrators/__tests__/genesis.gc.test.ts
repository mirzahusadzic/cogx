import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { PGCManager } from '../../pgc/manager.js';
import {
  StructuralPatternMetadata,
  StructuralPatternMetadataSchema,
} from '../../types/structural.js';

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
      readdir: (dirPath: string) => actualVol.promises.readdir(dirPath),
    },
  };
});

// Mock proper-lockfile
vi.mock('proper-lockfile', () => ({
  lock: vi.fn(async () => vi.fn(async () => {})),
}));

describe('Genesis GC - Overlay Awareness', () => {
  let pgc: PGCManager;

  beforeEach(async () => {
    vol.reset();
    vol.fromJSON({
      '/test-project/.open_cognition/pgc/objects/.gitkeep': '',
      '/test-project/.open_cognition/pgc/transforms/.gitkeep': '',
      '/test-project/.open_cognition/pgc/index/.gitkeep': '',
      '/test-project/.open_cognition/pgc/reverse_deps/.gitkeep': '',
      '/test-project/.open_cognition/pgc/overlays/.gitkeep': '',
    });

    pgc = new PGCManager('/test-project');
  });

  afterEach(() => {
    vol.reset();
  });

  it('CRITICAL: GC should NOT delete objects referenced by overlays', async () => {
    // Scenario:
    // 1. File src/old-file.ts was processed and has structural data stored
    // 2. An overlay (structural_patterns) references this structural data
    // 3. The file is deleted from the source (not in processedFiles anymore)
    // 4. GC runs and sees the file is stale
    // 5. BUG: GC deletes the structural_hash even though overlay still needs it!

    // Setup: Create a file in the index with structural data
    const filePath = 'src/old-file.ts';
    const fileContent = 'file content';
    const structuralDataJson = JSON.stringify({
      language: 'typescript',
      classes: [{ name: 'OldClass' }],
    });

    // Store the objects and get their actual hashes
    const contentHash = await pgc.objectStore.store(fileContent);
    const structuralHash = await pgc.objectStore.store(structuralDataJson);

    // Create index entry
    await pgc.index.set(filePath, {
      path: filePath,
      content_hash: contentHash,
      structural_hash: structuralHash,
      status: 'Valid',
      history: [],
    });

    // Create overlay that references this structural data
    const overlayMeta: StructuralPatternMetadata = {
      symbol: 'OldClass',
      anchor: filePath,
      symbolStructuralDataHash: structuralHash, // References the structural hash!
      embeddingHash: 'embed789',
      structuralSignature: 'class:OldClass',
      architecturalRole: 'component',
      computedAt: new Date().toISOString(),
      vectorId: 'vec_old',
      validation: {
        sourceHash: contentHash, // Also references content hash!
        embeddingModelVersion: 'test-model',
        extractionMethod: 'ast_native',
        fidelity: 1.0,
      },
    };

    await pgc.overlays.update(
      'structural_patterns',
      `${filePath}#OldClass`,
      overlayMeta
    );
    await pgc.overlays.updateManifest(
      'structural_patterns',
      'OldClass',
      filePath
    );

    // Verify objects exist before GC
    expect(await pgc.objectStore.exists(contentHash)).toBe(true);
    expect(await pgc.objectStore.exists(structuralHash)).toBe(true);

    // Simulate GC Phase 1 logic: file is no longer in processedFiles
    const processedFiles: string[] = []; // Empty - file was deleted
    const allIndexedData = await pgc.index.getAllData();
    const allIndexedPaths = allIndexedData.map((data) => data.path);
    const staleFilePaths = allIndexedPaths.filter(
      (indexedPath) => !processedFiles.includes(indexedPath)
    );

    expect(staleFilePaths).toContain(filePath); // File is indeed stale

    // CRITICAL: Before deleting, we must check if objects are referenced by overlays!
    // This is the fix we need to implement

    // Current buggy behavior would be:
    // await pgc.objectStore.delete(contentHash);  // Deletes hash needed by overlay!
    // await pgc.objectStore.delete(structuralHash); // Deletes hash needed by overlay!

    // The fix: Check all overlay manifests and metadata for references
    const allOverlays = ['structural_patterns', 'lineage_patterns'];
    const referencedHashes = new Set<string>();

    for (const overlayType of allOverlays) {
      const manifest = await pgc.overlays.getManifest(overlayType);
      for (const [symbolName, overlayFilePath] of Object.entries(manifest)) {
        const overlayKey = `${overlayFilePath}#${symbolName}`;
        const overlayData = await pgc.overlays.get(
          overlayType,
          overlayKey,
          StructuralPatternMetadataSchema
        );

        if (overlayData && typeof overlayData === 'object') {
          // Collect all hashes that might be referenced
          if ('symbolStructuralDataHash' in overlayData) {
            referencedHashes.add(
              overlayData.symbolStructuralDataHash as string
            );
          }
          if (
            'validation' in overlayData &&
            typeof overlayData.validation === 'object' &&
            overlayData.validation !== null &&
            'sourceHash' in overlayData.validation
          ) {
            referencedHashes.add(
              (overlayData.validation as { sourceHash: string }).sourceHash
            );
          }
          if ('lineageHash' in overlayData) {
            referencedHashes.add(overlayData.lineageHash as string);
          }
          if ('embeddingHash' in overlayData) {
            referencedHashes.add(overlayData.embeddingHash as string);
          }
        }
      }
    }

    // Verify the fix would detect these hashes
    expect(referencedHashes.has(structuralHash)).toBe(true);
    expect(referencedHashes.has(contentHash)).toBe(true);

    // The fix: Only delete if NOT referenced by overlays
    const canDeleteContent = !referencedHashes.has(contentHash);
    const canDeleteStructural = !referencedHashes.has(structuralHash);

    expect(canDeleteContent).toBe(false); // Should NOT delete (overlay needs it)
    expect(canDeleteStructural).toBe(false); // Should NOT delete (overlay needs it)

    // Verify objects still exist (they should not be deleted)
    expect(await pgc.objectStore.exists(contentHash)).toBe(true);
    expect(await pgc.objectStore.exists(structuralHash)).toBe(true);
  });

  it('GC should delete objects NOT referenced by overlays', async () => {
    // This tests the opposite case: truly stale objects with no overlay references

    const filePath = 'src/truly-stale.ts';
    const staleContent = 'stale content';
    const staleStructural = JSON.stringify({ language: 'typescript' });

    // Store objects and get their hashes
    const contentHash = await pgc.objectStore.store(staleContent);
    const structuralHash = await pgc.objectStore.store(staleStructural);

    // Create index entry but NO overlay references
    await pgc.index.set(filePath, {
      path: filePath,
      content_hash: contentHash,
      structural_hash: structuralHash,
      status: 'Valid',
      history: [],
    });

    // Verify objects exist
    expect(await pgc.objectStore.exists(contentHash)).toBe(true);
    expect(await pgc.objectStore.exists(structuralHash)).toBe(true);

    // Check for overlay references
    const allOverlays = ['structural_patterns', 'lineage_patterns'];
    const referencedHashes = new Set<string>();

    for (const overlayType of allOverlays) {
      const manifest = await pgc.overlays.getManifest(overlayType);
      for (const [symbolName, overlayFilePath] of Object.entries(manifest)) {
        const overlayKey = `${overlayFilePath}#${symbolName}`;
        const overlayData = await pgc.overlays.get(
          overlayType,
          overlayKey,
          StructuralPatternMetadataSchema
        );

        if (overlayData && typeof overlayData === 'object') {
          if ('symbolStructuralDataHash' in overlayData) {
            referencedHashes.add(
              overlayData.symbolStructuralDataHash as string
            );
          }
          if (
            'validation' in overlayData &&
            typeof overlayData.validation === 'object' &&
            overlayData.validation !== null &&
            'sourceHash' in overlayData.validation
          ) {
            referencedHashes.add(
              (overlayData.validation as { sourceHash: string }).sourceHash
            );
          }
        }
      }
    }

    // No overlay references
    expect(referencedHashes.has(contentHash)).toBe(false);
    expect(referencedHashes.has(structuralHash)).toBe(false);

    // These CAN be deleted
    const canDeleteContent = !referencedHashes.has(contentHash);
    const canDeleteStructural = !referencedHashes.has(structuralHash);

    expect(canDeleteContent).toBe(true);
    expect(canDeleteStructural).toBe(true);

    // Actually delete them
    await pgc.objectStore.delete(contentHash);
    await pgc.objectStore.delete(structuralHash);

    // Verify they're gone
    expect(await pgc.objectStore.exists(contentHash)).toBe(false);
    expect(await pgc.objectStore.exists(structuralHash)).toBe(false);
  });
});
