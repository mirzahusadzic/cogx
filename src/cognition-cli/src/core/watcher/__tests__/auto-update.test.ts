import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { FileWatcher } from '../file-watcher.js';
import { UpdateOrchestrator } from '../../orchestrators/update.js';
import { Index } from '../../pgc/index.js';

vi.mock('../../orchestrators/update.js', () => ({
  UpdateOrchestrator: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('FileWatcher Auto-Update', () => {
  let tempProjectDir: string;
  let tempPgcDir: string;
  let watcher: FileWatcher;

  beforeEach(async () => {
    tempProjectDir = path.join(
      os.tmpdir(),
      `watcher-auto-update-test-${Math.random().toString(36).slice(2)}`
    );
    tempPgcDir = path.join(tempProjectDir, '.open_cognition');

    await fs.ensureDir(tempProjectDir);
    await fs.ensureDir(tempPgcDir);

    vi.clearAllMocks();

    // Create a dummy file and index it
    const testFile = 'src/test.ts';
    const fullPath = path.join(tempProjectDir, testFile);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, 'console.log("hello");');

    // Minimal index file for start() to succeed
    const index = new Index(tempPgcDir);
    await index.set('src/test.ts', {
      path: 'src/test.ts',
      content_hash: 'abc',
      structural_hash: 'def',
      status: 'Valid',
      history: [],
    });
  });

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
    }
    await fs.remove(tempProjectDir);
  });

  it('should trigger auto-update after debounce', async () => {
    watcher = new FileWatcher(tempPgcDir, tempProjectDir, {
      autoUpdate: true,
      autoUpdateDebounceMs: 100,
    });

    await watcher.start();

    const updateCompletePromise = new Promise<void>((resolve) => {
      watcher.on('auto-update-complete', () => resolve());
    });

    // Manually trigger a change event that schedules auto-update
    // @ts-expect-error - access private
    watcher.scheduleAutoUpdate();

    await updateCompletePromise;

    expect(UpdateOrchestrator).toHaveBeenCalled();
  });

  it('should batch multiple changes within debounce window', async () => {
    watcher = new FileWatcher(tempPgcDir, tempProjectDir, {
      autoUpdate: true,
      autoUpdateDebounceMs: 200,
    });

    await watcher.start();

    const updateCompleteSpy = vi.fn();
    watcher.on('auto-update-complete', updateCompleteSpy);

    // Trigger multiple changes
    // @ts-expect-error - access private
    watcher.scheduleAutoUpdate();
    await new Promise((resolve) => setTimeout(resolve, 50));
    // @ts-expect-error - access private
    watcher.scheduleAutoUpdate();
    await new Promise((resolve) => setTimeout(resolve, 50));
    // @ts-expect-error - access private
    watcher.scheduleAutoUpdate();

    // Wait for the debounce to expire
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Should only have called UpdateOrchestrator once
    expect(UpdateOrchestrator).toHaveBeenCalledTimes(1);
    expect(updateCompleteSpy).toHaveBeenCalledTimes(1);
  });
});
