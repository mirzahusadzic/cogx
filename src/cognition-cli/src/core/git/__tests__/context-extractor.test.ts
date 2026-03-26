import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import {
  extractGitContext,
  extractGitDiffContext,
} from '../context-extractor.js';

describe('Git Context Extractor', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      `sigma-git-test-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  async function initGitRepo(dir: string) {
    await execa('git', ['init'], { cwd: dir });
    await execa('git', ['config', 'user.email', 'test@example.com'], {
      cwd: dir,
    });
    await execa('git', ['config', 'user.name', 'Test User'], { cwd: dir });
  }

  it('should return null when not in a git repo', async () => {
    const testFile = path.join(tempDir, 'test.ts');
    await fs.writeFile(testFile, 'console.log("hello")');
    const context = await extractGitContext(testFile, tempDir);
    expect(context).toBeNull();
  });

  it('should extract git context for a committed file', async () => {
    await initGitRepo(tempDir);
    const testFile = path.join(tempDir, 'test.ts');
    await fs.writeFile(testFile, 'console.log("hello")');
    await execa('git', ['add', 'test.ts'], { cwd: tempDir });
    await execa('git', ['commit', '-m', 'feat: initial commit'], {
      cwd: tempDir,
    });

    const context = await extractGitContext(testFile, tempDir);
    expect(context).not.toBeNull();
    expect(context?.author).toBe('Test User');
    expect(context?.message).toBe('feat: initial commit');
    expect(context?.commit_hash).toMatch(/^[0-9a-f]{40}$/);
    expect(context?.timestamp).toBeDefined();
  });

  it('should extract git diff context for unstaged changes', async () => {
    await initGitRepo(tempDir);
    const testFile = path.join(tempDir, 'test.ts');
    await fs.writeFile(testFile, 'line 1\nline 2\n');
    await execa('git', ['add', 'test.ts'], { cwd: tempDir });
    await execa('git', ['commit', '-m', 'initial'], { cwd: tempDir });

    // Modify file
    await fs.writeFile(testFile, 'line 1\nmodified line 2\nline 3\n');

    const diffContext = await extractGitDiffContext(testFile, tempDir);
    expect(diffContext).not.toBeNull();
    expect(diffContext?.insertions).toBe(2);
    expect(diffContext?.deletions).toBe(1);
    expect(diffContext?.hunks.length).toBeGreaterThan(0);
    expect(diffContext?.hunks[0]).toContain('@@');
  });

  it('should return null for a new uncommitted file', async () => {
    await initGitRepo(tempDir);
    const testFile = path.join(tempDir, 'new.ts');
    await fs.writeFile(testFile, 'new content');

    const context = await extractGitContext(testFile, tempDir);
    expect(context).toBeNull();
  });
});
