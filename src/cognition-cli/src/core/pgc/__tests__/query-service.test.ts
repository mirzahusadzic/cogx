import { describe, it, expect, vi } from 'vitest';
import { PGCQueryService } from '../query-service.js';
import { PGCStoreContext } from '../store-context.js';
import { IndexData } from '../../types/index.js';

describe('PGCQueryService', () => {
  const mockContext = {
    index: {
      search: vi.fn(),
    },
    objectStore: {
      retrieve: vi.fn(),
    },
    reverseDeps: {
      getTransformIds: vi.fn(),
    },
    transformLog: {
      getTransformation: vi.fn(),
    },
  } as unknown as PGCStoreContext;

  const queryService = new PGCQueryService(mockContext);

  it('search() delegates to index.search() with correct parameters', async () => {
    const mockResults: IndexData[] = [
      { structural_hash: 'hash1', path: 'file.ts', symbol: 'MyClass' },
    ];
    vi.mocked(mockContext.index.search).mockResolvedValue(mockResults);

    const result = await queryService.search('MyClass', 'context1');

    expect(mockContext.index.search).toHaveBeenCalledWith(
      'MyClass',
      mockContext.objectStore,
      'context1'
    );
    expect(result).toBe(mockResults);
  });

  it('getStore() returns the object store', () => {
    expect(queryService.getStore()).toBe(mockContext.objectStore);
  });

  it('findBestResultForSymbol() returns the result with highest fidelity', async () => {
    const mockResults: IndexData[] = [
      { structural_hash: 'hash1', symbol: 'C' },
      { structural_hash: 'hash2', symbol: 'C' },
    ];
    vi.mocked(mockContext.index.search).mockResolvedValue(mockResults);

    vi.mocked(mockContext.objectStore.retrieve).mockImplementation(
      async (hash) => {
        if (hash === 'hash1')
          return Buffer.from(JSON.stringify({ fidelity: 50 }));
        if (hash === 'hash2')
          return Buffer.from(JSON.stringify({ fidelity: 100 }));
        return null;
      }
    );

    const result = await queryService.findBestResultForSymbol('C');

    expect(result).toEqual(mockResults[1]);
  });

  it('getLineageForSymbol() returns initial context even with no dependencies', async () => {
    const mockInitialResult: IndexData = {
      structural_hash: 'initial_hash',
      symbol: 'MySymbol',
      path: 'my-file.ts',
    };
    vi.mocked(mockContext.index.search).mockResolvedValue([mockInitialResult]);
    vi.mocked(mockContext.objectStore.retrieve).mockResolvedValue(
      Buffer.from(JSON.stringify({ name: 'MySymbol' }))
    );
    vi.mocked(mockContext.reverseDeps.getTransformIds).mockResolvedValue([]);

    const result = await queryService.getLineageForSymbol('MySymbol', {
      maxDepth: 2,
    });

    expect(result.initialContext).toHaveLength(1);
    expect(result.initialContext[0]).toEqual({ name: 'MySymbol' });
    expect(result.dependencies).toHaveLength(0);
  });

  it('getLineageForSymbol() performs complex traversal through transform log', async () => {
    // 1. Initial symbol
    const initialResult: IndexData = {
      structural_hash: 'sym_h',
      symbol: 'S',
      path: 'S.ts',
    };
    vi.mocked(mockContext.index.search).mockImplementation(async (symbol) => {
      if (symbol === 'S') return [initialResult];
      if (symbol === 'Dep')
        return [{ structural_hash: 'dep_h', symbol: 'Dep', path: 'Dep.ts' }];
      return [];
    });

    // 2. Initial object
    vi.mocked(mockContext.objectStore.retrieve).mockImplementation(
      async (hash) => {
        if (hash === 'sym_h') return Buffer.from(JSON.stringify({ name: 'S' }));
        if (hash === 'src_h')
          return Buffer.from(
            JSON.stringify({
              classes: [
                {
                  name: 'S',
                  methods: [{ name: 'm', params: [{ type: 'Dep' }] }],
                },
              ],
            })
          );
        if (hash === 'dep_h')
          return Buffer.from(JSON.stringify({ name: 'Dep' }));
        return null;
      }
    );

    // 3. Reverse dependency to find transform
    vi.mocked(mockContext.reverseDeps.getTransformIds).mockImplementation(
      async (hash) => {
        if (hash === 'sym_h') return ['t1'];
        return [];
      }
    );

    // 4. Transform data to find source input
    vi.mocked(mockContext.transformLog.getTransformation).mockImplementation(
      async (id) => {
        if (id === 't1') return { inputs: [{ hash: 'src_h' }] };
        return null;
      }
    );

    const result = await queryService.getLineageForSymbol('S', { maxDepth: 1 });

    expect(result.initialContext).toHaveLength(1);
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].structuralData.name).toBe('Dep');
    expect(result.dependencies[0].path).toBe('S.ts -> S -> m');
  });
});
