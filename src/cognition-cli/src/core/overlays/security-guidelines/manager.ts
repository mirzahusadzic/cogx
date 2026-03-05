import { SecurityKnowledge } from '../../analyzers/document-extractor.js';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { EmbedLogger } from '../shared/embed-logger.js';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../../config.js';
import { OverlayItem } from '../../algebra/overlay-algebra.js';
import { BasePatternManager } from '../base/manager.js';
import { SecurityMetadata, SecurityGuidelinesOverlay } from './metadata.js';
import type { OverlayData } from '../../pgc/embedding-loader.js';

/**
 * SecurityGuidelinesManager
 *
 * Manages security guideline overlays in the PGC (O₂ layer - foundational).
 * Stores extracted security knowledge from security documents (SECURITY.md, THREAT_MODEL.md).
 *
 * LATTICE POSITION: O₂ (Foundational)
 */
export class SecurityGuidelinesManager extends BasePatternManager<SecurityMetadata> {
  private overlayPath: string;

  constructor(pgcRoot: string, workbenchUrl?: string) {
    super(pgcRoot, workbenchUrl);
    this.overlayPath = path.join(pgcRoot, 'overlays', 'security_guidelines');
  }

  // ========================================
  // BASE PATTERN MANAGER IMPLEMENTATION
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

      for (const concept of conceptsWithEmbeddings) {
        const originalKnowledge = knowledgeMap.get(concept.text);

        items.push({
          id: `${documentHash}:${concept.text}`,
          embedding: concept.embedding!,
          metadata: {
            text: concept.text,
            type: originalKnowledge?.securityType || 'vulnerability',
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
   * Store embeddings in LanceDB
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
        symbol: item.text.substring(0, 100),
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
          continue;
        }

        knowledgeWithEmbeddings.push({
          ...item,
          embedding: embedding as number[],
        });
      } catch (error) {
        console.warn(
          `Failed to generate embedding: ${(error as Error).message}`
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

    await this.storeEmbeddingsInLance(
      knowledgeWithEmbeddings,
      documentHash,
      documentPath
    );

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
  ): Promise<SecurityGuidelinesOverlay | null> {
    const overlayFile = path.join(this.overlayPath, `${documentHash}.yaml`);

    if (!(await fs.pathExists(overlayFile))) {
      return null;
    }

    const content = await fs.readFile(overlayFile, 'utf-8');
    return YAML.parse(content) as SecurityGuidelinesOverlay;
  }

  /**
   * Get all security knowledge across all documents
   */
  async getAllKnowledge(): Promise<SecurityKnowledge[]> {
    const items = await this.getAllItems();
    return items.map((item) => ({
      text: item.metadata.text,
      securityType: item.metadata.securityType,
      severity: item.metadata.severity,
      weight: item.metadata.weight,
      occurrences: item.metadata.occurrences,
      section: item.metadata.section,
      sectionHash: item.metadata.sectionHash,
      metadata: {
        cveId: item.metadata.cveId,
        affectedVersions: item.metadata.affectedVersions,
        mitigation: item.metadata.mitigation,
        references: item.metadata.references,
      },
    }));
  }
  /**
   * Query knowledge by security type
   */

  async getKnowledgeByType(type: string): Promise<SecurityKnowledge[]> {
    const all = await this.getAllKnowledge();
    return all.filter((k) => k.securityType === type);
  }
  /**
   * Query knowledge by severity
   */

  async getKnowledgeBySeverity(severity: string): Promise<SecurityKnowledge[]> {
    const all = await this.getAllKnowledge();
    return all.filter((k) => k.severity === severity);
  }
  /**
   * Get all CVEs
   */

  async getCVEs(): Promise<SecurityKnowledge[]> {
    const all = await this.getAllKnowledge();
    return all.filter(
      (k) => k.securityType === 'vulnerability' && k.metadata?.cveId
    );
  }
  /**
   * Query security knowledge by text search
   */

  async queryKnowledge(query: string): Promise<SecurityKnowledge[]> {
    const all = await this.getAllKnowledge();
    const lowerQuery = query.toLowerCase();

    return all
      .filter((k) => k.text.toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        const severityOrder: Record<string, number> = {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
        };
        const aSeverity = severityOrder[a.severity || 'low'];
        const bSeverity = severityOrder[b.severity || 'low'];

        if (aSeverity !== bSeverity) {
          return aSeverity - bSeverity;
        }

        return (b.weight || 0) - (a.weight || 0);
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
