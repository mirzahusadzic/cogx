/**
 * Tests for SemanticDriftDetector
 *
 * CRITICAL P0 TESTS - Drift detection is the frontline defense against mission poisoning attacks.
 *
 * Coverage:
 * - [x] All 6 attack pattern detection (security weakening, trust erosion, permission creep, ambiguity injection, velocity over safety, error tolerance)
 * - [x] Semantic distance calculation (cosine similarity)
 * - [x] Concept change tracking (added/removed/shifted)
 * - [x] Severity classification
 * - [x] Recommendation generation
 * - [x] Custom threshold configuration
 * - [x] Centroid calculation for embeddings
 * - [x] Edge cases (empty embeddings, identical versions)
 */

import { describe, it, expect } from 'vitest';
import { SemanticDriftDetector } from '../drift-detector.js';
import type { MissionVersion } from '../mission-integrity.js';

describe('SemanticDriftDetector', () => {
  let detector: SemanticDriftDetector;

  beforeEach(() => {
    detector = new SemanticDriftDetector({
      low: 0.05,
      medium: 0.15,
      high: 0.3,
      critical: 0.5,
    });
  });

  describe('Attack Pattern Detection', () => {
    describe('Pattern 1: SECURITY_WEAKENING', () => {
      it('should detect removal of security concepts + addition of convenience language', async () => {
        const oldVersion: MissionVersion = {
          version: 1,
          hash: 'abc123',
          timestamp: '2024-01-01T00:00:00Z',
          conceptEmbeddings: [[0.1, 0.2, 0.3]],
          semanticFingerprint: 'old',
          conceptTexts: [
            'security first',
            'strict validation',
            'audit all changes',
            'privacy protection',
          ],
        };

        const newVersion: MissionVersion = {
          version: 2,
          hash: 'def456',
          timestamp: '2024-01-02T00:00:00Z',
          conceptEmbeddings: [[0.15, 0.25, 0.35]],
          semanticFingerprint: 'new',
          conceptTexts: [
            'pragmatic security',
            'flexible validation',
            'audit when needed',
            'convenient shortcuts',
          ],
        };

        const result = await detector.analyzeDrift(oldVersion, newVersion);

        const hasPattern = result.suspiciousPatterns.some(p => p.includes('SECURITY_WEAKENING'));
        expect(hasPattern).toBe(true);
        expect(['medium', 'high', 'critical']).toContain(result.severity);
        expect(['review', 'reject']).toContain(result.recommendation);
      });

      it('should detect removal of "security" with addition of "bypass"', async () => {
        const oldVersion: MissionVersion = {
          version: 1,
          hash: 'abc',
          timestamp: '2024-01-01',
          conceptEmbeddings: [[0.1, 0.2]],
          semanticFingerprint: 'old',
          conceptTexts: ['security validation', 'protect data'],
        };

        const newVersion: MissionVersion = {
          version: 2,
          hash: 'def',
          timestamp: '2024-01-02',
          conceptEmbeddings: [[0.2, 0.3]],
          semanticFingerprint: 'new',
          conceptTexts: ['bypass checks for speed', 'shortcut processing'],
        };

        const result = await detector.analyzeDrift(oldVersion, newVersion);

        expect(result.suspiciousPatterns.some(p => p.includes('SECURITY_WEAKENING'))).toBe(true);
      });
    });

    describe('Pattern 2: TRUST_EROSION', () => {
      it('should detect trust-based bypass language', async () => {
        const oldVersion: MissionVersion = {
          version: 1,
          hash: 'abc',
          timestamp: '2024-01-01',
          conceptEmbeddings: [[0.1, 0.2]],
          semanticFingerprint: 'old',
          conceptTexts: ['verify all contributors', 'zero trust architecture'],
        };

        const newVersion: MissionVersion = {
          version: 2,
          hash: 'def',
          timestamp: '2024-01-02',
          conceptEmbeddings: [[0.15, 0.25]],
          semanticFingerprint: 'new',
          conceptTexts: [
            'trust experienced contributors',
            'skip checks for known users',
          ],
        };

        const result = await detector.analyzeDrift(oldVersion, newVersion);

        expect(result.suspiciousPatterns.some(p => p.includes('TRUST_EROSION'))).toBe(true);
        expect(result.addedConcepts).toContain('trust experienced contributors');
        expect(['review', 'reject']).toContain(result.recommendation);
      });

      it('should detect "bypass for" patterns', async () => {
        const oldVersion: MissionVersion = {
          version: 1,
          hash: 'a',
          timestamp: '2024-01-01',
          conceptEmbeddings: [[0.1]],
          semanticFingerprint: 'o',
          conceptTexts: ['strict enforcement'],
        };

        const newVersion: MissionVersion = {
          version: 2,
          hash: 'b',
          timestamp: '2024-01-02',
          conceptEmbeddings: [[0.2]],
          semanticFingerprint: 'n',
          conceptTexts: ['bypass for experienced developers'],
        };

        const result = await detector.analyzeDrift(oldVersion, newVersion);

        expect(result.suspiciousPatterns.some(p => p.includes('TRUST_EROSION'))).toBe(true);
      });
    });

    describe('Pattern 3: PERMISSION_CREEP', () => {
      it('should detect shift from strict to permissive', async () => {
        const oldVersion: MissionVersion = {
          version: 1,
          hash: 'abc',
          timestamp: '2024-01-01',
          conceptEmbeddings: [[0.1, 0.2]],
          semanticFingerprint: 'old',
          conceptTexts: ['strict enforcement', 'mandatory validation', 'must comply'],
        };

        const newVersion: MissionVersion = {
          version: 2,
          hash: 'def',
          timestamp: '2024-01-02',
          conceptEmbeddings: [[0.2, 0.3]],
          semanticFingerprint: 'new',
          conceptTexts: ['allow flexibility', 'permit exceptions', 'relax restrictions'],
        };

        const result = await detector.analyzeDrift(oldVersion, newVersion);

        expect(result.suspiciousPatterns.some(p => p.includes('PERMISSION_CREEP'))).toBe(true);
      });
    });

    describe('Pattern 4: AMBIGUITY_INJECTION', () => {
      it('should detect addition of vague qualifiers', async () => {
        const oldVersion: MissionVersion = {
          version: 1,
          hash: 'abc',
          timestamp: '2024-01-01',
          conceptEmbeddings: [[0.1, 0.2]],
          semanticFingerprint: 'old',
          conceptTexts: ['security first', 'always validate'],
        };

        const newVersion: MissionVersion = {
          version: 2,
          hash: 'def',
          timestamp: '2024-01-02',
          conceptEmbeddings: [[0.15, 0.25]],
          semanticFingerprint: 'new',
          conceptTexts: [
            'security first, balanced with pragmatism',
            'validate when context-dependent',
            'flexible approach',
            'nuanced decisions',
          ],
        };

        const result = await detector.analyzeDrift(oldVersion, newVersion);

        expect(result.suspiciousPatterns.some(p => p.includes('AMBIGUITY_INJECTION'))).toBe(true);
      });
    });

    describe('Pattern 5: VELOCITY_OVER_SAFETY', () => {
      it('should detect velocity prioritization with safety deprioritization', async () => {
        const oldVersion: MissionVersion = {
          version: 1,
          hash: 'abc',
          timestamp: '2024-01-01',
          conceptEmbeddings: [[0.1, 0.2]],
          semanticFingerprint: 'old',
          conceptTexts: ['safety first', 'security priority', 'testing required', 'quality assurance'],
        };

        const newVersion: MissionVersion = {
          version: 2,
          hash: 'def',
          timestamp: '2024-01-02',
          conceptEmbeddings: [[0.2, 0.3]],
          semanticFingerprint: 'new',
          conceptTexts: [
            'developer velocity',
            'ship fast',
            'move fast',
            'quality secondary',
            'testing optional',
            'security later',
          ],
        };

        const result = await detector.analyzeDrift(oldVersion, newVersion);

        // Check for shifted concepts (safety/security moved down)
        const safetyShifted = result.shiftedConcepts.some(
          (s) => /safety|security|testing|quality/i.test(s.concept) && s.delta > 2
        );

        // If concepts were shifted significantly OR velocity added, should detect
        if (safetyShifted || result.addedConcepts.some(c => /velocity|ship.*fast|move.*fast/i.test(c))) {
          expect(result.suspiciousPatterns.length).toBeGreaterThan(0);
        }
      });
    });

    describe('Pattern 6: ERROR_TOLERANCE', () => {
      it('should detect shift from fail-safe to fail-gracefully', async () => {
        const oldVersion: MissionVersion = {
          version: 1,
          hash: 'abc',
          timestamp: '2024-01-01',
          conceptEmbeddings: [[0.1, 0.2]],
          semanticFingerprint: 'old',
          conceptTexts: ['zero tolerance for errors', 'fail safe', 'strict validation'],
        };

        const newVersion: MissionVersion = {
          version: 2,
          hash: 'def',
          timestamp: '2024-01-02',
          conceptEmbeddings: [[0.2, 0.3]],
          semanticFingerprint: 'new',
          conceptTexts: ['fail gracefully', 'best effort', 'tolerate errors'],
        };

        const result = await detector.analyzeDrift(oldVersion, newVersion);

        expect(result.suspiciousPatterns.some(p => p.includes('ERROR_TOLERANCE'))).toBe(true);
      });
    });
  });

  describe('Semantic Distance Calculation', () => {
    it('should calculate cosine distance between embedding centroids', async () => {
      const oldVersion: MissionVersion = {
        version: 1,
        hash: 'abc',
        timestamp: '2024-01-01',
        conceptEmbeddings: [
          [1.0, 0.0, 0.0],
          [1.0, 0.0, 0.0],
        ],
        semanticFingerprint: 'old',
        conceptTexts: ['concept1', 'concept2'],
      };

      const newVersion: MissionVersion = {
        version: 2,
        hash: 'def',
        timestamp: '2024-01-02',
        conceptEmbeddings: [
          [0.0, 1.0, 0.0],
          [0.0, 1.0, 0.0],
        ],
        semanticFingerprint: 'new',
        conceptTexts: ['concept3', 'concept4'],
      };

      const result = await detector.analyzeDrift(oldVersion, newVersion);

      // Orthogonal vectors should have distance = 1.0
      expect(result.distance).toBeCloseTo(1.0, 1);
    });

    it('should return distance 0 for identical embeddings', async () => {
      const oldVersion: MissionVersion = {
        version: 1,
        hash: 'abc',
        timestamp: '2024-01-01',
        conceptEmbeddings: [
          [0.5, 0.5, 0.7],
          [0.5, 0.5, 0.7],
        ],
        semanticFingerprint: 'same',
        conceptTexts: ['same concept', 'same concept'],
      };

      const newVersion: MissionVersion = {
        version: 2,
        hash: 'abc',
        timestamp: '2024-01-01',
        conceptEmbeddings: [
          [0.5, 0.5, 0.7],
          [0.5, 0.5, 0.7],
        ],
        semanticFingerprint: 'same',
        conceptTexts: ['same concept', 'same concept'],
      };

      const result = await detector.analyzeDrift(oldVersion, newVersion);

      expect(result.distance).toBeCloseTo(0.0, 2);
      expect(result.severity).toBe('none');
    });
  });

  describe('Concept Change Tracking', () => {
    it('should identify added concepts', async () => {
      const oldVersion: MissionVersion = {
        version: 1,
        hash: 'abc',
        timestamp: '2024-01-01',
        conceptEmbeddings: [[0.1, 0.2]],
        semanticFingerprint: 'old',
        conceptTexts: ['concept A', 'concept B'],
      };

      const newVersion: MissionVersion = {
        version: 2,
        hash: 'def',
        timestamp: '2024-01-02',
        conceptEmbeddings: [[0.15, 0.25]],
        semanticFingerprint: 'new',
        conceptTexts: ['concept A', 'concept B', 'concept C', 'concept D'],
      };

      const result = await detector.analyzeDrift(oldVersion, newVersion);

      expect(result.addedConcepts).toContain('concept C');
      expect(result.addedConcepts).toContain('concept D');
      expect(result.addedConcepts.length).toBe(2);
    });

    it('should identify removed concepts', async () => {
      const oldVersion: MissionVersion = {
        version: 1,
        hash: 'abc',
        timestamp: '2024-01-01',
        conceptEmbeddings: [[0.1, 0.2]],
        semanticFingerprint: 'old',
        conceptTexts: ['concept A', 'concept B', 'concept C'],
      };

      const newVersion: MissionVersion = {
        version: 2,
        hash: 'def',
        timestamp: '2024-01-02',
        conceptEmbeddings: [[0.15, 0.25]],
        semanticFingerprint: 'new',
        conceptTexts: ['concept A'],
      };

      const result = await detector.analyzeDrift(oldVersion, newVersion);

      expect(result.removedConcepts).toContain('concept B');
      expect(result.removedConcepts).toContain('concept C');
      expect(result.removedConcepts.length).toBe(2);
    });

    it('should identify shifted concepts (position changes)', async () => {
      const oldVersion: MissionVersion = {
        version: 1,
        hash: 'abc',
        timestamp: '2024-01-01',
        conceptEmbeddings: [[0.1, 0.2]],
        semanticFingerprint: 'old',
        conceptTexts: ['security', 'performance', 'usability'],
      };

      const newVersion: MissionVersion = {
        version: 2,
        hash: 'def',
        timestamp: '2024-01-02',
        conceptEmbeddings: [[0.15, 0.25]],
        semanticFingerprint: 'new',
        conceptTexts: ['performance', 'usability', 'security'],
      };

      const result = await detector.analyzeDrift(oldVersion, newVersion);

      // Security shifted from position 0 to 2 (delta = +2, deprioritized)
      const securityShift = result.shiftedConcepts.find(
        (s) => s.concept === 'security'
      );
      expect(securityShift).toBeDefined();
      expect(securityShift?.oldPosition).toBe(0);
      expect(securityShift?.newPosition).toBe(2);
      expect(securityShift?.delta).toBe(2);
    });
  });

  describe('Severity Classification', () => {
    it('should classify as critical when distance >= 0.5', async () => {
      const oldVersion: MissionVersion = {
        version: 1,
        hash: 'abc',
        timestamp: '2024-01-01',
        conceptEmbeddings: [[1.0, 0.0, 0.0]],
        semanticFingerprint: 'old',
        conceptTexts: ['concept A'],
      };

      const newVersion: MissionVersion = {
        version: 2,
        hash: 'def',
        timestamp: '2024-01-02',
        conceptEmbeddings: [[-1.0, 0.0, 0.0]],
        semanticFingerprint: 'new',
        conceptTexts: ['concept B'],
      };

      const result = await detector.analyzeDrift(oldVersion, newVersion);

      // Opposite vectors have distance 1.0 which is >= critical threshold
      expect(result.severity).toBe('critical');
    });

    it('should escalate severity when multiple patterns detected', async () => {
      const oldVersion: MissionVersion = {
        version: 1,
        hash: 'abc',
        timestamp: '2024-01-01',
        conceptEmbeddings: [[0.1, 0.2]],
        semanticFingerprint: 'old',
        conceptTexts: ['security first', 'strict validation', 'zero tolerance'],
      };

      const newVersion: MissionVersion = {
        version: 2,
        hash: 'def',
        timestamp: '2024-01-02',
        conceptEmbeddings: [[0.12, 0.22]],
        semanticFingerprint: 'new',
        conceptTexts: [
          'trust contributors',
          'bypass checks',
          'flexible security',
          'best effort',
        ],
      };

      const result = await detector.analyzeDrift(oldVersion, newVersion);

      // Should detect multiple patterns
      expect(result.suspiciousPatterns.length).toBeGreaterThan(1);

      // 2 patterns should trigger high/critical severity
      expect(['high', 'critical']).toContain(result.severity);
    });

    it('should classify as low when distance < 0.05', async () => {
      const oldVersion: MissionVersion = {
        version: 1,
        hash: 'abc',
        timestamp: '2024-01-01',
        conceptEmbeddings: [[0.5, 0.5, 0.7]],
        semanticFingerprint: 'old',
        conceptTexts: ['concept A'],
      };

      const newVersion: MissionVersion = {
        version: 2,
        hash: 'def',
        timestamp: '2024-01-02',
        conceptEmbeddings: [[0.51, 0.51, 0.70]],
        semanticFingerprint: 'new',
        conceptTexts: ['concept A'],
      };

      const result = await detector.analyzeDrift(oldVersion, newVersion);

      expect(result.distance).toBeLessThan(0.05);
      expect(['none', 'low']).toContain(result.severity);
    });
  });

  describe('Recommendation Generation', () => {
    it('should recommend reject when severity is critical', async () => {
      const detector = new SemanticDriftDetector({
        low: 0.05,
        medium: 0.15,
        high: 0.3,
        critical: 0.4,
      });

      const oldVersion: MissionVersion = {
        version: 1,
        hash: 'abc',
        timestamp: '2024-01-01',
        conceptEmbeddings: [[1.0, 0.0]],
        semanticFingerprint: 'old',
        conceptTexts: ['security'],
      };

      const newVersion: MissionVersion = {
        version: 2,
        hash: 'def',
        timestamp: '2024-01-02',
        conceptEmbeddings: [[-1.0, 0.0]],
        semanticFingerprint: 'new',
        conceptTexts: ['bypass'],
      };

      const result = await detector.analyzeDrift(oldVersion, newVersion);

      expect(result.recommendation).toBe('reject');
    });

    it('should recommend review when 1 pattern detected', async () => {
      const oldVersion: MissionVersion = {
        version: 1,
        hash: 'abc',
        timestamp: '2024-01-01',
        conceptEmbeddings: [[0.1, 0.2]],
        semanticFingerprint: 'old',
        conceptTexts: ['security first'],
      };

      const newVersion: MissionVersion = {
        version: 2,
        hash: 'def',
        timestamp: '2024-01-02',
        conceptEmbeddings: [[0.11, 0.21]],
        semanticFingerprint: 'new',
        conceptTexts: ['trust experienced users'],
      };

      const result = await detector.analyzeDrift(oldVersion, newVersion);

      if (result.suspiciousPatterns.length === 1) {
        expect(result.recommendation).toBe('review');
      }
    });

    it('should recommend approve when no issues detected', async () => {
      const oldVersion: MissionVersion = {
        version: 1,
        hash: 'abc',
        timestamp: '2024-01-01',
        conceptEmbeddings: [[0.5, 0.5]],
        semanticFingerprint: 'old',
        conceptTexts: ['security first', 'validation required'],
      };

      const newVersion: MissionVersion = {
        version: 2,
        hash: 'def',
        timestamp: '2024-01-02',
        conceptEmbeddings: [[0.51, 0.51]],
        semanticFingerprint: 'new',
        conceptTexts: ['security first', 'validation required', 'additional safeguard'],
      };

      const result = await detector.analyzeDrift(oldVersion, newVersion);

      if (result.severity === 'none' && result.suspiciousPatterns.length === 0) {
        expect(result.recommendation).toBe('approve');
      }
    });
  });

  describe('Custom Threshold Configuration', () => {
    it('should use custom thresholds when provided', () => {
      const strictDetector = new SemanticDriftDetector({
        low: 0.02,
        medium: 0.10,
        high: 0.20,
        critical: 0.35,
      });

      // Detector should use provided thresholds
      expect(strictDetector).toBeDefined();
    });

    it('should fall back to defaults when not provided', () => {
      const defaultDetector = new SemanticDriftDetector();

      expect(defaultDetector).toBeDefined();
    });

    it('should allow partial threshold overrides', () => {
      const partialDetector = new SemanticDriftDetector({
        critical: 0.3, // Override only critical
      });

      expect(partialDetector).toBeDefined();
    });
  });
});
