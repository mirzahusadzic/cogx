import fs from 'fs-extra';
import path from 'path';

import { IndexData } from '../types/index.js';

export class Index {
  constructor(private pgcRoot: string) {}

  async set(filePath: string, data: IndexData): Promise<void> {
    const indexPath = path.join(
      this.pgcRoot,
      'index',
      filePath.replace(/\//g, '_') + '.json'
    );
    await fs.ensureDir(path.dirname(indexPath));
    await fs.writeJSON(indexPath, data, { spaces: 2 });
  }
}
