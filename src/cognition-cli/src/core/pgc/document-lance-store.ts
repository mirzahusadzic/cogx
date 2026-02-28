import path from 'path';
import crypto from 'crypto';
import {
  Field,
  Schema,
  Utf8,
  FixedSizeList,
  Float,
  Precision,
  Int64,
} from 'apache-arrow';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../config.js';
import {
  AbstractLanceStore,
  LANCE_DUMMY_ID,
} from '../overlays/vector-db/abstract-lance-store.js';

/**
 * Compute hash of embedding vector for content-based ID generation.
 *
 * Uses the same SHA-256 approach as structural patterns to enable
 * automatic deduplication of identical embeddings.
 *
 * @param embedding - 768-dimensional vector from eGemma
 * @returns First 12 characters of SHA-256 hash
 * @private
 */
function computeEmbeddingHash(embedding: number[]): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(embedding))
    .digest('hex')
    .substring(0, 12);
}

/**
 * Represents a document concept record stored in LanceDB.
 * Unified schema for all overlay types (O2, O4, O5, O6).
 */
export interface DocumentConceptRecord extends Record<string, unknown> {
  // Identity
  id: string; // Unique ID: <overlay>:<doc_hash>:<embedding_hash>
  overlay_type: string; // 'O2' | 'O4' | 'O5' | 'O6'
  embedding_hash: string; // SHA-256 hash of embedding (for deduplication)

  // Document provenance
  document_hash: string; // Content hash of source document
  document_path: string; // Relative path to source markdown
  transform_id: string; // Transform that generated this overlay

  // Concept content
  text: string; // Concept text (description/statement/guideline)
  section: string; // Source section heading
  section_hash: string; // Hash of source section

  // Concept metadata (varies by overlay type)
  concept_type: string; // vision|concept|principle|goal (O4), guideline|requirement (O2), etc.
  weight: number; // Importance score (0-1)
  occurrences: number; // Frequency in document

  // Embeddings (768D from eGemma)
  embedding: number[];

  // Timestamps
  generated_at: number; // Unix timestamp in milliseconds
}

/**
 * Represents a search result from document concept queries.
 */
interface DocumentSearchResult extends Record<string, unknown> {
  id: string;
  overlay_type: string;
  document_hash: string;
  document_path: string;
  transform_id: string;
  text: string;
  section: string;
  section_hash: string;
  concept_type: string;
  weight: number;
  occurrences: number;
  generated_at: number;
  _distance: number;
}

/**
 * Apache Arrow schema for document concept records.
 * Unified schema supporting all overlay types (O2, O4, O5, O6).
 */
function createDocumentConceptSchema(): Schema {
  return new Schema([
    // Identity
    new Field('id', new Utf8()),
    new Field('overlay_type', new Utf8()),
    new Field('embedding_hash', new Utf8()),

    // Document provenance
    new Field('document_hash', new Utf8()),
    new Field('document_path', new Utf8()),
    new Field('transform_id', new Utf8()),

    // Concept content
    new Field('text', new Utf8()),
    new Field('section', new Utf8()),
    new Field('section_hash', new Utf8()),

    // Concept metadata
    new Field('concept_type', new Utf8()),
    new Field('weight', new Float(Precision.DOUBLE)),
    new Field('occurrences', new Int64()),

    // Embeddings (768D from eGemma)
    new Field(
      'embedding',
      new FixedSizeList(
        DEFAULT_EMBEDDING_DIMENSIONS,
        new Field('item', new Float(Precision.DOUBLE))
      )
    ),

    // Timestamps
    new Field('generated_at', new Int64()),
  ]);
}

/**
 * Filter options for document concept queries.
 */
export interface DocumentQueryFilter {
  overlay_type?: 'O2' | 'O4' | 'O5' | 'O6' | string;
  document_hash?: string;
  document_path?: string;
  concept_type?: string;
  min_weight?: number;
  max_weight?: number;
  min_occurrences?: number;
  section?: string;
}

