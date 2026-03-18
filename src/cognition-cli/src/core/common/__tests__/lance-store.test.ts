import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseLanceStore, LANCE_DUMMY_ID } from '../lance-store.js';
import {
  Schema,
  Field,
  Utf8,
  Float,
  Precision,
  FixedSizeList,
} from 'apache-arrow';
import fs from 'fs-extra';
import { connect } from '@lancedb/lancedb';

// Mock LanceDB and FS
vi.mock('@lancedb/lancedb');
vi.mock('fs-extra');

interface MockRecord extends Record<string, unknown> {
  id: string;
  text: string;
  vector: number[];
}

interface MockTable {
  add: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  mergeInsert: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
  optimize: ReturnType<typeof vi.fn>;
}

interface MockDb {
  tableNames: ReturnType<typeof vi.fn>;
  createTable: ReturnType<typeof vi.fn>;
  openTable: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

class TestStore extends BaseLanceStore<MockRecord> {
  constructor() {
    super('/test/db', 'test_table');
  }

  protected getSchema(): Schema {
    return new Schema([
      new Field('id', new Utf8()),
      new Field('text', new Utf8()),
      new Field(
        'vector',
        new FixedSizeList(2, new Field('item', new Float(Precision.DOUBLE)))
      ),
    ]);
  }

  protected createDummyRecord(): MockRecord {
    return {
      id: LANCE_DUMMY_ID,
      text: 'dummy',
      vector: [0.1, 0.2],
    };
  }
}

describe('BaseLanceStore', () => {
  let store: TestStore;
  let mockDb: MockDb;
  let mockTable: MockTable;

  beforeEach(() => {
    vi.resetAllMocks();

    mockTable = {
      add: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      mergeInsert: vi.fn().mockReturnValue({
        whenNotMatchedInsertAll: vi.fn().mockReturnThis(),
        whenMatchedUpdateAll: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }),
      search: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([{ id: '1', _distance: 0.1 }]),
      }),
      optimize: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      tableNames: vi.fn().mockResolvedValue([]),
      createTable: vi.fn().mockResolvedValue(mockTable),
      openTable: vi.fn().mockResolvedValue(mockTable),
      close: vi.fn().mockResolvedValue(undefined),
    };

    (connect as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);
    (fs.existsSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      true
    );

    store = new TestStore();
  });

  describe('initialize', () => {
    it('should create table if it does not exist', async () => {
      mockDb.tableNames.mockResolvedValue([]);

      await store.initialize();

      expect(mockDb.createTable).toHaveBeenCalledWith(
        'test_table',
        expect.any(Array),
        expect.any(Object)
      );
      expect(mockTable.delete).toHaveBeenCalledWith("id = 'dummy_record'");
    });

    it('should open table if it exists', async () => {
      mockDb.tableNames.mockResolvedValue(['test_table']);

      await store.initialize();

      expect(mockDb.openTable).toHaveBeenCalledWith('test_table');
      expect(mockDb.createTable).not.toHaveBeenCalled();
    });

    it('should use memory database for test paths', async () => {
      await store.initialize();
      expect(connect).toHaveBeenCalledWith('memory://');
    });

    it('should prevent concurrent initializations', async () => {
      const p1 = store.initialize();
      const p2 = store.initialize();

      await Promise.all([p1, p2]);

      expect(connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('operations', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('should add records', async () => {
      const records = [{ id: '1', text: 'hi', vector: [0.1, 0.2] }];
      await store.add(records);
      expect(mockTable.add).toHaveBeenCalledWith(records);
    });

    it('should merge insert records', async () => {
      const records = [{ id: '1', text: 'hi', vector: [0.1, 0.2] }];
      await store.mergeInsert(records);
      expect(mockTable.mergeInsert).toHaveBeenCalledWith('id');
    });

    it('should search records', async () => {
      const results = await store.similaritySearch(
        [0.1, 0.2],
        5,
        "text = 'hi'"
      );
      expect(mockTable.search).toHaveBeenCalledWith([0.1, 0.2]);
      expect(results).toHaveLength(1);
    });

    it('should delete records', async () => {
      await store.delete("id = '1'");
      expect(mockTable.delete).toHaveBeenCalledWith("id = '1'");
    });

    it('should clear table', async () => {
      await store.clear();
      expect(mockTable.delete).toHaveBeenCalledWith('id IS NOT NULL');
    });

    it('should optimize table on compact', async () => {
      await store.compact();
      expect(mockTable.optimize).toHaveBeenCalled();
    });
  });

  describe('utilities', () => {
    it('should calculate similarity for cosine', () => {
      expect(store.calculateSimilarity(0.1, 'cosine')).toBe(0.9);
      expect(store.calculateSimilarity(1.5, 'cosine')).toBe(0);
    });

    it('should calculate similarity for l2', () => {
      expect(store.calculateSimilarity(1, 'l2')).toBe(0.5);
    });

    it('should escape sql strings', () => {
      // @ts-expect-error - access protected
      expect(store.escapeSqlString("it's a trap")).toBe("it''s a trap");
    });
  });
});
