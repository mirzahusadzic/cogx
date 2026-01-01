/**
 * PGC-Aware Delegation Protocol - Type Definitions
 *
 * Implements the schema defined in docs/plans/pgc-delegation-protocol.md
 * Enables grounded task delegation with evidence-based responses.
 *
 * @version 2.0
 * @author Cognition Team
 * @date 2025-12-23
 */

/**
 * Protocol Constants
 */
export const MAX_CITATION_COUNT = 10;
export const MAX_CITATION_LENGTH = 500;
export const CONFIDENCE_THRESHOLD_HIGH = 0.85;
export const CONFIDENCE_THRESHOLD_MEDIUM = 0.7;

/**
 * Overlay types in the Cognition Σ lattice system.
 */
export type OverlayType = 'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7';

/**
 * Overlay definitions:
 * - O1: Structural - AST, symbols, dependencies
 * - O2: Security - vulnerabilities, attack surface
 * - O3: Lineage - provenance, Git history
 * - O4: Mission - strategic alignment, concepts
 * - O5: Operational - workflows, procedures
 * - O6: Mathematical - formal properties, proofs
 * - O7: Coherence - cross-overlay synthesis
 */

/**
 * Strategy for how worker should approach the task.
 */
export type GroundingStrategy =
  | 'pgc_first'
  | 'pgc_verify'
  | 'pgc_cite'
  | 'none';

/**
 * Grounding strategy behaviors:
 * - pgc_first: Query PGC before proposing solution (complex features, refactoring)
 * - pgc_verify: Propose solution first, then verify against PGC (bug fixes, targeted changes)
 * - pgc_cite: Response must include citations but no strict query order (documentation, explanations)
 * - none: Free-form execution, no grounding required (simple tasks, legacy mode)
 */

/**
 * Analysis hint types for computational PGC analyses.
 * @experimental Phase 2 - Advanced analysis not required for v1
 */
export type AnalysisHintType =
  | 'blast_radius' // Impact analysis for symbol changes
  | 'security_impact' // Cross-overlay security risk assessment
  | 'dependency_check' // Structural dependency verification
  | 'algebra_query'; // Multi-overlay composition (e.g. O1 + O4)

/**
 * Computational hint for specific PGC analysis.
 * @experimental Phase 2
 */
export interface AnalysisHint {
  type: AnalysisHintType;
  target: string;
  options?: Record<string, unknown>;
}

/**
 * PGC Grounding Instructions for delegated tasks.
 * Optional field - if absent, worker executes in legacy mode (strategy: 'none').
 */
export interface GroundingInstructions {
  /**
   * Strategy for how worker should approach the task.
   */
  strategy: GroundingStrategy;

  /**
   * Computational hints for specific PGC analyses.
   * @experimental Phase 2 - Advanced analysis not required for v1
   */
  analysis_hints?: AnalysisHint[];

  /**
   * Overlay Algebra composition string (e.g. "O1 + O2", "O1 ∩ O4").
   * @experimental Phase 2 - Reserved for future semantic intersection
   */
  algebra_expression?: string;

  /**
   * Hints about which overlays are most relevant.
   * Helps worker focus lattice queries.
   */
  overlay_hints?: OverlayType[];

  /**
   * Semantic query hints for the worker's PGC.
   * Worker should run these queries before acting.
   */
  query_hints?: string[];

  /**
   * Whether response must include evidence citations.
   * Default: true if strategy is not 'none'
   */
  evidence_required?: boolean;
}

/**
 * Delegated task with optional PGC grounding instructions.
 * Extends the existing SigmaTaskUpdate delegation pattern.
 */
export interface DelegatedTask {
  /**
   * Unique task identifier.
   */
  id: string;

  /**
   * Task description (what needs to be done).
   */
  task: string;

  /**
   * Success criteria for task completion.
   * Used by manager to validate completion.
   */
  acceptance_criteria: string[];

  /**
   * Additional context for the worker.
   * Optional background information.
   */
  context?: string;

