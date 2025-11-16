/**
 * Quest Types - Core data structures for Quest execution
 *
 * Quest: Unit of development work with intent, transforms, and validation
 * CodebaseState: Snapshot of codebase at a point in time
 * Pattern: Reusable wisdom from previous quests
 *
 * These types support the cPOW operational loop (Phase 1: Quest Initialization).
 *
 * REFERENCE: docs/manual/part-5-cpow-loop/20-cpow-reference.md
 */

/**
 * Coherence metrics from O₇ (Strategic Coherence overlay)
 *
 * Measures alignment between code symbols and organizational mission.
 * Higher scores indicate better mission alignment.
 */
export interface CoherenceMetrics {
  /** Average coherence across all symbols (equal-weighted) */
  mean: number;

  /** Median coherence (50th percentile) */
  median: number;

  /** Standard deviation of coherence distribution */
  stddev: number;

  /** Threshold for high alignment (typically top quartile) */
  high_alignment_threshold: number;

  /** Threshold for drift detection (typically bottom quartile) */
  drift_threshold: number;

  /** Total number of symbols analyzed */
  symbol_count: number;
}

/**
 * Reusable pattern from previous quests
 *
 * Patterns are stored in O₅ (Operational Patterns) and can be queried
 * during quest initialization to guide transform generation.
 */
export interface Pattern {
  /** Pattern name (e.g., "JWT Authentication Flow") */
  name: string;

  /** Coherence score when pattern was extracted */
  coherence: number;

  /** File path to pattern definition */
  path: string;

  /** Agentic Quality Score (if from CoMP) */
  aqs?: number;

  /** Domain/category (e.g., "authentication", "database") */
  domain?: string;
}

/**
 * Quest object representing a unit of development work
 *
 * A Quest is initialized from user intent and guides the G→T→O feedback loop.
 * It captures baseline metrics, relevant context, and success criteria.
 *
 * LIFECYCLE:
 * 1. Initialized via questInit()
 * 2. Executed via G→T→O loop
 * 3. Validated via F.L.T.B
 * 4. Committed to git
 * 5. Finalized with cPOW generation
 *
 * @example
 * const quest: Quest = {
 *   quest_id: 'quest-001',
 *   intent: 'Implement user authentication with JWT',
 *   baseline_coherence: { mean: 0.624, ... },
 *   mission_concepts: ['zero-trust', 'least-privilege'],
 *   relevant_patterns: [{ name: 'JWT Auth Flow', coherence: 0.89, ... }],
 *   security_requirements: ['Token expiration', 'Secure key storage'],
 *   timestamp_start: '2025-10-30T14:32:11Z',
 *   security_level: 'high'
 * };
 */
export interface Quest {
  /** Unique quest identifier (e.g., 'quest-001', 'q_2025_10_30_001') */
  quest_id: string;

  /** Natural language description of user intent */
  intent: string;

  /** Baseline coherence snapshot from O₇ at quest start */
  baseline_coherence: CoherenceMetrics;

  /** Relevant mission concepts from O₄ (Mission Concepts overlay) */
  mission_concepts: string[];

  /** Relevant patterns from O₅ for reuse */
  relevant_patterns: Pattern[];

  /** Security requirements from O₂ (Security Guidelines overlay) */
  security_requirements: string[];

  /** ISO 8601 timestamp when quest started */
  timestamp_start: string;

  /** Security level for validation strictness */
  security_level?: 'low' | 'medium' | 'high' | 'critical';

  /** Root directory of the project */
  project_path?: string;
}

/**
 * Options for initializing a new quest
 *
 * @example
 * const options: QuestInitOptions = {
 *   intent: 'Add pagination to user list API',
 *   projectPath: '/home/user/myapp',
 *   securityLevel: 'medium'
 * };
 */
export interface QuestInitOptions {
  /** Natural language description of what to build/fix */
  intent: string;

  /** Absolute path to project root */
  projectPath: string;

  /** Optional paths to mission documents (default: use O₄ overlay) */
  missionDocs?: string[];

  /** Security validation level (default: 'medium') */
  securityLevel?: 'low' | 'medium' | 'high' | 'critical';

  /** Oracle endpoint URL (default: process.env.WORKBENCH_URL) */
  oracleEndpoint?: string;
}

/**
 * Symbol metadata from O₁ (Structural Patterns overlay)
 *
 * Represents a code symbol (function, class, interface, etc.) with
 * its structural metadata and coherence score.
 */
export interface Symbol {
  /** Symbol identifier (e.g., 'MyClass', 'myFunction') */
  name: string;

  /** Symbol kind (function, class, interface, type, etc.) */
  kind: string;

  /** File path where symbol is defined */
  file_path: string;

  /** Coherence score with mission concepts */
  coherence?: number;
}

/**
 * Snapshot of codebase state at a point in time
 *
 * Used to compute deltas before/after transforms and track
 * coherence drift during quest execution.
 *
 * @example
 * const beforeState: CodebaseState = {
 *   timestamp: '2025-10-30T14:32:00Z',
 *   coherence: 0.624,
 *   symbols: [...],
 *   commit_sha: 'abc123def456'
 * };
 */
export interface CodebaseState {
  /** ISO 8601 timestamp when state was captured */
  timestamp: string;

  /** Overall coherence score from O₇ */
  coherence: number;

  /** All symbols from O₁ (Structural Patterns) */
  symbols: Symbol[];

  /** Git commit SHA if state is committed (optional) */
  commit_sha?: string;

  /** Number of files in codebase */
  file_count?: number;

  /** Total lines of code */
  loc?: number;
}

/**
 * Options for generating a transform
 *
 * @example
 * const options: TransformOptions = {
 *   currentState: await captureState(),
 *   intent: 'Add JWT authentication',
 *   oracleFeedback: previousOracleResponse,
 *   constraints: ['Use existing crypto library']
 * };
 */
export interface TransformOptions {
  /** Current codebase state */
  currentState: CodebaseState;

  /** User intent or sub-goal */
  intent: string;

  /** Feedback from previous Oracle evaluation (for regeneration) */
  oracleFeedback?: any; // OracleResponse from oracle.ts

  /** Additional constraints or requirements */
  constraints?: string[];

  /** Relevant patterns to consider */
  patterns?: Pattern[];
}

/**
 * Result of quest execution
 *
 * Returned by executeQuest() with complete quest artifacts.
 *
 * @example
 * const result: QuestResult = {
 *   quest: quest,
 *   cpow: cpow,
 *   aqs: aqsResult,
 *   comp: comp  // Only if AQS >= 0.70
 * };
 */
export interface QuestResult {
  /** Quest object with metadata */
  quest: Quest;

  /** Generated cPOW receipt */
  cpow: any; // CPOW from cpow/types.ts

  /** Computed Agentic Quality Score */
  aqs: any; // AQSResult from cpow/types.ts

  /** Distilled wisdom (only if AQS >= 0.70) */
  comp?: any; // CoMP from cpow/types.ts

  /** Duration in minutes */
  duration_minutes?: number;

  /** Number of transforms applied */
  transforms_count?: number;
}
