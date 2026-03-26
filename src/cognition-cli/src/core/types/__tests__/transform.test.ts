import { describe, it, expect } from 'vitest';
import { TransformationSchema } from '../transform.js';

describe('TransformationSchema', () => {
  const baseTransform = {
    goal: {
      objective: 'Extract structural metadata',
      criteria: ['All functions captured'],
      phimin: 0.9,
    },
    phi: 0.95,
    verification_result: {
      success: true,
      messages: ['All criteria met'],
    },
    inputs: [{ path: 'src/file.ts', hash: 'abc123' }],
    outputs: [{ path: '.pgc/file.json', hash: 'def456' }],
    method: 'ast_native',
  };

  it('should accept old transforms (backward compatibility)', () => {
    const result = TransformationSchema.safeParse(baseTransform);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reasoning).toBeUndefined();
      expect(result.data.source).toBeUndefined();
      expect(result.data.git).toBeUndefined();
    }
  });

  it('should validate new fields: reasoning, source, and git', () => {
    const fullTransform = {
      ...baseTransform,
      type: 'test_transform',
      timestamp: new Date().toISOString(),
      reasoning: {
        intent: 'Refactoring for better modularity',
        decision: 'Split class into two',
        alternatives: ['Keep as is', 'Use composition'],
        confidence: 0.9,
      },
      source: {
        type: 'ai_agent',
        identifier: 'gemini-3-flash',
        session_id: 'session-123',
      },
      git: {
        commit_hash: 'abcdef123456',
        author: 'Jane Doe',
        message: 'feat: add new feature',
        timestamp: '2026-03-26T10:00:00Z',
      },
    };

    const result = TransformationSchema.safeParse(fullTransform);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reasoning?.intent).toBe(
        'Refactoring for better modularity'
      );
      expect(result.data.source?.type).toBe('ai_agent');
      expect(result.data.git?.commit_hash).toBe('abcdef123456');
    }
  });

  it('should fail if reasoning.intent is missing but reasoning object is present', () => {
    const invalidTransform = {
      ...baseTransform,
      reasoning: {
        decision: 'Split class',
      },
    };

    const result = TransformationSchema.safeParse(invalidTransform);
    expect(result.success).toBe(false);
  });

  it('should fail if source.type is invalid', () => {
    const invalidTransform = {
      ...baseTransform,
      source: {
        type: 'human', // Should be 'developer'
      },
    };

    const result = TransformationSchema.safeParse(invalidTransform);
    expect(result.success).toBe(false);
  });

  it('should fail if reasoning.confidence is out of bounds', () => {
    const invalidTransform = {
      ...baseTransform,
      reasoning: {
        intent: 'Test',
        confidence: 1.5,
      },
    };

    const result = TransformationSchema.safeParse(invalidTransform);
    expect(result.success).toBe(false);
  });
});
