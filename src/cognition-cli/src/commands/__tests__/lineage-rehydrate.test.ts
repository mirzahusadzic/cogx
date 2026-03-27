import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  parseDiffTreeLine,
  isSupportedFile,
  detectBulkRename,
  classifyCommitSize,
  RenameEntry,
} from '../../core/services/rehydrate.js';
import {
  RehydrationManifest,
  RehydrationManifestData,
} from '../../core/pgc/rehydration-manifest.js';

// ---------------------------------------------------------------------------
// parseDiffTreeLine
// ---------------------------------------------------------------------------
describe('parseDiffTreeLine', () => {
  it('parses an added file (A status)', () => {
    const result = parseDiffTreeLine('A\tsrc/auth.ts');
    expect(result).toEqual({ status: 'A', newPath: 'src/auth.ts' });
  });

  it('parses a modified file (M status)', () => {
    const result = parseDiffTreeLine('M\tsrc/utils.ts');
    expect(result).toEqual({
      status: 'M',
      oldPath: 'src/utils.ts',
      newPath: 'src/utils.ts',
    });
  });

  it('parses a deleted file (D status)', () => {
    const result = parseDiffTreeLine('D\tsrc/old.ts');
    expect(result).toEqual({ status: 'D', oldPath: 'src/old.ts' });
  });

  it('parses a renamed file (R status with similarity score)', () => {
    const result = parseDiffTreeLine('R090\tsrc/old.ts\tsrc/new.ts');
    expect(result).toEqual({
      status: 'R',
      similarity: 90,
      oldPath: 'src/old.ts',
      newPath: 'src/new.ts',
    });
  });

  it('returns null for an empty line', () => {
    const result = parseDiffTreeLine('');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isSupportedFile
// ---------------------------------------------------------------------------
describe('isSupportedFile', () => {
  it('returns true for .ts files', () => {
    expect(isSupportedFile('src/auth.ts')).toBe(true);
  });

  it('returns true for .py files', () => {
    expect(isSupportedFile('src/utils.py')).toBe(true);
  });

  it('returns false for image files', () => {
    expect(isSupportedFile('image.png')).toBe(false);
  });

  it('returns true for .md files', () => {
    expect(isSupportedFile('README.md')).toBe(true);
  });

  it('returns true for .js files in dist', () => {
    expect(isSupportedFile('dist/bundle.js')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectBulkRename
// ---------------------------------------------------------------------------
describe('detectBulkRename', () => {
  it('returns null for fewer than 5 renames', () => {
    const renames: RenameEntry[] = [
      { oldPath: 'src/old/a.ts', newPath: 'src/new/a.ts', similarity: 90 },
      { oldPath: 'src/old/b.ts', newPath: 'src/new/b.ts', similarity: 90 },
    ];
    expect(detectBulkRename(renames)).toBeNull();
  });

  it('returns a BulkRenameGroup for 5 renames sharing a common prefix', () => {
    const renames: RenameEntry[] = [
      { oldPath: 'src/old/a.ts', newPath: 'src/new/a.ts', similarity: 90 },
      { oldPath: 'src/old/b.ts', newPath: 'src/new/b.ts', similarity: 90 },
      { oldPath: 'src/old/c.ts', newPath: 'src/new/c.ts', similarity: 90 },
      { oldPath: 'src/old/d.ts', newPath: 'src/new/d.ts', similarity: 90 },
      { oldPath: 'src/old/e.ts', newPath: 'src/new/e.ts', similarity: 90 },
    ];
    const result = detectBulkRename(renames);
    expect(result).not.toBeNull();
    expect(result?.pattern).toBe('src/old/* → src/new/*');
    expect(result?.count).toBe(5);
    expect(result?.files).toHaveLength(5);
  });

  it('returns null for 5 renames with no common prefix', () => {
    const renames: RenameEntry[] = [
      { oldPath: 'a/file.ts', newPath: 'b/file.ts', similarity: 90 },
      { oldPath: 'c/file.ts', newPath: 'd/file.ts', similarity: 90 },
      { oldPath: 'e/file.ts', newPath: 'f/file.ts', similarity: 90 },
      { oldPath: 'g/file.ts', newPath: 'h/file.ts', similarity: 90 },
      { oldPath: 'i/file.ts', newPath: 'j/file.ts', similarity: 90 },
    ];
    expect(detectBulkRename(renames)).toBeNull();
  });

  it('returns null for an empty array', () => {
    expect(detectBulkRename([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// classifyCommitSize
// ---------------------------------------------------------------------------
describe('classifyCommitSize', () => {
  it('classifies a tiny commit as micro', () => {
    expect(classifyCommitSize(2, 50)).toBe('micro');
  });

  it('classifies a small commit correctly', () => {
    expect(classifyCommitSize(8, 500)).toBe('small');
  });

  it('classifies a medium commit correctly', () => {
    expect(classifyCommitSize(20, 3000)).toBe('medium');
  });

  it('classifies a large commit correctly', () => {
    expect(classifyCommitSize(50, 10000)).toBe('large');
  });
});

// ---------------------------------------------------------------------------
// RehydrationManifest — read/write round-trip (real temp dirs)
// ---------------------------------------------------------------------------
describe('RehydrationManifest (from lineage-rehydrate tests)', () => {
  let tempDir: string;
  let manifest: RehydrationManifest;

  const sampleData: RehydrationManifestData = {
    last_rehydrated_commit: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    total_commits_processed: 5,
    total_transforms_recorded: 12,
    rehydrated_at: '2025-06-01T12:00:00.000Z',
    branch: 'feature/test',
    depth: 50,
    since: null,
  };

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      `rehydrate-cmd-test-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(tempDir);
    manifest = new RehydrationManifest(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('returns null when manifest file does not exist', async () => {
    expect(await manifest.read()).toBeNull();
  });

  it('persists and retrieves manifest data correctly', async () => {
    await manifest.write(sampleData);
    const result = await manifest.read();
    expect(result?.last_rehydrated_commit).toBe(
      sampleData.last_rehydrated_commit
    );
    expect(result?.depth).toBe(50);
    expect(result?.branch).toBe('feature/test');
  });
});
