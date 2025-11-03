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
  Int64,
  Bool,
} from 'apache-arrow';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../config.js';

/**
 * Represents a conversation turn record stored in LanceDB.
 * Optimized for Sigma's conversational lattice with full metadata.
 */
export interface ConversationTurnRecord extends Record<string, unknown> {
  // Identity
  id: string; // turn_id (e.g., "turn_1", "turn_2")
  session_id: string; // Session UUID

  // Content
  role: string; // 'user' | 'assistant' | 'system'
  content: string; // Full turn text
  timestamp: number; // Unix timestamp in milliseconds

  // Embeddings (768D from eGemma)
  embedding: number[];

  // Sigma Metrics
  novelty: number; // 0-1, distance from recent context
  importance: number; // 1-10, computed importance score
  is_paradigm_shift: boolean; // High novelty flag

  // Project Alignment (from Meet operations)
  alignment_O1: number; // 0-10, structural alignment
  alignment_O2: number; // 0-10, security alignment
  alignment_O3: number; // 0-10, lineage alignment
  alignment_O4: number; // 0-10, mission alignment
  alignment_O5: number; // 0-10, operational alignment
  alignment_O6: number; // 0-10, mathematical alignment
  alignment_O7: number; // 0-10, coherence alignment

  // Metadata
  semantic_tags: string; // JSON array of extracted keywords
  references: string; // JSON array of referenced turn_ids
}

/**
 * Represents a search result from conversational lattice queries.
 */
interface ConversationSearchResult extends Record<string, unknown> {
  id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp: number;
  _distance: number;
  novelty: number;
  importance: number;
  is_paradigm_shift: boolean;
  alignment_O1: number;
  alignment_O2: number;
  alignment_O3: number;
  alignment_O4: number;
  alignment_O5: number;
  alignment_O6: number;
  alignment_O7: number;
  semantic_tags: string;
  references: string;
}

/**
 * Apache Arrow schema for conversation turn records.
 * Designed for Sigma's infinite context with dual-lattice architecture.
 */
function createConversationTurnSchema(): Schema {
  return new Schema([
    // Identity
    new Field('id', new Utf8()),
    new Field('session_id', new Utf8()),

    // Content
    new Field('role', new Utf8()),
    new Field('content', new Utf8()),
    new Field('timestamp', new Int64()),

    // Embeddings (768D from eGemma)
    new Field(
      'embedding',
      new FixedSizeList(
        DEFAULT_EMBEDDING_DIMENSIONS,
        new Field('item', new Float(Precision.DOUBLE))
      )
    ),

    // Sigma Metrics
    new Field('novelty', new Float(Precision.DOUBLE)),
    new Field('importance', new Float(Precision.DOUBLE)),
    new Field('is_paradigm_shift', new Bool()),

    // Project Alignment (O1-O7)
    new Field('alignment_O1', new Float(Precision.DOUBLE)),
    new Field('alignment_O2', new Float(Precision.DOUBLE)),
    new Field('alignment_O3', new Float(Precision.DOUBLE)),
    new Field('alignment_O4', new Float(Precision.DOUBLE)),
    new Field('alignment_O5', new Float(Precision.DOUBLE)),
    new Field('alignment_O6', new Float(Precision.DOUBLE)),
    new Field('alignment_O7', new Float(Precision.DOUBLE)),

    // Metadata
    new Field('semantic_tags', new Utf8()), // JSON array as string
    new Field('references', new Utf8()), // JSON array as string
  ]);
}

/**
 * Filter options for conversation queries.
 */
export interface ConversationQueryFilter {
  session_id?: string;
  role?: 'user' | 'assistant' | 'system';
  min_importance?: number;
  max_importance?: number;
  min_novelty?: number;
  max_novelty?: number;
  is_paradigm_shift?: boolean;
  min_timestamp?: number;
  max_timestamp?: number;
  overlay?: 'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'; // Filter by specific overlay alignment
  min_overlay_alignment?: number; // Minimum alignment score for the specified overlay
}

