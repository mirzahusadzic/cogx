import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compactConversationLanceDB } from '../compact-lancedb.js';
import fs from 'fs-extra';
import * as lancedb from '@lancedb/lancedb';

vi.mock('@lancedb/lancedb', () => ({
  connect: vi.fn(),
}));

describe('CompactLanceDB', () => {
  const projectRoot = '/tmp/project';

  const mockTable = {
    query: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        { id: 't1', content: 'c1', embedding: [0.1] },
        { id: 't1', content: 'c1-updated', embedding: [0.2] }, // Duplicate
      ]),
    }),
  };

  const mockDb = {
    openTable: vi.fn().mockResolvedValue(mockTable),
    dropTable: vi.fn().mockResolvedValue(undefined),
    createTable: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lancedb.connect as any).mockResolvedValue(mockDb);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(fs, 'readdir').mockResolvedValue([
      { name: 'file1', isDirectory: () => false },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(fs, 'stat').mockResolvedValue({ size: 1000 } as any);
  });

  it('should compact and deduplicate records', async () => {
    const result = await compactConversationLanceDB(projectRoot);

    expect(result.reduction.percentage).toBeDefined();
    expect(mockDb.dropTable).toHaveBeenCalledWith('conversation_turns');
    expect(mockDb.createTable).toHaveBeenCalledWith(
      'conversation_turns',
      [expect.objectContaining({ id: 't1', content: 'c1-updated' })],
      expect.any(Object)
    );
  });

  it('should return metrics for dry run without changes', async () => {
    const result = await compactConversationLanceDB(projectRoot, {
      dryRun: true,
    });

    expect(result.reduction.bytes).toBe(0);
    expect(mockDb.dropTable).not.toHaveBeenCalled();
  });

  it('should throw error if database not found', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(fs, 'pathExists').mockResolvedValue(false as any);
    await expect(compactConversationLanceDB(projectRoot)).rejects.toThrow(
      'LanceDB not found'
    );
  });
});
