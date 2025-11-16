/**
 * cPOW Types - Cognitive Proof of Work data structures
 *
 * cPOW (Cognitive Proof of Work) is an immutable computational receipt that proves:
 * 1. Work was performed (Quest execution)
 * 2. Oracle validated quality (eGemma validation)
 * 3. Wisdom extracted (high AQS → CoMP patterns)
 * 4. Provenance tracked (commit hash, lineage)
 *
 * REFERENCE: docs/manual/part-5-cpow-loop/20-cpow-reference.md
 */

import type { Transform } from '../types/transform.js';
import type { OracleResponse } from '../types/oracle.js';
import type { CodebaseState } from '../types/quest.js';

// ============================================================================
// cPOW (Cognitive Proof of Work)
// ============================================================================

/**
 * cPOW - Immutable computational receipt
 *
 * Cryptographic proof that work was done, validated, and committed.
 * Stored in `.open_cognition/pgc/cpow/<cpow_id>.json`.
 *
 * KEY PROPERTIES:
 * - Immutability: Once committed, cannot be altered
 * - Verifiability: Checksums and Oracle signatures ensure authenticity
 * - Composability: cPOWs reference each other, forming wisdom graphs
 * - Incentive Alignment: High AQS produces reusable wisdom (CoMP)
 *
 * @example
 * const cpow: CPOW = {
 *   cpow_id: 'cpow_q_2025_10_30_001',
 *   quest_id: 'q_2025_10_30_001',
 *   intent: 'Implement JWT authentication',
 *   timestamp_start: '2025-10-30T14:32:11Z',
 *   timestamp_end: '2025-10-30T14:45:00Z',
 *   duration_minutes: 13,
 *   commit_sha: 'abc123def456',
 *   before_state_hash: 'sha256:...',
 *   after_state_hash: 'sha256:...',
 *   transforms: [...],
 *   oracle_responses: [...],
 *   fltb_validation: { passed: true, ... },
 *   coherence: { before: 0.624, after: 0.654, delta: 0.030 }
 * };
 */
export interface CPOW {
  /** Unique cPOW identifier */
  cpow_id: string;

  /** Associated quest identifier */
  quest_id: string;

  /** Original user intent */
  intent: string;

  /** ISO 8601 timestamp when quest started */
  timestamp_start: string;

  /** ISO 8601 timestamp when quest completed */
  timestamp_end: string;

  /** Total duration in minutes */
  duration_minutes: number;

  /** Git commit SHA (immutable anchor) */
  commit_sha: string;

  /** SHA-256 hash of before state (for verification) */
  before_state_hash: string;

  /** SHA-256 hash of after state (for verification) */
  after_state_hash: string;

  /** All transforms applied during quest */
  transforms: Transform[];

  /** All Oracle evaluations */
  oracle_responses: OracleResponse[];

  /** F.L.T.B validation result */
  fltb_validation: FLTBResult; // From validation types

  /** Coherence metrics */
  coherence: {
    before: number;
    after: number;
    delta: number;
  };

  /** Agent/model that executed quest */
  agent?: string;

  /** Security level */
  security_level?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Options for generating a cPOW
 */
export interface CPOWOptions {
  /** Quest context */
  quest: {
    quest_id: string;
    intent: string;
    timestamp_start: string;
    security_level?: 'low' | 'medium' | 'high' | 'critical';
  };

  /** All transforms applied */
  transforms: Transform[];

  /** All Oracle responses */
  oracleResponses: OracleResponse[];

  /** F.L.T.B validation result */
  fltbResult: FLTBResult;

  /** Git commit SHA */
  commitSHA: string;

  /** Codebase state before quest */
  beforeState: CodebaseState;

  /** Codebase state after quest */
  afterState: CodebaseState;

  /** Agent/model identifier */
  agent?: string;
}

/**
 * F.L.T.B validation result from validation types
 * (Imported to avoid circular dependency, redefined here for clarity)
 */
export interface FLTBResult {
  /** Overall validation status */
  passed: boolean;

