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
]);

/**
 * Manages vector storage and similarity search using LanceDB.
 *
 * Provides a high-level interface for storing and querying vector embeddings
 * with associated metadata. Supports the Shadow architecture (Monument 4.7)
 * with dual embeddings (structural and semantic).
 *
 * Features:
 * - Efficient upsert using mergeInsert (no version bloat)
 * - Automatic deduplication by symbol
 * - Multiple distance metrics (cosine, L2, dot product)
 * - SQL injection protection
 * - Concurrent initialization safety
 */
export class LanceVectorStore {
  private db: Connection | undefined;
  private table: Table | undefined;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Create a new LanceDB vector store
   *
   * @param pgcRoot - Root directory of the PGC (Grounded Context Pool)
   */
  constructor(private pgcRoot: string) {}

  /**
   * Initialize the vector store connection and table
   *
   * Creates or opens a LanceDB table with the appropriate schema.
   * Safe for concurrent calls - will return the same initialization promise.
   *
   * @param tableName - Name of the table to initialize (default: 'structural_patterns')
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(tableName: string = 'structural_patterns'): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    let schemaToUse: Schema;
    if (tableName === 'lineage_patterns') {
      schemaToUse = createLineagePatternSchema();
    } else {
      schemaToUse = VECTOR_RECORD_SCHEMA;
    }

    this.initializationPromise = this.doInitialize(tableName, schemaToUse);
    return this.initializationPromise;
  }

  /**
   * Internal initialization implementation
   *
   * @param tableName - Table name to create/open
   * @param schema - Apache Arrow schema to use
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   * @private
   */
  private async doInitialize(tableName: string, schema: Schema): Promise<void> {
    try {
      const dbPath = path.join(this.pgcRoot, 'patterns.lancedb');
      await fs.ensureDir(path.dirname(dbPath));

      this.db = await connect(dbPath);

      // Check if table exists, if not, create it
      const tableNames = await this.db.tableNames();
      if (tableNames.includes(tableName)) {
        this.table = await this.db.openTable(tableName);
      } else {
        try {
          // Create the table with the EXACT schema we want (Shadow architecture)
          const completeDummyRecord = {
            id: 'schema_test_record',
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
          };

          this.table = await this.db.createTable(
            tableName,
            [completeDummyRecord],
            {
              schema,
            }
          );

          // Clean up test record
          await this.table.delete(`id = 'schema_test_record'`);
        } catch (createError: unknown) {
          // If table already exists (e.g., due to a race condition), open it instead
          if (
            createError instanceof Error &&
            createError.message.includes('already exists')
          ) {
            this.table = await this.db.openTable(tableName);
          } else {
            throw createError; // Re-throw other errors
          }
        }
      }
      this.isInitialized = true;
    } catch (error: unknown) {
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Store a vector with metadata.
   * Uses LanceDB's mergeInsert for efficient upsert without version bloat.
   *
   * @param id - Unique identifier for the vector
   * @param embedding - Vector embedding (must match DEFAULT_EMBEDDING_DIMENSIONS)
   * @param metadata - Associated metadata (architectural_role, lineage_hash required)
   * @returns Promise resolving to the stored vector's ID
   * @throws Error if required fields are missing or embedding dimensions mismatch
   *
   * @example
   * await store.storeVector('my-symbol', embedding, {
   *   symbol: 'myFunction',
   *   architectural_role: 'service',
   *   lineage_hash: 'abc123',
   *   computed_at: new Date().toISOString()
   * });
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
    };

    // Use mergeInsert for efficient upsert (no version bloat)
    // - If vector exists (matched by id): updates in-place
    // - If vector doesn't exist: inserts new record
    // - No delete operation = no extra versions
    await this.table!.mergeInsert('id')
      .whenMatchedUpdateAll()
      .whenNotMatchedInsertAll()
      .execute([record]);

    return id;
  }

