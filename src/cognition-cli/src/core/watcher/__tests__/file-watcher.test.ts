import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { FileWatcher } from '../file-watcher.js';
import { Index } from '../../pgc/index.js';
import { ObjectStore } from '../../pgc/object-store.js';
import { DirtyStateManager } from '../dirty-state.js';

describe('FileWatcher', () => {
  let tempProjectDir: string;
  let tempPgcDir: string;
  let watcher: FileWatcher;
  let index: Index;
  let objectStore: ObjectStore;
  let dirtyState: DirtyStateManager;

  beforeEach(async () => {
    tempProjectDir = path.join(
      os.tmpdir(),
      `watcher-test-project-${Date.now()}`
    );
    tempPgcDir = path.join(tempProjectDir, '.open_cognition');

    await fs.ensureDir(tempProjectDir);
    await fs.ensureDir(tempPgcDir);

    index = new Index(tempPgcDir);
    objectStore = new ObjectStore(tempPgcDir);
    dirtyState = new DirtyStateManager(tempPgcDir);

    // Create a dummy file and index it
    const testFile = 'src/test.ts';
    const fullPath = path.join(tempProjectDir, testFile);
    await fs.ensureDir(path.dirname(fullPath));
    const content = 'console.log("hello");';
    await fs.writeFile(fullPath, content);

    const contentHash = objectStore.computeHash(content);
    await index.set(testFile, {
      path: testFile,
      content_hash: contentHash,
      structural_hash: 'structural-hash',
      status: 'Valid',
      history: [],
    });

    watcher = new FileWatcher(tempPgcDir, tempProjectDir, {
      debounceMs: 50, // Fast for tests
    });
    // @ts-expect-error - access private for testing
    watcher.dirtyState = dirtyState;
    // @ts-expect-error - access private for testing
    watcher.index = index;
    // @ts-expect-error - access private for testing
    watcher.objectStore = objectStore;
  });

  it('should start and emit ready', async () => {
    await watcher.start();
    expect(watcher.isRunning()).toBe(true);
  });

  it('should throw if started twice', async () => {
    await watcher.start();
    await expect(watcher.start()).rejects.toThrow('Watcher is already running');
  });

  it('should throw if no files indexed', async () => {
    const emptyPgcDir = path.join(
      os.tmpdir(),
      `watcher-test-empty-${Date.now()}`
    );
    await fs.ensureDir(emptyPgcDir);
    const emptyWatcher = new FileWatcher(emptyPgcDir, tempProjectDir);

    await expect(emptyWatcher.start()).rejects.toThrow('No files to watch');
    await fs.remove(emptyPgcDir);
  });

  it('should detect file modification', async () => {
    await watcher.start();

    // Modify the file
    const newContent = 'console.log("modified");';
    await fs.writeFile(path.join(tempProjectDir, 'src/test.ts'), newContent);

    // Manually trigger processChange to avoid chokidar flakiness in CI/Tests
    // @ts-expect-error - access private for testing
    await watcher.processChange('src/test.ts');

    const state = await dirtyState.read();
    expect(state.dirty_files).toHaveLength(1);
    expect(state.dirty_files[0].path).toBe('src/test.ts');
    expect(state.dirty_files[0].change_type).toBe('modified');
  });

  it('should detect file deletion', async () => {
    await watcher.start();

    // Delete the file
    await fs.remove(path.join(tempProjectDir, 'src/test.ts'));

    // @ts-expect-error - access private for testing
    await watcher.handleDelete('src/test.ts');

    // Check dirty state
    const state = await dirtyState.read();
    expect(state.dirty_files).toHaveLength(1);
    expect(state.dirty_files[0].change_type).toBe('deleted');
  });

  it('should detect file addition in watched directory', async () => {
    await watcher.start();

    // Add a new file in the src directory
    const newContent = 'console.log("new file");';
    await fs.writeFile(path.join(tempProjectDir, 'src/new.ts'), newContent);

    // @ts-expect-error - access private for testing
    await watcher.handleAdd('src/new.ts');

    // Check dirty state
    const state = await dirtyState.read();
    expect(state.untracked_files).toHaveLength(1);
    expect(state.untracked_files[0].path).toBe('src/new.ts');
  });

  it('should ignore changes that dont modify content', async () => {
    await watcher.start();

    const changeSpy = vi.fn();
    watcher.on('change', changeSpy);

    // Write same content (might update mtime)
    const content = await fs.readFile(
      path.join(tempProjectDir, 'src/test.ts'),
      'utf-8'
    );
    await fs.writeFile(path.join(tempProjectDir, 'src/test.ts'), content);

    // Wait some time for debounce and potential event
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(changeSpy).not.toHaveBeenCalled();

    const state = await dirtyState.read();
    expect(state.dirty_files).toHaveLength(0);
  });
});
