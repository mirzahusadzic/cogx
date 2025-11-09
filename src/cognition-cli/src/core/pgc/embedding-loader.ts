/**
 * Embedding Loader - Unified v1/v2 Format Support
 *
 * Provides backward compatibility for loading embeddings from:
 * - v1 format: Embeddings stored in YAML files (legacy)
 * - v2 format: Embeddings stored in LanceDB (current)
 *
 * This solves the critical migration bug where all overlay managers
 * broke after migrate:lance because they expected embeddings in YAML.
 *
 * USAGE:
 * ```typescript
 * const loader = new EmbeddingLoader();
 * const concepts = await loader.loadConceptsWithEmbeddings(
 *   overlay,
 *   pgcRoot
 * );
 * ```
 *
 * Related: CRITICAL_LANCE_MIGRATION_BUG.md - Phase 1
 */

import { DocumentLanceStore } from './document-lance-store.js';
import type { MissionConcept } from '../analyzers/concept-extractor.js';

/**
 * Generic overlay data structure (v1 or v2)
 * Uses index signature to accept any overlay type
 */
export type OverlayData = {
  format_version?: number;
  lancedb_metadata?: {
    storage_path: string;
    overlay_type: string;
    document_hash: string;
    migrated_at: string;
    concepts_count: number;
  };
  document_hash?: string;
  extracted_concepts?: MissionConcept[];
  extracted_knowledge?: MissionConcept[];
  mission_concepts?: MissionConcept[];
  security_concepts?: MissionConcept[];
  operational_patterns?: MissionConcept[];
  mathematical_proofs?: MissionConcept[];
  coherence_links?: MissionConcept[];
} & Record<string, unknown>;

/**
 * Load embeddings from YAML (v1) or LanceDB (v2)
 * Provides backward compatibility during migration period
 */
export class EmbeddingLoader {
  /**
   * Load concepts with embeddings from overlay data.
   * Automatically detects format version and loads from appropriate source.
   *
   * @param overlayData - Overlay data (v1 or v2 format)
   * @param pgcRoot - Path to .open_cognition directory
   * @returns Array of concepts with embeddings
   */
  async loadConceptsWithEmbeddings(
    overlayData: OverlayData,
    pgcRoot: string
  ): Promise<MissionConcept[]> {
    // V2 format: Load from LanceDB
    if (overlayData.format_version === 2 && overlayData.lancedb_metadata) {
      return this.loadFromLanceDB(overlayData, pgcRoot);
    }

    // V1 format: Load from YAML (legacy)
    return this.loadFromYAML(overlayData);
  }

  /**
   * Load embeddings from LanceDB (v2 format)
   */
  private async loadFromLanceDB(
    overlayData: OverlayData,
    pgcRoot: string
  ): Promise<MissionConcept[]> {
    if (!overlayData.lancedb_metadata) {
      throw new Error('V2 format overlay missing lancedb_metadata');
    }

    const lanceStore = new DocumentLanceStore(pgcRoot);

    try {
      await lanceStore.initialize();

      const records = await lanceStore.getDocumentConcepts(
        overlayData.lancedb_metadata.overlay_type,
        overlayData.lancedb_metadata.document_hash
      );

      await lanceStore.close();

      // Convert DocumentConceptRecord to MissionConcept
      return records.map((record) => ({
        text: record.text,
        section: record.section,
        weight: record.weight,
        occurrences: record.occurrences,
        sectionHash: record.section_hash,
        embedding: record.embedding,
      }));
    } catch (error) {
      await lanceStore.close();
      throw new Error(
        `Failed to load embeddings from LanceDB: ${(error as Error).message}`
      );
    }
  }

  /**
   * Load embeddings from YAML (v1 format)
   */
  private loadFromYAML(overlayData: OverlayData): MissionConcept[] {
    const conceptField = this.getConceptField(overlayData);

    if (!conceptField) {
      return [];
    }

    const concepts = overlayData[conceptField] as MissionConcept[] | undefined;

    if (!concepts || !Array.isArray(concepts)) {
      return [];
    }

    // Filter for concepts with valid embeddings
    return concepts.filter((c) => c.embedding && c.embedding.length === 768);
  }

  /**
   * Determine which field contains concepts based on overlay data
   */
  private getConceptField(overlayData: OverlayData): string | null {
    // Try common concept field names
    const possibleFields = [
      'extracted_concepts',
      'extracted_knowledge',
      'mission_concepts',
      'security_concepts',
      'operational_patterns',
      'mathematical_proofs',
      'coherence_links',
    ];

    for (const field of possibleFields) {
      if (overlayData[field] && Array.isArray(overlayData[field])) {
        return field;
      }
    }

    return null;
  }

  /**
   * Check if overlay data is in v2 format
   */
  isV2Format(overlayData: OverlayData): boolean {
    return overlayData.format_version === 2 && !!overlayData.lancedb_metadata;
  }

  /**
   * Check if overlay data is in v1 format
   */
  isV1Format(overlayData: OverlayData): boolean {
    return !this.isV2Format(overlayData);
  }

  /**
   * Get format version string for logging
   */
  getFormatVersion(overlayData: OverlayData): string {
    if (this.isV2Format(overlayData)) {
      return 'v2 (LanceDB)';
    }
    return 'v1 (YAML)';
  }
}
