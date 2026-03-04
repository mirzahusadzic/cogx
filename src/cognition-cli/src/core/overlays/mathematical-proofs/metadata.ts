import { MathematicalKnowledge } from '../../analyzers/document-extractor.js';
import { OverlayMetadata } from '../../algebra/overlay-algebra.js';

/**
 * Mathematical Proofs Overlay (O₆) - FORMAL REASONING
 *
 * Stores extracted mathematical statements and proofs.
 * This overlay captures formal properties, theorems, and proofs
 * from mathematical/formal documents (THEORY.md, proofs, etc.).
 *
 * LATTICE POSITION: O₆ (Formal/Mathematical)
 * - Echo's domain: Formal properties and reasoning
 * - Complements mission (O₄): Formal foundations for vision
 * - Supports coherence (O₇): Proves correctness properties
 *
 * STATEMENT TYPES:
 * - theorem: Formal statements with proofs
 * - lemma: Supporting propositions
 * - axiom: Foundational truths
 * - corollary: Derived results
 * - proof: Step-by-step derivations
 * - identity: Mathematical equalities/invariants
 *
 * USE CASES:
 * - Invariant reasoning: "What theorems relate to lattice coherence?"
 * - Property verification: "Does this code satisfy the theorem?"
 * - Formal queries: "What are the axioms of our system?"
 * - Proof discovery: "What lemmas support this property?"
 *
 * EMBEDDINGS:
 * - Each statement has a 768-dimensional vector from eGemma
 * - Enables semantic search over formal knowledge
 * - Supports queries like: "What proofs relate to monotonicity?"
 *
 * DESIGN RATIONALE:
 * - Formal foundations: Mathematical basis for system
 * - Queryable: Natural language queries over formal knowledge
 * - Provenance: Track which documents define each theorem
 * - Evolution: Track how formal properties evolve
 *
 * FUTURE VISION:
 * - Formal verification of code properties
 * - Automatic theorem application to code
 * - Proof-guided optimization and refactoring
 * - Integration with proof assistants (Coq, Lean, etc.)
 *
 * STORAGE:
 * - YAML: .open_cognition/overlays/mathematical_proofs/<doc_hash>.yaml
 * - LanceDB: .open_cognition/lance/documents.lancedb (overlay_type='O6')
 *
 * @example
 * // Query mathematical statements semantically
 * const manager = new MathematicalProofsManager(pgcRoot);
 * const results = await manager.query('lattice monotonicity', 5);
 *
 * @example
 * // Get all axioms (foundational truths)
 * const axioms = await manager.getAxioms();
 *
 * @example
 * // Find theorems by type
 * const theorems = await manager.getStatementsByType('theorem');
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
