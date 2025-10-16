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

  private generateTransformId(transform: TransformData): string {
    // Simple hash for now, could be more robust
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(transform));
    return hash.digest('hex');
  }
}