  /**
   * Perform similarity search to find nearest neighbors
   *
   * Searches for vectors similar to the query embedding using the specified
   * distance metric. Results are automatically deduplicated by symbol and
   * sorted by similarity (highest first).
   *
   * @param queryEmbedding - Query vector for similarity search
   * @param topK - Number of top results to return
   * @param filter - Optional filters for symbol or architectural_role
   * @param distanceType - Distance metric: 'cosine' | 'l2' | 'dot' (default: 'cosine')
   * @returns Promise resolving to array of search results with similarity scores
   * @throws Error if query embedding dimensions mismatch
   *
   * @example
   * const results = await store.similaritySearch(queryVector, 5, {
   *   architectural_role: 'service'
   * }, 'cosine');
   * console.log(`Found ${results.length} similar vectors`);
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

    // Set distance type if the method exists (LanceDB v0.22+)
    if (typeof query.distanceType === 'function') {
      query = query.distanceType(distanceType);
    }

    query = query.limit(topK * 2); // Get extra for deduplication

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
    const uniqueResults = new Map<string, LanceDBSearchResult>();
    records
      .filter((result: unknown): result is LanceDBSearchResult =>
        this.isValidSearchResult(result)
      )
      .forEach((result: LanceDBSearchResult) => {
        // Keep only the first occurrence of each symbol (highest similarity due to sorting)
        if (!uniqueResults.has(result.symbol)) {
          uniqueResults.set(result.symbol, result);
        }
      });

    // Convert back to array and take topK
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
      .slice(0, topK); // Ensure we respect the topK limit
  }

  /**
   * Escape special characters in SQL string literals
   *
   * SECURITY: Prevents SQL injection by escaping single quotes
   * SQL standard: single quote is escaped by doubling it ('').
   */
  private escapeSqlString(value: string): string {
    return value.replace(/'/g, "''");
  }

  /**
   * Retrieve a vector by its ID
   *
   * @param id - Vector ID to retrieve
   * @returns Promise resolving to vector record or undefined if not found
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

  /**
   * Delete a vector by its ID
   *
   * @param id - Vector ID to delete
   * @returns Promise resolving to true if deletion was successful
   */
  async deleteVector(id: string): Promise<boolean> {
    if (!this.isInitialized) await this.initialize();

    const escapedId = this.escapeSqlString(id);
    await this.table!.delete(`id = '${escapedId}'`);

    return true;
  }

  /**
   * Retrieve all vectors from the store
   *
   * @returns Promise resolving to array of all valid vector records (excludes dummy records)
   */
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
          {
            id: record.id,
            symbol: record.symbol,
            embedding_length: record.embedding?.length,
            embedding_type: typeof record.embedding,
            has_architectural_role: !!record.architectural_role,
            has_lineage_hash: !!record.lineage_hash,
          }
        );
      }
      return isValid && record.id !== 'dummy_record';
    }) as VectorRecord[];
  }

  /**
   * Remove duplicate vectors, keeping the most recent one for each symbol
   *
   * @returns Promise resolving to the number of duplicate vectors removed
   */
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
    }

    return duplicatesToDelete.length;
  }

  /**
   * Close the database connection and reset state
   *
   * @returns Promise that resolves when the connection is closed
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

  // Type guards for safety

  /**
   * Type guard to validate vector record structure
   *
   * @param record - Unknown record to validate
   * @returns True if record is a valid VectorRecord
   * @private
   */
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

    if (r.lineage_hash && typeof r.lineage_hash !== 'string') {
      return false;
    }

    if (r.lineage_hash && typeof r.lineage_hash !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Type guard to validate search result structure
   *
   * @param result - Unknown result to validate
   * @returns True if result is a valid LanceDBSearchResult
   * @private
   */
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

    if (r.lineage_hash && typeof r.lineage_hash !== 'string') {
      return false;
    }

    if (r.lineage_hash && typeof r.lineage_hash !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Convert distance metric to similarity score
   *
   * Converts LanceDB distance values to normalized similarity scores (0-1).
   * - Cosine: distance is [0,2], similarity = 1 - distance
   * - Dot: distance is already similarity (higher = more similar)
   * - L2: distance is converted using 1/(1+distance)
   *
   * @param distance - Distance value from LanceDB
   * @param distanceType - Type of distance metric used
   * @returns Normalized similarity score (0-1, higher is more similar)
   */
  public calculateSimilarity(
    distance: number,
    distanceType: 'l2' | 'cosine' | 'dot' = 'cosine'
  ): number {
    if (distanceType === 'cosine') {
      // Cosine distance is 1 - cosine_similarity
      // So cosine_similarity = 1 - distance
      // LanceDB returns cosine distance in range [0, 2]
      return Math.max(0, 1 - distance);
    } else if (distanceType === 'dot') {
      // For dot product, higher values are more similar
      // Already in similarity form (not a distance)
      return distance;
    } else {
      // L2 distance - smaller is more similar
      return 1 / (1 + Math.max(0, distance));
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   *
   * Computes the cosine of the angle between two vectors, normalized to [0,1].
   * Formula: (A·B) / (||A|| ||B||), then normalized: (similarity + 1) / 2
   *
   * @param vecA - First vector
   * @param vecB - Second vector
   * @returns Normalized cosine similarity (0-1, higher is more similar)
   * @throws Error if vectors have different dimensions
   */
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
