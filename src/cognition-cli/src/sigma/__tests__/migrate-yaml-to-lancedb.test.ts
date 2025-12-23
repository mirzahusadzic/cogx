import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateYAMLToLanceDB } from '../migrate-yaml-to-lancedb.js';
import fs from 'fs-extra';
import YAML from 'yaml';

const { mockLanceStore } = vi.hoisted(() => ({
  mockLanceStore: {
    initialize: vi.fn(),
    storeTurn: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock('../conversation-lance-store.js', () => ({
  ConversationLanceStore: vi.fn().mockImplementation(() => mockLanceStore),
}));

describe('MigrateYAMLToLanceDB', () => {
  const sigmaRoot = '/tmp/sigma';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should migrate YAML turns to LanceDB', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'readdir').mockResolvedValue(['session1.yaml'] as any);

    const yamlContent = YAML.stringify({
      session_id: 's1',
      turns: [
        {
          turn_id: 't1',
          role: 'user',
          content: 'hello',
          timestamp: 100,
          embedding: new Array(768).fill(0.1),
          project_alignment_score: 5,
          novelty: 0.1,
          importance: 5,
        },
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'readFile').mockResolvedValue(yamlContent as any);

    const result = await migrateYAMLToLanceDB(sigmaRoot, {
      overlays: ['conversation-structural'],
    });

    expect(result.successfulTurns).toBe(1);
    expect(mockLanceStore.storeTurn).toHaveBeenCalled();
  });

  it('should handle invalid embeddings', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'readdir').mockResolvedValue(['session1.yaml'] as any);

    const yamlContent = YAML.stringify({
      session_id: 's1',
      turns: [
        {
          turn_id: 't1',
          role: 'user',
          content: 'hello',
          timestamp: 100,
          embedding: [0.1], // Invalid length
          project_alignment_score: 5,
          novelty: 0.1,
          importance: 5,
        },
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'readFile').mockResolvedValue(yamlContent as any);

    const result = await migrateYAMLToLanceDB(sigmaRoot, {
      overlays: ['conversation-structural'],
    });

    expect(result.failedTurns).toBe(1);
    expect(result.errors[0].error).toContain('Invalid embedding');
  });
});
