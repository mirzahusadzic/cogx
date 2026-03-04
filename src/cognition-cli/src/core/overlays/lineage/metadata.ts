import { OverlayMetadata } from '../../algebra/overlay-algebra.js';

/**
 * Metadata for lineage overlay items (O₃)
 *
 * Adapter for O₃ Lineage overlay to implement OverlayAlgebra interface.
 * Lineage data is stored in:
 * - LanceDB table: 'lineage_patterns' (embeddings)
 * - PGC overlays: 'lineage_patterns' (metadata)
 *
 * This adapter combines both sources to provide unified access.
 */
export interface LineageMetadata extends OverlayMetadata {
  text: string; // Lineage signature (for queries)
  symbol: string; // Symbol name
  symbolType: 'class' | 'function' | 'interface' | 'type'; // Symbol type
  anchor: string; // File path anchor
  lineageHash: string; // Dependency graph hash
  embeddingHash: string; // Embedding hash
  lineageSignature: string; // Human-readable dependency signature
  computedAt: string; // ISO timestamp
  vectorId: string; // Vector DB ID
}
