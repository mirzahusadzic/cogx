/**
 * Validation Service
 *
 * Provides deterministic and semantic validation for task completions,
 * especially for delegated tasks with acceptance criteria and grounding requirements.
 */

import { SessionState } from './session-state.js';

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0.0 to 1.0
  reason?: string;
  missing_criteria?: string[];
  evidence_found?: boolean;
}

/**
 * Validate a task completion against its acceptance criteria and grounding requirements.
 *
 * @param task - The task object from session state
 * @param summary - The worker's completion report
 * @returns Validation result with status and score
 */
export async function validateTaskCompletion(
  task: NonNullable<SessionState['todos']>[number],
  summary: string
): Promise<ValidationResult> {
  const criteria = task.acceptance_criteria || [];
  const grounding = task.grounding;

  if (criteria.length === 0 && !grounding?.evidence_required) {
    return { isValid: true, score: 1.0 };
  }

  const missing_criteria: string[] = [];
  let score_acc = 0;

  // 1. Check Acceptance Criteria (Deterministic/Keyword based for now)
  // Phase 3.1: Basic keyword matching for criteria
  // Phase 3.2: Semantic LLM-based verification (future)
  for (const criterion of criteria) {
    const keywords = criterion
      .toLowerCase()
      .split(' ')
      .filter((w) => w.length > 3);
    const found = keywords.some((kw) => summary.toLowerCase().includes(kw));

    if (found) {
      score_acc += 1;
    } else {
      missing_criteria.push(criterion);
    }
  }

  // 2. Check Grounding Evidence if required
  let evidence_found = false;
  if (grounding?.evidence_required) {
    if (task.grounding_evidence) {
      // Robust structured validation
      evidence_found = true;
      const evidence = task.grounding_evidence;

      // Check for citations
      if (evidence.citations.length === 0) {
        missing_criteria.push(
          'Required grounding evidence: No citations provided'
        );
        evidence_found = false;
      }

      // Check for requested overlays
      if (grounding.overlay_hints && grounding.overlay_hints.length > 0) {
        const consultedSet = new Set(evidence.overlays_consulted);
        const hasAnyRequiredOverlay = grounding.overlay_hints.some((hint) =>
          consultedSet.has(hint)
        );

        if (!hasAnyRequiredOverlay) {
          missing_criteria.push(
            `Required grounding evidence: None of the requested overlays (${grounding.overlay_hints.join(', ')}) were consulted`
          );
          evidence_found = false;
        }
      }

      // Check confidence (warning only, doesn't fail validation unless critical)
      if (evidence.grounding_confidence === 'low') {
        missing_criteria.push('Warning: Grounding confidence is low (< 0.7)');
        // Don't fail evidence_found, but it might affect score if we weighted it
      }
    } else {
      // Legacy string-based validation (fallback)
      const hasCitations =
        /\[O[1-7]\]|citations|evidence|source|grounding_evidence/i.test(
          summary
        );
      const hasConfidence =
        /confidence|score|similarity|grounding_confidence/i.test(summary);

      evidence_found = hasCitations && hasConfidence;

      // Check for specific overlays if hinted (string check)
      if (grounding.overlay_hints && grounding.overlay_hints.length > 0) {
        const overlaysMentioned = grounding.overlay_hints.filter((o) =>
          summary.includes(o)
        );
        if (overlaysMentioned.length === 0) {
          missing_criteria.push(
            `None of the requested overlays (${grounding.overlay_hints.join(', ')}) found in evidence (string check)`
          );
          evidence_found = false;
        }
      }

      if (!evidence_found) {
        missing_criteria.push(
          'Required grounding evidence/citations missing (structured object not found)'
        );
      }
    }

    if (evidence_found) {
      score_acc += 1;
    }
  }

  const total_checks = criteria.length + (grounding?.evidence_required ? 1 : 0);
  const final_score = total_checks > 0 ? score_acc / total_checks : 1.0;

  const isValid = final_score >= 0.7; // Threshold for "valid" completion

  return {
    isValid,
    score: final_score,
    reason: isValid
      ? undefined
      : 'Task completion does not fully meet acceptance criteria or grounding requirements.',
    missing_criteria:
      missing_criteria.length > 0 ? missing_criteria : undefined,
    evidence_found,
  };
}
