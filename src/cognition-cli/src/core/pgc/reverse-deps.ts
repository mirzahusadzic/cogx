/**
 * Reverse Dependency Tracking for Grounded Context Pool (PGC)
 *
 * Manages bidirectional relationships between PGC objects and the transforms
 * that produce or consume them. This enables efficient dependency graph traversal
 * and impact analysis.
 *
 * DESIGN:
 * - Object-to-Transform Index: Maps content hashes to transform IDs
 * - Git-style Sharding: Distributes files across 256 directories (00-ff)
 * - Plain Text Storage: One transform ID per line for human readability
 * - Incremental Updates: Add/remove individual dependencies without rewriting
 *
 * STORAGE STRUCTURE:
 * ```
 * .open_cognition/reverse_deps/
 *   a7/                           # Shard (first 2 chars of hash)
 *     f3d8e1...                   # Object hash (remaining chars)
 *       transform-id-1
 *       transform-id-2
 * ```
 *
 * USE CASES:
 * - Impact Analysis: "Which transforms are affected if this object changes?"
 * - Garbage Collection: "Can I safely delete this object?"
 * - Provenance Tracking: "How was this object created?"
 * - Change Propagation: "What needs to be recomputed?"
 *
 * @example
 * // Track that transform T1 produces object O1
 * const reverseDeps = new ReverseDeps(pgcRoot);
 * await reverseDeps.add('a7f3d8e1...', 'transform-id-1');
 *
 * @example
 * // Find all transforms that depend on object O1
 * const transforms = await reverseDeps.getTransformIds('a7f3d8e1...');
 * console.log(`${transforms.length} transforms depend on this object`);
 *
 * @example
 * // Remove dependency when transform is deleted
 * await reverseDeps.delete('a7f3d8e1...', 'transform-id-1');
 * await reverseDeps.removeEmptyShardedDirectories();
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Manages reverse dependency tracking for object-to-transform relationships.
 *
 * Maps PGC object hashes to the set of transform IDs that reference them.
 * Enables efficient bidirectional graph traversal and impact analysis.
 */
export class ReverseDeps {
  /**
   * Create a new reverse dependency manager
   *
   * @param pgcRoot - Root directory of PGC (.open_cognition)
   */
  constructor(private pgcRoot: string) {}

  /**
   * Add a reverse dependency: "transform T depends on object O"
   *
   * ALGORITHM:
   * 1. Load existing dependencies from file (if exists)
   * 2. Add new transform ID to set (deduplicates automatically)
   * 3. Write updated set back to file (one ID per line)
   *
   * IDEMPOTENT: Safe to call multiple times with same arguments.
   *
   * @param objectHash - Content hash of the object (full hash, will be sharded)
   * @param transformId - ID of the transform that depends on this object
   *
   * @example
   * // Record that structural analysis transform depends on source file object
   * await reverseDeps.add(
   *   'a7f3d8e1...', // Source file content hash
   *   '9c2b5a4...'  // Structural analysis transform ID
   * );
   */
  async add(objectHash: string, transformId: string): Promise<void> {
    const reverseDepPath = this.getReverseDepPath(objectHash);
    await fs.ensureDir(path.dirname(reverseDepPath));

    const existingDeps: Set<string> = new Set();
    if (await fs.pathExists(reverseDepPath)) {
      const content = await fs.readFile(reverseDepPath, 'utf-8');
      content.split('\n').forEach((dep) => {
        const trimmedDep = dep.trim();
        if (trimmedDep) {
          existingDeps.add(trimmedDep);
        }
      });
    }

    if (!existingDeps.has(transformId)) {
      existingDeps.add(transformId);
      const newContent = Array.from(existingDeps).join('\n') + '\n';
      await fs.writeFile(reverseDepPath, newContent);
    }
  }

  /**
   * Remove a reverse dependency: "transform T no longer depends on object O"
   *
   * ALGORITHM:
   * 1. Load existing dependencies from file
   * 2. Remove transform ID from set
   * 3. Write updated set back to file
   *
   * IDEMPOTENT: Safe to call even if dependency doesn't exist.
   * NOTE: Does NOT delete the file if it becomes empty (use removeEmptyShardedDirectories).
   *
   * @param objectHash - Content hash of the object
   * @param transformId - ID of the transform to remove
   *
   * @example
   * // Remove dependency when transform is invalidated
   * await reverseDeps.delete('a7f3d8e1...', 'outdated-transform-id');
   */
  async delete(objectHash: string, transformId: string): Promise<void> {
    const reverseDepPath = this.getReverseDepPath(objectHash);

    if (!(await fs.pathExists(reverseDepPath))) {
      return;
    }

    const existingDeps: Set<string> = new Set();
    const content = await fs.readFile(reverseDepPath, 'utf-8');
    content.split('\n').forEach((dep) => {
      const trimmedDep = dep.trim();
      if (trimmedDep) {
        existingDeps.add(trimmedDep);
      }
    });

    if (existingDeps.has(transformId)) {
      existingDeps.delete(transformId);
      const newContent = Array.from(existingDeps).join('\n') + '\n';
      await fs.writeFile(reverseDepPath, newContent);
    }
  }

