import { describe, it, expect } from 'vitest';
import { validateTaskCompletion } from '../validation-service';
import { SessionState } from '../session-state';

describe('validateTaskCompletion', () => {
  const mockTask: NonNullable<SessionState['todos']>[number] = {
    id: 'task-1',
    content: 'Fix bugs',
    activeForm: 'Fixing bugs',
    status: 'pending',
  };

  it('should validate successfully when no criteria or grounding required', async () => {
    const result = await validateTaskCompletion(mockTask, 'Done');
    expect(result.isValid).toBe(true);
    expect(result.score).toBe(1.0);
  });

  it('should validate acceptance criteria match', async () => {
    const task = {
      ...mockTask,
      acceptance_criteria: ['Unit tests pass', 'No lint errors'],
    };
    const summary =
      'I ran the unit tests and they pass. Also fixed lint errors.';
    const result = await validateTaskCompletion(task, summary);
    expect(result.isValid).toBe(true);
    expect(result.score).toBe(1.0);
    expect(result.missing_criteria).toBeUndefined();
  });

  it('should fail if acceptance criteria missing', async () => {
    const task = {
      ...mockTask,
      acceptance_criteria: ['Unit tests pass'],
    };
    const summary = 'I fixed the code.';
    const result = await validateTaskCompletion(task, summary);
    expect(result.isValid).toBe(false);
    expect(result.score).toBe(0.0);
    expect(result.missing_criteria).toContain('Unit tests pass');
  });

  describe('Grounding Validation (Structured)', () => {
    const groundingTask = {
      ...mockTask,
      grounding: {
        strategy: 'pgc_cite' as const,
        evidence_required: true,
        overlay_hints: ['O1', 'O2'] as (
          | 'O1'
          | 'O2'
          | 'O3'
          | 'O4'
          | 'O5'
          | 'O6'
          | 'O7'
        )[],
      },
    };

    it('should validate when structured evidence is present and complete', async () => {
      const taskWithEvidence = {
        ...groundingTask,
        grounding_evidence: {
          queries_executed: ['query'],
          overlays_consulted: ['O1', 'O2'] as (
            | 'O1'
            | 'O2'
            | 'O3'
            | 'O4'
            | 'O5'
            | 'O6'
            | 'O7'
          )[],
          citations: [{ overlay: 'O1', content: 'code', relevance: 'high' }],
          grounding_confidence: 'high' as const,
        },
      };

      const result = await validateTaskCompletion(taskWithEvidence, 'Done');
      expect(result.isValid).toBe(true);
      expect(result.evidence_found).toBe(true);
    });

    it('should fail when structured evidence is missing citations', async () => {
      const taskWithEvidence = {
        ...groundingTask,
        grounding_evidence: {
          queries_executed: ['query'],
          overlays_consulted: ['O1'] as (
            | 'O1'
            | 'O2'
            | 'O3'
            | 'O4'
            | 'O5'
            | 'O6'
            | 'O7'
          )[],
          citations: [], // Empty citations
          grounding_confidence: 'high' as const,
        },
      };

      const result = await validateTaskCompletion(taskWithEvidence, 'Done');
      expect(result.evidence_found).toBe(false);
      expect(result.missing_criteria).toContain(
        'Required grounding evidence: No citations provided'
      );
    });

    it('should fail when required overlays not consulted', async () => {
      const taskWithEvidence = {
        ...groundingTask,
        grounding: {
          ...groundingTask.grounding,
          overlay_hints: ['O3'] as (
            | 'O1'
            | 'O2'
            | 'O3'
            | 'O4'
            | 'O5'
            | 'O6'
            | 'O7'
          )[], // Requires O3
        },
        grounding_evidence: {
          queries_executed: ['query'],
          overlays_consulted: ['O1', 'O2'] as (
            | 'O1'
            | 'O2'
            | 'O3'
            | 'O4'
            | 'O5'
            | 'O6'
            | 'O7'
          )[], // Only has O1, O2
          citations: [{ overlay: 'O1', content: 'code', relevance: 'high' }],
          grounding_confidence: 'high' as const,
        },
      };

      const result = await validateTaskCompletion(taskWithEvidence, 'Done');
      expect(result.evidence_found).toBe(false);
      expect(
        result.missing_criteria?.some((c) =>
          c.includes('None of the requested overlays')
        )
      ).toBe(true);
    });

    it('should fallback to string validation if structured evidence missing', async () => {
      const result = await validateTaskCompletion(
        groundingTask,
        'Based on [O1] structural analysis and [O2] security check, confidence is high.'
      );
      expect(result.isValid).toBe(true);
      expect(result.evidence_found).toBe(true);
    });

    it('should fail string validation if keywords missing', async () => {
      const result = await validateTaskCompletion(groundingTask, 'I fixed it.');
      expect(result.evidence_found).toBe(false);
      expect(result.missing_criteria).toBeDefined();
    });
  });
});
