/**
 * Grounded Knowledge Element (GKe) Types
 *
 * Type definitions for grounded knowledge elements - the atomic units of
 * verifiable knowledge in the Grounded Context Pool (PGC).
 *
 * DESIGN:
 * Every piece of knowledge in the system is grounded in source artifacts:
 * - SourceRecord: Provenance metadata linking knowledge to verified sources
 * - GKe: Knowledge element with content, type, and lineage tracking
 * - Goal: Objective-driven transformation criteria
 * - Persona: Role-specific computational agents
 *
 * GROUNDING PRINCIPLE:
 * All knowledge must be traceable to source code or documentation through
 * a verifiable transformation chain. This prevents hallucination and ensures
 * that strategic guidance (overlays) remains aligned with actual codebase.
 *
 * GKe lifecycle:
 * 1. Source artifact ingested (raw_file)
 * 2. Transformed into structured form (structural_metadata, file_summary)
 * 3. Aggregated into overlays (overlay)
 * 4. Status tracked (Valid | Invalidated)
 * 5. Invalidated when source changes
 *
 * @example
 * // Raw source file ingested into PGC
 * const rawGKe: GKe = {
 *   content: sourceCode,
 *   type: 'raw_file',
 *   sr: {
 *     uri: '/src/auth/handler.ts',
 *     hash: 'abc123...',
 *     timestamp: new Date(),
 *     verified_by: 'file_watcher'
 *   },
 *   path: '/src/auth/handler.ts',
 *   status: 'Valid',
 *   history_ref: 'transform_def456'
 * };
 *
 * @example
 * // Structural metadata extracted from source
 * const structuralGKe: GKe = {
 *   content: JSON.stringify(structuralData),
 *   type: 'structural_metadata',
 *   sr: {
 *     uri: '/src/auth/handler.ts',
 *     hash: 'abc123...',
 *     timestamp: new Date(),
 *     verified_by: 'ast_parser'
 *   },
 *   path: '.pgc/structural/handler.json',
 *   status: 'Valid',
 *   history_ref: 'transform_ghi789'
 * };
 *
 * @example
 * // Security overlay ingested from markdown
 * const overlayGKe: GKe = {
 *   content: Buffer.from(embeddings),
 *   type: 'overlay',
 *   sr: {
 *     uri: 'docs/security/guidelines.md',
 *     hash: 'jkl012...',
 *     timestamp: new Date(),
 *     verified_by: 'overlay_ingestor'
 *   },
 *   path: '.pgc/patterns.lancedb/security_guidelines.lance',
 *   status: 'Valid',
 *   history_ref: 'transform_mno345'
 * };
 */

/**
 * Source record tracking the provenance of a source artifact.
 *
 * Every GKe maintains a source record that links it back to the
 * original artifact. This enables:
 * - Invalidation when source changes
 * - Lineage tracing for debugging
 * - Verification of transformation chains
 *
 * @example
 * const sourceRecord: SourceRecord = {
 *   uri: '/src/database/schema.ts',
 *   hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
 *   timestamp: new Date('2025-11-15T10:00:00Z'),
 *   verified_by: 'genesis_indexer'
 * };
 */
export interface SourceRecord {
  /** URI of the source artifact (file path or URL) */
  uri: string;
  /** SHA-256 hash of source content for integrity verification */
  hash: string;
  /** When this source was ingested/verified */
  timestamp: Date;
  /** System component that verified this source */
  verified_by: string;
}

/**
 * Grounded Knowledge Element (GKe) with content, type, and provenance tracking.
 *
 * GKe is the fundamental unit of knowledge in the PGC. Every GKe is:
 * - Grounded: Traceable to source artifact via SourceRecord
 * - Typed: Classified by processing stage (raw_file, structural_metadata, etc.)
 * - Tracked: Status indicates validity, history_ref links to transformation
 *
 * GKe types represent stages in the knowledge pipeline:
 * - raw_file: Original source code or documentation
 * - file_summary: LLM-generated summary of file purpose
 * - structural_metadata: AST-extracted classes, functions, types
 * - component: Higher-level architectural component
 * - overlay: Strategic guidance (mission, security, operational)
 *
 * @example
 * const gke: GKe = {
 *   content: structuralJSON,
 *   type: 'structural_metadata',
 *   sr: {
 *     uri: '/src/api/routes.ts',
 *     hash: 'abc123...',
 *     timestamp: new Date(),
 *     verified_by: 'ast_parser'
 *   },
 *   path: '.pgc/structural/routes.json',
 *   status: 'Valid',
 *   history_ref: 'transform_def456'
 * };
 */