  /** Results for each layer */
  layers: {
    syntax: LayerResult;
    alignment: LayerResult;
    security: LayerResult;
    patterns: LayerResult;
  };

  /** Failure messages (if !passed) */
  failures: string[];
}

export interface LayerResult {
  /** Layer passed validation */
  passed: boolean;

  /** Detailed layer-specific information */
  details: Record<string, any>;
}

/**
 * Result of cPOW verification
 *
 * @example
 * const verification: VerificationResult = {
 *   valid: true,
 *   checks: {
 *     checksum_before: true,
 *     checksum_after: true,
 *     oracle_signature: true,
 *     transform_chain: true,
 *     commit_exists: true
 *   },
 *   errors: []
 * };
 */
export interface VerificationResult {
  /** Overall verification status */
  valid: boolean;

  /** Individual check results */
  checks: {
    /** Before state hash matches */
    checksum_before: boolean;

    /** After state hash matches */
    checksum_after: boolean;

    /** Oracle signatures are valid */
    oracle_signature: boolean;

    /** Transform chain is valid */
    transform_chain: boolean;

    /** Git commit exists */
    commit_exists: boolean;
  };

  /** Error messages (if !valid) */
  errors: string[];
}

// ============================================================================
// AQS (Agentic Quality Score)
// ============================================================================

/**
 * Options for computing AQS
 */
export interface AQSOptions {
  /** cPOW to score */
  cpow: CPOW;

  /** Expected transform count (for efficiency calculation) */
  expectedTransforms?: number;

  /** Custom weights for score components */
  weights?: {
    oracle: number;       // Default: 1.0
    coherence: number;    // Default: 0.2
    patternReuse: number; // Default: 0.15
    security: number;     // Default: 0.10
    efficiency: number;   // Default: 0.05
  };
}

/**
 * Agentic Quality Score result
 *
 * AQS measures quest execution quality:
 * - Efficiency: Few steps to achieve goal
 * - Accuracy: No Oracle failures
 * - Adaptability: Proactive improvements
 *
 * FORMULA:
 * AQS = ω_avg · (1 + bonus)
 *
 * where:
 *   ω_avg = average Oracle score
 *   bonus = coherence_bonus (0.2) +
 *           pattern_reuse_bonus (0.15) +
 *           security_bonus (0.10) +
 *           efficiency_bonus (0.05)
 *
 * GRADING:
 * - A (0.85 - 1.0): Exceptional - Eligible for CoMP distillation
 * - B (0.70 - 0.84): Good - Solid work, reusable patterns
 * - C (0.50 - 0.69): Acceptable - Met requirements
 * - D (0.30 - 0.49): Poor - Needs rework
 * - F (0.0 - 0.29): Failed - Did not meet basic requirements
 *
 * @example
 * const aqsResult: AQSResult = {
 *   aqs: 0.847,
 *   components: {
 *     oracle_avg: 0.78,
 *     bonus: 0.42,
 *     breakdown: {
 *       coherence_bonus: 0.30,
 *       pattern_reuse_bonus: 0.15,
 *       security_bonus: 0.10,
 *       efficiency_bonus: 0.04
 *     }
 *   },
 *   grade: 'A',
 *   eligible_for_comp: true
 * };
 */
export interface AQSResult {
  /** Final AQS score (0.0 - 1.0+) */
  aqs: number;

  /** Score components */
  components: {
    /** Average Oracle score across transforms */
    oracle_avg: number;

    /** Total bonus from all factors */
    bonus: number;

    /** Breakdown of bonus components */
    breakdown: {
      /** Bonus from coherence improvement */
      coherence_bonus: number;

      /** Bonus from pattern reuse */
      pattern_reuse_bonus: number;

      /** Bonus from security enhancements */
      security_bonus: number;

      /** Bonus from efficiency */
      efficiency_bonus: number;
    };
  };

