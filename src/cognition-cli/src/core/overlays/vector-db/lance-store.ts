import path from 'path';
import {
  Field,
  Schema,
  Utf8,
  FixedSizeList,
  Float,
  Precision,
} from 'apache-arrow';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../../config.js';

import { AbstractLanceStore, LANCE_DUMMY_ID } from './abstract-lance-store.js';

/**
 * Creates Apache Arrow schema for lineage pattern records.
 * Updated for The Shadow architecture (Monument 4.7) with dual embeddings.
 *
 * @returns Apache Arrow schema for lineage patterns
 * @private
 */
function createLineagePatternSchema(): Schema {
  return new Schema([
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
    new Field('semantic_signature', new Utf8()),
    new Field('type', new Utf8()),
    new Field('architectural_role', new Utf8()),
    new Field('computed_at', new Utf8()),
    new Field('lineage_hash', new Utf8()),
    new Field('filePath', new Utf8()),
    new Field('structuralHash', new Utf8()),
    new Field('document_hash', new Utf8()), // SHA-256 hash of source document for --force cleanup
  ]);
}

/**
 * Represents a vector record stored in LanceDB.
 */
export interface VectorRecord extends Record<string, unknown> {
  [key: string]: unknown; // Explicit index signature
  id: string;
  symbol: string;
  embedding: number[];
  lineage_hash?: string;
  document_hash?: string; // SHA-256 hash of source document for --force cleanup
}

/**
 * Represents a search result returned from LanceDB similarity queries.
 */
interface LanceDBSearchResult extends Record<string, unknown> {
  [key: string]: unknown; // Explicit index signature
  id: string;
  _distance: number;
  symbol: string;
  embedding: number[];
  structural_signature: string;
  architectural_role: string;
  computed_at: string;
  lineage_hash?: string;
}

/**
 * Apache Arrow schema for structural pattern vector records.
 * Updated for The Shadow architecture (Monument 4.7) with dual embeddings.
 */
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
  new Field('structural_signature', new Utf8()), // class:X | methods:5 (for pattern matching)
  new Field('semantic_signature', new Utf8()), // docstring | class:X (for mission alignment)
  new Field('type', new Utf8()), // 'structural' or 'semantic'
  new Field('architectural_role', new Utf8()),
  new Field('computed_at', new Utf8()),
  new Field('lineage_hash', new Utf8()),
  new Field('filePath', new Utf8()),
  new Field('structuralHash', new Utf8()),
  new Field('document_hash', new Utf8()), // SHA-256 hash of source document for --force cleanup
]);

/**
 * Manages vector storage and similarity search using LanceDB.
 *
 * Provides a high-level interface for storing and querying vector embeddings
 * with associated metadata. Supports the Shadow architecture (Monument 4.7)
 * with dual embeddings (structural and semantic).
 */
export class LanceVectorStore extends AbstractLanceStore<VectorRecord> {
  /**
   * Create a new LanceDB vector store
   *
   * @param pgcRoot - Root directory of the PGC (Grounded Context Pool)
   */
  constructor(private pgcRoot: string) {
    super(path.join(pgcRoot, 'patterns.lancedb'));
  }

  /**
   * Initialize the vector store connection and table
   *
   * @param tableName - Name of the table to initialize (default: 'structural_patterns')
   * @returns Promise that resolves when initialization is complete
   */
  public override async initialize(
    tableName: string = 'structural_patterns'
  ): Promise<void> {
    return super.initialize(tableName);
  }

  protected getSchema(tableName: string): Schema {
    if (tableName === 'lineage_patterns') {
      return createLineagePatternSchema();
    }
    return VECTOR_RECORD_SCHEMA;
  }

