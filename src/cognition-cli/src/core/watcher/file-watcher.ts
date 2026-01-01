/**
 * Real-Time File System Watcher
 *
 * Monitors indexed files for changes and maintains dirty_state.json
 * for incremental PGC updates. Emits events when files are modified,
 * deleted, or added, enabling real-time synchronization between
 * source code and the Grounded Context Pool (PGC).
 *
 * DESIGN:
 * Uses chokidar for efficient file watching with debouncing to handle
 * rapid successive changes (e.g., during file saves). Only watches
 * files already in the PGC index - untracked files are ignored unless
 * watchUntracked option is enabled.
 *
 * ARCHITECTURE:
 * - EventEmitter: Emits 'change', 'error', 'ready' events
 * - Debouncing: Prevents duplicate events during rapid saves (300ms default)
 * - Hash Comparison: Detects actual content changes, not just file modifications
 * - Dirty State: Maintains dirty_state.json with tracked vs current hashes
 *
 * ALGORITHM (Change Detection):
 * 1. File modification event received from chokidar
 * 2. Debounce for 300ms (configurable)
 * 3. Read current file content and compute SHA-256 hash
 * 4. Compare against tracked hash from index
 * 5. If different, add to dirty_state.json and emit 'change' event
 * 6. If same, ignore (no actual content change)
 *
 * @example
 * // Start watching indexed files
 * const watcher = new FileWatcher(pgcRoot, projectRoot);
 * watcher.on('change', (event) => {
 *   console.log(`File ${event.type}: ${event.path}`);
 * });
 * await watcher.start();
 *
 * @example
 * // Custom debounce and ignore patterns
 * const watcher = new FileWatcher(pgcRoot, projectRoot, {
 *   debounceMs: 500,
 *   ignored: ['**\/test\/**', '**\/*.test.ts'],
 *   watchUntracked: true
 * });
 * await watcher.start();
 *
 * @example
 * // Stop watching
 * await watcher.stop();
 * console.log('Watcher stopped');
 */

import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs-extra';
import { EventEmitter } from 'events';
import { systemLog } from '../../utils/debug-logger.js';

import { Index } from '../pgc/index.js';
import { ObjectStore } from '../pgc/object-store.js';
import { DirtyStateManager } from './dirty-state.js';
import {
  ChangeEvent,
  WatcherOptions,
  DirtyFile,
  UntrackedFile,
} from '../types/watcher.js';

