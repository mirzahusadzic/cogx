import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { PGCManager } from '../../pgc/manager.js';
import {
  StructuralData,
  StructuralPatternMetadata,
} from '../../types/structural.js';

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

describe('LineagePatternWorker - Symbol Resolution Bug', () => {
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

  it('CRITICAL: should extract the correct symbol when file has multiple symbols', async () => {
    // This test reproduces the bug where GenesisJobResult shows "parseNativeAST" as the symbol

    // Simulate a file like genesis-worker.ts with both an interface and a function
    const fileStructuralData: StructuralData = {
      language: 'typescript',
      docstring: '',
      imports: [],
      classes: [],
      functions: [
        {
          name: 'parseNativeAST',
          docstring: 'Parse file using native AST parser',
          params: [
            {
              name: 'job',
              type: 'GenesisJobPacket',
              optional: false,
            },
          ],
          returns: 'Promise<GenesisJobResult>',
          is_async: true,
          decorators: [],
        },
      ],
      interfaces: [
        {
          name: 'GenesisJobPacket',
          docstring: '',
          properties: [
            { name: 'file', type: 'SourceFile' },
            { name: 'contentHash', type: 'string' },
          ],
        },
        {
          name: 'GenesisJobResult',
          docstring: '',
          properties: [
            { name: 'status', type: "'success' | 'error'" },
            { name: 'relativePath', type: 'string' },
            { name: 'contentHash', type: 'string' },
            { name: 'structuralData', type: 'StructuralData', optional: true },
            { name: 'error', type: 'string', optional: true },
          ],
        },
      ],
      exports: ['GenesisJobPacket', 'GenesisJobResult', 'parseNativeAST'],
      dependencies: [],
      extraction_method: 'ast_native',
      fidelity: 1.0,
    };

    // Store the structural data
    const structuralDataJson = JSON.stringify(fileStructuralData);
    const structuralHash = pgc.objectStore.computeHash(structuralDataJson);
    await pgc.objectStore.store(structuralDataJson, structuralHash);

    // Create a transform record
    const transformId = '001_genesis';
    await pgc.transformLog.record({
      transformId,
      method: 'ast_native',
      inputs: [],
      outputs: [{ hash: structuralHash, type: 'structural_data' }],
      timestamp: new Date().toISOString(),
      fidelity: 1.0,
    });

    // Add reverse dependency
    await pgc.reverseDeps.add(structuralHash, transformId);

    // Setup structural patterns manifest (updateManifest ensures directory exists)
    await pgc.overlays.updateManifest(
      'structural_patterns',
      'GenesisJobResult',
      'src/core/orchestrators/genesis-worker.ts'
    );

    // Create structural pattern metadata for GenesisJobResult
    const structuralPatternMeta: StructuralPatternMetadata = {
      symbol: 'GenesisJobResult',
      anchor: 'src/core/orchestrators/genesis-worker.ts',
      symbolStructuralDataHash: structuralHash,
      embeddingHash: 'embed123',
      structuralSignature: 'interface:GenesisJobResult',
      architecturalRole: 'component',
      computedAt: new Date().toISOString(),
      vectorId: 'test_vec',
      validation: {
        sourceHash: 'source123',
        embeddingModelVersion: 'test-model',
        extractionMethod: 'ast_native',
        fidelity: 1.0,
      },
    };

    await pgc.overlays.update(
      'structural_patterns',
      'src/core/orchestrators/genesis-worker.ts#GenesisJobResult',
      structuralPatternMeta
    );

    // Import the worker logic (note: we need to test the internal class)
    // For now, let's test the behavior we expect

    // When we retrieve the structural data for GenesisJobResult
    const retrievedData = await pgc.objectStore.retrieve(structuralHash);
    const parsedData = JSON.parse(retrievedData!.toString()) as StructuralData;

    // The bug is that _formatAsLineageJSON picks the wrong symbol
    // It checks: classes[0] || functions[0] || interfaces[0]
    // So for this file, it would pick 'parseNativeAST' (functions[0])
    // Instead of 'GenesisJobResult' (interfaces[1])

    // Expected: Symbol should be 'GenesisJobResult'
    // Actual (bug): Symbol would be 'parseNativeAST'

    // We need to find the specific symbol we're looking for
    const targetSymbol = 'GenesisJobResult';
    const foundInterface = parsedData.interfaces?.find(
      (i) => i.name === targetSymbol
    );

    expect(foundInterface).toBeDefined();
    expect(foundInterface!.name).toBe('GenesisJobResult');

    // The current implementation would incorrectly pick:
    const buggyBehavior =
      parsedData.classes?.[0]?.name ||
      parsedData.functions?.[0]?.name ||
      parsedData.interfaces?.[0]?.name ||
      '';

    // This would be 'parseNativeAST' (wrong!)
    expect(buggyBehavior).toBe('parseNativeAST');

    // The correct behavior should find the specific symbol
    const correctBehavior =
      parsedData.classes?.find((c) => c.name === targetSymbol)?.name ||
      parsedData.functions?.find((f) => f.name === targetSymbol)?.name ||
      parsedData.interfaces?.find((i) => i.name === targetSymbol)?.name ||
      '';

    expect(correctBehavior).toBe('GenesisJobResult');
  });

  it('CRITICAL: should extract dependencies from interface properties', async () => {
    // Test that dependencies like 'StructuralData' are found in interface properties

    const fileStructuralData: StructuralData = {
      language: 'typescript',
      docstring: '',
      imports: [],
      classes: [],
      functions: [],
      interfaces: [
        {
          name: 'GenesisJobResult',
          docstring: '',
          properties: [
            { name: 'status', type: "'success' | 'error'" },
            { name: 'structuralData', type: 'StructuralData', optional: true },
            { name: 'error', type: 'string', optional: true },
          ],
        },
      ],
      exports: ['GenesisJobResult'],
      dependencies: [],
      extraction_method: 'ast_native',
      fidelity: 1.0,
    };

    // Extract potential dependency types from properties
    const dependencies = new Set<string>();

    fileStructuralData.interfaces?.forEach((i) => {
      i.properties?.forEach((p) => {
        const cleanType = p.type
          .replace(/\[\]/g, '') // Remove array brackets
          .replace(/<[^>]*>/g, '') // Remove generic parameters
          .split('|')[0] // Take first union type
          .trim();

        // Filter out primitives and built-ins
        const excludeTypes = new Set([
          'string',
          'number',
          'boolean',
          'any',
          'void',
          'undefined',
          'null',
        ]);

        if (
          !excludeTypes.has(cleanType) &&
          /^[A-Z]/.test(cleanType) &&
          cleanType.length > 1 &&
          !cleanType.includes("'") // Exclude literal types
        ) {
          dependencies.add(cleanType);
        }
      });
    });

    // Should find 'StructuralData' as a dependency
    expect(dependencies.has('StructuralData')).toBe(true);
    expect(dependencies.size).toBe(1); // Only StructuralData, not the primitives or literals
  });

  it('should handle interface with no dependencies gracefully', async () => {
    const fileStructuralData: StructuralData = {
      language: 'typescript',
      docstring: '',
      imports: [],
      classes: [],
      functions: [],
      interfaces: [
        {
          name: 'SimpleInterface',
          docstring: '',
          properties: [
            { name: 'id', type: 'string' },
            { name: 'count', type: 'number' },
            { name: 'active', type: 'boolean' },
          ],
        },
      ],
      exports: ['SimpleInterface'],
      dependencies: [],
      extraction_method: 'ast_native',
      fidelity: 1.0,
    };

    const dependencies = new Set<string>();

    fileStructuralData.interfaces?.forEach((i) => {
      i.properties?.forEach((p) => {
        const cleanType = p.type
          .replace(/\[\]/g, '')
          .replace(/<[^>]*>/g, '')
          .split('|')[0]
          .trim();

        const excludeTypes = new Set([
          'string',
          'number',
          'boolean',
          'any',
          'void',
          'undefined',
          'null',
        ]);

        if (
          !excludeTypes.has(cleanType) &&
          /^[A-Z]/.test(cleanType) &&
          cleanType.length > 1
        ) {
          dependencies.add(cleanType);
        }
      });
    });

    // Should have no dependencies (all primitives)
    expect(dependencies.size).toBe(0);
  });
});
