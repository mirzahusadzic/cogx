import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntentResolver } from '../intent-resolver.js';
import { IntentAdapter } from '../intent-adapter.js';
import { EGemmaClient } from '../egemma-client.js';

describe('IntentResolver', () => {
  let adapter: IntentAdapter;
  let egemma: EGemmaClient;
  let resolver: IntentResolver;

  beforeEach(() => {
    adapter = {
      getPendingIntents: vi.fn().mockResolvedValue([]),
    } as unknown as IntentAdapter;

    egemma = {
      synthesizeIntent: vi.fn(),
    } as unknown as EGemmaClient;

    resolver = new IntentResolver(adapter, egemma, true);
  });

  it('should prioritize agent-declared intent', async () => {
    vi.mocked(adapter.getPendingIntents).mockResolvedValue([
      {
        file_path: 'src/test.ts',
        intent: 'Agent intent',
        confidence: 0.99,
        source: { type: 'ai_agent', identifier: 'tui' },
      },
    ]);

    const result = await resolver.resolve(
      'src/test.ts',
      'commit msg',
      'diff',
      null
    );
    expect(result.intent).toBe('Agent intent');
    expect(result.source_method).toBe('agent_declared');
    expect(result.confidence).toBe(0.99);
  });

  it('should use quality commit messages when no agent intent exists', async () => {
    const result = await resolver.resolve(
      'src/test.ts',
      'feat(auth): implement session validation\n\nThis adds JWT checks to all routes.',
      'diff',
      null
    );

    expect(result.intent).toBe('feat(auth): implement session validation');
    expect(result.source_method).toBe('commit_message');
    expect(result.confidence).toBe(0.8);
  });

  it('should synthesize intent via eGemma for low-quality messages', async () => {
    vi.mocked(egemma.synthesizeIntent).mockResolvedValue({
      commit_intent: 'Synthesized overall intent',
      files: [
        {
          path: 'src/test.ts',
          intent: 'Synthesized file intent',
          category: 'refactor',
        },
      ],
      confidence: 0.9,
    });

    const result = await resolver.resolve('src/test.ts', 'fix', 'diff', null);

    expect(result.intent).toBe('Synthesized file intent');
    expect(result.source_method).toBe('egemma_synthesized');
    // 0.9 * 0.7 = 0.63
    expect(result.confidence).toBeCloseTo(0.63);
  });

  it('should fallback to raw message for very low-quality context', async () => {
    resolver = new IntentResolver(adapter, egemma, false); // synthesize disabled
    const result = await resolver.resolve('src/test.ts', 'wip', null, null);

    expect(result.intent).toBe('wip');
    expect(result.source_method).toBe('fallback');
    expect(result.confidence).toBe(0.3);
  });
});
