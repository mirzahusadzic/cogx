import { OperationalKnowledge } from '../../analyzers/document-extractor.js';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { EmbedLogger } from '../shared/embed-logger.js';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../../config.js';
import { OverlayItem } from '../../algebra/overlay-algebra.js';
import type { OverlayData } from '../../pgc/embedding-loader.js';
import { BasePatternManager } from '../base/manager.js';
import { OperationalMetadata, OperationalPatternsOverlay } from './metadata.js';

/**
 * OperationalPatternsManager
 *
 * Manages operational pattern overlays in the PGC (O₅ layer).
 * Stores extracted workflow patterns from process documents (OPERATIONAL_LATTICE.md).
 *
 * LATTICE POSITION: O₅ (Operational)
 */
export class OperationalPatternsManager extends BasePatternManager<OperationalMetadata> {
  private overlayPath: string;

  constructor(pgcRoot: string, workbenchUrl?: string) {
    super(pgcRoot, workbenchUrl);
    this.overlayPath = path.join(pgcRoot, 'overlays', 'operational_patterns');
  }

  // ========================================
  // OVERLAY ALGEBRA INTERFACE
  // ========================================

  getOverlayId(): string {
    return 'O5';
  }

  getOverlayName(): string {
    return 'Operational';
  }

  getSupportedTypes(): string[] {
    return [
      'quest_structure',
      'sacred_sequence',
      'workflow_pattern',
      'depth_rule',
      'terminology',
      'explanation',
    ];
  }

  async getAllItems(): Promise<OverlayItem<OperationalMetadata>[]> {
    const items: OverlayItem<OperationalMetadata>[] = [];

    if (!(await fs.pathExists(this.overlayPath))) {
      return items;
    }

    const overlayFiles = await fs.readdir(this.overlayPath);

    // Load embeddings helper (v1/v2 compatible)
    const { EmbeddingLoader } = await import('../../pgc/embedding-loader.js');
    const loader = new EmbeddingLoader();

    for (const file of overlayFiles) {
      if (!file.endsWith('.yaml')) continue;

      const documentHash = file.replace('.yaml', '');
      const content = await fs.readFile(
        path.join(this.overlayPath, file),
        'utf-8'
      );
      const overlay = YAML.parse(content) as OperationalPatternsOverlay;

      const patternsWithEmbeddings = await loader.loadConceptsWithEmbeddings(
        overlay as unknown as OverlayData,
        this.pgcRoot
      );

      // Build lookup map for O(1) access to original patterns
      const patternMap = new Map(
        overlay.extracted_patterns?.map((p) => [p.text, p]) || []
      );

      for (const concept of patternsWithEmbeddings) {
        // O(1) lookup for original pattern
        const originalPattern = patternMap.get(concept.text);

        items.push({
          id: `${documentHash}:${concept.text}`,
          embedding: concept.embedding!,
          metadata: {
            text: concept.text,
            type:
              (originalPattern?.patternType as OperationalMetadata['type']) ||
              'explanation',
            patternType: originalPattern?.patternType || 'explanation',
            weight: concept.weight,
            occurrences: concept.occurrences,
            section: concept.section || 'unknown',
            sectionHash: concept.sectionHash || documentHash,
            documentHash: documentHash,
            steps: originalPattern?.metadata?.steps as string[] | undefined,
            formula: originalPattern?.metadata?.formula as string | undefined,
            example: originalPattern?.metadata?.example as string | undefined,
          },
        });
      }
    }

    return items;
  }

  // ========================================
  // INGESTION & STORAGE (Domain-Specific)
  // ========================================

