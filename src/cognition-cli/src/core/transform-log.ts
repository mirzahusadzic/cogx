import fs from 'fs-extra';
import path from 'path';
import crypto from 'node:crypto';

import { TransformData } from '../types/transform.js';

export class TransformLog {
  constructor(private pgcRoot: string) {}

  async record(transform: TransformData): Promise<string> {
    const transformId = this.generateTransformId(transform);

    const logPath = path.join(
      this.pgcRoot,
      'transforms',
      transformId,
      'manifest.json'
    );

    await fs.ensureDir(path.dirname(logPath));
    await fs.writeJSON(logPath, transform, { spaces: 2 });

    return transformId;
  }

  async delete(transformId: string): Promise<void> {
    const transformPath = path.join(this.pgcRoot, 'transforms', transformId);
    if (await fs.pathExists(transformPath)) {
      await fs.remove(transformPath);
    }
  }

  async exists(transformId: string): Promise<boolean> {
    const transformPath = path.join(this.pgcRoot, 'transforms', transformId);
    return await fs.pathExists(transformPath);
  }

  async getAllTransformIds(): Promise<string[]> {
    const transformsRoot = path.join(this.pgcRoot, 'transforms');
    if (!(await fs.pathExists(transformsRoot))) {
      return [];
    }

    const transformIds: string[] = [];
    const dirs = await fs.readdir(transformsRoot);
    for (const dir of dirs) {
      const dirPath = path.join(transformsRoot, dir);
      if ((await fs.stat(dirPath)).isDirectory()) {
        transformIds.push(dir);
      }
    }
    return transformIds;
  }

  async getTransformData(transformId: string): Promise<TransformData | null> {
    const logPath = path.join(
      this.pgcRoot,
      'transforms',
      transformId,
      'manifest.json'
    );
    if (await fs.pathExists(logPath)) {
      return (await fs.readJSON(logPath)) as TransformData;
    }
    return null;
  }

  private generateTransformId(transform: TransformData): string {
    // Simple hash for now, could be more robust
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(transform));
    return hash.digest('hex');
  }
}
