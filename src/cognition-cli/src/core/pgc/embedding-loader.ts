/**
 * Embedding Loader - Unified v1/v2 Format Support
 *
 * Provides backward compatibility for loading embeddings from:
 * - v1 format: Embeddings stored in YAML files (legacy)
 * - v2 format: Embeddings stored in LanceDB (current)
 *
 * MIGRATION CONTEXT:
 * This solves the critical migration bug where all overlay managers
 * broke after migrate:lance because they expected embeddings in YAML.
 *
 * ALGORITHM:
 * 1. Check overlay.format_version
 * 2. If v2 and has lancedb_metadata → load from LanceDB
 * 3. Otherwise → load from YAML (v1 format)
 * 4. Return unified MissionConcept[] format
 *
 * FORMAT DETECTION:
 * - v2: overlay.format_version === 2 && overlay.lancedb_metadata exists
 * - v1: everything else (no version field or version 1)
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
 * BENEFITS:
 * - Transparent to overlay managers (same API for both formats)
 * - Gradual migration (can have mix of v1/v2 overlays)
 * - No breaking changes (existing YAML overlays still work)
 *
 * Related: CRITICAL_LANCE_MIGRATION_BUG.md - Phase 1
 *
 * @example
 * // Load embeddings transparently (v1 or v2)
 * const loader = new EmbeddingLoader();
 * const concepts = await loader.loadConceptsWithEmbeddings(overlay, pgcRoot);
 * console.log(`Loaded ${concepts.length} concepts from ${loader.getFormatVersion(overlay)}`);
 *
 * @example
 * // Check format version
 * if (loader.isV2Format(overlay)) {
 *   console.log('Using LanceDB storage');
 * } else {
 *   console.log('Using YAML storage (legacy)');
 * }
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
  extracted_concepts?: MissionConcept[]; // Mission concepts (v1/v2)
  extracted_knowledge?: MissionConcept[]; // Security guidelines (v1/v2)
  extracted_patterns?: MissionConcept[]; // Operational patterns (v1/v2)
  extracted_statements?: MissionConcept[]; // Mathematical proofs (v1/v2)
  mission_concepts?: MissionConcept[]; // Alternative name (legacy)
  security_concepts?: MissionConcept[]; // Alternative name (legacy)
  operational_patterns?: MissionConcept[]; // Alternative name (legacy)
  mathematical_proofs?: MissionConcept[]; // Alternative name (legacy)
  coherence_links?: MissionConcept[]; // Coherence overlay
  knowledge?: MissionConcept[]; // Fallback for mathematical proofs
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
    // V2 format with lancedb_metadata: Load from DocumentLanceStore (old migration path)
    if (overlayData.format_version === 2 && overlayData.lancedb_metadata) {
      return this.loadFromLanceDB(overlayData, pgcRoot);
    }

    // V2 format without lancedb_metadata: Load from pattern tables (new generation path)
    if (overlayData.format_version === 2) {
      return this.loadFromPatternTables(overlayData, pgcRoot);
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
   * Load embeddings from pattern tables (v2 format without lancedb_metadata)
   * Used for overlays generated with the new pattern table architecture
   */
  private async loadFromPatternTables(
    overlayData: OverlayData,
    pgcRoot: string
  ): Promise<MissionConcept[]> {
    const { LanceVectorStore } =
      await import('../overlays/vector-db/lance-store.js');

    // Determine table name based on overlay type
    const tableName = this.getTableNameForOverlay(overlayData);
    if (!tableName) {
      throw new Error(
        'Cannot determine pattern table name for v2 overlay (no recognized concept field)'
      );
    }

    const documentHash = overlayData.document_hash;
    if (!documentHash) {
      throw new Error('V2 overlay missing document_hash');
    }

    const lanceStore = new LanceVectorStore(pgcRoot);

    try {
      await lanceStore.initialize(tableName);

      // Get all vectors and filter by document_hash
      const allVectors = await lanceStore.getAllVectors();
      const documentVectors = allVectors.filter(
        (v) => v.document_hash === documentHash
      );

      await lanceStore.close();

      // Convert vector records to MissionConcept format
      return documentVectors.map((record) => ({
        text: record.semantic_signature as string,
        section: (record.architectural_role as string) || 'unknown',
        weight: 1.0,
        occurrences: 1,
        sectionHash: (record.structuralHash as string) || '',
        embedding: record.embedding,
      }));
    } catch (error) {
      await lanceStore.close();
      throw new Error(
        `Failed to load embeddings from pattern table ${tableName}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Determine which pattern table to use based on overlay data
   */
  private getTableNameForOverlay(overlayData: OverlayData): string | null {
    if (overlayData.extracted_concepts) {
      return 'mission_concepts';
    }
    if (overlayData.extracted_knowledge) {
      return 'security_guidelines';
    }
    if (overlayData.extracted_patterns) {
      return 'operational_patterns';
    }
    if (overlayData.extracted_statements) {
      return 'mathematical_proofs';
    }
    return null;
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
      'extracted_concepts', // Mission concepts (v1/v2)
      'extracted_knowledge', // Security guidelines (v1/v2)
      'extracted_patterns', // Operational patterns (v1/v2)
      'extracted_statements', // Mathematical proofs (v1/v2)
      'mission_concepts', // Alternative name (legacy)
      'security_concepts', // Alternative name (legacy)
      'operational_patterns', // Alternative name (legacy)
      'mathematical_proofs', // Alternative name (legacy)
      'coherence_links', // Coherence overlay
      'knowledge', // Fallback for mathematical proofs
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
