import { connect, Connection, Table } from '@lancedb/lancedb';
import fs from 'fs-extra';
import { Schema } from 'apache-arrow';
import { withDbRetry } from '../utils/retry.js';
import { DatabaseError } from '../errors/index.js';

/**
 * ID used for dummy records created during table initialization
 * to establish the schema. These records are deleted immediately after.
 */
export const LANCE_DUMMY_ID = 'dummy_record';

/**
 * Base class for LanceDB-based vector stores.
 *
 * Provides a standardized infrastructure for managing LanceDB connections,
 * table lifecycles, and core CRUD operations with built-in retry logic
 * and thread-safe initialization.
 *
 * DESIGN:
 * - Centralizes connection management and error handling.
 * - Uses a promise-based locking mechanism for initialization.
 * - Enforces schema via abstract methods and dummy record creation.
 * - Standardizes common operations (add, mergeInsert, search, delete).
 *
 * @template T The record type stored in the database.
 *
 * @example
 * ```typescript
 * class MyStore extends BaseLanceStore<MyRecord> {
 *   constructor(dbPath: string) {
 *     super(dbPath, 'my_table');
 *   }
 *
 *   protected getSchema(): Schema {
 *     return new Schema([...]);
 *   }
 *
 *   protected createDummyRecord(): MyRecord {
 *     return { id: LANCE_DUMMY_ID, ... };
 *   }
 * }
 * ```
 */
export abstract class BaseLanceStore<T extends Record<string, unknown>> {
  /**
   * Database connection instance.
   */
  protected db: Connection | undefined;

  /**
   * The primary table managed by this store.
   */
  protected table: Table | undefined;

  /**
   * Tracks if the store has completed initialization.
   */
  protected isInitialized = false;

  /**
   * Promise used to coordinate concurrent initialization calls.
   */
  protected initializationPromise: Promise<void> | null = null;

  /**
   * Name of the table managed by this store.
   */
  protected tableName: string;

  /**
   * Creates a new LanceDB store instance.
   *
   * @param dbPath - Absolute path to the LanceDB database directory.
   * @param tableName - Name of the table managed by this store.
   */
  constructor(
    protected readonly dbPath: string,
    tableName: string
  ) {
    this.tableName = tableName;
  }

