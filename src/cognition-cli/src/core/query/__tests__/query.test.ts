import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  Mocked,
} from 'vitest';

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

import { queryCommand, QueryResult } from '../query.js';
import { PGCManager } from '../../pgc/manager.js';
import { IndexData } from '../../types/index.js';
import { Index } from '../../pgc/index.js';
import { ObjectStore } from '../../pgc/object-store.js';
import { StructuralData } from '../../types/structural.js';

vi.mock('../../pgc/manager.js');

describe('queryCommand', () => {
  let mockIndex: Mocked<Index>;
  let mockObjectStore: Mocked<ObjectStore>;

  beforeEach(() => {
    vi.clearAllMocks();

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
    vi.restoreAllMocks();
  });

  it('should return a QueryResult object with the correct structure', async () => {
    const mockStructuralData: StructuralData = {
      language: 'typescript',
      classes: [
        {
          name: 'RootClass',
          methods: [],
          base_classes: ['BaseClass'],
        },
      ],
    };
    const mockDepData: StructuralData = {
      language: 'typescript',
      classes: [{ name: 'BaseClass', methods: [] }],
    };

    const mockIndexData: IndexData = {
      content_hash: 'test-content-hash',
      structural_hash: 'test-structural-hash',
      status: 'Valid',
      history: [],
    };
    const mockDepIndexData: IndexData = {
      content_hash: 'dep-content-hash',
      structural_hash: 'dep-structural-hash',
      status: 'Valid',
      history: [],
    };

    mockIndex.search.mockImplementation(async (symbol: string) => {
      if (symbol === 'RootClass') return [mockIndexData];
      if (symbol === 'BaseClass') return [mockDepIndexData];
      return [];
    });

    mockObjectStore.retrieve.mockImplementation(async (hash: string) => {
      if (hash === 'test-structural-hash')
        return Buffer.from(JSON.stringify(mockStructuralData));
      if (hash === 'dep-structural-hash')
        return Buffer.from(JSON.stringify(mockDepData));
      return null;
    });

    const result: QueryResult = await queryCommand('RootClass', {
      projectRoot: './test-root',
      depth: '1',
    });

    expect(result.question).toBe('RootClass');
    expect(result.initialContext).toHaveLength(1);
    expect(result.initialContext[0].classes?.[0].name).toBe('RootClass');

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].depth).toBe(1);
    expect(result.dependencies[0].path).toBe('RootClass -> BaseClass');
    expect(result.dependencies[0].structuralData.classes?.[0].name).toBe(
      'BaseClass'
    );
  });
});
