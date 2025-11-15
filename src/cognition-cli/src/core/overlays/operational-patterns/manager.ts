import { OperationalKnowledge } from '../../analyzers/document-extractor.js';
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
 * Operational Patterns Overlay (O₅) - WORKFLOW GUIDANCE
 *
 * Stores extracted workflow patterns for AI agent guidance.
 * This overlay captures HOW work gets done from process documents
 * (OPERATIONAL_LATTICE.md, workflows, etc.).
 *
 * LATTICE POSITION: O₅ (Operational)
 * - Respects security (O₂) - workflows must be secure
 * - Guided by mission (O₄) - processes serve strategic goals
 * - Informs coherence (O₇) - ensures code follows correct workflows
 *
 * PATTERN TYPES:
 * - quest_structure: Quest initialization patterns (What/Why/Success)
 * - sacred_sequence: Invariant step sequences (F.L.T.B)
 * - workflow_pattern: Process guidance (depth tracking, rebalancing)
 * - depth_rule: Depth-specific rules (Depth 0-3 guidance)
 * - terminology: Operational vocabulary (Quest, Oracle, AQS)
 * - explanation: Explanatory paragraphs from manuals
 *
 * USE CASES:
 * - Agent guidance: "How should I handle depth 2 work?"
 * - Workflow queries: "What's the sacred sequence for quests?"
 * - Process discovery: "What patterns exist for rebalancing?"
 * - Projection: O₁ (code state) → O₅ (next steps)
 *
 * EMBEDDINGS:
 * - Each pattern has a 768-dimensional vector from eGemma
 * - Enables semantic search: "How to initialize a new quest?"
 * - Supports projection queries across overlays
 *
 * DESIGN RATIONALE:
 * - Workflow knowledge: Capture tribal process knowledge
 * - Queryable: "What's the workflow for X?"
 * - Composable: Combine with code state for context-aware guidance
 * - Evolution: Track how processes change over time
 *
 * STORAGE:
 * - YAML: .open_cognition/overlays/operational_patterns/<doc_hash>.yaml
 * - LanceDB: .open_cognition/lance/documents.lancedb (overlay_type='O5')
 *
 * @example
 * // Query operational patterns semantically
 * const manager = new OperationalPatternsManager(pgcRoot);
 * const results = await manager.query('quest initialization', 5);
 *
 * @example
 * // Get sacred sequence patterns
 * const sequences = await manager.getItemsByType('sacred_sequence');
 *
 * @example
 * // Find depth-specific rules
 * const depthRules = await manager.getPatternsByType('depth_rule');
 */
export interface OperationalPatternsOverlay {
  document_hash: string; // Content hash of source document
  document_path: string; // Path to source markdown file
  extracted_patterns: OperationalKnowledge[]; // Workflow patterns with embeddings
  generated_at: string; // ISO timestamp
  transform_id: string; // Transform that generated this overlay
}

/**
 * Metadata for operational overlay items
 */
export interface OperationalMetadata extends OverlayMetadata {
  text: string;
  patternType:
    | 'quest_structure'
    | 'sacred_sequence'
    | 'workflow_pattern'
    | 'depth_rule'
    | 'terminology'
    | 'explanation';
  weight: number;
  occurrences: number;
  section: string;
  sectionHash: string;
  documentHash: string;
  steps?: string[];
  formula?: string;
  example?: string;
}

/**
 * OperationalPatternsManager
 *
 * Manages operational pattern overlays in the PGC (O₅ layer).
 * Stores extracted workflow patterns from process documents (OPERATIONAL_LATTICE.md).
 *
 * OVERLAY STRUCTURE:
 * .open_cognition/overlays/operational_patterns/<doc-hash>.yaml
 *
 * PATTERN TYPES:
 * - quest_structure: Quest initialization patterns (What/Why/Success)
 * - sacred_sequence: Invariant step sequences (F.L.T.B)
 * - workflow_pattern: Process guidance (depth tracking, rebalancing)
 * - depth_rule: Depth-specific rules (Depth 0-3 guidance)
 * - terminology: Operational vocabulary (Quest, Oracle, AQS)
 * - explanation: Explanatory paragraphs from documentation/manuals
 *
 * EMBEDDINGS:
 * - Each pattern has a 768-dimensional vector from eGemma
 * - Enables semantic search: "How should I handle depth 2 work?"
 * - Supports projection queries across O₁ (code state) → O₅ (process guidance)
 */