  protected createDummyRecord(): VectorRecord {
    return {
      id: LANCE_DUMMY_ID,
      symbol: 'test',
      embedding: new Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.1),
      structural_signature: 'test',
      semantic_signature: 'test',
      type: 'structural',
      architectural_role: 'test_role',
      computed_at: new Date().toISOString(),
      lineage_hash: 'test_hash',
      filePath: 'test/path.ts',
      structuralHash: 'test_structural_hash',
      document_hash: 'test_document_hash',
    };
  }

  /**
   * Store a vector with metadata.
   * Uses LanceDB's mergeInsert for efficient upsert without version bloat.
   */
  async storeVector(
    id: string,
    embedding: number[],
    metadata: Omit<VectorRecord, 'id' | 'embedding'>
  ): Promise<string> {
    if (!this.isInitialized) await this.initialize();

    // Check for missing required fields
    const requiredFields = ['architectural_role', 'lineage_hash'];
    const missingFields = requiredFields.filter(
      (field) => !(field in metadata)
    );

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

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
      structural_signature: (metadata.structural_signature as string) || '',
      semantic_signature: (metadata.semantic_signature as string) || '',
      type: (metadata.type as string) || 'structural',
      architectural_role: metadata.architectural_role as string,
      computed_at: metadata.computed_at as string,
      lineage_hash: metadata.lineage_hash as string,
      filePath: (metadata.filePath as string) || 'unknown',
      structuralHash: (metadata.structuralHash as string) || 'unknown',
      document_hash: (metadata.document_hash as string) || '',
    };

    await this.mergeInsert([record]);
    return id;
  }

  /**
   * OPTIMIZATION: Batch store multiple vectors for 3-5x faster overlay builds
   */
  async batchStoreVectors(
    vectors: Array<{
      id: string;
      embedding: number[];
      metadata: Omit<VectorRecord, 'id' | 'embedding'>;
    }>
  ): Promise<string[]> {
    if (!this.isInitialized) await this.initialize();

    const records: VectorRecord[] = [];
    const requiredFields = ['architectural_role', 'lineage_hash'];

    for (const { id, embedding, metadata } of vectors) {
      const missingFields = requiredFields.filter(
        (field) => !(field in metadata)
      );

      if (missingFields.length > 0) {
        throw new Error(
          `Vector ${id}: Missing required fields: ${missingFields.join(', ')}`
        );
      }

      if (embedding.length !== DEFAULT_EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Vector ${id}: Embedding dimension mismatch: expected ${DEFAULT_EMBEDDING_DIMENSIONS}, got ${embedding.length}`
        );
      }

      records.push({
        id,
        embedding,
        symbol: metadata.symbol as string,
        structural_signature: (metadata.structural_signature as string) || '',
        semantic_signature: (metadata.semantic_signature as string) || '',
        type: (metadata.type as string) || 'structural',
        architectural_role: metadata.architectural_role as string,
        computed_at: metadata.computed_at as string,
        lineage_hash: metadata.lineage_hash as string,
        filePath: (metadata.filePath as string) || 'unknown',
        structuralHash: (metadata.structuralHash as string) || 'unknown',
        document_hash: (metadata.document_hash as string) || undefined,
      });
    }

    await this.mergeInsert(records);
    return records.map((r) => r.id);
  }

  /**
   * Perform similarity search to find nearest neighbors
   */
  async similaritySearch(
    queryEmbedding: number[],
    topK: number,
    filter?: { symbol?: string; architectural_role?: string },
    distanceType: 'l2' | 'cosine' | 'dot' = 'cosine'
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = this.table!.search(queryEmbedding) as any;

    if (typeof query.distanceType === 'function') {
      query = query.distanceType(distanceType);
    }

    query = query.limit(topK * 2);

    if (filter?.symbol) {
      query = query.where(`symbol = '${this.escapeSqlString(filter.symbol)}'`);
    }
    if (filter?.architectural_role) {
      query = query.where(
        `architectural_role = '${this.escapeSqlString(filter.architectural_role)}'`
      );
    }

    const records = await query.toArray();

    const uniqueResults = new Map<string, LanceDBSearchResult>();
    records
      .filter((result: unknown): result is LanceDBSearchResult =>
        this.isValidSearchResult(result)
      )
      .forEach((result: LanceDBSearchResult) => {
        if (!uniqueResults.has(result.symbol)) {
          uniqueResults.set(result.symbol, result);
        }
      });

    return Array.from(uniqueResults.values())
      .map((result) => ({
        id: result.id,
        similarity: this.calculateSimilarity(result._distance, distanceType),
        metadata: {
          symbol: result.symbol,
          structural_signature: result.structural_signature,
          architectural_role: result.architectural_role,
          computed_at: result.computed_at,
          lineage_hash: result.lineage_hash,
        },
      }))
      .slice(0, topK);
  }

  /**
   * Retrieve a vector by its ID
   */
  async getVector(id: string): Promise<VectorRecord | undefined> {
    if (!this.isInitialized) await this.initialize();

    const escapedId = this.escapeSqlString(id);
    const records = await this.table!.query()
      .where(`id = '${escapedId}'`)
      .limit(1)
      .toArray();

    if (records.length === 0) return undefined;

    const record = records[0];

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

  /**
   * Delete a vector by its ID
   */
  async deleteVector(id: string): Promise<boolean> {
    await this.delete(`id = '${this.escapeSqlString(id)}'`);
    return true;
  }

  /**
   * Delete all vectors for a specific document (used by --force flag)
   */
  async deleteByDocumentHash(documentHash: string): Promise<number> {
    if (!this.isInitialized) await this.initialize();

    const beforeCount = await this.table!.query().toArray();
    const matchingBefore = beforeCount.filter(
      (v) => v.document_hash === documentHash
    ).length;

    const escapedHash = this.escapeSqlString(documentHash);
    await this.delete(
      `document_hash IS NOT NULL AND document_hash = '${escapedHash}'`
    );

    return matchingBefore;
  }

  /**
   * Retrieve all vectors from the store
   */
  async getAllVectors(): Promise<VectorRecord[]> {
    if (!this.isInitialized) await this.initialize();

    const records = await this.table!.query().toArray();

    return records.filter((record) => {
      if (
        record.embedding &&
        typeof record.embedding === 'object' &&
        record.embedding.constructor.name === 'Vector'
      ) {
        record.embedding = Array.from(record.embedding);
      }
      const isValid = this.isValidVectorRecord(record);
      return isValid && record.id !== LANCE_DUMMY_ID;
    }) as VectorRecord[];
  }

  /**
   * OPTIMIZATION: Paginated vector retrieval
   */
  async *getAllVectorsPaginated(
    pageSize: number = 1000
  ): AsyncGenerator<VectorRecord[]> {
    if (!this.isInitialized) await this.initialize();

    let offset = 0;

    while (true) {
      const records = await this.table!.query()
        .limit(pageSize)
        .offset(offset)
        .toArray();

      if (records.length === 0) break;

      const validRecords = records.filter((record) => {
        if (
          record.embedding &&
          typeof record.embedding === 'object' &&
          record.embedding.constructor.name === 'Vector'
        ) {
          record.embedding = Array.from(record.embedding);
        }
        return this.isValidVectorRecord(record) && record.id !== LANCE_DUMMY_ID;
      }) as VectorRecord[];

      if (validRecords.length > 0) {
        yield validRecords;
      }

      offset += pageSize;
    }
  }

  /**
   * Remove duplicate vectors, keeping the most recent one for each symbol
   */
  async removeDuplicateVectors(): Promise<number> {
    if (!this.isInitialized) await this.initialize();

    const allVectors = await this.getAllVectors();

    const vectorMap = new Map();
    const duplicatesToDelete: string[] = [];

    allVectors.forEach((vec) => {
      const key = `${vec.symbol}::${vec.document_hash || vec.structuralHash}`;

      if (!vectorMap.has(key)) {
        vectorMap.set(key, vec);
      } else {
        const existing = vectorMap.get(key);
        const existingTime = new Date(existing.computed_at as string).getTime();
        const currentTime = new Date(vec.computed_at as string).getTime();

        if (currentTime > existingTime) {
          duplicatesToDelete.push(existing.id);
          vectorMap.set(key, vec);
        } else {
          duplicatesToDelete.push(vec.id);
        }
      }
    });

    await Promise.all(duplicatesToDelete.map((id) => this.deleteVector(id)));

    return duplicatesToDelete.length;
  }

  /**
   * Close the database connection and reset state
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.isInitialized = false;
      this.initializationPromise = null;
      this.table = undefined;
      this.db = undefined;
    }
  }

  /**
   * Drop a table from the database
   */
  async dropTable(tableName: string): Promise<void> {
    if (!this.db) {
      await this.initialize(tableName);
    }

    try {
      await this.db!.dropTable(tableName);
    } catch (error) {
      if (!(error as Error).message?.includes('not found')) {
        throw error;
      }
    }
  }

  private isValidVectorRecord(record: unknown): record is VectorRecord {
    const r = record as VectorRecord;
    if (!r) return false;
    if (typeof r.id !== 'string') return false;
    if (!Array.isArray(r.embedding)) return false;
    if (r.embedding.length !== DEFAULT_EMBEDDING_DIMENSIONS) return false;
    if (typeof r.symbol !== 'string') return false;
    return true;
  }

  private isValidSearchResult(result: unknown): result is LanceDBSearchResult {
    const r = result as LanceDBSearchResult;
    if (!r) return false;
    if (typeof r.id !== 'string') return false;
    if (typeof r._distance !== 'number') return false;
    if (typeof r.symbol !== 'string') return false;
    return true;
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
      return 0;
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return (similarity + 1) / 2;
  }
}
