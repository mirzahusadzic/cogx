/**
 * Semantic Drift Detector - Mission Poisoning Defense System
 *
 * Analyzes semantic changes between mission document versions using embedding-based
 * distance metrics and pattern-based heuristics. Detects gradual mission poisoning
 * attacks through 6 documented attack patterns.
 *
 * MISSION ALIGNMENT:
 * - Embodies "Verification Over Trust" principle (VISION.md:122, 74.3% importance)
 * - Implements "Oracle Validation" pattern for mission changes (Innovation #2, 88.1%)
 * - Defends "National Security Through Transparency" via audit trails (81.2%)
 * - Provides cryptographic proof of mission integrity ("Cryptographic Truth", 86.7%)
 * - Core component of O2 (Security) overlay - FOUNDATIONAL and non-negotiable
 *
 * THREAT MODEL (Innovation #19: 5-Pattern Attack Detection):
 * Defends against gradual mission poisoning via:
 * 1. Security weakening - Remove "security first", add "pragmatic security"
 * 2. Trust erosion - Add "trust experienced contributors"
 * 3. Permission creep - Shift from "strict" to "permissive"
 * 4. Ambiguity injection - Add "balanced", "flexible", "context-dependent"
 * 5. Velocity prioritization - Emphasize speed, deprioritize safety
 * 6. Error tolerance increase - "fail gracefully" replaces "fail safe"
 *
 * These patterns are empirically observed in real supply chain attacks
 * (XZ Utils backdoor, event-stream NPM compromise).
 *
 * DESIGN RATIONALE:
 * - Embedding-based distance (quantitative, objective)
 * - Pattern detection (qualitative, interpretable)
 * - Combined severity scoring (holistic risk assessment)
 * - Transparent recommendations (evidence-based, auditable)
 *
 * ALGORITHM:
 * 1. Compute semantic distance (cosine distance between centroids)
 * 2. Identify concept changes (added/removed/shifted)
 * 3. Run pattern detection (6 attack patterns)
 * 4. Classify severity (none/low/medium/high/critical)
 * 5. Generate recommendation (approve/review/reject)
 *
 * TRANSPARENCY:
 * All detection patterns are fully documented and auditable.
 * False positives are intentional - better to review than miss attacks.
 *
 * @example
 * const detector = new SemanticDriftDetector();
 * const drift = await detector.analyzeDrift(oldVersion, newVersion);
 * console.log(`Drift: ${drift.distance.toFixed(4)} (${drift.severity})`);
 * if (drift.suspiciousPatterns.length > 0) {
 *   console.log('Suspicious patterns:', drift.suspiciousPatterns);
 * }
 *
 * @example
 * // Custom thresholds for high-security environments
 * const detector = new SemanticDriftDetector({
 *   low: 0.03,      // More sensitive
 *   medium: 0.10,
 *   high: 0.20,
 *   critical: 0.35
 * });
 */

import { MissionVersion } from './mission-integrity.js';

/**
 * Result of drift analysis between two mission versions
 *
 * Combines quantitative metrics (distance) with qualitative analysis
 * (pattern detection) to provide holistic risk assessment.
 */
export interface DriftAnalysis {
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  distance: number; // Cosine distance between semantic fingerprints (0-1)
  addedConcepts: string[]; // Concepts present in new but not old
  removedConcepts: string[]; // Concepts present in old but not new
  shiftedConcepts: {
    // Concepts present in both but with position changes
    concept: string;
    oldPosition: number; // Position in old version (0-based)
    newPosition: number; // Position in new version
    delta: number; // newPosition - oldPosition (positive = deprioritized)
  }[];
  suspiciousPatterns: string[]; // Detected attack patterns
  recommendation: 'approve' | 'review' | 'reject';
}

/**
 * SemanticDriftDetector - Mission integrity analyzer
 *
 * Detects semantic drift and attack patterns in mission document changes.
 * Provides quantitative (embedding distance) and qualitative (pattern matching)
 * analysis of version changes.
 *
 * @example
 * const detector = new SemanticDriftDetector();
 * const analysis = await detector.analyzeDrift(v1, v2);
 *
 * @example
 * // High-security thresholds
 * const detector = new SemanticDriftDetector({
 *   low: 0.03, medium: 0.10, high: 0.20, critical: 0.35
 * });
 */
