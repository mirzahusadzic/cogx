import crypto from 'node:crypto';
import fs from 'fs-extra';
import path from 'path';

/**
 * Content-Addressable Object Store
 *
 * Git-style content-addressable storage for immutable objects using SHA-256 hashing.
 * This is the foundational layer of the PGC system - all derived data is stored here.
 *
 * ARCHITECTURE:
 * - Content-addressable: hash(content) → storage location
 * - Immutable: objects never change (hash guarantees identity)
 * - Deduplication: same content → same hash → stored once
 * - Git-style sharding: first 2 chars of hash as directory (256 buckets)
 *
 * STORAGE LAYOUT:
 * .open_cognition/objects/<2-char-prefix>/<remaining-hash>
 * Example: hash 7f3a9b2c... → objects/7f/3a9b2c...
 *
 * BENEFITS:
 * - Automatic deduplication (same structural pattern stored once)
 * - Cache invalidation (different content → different hash)
 * - Provenance (hash proves content hasn't changed)
 * - Efficient lookup (O(1) via hash)
 *
 * @example
 * const store = new ObjectStore('/path/to/.open_cognition');
 *
 * // Store structural data
 * const hash = await store.store(JSON.stringify(structuralData));
 *
 * // Retrieve by hash
 * const data = await store.retrieve(hash);
 * const structural = JSON.parse(data.toString());
 *
 * @example
 * // Check existence without loading
 * if (await store.exists(hash)) {
 *   console.log('Pattern already processed');
 * }
 */
export class ObjectStore {
  /**
   * Creates a new ObjectStore instance.
   *
   * @constructor
   * @param {string} rootPath - Path to PGC root directory (`.open_cognition`)
   *
   * @example
   * const store = new ObjectStore('/path/to/project/.open_cognition');
   */
  constructor(private rootPath: string) {}

  /**
   * Stores content in content-addressable storage.
   *
   * Computes SHA-256 hash of content and stores it in a git-style sharded
   * directory structure. Automatically deduplicates - if content with same
   * hash already exists, it won't be written again.
   *
   * @async
   * @param {string | Buffer} content - Content to store (structural data, documents, etc.)
   * @returns {Promise<string>} SHA-256 hash of the content (storage key)
   *
   * @throws {Error} If file write fails
   *
   * @remarks
   * This method is idempotent - calling it multiple times with the same
   * content will return the same hash and only store once.
   *
   * @example
   * // Store JSON data
   * const hash = await store.store(JSON.stringify({ class: 'Foo' }));
   * // → '7f3a9b2c...'
   *
   * @example
   * // Store buffer
   * const buffer = Buffer.from('source code');
   * const hash = await store.store(buffer);
   *
   * @see {@link retrieve} to retrieve stored content
   */
  async store(content: string | Buffer): Promise<string> {
    const hash = this.computeHash(content);
    const objectPath = this.getObjectPath(hash);

    // Only write if it doesn't exist (deduplication)
    if (!(await fs.pathExists(objectPath))) {
      await fs.ensureDir(path.dirname(objectPath));
      await fs.writeFile(objectPath, content);
    }

    return hash;
  }

  /**
   * Retrieves content by its SHA-256 hash.
   *
   * Reads the object file from the sharded directory structure.
   *
   * @async
   * @param {string} hash - SHA-256 hash of content to retrieve
   * @returns {Promise<Buffer>} Content buffer
   *
   * @throws {Error} If object doesn't exist or read fails
   *
   * @example
   * const buffer = await store.retrieve('7f3a9b2c...');
   * const data = JSON.parse(buffer.toString());
   *
   * @example
   * // With error handling
   * try {
   *   const content = await store.retrieve(hash);
   * } catch (err) {
   *   console.error('Object not found:', hash);
   * }
   *
   * @see {@link store} to store content
   * @see {@link exists} to check existence before retrieval
   */
  async retrieve(hash: string): Promise<Buffer> {
    const objectPath = this.getObjectPath(hash);
    return await fs.readFile(objectPath);
  }

