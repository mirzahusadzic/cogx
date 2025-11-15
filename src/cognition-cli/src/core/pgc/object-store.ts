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
  constructor(private rootPath: string) {}

  /**
   * Store content in content-addressable storage.
   *
   * @param content - Content to store (structural data, documents, etc.)
   * @returns SHA-256 hash of the content (storage key)
   *
   * @example
   * const hash = await store.store(JSON.stringify({ class: 'Foo' }));
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
   * Retrieve content by hash.
   *
   * @param hash - SHA-256 hash of content
   * @returns Content buffer
   * @throws {Error} If object doesn't exist
   */
  async retrieve(hash: string): Promise<Buffer> {
    const objectPath = this.getObjectPath(hash);
    return await fs.readFile(objectPath);
  }

  /**
   * Check if object exists
   */
  async exists(hash: string): Promise<boolean> {
    return await fs.pathExists(this.getObjectPath(hash));
  }

  /**
   * Delete content by hash
   */
  async delete(hash: string): Promise<void> {
    const objectPath = this.getObjectPath(hash);
    if (await fs.pathExists(objectPath)) {
      await fs.remove(objectPath);
    }
  }

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

  computeHash(content: string | Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private getObjectPath(hash: string): string {
    // Git-style sharding: first 2 chars as directory
    const dir = hash.slice(0, 2);
    const file = hash.slice(2);
    return path.join(this.rootPath, 'objects', dir, file);
  }
}
