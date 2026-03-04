import { MathematicalKnowledge } from '../../analyzers/document-extractor.js';
import { OverlayMetadata } from '../../algebra/overlay-algebra.js';

/**
 * Mathematical Proofs Overlay (O₆) - FORMAL REASONING
 */
export interface MathematicalProofsOverlay {
  document_hash: string; // Content hash of source document
  document_path: string; // Path to source markdown file
  extracted_statements: MathematicalKnowledge[]; // Theorems, proofs, etc.
  generated_at: string; // ISO timestamp
  transform_id: string; // Transform that generated this overlay
  format_version?: number; // 2 = embeddings in LanceDB, 1 or undefined = embeddings in YAML
}

/**
 * Metadata for mathematical overlay items
 */
export interface MathematicalMetadata extends OverlayMetadata {
  text: string;
  statementType:
    | 'theorem'
    | 'lemma'
    | 'axiom'
    | 'corollary'
    | 'proof'
    | 'identity'
    | 'invariant'
    | 'complexity';
  weight: number;
  occurrences: number;
  section: string;
  sectionHash: string;
  documentHash: string;
  proofSteps?: string[];
  dependencies?: string[];
  formalNotation?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  enforcement?: string;
  violations?: string[];
}
