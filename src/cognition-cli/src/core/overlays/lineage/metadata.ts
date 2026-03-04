import { OverlayMetadata } from '../../algebra/overlay-algebra.js';

/**
 * Metadata for lineage overlay items (O₃)
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
