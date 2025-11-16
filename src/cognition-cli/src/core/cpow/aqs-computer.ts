/**
 * AQS Computer - Agentic Quality Score calculation
 *
 * Computes AQS (Agentic Quality Score) for completed quests.
 * AQS measures execution quality through efficiency, accuracy, and adaptability.
 *
 * FORMULA:
 * AQS = ω_avg · (1 + bonus)
 *
 * where:
 *   ω_avg = average Oracle score across transforms
 *   bonus = coherence_bonus (weight: 0.2) +
 *           pattern_reuse_bonus (weight: 0.15) +
 *           security_bonus (weight: 0.10) +
 *           efficiency_bonus (weight: 0.05)
 *
 * GRADING SCALE:
 * - A (0.85 - 1.0): Exceptional - Eligible for CoMP distillation
 * - B (0.70 - 0.84): Good - Solid work, reusable patterns
 * - C (0.50 - 0.69): Acceptable - Met requirements
 * - D (0.30 - 0.49): Poor - Needs rework
 * - F (0.0 - 0.29): Failed - Did not meet basic requirements
 *
 * REFERENCE: docs/manual/part-5-cpow-loop/20-cpow-reference.md (Phase 7)
 */

import type { CPOW } from './types.js';
import type { AQSOptions, AQSResult } from './types.js';

/**
 * Compute Agentic Quality Score (AQS)
 *
 * Calculates quality score based on Oracle evaluations and quest characteristics.
 * High AQS (>= 0.70) triggers wisdom distillation (CoMP generation).
 *
 * @param options - AQS computation options
 * @returns AQS result with score, grade, and eligibility
 *
 * @example
 * const aqsResult = await computeAQS({
 *   cpow: cpow,
 *   expectedTransforms: 8
 * });
 *
 * console.log(`AQS: ${aqsResult.aqs.toFixed(3)} (Grade: ${aqsResult.grade})`);
 * console.log(`Eligible for CoMP: ${aqsResult.eligible_for_comp}`);
 *
 * if (aqsResult.eligible_for_comp) {
 *   const comp = await distillWisdom({ cpow, aqs: aqsResult });
 * }
 */
export async function computeAQS(options: AQSOptions): Promise<AQSResult> {
  const { cpow, expectedTransforms, weights } = options;

  // Default weights
  const w = {
    oracle: weights?.oracle ?? 1.0,
    coherence: weights?.coherence ?? 0.2,
    patternReuse: weights?.patternReuse ?? 0.15,
    security: weights?.security ?? 0.1,
    efficiency: weights?.efficiency ?? 0.05,
  };

  // 1. Compute average Oracle score
  const oracle_avg = computeAverageOracleScore(cpow);

  // 2. Compute coherence bonus
  const coherence_bonus = computeCoherenceBonus(cpow, w.coherence);

  // 3. Compute pattern reuse bonus
  const pattern_reuse_bonus = computePatternReuseBonus(cpow, w.patternReuse);

  // 4. Compute security bonus
  const security_bonus = computeSecurityBonus(cpow, w.security);

  // 5. Compute efficiency bonus
  const efficiency_bonus = computeEfficiencyBonus(
    cpow,
    expectedTransforms,
    w.efficiency
  );

  // 6. Aggregate bonuses
  const bonus =
    coherence_bonus + pattern_reuse_bonus + security_bonus + efficiency_bonus;

  // 7. Calculate final AQS
  const aqs = oracle_avg * (1 + bonus);

  // 8. Assign grade
  const grade = assignGrade(aqs);

  // 9. Determine CoMP eligibility (AQS >= 0.70)
  const eligible_for_comp = aqs >= 0.7;

  return {
    aqs,
    components: {
      oracle_avg,
      bonus,
      breakdown: {
        coherence_bonus,
        pattern_reuse_bonus,
        security_bonus,
        efficiency_bonus,
      },
    },
    grade,
    eligible_for_comp,
  };
}

/**
 * Compute average Oracle score
 *
 * Averages Oracle scores across all transforms.
 * Falls back to 0.5 if no Oracle responses (local-only quest).
 *
 * @param cpow - cPOW object
 * @returns Average Oracle score (0.0 - 1.0)
 */
function computeAverageOracleScore(cpow: CPOW): number {
  const responses = cpow.oracle_responses;

  if (responses.length === 0) {
    // No Oracle validation - use neutral score
    return 0.5;
  }

  const sum = responses.reduce((acc, r) => acc + r.score, 0);
  return sum / responses.length;
}

/**
 * Compute coherence bonus
 *
 * Rewards coherence improvement (Δγ > 0).
 * Normalized to 0-1 scale (Δγ / 0.1 capped at 1.0).
 *
 * @param cpow - cPOW object
 * @param weight - Coherence bonus weight
 * @returns Weighted coherence bonus
 */
