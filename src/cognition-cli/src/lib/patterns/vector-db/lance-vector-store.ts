import { connect, Connection, Table } from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs-extra';
import {
  Field,
  Schema,
  Utf8,
  FixedSizeList,
  Float,
  Precision,
} from 'apache-arrow';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../../config.js';

export interface VectorRecord extends Record<string, unknown> {
  [key: string]: unknown; // Explicit index signature
  id: string;
  symbol: string;
  embedding: number[];
  structural_signature: string;
  architectural_role: string;
  computed_at: string;
  lineage_hash: string;
}

interface LanceDBSearchResult extends Record<string, unknown> {
  [key: string]: unknown; // Explicit index signature
  id: string;
  _distance: number;
  symbol: string;
  structural_signature: string;
  architectural_role: string;
  computed_at: string;
  lineage_hash: string;
}

const VECTOR_RECORD_SCHEMA = new Schema([
  new Field('id', new Utf8()),
  new Field('symbol', new Utf8()),
  new Field(
    'embedding',
    new FixedSizeList(
      DEFAULT_EMBEDDING_DIMENSIONS,
      new Field('item', new Float(Precision.DOUBLE))
    )
  ),
  new Field('structural_signature', new Utf8()),
  new Field('architectural_role', new Utf8()),
  new Field('computed_at', new Utf8()),
  new Field('lineage_hash', new Utf8()),
]);

export class LanceVectorStore {
  private db: Connection | undefined;
  private table: Table | undefined;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(private pgcRoot: string) {}

