import crypto from 'node:crypto';
import fs from 'fs-extra';
import path from 'path';

/**
 * Manages content-addressable storage for immutable objects using SHA-256 hashing.
 */
export class ObjectStore {
  constructor(private rootPath: string) {}

  /**
   * Store content in content-addressable storage
   * Returns the hash of the stored object
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
   * Retrieve content by hash
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
