import { OverlayMetadata } from '../../algebra/overlay-algebra.js';

/**
 * Metadata for structural pattern overlay items (O₁)
 */
export interface StructuralMetadata extends OverlayMetadata {
  text: string; // Symbol name (for semantic queries)
  symbol: string; // Symbol name (function, class, etc.)
  type: 'structural' | 'semantic'; // Embedding type
  structuralSignature: string; // class:X | methods:5
  semanticSignature: string; // docstring content
  architecturalRole: string; // service, model, controller, etc.
  filePath: string; // Source file path
  structuralHash: string; // Provenance hash
  lineageHash: string; // Lineage tracking hash
  computedAt: string; // ISO timestamp
}