  async initialize(tableName: string = 'structural_patterns'): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize(tableName);
    return this.initializationPromise;
  }

  private async doInitialize(tableName: string): Promise<void> {
    try {
      const dbPath = path.join(this.pgcRoot, 'patterns.lancedb');
      await fs.ensureDir(path.dirname(dbPath));

      this.db = await connect(dbPath);

      try {
        this.table = await this.db.openTable(tableName);
        console.log(`✅ Opened existing LanceDB table: ${tableName}`);
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error.message?.includes('Table') &&
          error.message?.includes('not found')
        ) {
          // Table doesn't exist, create it with a dummy record
          const dummyRecord = this.createDummyRecord();
          this.table = await this.db.createTable(tableName, [dummyRecord], {
            schema: VECTOR_RECORD_SCHEMA,
          });
          // Remove the dummy record after creation
          await this.table!.delete(`id = '${dummyRecord.id}'`);
          console.log(`✅ Created new LanceDB table: ${tableName}`);
        } else {
          throw error;
        }
      }

      this.isInitialized = true;
    } catch (error: unknown) {
      this.initializationPromise = null;
      throw error;
    }
  }

  private createDummyRecord(): VectorRecord {
    return {
      id: 'dummy_record',
      symbol: 'dummy',
      embedding: new Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0),
      structural_signature: 'dummy',
      architectural_role: 'dummy',
      computed_at: new Date().toISOString(),
      lineage_hash: 'dummy',
    };
  }

  async storeVector(
    id: string,
    embedding: number[],
    metadata: Omit<VectorRecord, 'id' | 'embedding'>
  ): Promise<string> {
    if (!this.isInitialized) await this.initialize();

    // Validate embedding dimensions
    if (embedding.length !== DEFAULT_EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding dimension mismatch: expected ${DEFAULT_EMBEDDING_DIMENSIONS}, got ${embedding.length}`
      );
    }

    const record: VectorRecord = {
      id: id,

      embedding: embedding,
      symbol: metadata.symbol as string,
      structural_signature: metadata.structural_signature as string,
      architectural_role: metadata.architectural_role as string,
      computed_at: metadata.computed_at as string,
      lineage_hash: metadata.lineage_hash as string,
    };

    // Use mergeInsert builder pattern
    await this.table!.mergeInsert('id') // Key column for matching
      .whenMatchedUpdateAll() // Update all columns if id matches
      .whenNotMatchedInsertAll() // Insert new record if id does not match
      .execute([record]); // Execute with the data

    return id;
  }

  async similaritySearch(
    queryEmbedding: number[],

    topK: number,

    filter?: { symbol?: string; architectural_role?: string }
  ): Promise<
    Array<{
      id: string;
      similarity: number;
      metadata: Omit<VectorRecord, 'id' | 'embedding'>;
    }>
  > {
    if (!this.isInitialized) await this.initialize();

    if (queryEmbedding.length !== DEFAULT_EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Query embedding dimension mismatch: expected ${DEFAULT_EMBEDDING_DIMENSIONS}, got ${queryEmbedding.length}`
      );
    }

    let query = this.table!.search(queryEmbedding).limit(topK);

    // Apply filters if provided
    if (filter?.symbol) {
      query = query.where(`symbol = '${filter.symbol}'`);
    }

    if (filter?.architectural_role) {
      query = query.where(
        `architectural_role = '${filter.architectural_role}'`
      );
    }

    const records = await query.toArray();
    return records

      .filter((result): result is LanceDBSearchResult =>
        this.isValidSearchResult(result)
      )

      .map((result) => ({
        id: result.id,

        similarity: this.calculateSimilarity(result._distance),

        metadata: {
          symbol: result.symbol as string,
          structural_signature: result.structural_signature as string,
          architectural_role: result.architectural_role as string,
          computed_at: result.computed_at as string,
          lineage_hash: result.lineage_hash as string,
        },
      }));
  }

  async getVector(id: string): Promise<VectorRecord | null> {
    if (!this.isInitialized) await this.initialize();

    const records = await this.table!.query()
      .where(`id = '${id}'`)
      .limit(1)
      .toArray();

    if (records.length === 0) return null;

    const record = records[0];

    if (!this.isValidVectorRecord(record)) {
      console.warn(`Invalid vector record found for id: ${id}`);

      return null;
    }

    return record as VectorRecord;
  }

  async deleteVector(id: string): Promise<boolean> {
    if (!this.isInitialized) await this.initialize();

    await this.table!.delete(`id = '${id}'`);

    return true;
  }

  async getAllVectors(): Promise<VectorRecord[]> {
    if (!this.isInitialized) await this.initialize();

    const records = await this.table!.query().toArray();

    return records.filter(
      (record) =>
        this.isValidVectorRecord(record) && record.id !== 'dummy_record'
    ) as VectorRecord[];
  }

  async close(): Promise<void> {
    if (this.db) {
      // LanceDB connections don't typically need explicit closing

      // but we can clean up our state
      this.isInitialized = false;
      this.initializationPromise = null;
      this.table = undefined;
      this.db = undefined;
    }
  }

  // Type guards for safety

  private isValidVectorRecord(record: unknown): record is VectorRecord {
    return (
      !!record &&
      typeof (record as VectorRecord).id === 'string' &&
      Array.isArray((record as VectorRecord).embedding) &&
      (record as VectorRecord).embedding.length ===
        DEFAULT_EMBEDDING_DIMENSIONS &&
      typeof (record as VectorRecord).symbol === 'string' &&
      typeof (record as VectorRecord).structural_signature === 'string' &&
      typeof (record as VectorRecord).architectural_role === 'string' &&
      typeof (record as VectorRecord).computed_at === 'string' &&
      typeof (record as VectorRecord).lineage_hash === 'string'
    );
  }

  private isValidSearchResult(result: unknown): result is LanceDBSearchResult {
    return (
      !!result &&
      typeof (result as LanceDBSearchResult).id === 'string' &&
      typeof (result as LanceDBSearchResult)._distance === 'number' &&
      typeof (result as LanceDBSearchResult).symbol === 'string' &&
      typeof (result as LanceDBSearchResult).structural_signature ===
        'string' &&
      typeof (result as LanceDBSearchResult).architectural_role === 'string' &&
      typeof (result as LanceDBSearchResult).computed_at === 'string' &&
      typeof (result as LanceDBSearchResult).lineage_hash === 'string'
    );
  }

  private calculateSimilarity(distance: number): number {
    // LanceDB returns L2 distance, convert to similarity score

    // Smaller distance = higher similarity
    return 1 / (1 + Math.max(0, distance)); // Ensure non-negative
  }
}
