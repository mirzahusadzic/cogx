import { MathematicalKnowledge } from '../../analyzers/document-extractor.js';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import { EmbedLogger } from '../shared/embed-logger.js';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../../config.js';
import {
  OverlayAlgebra,
  OverlayItem,
  OverlayMetadata,
  SelectOptions,
} from '../../algebra/overlay-algebra.js';
import type { OverlayData } from '../../pgc/embedding-loader.js';

/**
 * Mathematical Proofs Overlay (O₆) - FORMAL REASONING
 *
 * Stores extracted mathematical statements and proofs.
 * This overlay captures formal properties, theorems, and proofs
 * from mathematical/formal documents (THEORY.md, proofs, etc.).
 *
 * LATTICE POSITION: O₆ (Formal/Mathematical)
 * - Echo's domain: Formal properties and reasoning
 * - Complements mission (O₄): Formal foundations for vision
 * - Supports coherence (O₇): Proves correctness properties
 *
 * STATEMENT TYPES:
 * - theorem: Formal statements with proofs
 * - lemma: Supporting propositions
 * - axiom: Foundational truths
 * - corollary: Derived results
 * - proof: Step-by-step derivations
 * - identity: Mathematical equalities/invariants
 *
 * USE CASES:
 * - Invariant reasoning: "What theorems relate to lattice coherence?"
 * - Property verification: "Does this code satisfy the theorem?"
 * - Formal queries: "What are the axioms of our system?"
 * - Proof discovery: "What lemmas support this property?"
 *
 * EMBEDDINGS:
 * - Each statement has a 768-dimensional vector from eGemma
 * - Enables semantic search over formal knowledge
 * - Supports queries like: "What proofs relate to monotonicity?"
 *
 * DESIGN RATIONALE:
 * - Formal foundations: Mathematical basis for system
 * - Queryable: Natural language queries over formal knowledge
 * - Provenance: Track which documents define each theorem
 * - Evolution: Track how formal properties evolve
 *
 * FUTURE VISION:
 * - Formal verification of code properties
 * - Automatic theorem application to code
 * - Proof-guided optimization and refactoring
 * - Integration with proof assistants (Coq, Lean, etc.)
 *
 * STORAGE:
 * - YAML: .open_cognition/overlays/mathematical_proofs/<doc_hash>.yaml
 * - LanceDB: .open_cognition/lance/documents.lancedb (overlay_type='O6')
 *
 * @example
 * // Query mathematical statements semantically
 * const manager = new MathematicalProofsManager(pgcRoot);
 * const results = await manager.query('lattice monotonicity', 5);
 *
 * @example
 * // Get all axioms (foundational truths)
 * const axioms = await manager.getAxioms();
 *
 * @example
 * // Find theorems by type
 * const theorems = await manager.getStatementsByType('theorem');
 */
export interface MathematicalProofsOverlay {
  document_hash: string; // Content hash of source document
  document_path: string; // Path to source markdown file
  extracted_statements: MathematicalKnowledge[]; // Theorems, proofs, etc.
  generated_at: string; // ISO timestamp
  transform_id: string; // Transform that generated this overlay
}

/**
 * Metadata for mathematical overlay items
 */
export interface MathematicalMetadata extends OverlayMetadata {
  text: string;
  statementType:
    | 'theorem'
    | 'lemma'
    | 'axiom'
    | 'corollary'
    | 'proof'
    | 'identity';
  weight: number;
  occurrences: number;
  section: string;
  sectionHash: string;
  documentHash: string;
  proofSteps?: string[];
  dependencies?: string[];
  formalNotation?: string;
}

/**
 * MathematicalProofsManager
 *
 * Manages mathematical proof overlays in the PGC (O₆ layer - Echo's domain).
 * Stores extracted mathematical statements from formal documents.
 *
 * OVERLAY STRUCTURE:
 * .open_cognition/overlays/mathematical_proofs/<doc-hash>.yaml
 *
 * STATEMENT TYPES:
 * - theorem: Formal statements with proofs
 * - lemma: Supporting propositions
 * - axiom: Foundational truths
 * - corollary: Derived results
 * - proof: Step-by-step derivations
 * - identity: Mathematical equalities/invariants
 *
 * EMBEDDINGS:
 * - Each statement has a 768-dimensional vector from eGemma
 * - Enables semantic search: "What theorems relate to lattice coherence?"
 * - Supports formal reasoning queries
 *
 * FUTURE:
 * - Integrate with formal verification tools
 * - Support proof checking
 * - Enable theorem application to code
 */
