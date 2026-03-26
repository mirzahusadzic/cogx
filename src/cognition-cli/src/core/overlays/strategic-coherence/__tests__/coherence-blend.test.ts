import { describe, it, expect } from 'vitest';

/**
 * Pure math tests for intent-grounded coherence blending.
 * No file I/O or mocking needed — these test the arithmetic only.
 *
 * Blend formula:
 *   intentWeight = confidence * 0.5
 *   shadowWeight = 1 - intentWeight
 *   blended = shadow * shadowWeight + intent * intentWeight
 */

function blendCoherence(
  shadowScore: number,
  intentScore: number,
  confidence: number
): number {
  const intentWeight = confidence * 0.5;
  const shadowWeight = 1.0 - intentWeight;
  return shadowWeight * shadowScore + intentWeight * intentScore;
}

describe('coherence blending math', () => {
  it('confidence=0 → 100% shadow (no intent influence)', () => {
    const shadow = 0.6;
    const intent = 0.9;
    const result = blendCoherence(shadow, intent, 0);

    // intentWeight = 0, shadowWeight = 1.0 → result = shadow
    expect(result).toBeCloseTo(shadow, 10);
  });

  it('confidence=0.6 → 30% intent, 70% shadow', () => {
    const shadow = 0.5;
    const intent = 0.8;
    const confidence = 0.6;

    const intentWeight = confidence * 0.5; // 0.3
    const expected = (1.0 - intentWeight) * shadow + intentWeight * intent;

    const result = blendCoherence(shadow, intent, confidence);

    expect(result).toBeCloseTo(expected, 10);
    expect(result).toBeCloseTo(0.7 * 0.5 + 0.3 * 0.8, 10); // 0.35 + 0.24 = 0.59
  });

  it('confidence=1.0 → 50% intent, 50% shadow', () => {
    const shadow = 0.4;
    const intent = 0.8;
    const confidence = 1.0;

    const intentWeight = confidence * 0.5; // 0.5
    const expected = intentWeight * intent + (1.0 - intentWeight) * shadow; // 0.6

    const result = blendCoherence(shadow, intent, confidence);

    expect(result).toBeCloseTo(expected, 10);
    expect(result).toBeCloseTo(0.6, 10);
  });

  it('intent score > shadow score → blended > shadow (reclassification case)', () => {
    const shadow = 0.3; // drifted symbol
    const intent = 0.8; // but intent says it serves the mission
    const confidence = 0.8;

    const result = blendCoherence(shadow, intent, confidence);

    expect(result).toBeGreaterThan(shadow);
  });

  it('intent score < shadow score → blended < shadow (confirmed drift)', () => {
    const shadow = 0.9; // looks aligned by shadow
    const intent = 0.2; // but intent says it diverged
    const confidence = 0.8;

    const result = blendCoherence(shadow, intent, confidence);

    expect(result).toBeLessThan(shadow);
  });
});
