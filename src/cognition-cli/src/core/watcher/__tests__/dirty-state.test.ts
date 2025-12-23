import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { DirtyStateManager } from '../dirty-state.js';

describe('DirtyStateManager', () => {
  let tempDir: string;
  let manager: DirtyStateManager;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `dirty-state-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    manager = new DirtyStateManager(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should return empty state when file does not exist', async () => {
    const state = await manager.read();
    expect(state.dirty_files).toEqual([]);
    expect(state.untracked_files).toEqual([]);
    expect(state.last_updated).toBeDefined();
  });

  it('should add a dirty file', async () => {
    const dirtyFile = {
      path: 'src/test.ts',
      tracked_hash: 'hash1',
      current_hash: 'hash2',
      detected_at: new Date().toISOString(),
      change_type: 'modified' as const,
    };

    await manager.addDirty(dirtyFile);
    const state = await manager.read();

    expect(state.dirty_files).toHaveLength(1);
    expect(state.dirty_files[0]).toEqual(dirtyFile);
  });

  it('should update timestamp when adding existing dirty file', async () => {
    const dirtyFile1 = {
      path: 'src/test.ts',
      tracked_hash: 'hash1',
      current_hash: 'hash2',
      detected_at: '2023-01-01T00:00:00.000Z',
      change_type: 'modified' as const,
    };

    const dirtyFile2 = {
      path: 'src/test.ts',
      tracked_hash: 'hash1',
      current_hash: 'hash3',
      detected_at: '2023-01-01T00:01:00.000Z',
      change_type: 'modified' as const,
    };

    await manager.addDirty(dirtyFile1);
    await manager.addDirty(dirtyFile2);

    const state = await manager.read();
    expect(state.dirty_files).toHaveLength(1);
    expect(state.dirty_files[0]).toEqual(dirtyFile2);
  });

  it('should add an untracked file', async () => {
    const untrackedFile = {
      path: 'src/new.ts',
      current_hash: 'hash1',
      detected_at: new Date().toISOString(),
    };

    await manager.addUntracked(untrackedFile);
    const state = await manager.read();

    expect(state.untracked_files).toHaveLength(1);
    expect(state.untracked_files[0]).toEqual(untrackedFile);
  });

  it('should remove a file from both dirty and untracked lists', async () => {
    const filePath = 'src/test.ts';

    await manager.addDirty({
      path: filePath,
      tracked_hash: 'hash1',
      current_hash: 'hash2',
      detected_at: new Date().toISOString(),
      change_type: 'modified',
    });

    await manager.addUntracked({
      path: filePath,
      current_hash: 'hash3',
      detected_at: new Date().toISOString(),
    });

    await manager.removeDirty(filePath);
    const state = await manager.read();

    expect(state.dirty_files).toHaveLength(0);
    expect(state.untracked_files).toHaveLength(0);
  });

  it('should clear all dirty state', async () => {
    await manager.addDirty({
      path: 'test.ts',
      tracked_hash: 'h1',
      current_hash: 'h2',
      detected_at: new Date().toISOString(),
      change_type: 'modified',
    });

    await manager.clear();
    const state = await manager.read();

    expect(state.dirty_files).toHaveLength(0);
    expect(state.untracked_files).toHaveLength(0);
  });

  it('should correctly report isDirty', async () => {
    expect(await manager.isDirty()).toBe(false);

    await manager.addDirty({
      path: 'test.ts',
      tracked_hash: 'h1',
      current_hash: 'h2',
      detected_at: new Date().toISOString(),
      change_type: 'modified',
    });

    expect(await manager.isDirty()).toBe(true);

    await manager.clear();
    expect(await manager.isDirty()).toBe(false);

    await manager.addUntracked({
      path: 'new.ts',
      current_hash: 'h3',
      detected_at: new Date().toISOString(),
    });

    expect(await manager.isDirty()).toBe(true);
  });

  it('should get dirty counts', async () => {
    await manager.addDirty({
      path: 'test1.ts',
      tracked_hash: 'h1',
      current_hash: 'h2',
      detected_at: new Date().toISOString(),
      change_type: 'modified',
    });

    await manager.addUntracked({
      path: 'test2.ts',
      current_hash: 'h3',
      detected_at: new Date().toISOString(),
    });

    const counts = await manager.getDirtyCounts();
    expect(counts).toEqual({
      modified: 1,
      untracked: 1,
      total: 2,
    });
  });

  it('should reset state if file is invalid', async () => {
    const filePath = path.join(tempDir, 'dirty_state.json');
    await fs.writeFile(filePath, 'invalid json');

    const state = await manager.read();
    expect(state.dirty_files).toEqual([]);
  });
});
