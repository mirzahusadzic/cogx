import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { queryCommand } from './query.js';
import { PGCManager } from '../core/pgc-manager.js';
import { IndexData } from '../types/index.js';
import { Index } from '../core/index.js';
import { ObjectStore } from '../core/object-store.js';

// Mock PGCManager and its dependencies
vi.mock('../core/pgc-manager.js', () => {
  const mockIndex = {
    search: vi.fn(),
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

describe('queryCommand', () => {
  let mockIndex: Mocked<Index>;
  let mockObjectStore: Mocked<ObjectStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get the mocked PGCManager instance
    const pgcInstance = new PGCManager('./test-root');
    mockIndex = pgcInstance.index as Mocked<Index>;
    mockObjectStore = pgcInstance.objectStore as Mocked<ObjectStore>;

    // Reset mocks for each test
    mockIndex.search.mockReset();
    mockObjectStore.retrieve.mockReset();
  });

  it('should extract entities and search the index', async () => {
    const mockIndexData: IndexData = {
      content_hash: 'test-content-hash',
      structural_hash: 'test-structural-hash',
      status: 'Valid',
      history: [],
    };
    (mockIndex.search as vi.Mock).mockResolvedValueOnce([mockIndexData]);
    (mockObjectStore.retrieve as vi.Mock).mockResolvedValueOnce(
      Buffer.from('{ "name": "StructuralMiner" }')
    );

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await queryCommand('What does the StructuralMiner class do?', {
      projectRoot: './test-root',
    });

    expect(mockIndex.search).toHaveBeenCalledWith('StructuralMiner');
    expect(mockObjectStore.retrieve).toHaveBeenCalledWith(
      'test-structural-hash'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('StructuralMiner')
    );
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('name'));

    consoleSpy.mockRestore();
  });

  it('should display "No relevant information found." if no entities are extracted', async () => {
    // Mock extractEntities to return an empty array (implicitly, as it's not mocked directly)
    // and mockIndex.search to return an empty array
    (mockIndex.search as vi.Mock).mockResolvedValueOnce([]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await queryCommand('UnknownClass', { projectRoot: './test-root' });

    expect(mockIndex.search).toHaveBeenCalledWith('UnknownClass');
    expect(mockObjectStore.retrieve).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('No relevant information found.');

    consoleSpy.mockRestore();
  });

  it('should display "No relevant information found." if no results from index search', async () => {
    (mockIndex.search as vi.Mock).mockResolvedValueOnce([]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await queryCommand('StructuralMiner', { projectRoot: './test-root' });

    expect(mockIndex.search).toHaveBeenCalledWith('StructuralMiner');
    expect(mockObjectStore.retrieve).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('No relevant information found.');

    consoleSpy.mockRestore();
  });

  it('should handle non-JSON content gracefully', async () => {
    const mockIndexData: IndexData = {
      content_hash: 'test-content-hash',
      structural_hash: 'test-structural-hash',
      status: 'Valid',
      history: [],
    };
    (mockIndex.search as vi.Mock).mockResolvedValueOnce([mockIndexData]);
    (mockObjectStore.retrieve as vi.Mock).mockResolvedValueOnce(
      Buffer.from('This is not JSON')
    );

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await queryCommand('What does the StructuralMiner class do?', {
      projectRoot: './test-root',
    });

    expect(mockIndex.search).toHaveBeenCalledWith('StructuralMiner');
    expect(mockObjectStore.retrieve).toHaveBeenCalledWith(
      'test-structural-hash'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('This is not JSON')
    );

    consoleSpy.mockRestore();
  });
});
