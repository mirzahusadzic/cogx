import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs-extra';
import { EventEmitter } from 'events';

import { Index } from '../pgc/index.js';
import { ObjectStore } from '../pgc/object-store.js';
import { DirtyStateManager } from './dirty-state.js';
import {
  ChangeEvent,
  WatcherOptions,
  DirtyFile,
  UntrackedFile,
} from '../types/watcher.js';

/**
 * File system watcher that tracks changes to indexed files
 * and maintains dirty_state.json
 */
export class FileWatcher extends EventEmitter {
  private watcher?: FSWatcher;
  private index: Index;
  private objectStore: ObjectStore;
  private dirtyState: DirtyStateManager;
  private isWatching = false;
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private pgcRoot: string,
    private projectRoot: string,
    private options: WatcherOptions = {}
  ) {
    super();
    this.index = new Index(pgcRoot);
    this.objectStore = new ObjectStore(pgcRoot);
    this.dirtyState = new DirtyStateManager(pgcRoot);
  }

  /**
   * Start watching for file changes
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      throw new Error('Watcher is already running');
    }

    // Get all indexed files to watch
    const indexedFiles = await this.getIndexedFiles();

    if (indexedFiles.length === 0) {
      throw new Error(
        'No files to watch. Run genesis first to populate the index.'
      );
    }

    const ignored = this.options.ignored || this.getDefaultIgnored();

    console.log(`Starting file watcher for ${indexedFiles.length} files...`);

    this.watcher = chokidar.watch(indexedFiles, {
      ignored,
      persistent: true,
      ignoreInitial: true, // Don't fire events for existing files
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
      cwd: this.projectRoot,
    });

    this.watcher
      .on('change', (filePath) => this.handleChange(filePath))
      .on('unlink', (filePath) => this.handleDelete(filePath))
      .on('add', (filePath) => this.handleAdd(filePath))
      .on('error', (error) =>
        this.handleError(
          error instanceof Error ? error : new Error(String(error))
        )
      )
      .on('ready', () => {
        this.isWatching = true;
        console.log('File watcher ready');
        this.emit('ready');
      });
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
      this.isWatching = false;
      console.log('File watcher stopped');
    }
  }

  /**
   * Check if watcher is running
   */
  isRunning(): boolean {
    return this.isWatching;
  }

  private async handleChange(relativePath: string): Promise<void> {
    // Debounce rapid changes to the same file
    const debounceMs = this.options.debounceMs || 300;

    if (this.debounceTimers.has(relativePath)) {
      clearTimeout(this.debounceTimers.get(relativePath)!);
    }

    this.debounceTimers.set(
      relativePath,
      setTimeout(async () => {
        await this.processChange(relativePath);
        this.debounceTimers.delete(relativePath);
      }, debounceMs)
    );
  }

  private async processChange(relativePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.projectRoot, relativePath);

      // Get tracked hash from index
      const indexData = await this.index.get(relativePath);
      if (!indexData) {
        console.warn(`File ${relativePath} changed but not in index`);
        return;
      }

      // Compute current hash
      const content = await fs.readFile(fullPath);
      const currentHash = this.objectStore.computeHash(content);

      // If hash differs, mark as dirty
      if (currentHash !== indexData.content_hash) {
        const dirtyFile: DirtyFile = {
          path: relativePath,
          tracked_hash: indexData.content_hash,
          current_hash: currentHash,
          detected_at: new Date().toISOString(),
          change_type: 'modified',
        };

        await this.dirtyState.addDirty(dirtyFile);

        const event: ChangeEvent = {
          type: 'modified',
          path: relativePath,
          timestamp: Date.now(),
          hash: currentHash,
        };

        this.emit('change', event);
        console.log(`Detected change: ${relativePath}`);
      }
    } catch (error) {
      console.error(`Error processing change for ${relativePath}:`, error);
    }
  }

  private async handleDelete(relativePath: string): Promise<void> {
    try {
      const indexData = await this.index.get(relativePath);
      if (!indexData) {
        return;
      }

      const dirtyFile: DirtyFile = {
        path: relativePath,
        tracked_hash: indexData.content_hash,
        detected_at: new Date().toISOString(),
        change_type: 'deleted',
      };

      await this.dirtyState.addDirty(dirtyFile);

      const event: ChangeEvent = {
        type: 'deleted',
        path: relativePath,
        timestamp: Date.now(),
      };

      this.emit('change', event);
      console.log(`Detected deletion: ${relativePath}`);
    } catch (error) {
      console.error(`Error processing deletion for ${relativePath}:`, error);
    }
  }

  private async handleAdd(relativePath: string): Promise<void> {
    if (!this.options.watchUntracked) {
      return;
    }

    try {
      // Check if already indexed
      const indexData = await this.index.get(relativePath);
      if (indexData) {
        // File is indexed, treat as change
        await this.handleChange(relativePath);
        return;
      }

      // New untracked file
      const fullPath = path.join(this.projectRoot, relativePath);
      const content = await fs.readFile(fullPath);
      const currentHash = this.objectStore.computeHash(content);

      const untrackedFile: UntrackedFile = {
        path: relativePath,
        current_hash: currentHash,
        detected_at: new Date().toISOString(),
      };

      await this.dirtyState.addUntracked(untrackedFile);

      const event: ChangeEvent = {
        type: 'added',
        path: relativePath,
        timestamp: Date.now(),
        hash: currentHash,
      };

      this.emit('change', event);
      console.log(`Detected new file: ${relativePath}`);
    } catch (error) {
      console.error(`Error processing new file ${relativePath}:`, error);
    }
  }

  private handleError(error: Error): void {
    console.error('File watcher error:', error);
    this.emit('error', error);
  }

  private async getIndexedFiles(): Promise<string[]> {
    const allData = await this.index.getAllData();
    return allData.map((d) => path.join(this.projectRoot, d.path));
  }

  private getDefaultIgnored(): string[] {
    return [
      '**/node_modules/**',
      '**/.git/**',
      '**/.open_cognition/**',
      '**/dist/**',
      '**/build/**',
      '**/.DS_Store',
      '**/__pycache__/**',
      '**/.pytest_cache/**',
      '**/.venv/**',
      '**/coverage/**',
    ];
  }
}
