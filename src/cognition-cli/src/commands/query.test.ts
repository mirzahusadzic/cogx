// src/cognition-cli/src/commands/query.test.ts
import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { queryCommand } from './query.js';
import { PGCManager } from '../core/pgc-manager.js';
import { IndexData } from '../types/index.js';
import { Index } from '../core/index.js';
import { ObjectStore } from '../core/object-store.js';
import { StructuralData } from '../types/structural.js';

// Mock PGCManager and its dependencies
vi.mock('../core/pgc-manager.js', () => {
  const mockIndex = {
    search: vi.fn(),
    getAll: vi.fn(),
    get: vi.fn(),
  };
  const mockObjectStore = {
    retrieve: vi.fn(),
  };
  const PGCManager = vi.fn(() => ({
    index: mockIndex,
    objectStore: mockObjectStore,
  }));
  return {
    PGCManager,
  };
});

describe('queryCommand with depth', () => {
  let mockIndex: Mocked<Index>;
  let mockObjectStore: Mocked<ObjectStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    const pgcInstance = new PGCManager('./test-root');
    mockIndex = pgcInstance.index as Mocked<Index>;
    mockObjectStore = pgcInstance.objectStore as Mocked<ObjectStore>;
  });

  describe('depth = 0 (default)', () => {
    it('should only show direct results without dependencies', async () => {
      const mockIndexData: IndexData = {
        content_hash: 'test-content-hash',
        structural_hash: 'test-structural-hash',
        status: 'Valid',
        history: [],
      };

      // Mock structural data WITHOUT dependencies to ensure clean test
      const mockStructuralData = {
        language: 'typescript',
        docstring: '',
        imports: [],
        classes: [
          {
            name: 'TestClass',
            docstring: '',
            base_classes: [], // No dependencies
            implements_interfaces: [], // No dependencies
            methods: [], // No method params with types
            decorators: [],
          },
        ],
        functions: [],
        interfaces: [],
        exports: ['TestClass'],
        dependencies: [],
        extraction_method: 'ast_native',
        fidelity: 1,
      };

      mockIndex.getAll.mockResolvedValue(['test-file.ts']);
      mockIndex.get.mockResolvedValue(mockIndexData);
      mockIndex.search.mockResolvedValue([mockIndexData]);
      mockObjectStore.retrieve.mockResolvedValue(
        Buffer.from(JSON.stringify(mockStructuralData))
      );

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await queryCommand('TestClass', {
        projectRoot: './test-root',
        depth: '0',
      });

      // Should only call retrieve for the main result
      expect(mockObjectStore.retrieve).toHaveBeenCalledTimes(1);
      expect(mockObjectStore.retrieve).toHaveBeenCalledWith(
        'test-structural-hash'
      );

      // Should not show dependencies section
      const logs = consoleSpy.mock.calls.flat().join('\n');
      expect(logs).not.toContain('--- Dependencies ---');

      consoleSpy.mockRestore();
    });
  });

  describe('depth = 1', () => {
    it('should show direct results and first-level dependencies', async () => {
      const mainIndexData: IndexData = {
        content_hash: 'main-hash',
        structural_hash: 'main-structural-hash',
        status: 'Valid',
        history: [],
      };

      const baseClassIndexData: IndexData = {
        content_hash: 'base-hash',
        structural_hash: 'base-structural-hash',
        status: 'Valid',
        history: [],
      };

      // Main class that extends BaseClass
      const mainStructuralData = {
        language: 'typescript',
        docstring: '',
        imports: [],
        classes: [
          {
            name: 'MainClass',
            docstring: '',
            base_classes: ['BaseClass'],
            implements_interfaces: [],
            methods: [],
            decorators: [],
          },
        ],
        functions: [],
        interfaces: [],
        exports: [],
        dependencies: [],
        extraction_method: 'ast_native',
        fidelity: 1,
      };

      // Base class dependency
      const baseStructuralData = {
        language: 'typescript',
        docstring: 'Base class documentation',
        imports: [],
        classes: [
          {
            name: 'BaseClass',
            docstring: '',
            base_classes: [],
            implements_interfaces: [],
            methods: [],
            decorators: [],
          },
        ],
        functions: [],
        interfaces: [],
        exports: [],
        dependencies: [],
        extraction_method: 'ast_native',
        fidelity: 1,
      };

      // Mock the search flow
      mockIndex.getAll.mockResolvedValue(['main-file.ts', 'base-file.ts']);
      mockIndex.get.mockImplementation((key: string) => {
        if (key === 'main-file.ts') return Promise.resolve(mainIndexData);
        if (key === 'base-file.ts') return Promise.resolve(baseClassIndexData);
        return Promise.resolve(null);
      });

      mockIndex.search.mockImplementation((term: string) => {
        if (term === 'MainClass') return Promise.resolve([mainIndexData]);
        if (term === 'BaseClass') return Promise.resolve([baseClassIndexData]);
        return Promise.resolve([]);
      });

      mockObjectStore.retrieve.mockImplementation((hash: string) => {
        if (hash === 'main-structural-hash') {
          return Promise.resolve(
            Buffer.from(JSON.stringify(mainStructuralData))
          );
        }
        if (hash === 'base-structural-hash') {
          return Promise.resolve(
            Buffer.from(JSON.stringify(baseStructuralData))
          );
        }
        return Promise.resolve(null);
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await queryCommand('MainClass', {
        projectRoot: './test-root',
        depth: '1',
      });

      // Should retrieve both main result and dependency
      expect(mockObjectStore.retrieve).toHaveBeenCalledWith(
        'main-structural-hash'
      );
      expect(mockObjectStore.retrieve).toHaveBeenCalledWith(
        'base-structural-hash'
      );

      // Should show dependencies section
      const logs = consoleSpy.mock.calls.flat().join('\n');
      expect(logs).toContain('--- Dependencies ---');
      expect(logs).toContain('BaseClass');

      consoleSpy.mockRestore();
    });
  });

  describe('depth > 1', () => {
    it('should traverse multiple levels of dependencies', async () => {
      const mainIndexData: IndexData = {
        content_hash: 'main-hash',
        structural_hash: 'main-structural-hash',
        status: 'Valid',
        history: [],
      };

      const level1IndexData: IndexData = {
        content_hash: 'level1-hash',
        structural_hash: 'level1-structural-hash',
        status: 'Valid',
        history: [],
      };

      const level2IndexData: IndexData = {
        content_hash: 'level2-hash',
        structural_hash: 'level2-structural-hash',
        status: 'Valid',
        history: [],
      };

      // Multi-level inheritance chain
      const mainStructuralData = {
        classes: [
          {
            name: 'MainClass',
            base_classes: ['Level1Class'],
            implements_interfaces: [],
            methods: [],
          },
        ],
      };

      const level1StructuralData = {
        classes: [
          {
            name: 'Level1Class',
            base_classes: ['Level2Class'],
            implements_interfaces: [],
            methods: [],
          },
        ],
      };

      const level2StructuralData = {
        classes: [
          {
            name: 'Level2Class',
            base_classes: [],
            implements_interfaces: [],
            methods: [],
          },
        ],
      };

      // Mock the search flow for multi-level traversal
      mockIndex.getAll.mockResolvedValue(['main.ts', 'level1.ts', 'level2.ts']);
      mockIndex.get.mockImplementation((key: string) => {
        const dataMap: Record<string, IndexData> = {
          'main.ts': mainIndexData,
          'level1.ts': level1IndexData,
          'level2.ts': level2IndexData,
        };
        return Promise.resolve(dataMap[key] || null);
      });

      mockIndex.search.mockImplementation((term: string) => {
        const resultsMap: Record<string, IndexData[]> = {
          MainClass: [mainIndexData],
          Level1Class: [level1IndexData],
          Level2Class: [level2IndexData],
        };
        return Promise.resolve(resultsMap[term] || []);
      });

      mockObjectStore.retrieve.mockImplementation((hash: string) => {
        const dataMap: Record<string, StructuralData> = {
          'main-structural-hash': mainStructuralData,
          'level1-structural-hash': level1StructuralData,
          'level2-structural-hash': level2StructuralData,
        };
        return Promise.resolve(Buffer.from(JSON.stringify(dataMap[hash])));
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await queryCommand('MainClass', {
        projectRoot: './test-root',
        depth: '2',
      });

      // Should retrieve all three levels
      expect(mockObjectStore.retrieve).toHaveBeenCalledWith(
        'main-structural-hash'
      );
      expect(mockObjectStore.retrieve).toHaveBeenCalledWith(
        'level1-structural-hash'
      );
      expect(mockObjectStore.retrieve).toHaveBeenCalledWith(
        'level2-structural-hash'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle circular dependencies gracefully', async () => {
      const classAIndexData: IndexData = {
        content_hash: 'a-hash',
        structural_hash: 'a-structural-hash',
        status: 'Valid',
        history: [],
      };

      const classBIndexData: IndexData = {
        content_hash: 'b-hash',
        structural_hash: 'b-structural-hash',
        status: 'Valid',
        history: [],
      };

      // Circular dependency: A -> B -> A
      const classAStructuralData = {
        classes: [
          {
            name: 'ClassA',
            base_classes: ['ClassB'], // A depends on B
            implements_interfaces: [],
            methods: [],
          },
        ],
      };

      const classBStructuralData = {
        classes: [
          {
            name: 'ClassB',
            base_classes: ['ClassA'], // B depends on A (circular)
            implements_interfaces: [],
            methods: [],
          },
        ],
      };

      mockIndex.getAll.mockResolvedValue(['a.ts', 'b.ts']);
      mockIndex.get.mockImplementation((key: string) => {
        if (key === 'a.ts') return Promise.resolve(classAIndexData);
        if (key === 'b.ts') return Promise.resolve(classBIndexData);
        return Promise.resolve(null);
      });

      mockIndex.search.mockImplementation((term: string) => {
        if (term === 'ClassA') return Promise.resolve([classAIndexData]);
        if (term === 'ClassB') return Promise.resolve([classBIndexData]);
        return Promise.resolve([]);
      });

      mockObjectStore.retrieve.mockImplementation((hash: string) => {
        if (hash === 'a-structural-hash') {
          return Promise.resolve(
            Buffer.from(JSON.stringify(classAStructuralData))
          );
        }
        if (hash === 'b-structural-hash') {
          return Promise.resolve(
            Buffer.from(JSON.stringify(classBStructuralData))
          );
        }
        return Promise.resolve(null);
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // This should not infinite loop
      await queryCommand('ClassA', {
        projectRoot: './test-root',
        depth: '3',
      });

      // Should still complete execution
      expect(mockObjectStore.retrieve).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle missing dependencies gracefully', async () => {
      const mainIndexData: IndexData = {
        content_hash: 'main-hash',
        structural_hash: 'main-structural-hash',
        status: 'Valid',
        history: [],
      };

      const mainStructuralData = {
        classes: [
          {
            name: 'MainClass',
            base_classes: ['NonExistentClass'], // Dependency that doesn't exist
            implements_interfaces: [],
            methods: [],
          },
        ],
      };

      mockIndex.getAll.mockResolvedValue(['main.ts']);
      mockIndex.get.mockResolvedValue(mainIndexData);
      mockIndex.search.mockImplementation((term: string) => {
        if (term === 'MainClass') return Promise.resolve([mainIndexData]);
        return Promise.resolve([]); // NonExistentClass returns empty
      });

      mockObjectStore.retrieve.mockResolvedValue(
        Buffer.from(JSON.stringify(mainStructuralData))
      );

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await queryCommand('MainClass', {
        projectRoot: './test-root',
        depth: '1',
      });

      // Should still show main result even if dependency is missing
      const logs = consoleSpy.mock.calls.flat().join('\n');
      expect(logs).toContain('MainClass');

      consoleSpy.mockRestore();
    });
  });

  describe('search for method names', () => {
    it('should find a method name within structural data', async () => {
      const mockStructuralData = {
        language: 'typescript',
        docstring: '',
        imports: [
          '../executors/workbench-client.js',
          './ast-parsers/index.js',
          './slm-extractor.js',
          './llm-supervisor.js',
          '../types/structural.js',
          '../types/structural.js',
        ],
        classes: [
          {
            name: 'StructuralMiner',
            docstring: '',
            base_classes: [],
            implements_interfaces: [],
            methods: [
              {
                name: 'constructor',
                docstring: '',
                params: [
                  {
                    name: 'workbench',
                    type: 'WorkbenchClient',
                    optional: false,
                  },
                ],
                returns: 'void',
                is_async: false,
                decorators: [],
              },
              {
                name: 'extractStructure',
                docstring: '',
                params: [
                  {
                    name: 'file',
                    type: 'SourceFile',
                    optional: false,
                  },
                ],
                returns: 'Promise<StructuralData>',
                is_async: true,
                decorators: [],
              },
            ],
            decorators: [],
          },
        ],
        functions: [],
        interfaces: [],
        exports: ['StructuralMiner'],
        dependencies: [
          '../executors/workbench-client.js',
          './ast-parsers/index.js',
          './slm-extractor.js',
          './llm-supervisor.js',
          '../types/structural.js',
          '../types/structural.js',
        ],
        extraction_method: 'ast_native',
        fidelity: 1,
      };

      const mockIndexData: IndexData = {
        path: 'src/miners/structural-miner.ts',
        content_hash: 'test-content-hash',
        structural_hash: 'test-structural-hash',
        status: 'Valid',
        history: [],
        structuralData: mockStructuralData,
      };

      mockIndex.getAll.mockResolvedValue(['src/miners/structural-miner.ts']);
      mockIndex.get.mockResolvedValue(mockIndexData);
      mockIndex.search.mockResolvedValue([mockIndexData]);
      mockObjectStore.retrieve.mockResolvedValue(
        Buffer.from(JSON.stringify(mockIndexData.structuralData))
      );

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await queryCommand('extractStructure', {
        projectRoot: './test-root',
        depth: '0',
      });

      const logs = consoleSpy.mock.calls.flat().join('\n');
      expect(logs).toContain('extractStructure');
      expect(logs).toContain('StructuralMiner');

      consoleSpy.mockRestore();
    });
  });
});
