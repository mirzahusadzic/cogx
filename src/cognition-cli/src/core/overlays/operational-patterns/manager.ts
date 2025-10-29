import { OperationalKnowledge } from '../../analyzers/document-extractor.js';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import { EmbedLogger } from '../shared/embed-logger.js';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../../config.js';

/**
 * Operational patterns overlay (O₅)
 * Stores extracted workflow patterns for agent guidance
 *
 * PURPOSE:
 * - Guides AI agents on HOW to work (not WHAT to build)
 * - Provides queryable workflow knowledge
 * - Enables projection queries: "Given this code state, what's the next step?"
 */
export interface OperationalPatternsOverlay {
  document_hash: string; // Content hash of source document
  document_path: string; // Path to source markdown file
  extracted_patterns: OperationalKnowledge[]; // Workflow patterns with embeddings
  generated_at: string; // ISO timestamp
  transform_id: string; // Transform that generated this overlay
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
 *
 * EMBEDDINGS:
 * - Each pattern has a 768-dimensional vector from eGemma
 * - Enables semantic search: "How should I handle depth 2 work?"
 * - Supports projection queries across O₁ (code state) → O₅ (process guidance)
 */
export class OperationalPatternsManager {
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
