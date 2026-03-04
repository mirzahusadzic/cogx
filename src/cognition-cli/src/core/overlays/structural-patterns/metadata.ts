import { OverlayMetadata } from '../../algebra/overlay-algebra.js';

/**
 * Metadata for structural pattern overlay items (O₁)
 *
 * Manages O₁ Structure overlay - code artifacts with dual embeddings.
 * Data is stored in LanceDB vector store, not YAML files.
 *
 * THE SHADOW ARCHITECTURE (Monument 4.7):
 * - Structural embeddings: Pattern-based (class:X | methods:5)
 * - Semantic embeddings: Purpose-based (docstring + type)
 * - Mission alignment uses semantic embeddings
 * - Pattern matching uses structural embeddings
 *
 * OVERLAY DATA SOURCE:
 * - LanceDB table: 'structural_patterns'
 * - Created during genesis (monument generation)
 * - Contains both structural and semantic vectors
 *
 * SUPPORTED TYPES:
 * - Symbol types: function, class, interface, module, variable
 * - Architectural roles: service, model, controller, utility, config, test
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