export class SemanticDriftDetector {
  // Thresholds calibrated for threat detection
  // These are defaults - can be overridden via config
  private readonly DEFAULT_THRESHOLDS = {
    low: 0.05, // Minor refinements (acceptable)
    medium: 0.15, // Significant reframing (review recommended)
    high: 0.3, // Major mission shift (alert)
    critical: 0.5, // Potentially malicious (block in strict mode)
  };

  private thresholds: typeof this.DEFAULT_THRESHOLDS;

  /**
   * Creates a SemanticDriftDetector with configurable thresholds
   *
   * @param thresholds - Optional threshold overrides
   * @param thresholds.low - Low drift threshold (default: 0.05)
   * @param thresholds.medium - Medium drift threshold (default: 0.15)
   * @param thresholds.high - High drift threshold (default: 0.30)
   * @param thresholds.critical - Critical drift threshold (default: 0.50)
   *
   * @example
   * const detector = new SemanticDriftDetector(); // Use defaults
   *
   * @example
   * const strictDetector = new SemanticDriftDetector({
   *   low: 0.02,  // More sensitive
   *   critical: 0.30
   * });
   */
  constructor(
    thresholds?: Partial<
      typeof SemanticDriftDetector.prototype.DEFAULT_THRESHOLDS
    >
  ) {
    this.thresholds = { ...this.DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Analyze drift between two mission versions
   *
   * Performs comprehensive drift analysis combining quantitative distance
   * measurement with qualitative pattern detection.
   *
   * ALGORITHM:
   * 1. Compute semantic distance (cosine distance between centroids)
   * 2. Identify added/removed/shifted concepts
   * 3. Run pattern detection (6 attack patterns)
   * 4. Classify severity based on distance and patterns
   * 5. Generate recommendation (approve/review/reject)
   *
   * DISTANCE INTERPRETATION:
   * - 0.00 = Identical semantic meaning
   * - 0.05 = Minor refinement (low)
   * - 0.15 = Significant reframing (medium)
   * - 0.30 = Major shift (high)
   * - 0.50+ = Fundamental change (critical)
   *
   * @param oldVersion - Previous mission version
   * @param newVersion - New mission version
   * @returns Drift analysis with severity and recommendations
   *
   * @example
   * const monitor = new MissionIntegrityMonitor(pgcRoot);
   * const v1 = await monitor.getVersion(1);
   * const v2 = await monitor.getLatestVersion();
   * const drift = await detector.analyzeDrift(v1, v2);
   *
   * if (drift.severity === 'critical') {
   *   console.error('CRITICAL drift detected!');
   *   drift.suspiciousPatterns.forEach(p => console.error(`  - ${p}`));
   * }
   */
  async analyzeDrift(
    oldVersion: MissionVersion,
    newVersion: MissionVersion
  ): Promise<DriftAnalysis> {
    // 1. Compute semantic distance
    const distance = this.computeSemanticDistance(
      oldVersion.conceptEmbeddings,
      newVersion.conceptEmbeddings
    );

    // 2. Identify concept changes
    const { added, removed, shifted } = this.compareConceptSets(
      oldVersion.conceptTexts,
      newVersion.conceptTexts
    );

    // 3. Detect suspicious patterns
    const suspiciousPatterns = this.detectSuspiciousPatterns(
      added,
      removed,
      shifted
    );

    // 4. Classify severity
    const severity = this.classifySeverity(distance, suspiciousPatterns.length);

    // 5. Generate recommendation
    const recommendation = this.makeRecommendation(
      severity,
      suspiciousPatterns.length
    );

    return {
      severity,
      distance,
      addedConcepts: added,
      removedConcepts: removed,
      shiftedConcepts: shifted,
      suspiciousPatterns,
      recommendation,
    };
  }

  /**
   * Compute cosine distance between two sets of embeddings
   *
   * ALGORITHM:
   * 1. Compute centroid of each embedding set
   * 2. Compute cosine similarity between centroids
   * 3. Convert to distance (1 - similarity)
   *
   * INTERPRETATION:
   * - 0.00 = Identical semantic meaning
   * - 0.05 = Minor refinement
   * - 0.15 = Significant reframing
   * - 0.30 = Major shift
   * - 1.00 = Complete opposition
   */
  private computeSemanticDistance(
    oldEmbeddings: number[][],
    newEmbeddings: number[][]
  ): number {
    const oldCentroid = this.computeCentroid(oldEmbeddings);
    const newCentroid = this.computeCentroid(newEmbeddings);

    const similarity = this.cosineSimilarity(oldCentroid, newCentroid);
    return 1 - similarity; // Convert similarity to distance
  }

  /**
   * Compute centroid (average) of embeddings
   */
  private computeCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      throw new Error('Cannot compute centroid: no embeddings');
    }

    const dim = embeddings[0].length;
    const centroid = new Array(dim).fill(0);

    embeddings.forEach((emb) => {
      emb.forEach((val, i) => {
        centroid[i] += val;
      });
    });

    return centroid.map((v) => v / embeddings.length);
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vector dimension mismatch');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Compare concept sets to find additions, removals, and shifts
   */
  private compareConceptSets(
    oldConcepts: string[],
    newConcepts: string[]
  ): {
    added: string[];
    removed: string[];
    shifted: DriftAnalysis['shiftedConcepts'];
  } {
    // Normalize for case-insensitive comparison
    const oldSet = new Set(oldConcepts.map((c) => c.toLowerCase()));
    const newSet = new Set(newConcepts.map((c) => c.toLowerCase()));

    const oldMap = new Map(oldConcepts.map((c, i) => [c.toLowerCase(), i]));
    const newMap = new Map(newConcepts.map((c, i) => [c.toLowerCase(), i]));

    // Find additions (in new but not old)
    const added = newConcepts.filter((c) => !oldSet.has(c.toLowerCase()));

    // Find removals (in old but not new)
    const removed = oldConcepts.filter((c) => !newSet.has(c.toLowerCase()));

    // Find shifts (in both but position changed)
    const shifted: DriftAnalysis['shiftedConcepts'] = [];
    for (const concept of oldConcepts) {
      const normalized = concept.toLowerCase();
      if (newSet.has(normalized)) {
        const oldPos = oldMap.get(normalized)!;
        const newPos = newMap.get(normalized)!;
        if (oldPos !== newPos) {
          shifted.push({
            concept,
            oldPosition: oldPos,
            newPosition: newPos,
            delta: newPos - oldPos,
          });
        }
      }
    }

    return { added, removed, shifted };
  }

  /**
   * SECURITY: Detect suspicious patterns in concept changes
   *
   * PATTERNS (fully transparent and auditable):
   * 1. Security weakening - Remove security concepts, add convenience
   * 2. Trust erosion - Add trust-based bypasses
   * 3. Permission creep - Shift from strict to permissive
   * 4. Ambiguity injection - Add vague qualifiers
   * 5. Velocity over safety - Prioritize speed, deprioritize security
   *
   * WHY THESE PATTERNS:
   * These are empirically observed in real-world supply chain attacks
   * (XZ Utils, event-stream NPM) and social engineering campaigns.
   *
   * FALSE POSITIVES:
   * Pattern detection may flag legitimate refinements. That's intentional.
   * Advisory mode shows warnings, strict mode requires review.
   * Users maintain full control.
   */
  private detectSuspiciousPatterns(
    added: string[],
    removed: string[],
    shifted: DriftAnalysis['shiftedConcepts']
  ): string[] {
    const patterns: string[] = [];

    // Pattern 1: Security weakening
    // Example: Remove "security first", add "pragmatic security"
    const securityRemoved = removed.some((c) =>
      /\b(security|privacy|validation|audit|verify|protect)\b/i.test(c)
    );
    const convenienceAdded = added.some((c) =>
      /\b(convenie|shortcut|skip|bypass|pragmatic.*security|flexible.*security)/i.test(
        c
      )
    );

    if (securityRemoved && convenienceAdded) {
      patterns.push(
        'SECURITY_WEAKENING: Removed security concepts while adding convenience language'
      );
    }

    // Pattern 2: Trust erosion
    // Example: Add "trust experienced contributors", "skip checks for known users"
    const trustBased = added.some((c) =>
      /\b(trust.*contributor|trust.*user|experienc.*user|skip.*check|bypass|known.*user)/i.test(
        c
      )
    );

    if (trustBased) {
      patterns.push(
        'TRUST_EROSION: Added trust-based bypass concepts (red flag for supply chain attacks)'
      );
    }

    // Pattern 3: Permission creep
    // Example: Add "allow", "permit", remove "strict", "enforce"
    const permissiveAdded = added.some((c) =>
      /\b(allow|permit|enable|relax|loosen|reduce.*restriction|flexible.*access)/i.test(
        c
      )
    );
    const strictnessRemoved = removed.some((c) =>
      /\b(strict|enforce|require|mandatory|must)\b/i.test(c)
    );

    if (permissiveAdded && strictnessRemoved) {
      patterns.push(
        'PERMISSION_CREEP: Shifted from strict enforcement to permissive language'
      );
    }

    // Pattern 4: Ambiguity injection
    // Example: "Security first" → "Security first, balanced with pragmatism"
    const ambiguousAdded = added.some((c) =>
      /\b(balanced|pragmatic(?!raph)|flexible|context-dependent|situational|case-by-case|nuanced)\b/i.test(
        c
      )
    );

    if (ambiguousAdded) {
      patterns.push(
        'AMBIGUITY_INJECTION: Added vague qualifiers to principles (weakens clarity and accountability)'
      );
    }

    // Pattern 5: Velocity prioritization over safety
    // Example: Add "developer velocity", "ship fast", deprioritize "testing"
    const velocityAdded = added.some((c) =>
      /\b(velocity|ship.*fast|move.*fast|speed|quick|rapid.*development)/i.test(
        c
      )
    );
    const safetyDeprioritized = shifted.some(
      (s) =>
        /\b(safety|security|testing|quality|review)\b/i.test(s.concept) &&
        s.delta > 5 // Moved down significantly
    );
    const safetyRemoved = removed.some((c) =>
      /\b(safety|security|testing|quality|review)\b/i.test(c)
    );

    if (velocityAdded && (safetyDeprioritized || safetyRemoved)) {
      patterns.push(
        'VELOCITY_OVER_SAFETY: Increased velocity focus while deprioritizing safety concepts'
      );
    }

    // Pattern 6: Error tolerance increase
    // Example: Add "fail gracefully", "best effort", remove "zero tolerance"
    const errorToleranceAdded = added.some((c) =>
      /\b(fail.*graceful|best.*effort|acceptable.*failure|tolerate.*error)/i.test(
        c
      )
    );
    const zeroToleranceRemoved = removed.some((c) =>
      /\b(zero.*tolerance|fail.*safe|error.*free|strict.*validation)\b/i.test(c)
    );

    if (errorToleranceAdded && zeroToleranceRemoved) {
      patterns.push(
        'ERROR_TOLERANCE: Shifted from fail-safe to fail-gracefully mindset'
      );
    }

    return patterns;
  }

  /**
   * Classify severity based on distance and pattern count
   */
  private classifySeverity(
    distance: number,
    patternCount: number
  ): DriftAnalysis['severity'] {
    // Critical: Large distance OR multiple patterns
    if (distance >= this.thresholds.critical || patternCount >= 3) {
      return 'critical';
    }

    // High: High distance OR 2 patterns
    if (distance >= this.thresholds.high || patternCount === 2) {
      return 'high';
    }

    // Medium: Medium distance OR 1 pattern
    if (distance >= this.thresholds.medium || patternCount === 1) {
      return 'medium';
    }

    // Low: Low distance, no patterns
    if (distance >= this.thresholds.low) {
      return 'low';
    }

    // None: Negligible change
    return 'none';
  }

  /**
   * Generate recommendation based on severity and pattern count
   *
   * LOGIC:
   * - Critical severity OR ≥2 patterns → reject
   * - High severity OR 1 pattern → review
   * - Otherwise → approve
   *
   * NOTE: In advisory mode, "reject" = strong warning
   *       In strict mode, "reject" = block ingestion
   */
  private makeRecommendation(
    severity: DriftAnalysis['severity'],
    patternCount: number
  ): DriftAnalysis['recommendation'] {
    if (severity === 'critical' || patternCount >= 2) {
      return 'reject';
    }

    if (severity === 'high' || patternCount === 1) {
      return 'review';
    }

    return 'approve';
  }
}
