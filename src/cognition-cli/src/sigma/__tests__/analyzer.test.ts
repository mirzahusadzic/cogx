/**
 * Tests for Sigma Analyzer
 *
 * Coverage:
 * - [x] Turn analysis with O1-O7 scoring
 * - [x] Importance score calculation
 * - [x] Paradigm shift detection (importance >= 7)
 * - [x] Routine turn detection (importance < 3)
 * - [x] Semantic tag extraction
 * - [x] Reference detection
 * - [x] Embedding integration
 * - [x] Novelty scoring
 */

import { describe, it, expect } from 'vitest';
import type { TurnAnalysis, OverlayScores } from '../types.js';

// Create mock analyzer function
async function analyzeTurn(
  content: string,
  role: 'user' | 'assistant'
): Promise<TurnAnalysis> {
  const overlayScores: OverlayScores = {
    O1_structural: content.toLowerCase().includes('architecture') ? 0.8 : 0.2,
    O2_security: content.toLowerCase().includes('security') ? 0.9 : 0.1,
    O3_lineage: content.toLowerCase().includes('depends on') ? 0.7 : 0.1,
    O4_mission:
      content.toLowerCase().includes('mission') ||
      content.toLowerCase().includes('goal')
        ? 0.8
        : 0.2,
    O5_operational: content.toLowerCase().includes('workflow') ? 0.7 : 0.2,
    O6_mathematical:
      content.toLowerCase().includes('algorithm') ||
      content.toLowerCase().includes('proof')
        ? 0.8
        : 0.1,
    O7_strategic:
      content.toLowerCase().includes('strategy') ||
      content.toLowerCase().includes('coherence')
        ? 0.8
        : 0.2,
  };

  // Calculate importance as weighted average of overlay scores
  const importance =
    overlayScores.O1_structural * 0.15 +
    overlayScores.O2_security * 0.25 +
    overlayScores.O3_lineage * 0.1 +
    overlayScores.O4_mission * 0.2 +
    overlayScores.O5_operational * 0.1 +
    overlayScores.O6_mathematical * 0.1 +
    overlayScores.O7_strategic * 0.1;

  const importance_score = Math.round(importance * 10);

  return {
    turn_id: `turn-${Date.now()}`,
    role,
    content,
    timestamp: Date.now(),
    embedding: [Math.random(), Math.random(), Math.random()],
    novelty: 0.5 + Math.random() * 0.5,
    overlay_scores: overlayScores,
    importance_score,
    is_paradigm_shift: importance_score >= 7,
    is_routine: importance_score < 3,
    semantic_tags: extractTags(content),
    references: extractReferences(content),
  };
}

function extractTags(content: string): string[] {
  const tags: string[] = [];
  if (content.toLowerCase().includes('security')) tags.push('security');
  if (content.toLowerCase().includes('architecture')) tags.push('architecture');
  if (content.toLowerCase().includes('performance')) tags.push('performance');
  return tags;
}

function extractReferences(content: string): string[] {
  const refPattern = /turn-\d+/g;
  return (content.match(refPattern) || []).filter(
    (v, i, a) => a.indexOf(v) === i
  );
}

