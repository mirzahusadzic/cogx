import { SecurityKnowledge } from '../../analyzers/document-extractor.js';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import { EmbedLogger } from '../shared/embed-logger.js';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../../config.js';

/**
 * Security guidelines overlay (O₂)
 * Stores extracted security knowledge for safe development guidance
 *
 * PURPOSE:
 * - Foundational security layer (checked before mission alignment)
 * - PORTABLE: Can be exported/imported via .cogx files
 * - Enables security inheritance from dependencies
 *
 * REUSABILITY:
 * express.cogx → O₂ (CVEs, safe patterns)
 *   ↓ import
 * Your Project → Inherits express security knowledge
 *   ↓ query
 * "Safe input handling?" → Combines your O₂ + express O₂
 */
export interface SecurityGuidelinesOverlay {
  document_hash: string; // Content hash of source document
  document_path: string; // Path to source markdown file
  extracted_knowledge: SecurityKnowledge[]; // Security patterns with embeddings
  generated_at: string; // ISO timestamp
  transform_id: string; // Transform that generated this overlay
  source_project?: string; // For imported .cogx files
  source_commit?: string; // Git commit hash (provenance)
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
export class SecurityGuidelinesManager {
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

    const overlay: SecurityGuidelinesOverlay = {
      document_hash: documentHash,
      document_path: documentPath,
      extracted_knowledge: knowledgeWithEmbeddings,
      generated_at: new Date().toISOString(),
      transform_id: transformId,
      source_project: sourceProject,
      source_commit: sourceCommit,
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
