import fs from 'fs-extra';
import path from 'path';

/**
 * Manages reverse dependency tracking for object-to-transform relationships.
 */
export class ReverseDeps {
  constructor(private pgcRoot: string) {}

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

  async deleteReverseDepFile(objectHash: string): Promise<void> {
    const reverseDepPath = this.getReverseDepPath(objectHash);
    if (await fs.pathExists(reverseDepPath)) {
      await fs.remove(reverseDepPath);
    }
  }

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

  private getReverseDepPath(hash: string): string {
    const dir = hash.slice(0, 2);
    const file = hash.slice(2);
    return path.join(this.pgcRoot, 'reverse_deps', dir, file);
  }
}