export class FileWatcher extends EventEmitter {
  private watcher?: FSWatcher;
  private index: Index;
  private objectStore: ObjectStore;
  private dirtyState: DirtyStateManager;
  private isWatching = false;
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Create a new FileWatcher instance
   *
   * @param pgcRoot - Path to .open_cognition directory
   * @param projectRoot - Path to project root
   * @param options - Watcher configuration options
   */
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
   *
   * Initializes chokidar watcher for all directories containing indexed files.
   * Now watches directories with glob patterns to detect new files.
   *
   * Emits:
   * - 'ready': Watcher initialized and monitoring
   * - 'change': File modified, deleted, or added
   * - 'error': Watcher encountered an error
   *
   * @throws Error if no files to watch or watcher already running
   *
   * @example
   * const watcher = new FileWatcher(pgcRoot, projectRoot);
   * watcher.on('ready', () => console.log('Watching...'));
   * watcher.on('change', (event) => {
   *   console.log(`${event.type}: ${event.path}`);
   * });
   * await watcher.start();
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      throw new Error('Watcher is already running');
    }

    // Get all indexed files to determine watch patterns
    const indexedFiles = await this.getIndexedFiles();

    if (indexedFiles.length === 0) {
      throw new Error(
        'No files to watch. Run genesis first to populate the index.'
      );
    }

    const ignored = this.options.ignored || this.getDefaultIgnored();

    // Generate glob patterns from indexed files to watch directories
    const watchPatterns = this.getWatchPatternsFromFiles(indexedFiles);

    systemLog(
      'watcher',
      `Starting file watcher for ${indexedFiles.length} indexed files (${watchPatterns.length} patterns)...`
    );

    return new Promise((resolve, reject) => {
      this.watcher = chokidar.watch(watchPatterns, {
        ignored,
        persistent: true,
        ignoreInitial: true, // Don't fire events for existing files
        cwd: this.projectRoot,
      });

      this.watcher
        .on('change', (filePath) => this.handleChange(filePath))
        .on('unlink', (filePath) => this.handleDelete(filePath))
        .on('add', (filePath) => this.handleAdd(filePath))
        .on('error', (error) => {
          const err = error instanceof Error ? error : new Error(String(error));
          if (!this.isWatching) {
            reject(err);
          } else {
            this.handleError(err);
          }
        })
        .on('ready', () => {
          this.isWatching = true;
          systemLog('watcher', 'File watcher ready');
          this.emit('ready');
          resolve();
        });
    });
  }

  /**
   * Stop watching
   *
   * Closes the chokidar watcher and cleans up resources.
   * Safe to call even if watcher is not running.
   *
   * @example
   * await watcher.stop();
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
      this.isWatching = false;
      systemLog('watcher', 'File watcher stopped');
    }
    // Clean up event listeners to prevent memory leaks
    this.removeAllListeners();
  }

  /**
   * Check if watcher is running
   *
   * @returns true if actively watching, false otherwise
   *
   * @example
   * if (watcher.isRunning()) {
   *   console.log('Watcher active');
   * }
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
        systemLog(
          'watcher',
          `File ${relativePath} changed but not in index`,
          undefined,
          'warn'
        );
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
        systemLog('watcher', `Detected change: ${relativePath}`);
      }
    } catch (error) {
      systemLog(
        'watcher',
        `Error processing change for ${relativePath}`,
        { error: error instanceof Error ? error.message : String(error) },
        'error'
      );
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
      systemLog('watcher', `Detected deletion: ${relativePath}`);
    } catch (error) {
      systemLog(
        'watcher',
        `Error processing deletion for ${relativePath}`,
        { error: error instanceof Error ? error.message : String(error) },
        'error'
      );
    }
  }

  private async handleAdd(relativePath: string): Promise<void> {
    // Note: watchUntracked option is deprecated - we now always track new files in watched directories
    try {
      // Check if already indexed
      const indexData = await this.index.get(relativePath);
      if (indexData) {
        // File is indexed, treat as change
        await this.handleChange(relativePath);
        return;
      }

      // New untracked file - add to dirty state
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
      systemLog('watcher', `Detected new file: ${relativePath}`);
    } catch (error) {
      systemLog(
        'watcher',
        `Error processing new file ${relativePath}`,
        { error: error instanceof Error ? error.message : String(error) },
        'error'
      );
    }
  }

  private handleError(error: Error): void {
    systemLog(
      'watcher',
      'File watcher error',
      { error: error.message },
      'error'
    );
    this.emit('error', error);
  }

  private async getIndexedFiles(): Promise<string[]> {
    const allData = await this.index.getAllData();
    return allData.map((d) => path.join(this.projectRoot, d.path));
  }

  /**
   * Generate glob patterns from indexed files to watch directories
   *
   * Creates glob patterns that cover all directories containing indexed files,
   * allowing detection of new files in those directories.
   *
   * @param indexedFiles - Array of absolute file paths
   * @returns Array of glob patterns (e.g., ["src/**\/*.ts", "docs/**\/*.md"])
   *
   * @example
   * // Input: ["/path/src/foo.ts", "/path/src/bar.ts", "/path/docs/README.md"]
   * // Output: ["src/**\/*.ts", "docs/**\/*.md"]
   */
  private getWatchPatternsFromFiles(indexedFiles: string[]): string[] {
    // Extract directories and file extensions from indexed files
    const directoryExtensions = new Map<string, Set<string>>();

    for (const file of indexedFiles) {
      const relativePath = path.relative(this.projectRoot, file);
      const ext = path.extname(relativePath);

      // Get top-level directory (e.g., "src", "docs", "lib")
      const parts = relativePath.split(path.sep);
      const topDir = parts[0];

      if (!directoryExtensions.has(topDir)) {
        directoryExtensions.set(topDir, new Set());
      }

      if (ext) {
        directoryExtensions.get(topDir)!.add(ext);
      }
    }

    // Generate glob patterns: topDir/**/*.ext for each directory/extension combo
    const patterns: string[] = [];

    for (const [dir, extensions] of directoryExtensions) {
      if (extensions.size === 0) {
        // No extensions found, watch all files in directory
        patterns.push(`${dir}/**/*`);
      } else {
        // Watch specific extensions
        for (const ext of extensions) {
          patterns.push(`${dir}/**/*${ext}`);
        }
      }
    }

    return patterns;
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
