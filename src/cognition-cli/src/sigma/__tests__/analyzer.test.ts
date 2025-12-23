import { describe, it, expect } from 'vitest';
import { analyzeTurn, analyzeTurns } from '../analyzer.js';
import type { ConversationTurn } from '../types.js';

describe('Keyword-based Analyzer', () => {
  it('should detect overlay activation via keywords', async () => {
    const turn: ConversationTurn = {
      id: 't1',
      role: 'user',
      content: 'Let us discuss the architecture and design of this component.',
      timestamp: Date.now(),
    };

    const analysis = await analyzeTurn(turn, {});

    expect(analysis.overlay_scores.O1_structural).toBeGreaterThan(0);
    expect(analysis.overlay_scores.O2_security).toBe(0);
  });

  it('should detect mathematical/code overlay', async () => {
    const turn: ConversationTurn = {
      id: 't1',
      role: 'user',
      content: '```typescript\nconst x = 1;\n```',
      timestamp: Date.now(),
    };

    const analysis = await analyzeTurn(turn, {});
    expect(analysis.overlay_scores.O6_mathematical).toBe(8);
  });

  it('should calculate importance based on multiple factors', async () => {
    const turnShort: ConversationTurn = {
      id: 't1',
      role: 'user',
      content: 'ok',
      timestamp: Date.now(),
    };
    const turnLong: ConversationTurn = {
      id: 't2',
      role: 'user',
      content:
        'I have realized a fundamental breakthrough! The eureka moment came when I refactored the design.'.repeat(
          5
        ),
      timestamp: Date.now(),
    };

    const analysisShort = await analyzeTurn(turnShort, {});
    const analysisLong = await analyzeTurn(turnLong, {});

    expect(analysisLong.importance_score).toBeGreaterThan(
      analysisShort.importance_score
    );
    expect(analysisLong.is_paradigm_shift).toBe(true);
  });

  it('should extract semantic tags', async () => {
    const turn: ConversationTurn = {
      id: 't1',
      role: 'user',
      content: 'Check auth.ts and @types/node for AuthService implementation.',
      timestamp: Date.now(),
    };
    const analysis = await analyzeTurn(turn, {});
    expect(analysis.semantic_tags).toContain('auth.ts');
    expect(analysis.semantic_tags).toContain('@types/node');
    expect(analysis.semantic_tags).toContain('AuthService');
  });

  it('should batch analyze turns', async () => {
    const turns: ConversationTurn[] = [
      { id: '1', content: 'hello', role: 'user', timestamp: 1 },
      { id: '2', content: 'world', role: 'user', timestamp: 2 },
    ];
    const results = await analyzeTurns(turns, {});
    expect(results).toHaveLength(2);
    expect(results[0].turn_id).toBe('1');
    expect(results[1].turn_id).toBe('2');
  });
});