/**
 * Document Vector Store (LanceDB)
 *
 * Manages document concept storage and semantic search using LanceDB.
 * Unified store for all document-based overlays: O₂ (Security), O₄ (Mission),
 * O₅ (Operational), O₆ (Mathematical).
 */
export class DocumentLanceStore extends AbstractLanceStore<DocumentConceptRecord> {
  constructor(private pgcRoot: string) {
    super(path.join(pgcRoot, 'lance', 'documents.lancedb'));
  }

  /**
   * Initialize the document LanceDB store.
   * Creates or opens the documents.lancedb database.
   */
  public override async initialize(
    tableName: string = 'document_concepts'
  ): Promise<void> {
    return super.initialize(tableName);
  }

  protected getSchema(): Schema {
    return createDocumentConceptSchema();
  }

  protected createDummyRecord(): DocumentConceptRecord {
    const dummyEmbedding = new Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.1);
    return {
      id: LANCE_DUMMY_ID,
      overlay_type: 'O4',
      embedding_hash: computeEmbeddingHash(dummyEmbedding),
      document_hash: 'test_hash',
      document_path: 'test/path.md',
      transform_id: 'test_transform',
      text: 'Schema initialization record',
      section: 'Test Section',
      section_hash: 'test_section_hash',
      concept_type: 'concept',
      weight: 1.0,
      occurrences: 1,
      embedding: dummyEmbedding,
      generated_at: Date.now(),
    };
  }

  /**
   * Store a single document concept with embeddings.
   */
  async storeConcept(
    overlayType: string,
    documentHash: string,
    documentPath: string,
    transformId: string,
    _conceptIndex: number,
    concept: {
      text: string;
      section: string;
      sectionHash: string;
      type: string;
      weight: number;
      occurrences: number;
      embedding: number[];
    }
  ): Promise<string> {
    const results = await this.storeConceptsBatch(
      overlayType,
      documentHash,
      documentPath,
      transformId,
      [concept]
    );
    return results[0];
  }

  /**
   * Store multiple concepts in batch (more efficient).
   */
  async storeConceptsBatch(
    overlayType: string,
    documentHash: string,
    documentPath: string,
    transformId: string,
    concepts: Array<{
      text: string;
      section: string;
      sectionHash: string;
      type: string;
      weight: number;
      occurrences: number;
      embedding: number[];
    }>
  ): Promise<string[]> {
    if (!this.isInitialized) await this.initialize();

    const baseTimestamp = Date.now();
    const records: DocumentConceptRecord[] = concepts.map((concept, index) => {
      if (concept.embedding.length !== DEFAULT_EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Embedding dimension mismatch for concept ${index}: expected ${DEFAULT_EMBEDDING_DIMENSIONS}, got ${concept.embedding.length}`
        );
      }

      const embeddingHash = computeEmbeddingHash(concept.embedding);
      const id = `${overlayType}:${documentHash}:${embeddingHash}`;

      return {
        id,
        overlay_type: overlayType,
        embedding_hash: embeddingHash,
        document_hash: documentHash,
        document_path: documentPath,
        transform_id: transformId,
        text: concept.text,
        section: concept.section,
        section_hash: concept.sectionHash,
        concept_type: concept.type,
        weight: concept.weight,
        occurrences: concept.occurrences,
        embedding: concept.embedding,
        generated_at: baseTimestamp + index,
      };
    });

    if (records.length > 0) {
      await this.mergeInsert(records);
    }

    return records.map((r) => r.id);
  }

  /**
   * Semantic similarity search across document concepts.
   */
  async similaritySearch(
    queryEmbedding: number[],
    topK: number,
    filter?: DocumentQueryFilter,
    distanceType: 'l2' | 'cosine' | 'dot' = 'cosine'
  ): Promise<
    Array<{
      id: string;
      overlay_type: string;
      document_hash: string;
      document_path: string;
      text: string;
      section: string;
      similarity: number;
      metadata: {
        concept_type: string;
        weight: number;
        occurrences: number;
        section_hash: string;
        transform_id: string;
        generated_at: number;
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

    if (typeof query.distanceType === 'function') {
      query = query.distanceType(distanceType);
    }

    query = query.limit(topK);

    const whereClauses: string[] = [];

    if (filter?.overlay_type) {
      whereClauses.push(
        `overlay_type = '${this.escapeSqlString(filter.overlay_type)}'`
      );
    }
    if (filter?.document_hash) {
      whereClauses.push(
        `document_hash = '${this.escapeSqlString(filter.document_hash)}'`
      );
    }
    if (filter?.document_path) {
      whereClauses.push(
        `document_path = '${this.escapeSqlString(filter.document_path)}'`
      );
    }
    if (filter?.concept_type) {
      whereClauses.push(
        `concept_type = '${this.escapeSqlString(filter.concept_type)}'`
      );
    }
    if (filter?.min_weight !== undefined) {
      whereClauses.push(`weight >= ${filter.min_weight}`);
    }
    if (filter?.max_weight !== undefined) {
      whereClauses.push(`weight <= ${filter.max_weight}`);
    }
    if (filter?.min_occurrences !== undefined) {
      whereClauses.push(`occurrences >= ${filter.min_occurrences}`);
    }
    if (filter?.section) {
      whereClauses.push(`section = '${this.escapeSqlString(filter.section)}'`);
    }

    if (whereClauses.length > 0) {
      query = query.where(whereClauses.join(' AND '));
    }

    const records = await query.toArray();

    return records
      .filter((result: unknown): result is DocumentSearchResult =>
        this.isValidSearchResult(result)
      )
      .map((result: DocumentSearchResult) => ({
        id: result.id,
        overlay_type: result.overlay_type,
        document_hash: result.document_hash,
        document_path: result.document_path,
        text: result.text,
        section: result.section,
        similarity: this.calculateSimilarity(result._distance, distanceType),
        metadata: {
          concept_type: result.concept_type,
          weight: result.weight,
          occurrences:
            typeof result.occurrences === 'bigint'
              ? Number(result.occurrences)
              : result.occurrences,
          section_hash: result.section_hash,
          transform_id: result.transform_id,
          generated_at:
            typeof result.generated_at === 'bigint'
              ? Number(result.generated_at)
              : result.generated_at,
        },
      }))
      .sort(
        (a: { similarity: number }, b: { similarity: number }) =>
          b.similarity - a.similarity
      );
  }

  /**
   * Get a specific concept by ID.
   */
  async getConcept(
    conceptId: string
  ): Promise<DocumentConceptRecord | undefined> {
    if (!this.isInitialized) await this.initialize();

    const escapedId = this.escapeSqlString(conceptId);
    const records = await this.table!.query()
      .where(`id = '${escapedId}'`)
      .limit(1)
      .toArray();

    if (records.length === 0) return undefined;

    return this.toPlainRecord(records[0]);
  }

  /**
   * Get all concepts for a specific document.
   */
  async getDocumentConcepts(
    overlayType: string,
    documentHash: string
  ): Promise<DocumentConceptRecord[]> {
    if (!this.isInitialized) await this.initialize();

    const escapedOverlay = this.escapeSqlString(overlayType);
    const escapedHash = this.escapeSqlString(documentHash);
    const records = await this.table!.query()
      .where(
        `overlay_type = '${escapedOverlay}' AND document_hash = '${escapedHash}'`
      )
      .toArray();

    return records
      .map((record) => this.toPlainRecord(record))
      .filter((record): record is DocumentConceptRecord => record !== undefined)
      .sort(
        (a: DocumentConceptRecord, b: DocumentConceptRecord) =>
          a.generated_at - b.generated_at
      );
  }

  /**
   * Get all concepts for a specific overlay type.
   */
  async getOverlayConcepts(
    overlayType: string
  ): Promise<DocumentConceptRecord[]> {
    if (!this.isInitialized) await this.initialize();

    const escapedOverlay = this.escapeSqlString(overlayType);
    const records = await this.table!.query()
      .where(`overlay_type = '${escapedOverlay}'`)
      .toArray();

    return records
      .map((record) => this.toPlainRecord(record))
      .filter(
        (record): record is DocumentConceptRecord => record !== undefined
      );
  }

  /**
   * Delete a specific concept.
   */
  async deleteConcept(conceptId: string): Promise<boolean> {
    await this.delete(`id = '${this.escapeSqlString(conceptId)}'`);
    return true;
  }

  /**
   * Delete all concepts for a specific document.
   */
  async deleteDocumentConcepts(
    overlayType: string,
    documentHash: string
  ): Promise<boolean> {
    const escapedOverlay = this.escapeSqlString(overlayType);
    const escapedHash = this.escapeSqlString(documentHash);
    await this.delete(
      `overlay_type = '${escapedOverlay}' AND document_hash = '${escapedHash}'`
    );
    return true;
  }

  /**
   * Get statistics about stored document concepts.
   */
  async getStats(): Promise<{
    total_concepts: number;
    total_documents: number;
    by_overlay: Record<string, number>;
    avg_weight: number;
  }> {
    if (!this.isInitialized) await this.initialize();

    const allRecords = await this.table!.query().toArray();

    const uniqueDocuments = new Set<string>();
    const overlayCounts: Record<string, number> = {};
    let totalWeight = 0;

    allRecords.forEach((record) => {
      uniqueDocuments.add(`${record.overlay_type}:${record.document_hash}`);
      overlayCounts[record.overlay_type] =
        (overlayCounts[record.overlay_type] || 0) + 1;
      totalWeight += record.weight || 0;
    });

    return {
      total_concepts: allRecords.length,
      total_documents: uniqueDocuments.size,
      by_overlay: overlayCounts,
      avg_weight: allRecords.length > 0 ? totalWeight / allRecords.length : 0,
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

  private toPlainRecord(
    record: Record<string, unknown>
  ): DocumentConceptRecord | undefined {
    try {
      const plainRecord: DocumentConceptRecord = {
        id: record.id as string,
        overlay_type: record.overlay_type as string,
        embedding_hash: record.embedding_hash as string,
        document_hash: record.document_hash as string,
        document_path: record.document_path as string,
        transform_id: record.transform_id as string,
        text: record.text as string,
        section: record.section as string,
        section_hash: record.section_hash as string,
        concept_type: record.concept_type as string,
        weight: record.weight as number,
        occurrences:
          typeof record.occurrences === 'bigint'
            ? Number(record.occurrences)
            : (record.occurrences as number),
        embedding:
          record.embedding && typeof record.embedding === 'object'
            ? Array.from(record.embedding as ArrayLike<number>)
            : (record.embedding as number[]),
        generated_at:
          typeof record.generated_at === 'bigint'
            ? Number(record.generated_at)
            : (record.generated_at as number),
      };

      if (!this.isValidConceptRecord(plainRecord)) {
        return undefined;
      }

      return plainRecord;
    } catch (error) {
      console.warn(`Error converting record: ${error}`);
      return undefined;
    }
  }

  private isValidConceptRecord(
    record: unknown
  ): record is DocumentConceptRecord {
    const r = record as DocumentConceptRecord;
    if (!r) return false;
    if (typeof r.id !== 'string') return false;
    if (typeof r.overlay_type !== 'string') return false;
    if (typeof r.document_hash !== 'string') return false;
    if (typeof r.text !== 'string') return false;
    if (!Array.isArray(r.embedding)) return false;
    if (r.embedding.length !== DEFAULT_EMBEDDING_DIMENSIONS) return false;
    return true;
  }

  private isValidSearchResult(result: unknown): result is DocumentSearchResult {
    const r = result as DocumentSearchResult;
    if (!r) return false;
    if (typeof r.id !== 'string') return false;
    if (typeof r._distance !== 'number') return false;
    return true;
  }
}
