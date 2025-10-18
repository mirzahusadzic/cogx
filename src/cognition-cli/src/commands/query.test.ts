// src/commands/query.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  Mocked,
} from 'vitest';

// We import the module directly without mocking it.
import { queryCommand } from './query.js';
import { PGCManager } from '../core/pgc-manager.js';
import { IndexData } from '../types/index.js';
import { Index } from '../core/index.js';
import { ObjectStore } from '../core/object-store.js';

// We only mock the external dependency.
vi.mock('../core/pgc-manager.js');

describe('queryCommand with depth', () => {
  let mockIndex: Mocked<Index>;
  let mockObjectStore: Mocked<ObjectStore>;
  let consoleLogSpy: vi.SpyInstance;

  beforeEach(() => {
    vi.clearAllMocks();

    // Instead of mocking our own module, we spy on the global `console.log`.
    // This will capture all output from the command.
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Setup PGCManager mock as before.
    const mockIndexInstance = {
      search: vi.fn(),
      getAll: vi.fn(),
      get: vi.fn(),
    };
    const mockObjectStoreInstance = { retrieve: vi.fn() };
    (PGCManager as vi.Mock).mockImplementation(() => ({
      index: mockIndexInstance,
      objectStore: mockObjectStoreInstance,
    }));

    const pgcInstance = new PGCManager('./test-root');
    mockIndex = pgcInstance.index as Mocked<Index>;
    mockObjectStore = pgcInstance.objectStore as Mocked<ObjectStore>;
  });

  afterEach(() => {
    // Restore the original console.log after each test.
    vi.restoreAllMocks();
  });

  describe('search for method names', () => {
    it('should find a method name within structural data', async () => {
      const mockStructuralData = {
        language: 'typescript',
        classes: [
          {
            name: 'StructuralMiner',
            methods: [{ name: 'extractStructure' }],
          },
        ],
      };

      const mockIndexData: IndexData = {
        content_hash: 'test-content-hash',
        structural_hash: 'test-structural-hash',
        status: 'Valid',
        history: [],
      };

      // Mock dependency calls
      mockIndex.search.mockResolvedValue([mockIndexData]);
      mockObjectStore.retrieve.mockResolvedValue(
        Buffer.from(JSON.stringify(mockStructuralData))
      );

      // Execute the real command
      await queryCommand('extractStructure', {
        projectRoot: './test-root',
        depth: '0',
      });

      // --- The New Assertion Strategy ---

      // 1. Check that console.log was called at all.
      expect(consoleLogSpy).toHaveBeenCalled();

      // 2. Combine all calls to console.log into a single string for easy searching.
      const allLogs = consoleLogSpy.mock.calls.flat().join('\n');

      // 3. Assert that the key parts of the expected output are present in the logs.
      expect(allLogs).toContain('Query: "extractStructure"');
      expect(allLogs).toContain('--- Relevant Context ---');
      expect(allLogs).toContain('StructuralMiner');
      expect(allLogs).toContain('extractStructure');
    });
  });
});