function computeCoherenceBonus(cpow: CPOW, weight: number): number {
  const delta = cpow.coherence.delta;

  if (delta <= 0) {
    // No bonus for drift
    return 0;
  }

  // Normalize: Δγ = 0.1 → bonus = 1.0
  const normalized = Math.min(delta / 0.1, 1.0);
  return normalized * weight;
}

/**
 * Compute pattern reuse bonus
 *
 * Rewards reusing patterns from O₅ (Operational Patterns).
 * Normalized to 0-1 scale (num_patterns / 5 capped at 1.0).
 *
 * @param cpow - cPOW object
 * @param weight - Pattern reuse bonus weight
 * @returns Weighted pattern reuse bonus
 */
function computePatternReuseBonus(cpow: CPOW, weight: number): number {
  // Count patterns mentioned in transforms (heuristic)
  let patternCount = 0;

  for (const transform of cpow.transforms) {
    // Check if rationale mentions patterns
    if (
      transform.rationale &&
      (transform.rationale.toLowerCase().includes('pattern') ||
        transform.rationale.toLowerCase().includes('reuse'))
    ) {
      patternCount++;
    }
  }

  // Normalize: 5 patterns → bonus = 1.0
  const normalized = Math.min(patternCount / 5, 1.0);
  return normalized * weight;
}

/**
 * Compute security bonus
 *
 * Rewards security enhancements (new security guidelines added).
 * Binary: 1.0 if security enhanced, 0.0 otherwise.
 *
 * @param cpow - cPOW object
 * @param weight - Security bonus weight
 * @returns Weighted security bonus
 */
function computeSecurityBonus(cpow: CPOW, weight: number): number {
  // Check if any transforms mention security
  let securityEnhanced = false;

  for (const transform of cpow.transforms) {
    if (
      transform.rationale &&
      (transform.rationale.toLowerCase().includes('security') ||
        transform.rationale.toLowerCase().includes('authentication') ||
        transform.rationale.toLowerCase().includes('authorization') ||
        transform.rationale.toLowerCase().includes('validation'))
    ) {
      securityEnhanced = true;
      break;
    }
  }

  // Check if security level is high/critical
  if (cpow.security_level === 'high' || cpow.security_level === 'critical') {
    securityEnhanced = true;
  }

  return securityEnhanced ? weight : 0;
}

/**
 * Compute efficiency bonus
 *
 * Rewards efficiency (fewer transforms than expected).
 * Normalized to 0-1 scale based on deviation from expected count.
 *
 * @param cpow - cPOW object
 * @param expectedTransforms - Expected transform count (default: 8)
 * @param weight - Efficiency bonus weight
 * @returns Weighted efficiency bonus
 */
function computeEfficiencyBonus(
  cpow: CPOW,
  expectedTransforms: number | undefined,
  weight: number
): number {
  const expected = expectedTransforms ?? 8;
  const actual = cpow.transforms.length;

  if (actual >= expected) {
    // No bonus if we took more steps than expected
    return 0;
  }

  // Normalize: 50% fewer transforms → bonus = 1.0
  const efficiency = 1.0 - actual / expected;
  const normalized = Math.min(efficiency * 2, 1.0);
  return normalized * weight;
}

/**
 * Assign letter grade based on AQS score
 *
 * @param aqs - AQS score
 * @returns Letter grade (A/B/C/D/F)
 */
function assignGrade(aqs: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (aqs >= 0.85) return 'A';
  if (aqs >= 0.7) return 'B';
  if (aqs >= 0.5) return 'C';
  if (aqs >= 0.3) return 'D';
  return 'F';
}

/**
 * Get AQS thresholds for each grade
 *
 * @returns Map of grade to minimum AQS threshold
 */
export function getAQSThresholds(): Record<
  'A' | 'B' | 'C' | 'D' | 'F',
  number
> {
  return {
    A: 0.85,
    B: 0.7,
    C: 0.5,
    D: 0.3,
    F: 0.0,
  };
}

/**
 * Get AQS interpretation
 *
 * @param aqs - AQS score
 * @returns Human-readable interpretation
 */
export function getAQSInterpretation(aqs: number): string {
  if (aqs >= 0.85) {
    return 'Exceptional - Highly efficient, accurate, and adaptive';
  }
  if (aqs >= 0.7) {
    return 'Good - Solid work with reusable patterns';
  }
  if (aqs >= 0.5) {
    return 'Acceptable - Met requirements, room for improvement';
  }
  if (aqs >= 0.3) {
    return 'Poor - Needs rework';
  }
  return 'Failed - Did not meet basic requirements';
}