  /**
   * Checks if an object exists in the store.
   *
   * Useful for deduplication checks and cache invalidation logic.
   *
   * @async
   * @param {string} hash - SHA-256 hash to check
   * @returns {Promise<boolean>} True if object exists, false otherwise
   *
   * @example
   * if (await store.exists(hash)) {
   *   console.log('Object already stored');
   * } else {
   *   await store.store(content);
   * }
   *
   * @see {@link store} which handles existence checks internally
   */
  async exists(hash: string): Promise<boolean> {
    return await fs.pathExists(this.getObjectPath(hash));
  }

  /**
   * Deletes an object from the store.
   *
   * Removes the object file from disk. No-op if object doesn't exist.
   *
   * @async
   * @param {string} hash - SHA-256 hash of object to delete
   * @returns {Promise<void>}
   *
   * @remarks
   * Use with caution - deleted objects cannot be recovered. Ensure no
   * index or overlay references remain before deleting.
   *
   * @example
   * await store.delete('7f3a9b2c...');
   *
   * @see {@link removeEmptyShardedDirectories} to clean up empty directories after deletion
   */
  async delete(hash: string): Promise<void> {
    const objectPath = this.getObjectPath(hash);
    if (await fs.pathExists(objectPath)) {
      await fs.remove(objectPath);
    }
  }

  /**
   * Removes empty sharded directories after object deletion.
   *
   * Cleans up the 256 shard directories (00-ff) by removing any that are empty.
   * This prevents filesystem clutter after bulk deletions.
   *
   * @async
   * @returns {Promise<void>}
   *
   * @remarks
   * This operation is safe to run periodically or after bulk deletions.
   * It iterates through all 256 possible shard directories (00-ff).
   *
   * @example
   * // After bulk deletion
   * for (const hash of hashesToDelete) {
   *   await store.delete(hash);
   * }
   * await store.removeEmptyShardedDirectories();
   *
   * @see {@link delete} for single object deletion
   */
  async removeEmptyShardedDirectories(): Promise<void> {
    const objectsRoot = path.join(this.rootPath, 'objects');
    if (!(await fs.pathExists(objectsRoot))) {
      return;
    }

    for (let i = 0; i < 256; i++) {
      const dir = i.toString(16).padStart(2, '0'); // '00', '01', ..., 'ff'
      const shardedDirPath = path.join(objectsRoot, dir);
      if (await fs.pathExists(shardedDirPath)) {
        const files = await fs.readdir(shardedDirPath);
        if (files.length === 0) {
          await fs.remove(shardedDirPath);
        }
      }
    }
  }

  /**
   * Computes SHA-256 hash of content.
   *
   * This is a public utility method that can be used to compute hashes
   * without storing content (e.g., for cache invalidation checks).
   *
   * @param {string | Buffer} content - Content to hash
   * @returns {string} SHA-256 hash as hex string (64 characters)
   *
   * @example
   * const hash = store.computeHash('hello world');
   * // → 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
   *
   * @example
   * // Check if content changed
   * const oldHash = '7f3a9b2c...';
   * const newHash = store.computeHash(newContent);
   * if (oldHash !== newHash) {
   *   console.log('Content changed, re-process');
   * }
   *
   * @see {@link store} which calls this internally
   */
  computeHash(content: string | Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Gets the filesystem path for an object hash.
   *
   * Uses git-style sharding: first 2 chars of hash as directory,
   * remaining chars as filename. This creates 256 buckets (00-ff)
   * to prevent filesystem limitations on directory size.
   *
   * @private
   * @param {string} hash - SHA-256 hash
   * @returns {string} Full path to object file
   *
   * @example
   * // For hash '7f3a9b2c...'
   * getObjectPath('7f3a9b2c...')
   * // → '/path/.open_cognition/objects/7f/3a9b2c...'
   */
  private getObjectPath(hash: string): string {
    // Git-style sharding: first 2 chars as directory
    const dir = hash.slice(0, 2);
    const file = hash.slice(2);
    return path.join(this.rootPath, 'objects', dir, file);
  }
}
