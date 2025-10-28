import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import crypto from 'node:crypto';
import { TransformData } from '../types/transform.js';

/**
 * Manages the transformation log storing provenance and verification data.
 * Uses Git-style sharding (first 2 hex chars as directory) for scalability.
 */
export class TransformLog {
  private transformsPath: string;

  constructor(private pgcRoot: string) {
    this.transformsPath = path.join(this.pgcRoot, 'transforms');
  }

  /**
   * Get sharded path for a transform hash
   * Format: transforms/{first2chars}/{rest}/manifest.yaml
   * Example: abc123... -> transforms/ab/c123.../manifest.yaml
   */
  private getTransformPath(hash: string): string {
    const shard = hash.slice(0, 2);
    const rest = hash.slice(2);
    return path.join(this.transformsPath, shard, rest);
  }

  async getTransformData(hash: string): Promise<TransformData | null> {
    const transformPath = this.getTransformPath(hash);
    const manifestPath = path.join(transformPath, 'manifest.yaml');

    if (await fs.pathExists(manifestPath)) {
      const content = await fs.readFile(manifestPath, 'utf-8');
      return yaml.load(content) as TransformData;
    }
    return null;
  }

  async set(hash: string, data: TransformData): Promise<void> {
    const transformPath = this.getTransformPath(hash);
    await fs.ensureDir(transformPath);
    const manifestPath = path.join(transformPath, 'manifest.yaml');
    const yamlData = yaml.dump(data);
    await fs.writeFile(manifestPath, yamlData);
  }

  async record(
    data: Omit<TransformData, 'phi' | 'verification_result'>
  ): Promise<string> {
    // This is a simplified record method. In a real scenario, you'd have Oracles
    // to determine phi and verification_result.
    const transformData: TransformData = {
      ...data,
      phi: 1.0, // Placeholder
      verification_result: { status: 'Success' }, // Placeholder
    };

    const content = JSON.stringify(transformData);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    await this.set(hash, transformData);
    return hash;
  }

  async exists(hash: string): Promise<boolean> {
    const transformPath = this.getTransformPath(hash);
    return fs.pathExists(transformPath);
  }

  async delete(hash: string): Promise<void> {
    const transformPath = this.getTransformPath(hash);
    await fs.remove(transformPath);
  }

  /**
   * Get all transform IDs by scanning sharded directories
   */
  async getAllTransformIds(): Promise<string[]> {
    if (!(await fs.pathExists(this.transformsPath))) {
      return [];
    }

    const transformIds: string[] = [];
    const shards = await fs.readdir(this.transformsPath);

    // Scan each shard directory (00-ff)
    for (const shard of shards) {
      const shardPath = path.join(this.transformsPath, shard);
      const stat = await fs.stat(shardPath);

      if (stat.isDirectory()) {
        const entries = await fs.readdir(shardPath);
        // Reconstruct full hash: shard + entry
        for (const entry of entries) {
          transformIds.push(shard + entry);
        }
      }
    }

    return transformIds;
  }

  /**
   * Remove empty shard directories for cleanup
   */
  async removeEmptyShards(): Promise<void> {
    if (!(await fs.pathExists(this.transformsPath))) {
      return;
    }

    for (let i = 0; i < 256; i++) {
      const shard = i.toString(16).padStart(2, '0'); // '00', '01', ..., 'ff'
      const shardPath = path.join(this.transformsPath, shard);

      if (await fs.pathExists(shardPath)) {
        const entries = await fs.readdir(shardPath);
        if (entries.length === 0) {
          await fs.remove(shardPath);
        }
      }
    }
  }
}
