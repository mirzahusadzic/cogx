/**
 * Transformation and Lineage Types
 *
 * Types for recording computational transformations with verifiable lineage.
 * Every transformation in the system is tracked from inputs through outputs
 * with goal-based verification and fidelity scoring.
 *
 * DESIGN:
 * Transformations are the atomic unit of provenance tracking:
 * - TransformInput: Source artifacts with content hashing
 * - TransformOutput: Generated artifacts with content hashing
 * - GoalData: Objective and acceptance criteria for the transformation
 * - VerificationResult: Post-transformation validation outcome
 * - TransformData: Complete transformation record
 *
 * The system supports:
 * 1. Lineage tracking: Trace any artifact back to source code
 * 2. Incremental recomputation: Skip transforms if inputs unchanged
 * 3. Quality verification: Ensure outputs meet acceptance criteria
 * 4. Fidelity scoring: Quantify transformation quality (phi)
 *
 * Transformations form a DAG (directed acyclic graph) where each node
 * represents a computational step with verifiable inputs and outputs.
 *
 * @example
 * // Document an AST extraction transformation
 * const transform: TransformData = {
 *   goal: {
 *     objective: 'Extract structural metadata from TypeScript file',
 *     criteria: [
 *       'All exported functions captured',
 *       'Type signatures preserved',
 *       'JSDoc comments extracted'
 *     ],
 *     phimin: 0.95
 *   },
 *   phi: 0.98,
 *   verification_result: {
 *     status: 'Success',
 *     details: 'All criteria met, 42 functions extracted'
 *   },
 *   inputs: [
 *     { path: '/src/auth/handler.ts', hash: 'abc123...' }
 *   ],
 *   outputs: [
 *     { path: '.pgc/structural/handler.json', hash: 'def456...' }
 *   ],
 *   method: 'ast_native',
 *   fidelity: 0.98
 * };
 *
 * @example
 * // Document an overlay ingestion transformation
 * const overlayTransform: TransformData = {
 *   goal: {
 *     objective: 'Ingest security guidelines into O2 overlay',
 *     criteria: [
 *       'All constraints embedded',
 *       'Vector similarity > 0.7 for related guidelines',
 *       'Mission alignment verified'
 *     ],
 *     phimin: 0.90
 *   },
 *   phi: 0.94,
 *   verification_result: {
 *     status: 'Success',
 *     details: '23 guidelines ingested, 18 aligned with mission'
 *   },
 *   inputs: [
 *     { path: 'docs/security/guidelines.md', hash: 'ghi789...' }
 *   ],
 *   outputs: [
 *     { path: '.pgc/patterns.lancedb/security_guidelines.lance', hash: 'jkl012...' }
 *   ],
 *   method: 'llm_supervised',
 *   fidelity: 0.94
 * };
 */

/**
 * Input artifact consumed by a transformation.
 *
 * Content hashing enables incremental recomputation: if the input hash
 * matches a previous transformation, the output can be reused.
 *
 * @example
 * const input: TransformInput = {
 *   path: '/src/database/schema.ts',
 *   hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
 * };
 */
export interface TransformInput {
  /** Absolute or workspace-relative path to input file */
  path: string;
  /** SHA-256 hash of input content */
  hash: string;
}

/**
 * Output artifact produced by a transformation.
 *
 * Output hashing enables verification that the transformation is deterministic
 * and that outputs haven't been tampered with.
 *
 * @example
 * const output: TransformOutput = {
 *   path: '.pgc/structural/schema.json',
 *   hash: '5f7b9d8a2c1e3f4a6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a'
 * };
 */
export interface TransformOutput {
  /** Absolute or workspace-relative path to output file */
  path: string;
  /** SHA-256 hash of output content */
  hash: string;
}

/**
 * Outcome of a transformation verification check.
 *
 * Verification validates that the transformation achieved its goal
 * according to predefined acceptance criteria.
 *
 * @example
 * const result: VerificationResult = {
 *   status: 'Success',
 *   details: 'Extracted 156 functions, 42 classes, 23 interfaces'
 * };
 *
 * @example
 * const failure: VerificationResult = {
 *   status: 'Failure',
 *   details: 'Parse error: Unexpected token at line 142'
 * };
 */
export interface VerificationResult {
  /** Whether verification succeeded or failed */
  status: 'Success' | 'Failure';
  /** Human-readable details about the verification outcome */
  details?: string;
}

/**
 * Objective and acceptance criteria for a transformation.
 *
 * Goals define what the transformation should achieve and how to measure success.
 * The phimin threshold ensures a minimum quality bar for outputs.
 *
 * @example
 * const goal: GoalData = {
 *   objective: 'Generate semantic embeddings for mission alignment',
 *   criteria: [
 *     'All docstrings embedded',
 *     'Embedding dimension = 768',
 *     'Similarity with mission principles > 0.6'
 *   ],
 *   phimin: 0.85
 * };
 */
export interface GoalData {
  /** High-level description of what the transformation should achieve */
  objective: string;
  /** Specific, measurable acceptance criteria */
  criteria: string[];
  /** Minimum acceptable fidelity score (0.0-1.0) */
  phimin: number;
}

/**
 * Complete transformation record with inputs, outputs, and verification data.
 *
 * TransformData is stored in the lineage graph to enable:
 * - Provenance queries: "What transformations produced this artifact?"
 * - Impact analysis: "What outputs need recomputation if this input changes?"
 * - Quality auditing: "Which transformations fell below phimin threshold?"
 *
 * The optional fidelity and method fields provide additional metadata
 * for debugging and quality monitoring.
 *
 * @example
 * const transform: TransformData = {
 *   goal: {
 *     objective: 'Extract structural patterns for similarity search',
 *     criteria: [
 *       'Function signatures normalized',
 *       'Type information preserved',
 *       'Embeddings generated'
 *     ],
 *     phimin: 0.90
 *   },
 *   phi: 0.95,
 *   verification_result: {
 *     status: 'Success',
 *     details: '87 patterns extracted and embedded'
 *   },
 *   inputs: [
 *     { path: '/src/api/routes.ts', hash: 'abc...' },
 *     { path: '/src/api/middleware.ts', hash: 'def...' }
 *   ],
 *   outputs: [
 *     { path: '.pgc/structural/routes.json', hash: 'ghi...' },
 *     { path: '.pgc/structural/middleware.json', hash: 'jkl...' }
 *   ],
 *   method: 'ast_native',
 *   fidelity: 0.95
 * };
 */
export interface TransformData {
  /** The goal this transformation was trying to achieve */
  goal: GoalData;
  /** Achieved fidelity score (0.0-1.0), should be >= goal.phimin */
  phi: number;
  /** Verification outcome indicating success or failure */
  verification_result: VerificationResult;
  /** Input artifacts consumed by this transformation */
  inputs: TransformInput[];
  /** Output artifacts produced by this transformation */
  outputs: TransformOutput[];
  /** Method used for transformation (e.g., 'ast_native', 'llm_supervised') */
  method?: string;
  /** Redundant with phi, kept for backward compatibility */
  fidelity?: number;
}
