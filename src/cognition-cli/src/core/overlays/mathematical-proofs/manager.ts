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

/**
 * Mathematical proofs overlay (O₆)
 * Stores extracted mathematical statements and proofs
 *
 * PURPOSE:
 * - Echo's domain: formal properties, theorems, proofs
 * - Enables reasoning about system invariants
 * - Supports verification of correctness properties
 *
 * FUTURE VISION:
 * - Formal verification of code properties
 * - Automatic theorem application
 * - Proof-guided optimization
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
        overlay as unknown as import('../../pgc/embedding-loader.js').OverlayData,
        this.pgcRoot
      );

      for (const statement of statementsWithEmbeddings) {
        items.push({
          id: `${documentHash}:${statement.text}`,
          embedding: statement.embedding!,
          metadata: {
            text: statement.text,
            statementType: statement.statementType,
            weight: statement.weight,
            occurrences: statement.occurrences,
            section: statement.section || 'unknown',
            sectionHash: statement.sectionHash || documentHash,
            documentHash: documentHash,
            proofSteps: statement.metadata?.proofSteps as string[] | undefined,
            dependencies: statement.metadata?.dependencies as
              | string[]
              | undefined,
            formalNotation: statement.metadata?.formalNotation as
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

    const overlay: MathematicalProofsOverlay = {
      document_hash: documentHash,
      document_path: documentPath,
      extracted_statements: statementsWithEmbeddings,
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