export class MathematicalProofsManager
  implements OverlayAlgebra<MathematicalMetadata>
{
  private overlayPath: string;
  private workbench: WorkbenchClient;

  constructor(
    private pgcRoot: string,
    workbenchUrl?: string
  ) {
    this.overlayPath = path.join(pgcRoot, 'overlays', 'mathematical_proofs');
    this.workbench = new WorkbenchClient(
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000'
    );
  }

  // ========================================
  // OVERLAY ALGEBRA INTERFACE
  // ========================================

  getOverlayId(): string {
    return 'O6';
  }

  getOverlayName(): string {
    return 'Mathematical';
  }

  getSupportedTypes(): string[] {
    return ['theorem', 'lemma', 'axiom', 'corollary', 'proof', 'identity'];
  }

  getPgcRoot(): string {
    return this.pgcRoot;
  }

  async getAllItems(): Promise<OverlayItem<MathematicalMetadata>[]> {
    const items: OverlayItem<MathematicalMetadata>[] = [];

    if (!(await fs.pathExists(this.overlayPath))) {
      return items;
    }

    const overlayFiles = await fs.readdir(this.overlayPath);

    for (const file of overlayFiles) {
      if (!file.endsWith('.yaml')) continue;

      const documentHash = file.replace('.yaml', '');
      const content = await fs.readFile(
        path.join(this.overlayPath, file),
        'utf-8'
      );
      const overlay = YAML.parse(content) as MathematicalProofsOverlay;

      // Load embeddings using EmbeddingLoader (supports both v1 and v2 formats)
      const { EmbeddingLoader } = await import('../../pgc/embedding-loader.js');
      const loader = new EmbeddingLoader();
      const statementsWithEmbeddings = await loader.loadConceptsWithEmbeddings(
        overlay as unknown as OverlayData,
        this.pgcRoot
      );

      // Build lookup map for O(1) access to original statements
      const statementMap = new Map(
        overlay.extracted_statements?.map((s) => [s.text, s]) || []
      );

      for (const concept of statementsWithEmbeddings) {
        // O(1) lookup for original statement
        const originalStatement = statementMap.get(concept.text);

        items.push({
          id: `${documentHash}:${concept.text}`,
          embedding: concept.embedding!,
          metadata: {
            text: concept.text,
            statementType: originalStatement?.statementType || 'theorem',
            weight: concept.weight,
            occurrences: concept.occurrences,
            section: concept.section || 'unknown',
            sectionHash: concept.sectionHash || documentHash,
            documentHash: documentHash,
            proofSteps: originalStatement?.metadata?.proofSteps as
              | string[]
              | undefined,
            dependencies: originalStatement?.metadata?.dependencies as
              | string[]
              | undefined,
            formalNotation: originalStatement?.metadata?.formalNotation as
              | string
              | undefined,
          },
        });
      }
    }

    return items;
  }

  async getItemsByType(
    type: string
  ): Promise<OverlayItem<MathematicalMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => item.metadata.statementType === type);
  }

  async filter(
    predicate: (metadata: MathematicalMetadata) => boolean
  ): Promise<OverlayItem<MathematicalMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => predicate(item.metadata));
  }

  async query(
    query: string,
    topK: number = 10,
    precomputedEmbedding?: number[]
  ): Promise<
    Array<{ item: OverlayItem<MathematicalMetadata>; similarity: number }>
  > {
    let queryEmbedding: number[];

    // Use pre-computed embedding if provided (optimization)
    if (precomputedEmbedding && precomputedEmbedding.length === 768) {
      queryEmbedding = precomputedEmbedding;
    } else {
      const embedResponse = await this.workbench.embed({
        signature: query,
        dimensions: 768,
      });

      queryEmbedding = embedResponse['embedding_768d'] as number[];
      if (!queryEmbedding || queryEmbedding.length !== 768) {
        throw new Error('Failed to generate query embedding');
      }
    }

    const allItems = await this.getAllItems();
    const results = allItems.map((item) => ({
      item,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding),
    }));

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  async select(
    options: SelectOptions
  ): Promise<OverlayItem<MathematicalMetadata>[]> {
    const allItems = await this.getAllItems();

    if (options.symbols) {
      return allItems.filter((item) =>
        options.symbols!.has(item.metadata.text)
      );
    }

    if (options.ids) {
      return allItems.filter((item) => options.ids!.has(item.id));
    }

    return allItems;
  }

  async exclude(
    options: SelectOptions
  ): Promise<OverlayItem<MathematicalMetadata>[]> {
    const allItems = await this.getAllItems();

    if (options.symbols) {
      return allItems.filter(
        (item) => !options.symbols!.has(item.metadata.text)
      );
    }

    if (options.ids) {
      return allItems.filter((item) => !options.ids!.has(item.id));
    }

    return allItems;
  }

  async getSymbolSet(): Promise<Set<string>> {
    const allItems = await this.getAllItems();
    return new Set(allItems.map((item) => item.metadata.text));
  }

  async getIdSet(): Promise<Set<string>> {
    const allItems = await this.getAllItems();
    return new Set(allItems.map((item) => item.id));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  // ========================================
  // LEGACY METHODS (keep for compatibility)
  // ========================================

  /**
   * Sanitize text for embedding
   */
  private sanitizeForEmbedding(text: string): string {
    return text
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25CF\u2713\u2714]/g, '*')
      .replace(/[\u2192\u2190\u2191\u2193]/g, '->')
      .replace(/[^\x20-\x7E\n\r\t]/g, '');
  }

  /**
   * Generate embeddings for mathematical statements
   */
  private async generateEmbeddings(
    statements: MathematicalKnowledge[],
    documentName?: string
  ): Promise<MathematicalKnowledge[]> {
    const statementsWithEmbeddings: MathematicalKnowledge[] = [];
    const total = statements.length;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (i === 0 || i === total - 1 || (i + 1) % 50 === 0) {
        EmbedLogger.progress(i + 1, total, 'MathematicalProofs', documentName);
      }

      try {
        const sanitizedText = this.sanitizeForEmbedding(statement.text);
        const embedResponse = await this.workbench.embed({
          signature: sanitizedText,
          dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
        });
        const embedding = embedResponse['embedding_768d'];

        if (
          !embedding ||
          !Array.isArray(embedding) ||
          embedding.length !== DEFAULT_EMBEDDING_DIMENSIONS
        ) {
          const actualLength = Array.isArray(embedding) ? embedding.length : 0;
          console.warn(
            `Warning: Invalid embedding for statement "${statement.text.substring(0, 50)}..." (got ${actualLength} dimensions, expected ${DEFAULT_EMBEDDING_DIMENSIONS})`
          );
          continue;
        }

        statementsWithEmbeddings.push({
          ...statement,
          embedding,
        });
      } catch (error) {
        console.warn(
          `Warning: Failed to generate embedding: ${(error as Error).message}`
        );
      }
    }

    return statementsWithEmbeddings;
  }

  /**
   * Store embeddings in LanceDB (NOT in YAML!)
   * Embeddings are stored in binary format in patterns.lancedb/mathematical_proofs
   */
  private async storeEmbeddingsInLance(
    statements: MathematicalKnowledge[],
    documentHash: string,
    documentPath: string
  ): Promise<void> {
    const { LanceVectorStore } = await import('../vector-db/lance-store.js');
    const lanceStore = new LanceVectorStore(this.pgcRoot);
    await lanceStore.initialize('mathematical_proofs');

    const vectors = statements
      .filter((item) => item.embedding && item.embedding.length > 0)
      .map((item, index) => ({
        id: `${documentHash}_${index}`,
        symbol: item.text.substring(0, 100),
        embedding: item.embedding!,
        document_hash: documentHash, // KEY: Track document hash for --force cleanup
        structural_signature: `mathematical:${item.statementType}`,
        semantic_signature: item.text,
        type: 'semantic',
        architectural_role: item.statementType,
        computed_at: new Date().toISOString(),
        lineage_hash: documentHash,
        filePath: documentPath,
        structuralHash: documentHash,
      }));

    if (vectors.length > 0) {
      await lanceStore.batchStoreVectors(
        vectors.map((v) => ({
          id: v.id,
          embedding: v.embedding,
          metadata: {
            symbol: v.symbol,
            document_hash: v.document_hash,
            structural_signature: v.structural_signature,
            semantic_signature: v.semantic_signature,
            type: v.type,
            architectural_role: v.architectural_role,
            computed_at: v.computed_at,
            lineage_hash: v.lineage_hash,
            filePath: v.filePath,
            structuralHash: v.structuralHash,
          },
        }))
      );
    }

    await lanceStore.close();
  }

  /**
   * Generate overlay for a document
   */
  async generateOverlay(
    documentPath: string,
    documentHash: string,
    statements: MathematicalKnowledge[],
    transformId: string
  ): Promise<void> {
    await fs.ensureDir(this.overlayPath);

    const documentName = path.basename(documentPath);
    const statementsWithEmbeddings = await this.generateEmbeddings(
      statements,
      documentName
    );

    // Store embeddings in LanceDB (NOT in YAML!)
    await this.storeEmbeddingsInLance(
      statementsWithEmbeddings,
      documentHash,
      documentPath
    );

    // Strip embeddings before writing to YAML (metadata only)
    const statementsWithoutEmbeddings = statementsWithEmbeddings.map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { embedding, ...rest } = item;
      return rest as MathematicalKnowledge;
    });

    const overlay: MathematicalProofsOverlay = {
      document_hash: documentHash,
      document_path: documentPath,
      extracted_statements: statementsWithoutEmbeddings, // No embeddings!
      generated_at: new Date().toISOString(),
      transform_id: transformId,
    };

    const overlayFile = path.join(this.overlayPath, `${documentHash}.yaml`);
    await fs.writeFile(overlayFile, YAML.stringify(overlay));
  }

  /**
   * Load overlay for a document
   */
  async loadOverlay(
    documentHash: string
  ): Promise<MathematicalProofsOverlay | null> {
    const overlayFile = path.join(this.overlayPath, `${documentHash}.yaml`);

    if (!(await fs.pathExists(overlayFile))) {
      return null;
    }

    const content = await fs.readFile(overlayFile, 'utf-8');
    return YAML.parse(content) as MathematicalProofsOverlay;
  }

  /**
   * Get all mathematical statements across all documents
   */
  async getAllStatements(): Promise<MathematicalKnowledge[]> {
    const overlayFiles = await fs.readdir(this.overlayPath);
    const allStatements: MathematicalKnowledge[] = [];

    for (const file of overlayFiles) {
      if (!file.endsWith('.yaml')) continue;

      const content = await fs.readFile(
        path.join(this.overlayPath, file),
        'utf-8'
      );
      const overlay = YAML.parse(content) as MathematicalProofsOverlay;

      allStatements.push(...overlay.extracted_statements);
    }

    return allStatements;
  }

  /**
   * Query statements by type
   */
  async getStatementsByType(
    statementType:
      | 'theorem'
      | 'lemma'
      | 'axiom'
      | 'corollary'
      | 'proof'
      | 'identity'
  ): Promise<MathematicalKnowledge[]> {
    const allStatements = await this.getAllStatements();
    return allStatements.filter((s) => s.statementType === statementType);
  }

  /**
   * Query statements by text search
   */
  async queryStatements(query: string): Promise<MathematicalKnowledge[]> {
    const allStatements = await this.getAllStatements();
    const lowerQuery = query.toLowerCase();

    return allStatements
      .filter((s) => s.text.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.weight - a.weight);
  }

  /**
   * Get all theorems
   */
  async getTheorems(): Promise<MathematicalKnowledge[]> {
    return this.getStatementsByType('theorem');
  }

  /**
   * Get all axioms (foundational truths)
   */
  async getAxioms(): Promise<MathematicalKnowledge[]> {
    return this.getStatementsByType('axiom');
  }

  /**
   * Get all proofs
   */
  async getProofs(): Promise<MathematicalKnowledge[]> {
    return this.getStatementsByType('proof');
  }
}
