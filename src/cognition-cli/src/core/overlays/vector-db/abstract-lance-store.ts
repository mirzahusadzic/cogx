import { connect, Connection, Table } from '@lancedb/lancedb';
import fs from 'fs-extra';
import { Schema } from 'apache-arrow';
import { withDbRetry } from '../../../core/utils/retry.js';
import { DatabaseError } from '../../../core/errors/index.js';

export const LANCE_DUMMY_ID = 'dummy_record';

/**
 * Abstract base class for LanceDB-based vector stores.
 * Provides common connection management, initialization, and CRUD operations.
 */
export abstract class AbstractLanceStore<T extends Record<string, unknown>> {
  protected db: Connection | undefined;
  protected table: Table | undefined;
  protected isInitialized = false;
  protected initializationPromise: Promise<void> | null = null;

  /**
   * @param dbPath Path to the LanceDB database directory.
   */
  constructor(protected readonly dbPath: string) {}

  /**
   * Initializes the database connection and opens/creates the table.
   * Uses a promise-based locking mechanism to prevent multiple simultaneous initializations.
   * 
   * @param tableName Name of the table to initialize.
   */
  public async initialize(tableName: string): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize(tableName);
    return this.initializationPromise;
  }

  /**
   * Returns the Apache Arrow schema for the table.
   * @param tableName Name of the table.
   */
  protected abstract getSchema(tableName: string): Schema;

  /**
   * Returns a dummy record used to establish the schema when creating a new table.
   * This record is immediately deleted after table creation.
   * @param tableName Name of the table.
   */
  protected abstract createDummyRecord(tableName: string): T;

  /**
   * Internal initialization logic.
   */
  protected async doInitialize(tableName: string): Promise<void> {
    try {
      if (!fs.existsSync(this.dbPath)) {
        await fs.ensureDir(this.dbPath);
      }

      this.db = await connect(this.dbPath);
      const tableNames = await this.db.tableNames();

      if (!tableNames.includes(tableName)) {
        const dummyRecord = this.createDummyRecord(tableName);
        // Ensure dummy record has the dummy ID
        (dummyRecord as any).id = LANCE_DUMMY_ID;

        this.table = await this.db.createTable(tableName, [dummyRecord], {
          schema: this.getSchema(tableName),
        });

        // Delete dummy record
        await this.table.delete(`id = '${LANCE_DUMMY_ID}'`);
      } else {
        this.table = await this.db.openTable(tableName);
      }

      this.isInitialized = true;
    } catch (error) {
      this.initializationPromise = null;
      throw new DatabaseError(
        `initialize ${this.constructor.name}`,
        {
          dbPath: this.dbPath,
          tableName,
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Ensures the store is initialized before performing operations.
   * @throws DatabaseError if not initialized.
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.isInitialized || !this.table) {
      throw new DatabaseError('ensureInitialized', {
        store: this.constructor.name,
      });
    }
  }

  /**
   * Adds records to the table.
   */
  public async add(records: T[]): Promise<void> {
    await this.ensureInitialized();
    await withDbRetry(async () => {
      await this.table!.add(records);
    });
  }

  /**
   * Upserts records into the table based on a unique key (default 'id').
   */
  public async mergeInsert(records: T[], on: string = 'id'): Promise<void> {
    await this.ensureInitialized();
    await withDbRetry(async () => {
      await this.table!
        .mergeInsert(on)
        .whenNotMatchedInsertAll()
        .whenMatchedUpdateAll()
        .execute(records);
    });
  }

  /**
   * Performs a similarity search on the table.
   * 
   * @param queryEmbedding Vector to search for.
   * @param limit Maximum number of results to return.
   * @param filter Optional filter.
   * @param args Additional arguments for specialized implementations.
   */
  public async similaritySearch(
    queryEmbedding: number[],
    limit: number = 5,
    filter?: any,
    ..._args: any[]
  ): Promise<any[]> {
    await this.ensureInitialized();

    return withDbRetry(async () => {
      let query = (this.table!.search as any)(queryEmbedding).limit(limit);

      if (filter && typeof filter === 'string') {
        query = query.where(filter);
      }

      return await query.toArray();
    });
  }

  /**
   * Deletes records matching the given filter.
   */
  public async delete(filter: string): Promise<void> {
    await this.ensureInitialized();
    await withDbRetry(async () => {
      await this.table!.delete(filter);
    });
  }

  /**
   * Clears all records from the table.
   */
  public async clear(): Promise<void> {
    await this.ensureInitialized();
    await withDbRetry(async () => {
      await this.table!.delete('id IS NOT NULL');
    });
  }

  /**
   * Escapes single quotes in a string for use in SQL-like filters.
   */
  protected escapeSqlString(value: string): string {
    return value.replace(/'/g, "''");
  }

  /**
   * Calculates a similarity score from a distance.
   */
  public calculateSimilarity(
    distance: number,
    type: 'l2' | 'cosine' | 'dot' = 'cosine'
  ): number {
    if (type === 'cosine') {
      return Math.max(0, 1 - distance);
    } else if (type === 'dot') {
      return distance;
    } else {
      return 1 / (1 + Math.max(0, distance));
    }
  }
}
