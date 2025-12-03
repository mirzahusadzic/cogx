import { SecurityKnowledge } from '../../analyzers/document-extractor.js';
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
 * Security Guidelines Overlay (O₂) - FOUNDATIONAL LAYER
 *
 * Stores extracted security knowledge for safe development guidance.
 * This is the foundational security layer in the lattice - checked BEFORE
 * mission alignment to ensure safety constraints are never violated.
 *
 * LATTICE POSITION: O₂ (Foundational)
 * - Below mission (O₄) - security constraints cannot be overridden by mission
 * - Composes with operational (O₅) - guides secure workflows
 * - Informs coherence (O₇) - ensures aligned code is also secure
 *
 * KNOWLEDGE TYPES:
 * - threat_model: Attack scenarios and threat actors
 * - attack_vector: Specific exploit methods (SQL injection, XSS, etc.)
 * - mitigation: Countermeasures and defenses
 * - boundary: Security boundaries and trust zones
 * - constraint: Security requirements and policies
 * - vulnerability: Known issues, CVEs from dependencies
 *
 * PORTABILITY (.cogx):
 * O₂ overlays can be exported/imported for security knowledge reuse:
 * ```
 * express.cogx → O₂ (CVEs, safe patterns)
 *   ↓ import
 * Your Project → Inherits express security knowledge
 *   ↓ query
 * "Safe input handling?" → Combines your O₂ + express O₂
 * ```
 *
 * DESIGN RATIONALE:
 * - Foundational: Security is never negotiable
 * - Portable: Reuse security knowledge across projects
 * - Queryable: "What mitigations exist for X attack?"
 * - Composable: Combine project + dependency security layers
 *
 * STORAGE:
 * - YAML: .open_cognition/overlays/security_guidelines/<doc_hash>.yaml
 * - LanceDB: .open_cognition/lance/documents.lancedb (overlay_type='O2')
 *
 * @example
 * // Query security guidelines semantically
 * const manager = new SecurityGuidelinesManager(pgcRoot);
 * const results = await manager.query('SQL injection prevention', 5);
 *
 * @example
 * // Get all CVEs
 * const cves = await manager.getCVEs();
 * console.log(`Found ${cves.length} known vulnerabilities`);
 *
 * @example
 * // Export for .cogx packaging
 * const overlay = await manager.exportForCogx(documentHash);
 * // Import into another project
 * await otherManager.importFromCogx(overlay, 'express', 'abc123');
 */
export interface SecurityGuidelinesOverlay {
  document_hash: string; // Content hash of source document
  document_path: string; // Path to source markdown file
  extracted_knowledge: SecurityKnowledge[]; // Security patterns with embeddings
  generated_at: string; // ISO timestamp
  transform_id: string; // Transform that generated this overlay
  source_project?: string; // For imported .cogx files
  source_commit?: string; // Git commit hash (provenance)
  format_version?: number; // 2 = embeddings in LanceDB, 1 or undefined = embeddings in YAML
}

/**
 * Metadata for security overlay items
 */
export interface SecurityMetadata extends OverlayMetadata {
  text: string;
  securityType:
    | 'threat_model'
    | 'attack_vector'
    | 'mitigation'
    | 'boundary'
    | 'constraint'
    | 'vulnerability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  weight: number;
  occurrences: number;
  section: string;
  sectionHash: string;
  documentHash: string;
  cveId?: string;
  affectedVersions?: string;
  mitigation?: string;
  references?: string[];
}

/**
 * SecurityGuidelinesManager
 *
 * Manages security guideline overlays in the PGC (O₂ layer - foundational).
 * Stores extracted security knowledge from security documents (SECURITY.md, THREAT_MODEL.md).
 *
 * OVERLAY STRUCTURE:
 * .open_cognition/overlays/security_guidelines/<doc-hash>.yaml
 *
 * KNOWLEDGE TYPES:
 * - threat_model: Attack scenarios and threat actors
 * - attack_vector: Specific exploit methods
 * - mitigation: Countermeasures and defenses
 * - boundary: Security boundaries and trust zones
 * - constraint: Security requirements and policies
 * - vulnerability: Known issues, CVEs
 *
 * EMBEDDINGS:
 * - Each piece of knowledge has a 768-dimensional vector from eGemma
 * - Enables semantic search: "What mitigations exist for injection attacks?"
 * - Supports composition: Combine project O₂ + dependency O₂ layers
 *
 * PORTABILITY (.cogx):
 * - Can be exported with git commit hash for provenance
 * - Can be imported from dependencies
 * - Enables security knowledge inheritance across projects
 */
