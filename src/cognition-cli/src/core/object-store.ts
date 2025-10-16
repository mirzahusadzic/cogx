import crypto from 'node:crypto';
import fs from 'fs-extra';
import path from 'path';

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

  private computeHash(content: string | Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private getObjectPath(hash: string): string {
    // Git-style sharding: first 2 chars as directory
    const dir = hash.slice(0, 2);
    const file = hash.slice(2);
    return path.join(this.rootPath, 'objects', dir, file);
  }
}