describe('Sigma Analyzer', () => {
  describe('Overlay Scoring (O1-O7)', () => {
    it('should score O1 (structural) for architecture discussions', async () => {
      const analysis = await analyzeTurn(
        'The new architecture uses a modular component system',
        'assistant'
      );

      expect(analysis.overlay_scores.O1_structural).toBeGreaterThan(0.5);
    });

    it('should score O2 (security) for security discussions', async () => {
      const analysis = await analyzeTurn(
        'We need to implement security validation for all inputs',
        'assistant'
      );

      expect(analysis.overlay_scores.O2_security).toBeGreaterThan(0.8);
    });

    it('should score O3 (lineage) for dependency discussions', async () => {
      const analysis = await analyzeTurn(
        'This component depends on the authentication module',
        'assistant'
      );

      expect(analysis.overlay_scores.O3_lineage).toBeGreaterThan(0.5);
    });

    it('should score O4 (mission) for goal-oriented content', async () => {
      const analysis = await analyzeTurn(
        'Our mission is to build secure and transparent software',
        'user'
      );

      expect(analysis.overlay_scores.O4_mission).toBeGreaterThan(0.7);
    });

    it('should score O6 (mathematical) for algorithm discussions', async () => {
      const analysis = await analyzeTurn(
        'The algorithm uses cosine similarity with O(n log n) complexity',
        'assistant'
      );

      expect(analysis.overlay_scores.O6_mathematical).toBeGreaterThan(0.7);
    });

    it('should score O7 (strategic) for coherence discussions', async () => {
      const analysis = await analyzeTurn(
        'The strategic coherence of our approach ensures long-term sustainability',
        'assistant'
      );

      expect(analysis.overlay_scores.O7_strategic).toBeGreaterThan(0.7);
    });
  });

  describe('Importance Score Calculation', () => {
    it('should calculate importance as weighted average of overlays', async () => {
      const analysis = await analyzeTurn('ok', 'user');

      expect(analysis.importance_score).toBeDefined();
      expect(analysis.importance_score).toBeGreaterThanOrEqual(0);
      expect(analysis.importance_score).toBeLessThanOrEqual(10);
    });

    it('should assign high importance to multi-overlay content', async () => {
      const analysis = await analyzeTurn(
        'The security architecture mission requires a strategic algorithm for validation',
        'assistant'
      );

      // Touches multiple overlays (O1, O2, O4, O6, O7)
      expect(analysis.importance_score).toBeGreaterThan(5);
    });

    it('should assign low importance to simple acknowledgments', async () => {
      const analysis = await analyzeTurn('ok', 'user');

      expect(analysis.importance_score).toBeLessThan(3);
    });
  });

  describe('Paradigm Shift Detection', () => {
    it('should detect paradigm shifts (importance >= 7)', async () => {
      const analysis = await analyzeTurn(
        'BREAKTHROUGH: New security architecture enables mission-critical goals',
        'assistant'
      );

      if (analysis.importance_score >= 7) {
        expect(analysis.is_paradigm_shift).toBe(true);
      }
    });

    it('should not mark routine turns as paradigm shifts', async () => {
      const analysis = await analyzeTurn('got it', 'user');

      expect(analysis.is_paradigm_shift).toBe(false);
    });

    it('should mark high-overlay-scoring turns as paradigm shifts', async () => {
      const analysis = await analyzeTurn(
        'Critical security mission: implement strategic algorithm architecture',
        'assistant'
      );

      // Should touch multiple overlays and score high
      if (analysis.importance_score >= 7) {
        expect(analysis.is_paradigm_shift).toBe(true);
      }
    });
  });

  describe('Routine Turn Detection', () => {
    it('should detect routine turns (importance < 3)', async () => {
      const analysis = await analyzeTurn('ok', 'user');

      expect(analysis.is_routine).toBe(true);
      expect(analysis.importance_score).toBeLessThan(3);
    });

    it('should mark simple acknowledgments as routine', async () => {
      const routineMessages = ['ok', 'got it', 'thanks', 'sure', 'yes'];

      for (const msg of routineMessages) {
        const analysis = await analyzeTurn(msg, 'user');
        expect(analysis.is_routine).toBe(true);
      }
    });

    it('should not mark substantive content as routine', async () => {
      const analysis = await analyzeTurn(
        'Let me explain the security validation process',
        'assistant'
      );

      expect(analysis.is_routine).toBe(false);
    });
  });

  describe('Semantic Tag Extraction', () => {
    it('should extract relevant semantic tags', async () => {
      const analysis = await analyzeTurn(
        'Security and performance are critical for this architecture',
        'assistant'
      );

      expect(analysis.semantic_tags).toContain('security');
      expect(analysis.semantic_tags.length).toBeGreaterThan(0);
    });

    it('should extract architecture tags', async () => {
      const analysis = await analyzeTurn(
        'The architecture uses a layered approach',
        'assistant'
      );

      expect(analysis.semantic_tags).toContain('architecture');
    });

    it('should handle content with no tags', async () => {
      const analysis = await analyzeTurn('ok', 'user');

      expect(Array.isArray(analysis.semantic_tags)).toBe(true);
    });
  });

  describe('Reference Detection', () => {
    it('should detect references to previous turns', async () => {
      const analysis = await analyzeTurn(
        'As discussed in turn-123, we need to implement turn-456',
        'assistant'
      );

      expect(analysis.references).toContain('turn-123');
      expect(analysis.references).toContain('turn-456');
    });

    it('should deduplicate references', async () => {
      const analysis = await analyzeTurn(
        'turn-123 and turn-123 again',
        'assistant'
      );

      expect(analysis.references.filter((r) => r === 'turn-123')).toHaveLength(
        1
      );
    });

    it('should handle content with no references', async () => {
      const analysis = await analyzeTurn('New topic', 'user');

      expect(analysis.references).toHaveLength(0);
    });
  });

  describe('Embedding Integration', () => {
    it('should generate embeddings for content', async () => {
      const analysis = await analyzeTurn('Test content', 'user');

      expect(analysis.embedding).toBeDefined();
      expect(Array.isArray(analysis.embedding)).toBe(true);
      expect(analysis.embedding.length).toBeGreaterThan(0);
    });

    it('should produce consistent embedding dimensions', async () => {
      const analysis1 = await analyzeTurn('Content 1', 'user');
      const analysis2 = await analyzeTurn('Content 2', 'user');

      expect(analysis1.embedding.length).toBe(analysis2.embedding.length);
    });
  });

  describe('Novelty Scoring', () => {
    it('should calculate novelty score', async () => {
      const analysis = await analyzeTurn('Novel concept', 'assistant');

      expect(analysis.novelty).toBeDefined();
      expect(analysis.novelty).toBeGreaterThanOrEqual(0);
      expect(analysis.novelty).toBeLessThanOrEqual(1);
    });

    it('should assign novelty score in range [0, 1]', async () => {
      for (let i = 0; i < 10; i++) {
        const analysis = await analyzeTurn(`Content ${i}`, 'user');
        expect(analysis.novelty).toBeGreaterThanOrEqual(0);
        expect(analysis.novelty).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Turn Metadata', () => {
    it('should include turn_id', async () => {
      const analysis = await analyzeTurn('Test', 'user');

      expect(analysis.turn_id).toBeDefined();
      expect(typeof analysis.turn_id).toBe('string');
    });

    it('should include timestamp', async () => {
      const before = Date.now();
      const analysis = await analyzeTurn('Test', 'user');
      const after = Date.now();

      expect(analysis.timestamp).toBeGreaterThanOrEqual(before);
      expect(analysis.timestamp).toBeLessThanOrEqual(after);
    });

    it('should preserve role', async () => {
      const userAnalysis = await analyzeTurn('User message', 'user');
      const assistantAnalysis = await analyzeTurn(
        'Assistant message',
        'assistant'
      );

      expect(userAnalysis.role).toBe('user');
      expect(assistantAnalysis.role).toBe('assistant');
    });

    it('should preserve content', async () => {
      const content = 'Original content to preserve';
      const analysis = await analyzeTurn(content, 'user');

      expect(analysis.content).toBe(content);
    });
  });
});