  /**
   * Optional PGC Grounding Instructions.
   * If absent, worker executes in legacy mode (strategy: 'none').
   */
  grounding?: GroundingInstructions;
}

/**
 * Grounding confidence level based on vector similarity.
 * - high: > 0.85 avg similarity
 * - medium: 0.7 - 0.85
 * - low: < 0.7
 */
export type GroundingConfidence = 'high' | 'medium' | 'low';

/**
 * Task completion status.
 */
export type TaskStatus = 'completed' | 'failed' | 'blocked';

/**
 * Citation from the PGC lattice.
 */
export interface Citation {
  /**
   * Which overlay this citation came from.
   */
  overlay: string;

  /**
   * Snippet content.
   * @limit Max 500 chars per citation. Use file_path for full context.
   */
  content: string;

  /**
   * How this citation is relevant to the task.
   */
  relevance: string;

  /**
   * File path for manager to read full context if needed.
   */
  file_path?: string;
}

/**
 * Grounding evidence included in task response.
 * Optional if grounding not requested.
 */
export interface GroundingEvidence {
  /**
   * Queries run against PGC.
   */
  queries_executed: string[];

  /**
   * Overlays consulted during task execution.
   */
  overlays_consulted: OverlayType[];

  /**
   * Key insights from lattice.
   * @limit Max 10 citations to prevent IPC bloat
   */
  citations: Citation[];

  /**
   * Confidence that response is grounded.
   * Computed by worker based on vector similarity.
   */
  grounding_confidence: GroundingConfidence;

  /**
   * Warnings about overlay availability or query failures.
   * Used for graceful degradation.
   */
  overlay_warnings?: string[];
}

/**
 * Task response from worker agent.
 */
export interface TaskResponse {
  /**
   * ID of the task this response is for.
   */
  task_id: string;

  /**
   * Task completion status.
   */
  status: TaskStatus;

  /**
   * Summary of what was done.
   */
  result: string;

  /**
   * Grounding evidence (optional if grounding not requested).
   */
  grounding_evidence?: GroundingEvidence;

  /**
   * Protocol version for feature detection.
   * - '1.0-legacy': No grounding support
   * - '2.0': Full grounding protocol support
   */
  protocol_version?: string;
}

/**
 * Agent scope metadata for topology discovery.
 * Recommended addition to AgentInfo interface (see AgentRegistry.ts).
 *
 * @see docs/plans/feedback-pgc-delegation-v2.md
 * Gemini2 recommendation: "Add a `scope` or `path` field to the `AgentInfo`
 * interface to enable lattice topology discovery"
 */
export interface AgentScopeMetadata {
  /**
   * Path or subsystem this agent owns (e.g., "drivers/net", "kernel/mm").
   * Used for fractal lattice topology discovery.
   */
  scope?: string;

  /**
   * Project path for cross-project delegation.
   */
  project_path?: string;
}

/**
 * Multi-hop query routing metadata.
 * Used to prevent infinite loops in transitive queries.
 */
export interface QueryRoutingMetadata {
  /**
   * Maximum number of hops allowed (default: 6).
   */
  max_hops?: number;

  /**
   * Set of visited agent IDs to prevent cycles.
   */
  visited_agents?: Set<string>;

  /**
   * Current hop count.
   */
  current_hop?: number;
}

/**
 * Helper function to compute grounding confidence from similarity scores.
 *
 * @param similarities Array of similarity scores (0-1 range)
 * @returns GroundingConfidence level
 */
export function computeGroundingConfidence(
  similarities: number[]
): GroundingConfidence {
  if (similarities.length === 0) return 'low';

  const avgSimilarity =
    similarities.reduce((sum, s) => sum + s, 0) / similarities.length;

  if (avgSimilarity > CONFIDENCE_THRESHOLD_HIGH) return 'high';
  if (avgSimilarity >= CONFIDENCE_THRESHOLD_MEDIUM) return 'medium';
  return 'low';
}

/**
 * Type guard to check if task uses grounding protocol.
 *
 * @param task DelegatedTask to check
 * @returns true if task has grounding instructions
 */
