import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateLatticeToV2 } from '../migrate-lattice-to-v2.js';
import fs from 'fs-extra';

describe('MigrateLatticeToV2', () => {
  const projectRoot = '/tmp/project';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should migrate v1 lattice to v2 by stripping embeddings', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'readdir').mockResolvedValue(['session1.lattice.json'] as any);

    const v1Content = JSON.stringify({
      nodes: [{ id: 'n1', content: 'hello', embedding: [0.1, 0.2] }],
      edges: [],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'readFile').mockResolvedValue(v1Content as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'stat').mockResolvedValue({ size: v1Content.length } as any);
    const writeFileSpy = vi
      .spyOn(fs, 'writeFile')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
      .mockResolvedValue(undefined as any);

    const result = await migrateLatticeToV2(projectRoot, { backup: false });

    expect(result.successfulMigrations).toBe(1);
    expect(writeFileSpy).toHaveBeenCalledWith(
      expect.stringContaining('session1.lattice.json'),
      expect.stringContaining('"format_version": 2'),
      'utf-8'
    );

    const writtenJson = JSON.parse(writeFileSpy.mock.calls[0][1] as string);
    expect(writtenJson.nodes[0].embedding).toBeUndefined();
    expect(writtenJson.format_version).toBe(2);
  });

  it('should skip already migrated v2 files', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'readdir').mockResolvedValue(['session2.lattice.json'] as any);

    const v2Content = JSON.stringify({
      format_version: 2,
      nodes: [{ id: 'n1', content: 'hello' }],
      edges: [],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'readFile').mockResolvedValue(v2Content as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'stat').mockResolvedValue({ size: v2Content.length } as any);
    const writeFileSpy = vi.spyOn(fs, 'writeFile');

    const result = await migrateLatticeToV2(projectRoot);

    expect(result.successfulMigrations).toBe(0);
    expect(writeFileSpy).not.toHaveBeenCalled();
  });

  it('should throw error if .sigma directory missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
    vi.spyOn(fs, 'pathExists').mockResolvedValue(false as any);
    await expect(migrateLatticeToV2(projectRoot)).rejects.toThrow(
      '.sigma directory not found'
    );
  });
});