  /**
   * Initializes the database connection and opens/creates the table.
   *
   * Uses a promise-based locking mechanism to prevent multiple simultaneous
   * initializations of the same store instance.
   *
   * @param tableName - Optional table name to override the constructor-provided one.
   * @returns Promise that resolves when initialization is complete.
   * @throws DatabaseError if initialization fails.
   */
  public async initialize(tableName?: string): Promise<void> {
    if (tableName && tableName !== this.tableName) {
      // If a different table is requested, reset initialization state
      this.tableName = tableName;
      this.isInitialized = false;
      this.initializationPromise = null;
      this.table = undefined;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  /**
   * Internal initialization logic.
   * Handles directory creation, connection, and table setup.
   * @private
   */
  protected async doInitialize(): Promise<void> {
    try {
      let connectionPath = this.dbPath;

      // Use in-memory database for tests with non-writable paths
      if (
        process.env.NODE_ENV === 'test' &&
        connectionPath.startsWith('/test')
      ) {
        connectionPath = 'memory://';
      }

      if (connectionPath !== 'memory://' && !fs.existsSync(connectionPath)) {
        await fs.ensureDir(connectionPath);
      }

      this.db = await connect(connectionPath);
      const tableNames = await this.db.tableNames();

      if (!tableNames.includes(this.tableName)) {
        const dummyRecord = this.createDummyRecord();
        // Ensure dummy record has the dummy ID for deletion safety
        (dummyRecord as Record<string, unknown>).id = LANCE_DUMMY_ID;

        this.table = await this.db.createTable(this.tableName, [dummyRecord], {
          schema: this.getSchema(),
        });

        // Delete dummy record immediately to leave an empty table with the correct schema
        await this.table.delete(`id = '${LANCE_DUMMY_ID}'`);
      } else {
        this.table = await this.db.openTable(this.tableName);
      }

      this.isInitialized = true;
    } catch (error) {
      this.initializationPromise = null;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';

      throw new DatabaseError(
        `initialize ${this.constructor.name}`,
        {
          dbPath: this.dbPath,
          tableName: this.tableName,
          originalError: errorMessage,
          stack: errorStack,
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Returns the Apache Arrow schema for the table.
   * Must be implemented by subclasses.
   *
   * @returns Apache Arrow Schema object.
   */
  protected abstract getSchema(): Schema;

  /**
   * Returns a dummy record used to establish the schema when creating a new table.
   * This record is immediately deleted after table creation.
   *
   * @returns A valid record instance of type T.
   */
  protected abstract createDummyRecord(): T;

  /**
   * Ensures the store is initialized before performing operations.
   *
   * @throws DatabaseError if the store is not initialized.
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.isInitialized || !this.table) {
      // Attempt auto-initialization if not yet started
      if (!this.initializationPromise) {
        await this.initialize();
      } else {
        await this.initializationPromise;
      }

      if (!this.isInitialized || !this.table) {
        throw new DatabaseError('ensureInitialized failed', {
          store: this.constructor.name,
          tableName: this.tableName,
        });
      }
    }
  }

  /**
   * Adds records to the table.
   *
   * @param records - Array of records to insert.
   * @throws DatabaseError if the operation fails after retries.
   */
  public async add(records: T[]): Promise<void> {
    await this.ensureInitialized();
    await withDbRetry(async () => {
      await this.table!.add(records);
    });
  }

  /**
   * Upserts records into the table based on a unique key.
   *
   * @param records - Array of records to merge.
   * @param on - The unique field to match on (default: 'id').
   * @throws DatabaseError if the operation fails after retries.
   */
  public async mergeInsert(records: T[], on: string = 'id'): Promise<void> {
    await this.ensureInitialized();
    await withDbRetry(async () => {
      await this.table!.mergeInsert(on)
        .whenNotMatchedInsertAll()
        .whenMatchedUpdateAll()
        .execute(records);
    });
  }

  /**
   * Performs a similarity search on the table.
   *
   * @param queryEmbedding - Vector to search for.
   * @param limit - Maximum number of results to return (default: 5).
   * @param filter - Optional SQL-like filter string.
   * @returns Promise resolving to raw search results from LanceDB.
   */
  public async similaritySearch(
    queryEmbedding: number[],
    limit: number = 5,
    filter?: string
  ): Promise<Array<Record<string, unknown>>> {
    await this.ensureInitialized();

    return withDbRetry(async () => {
      let query = this.table!.search(queryEmbedding).limit(limit);

      if (filter) {
        query = query.where(filter);
      }

      const results = await query.toArray();
      return results as Array<Record<string, unknown>>;
    });
  }

  /**
   * Deletes records matching the given filter.
   *
   * @param filter - SQL-like filter string (e.g., "id = '123'").
   * @throws DatabaseError if the operation fails after retries.
   */
  public async delete(filter: string): Promise<void> {
    await this.ensureInitialized();
    await withDbRetry(async () => {
      await this.table!.delete(filter);
    });
  }

  /**
   * Clears all records from the table.
   *
   * @throws DatabaseError if the operation fails after retries.
   */
  public async clear(): Promise<void> {
    await this.ensureInitialized();
    await withDbRetry(async () => {
      // Standard way to clear all records in LanceDB
      await this.table!.delete('id IS NOT NULL');
    });
  }

  /**
   * Compacts and optimizes the table to reclaim space and improve performance.
   *
   * This physically removes deleted records and merges small data files.
   * Uses unified optimize() method from @lancedb/lancedb v0.x.
   *
   * @throws DatabaseError if the operation fails after retries.
   */
  public async compact(): Promise<void> {
    await this.ensureInitialized();
    await withDbRetry(async () => {
      await this.table!.optimize({
        cleanupOlderThan: new Date(),
        deleteUnverified: true,
      });
    });
  }

  /**
   * Closes the database connection and resets initialization state.
   */
  public async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.isInitialized = false;
      this.initializationPromise = null;
      this.table = undefined;
      this.db = undefined;
    }
  }

  /**
   * Escapes single quotes in a string for safe use in SQL-like filters.
   *
   * @param value - The string to escape.
   * @returns Escaped string.
   */
  protected escapeSqlString(value: string): string {
    return value.replace(/'/g, "''");
  }

  /**
   * Calculates a similarity score from a distance.
   * Supports L2, Cosine, and Dot product distance metrics.
   *
   * @param distance - Raw distance from search result.
   * @param type - Distance metric type (default: 'cosine').
   * @returns Similarity score (0-1 for cosine/l2).
   */
  public calculateSimilarity(
    distance: number,
    type: 'l2' | 'cosine' | 'dot' = 'cosine'
  ): number {
    if (type === 'cosine') {
      // LanceDB cosine distance is 1 - cosine_similarity
      return Math.max(0, 1 - distance);
    } else if (type === 'dot') {
      return distance;
    } else {
      // L2 distance normalization
      return 1 / (1 + Math.max(0, distance));
    }
  }
}