export interface GKe {
  /** Content of the knowledge element (text or binary) */
  content: string | Buffer;
  /** Processing stage/type of this knowledge element */
  type:
    | 'raw_file'
    | 'file_summary'
    | 'component'
    | 'overlay'
    | 'structural_metadata';
  /** Source record linking to original artifact */
  sr: SourceRecord;
  /** File path where this GKe is stored in PGC */
  path: string;
  /** Validity status (invalidated when source changes) */
  status: 'Valid' | 'Invalidated';
  /** Reference to transformation that produced this GKe */
  history_ref: string; // transform hash
}

/**
 * Goal with objective, acceptance criteria, and minimum fidelity threshold.
 *
 * Goals guide transformations and enable verification that outputs
 * meet quality standards. The phimin threshold ensures a minimum
 * acceptable fidelity for the transformation.
 *
 * Optional weights allow fine-tuning of fidelity calculation across
 * different quality dimensions.
 *
 * @example
 * const goal: Goal = {
 *   objective: 'Extract security-critical operations from authentication module',
 *   criteria: [
 *     'All authentication functions identified',
 *     'Security constraints extracted from docstrings',
 *     'Input validation patterns captured'
 *   ],
 *   phimin: 0.90
 * };
 *
 * @example
 * const weightedGoal: Goal = {
 *   objective: 'Generate mission-aligned embeddings',
 *   criteria: [
 *     'Semantic signatures include docstrings',
 *     'Embeddings clustered by architectural role',
 *     'Similarity with mission principles > 0.6'
 *   ],
 *   phimin: 0.85,
 *   weights: {
 *     tools: 0.2,        // Tool correctness
 *     grounding: 0.5,    // Source fidelity
 *     goal_specific: 0.3 // Mission alignment
 *   }
 * };
 */
export interface Goal {
  /** High-level description of what should be achieved */
  objective: string;
  /** Specific, measurable acceptance criteria */
  criteria: string[];
  /** Minimum acceptable fidelity score (0.0-1.0) */
  phimin: number; // minimum acceptable fidelity
  /** Optional weights for fidelity calculation across quality dimensions */
  weights?: {
    tools?: number;
    grounding?: number;
    goal_specific?: number;
  };
}

/**
 * Computational agent with role-specific behavior and constraints.
 *
 * Personas define system prompts and constraints for LLM-based operations.
 * Different personas focus on different aspects of the codebase:
 * - developer: General-purpose code comprehension
 * - log_analyst: Runtime behavior and observability
 * - architect: System design and patterns
 * - structure_extractor: AST parsing and metadata extraction
 *
 * @example
 * const securityPersona: Persona = {
 *   name: 'security_analyst',
 *   type: 'architect',
 *   system_message: 'You are a security expert analyzing code for vulnerabilities...',
 *   constraints: [
 *     'Focus on authentication and authorization',
 *     'Identify input validation gaps',
 *     'Flag potential injection vectors'
 *   ]
 * };
 *
 * @example
 * const structurePersona: Persona = {
 *   name: 'typescript_extractor',
 *   type: 'structure_extractor',
 *   system_message: 'Extract structural metadata from TypeScript code...',
 *   constraints: [
 *     'Preserve full type signatures',
 *     'Extract JSDoc comments',
 *     'Identify exported symbols'
 *   ]
 * };
 */
export interface Persona {
  /** Identifier for this persona */
  name: string;
  /** Role category determining behavior */
  type: 'developer' | 'log_analyst' | 'architect' | 'structure_extractor';
  /** System prompt defining the persona's role and approach */
  system_message: string;
  /** Optional behavioral constraints or guidelines */
  constraints?: string[];
}
