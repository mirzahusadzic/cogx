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
  symbol_structural_data_hash?: string;
  lineage_hash?: string;
}

interface LanceDBSearchResult extends Record<string, unknown> {
  [key: string]: unknown; // Explicit index signature
  id: string;
  _distance: number;
  symbol: string;
  embedding: number[];
  structural_signature: string;
  architectural_role: string;
  computed_at: string;
  symbol_structural_data_hash?: string;
  lineage_hash?: string;
}

export const VECTOR_RECORD_SCHEMA = new Schema([
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
  new Field('symbol_structural_data_hash', new Utf8()),
]);

export class LanceVectorStore {
  private db: Connection | undefined;
  private table: Table | undefined;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(private pgcRoot: string) {}

  async initialize(
    tableName: string = 'structural_patterns',
    schema: Schema = VECTOR_RECORD_SCHEMA
  ): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize(tableName, schema);
    return this.initializationPromise;
  }

  private async doInitialize(tableName: string, schema: Schema): Promise<void> {
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
            schema,
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
      symbol_structural_data_hash: 'dummy',
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

    // ✅ CHECK FOR EXISTING VECTOR WITH SAME ID
    const existingVector = await this.getVector(id);
    if (existingVector) {
      console.log(`🔄 Replacing existing vector: ${id}`);
      await this.deleteVector(id); // Remove the old one first
    }

    const record: VectorRecord = {
      id: id,
      embedding: embedding,
      symbol: metadata.symbol as string,
      structural_signature: metadata.structural_signature as string,
      architectural_role: metadata.architectural_role as string,
      computed_at: metadata.computed_at as string,
      symbol_structural_data_hash:
        metadata.symbol_structural_data_hash as string,
      lineage_hash: metadata.lineage_hash as string,
    };

    // After deleting the old one, we can simply add the new record.
    await this.table!.add([record]);

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

    let query = this.table!.search(queryEmbedding).limit(topK * 2); // Get extra for deduplication

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

    // ✅ DEDUPLICATE RESULTS BY SYMBOL
    const uniqueResults = new Map();
    records
      .filter((result): result is LanceDBSearchResult =>
        this.isValidSearchResult(result)
      )
      .forEach((result) => {
        // Keep only the first occurrence of each symbol (highest similarity due to sorting)
        if (!uniqueResults.has(result.symbol)) {
          uniqueResults.set(result.symbol, result);
        }
      });

    // Convert back to array and take topK
    return Array.from(uniqueResults.values())
      .map((result) => ({
        id: result.id,
        similarity: this.calculateSimilarity(result._distance),
        metadata: {
          symbol: result.symbol,
          structural_signature: result.structural_signature,
          architectural_role: result.architectural_role,
          computed_at: result.computed_at,
          symbol_structural_data_hash: result.symbol_structural_data_hash,
          lineage_hash: result.lineage_hash,
        },
      }))
      .slice(0, topK); // Ensure we respect the topK limit
  }

  async getVector(id: string): Promise<VectorRecord | undefined> {
    if (!this.isInitialized) await this.initialize();

    const records = await this.table!.query()
      .where(`id = '${id}'`)
      .limit(1)
      .toArray();

    if (records.length === 0) return undefined;

    const record = records[0];

    // Convert LanceDB Vector object to native JavaScript array
    if (
      record.embedding &&
      typeof record.embedding === 'object' &&
      record.embedding.constructor.name === 'Vector'
    ) {
      record.embedding = Array.from(record.embedding);
    }

    if (!this.isValidVectorRecord(record)) {
      console.warn(`Invalid vector record found for id: ${id}`);

      return undefined;
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

    return records.filter((record) => {
      // Apply Vector to Array conversion for each record
      if (
        record.embedding &&
        typeof record.embedding === 'object' &&
        record.embedding.constructor.name === 'Vector'
      ) {
        record.embedding = Array.from(record.embedding);
      }
      const isValid = this.isValidVectorRecord(record);
      if (!isValid) {
        console.warn(
          `[LanceVectorStore] Invalid vector record found in getAllVectors:`,
          record
        );
      }
      return isValid && record.id !== 'dummy_record';
    }) as VectorRecord[];
  }

  async removeDuplicateVectors(): Promise<number> {
    if (!this.isInitialized) await this.initialize();

    const allVectors = await this.getAllVectors();

    // Group by symbol and find duplicates
    const symbolMap = new Map();
    const duplicatesToDelete: string[] = [];

    allVectors.forEach((vec) => {
      if (!symbolMap.has(vec.symbol)) {
        // First time seeing this symbol - keep it
        symbolMap.set(vec.symbol, vec);
      } else {
        // Duplicate found - keep the most recent one
        const existing = symbolMap.get(vec.symbol);
        const existingTime = new Date(existing.computed_at as string).getTime();
        const currentTime = new Date(vec.computed_at as string).getTime();

        if (currentTime > existingTime) {
          // Current vector is newer, delete the existing one
          duplicatesToDelete.push(existing.id);
          symbolMap.set(vec.symbol, vec);
        } else {
          // Existing vector is newer, delete the current one
          duplicatesToDelete.push(vec.id);
        }
      }
    });

    // Delete all duplicates
    for (const id of duplicatesToDelete) {
      await this.deleteVector(id);
      console.log(`🗑️ Deleted duplicate vector: ${id}`);
    }

    console.log(`✅ Removed ${duplicatesToDelete.length} duplicate vectors`);
    return duplicatesToDelete.length;
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
    const r = record as VectorRecord;

    if (!r) return false;

    if (typeof r.id !== 'string') {
      return false;
    }

    if (!Array.isArray(r.embedding)) {
      return false;
    }

    if (r.embedding.length !== DEFAULT_EMBEDDING_DIMENSIONS) {
      return false;
    }

    if (typeof r.symbol !== 'string') {
      return false;
    }

    // Optional fields
    if (r.structural_signature && typeof r.structural_signature !== 'string') {
      return false;
    }

    if (r.architectural_role && typeof r.architectural_role !== 'string') {
      return false;
    }

    if (r.computed_at && typeof r.computed_at !== 'string') {
      return false;
    }

    if (
      r.symbol_structural_data_hash &&
      typeof r.symbol_structural_data_hash !== 'string'
    ) {
      return false;
    }

    if (r.lineage_hash && typeof r.lineage_hash !== 'string') {
      return false;
    }

    return true;
  }

  private isValidSearchResult(result: unknown): result is LanceDBSearchResult {
    const r = result as LanceDBSearchResult;

    if (!r) return false;

    if (typeof r.id !== 'string') {
      return false;
    }

    if (typeof r._distance !== 'number') {
      return false;
    }

    if (typeof r.symbol !== 'string') {
      return false;
    }

    // Optional fields
    if (r.structural_signature && typeof r.structural_signature !== 'string') {
      return false;
    }

    if (r.architectural_role && typeof r.architectural_role !== 'string') {
      return false;
    }

    if (r.computed_at && typeof r.computed_at !== 'string') {
      return false;
    }

    if (
      r.symbol_structural_data_hash &&
      typeof r.symbol_structural_data_hash !== 'string'
    ) {
      return false;
    }

    if (r.lineage_hash && typeof r.lineage_hash !== 'string') {
      return false;
    }

    return true;
  }

  public calculateSimilarity(distance: number): number {
    // LanceDB returns L2 distance, convert to similarity score

    // Smaller distance = higher similarity
    return 1 / (1 + Math.max(0, distance)); // Ensure non-negative
  }

  public cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0; // Avoid division by zero
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    // Cosine similarity can be negative, but for embeddings it's usually [0, 1].
    // We clamp it here to be safe and consistent with the other similarity score.
    return (similarity + 1) / 2;
  }
}
