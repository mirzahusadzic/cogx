/**
 * Oracle Types - External validation via eGemma
 *
 * The Oracle is an external AI (eGemma) that evaluates transform quality
 * using the AAA framework:
 * - Accuracy: Did we achieve the intent?
 * - Efficiency: Was it done optimally?
 * - Adaptability: Can it handle change?
 *
 * REFERENCE: docs/manual/part-5-cpow-loop/20-cpow-reference.md (Phase 2: Oracle Validation)
 */

import type { CodebaseState } from './quest.js';
import type { Transform } from './transform.js';

/**
 * Lightweight snapshot of codebase state for Oracle evaluation
 *
 * Sent to Oracle instead of full CodebaseState to reduce payload size
 * and API costs. Contains only essential metrics for quality assessment.
 */
export interface StateSnapshot {
  /** Overall coherence score */
  coherence: number;

  /** Number of files in codebase */
  file_count: number;

  /** Number of symbols (functions, classes, etc.) */
  symbols_count: number;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Optional: Top N symbols by centrality/importance */
  top_symbols?: Array<{
    name: string;
    kind: string;
    coherence: number;
  }>;
}

/**
 * Summary of a transform for Oracle evaluation
 *
 * Lightweight representation sent to Oracle, focusing on the
 * "what" and "why" rather than detailed file contents.
 */
export interface TransformSummary {
  /** Transform identifier */
  transform_id: string;

  /** Type of modification */
  type: 'create' | 'modify' | 'delete' | 'refactor';

  /** File paths affected */
  files_affected: string[];

  /** Rationale for this transform */
  rationale: string;

  /** Expected impact on coherence */
  expected_coherence_delta?: number;
}

/**
 * Request sent to Oracle for transform evaluation
 *
 * @example
 * const request: OracleRequest = {
 *   quest_id: 'quest-001',
 *   quest_intent: 'Implement JWT authentication',
 *   transform_id: 'transform-abc',
 *   before_state: { coherence: 0.62, file_count: 42, ... },
 *   after_state: { coherence: 0.65, file_count: 45, ... },
 *   transform: { type: 'create', files_affected: ['src/auth/jwt.ts'], ... }
 * };
 */
export interface OracleRequest {
  /** Quest identifier for context */
  quest_id: string;

  /** Original user intent */
  quest_intent: string;

  /** Transform being evaluated */
  transform_id: string;

  /** Codebase state before transform */
  before_state: StateSnapshot;

  /** Codebase state after transform */
  after_state: StateSnapshot;

  /** Transform summary */
  transform: TransformSummary;

  /** Optional: Security level for stricter evaluation */
  security_level?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Response from Oracle evaluation
 *
 * Oracle evaluates transforms using the AAA framework:
 * - Accuracy: Correctness and alignment with requirements
 * - Efficiency: Performance and resource utilization
 * - Adaptability: Maintainability and extensibility
 *
 * Overall score is weighted average: 0.5 * accuracy + 0.3 * efficiency + 0.2 * adaptability
 *
 * @example
 * const response: OracleResponse = {
 *   score: 0.78,
 *   feedback: {
 *     accuracy: 0.85,
 *     efficiency: 0.70,
 *     adaptability: 0.80,
 *     suggestions: [
 *       'Consider adding input validation',
 *       'Use constant-time comparison for passwords'
 *     ]
 *   },
 *   session_id: 'oracle-session-123',
 *   timestamp: '2025-10-30T14:33:22Z',
 *   accepted: true
 * };
 */
export interface OracleResponse {
  /** Overall quality score (0.0 - 1.0) */
  score: number;

  /** Detailed feedback using AAA framework */
  feedback: {
    /** Accuracy: Did transform achieve intent? (0.0 - 1.0) */
    accuracy: number;

    /** Efficiency: Was it done optimally? (0.0 - 1.0) */
    efficiency: number;

    /** Adaptability: Can it handle change? (0.0 - 1.0) */
    adaptability: number;

    /** Suggestions for improvement */
    suggestions: string[];
  };

  /** Oracle session identifier for provenance */
  session_id: string;

  /** ISO 8601 timestamp of evaluation */
  timestamp: string;

  /** Whether transform was accepted (score >= acceptance threshold) */
  accepted?: boolean;

  /** HMAC signature for verification (prevents tampering) */
  signature?: string;
}

/**
 * Options for evaluating a transform with Oracle
 *
 * @example
 * const options: EvaluateTransformOptions = {
 *   quest: quest,
 *   beforeState: beforeState,
 *   afterState: afterState,
 *   transform: transform,
 *   oracleEndpoint: 'http://localhost:8000/validate',
 *   timeout: 30000,
 *   acceptanceThreshold: 0.6
 * };
 */
export interface EvaluateTransformOptions {
  /** Quest context */
  quest: {
    quest_id: string;
    intent: string;
    security_level?: 'low' | 'medium' | 'high' | 'critical';
  };

  /** Codebase state before transform */
  beforeState: CodebaseState;

  /** Codebase state after transform */
  afterState: CodebaseState;

  /** Transform being evaluated */
  transform: Transform;

  /** Oracle endpoint URL (default: WORKBENCH_URL env var) */
  oracleEndpoint?: string;

  /** Request timeout in milliseconds (default: 30000ms) */
  timeout?: number;

  /** Minimum score for acceptance (default: 0.6) */
  acceptanceThreshold?: number;

  /** AAA weights (default: accuracy=0.5, efficiency=0.3, adaptability=0.2) */
  weights?: {
    accuracy: number;
    efficiency: number;
    adaptability: number;
  };
}

/**
 * Error thrown when Oracle evaluation fails
 */
export class OracleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'OracleError';
  }
}

/**
 * Error thrown when Oracle request times out
 */
export class OracleTimeoutError extends OracleError {
  constructor(timeout: number) {
    super(
      `Oracle request timed out after ${timeout}ms`,
      'ORACLE_TIMEOUT'
    );
    this.name = 'OracleTimeoutError';
  }
}

/**
 * Error thrown when Oracle returns invalid response
 */
export class OracleInvalidResponseError extends OracleError {
  constructor(message: string, response?: any) {
    super(
      message,
      'ORACLE_INVALID_RESPONSE',
      response
    );
    this.name = 'OracleInvalidResponseError';
  }
}

/**
 * Utility: Create StateSnapshot from CodebaseState
 *
 * @param state - Full codebase state
 * @param topN - Number of top symbols to include (default: 10)
 * @returns Lightweight snapshot for Oracle
 */
export function createStateSnapshot(
  state: CodebaseState,
  topN: number = 10
): StateSnapshot {
  // Sort symbols by coherence (descending) and take top N
  const topSymbols = state.symbols
    .filter(s => s.coherence !== undefined)
    .sort((a, b) => (b.coherence || 0) - (a.coherence || 0))
    .slice(0, topN)
    .map(s => ({
      name: s.name,
      kind: s.kind,
      coherence: s.coherence || 0
    }));

  return {
    coherence: state.coherence,
    file_count: state.file_count || 0,
    symbols_count: state.symbols.length,
    timestamp: state.timestamp,
    top_symbols: topSymbols
  };
}

/**
 * Utility: Create TransformSummary from Transform
 *
 * @param transform - Full transform object
 * @returns Lightweight summary for Oracle
 */
export function createTransformSummary(
  transform: Transform
): TransformSummary {
  return {
    transform_id: transform.transform_id || `transform-${Date.now()}`,
    type: transform.transform_type,
    files_affected: transform.files_affected,
    rationale: transform.rationale
  };
}