export function hasGroundingInstructions(
  task: DelegatedTask
): task is DelegatedTask & { grounding: GroundingInstructions } {
  return task.grounding !== undefined;
}

/**
 * Type guard to check if response includes grounding evidence.
 *
 * @param response TaskResponse to check
 * @returns true if response has grounding evidence
 */
export function hasGroundingEvidence(
  response: TaskResponse
): response is TaskResponse & { grounding_evidence: GroundingEvidence } {
  return response.grounding_evidence !== undefined;
}

/**
 * Validate that grounding evidence meets requirements.
 *
 * @param evidence GroundingEvidence to validate
 * @param requirements GroundingInstructions that were requested
 * @returns Validation errors, or empty array if valid
 */
export function validateGroundingEvidence(
  evidence: GroundingEvidence,
  requirements: GroundingInstructions
): string[] {
  const errors: string[] = [];

  // Check if evidence is required
  if (requirements.evidence_required !== false) {
    if (evidence.citations.length === 0) {
      errors.push('No citations provided despite evidence being required');
    }
  }

  // Check overlay hints alignment
  if (requirements.overlay_hints && requirements.overlay_hints.length > 0) {
    const consultedSet = new Set(evidence.overlays_consulted);
    const hasAnyRequiredOverlay = requirements.overlay_hints.some((hint) =>
      consultedSet.has(hint)
    );

    if (!hasAnyRequiredOverlay) {
      errors.push(
        `No overlays from hints consulted. Expected: ${requirements.overlay_hints.join(', ')}, Got: ${evidence.overlays_consulted.join(', ')}`
      );
    }
  }

  // Check query hints execution
  if (requirements.query_hints && requirements.query_hints.length > 0) {
    if (evidence.queries_executed.length === 0) {
      errors.push('No queries executed despite query hints provided');
    }
  }

  // Validate citation limits
  if (evidence.citations.length > MAX_CITATION_COUNT) {
    errors.push(
      `Too many citations: ${evidence.citations.length} (max ${MAX_CITATION_COUNT} allowed)`
    );
  }

  // Validate citation content length
  evidence.citations.forEach((citation, index) => {
    if (citation.content.length > MAX_CITATION_LENGTH) {
      errors.push(
        `Citation ${index + 1} content exceeds ${MAX_CITATION_LENGTH} chars (${citation.content.length} chars)`
      );
    }
  });

  return errors;
}

/**
 * Example usage for workers.
 *
 * @example
 * ```typescript
 * // Worker receives delegated task
 * const task: DelegatedTask = JSON.parse(message);
 *
 * // Check if grounding is required
 * if (!hasGroundingInstructions(task)) {
 *   // Execute in legacy mode
 *   return executeLegacyTask(task);
 * }
 *
 * // Execute with grounding
 * const pgcResults = await queryPGC(task.grounding.query_hints);
 * const similarities = pgcResults.flatMap(r => r.sources.map(s => s.similarity));
 *
 * const response: TaskResponse = {
 *   task_id: task.id,
 *   status: 'completed',
 *   result: 'Task completed successfully',
 *   grounding_evidence: {
 *     queries_executed: task.grounding.query_hints || [],
 *     overlays_consulted: ['O1', 'O3'],
 *     citations: pgcResults.flatMap(r =>
 *       r.sources.slice(0, 2).map(s => ({
 *         overlay: s.overlay,
 *         content: s.text.slice(0, 500),
 *         relevance: 'Used to inform implementation',
 *         file_path: s.file_path,
 *       }))
 *     ).slice(0, 10),
 *     grounding_confidence: computeGroundingConfidence(similarities),
 *   },
 *   protocol_version: '2.0',
 * };
 *
 * // Validate before sending
 * const errors = validateGroundingEvidence(
 *   response.grounding_evidence!,
 *   task.grounding
 * );
 * if (errors.length > 0) {
 *   systemLog('ipc', 'Grounding validation failed', { errors }, 'error');
 * }
 * ```
 */
