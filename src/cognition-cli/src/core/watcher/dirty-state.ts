import fs from 'fs-extra';
import path from 'path';

import {
  DirtyState,
  DirtyStateSchema,
  DirtyFile,
  UntrackedFile,
} from '../types/watcher.js';

/**
 * Manages the dirty_state.json file that tracks files out of sync with PGC
 *
 * Note: Currently uses JSON for simplicity. Can migrate to LanceDB later for:
 * - Lock-free concurrent access
 * - Faster queries on large dirty sets
 * - Co-location with pattern metadata
 */
export class DirtyStateManager {
  private dirtyStatePath: string;

  constructor(private pgcRoot: string) {
    this.dirtyStatePath = path.join(pgcRoot, 'dirty_state.json');
  }

  /**
   * Read current dirty state
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
   */
  async write(state: DirtyState): Promise<void> {
    await fs.writeJSON(this.dirtyStatePath, state, { spaces: 2 });
  }

  /**
   * Add a modified file to dirty state
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
   */
  async clear(): Promise<void> {
    await this.write(this.getEmptyState());
  }

  /**
   * Check if any files are dirty
   */
  async isDirty(): Promise<boolean> {
    const state = await this.read();
    return state.dirty_files.length > 0 || state.untracked_files.length > 0;
  }

  /**
   * Get count of dirty files
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
