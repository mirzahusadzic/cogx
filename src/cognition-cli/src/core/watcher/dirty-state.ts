/**
 * Dirty State Manager
 *
 * Manages dirty_state.json - a manifest of files that have changed
 * since last PGC update. Tracks both modified indexed files and
 * new untracked files awaiting ingestion.
 *
 * DESIGN:
 * Maintains a simple JSON file listing files out of sync with PGC.
 * Each dirty file records both the tracked hash (what's in PGC) and
 * the current hash (what's on disk) for integrity verification.
 *
 * ARCHITECTURE:
 * - Storage: JSON file at .open_cognition/dirty_state.json
 * - Validation: Uses Zod schema (DirtyStateSchema) for type safety
 * - Timestamps: Tracks when each file was detected dirty and last update time
 * - Future: Can migrate to LanceDB for lock-free concurrent access
 *
 * DESIGN RATIONALE:
 * JSON chosen for simplicity and human readability. For large projects
 * with frequent changes, consider migrating to LanceDB to enable:
 * - Lock-free concurrent access from multiple processes
 * - Faster queries on large dirty sets
 * - Co-location with pattern metadata
 *
 * @example
 * // Check and add dirty files
 * const manager = new DirtyStateManager(pgcRoot);
 * const state = await manager.read();
 * if (state.dirty_files.length > 0) {
 *   console.log(`${state.dirty_files.length} files need updating`);
 * }
 *
 * @example
 * // Add a modified file
 * await manager.addDirty({
 *   path: 'src/auth.ts',
 *   tracked_hash: 'abc123...',
 *   current_hash: 'def456...',
 *   detected_at: new Date().toISOString(),
 *   change_type: 'modified'
 * });
 *
 * @example
 * // Clean up after update
 * await manager.removeDirty('src/auth.ts');
 */

import fs from 'fs-extra';
import path from 'path';

import {
  DirtyState,
  DirtyStateSchema,
  DirtyFile,
  UntrackedFile,
} from '../types/watcher.js';

export class DirtyStateManager {
  private dirtyStatePath: string;

  constructor(private pgcRoot: string) {
    this.dirtyStatePath = path.join(pgcRoot, 'dirty_state.json');
  }

  /**
   * Read current dirty state
   *
   * Loads and validates dirty_state.json. Creates empty state if
   * file doesn't exist or is invalid.
   *
   * @returns Current dirty state (validated against schema)
   *
   * @example
   * const state = await manager.read();
   * console.log(`Modified: ${state.dirty_files.length}`);
   * console.log(`Untracked: ${state.untracked_files.length}`);
   */
  async read(): Promise<DirtyState> {
    if (!(await fs.pathExists(this.dirtyStatePath))) {
      return this.getEmptyState();
    }

    try {
      const raw = await fs.readJSON(this.dirtyStatePath);
      return DirtyStateSchema.parse(raw);
    } catch (error) {
      console.warn('Invalid dirty_state.json, resetting:', error);
      return this.getEmptyState();
    }
  }

  /**
   * Write dirty state
   *
   * Persists dirty state to disk with pretty-printing (2-space indent).
   *
   * @param state - Dirty state to write (must match DirtyStateSchema)
   *
   * @example
   * const state = await manager.read();
   * state.dirty_files.push(newDirtyFile);
   * await manager.write(state);
   */
  async write(state: DirtyState): Promise<void> {
    await fs.writeJSON(this.dirtyStatePath, state, { spaces: 2 });
  }

  /**
   * Add a modified file to dirty state
   *
   * Adds or updates a dirty file entry. If file already exists in
   * dirty_files, removes old entry before adding (ensures latest timestamp).
   *
   * @param file - Dirty file metadata (path, hashes, change type)
   *
   * @example
   * await manager.addDirty({
   *   path: 'src/auth.ts',
   *   tracked_hash: 'abc123...',
   *   current_hash: 'def456...',
   *   detected_at: new Date().toISOString(),
   *   change_type: 'modified'
   * });
   */
  async addDirty(file: DirtyFile): Promise<void> {
    const state = await this.read();

    // Remove if already exists (to update timestamp)
    state.dirty_files = state.dirty_files.filter((f) => f.path !== file.path);

    state.dirty_files.push(file);
    state.last_updated = new Date().toISOString();

    await this.write(state);
  }

  /**
   * Add an untracked file
   *
   * Tracks a new file not yet in PGC index. Used when watchUntracked
   * option is enabled to detect new files for ingestion.
   *
   * @param file - Untracked file metadata (path, current hash)
   *
   * @example
   * await manager.addUntracked({
   *   path: 'src/new-feature.ts',
   *   current_hash: 'xyz789...',
   *   detected_at: new Date().toISOString()
   * });
   */
  async addUntracked(file: UntrackedFile): Promise<void> {
    const state = await this.read();

    // Remove if already exists
    state.untracked_files = state.untracked_files.filter(
      (f) => f.path !== file.path
    );

    state.untracked_files.push(file);
    state.last_updated = new Date().toISOString();

    await this.write(state);
  }

  /**
   * Remove a file from dirty state (after successful update)
   *
   * Removes file from both dirty_files and untracked_files lists.
   * Call this after successfully updating PGC with new file content.
   *
   * @param filePath - Relative path of file to remove from dirty state
   *
   * @example
   * // After successful PGC update
   * await manager.removeDirty('src/auth.ts');
   */
  async removeDirty(filePath: string): Promise<void> {
    const state = await this.read();

    state.dirty_files = state.dirty_files.filter((f) => f.path !== filePath);
    state.untracked_files = state.untracked_files.filter(
      (f) => f.path !== filePath
    );
    state.last_updated = new Date().toISOString();

    await this.write(state);
  }

  /**
   * Clear all dirty state
   *
   * Resets dirty_state.json to empty state. Use after bulk update
   * or manual PGC rebuild.
   *
   * @example
   * // After full genesis rebuild
   * await manager.clear();
   */
  async clear(): Promise<void> {
    await this.write(this.getEmptyState());
  }

  /**
   * Check if any files are dirty
   *
   * @returns true if any files are modified or untracked
   *
   * @example
   * if (await manager.isDirty()) {
   *   console.log('PGC out of sync - run update command');
   * }
   */
  async isDirty(): Promise<boolean> {
    const state = await this.read();
    return state.dirty_files.length > 0 || state.untracked_files.length > 0;
  }

  /**
   * Get count of dirty files
   *
   * Returns breakdown of dirty files by type (modified vs untracked).
   *
   * @returns Object with modified, untracked, and total counts
   *
   * @example
   * const counts = await manager.getDirtyCounts();
   * console.log(`${counts.modified} modified, ${counts.untracked} new`);
   */
  async getDirtyCounts(): Promise<{
    modified: number;
    untracked: number;
    total: number;
  }> {
    const state = await this.read();
    return {
      modified: state.dirty_files.length,
      untracked: state.untracked_files.length,
      total: state.dirty_files.length + state.untracked_files.length,
    };
  }

  private getEmptyState(): DirtyState {
    return {
      last_updated: new Date().toISOString(),
      dirty_files: [],
      untracked_files: [],
    };
  }
}