export class OperationalPatternsManager
  implements OverlayAlgebra<OperationalMetadata>
{
  private overlayPath: string;
  private workbench: WorkbenchClient;

  constructor(
    private pgcRoot: string,
    workbenchUrl?: string
  ) {
    this.overlayPath = path.join(pgcRoot, 'overlays', 'operational_patterns');
    this.workbench = new WorkbenchClient(
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000'
    );
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

  getPgcRoot(): string {
    return this.pgcRoot;
  }

  async getAllItems(): Promise<OverlayItem<OperationalMetadata>[]> {
    const items: OverlayItem<OperationalMetadata>[] = [];

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
      const overlay = YAML.parse(content) as OperationalPatternsOverlay;

      // Load embeddings using EmbeddingLoader (supports both v1 and v2 formats)
      const { EmbeddingLoader } = await import('../../pgc/embedding-loader.js');
      const loader = new EmbeddingLoader();
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

  async getItemsByType(
    type: string
  ): Promise<OverlayItem<OperationalMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => item.metadata.patternType === type);
  }

  async filter(
    predicate: (metadata: OperationalMetadata) => boolean
  ): Promise<OverlayItem<OperationalMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => predicate(item.metadata));
  }

  async query(
    query: string,
    topK: number = 10,
    precomputedEmbedding?: number[]
  ): Promise<
    Array<{ item: OverlayItem<OperationalMetadata>; similarity: number }>
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
  ): Promise<OverlayItem<OperationalMetadata>[]> {
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
  ): Promise<OverlayItem<OperationalMetadata>[]> {
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
   * Uses eGemma via Workbench (768 dimensions)
   */
  private async generateEmbeddings(
    patterns: OperationalKnowledge[],
    documentName?: string
  ): Promise<OperationalKnowledge[]> {
    const patternsWithEmbeddings: OperationalKnowledge[] = [];
    const total = patterns.length;

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];

      // Show progress
      if (i === 0 || i === total - 1 || (i + 1) % 50 === 0) {
        EmbedLogger.progress(i + 1, total, 'OperationalPatterns', documentName);
      }

      try {
        // Sanitize text to avoid triggering eGemma's binary detection
        const sanitizedText = this.sanitizeForEmbedding(pattern.text);

        // Generate embedding
        const embedResponse = await this.workbench.embed({
          signature: sanitizedText,
          dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
        });
        const embedding = embedResponse['embedding_768d'];

        // Validate embedding
        if (
          !embedding ||
          !Array.isArray(embedding) ||
          embedding.length !== DEFAULT_EMBEDDING_DIMENSIONS
        ) {
          const actualLength = Array.isArray(embedding) ? embedding.length : 0;
          console.warn(
            `Warning: Invalid embedding for pattern "${pattern.text.substring(0, 50)}..." (got ${actualLength} dimensions, expected ${DEFAULT_EMBEDDING_DIMENSIONS})`
          );
          continue;
        }

        patternsWithEmbeddings.push({
          ...pattern,
          embedding,
        });
      } catch (error) {
        console.warn(
          `Warning: Failed to generate embedding for pattern "${pattern.text.substring(0, 50)}...": ${(error as Error).message}`
        );
      }
    }

    return patternsWithEmbeddings;
  }

  /**
   * Generate overlay for a document
   *
   * @param documentPath - Path to source markdown file
   * @param documentHash - Content hash of document
   * @param patterns - Extracted operational patterns
   * @param transformId - Transform ID that generated this overlay
   */
  async generateOverlay(
    documentPath: string,
    documentHash: string,
    patterns: OperationalKnowledge[],
    transformId: string
  ): Promise<void> {
    // Ensure overlay directory exists
    await fs.ensureDir(this.overlayPath);

    // Generate embeddings for patterns
    const documentName = path.basename(documentPath);
    const patternsWithEmbeddings = await this.generateEmbeddings(
      patterns,
      documentName
    );

    // Create overlay
    const overlay: OperationalPatternsOverlay = {
      document_hash: documentHash,
      document_path: documentPath,
      extracted_patterns: patternsWithEmbeddings,
      generated_at: new Date().toISOString(),
      transform_id: transformId,
    };

    // Write overlay to file
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

  /**
   * Get all operational patterns across all documents
   */
  async getAllPatterns(): Promise<OperationalKnowledge[]> {
    const overlayFiles = await fs.readdir(this.overlayPath);
    const allPatterns: OperationalKnowledge[] = [];

    for (const file of overlayFiles) {
      if (!file.endsWith('.yaml')) continue;

      const content = await fs.readFile(
        path.join(this.overlayPath, file),
        'utf-8'
      );
      const overlay = YAML.parse(content) as OperationalPatternsOverlay;

      allPatterns.push(...overlay.extracted_patterns);
    }

    return allPatterns;
  }

  /**
   * Query patterns by type
   */
  async getPatternsByType(
    patternType:
      | 'quest_structure'
      | 'sacred_sequence'
      | 'workflow_pattern'
      | 'depth_rule'
      | 'terminology'
      | 'explanation'
  ): Promise<OperationalKnowledge[]> {
    const allPatterns = await this.getAllPatterns();
    return allPatterns.filter((p) => p.patternType === patternType);
  }

  /**
   * Query patterns by semantic search
   * (Future: Use vector similarity search)
   */
  async queryPatterns(query: string): Promise<OperationalKnowledge[]> {
    // For now, simple text matching
    // Future: Use eGemma to embed query and do vector similarity search
    const allPatterns = await this.getAllPatterns();
    const lowerQuery = query.toLowerCase();

    return allPatterns
      .filter((p) => p.text.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.weight - a.weight);
  }
}