export class SecurityGuidelinesManager implements OverlayAlgebra<SecurityMetadata> {
  private overlayPath: string;
  private workbench: WorkbenchClient;

  constructor(
    private pgcRoot: string,
    workbenchUrl?: string
  ) {
    this.overlayPath = path.join(pgcRoot, 'overlays', 'security_guidelines');
    this.workbench = new WorkbenchClient(
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000'
    );
  }

  // ========================================
  // OVERLAY ALGEBRA INTERFACE
  // ========================================

  getOverlayId(): string {
    return 'O2';
  }

  getOverlayName(): string {
    return 'Security';
  }

  getSupportedTypes(): string[] {
    return [
      'threat_model',
      'attack_vector',
      'mitigation',
      'boundary',
      'constraint',
      'vulnerability',
    ];
  }

  getPgcRoot(): string {
    return this.pgcRoot;
  }

  async getAllItems(): Promise<OverlayItem<SecurityMetadata>[]> {
    const items: OverlayItem<SecurityMetadata>[] = [];

    if (!(await fs.pathExists(this.overlayPath))) {
      return items;
    }

    const overlayFiles = await fs.readdir(this.overlayPath);

    // Load EmbeddingLoader for v1/v2 compatibility
    const { EmbeddingLoader } = await import('../../pgc/embedding-loader.js');
    const loader = new EmbeddingLoader();

    for (const file of overlayFiles) {
      if (!file.endsWith('.yaml')) continue;

      const documentHash = file.replace('.yaml', '');
      const content = await fs.readFile(
        path.join(this.overlayPath, file),
        'utf-8'
      );
      const overlay = YAML.parse(content) as SecurityGuidelinesOverlay;

      // Load concepts with embeddings (v1 from YAML or v2 from LanceDB)
      const conceptsWithEmbeddings = await loader.loadConceptsWithEmbeddings(
        overlay as unknown as OverlayData,
        this.pgcRoot
      );

      // Build lookup map for O(1) access to original knowledge items
      const knowledgeMap = new Map(
        overlay.extracted_knowledge?.map((k) => [k.text, k]) || []
      );

      // For v1 format, map from original extracted_knowledge with all fields
      // For v2 format, we get basic concepts from LanceDB (some fields may be missing)
      for (const concept of conceptsWithEmbeddings) {
        // O(1) lookup for original knowledge item
        const originalKnowledge = knowledgeMap.get(concept.text);

        items.push({
          id: `${documentHash}:${concept.text}`,
          embedding: concept.embedding!,
          metadata: {
            text: concept.text,
            securityType: originalKnowledge?.securityType || 'vulnerability',
            severity: originalKnowledge?.severity || 'low',
            weight: concept.weight,
            occurrences: concept.occurrences,
            section: concept.section || 'unknown',
            sectionHash: concept.sectionHash || documentHash,
            documentHash: documentHash,
            cveId: originalKnowledge?.metadata?.cveId as string | undefined,
            affectedVersions: originalKnowledge?.metadata?.affectedVersions as
              | string
              | undefined,
            mitigation: originalKnowledge?.metadata?.mitigation as
              | string
              | undefined,
            references: originalKnowledge?.metadata?.references as
              | string[]
              | undefined,
          },
        });
      }
    }

    return items;
  }

