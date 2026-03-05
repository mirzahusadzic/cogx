import { MathematicalKnowledge } from '../../analyzers/document-extractor.js';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { EmbedLogger } from '../shared/embed-logger.js';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../../config.js';
import { OverlayItem } from '../../algebra/overlay-algebra.js';
import { BasePatternManager } from '../base/manager.js';
import { MathematicalMetadata, MathematicalProofsOverlay } from './metadata.js';
import type { OverlayData } from '../../pgc/embedding-loader.js';

/**
 * MathematicalProofsManager
 *
 * Manages mathematical proof overlays in the PGC (O₆ layer - Echo's domain).
 * Stores extracted mathematical statements from formal documents.
 *
 * LATTICE POSITION: O₆ (Formal/Mathematical)
 */
export class MathematicalProofsManager extends BasePatternManager<MathematicalMetadata> {
  private overlayPath: string;

  constructor(pgcRoot: string, workbenchUrl?: string) {
    super(pgcRoot, workbenchUrl);
    this.overlayPath = path.join(pgcRoot, 'overlays', 'mathematical_proofs');
  }

  // ========================================
  // BASE PATTERN MANAGER IMPLEMENTATION
  // ========================================

  getOverlayId(): string {
    return 'O6';
  }

  getOverlayName(): string {
    return 'Mathematical';
  }

  getSupportedTypes(): string[] {
    return [
      'theorem',
      'lemma',
      'axiom',
      'corollary',
      'proof',
      'identity',
      'invariant',
      'complexity',
    ];
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
        const originalStatement = statementMap.get(concept.text);

        items.push({
          id: `${documentHash}:${concept.text}`,
          embedding: concept.embedding!,
          metadata: {
            text: concept.text,
            type: originalStatement?.statementType || 'theorem',
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

  // ========================================
  // LEGACY METHODS (preserved for compatibility)
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
          continue;
        }

        statementsWithEmbeddings.push({
          ...statement,
          embedding: embedding as number[],
        });
      } catch (error) {
        console.warn(
          `Failed to generate embedding: ${(error as Error).message}`
        );
      }
    }

    return statementsWithEmbeddings;
  }

  /**
   * Store embeddings in LanceDB
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
        document_hash: documentHash,
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

    await this.storeEmbeddingsInLance(
      statementsWithEmbeddings,
      documentHash,
      documentPath
    );

    const statementsWithoutEmbeddings = statementsWithEmbeddings.map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { embedding, ...rest } = item;
      return rest as MathematicalKnowledge;
    });

    const overlay: MathematicalProofsOverlay = {
      document_hash: documentHash,
      document_path: documentPath,
      extracted_statements: statementsWithoutEmbeddings,
      generated_at: new Date().toISOString(),
      transform_id: transformId,
      format_version: 2,
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
    const items = await this.getAllItems();
    return items.map((item) => ({
      text: item.metadata.text,
      statementType: item.metadata
        .statementType as MathematicalMetadata['statementType'],
      weight: item.metadata.weight,
      occurrences: item.metadata.occurrences,
      section: item.metadata.section,
      sectionHash: item.metadata.sectionHash,
      metadata: {
        proofSteps: item.metadata.proofSteps,
        dependencies: item.metadata.dependencies,
        formalNotation: item.metadata.formalNotation,
      },
    }));
  }
  /**
   * Query statements by type
   */

  async getStatementsByType(type: string): Promise<MathematicalKnowledge[]> {
    const all = await this.getAllStatements();
    return all.filter((s) => s.statementType === type);
  }
  /**
   * Query statements by text search
   */

  async queryStatements(query: string): Promise<MathematicalKnowledge[]> {
    const all = await this.getAllStatements();
    const lowerQuery = query.toLowerCase();

    return all
      .filter((s) => s.text.toLowerCase().includes(lowerQuery))
      .sort((a, b) => (b.weight || 0) - (a.weight || 0));
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