/**
 * Manages conversational lattice storage and semantic search using LanceDB.
 * Optimized for Sigma's infinite context with full vector operations.
 */
export class ConversationLanceStore {
  private db: Connection | undefined;
  private table: Table | undefined;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(private sigmaRoot: string) {}

  /**
   * Initialize the conversation LanceDB store.
   * Creates or opens the conversations.lancedb database.
   */
  async initialize(tableName: string = 'conversation_turns'): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize(tableName);
    return this.initializationPromise;
  }

  private async doInitialize(tableName: string): Promise<void> {
    try {
      const dbPath = path.join(this.sigmaRoot, 'conversations.lancedb');
      await fs.ensureDir(path.dirname(dbPath));

      this.db = await connect(dbPath);

      // Check if table exists, if not, create it
      const tableNames = await this.db.tableNames();
      if (tableNames.includes(tableName)) {
        this.table = await this.db.openTable(tableName);
      } else {
        try {
          // Create the table with a complete dummy record
          const schema = createConversationTurnSchema();
          const dummyRecord: ConversationTurnRecord = {
            id: 'schema_test_record',
            session_id: 'test_session',
            role: 'system',
            content: 'Schema initialization record',
            timestamp: Date.now(),
            embedding: new Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.1),
            novelty: 0.0,
            importance: 0.0,
            is_paradigm_shift: false,
            alignment_O1: 0.0,
            alignment_O2: 0.0,
            alignment_O3: 0.0,
            alignment_O4: 0.0,
            alignment_O5: 0.0,
            alignment_O6: 0.0,
            alignment_O7: 0.0,
            semantic_tags: '[]',
            references: '[]',
          };

          this.table = await this.db.createTable(tableName, [dummyRecord], {
            schema,
          });

          // Clean up test record
          await this.table.delete(`id = 'schema_test_record'`);
        } catch (createError: unknown) {
          // If table already exists (race condition), open it
          if (
            createError instanceof Error &&
            createError.message.includes('already exists')
          ) {
            this.table = await this.db.openTable(tableName);
          } else {
            throw createError;
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
   * Store a conversation turn with full Sigma metadata.
   * Replaces existing turn with same ID.
   */
  async storeTurn(
    sessionId: string,
    turnId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    embedding: number[],
    metadata: {
      novelty: number;
      importance: number;
      is_paradigm_shift?: boolean;
      alignment_O1: number;
      alignment_O2: number;
      alignment_O3: number;
      alignment_O4: number;
      alignment_O5: number;
      alignment_O6: number;
      alignment_O7: number;
      semantic_tags?: string[];
      references?: string[];
    }
  ): Promise<string> {
    if (!this.isInitialized) await this.initialize();

    // Validate embedding dimensions
    if (embedding.length !== DEFAULT_EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding dimension mismatch: expected ${DEFAULT_EMBEDDING_DIMENSIONS}, got ${embedding.length}`
      );
    }

    // Check for existing turn and replace if found
    const existingTurn = await this.getTurn(turnId);
    if (existingTurn) {
      await this.deleteTurn(turnId);
    }

    const record: ConversationTurnRecord = {
      id: turnId,
      session_id: sessionId,
      role,
      content,
      timestamp: Date.now(),
      embedding,
      novelty: metadata.novelty,
      importance: metadata.importance,
      is_paradigm_shift: metadata.is_paradigm_shift || false,
      alignment_O1: metadata.alignment_O1,
      alignment_O2: metadata.alignment_O2,
      alignment_O3: metadata.alignment_O3,
      alignment_O4: metadata.alignment_O4,
      alignment_O5: metadata.alignment_O5,
      alignment_O6: metadata.alignment_O6,
      alignment_O7: metadata.alignment_O7,
      semantic_tags: JSON.stringify(metadata.semantic_tags || []),
      references: JSON.stringify(metadata.references || []),
    };

    await this.table!.add([record]);
    return turnId;
  }

  /**
   * Semantic similarity search across conversation history.
   * Uses LanceDB's native vector operations for maximum performance.
   */
  async similaritySearch(
    queryEmbedding: number[],
    topK: number,
    filter?: ConversationQueryFilter,
    distanceType: 'l2' | 'cosine' | 'dot' = 'cosine'
  ): Promise<
    Array<{
      id: string;
      session_id: string;
      role: string;
      content: string;
      timestamp: number;
      similarity: number;
      metadata: {
        novelty: number;
        importance: number;
        is_paradigm_shift: boolean;
        alignment_O1: number;
        alignment_O2: number;
        alignment_O3: number;
        alignment_O4: number;
        alignment_O5: number;
        alignment_O6: number;
        alignment_O7: number;
        semantic_tags: string[];
        references: string[];
      };
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

    // Set distance type
    if (typeof query.distanceType === 'function') {
      query = query.distanceType(distanceType);
    }

    query = query.limit(topK);

    // Apply filters using LanceDB's native WHERE clause
    const whereClauses: string[] = [];

    if (filter?.session_id) {
      whereClauses.push(
        `session_id = '${this.escapeSqlString(filter.session_id)}'`
      );
    }

    if (filter?.role) {
      whereClauses.push(`role = '${this.escapeSqlString(filter.role)}'`);
    }

    if (filter?.min_importance !== undefined) {
      whereClauses.push(`importance >= ${filter.min_importance}`);
    }

    if (filter?.max_importance !== undefined) {
      whereClauses.push(`importance <= ${filter.max_importance}`);
    }

    if (filter?.min_novelty !== undefined) {
      whereClauses.push(`novelty >= ${filter.min_novelty}`);
    }

    if (filter?.max_novelty !== undefined) {
      whereClauses.push(`novelty <= ${filter.max_novelty}`);
    }

    if (filter?.is_paradigm_shift !== undefined) {
      whereClauses.push(`is_paradigm_shift = ${filter.is_paradigm_shift}`);
    }

    if (filter?.min_timestamp !== undefined) {
      whereClauses.push(`timestamp >= ${filter.min_timestamp}`);
    }

    if (filter?.max_timestamp !== undefined) {
      whereClauses.push(`timestamp <= ${filter.max_timestamp}`);
    }

    // Overlay-specific filtering
    if (filter?.overlay && filter?.min_overlay_alignment !== undefined) {
      const overlayField = `alignment_${filter.overlay}`;
      whereClauses.push(`${overlayField} >= ${filter.min_overlay_alignment}`);
    }

    // Combine all filters with AND
    if (whereClauses.length > 0) {
      query = query.where(whereClauses.join(' AND '));
    }

    const records = await query.toArray();

    return records
      .filter((result: unknown): result is ConversationSearchResult =>
        this.isValidSearchResult(result)
      )
      .map((result: ConversationSearchResult) => ({
        id: result.id,
        session_id: result.session_id,
        role: result.role,
        content: result.content,
        timestamp: result.timestamp,
        similarity: this.calculateSimilarity(result._distance, distanceType),
        metadata: {
          novelty: result.novelty,
          importance: result.importance,
          is_paradigm_shift: result.is_paradigm_shift,
          alignment_O1: result.alignment_O1,
          alignment_O2: result.alignment_O2,
          alignment_O3: result.alignment_O3,
          alignment_O4: result.alignment_O4,
          alignment_O5: result.alignment_O5,
          alignment_O6: result.alignment_O6,
          alignment_O7: result.alignment_O7,
          semantic_tags: this.parseJsonField(result.semantic_tags),
          references: this.parseJsonField(result.references),
        },
      }));
  }

  /**
   * Get a specific turn by ID.
   */
  async getTurn(turnId: string): Promise<ConversationTurnRecord | undefined> {
    if (!this.isInitialized) await this.initialize();

    const escapedId = this.escapeSqlString(turnId);
    const records = await this.table!.query()
      .where(`id = '${escapedId}'`)
      .limit(1)
      .toArray();

    if (records.length === 0) return undefined;

    const record = records[0];

    // Create a plain JS object copy to avoid Apache Arrow proxy issues
    const plainRecord: ConversationTurnRecord = {
      id: record.id,
      session_id: record.session_id,
      role: record.role,
      content: record.content,
      timestamp:
        typeof record.timestamp === 'bigint'
          ? Number(record.timestamp)
          : record.timestamp,
      embedding:
        record.embedding && typeof record.embedding === 'object'
          ? Array.from(record.embedding)
          : record.embedding,
      novelty: record.novelty,
      importance: record.importance,
      is_paradigm_shift: record.is_paradigm_shift,
      alignment_O1: record.alignment_O1,
      alignment_O2: record.alignment_O2,
      alignment_O3: record.alignment_O3,
      alignment_O4: record.alignment_O4,
      alignment_O5: record.alignment_O5,
      alignment_O6: record.alignment_O6,
      alignment_O7: record.alignment_O7,
      semantic_tags: record.semantic_tags,
      references: record.references,
    };

    if (!this.isValidTurnRecord(plainRecord)) {
      console.warn(`Invalid conversation turn record found for id: ${turnId}`);
      return undefined;
    }

    return plainRecord;
  }

  /**
   * Get all turns for a specific session, ordered by timestamp.
   */
  async getSessionTurns(
    sessionId: string,
    orderBy: 'asc' | 'desc' = 'asc'
  ): Promise<ConversationTurnRecord[]> {
    if (!this.isInitialized) await this.initialize();

    const escapedSessionId = this.escapeSqlString(sessionId);
    const records = await this.table!.query()
      .where(`session_id = '${escapedSessionId}'`)
      .toArray();

    const validRecords = records
      .map((record) => {
        // Create plain JS object copy
        const plainRecord: ConversationTurnRecord = {
          id: record.id,
          session_id: record.session_id,
          role: record.role,
          content: record.content,
          timestamp:
            typeof record.timestamp === 'bigint'
              ? Number(record.timestamp)
              : record.timestamp,
          embedding:
            record.embedding && typeof record.embedding === 'object'
              ? Array.from(record.embedding)
              : record.embedding,
          novelty: record.novelty,
          importance: record.importance,
          is_paradigm_shift: record.is_paradigm_shift,
          alignment_O1: record.alignment_O1,
          alignment_O2: record.alignment_O2,
          alignment_O3: record.alignment_O3,
          alignment_O4: record.alignment_O4,
          alignment_O5: record.alignment_O5,
          alignment_O6: record.alignment_O6,
          alignment_O7: record.alignment_O7,
          semantic_tags: record.semantic_tags,
          references: record.references,
        };
        return plainRecord;
      })
      .filter((record) => this.isValidTurnRecord(record));

    // Sort by timestamp
    validRecords.sort((a, b) => {
      return orderBy === 'asc'
        ? a.timestamp - b.timestamp
        : b.timestamp - a.timestamp;
    });

    return validRecords;
  }

  /**
   * Get turns marked as paradigm shifts.
   */
  async getParadigmShifts(
    sessionId?: string
  ): Promise<ConversationTurnRecord[]> {
    if (!this.isInitialized) await this.initialize();

    let whereClause = 'is_paradigm_shift = true';
    if (sessionId) {
      whereClause += ` AND session_id = '${this.escapeSqlString(sessionId)}'`;
    }

    const records = await this.table!.query().where(whereClause).toArray();

    return records
      .map((record) => {
        // Create plain JS object copy
        const plainRecord: ConversationTurnRecord = {
          id: record.id,
          session_id: record.session_id,
          role: record.role,
          content: record.content,
          timestamp:
            typeof record.timestamp === 'bigint'
              ? Number(record.timestamp)
              : record.timestamp,
          embedding:
            record.embedding && typeof record.embedding === 'object'
              ? Array.from(record.embedding)
              : record.embedding,
          novelty: record.novelty,
          importance: record.importance,
          is_paradigm_shift: record.is_paradigm_shift,
          alignment_O1: record.alignment_O1,
          alignment_O2: record.alignment_O2,
          alignment_O3: record.alignment_O3,
          alignment_O4: record.alignment_O4,
          alignment_O5: record.alignment_O5,
          alignment_O6: record.alignment_O6,
          alignment_O7: record.alignment_O7,
          semantic_tags: record.semantic_tags,
          references: record.references,
        };
        return plainRecord;
      })
      .filter((record) => this.isValidTurnRecord(record));
  }

  /**
   * Delete a specific turn.
   */
  async deleteTurn(turnId: string): Promise<boolean> {
    if (!this.isInitialized) await this.initialize();

    const escapedId = this.escapeSqlString(turnId);
    await this.table!.delete(`id = '${escapedId}'`);
    return true;
  }

  /**
   * Delete all turns for a specific session.
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.isInitialized) await this.initialize();

    const escapedSessionId = this.escapeSqlString(sessionId);
    await this.table!.delete(`session_id = '${escapedSessionId}'`);
    return true;
  }

  /**
   * Get statistics about stored conversations.
   */
  async getStats(): Promise<{
    total_turns: number;
    total_sessions: number;
    paradigm_shifts: number;
    avg_importance: number;
    avg_novelty: number;
  }> {
    if (!this.isInitialized) await this.initialize();

    const allRecords = await this.table!.query().toArray();

    const uniqueSessions = new Set<string>();
    let paradigmShiftCount = 0;
    let totalImportance = 0;
    let totalNovelty = 0;

    allRecords.forEach((record) => {
      uniqueSessions.add(record.session_id);
      if (record.is_paradigm_shift) paradigmShiftCount++;
      totalImportance += record.importance || 0;
      totalNovelty += record.novelty || 0;
    });

    return {
      total_turns: allRecords.length,
      total_sessions: uniqueSessions.size,
      paradigm_shifts: paradigmShiftCount,
      avg_importance:
        allRecords.length > 0 ? totalImportance / allRecords.length : 0,
      avg_novelty: allRecords.length > 0 ? totalNovelty / allRecords.length : 0,
    };
  }

  /**
   * Close the database connection.
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

  // Private helper methods

  private escapeSqlString(value: string): string {
    return value.replace(/'/g, "''");
  }

  private parseJsonField(value: string): string[] {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private calculateSimilarity(
    distance: number,
    distanceType: 'l2' | 'cosine' | 'dot' = 'cosine'
  ): number {
    if (distanceType === 'cosine') {
      return Math.max(0, 1 - distance);
    } else if (distanceType === 'dot') {
      return distance;
    } else {
      return 1 / (1 + Math.max(0, distance));
    }
  }

  private isValidTurnRecord(record: unknown): record is ConversationTurnRecord {
    const r = record as ConversationTurnRecord;

    if (!r) return false;
    if (typeof r.id !== 'string') return false;
    if (typeof r.session_id !== 'string') return false;
    if (typeof r.role !== 'string') return false;
    if (typeof r.content !== 'string') return false;
    if (typeof r.timestamp !== 'number') return false;
    if (!Array.isArray(r.embedding)) return false;
    if (r.embedding.length !== DEFAULT_EMBEDDING_DIMENSIONS) return false;

    return true;
  }

  private isValidSearchResult(
    result: unknown
  ): result is ConversationSearchResult {
    const r = result as ConversationSearchResult;

    if (!r) return false;
    if (typeof r.id !== 'string') return false;
    if (typeof r.session_id !== 'string') return false;
    if (typeof r._distance !== 'number') return false;
    if (typeof r.role !== 'string') return false;
    if (typeof r.content !== 'string') return false;

    return true;
  }
}