  async getItemsByType(type: string): Promise<OverlayItem<SecurityMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => item.metadata.securityType === type);
  }

  async filter(
    predicate: (metadata: SecurityMetadata) => boolean
  ): Promise<OverlayItem<SecurityMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => predicate(item.metadata));
  }

  async query(
    query: string,
    topK: number = 10,
    precomputedEmbedding?: number[]
  ): Promise<
    Array<{ item: OverlayItem<SecurityMetadata>; similarity: number }>
  > {
    let queryEmbedding: number[];

    // Use pre-computed embedding if provided (optimization)
    if (precomputedEmbedding && precomputedEmbedding.length === 768) {
      queryEmbedding = precomputedEmbedding;
    } else {
      // Generate embedding for query
      const embedResponse = await this.workbench.embed({
        signature: query,
        dimensions: 768,
      });

      queryEmbedding = embedResponse['embedding_768d'] as number[];
      if (!queryEmbedding || queryEmbedding.length !== 768) {
        throw new Error('Failed to generate query embedding');
      }
    }

    // Get all items and compute similarity
    const allItems = await this.getAllItems();
    const results = allItems.map((item) => ({
      item,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding),
    }));

    // Sort by similarity and return top K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  async select(
    options: SelectOptions
  ): Promise<OverlayItem<SecurityMetadata>[]> {
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
  ): Promise<OverlayItem<SecurityMetadata>[]> {
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
   * Store embeddings in LanceDB with document_hash
   * @private
   */
  private async storeEmbeddingsInLance(
    knowledge: SecurityKnowledge[],
    documentHash: string,
    documentPath: string
  ): Promise<void> {
    const { LanceVectorStore } = await import('../vector-db/lance-store.js');
    const lanceStore = new LanceVectorStore(this.pgcRoot);
    await lanceStore.initialize('security_guidelines');

    const vectors = knowledge
      .filter((item) => item.embedding && item.embedding.length > 0)
      .map((item, index) => ({
        id: `${documentHash}_${index}`,
        symbol: item.text.substring(0, 100), // Truncate for symbol
        embedding: item.embedding!,
        document_hash: documentHash,
        structural_signature: `security:${item.securityType}`,
        semantic_signature: item.text,
        type: 'semantic',
        architectural_role: item.securityType,
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
   * Generate embeddings for security knowledge
   */
  private async generateEmbeddings(
    knowledge: SecurityKnowledge[],
    documentName?: string
  ): Promise<SecurityKnowledge[]> {
    const knowledgeWithEmbeddings: SecurityKnowledge[] = [];
    const total = knowledge.length;

    for (let i = 0; i < knowledge.length; i++) {
      const item = knowledge[i];

      if (i === 0 || i === total - 1 || (i + 1) % 50 === 0) {
        EmbedLogger.progress(i + 1, total, 'SecurityGuidelines', documentName);
      }

      try {
        const sanitizedText = this.sanitizeForEmbedding(item.text);
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
            `Warning: Invalid embedding for security item "${item.text.substring(0, 50)}..." (got ${actualLength} dimensions, expected ${DEFAULT_EMBEDDING_DIMENSIONS})`
          );
          continue;
        }

        knowledgeWithEmbeddings.push({
          ...item,
          embedding,
        });
      } catch (error) {
        console.warn(
          `Warning: Failed to generate embedding: ${(error as Error).message}`
        );
      }
    }

    return knowledgeWithEmbeddings;
  }

  /**
   * Generate overlay for a document
   */
  async generateOverlay(
    documentPath: string,
    documentHash: string,
    knowledge: SecurityKnowledge[],
    transformId: string,
    sourceProject?: string,
    sourceCommit?: string
  ): Promise<void> {
    await fs.ensureDir(this.overlayPath);

    const documentName = path.basename(documentPath);
    const knowledgeWithEmbeddings = await this.generateEmbeddings(
      knowledge,
      documentName
    );

    // Store embeddings in LanceDB (NOT in YAML!)
    await this.storeEmbeddingsInLance(
      knowledgeWithEmbeddings,
      documentHash,
      documentPath
    );

    // Strip embeddings before writing to YAML (metadata only)
    const knowledgeWithoutEmbeddings = knowledgeWithEmbeddings.map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { embedding, ...rest } = item;
      return rest as SecurityKnowledge;
    });

    const overlay: SecurityGuidelinesOverlay = {
      document_hash: documentHash,
      document_path: documentPath,
      extracted_knowledge: knowledgeWithoutEmbeddings,
      generated_at: new Date().toISOString(),
      transform_id: transformId,
      source_project: sourceProject,
      source_commit: sourceCommit,
      format_version: 2, // Mark as v2 format (embeddings in LanceDB pattern tables)
    };

    const overlayFile = path.join(this.overlayPath, `${documentHash}.yaml`);
    await fs.writeFile(overlayFile, YAML.stringify(overlay));
  }

  /**
   * Load overlay for a document
   */
  async loadOverlay(
    documentHash: string
  ): Promise<SecurityGuidelinesOverlay | null> {
    const overlayFile = path.join(this.overlayPath, `${documentHash}.yaml`);

    if (!(await fs.pathExists(overlayFile))) {
      return null;
    }

    const content = await fs.readFile(overlayFile, 'utf-8');
    return YAML.parse(content) as SecurityGuidelinesOverlay;
  }

  /**
   * Get all security knowledge across all documents (including imported)
   */
  async getAllKnowledge(): Promise<SecurityKnowledge[]> {
    const overlayFiles = await fs.readdir(this.overlayPath);
    const allKnowledge: SecurityKnowledge[] = [];

    for (const file of overlayFiles) {
      if (!file.endsWith('.yaml')) continue;

      const content = await fs.readFile(
        path.join(this.overlayPath, file),
        'utf-8'
      );
      const overlay = YAML.parse(content) as SecurityGuidelinesOverlay;

      allKnowledge.push(...overlay.extracted_knowledge);
    }

    return allKnowledge;
  }

  /**
   * Query knowledge by security type
   */
  async getKnowledgeByType(
    securityType:
      | 'threat_model'
      | 'attack_vector'
      | 'mitigation'
      | 'boundary'
      | 'constraint'
      | 'vulnerability'
  ): Promise<SecurityKnowledge[]> {
    const allKnowledge = await this.getAllKnowledge();
    return allKnowledge.filter((k) => k.securityType === securityType);
  }

  /**
   * Query knowledge by severity
   */
  async getKnowledgeBySeverity(
    severity: 'critical' | 'high' | 'medium' | 'low'
  ): Promise<SecurityKnowledge[]> {
    const allKnowledge = await this.getAllKnowledge();
    return allKnowledge.filter((k) => k.severity === severity);
  }

  /**
   * Get all CVEs
   */
  async getCVEs(): Promise<SecurityKnowledge[]> {
    const allKnowledge = await this.getAllKnowledge();
    return allKnowledge.filter(
      (k) => k.securityType === 'vulnerability' && k.metadata?.cveId
    );
  }

  /**
   * Query security knowledge by text search
   */
  async queryKnowledge(query: string): Promise<SecurityKnowledge[]> {
    const allKnowledge = await this.getAllKnowledge();
    const lowerQuery = query.toLowerCase();

    return allKnowledge
      .filter((k) => k.text.toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        // Sort by severity first (critical > high > medium > low)
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const aSeverity = severityOrder[a.severity || 'low'];
        const bSeverity = severityOrder[b.severity || 'low'];

        if (aSeverity !== bSeverity) {
          return aSeverity - bSeverity;
        }

        // Then by weight
        return b.weight - a.weight;
      });
  }

  /**
   * Export overlay for .cogx packaging
   * Returns overlay data with provenance for portability
   */
  async exportForCogx(
    documentHash: string
  ): Promise<SecurityGuidelinesOverlay | null> {
    return this.loadOverlay(documentHash);
  }

  /**
   * Import overlay from .cogx file
   * Marks it with source project and commit for provenance
   */
  async importFromCogx(
    overlay: SecurityGuidelinesOverlay,
    sourceProject: string,
    sourceCommit: string
  ): Promise<void> {
    await fs.ensureDir(this.overlayPath);

    // Add import provenance
    const importedOverlay: SecurityGuidelinesOverlay = {
      ...overlay,
      source_project: sourceProject,
      source_commit: sourceCommit,
    };

    const overlayFile = path.join(
      this.overlayPath,
      `${overlay.document_hash}.yaml`
    );
    await fs.writeFile(overlayFile, YAML.stringify(importedOverlay));
  }
}
