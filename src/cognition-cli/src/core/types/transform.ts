import { z } from 'zod';

/**
 * Transformation and Lineage Types
 *
 * Types for recording computational transformations with verifiable lineage.
 * Every transformation in the system is tracked from inputs through outputs
 * with goal-based verification and fidelity scoring.
 *
 * DESIGN:
 * Transformations are the atomic unit of provenance tracking:
 * - TransformData: Generic artifact structure for inputs/outputs
 * - GoalData: Objective and acceptance criteria for the transformation
 * - VerificationResult: Post-transformation validation outcome
 * - Transformation: Complete transformation record
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
 * const transform: Transformation = {
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
 */

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
export const GoalDataSchema = z.object({
  /** High-level description of what the transformation should achieve */
  objective: z.string(),
  /** Specific, measurable acceptance criteria */
  criteria: z.array(z.string()),
  /** Minimum acceptable fidelity score (0.0-1.0) */
  phimin: z.number(),
});
export type GoalData = z.infer<typeof GoalDataSchema>;

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
export const VerificationResultSchema = z.object({
  /** Whether verification succeeded or failed */
  status: z.enum(['Success', 'Failure']),
  /** Human-readable details about the verification outcome */
  details: z.string().optional(),
});
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

/**
 * Generic artifact data structure representing an input or output of a transformation.
 * Consolidates TransformInput and TransformOutput into a single generic type.
 *
 * Content hashing enables incremental recomputation and verification that
 * transformations are deterministic and haven't been tampered with.
 *
 * @template T - The type of optional associated data (e.g., StructuralData).
 *
 * @example
 * const artifact: TransformData = {
 *   path: '/src/database/schema.ts',
 *   hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
 * };
 */
export const TransformArtifactSchema = z.object({
  /** Absolute or workspace-relative path to the artifact file */
  path: z.string(),
  /** SHA-256 hash of the artifact content */
  hash: z.string(),
  /** Optional associated data or metadata */
  data: z.unknown().optional(),
});

/**
 * TransformData represents a single artifact (input or output) in a transformation.
 * (Consolidated from TransformInput and TransformOutput per structural-refactoring.md)
 */
export type TransformData<T = unknown> = z.infer<
  typeof TransformArtifactSchema
> & {
  data?: T;
};

/** Backward compatibility aliases for TransformInput and TransformOutput */
export type TransformInput<T = unknown> = TransformData<T>;
export type TransformOutput<T = unknown> = TransformData<T>;

/**
 * Complete transformation record with inputs, outputs, and verification data.
 * Renamed from TransformData to Transformation to avoid collision with generic artifact type.
 *
 * Transformation is stored in the lineage graph to enable:
 * - Provenance queries: "What transformations produced this artifact?"
 * - Impact analysis: "What outputs need recomputation if this input changes?"
 * - Quality auditing: "Which transformations fell below phimin threshold?"
 */
export const TransformationSchema = z.object({
  /** The goal this transformation was trying to achieve */
  goal: GoalDataSchema,
  /** Achieved fidelity score (0.0-1.0), should be >= goal.phimin */
  phi: z.number(),
  /** Verification outcome indicating success or failure */
  verification_result: VerificationResultSchema,
  /** Input artifacts consumed by this transformation */
  inputs: z.array(TransformArtifactSchema),
  /** Output artifacts produced by this transformation */
  outputs: z.array(TransformArtifactSchema),
  /** Method used for transformation (e.g., 'ast_native', 'llm_supervised') */
  method: z.string().optional(),
  /** Redundant with phi, kept for backward compatibility */
  fidelity: z.number().optional(),
});

/**
 * Transformation represents the complete record of a computational step.
 */
export type Transformation = z.infer<typeof TransformationSchema>;

/** Alias for Transformation record to support legacy naming if needed */
export type TransformationRecord = Transformation;