  /**
   * Get all object hashes that have reverse dependencies
   *
   * ALGORITHM:
   * 1. Scan all shard directories (00-ff)
   * 2. List all files in each shard
   * 3. Reconstruct full hash from shard prefix + filename
   *
   * @returns Array of object hashes (full hashes, not sharded)
   *
   * @example
   * // Find all tracked objects
   * const hashes = await reverseDeps.getAllReverseDepHashes();
   * console.log(`Tracking ${hashes.length} objects`);
   *
   * @example
   * // Check if specific object is tracked
   * const allHashes = await reverseDeps.getAllReverseDepHashes();
   * if (allHashes.includes(myObjectHash)) {
   *   console.log('Object has dependencies');
   * }
   */
  async getAllReverseDepHashes(): Promise<string[]> {
    const reverseDepsRoot = path.join(this.pgcRoot, 'reverse_deps');
    if (!(await fs.pathExists(reverseDepsRoot))) {
      return [];
    }

    const hashes: string[] = [];
    const level1Dirs = await fs.readdir(reverseDepsRoot);
    for (const level1Dir of level1Dirs) {
      const level1Path = path.join(reverseDepsRoot, level1Dir);
      if ((await fs.stat(level1Path)).isDirectory()) {
        const files = await fs.readdir(level1Path);
        for (const file of files) {
          hashes.push(level1Dir + file);
        }
      }
    }
    return hashes;
  }

  /**
   * Get all transforms that depend on a specific object
   *
   * Core operation for impact analysis: "What breaks if I change this object?"
   *
   * @param objectHash - Content hash of the object
   * @returns Array of transform IDs (empty if object has no dependencies)
   *
   * @example
   * // Find transforms affected by source file change
   * const dependentTransforms = await reverseDeps.getTransformIds(fileHash);
   * for (const transformId of dependentTransforms) {
   *   console.log(`Need to invalidate transform: ${transformId}`);
   *   await transformLog.markInvalid(transformId);
   * }
   *
   * @example
   * // Check if object can be safely deleted
   * const deps = await reverseDeps.getTransformIds(objectHash);
   * if (deps.length === 0) {
   *   console.log('Safe to delete - no dependencies');
   *   await objectStore.delete(objectHash);
   * }
   */
  async getTransformIds(objectHash: string): Promise<string[]> {
    const reverseDepPath = this.getReverseDepPath(objectHash);
    if (!(await fs.pathExists(reverseDepPath))) {
      return [];
    }
    const content = await fs.readFile(reverseDepPath, 'utf-8');
    return content
      .split('\n')
      .map((dep) => dep.trim())
      .filter(Boolean);
  }

  /**
   * Delete the entire reverse dependency file for an object
   *
   * Use when deleting an object from the store. More aggressive than
   * `delete()` which removes individual transform entries.
   *
   * @param objectHash - Content hash of the object
   *
   * @example
   * // Clean up when deleting object
   * await objectStore.delete(objectHash);
   * await reverseDeps.deleteReverseDepFile(objectHash);
   * await reverseDeps.removeEmptyShardedDirectories();
   */
  async deleteReverseDepFile(objectHash: string): Promise<void> {
    const reverseDepPath = this.getReverseDepPath(objectHash);
    if (await fs.pathExists(reverseDepPath)) {
      await fs.remove(reverseDepPath);
    }
  }

  /**
   * Clean up empty shard directories (garbage collection)
   *
   * ALGORITHM:
   * Scans all 256 possible shard directories (00-ff) and removes any
   * that are empty. Should be called periodically after deletions.
   *
   * PERFORMANCE: O(256) directory scans, but most will be no-ops.
   *
   * @example
   * // After batch deletion
   * for (const hash of objectsToDelete) {
   *   await reverseDeps.deleteReverseDepFile(hash);
   * }
   * await reverseDeps.removeEmptyShardedDirectories();
   *
   * @example
   * // Periodic cleanup in GC routine
   * const gc = new GarbageCollector(pgcRoot);
   * await gc.collectUnreachableObjects();
   * await reverseDeps.removeEmptyShardedDirectories();
   */
  async removeEmptyShardedDirectories(): Promise<void> {
    const reverseDepsRoot = path.join(this.pgcRoot, 'reverse_deps');
    if (!(await fs.pathExists(reverseDepsRoot))) {
      return;
    }

    for (let i = 0; i < 256; i++) {
      const dir = i.toString(16).padStart(2, '0'); // '00', '01', ..., 'ff'
      const shardedDirPath = path.join(reverseDepsRoot, dir);
      if (await fs.pathExists(shardedDirPath)) {
        const files = await fs.readdir(shardedDirPath);
        if (files.length === 0) {
          await fs.remove(shardedDirPath);
        }
      }
    }
  }

  /**
   * Get filesystem path for an object's reverse dependency file
   *
   * SHARDING STRATEGY:
   * - First 2 hex chars (00-ff) become directory name
   * - Remaining chars become filename
   * - Distributes 16^2 = 256 shards for balanced directory sizes
   *
   * @param hash - Full object hash
   * @returns Absolute path to reverse dependency file
   *
   * @example
   * // Input:  'a7f3d8e1...'
   * // Output: '.open_cognition/reverse_deps/a7/f3d8e1...'
   */
  private getReverseDepPath(hash: string): string {
    const dir = hash.slice(0, 2);
    const file = hash.slice(2);
    return path.join(this.pgcRoot, 'reverse_deps', dir, file);
  }
}