  /** Letter grade */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';

  /** Eligible for CoMP distillation (AQS >= 0.70) */
  eligible_for_comp: boolean;
}

// ============================================================================
// CoMP (Cognitive Micro-Tuning Payload)
// ============================================================================

/**
 * Compact transform representation for CoMP storage
 */
export interface CompactTransform {
  /** Step number in sequence */
  step: number;

  /** High-level action description */
  action: string;

  /** Rationale for this step */
  rationale: string;

  /** Files modified */
  files: string[];
}

/**
 * CoMP - Distilled wisdom from high-quality quests
 *
 * Generated when AQS >= 0.70. Stored in:
 * `.open_cognition/operational_patterns/comp/<comp_id>.json`
 *
 * CoMPs are indexed for semantic search and can be queried during
 * quest initialization to guide future work.
 *
 * @example
 * const comp: CoMP = {
 *   comp_id: 'comp_jwt_auth_2025_10_30',
 *   source_cpow: 'cpow_q_2025_10_30_001',
 *   aqs: 0.847,
 *   domain: 'authentication',
 *   pattern_name: 'JWT Authentication Flow',
 *   context: {
 *     intent_pattern: 'Implement token-based authentication',
 *     preconditions: ['User registration exists', 'Database ready'],
 *     postconditions: ['JWT tokens issued', 'Protected routes validate tokens']
 *   },
 *   transforms: [...],
 *   security_considerations: ['Use HTTPS', 'Token expiration', 'Rate limiting'],
 *   mission_alignment: { concepts: ['zero-trust'], coherence: 0.89 },
 *   reuse_count: 1,
 *   last_used: '2025-10-30T14:45:00Z'
 * };
 */
export interface CoMP {
  /** Unique CoMP identifier */
  comp_id: string;

  /** Source cPOW that generated this wisdom */
  source_cpow: string;

  /** AQS of source quest */
  aqs: number;

  /** Domain/category (e.g., "authentication", "database") */
  domain: string;

  /** Descriptive pattern name */
  pattern_name: string;

  /** Context for pattern applicability */
  context: {
    /** Intent pattern (generalized from original quest) */
    intent_pattern: string;

    /** Prerequisites for applying pattern */
    preconditions: string[];

    /** Expected outcomes after applying pattern */
    postconditions: string[];
  };

  /** Compact transform sequence */
  transforms: CompactTransform[];

  /** Security best practices */
  security_considerations: string[];

  /** Mission alignment metadata */
  mission_alignment: {
    /** Mission concepts this pattern aligns with */
    concepts: string[];

    /** Coherence score */
    coherence: number;
  };

  /** Number of times pattern has been reused */
  reuse_count: number;

  /** ISO 8601 timestamp of last use */
  last_used: string;

  /** Optional tags for discoverability */
  tags?: string[];

  /** Optional related pattern IDs */
  related_patterns?: string[];
}

/**
 * Options for wisdom distillation
 */
export interface WisdomOptions {
  /** cPOW to distill wisdom from */
  cpow: CPOW;

  /** AQS result */
  aqs: AQSResult;

  /** Minimum coherence for pattern inclusion (default: 0.7) */
  minCoherence?: number;

  /** Minimum pattern reuse count for inclusion (default: 3) */
  minReuse?: number;

  /** Domain/category override */
  domain?: string;
}

/**
 * Options for querying patterns
 *
 * @example
 * const query: PatternQuery = {
 *   intent: 'implement OAuth authentication',
 *   minAQS: 0.8,
 *   domain: 'authentication',
 *   limit: 5
 * };
 */
export interface PatternQuery {
  /** Natural language intent to match */
  intent: string;

  /** Minimum AQS threshold (default: 0.7) */
  minAQS?: number;

  /** Filter by domain */
  domain?: string;

  /** Maximum number of results (default: 10) */
  limit?: number;

  /** Optional tags to filter by */
  tags?: string[];
}
