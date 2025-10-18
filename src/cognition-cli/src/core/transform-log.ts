import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import crypto from 'node:crypto';
import { TransformData } from '../types/transform.js';

export class TransformLog {
  private transformsPath: string;

  constructor(private pgcRoot: string) {
    this.transformsPath = path.join(this.pgcRoot, 'transforms');
  }

  async getTransformData(hash: string): Promise<TransformData | null> {
    const manifestPath = path.join(this.transformsPath, hash, 'manifest.yaml');

    if (await fs.pathExists(manifestPath)) {
      const content = await fs.readFile(manifestPath, 'utf-8');
      return yaml.load(content) as TransformData;
    }
    return null;
  }

  async set(hash: string, data: TransformData): Promise<void> {
    const transformPath = path.join(this.transformsPath, hash);
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
    const transformPath = path.join(this.transformsPath, hash);
    return fs.pathExists(transformPath);
  }

  async delete(hash: string): Promise<void> {
    const transformPath = path.join(this.transformsPath, hash);
    await fs.remove(transformPath);
  }

  async getAllTransformIds(): Promise<string[]> {
    if (!(await fs.pathExists(this.transformsPath))) {
      return [];
    }
    const entries = await fs.readdir(this.transformsPath);
    return entries;
  }
}