  /**
   * Sanitize text for embedding (remove chars that trigger binary detection)
   */
  private sanitizeForEmbedding(text: string): string {
    return (
      text
        // Replace em-dash and en-dash with regular dash
        .replace(/[\u2013\u2014]/g, '-')
        // Replace various quotes with straight quotes
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        // Replace bullet points and checkmarks with asterisk
        .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25CF\u2713\u2714]/g, '*')
        // Replace arrows with ASCII equivalents
        .replace(/[\u2192\u2190\u2191\u2193]/g, '->')
        // Remove any remaining non-ASCII characters
        .replace(/[^\x20-\x7E\n\r\t]/g, '')
    );
  }

  /**
   * Generate embeddings for operational patterns
   */
  private async generateEmbeddings(
    patterns: OperationalKnowledge[],
    documentName?: string
  ): Promise<OperationalKnowledge[]> {
    const patternsWithEmbeddings: OperationalKnowledge[] = [];
    const total = patterns.length;

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];

      if (i === 0 || i === total - 1 || (i + 1) % 50 === 0) {
        EmbedLogger.progress(i + 1, total, 'OperationalPatterns', documentName);
      }

      try {
        const sanitizedText = this.sanitizeForEmbedding(pattern.text);
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

        patternsWithEmbeddings.push({
          ...pattern,
          embedding,
        });
      } catch (error) {
        console.warn(
          `Warning: Failed to generate embedding for pattern: ${(error as Error).message}`
        );
      }
    }

    return patternsWithEmbeddings;
  }

  /**
   * Store embeddings in LanceDB
   */
  private async storeEmbeddingsInLance(
    patterns: OperationalKnowledge[],
    documentHash: string,
    documentPath: string
  ): Promise<void> {
    const { LanceVectorStore } = await import('../vector-db/lance-store.js');
    const lanceStore = new LanceVectorStore(this.pgcRoot);
    await lanceStore.initialize('operational_patterns');

    const vectors = patterns
      .filter((item) => item.embedding && item.embedding.length > 0)
      .map((item, index) => ({
        id: `${documentHash}_${index}`,
        symbol: item.text.substring(0, 100),
        embedding: item.embedding!,
        document_hash: documentHash,
        structural_signature: `operational:${item.patternType}`,
        semantic_signature: item.text,
        type: 'semantic',
        architectural_role: item.patternType,
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
    patterns: OperationalKnowledge[],
    transformId: string
  ): Promise<void> {
    await fs.ensureDir(this.overlayPath);

    const documentName = path.basename(documentPath);
    const patternsWithEmbeddings = await this.generateEmbeddings(
      patterns,
      documentName
    );

    await this.storeEmbeddingsInLance(
      patternsWithEmbeddings,
      documentHash,
      documentPath
    );

    const patternsWithoutEmbeddings = patternsWithEmbeddings.map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { embedding, ...rest } = item;
      return rest as OperationalKnowledge;
    });

    const overlay: OperationalPatternsOverlay = {
      document_hash: documentHash,
      document_path: documentPath,
      extracted_patterns: patternsWithoutEmbeddings,
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
  ): Promise<OperationalPatternsOverlay | null> {
    const overlayFile = path.join(this.overlayPath, `${documentHash}.yaml`);

    if (!(await fs.pathExists(overlayFile))) {
      return null;
    }

    const content = await fs.readFile(overlayFile, 'utf-8');
    return YAML.parse(content) as OperationalPatternsOverlay;
  }

  // ========================================
  // COMPATIBILITY METHODS (Redirect to Algebra)
  // ========================================
  /**
   * Get all operational patterns across all documents
   */

  async getAllPatterns(): Promise<OperationalKnowledge[]> {
    const items = await this.getAllItems();
    return items.map((item) => ({
      text: item.metadata.text,
      patternType: item.metadata
        .patternType as OperationalKnowledge['patternType'],
      weight: item.metadata.weight,
      occurrences: item.metadata.occurrences,
      section: item.metadata.section,
      sectionHash: item.metadata.sectionHash,
      metadata: {
        steps: item.metadata.steps,
        formula: item.metadata.formula,
        example: item.metadata.example,
      },
    }));
  }
  /**
   * Query patterns by type
   */

  async getPatternsByType(type: string): Promise<OperationalKnowledge[]> {
    const items = await this.getItemsByType(type);
    return items.map((item) => ({
      text: item.metadata.text,
      patternType: item.metadata
        .patternType as OperationalKnowledge['patternType'],
      weight: item.metadata.weight,
      occurrences: item.metadata.occurrences,
      section: item.metadata.section,
      sectionHash: item.metadata.sectionHash,
      metadata: {
        steps: item.metadata.steps,
        formula: item.metadata.formula,
        example: item.metadata.example,
      },
    }));
  }
  /**
   * Query patterns by semantic search
   * (Future: Use vector similarity search)
   */

  async queryPatterns(query: string): Promise<OperationalKnowledge[]> {
    const results = await this.query(query);
    return results.map((r) => ({
      text: r.item.metadata.text,
      patternType: r.item.metadata
        .patternType as OperationalKnowledge['patternType'],
      weight: r.item.metadata.weight,
      occurrences: r.item.metadata.occurrences,
      section: r.item.metadata.section,
      sectionHash: r.item.metadata.sectionHash,
      metadata: {
        steps: r.item.metadata.steps,
        formula: r.item.metadata.formula,
        example: r.item.metadata.example,
      },
    }));
  }
}
