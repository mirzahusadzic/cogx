import fs from 'fs-extra';
import path from 'path';

import { IndexData } from '../types/index.js';

export class Index {
  private indexPath: string;

  constructor(private pgcRoot: string) {
    this.indexPath = path.join(this.pgcRoot, 'index');
  }

  async set(key: string, data: IndexData): Promise<void> {
    await fs.ensureDir(this.indexPath);
    await fs.writeJSON(this.getIndexPath(key), data, { spaces: 2 });
  }

  async get(key: string): Promise<IndexData | null> {
    const indexPath = this.getIndexPath(key);
    if (await fs.pathExists(indexPath)) {
      return await fs.readJSON(indexPath);
    }
    return null;
  }

  async remove(key: string): Promise<void> {
    await fs.remove(this.getIndexPath(key));
  }

  async getAll(): Promise<string[]> {
    if (!(await fs.pathExists(this.indexPath))) {
      return [];
    }
    const indexFiles = await fs.readdir(this.indexPath);
    return indexFiles.map((file) => file.replace('.json', ''));
  }

  async search(term: string): Promise<IndexData[]> {
    if (!(await fs.pathExists(this.indexPath))) {
      return [];
    }
    const allKeys = await this.getAll();
    const transformedTerm = term
      .replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`)
      .substring(1);
    const matchingData: IndexData[] = [];
    for (const key of allKeys) {
      if (key.includes(transformedTerm)) {
        const data = await this.get(key);
        if (data) {
          matchingData.push(data);
        }
      }
    }
    return matchingData;
  }

  private getIndexPath(key: string): string {
    return path.join(this.indexPath, `${key.replace(/\//g, '_')}.json`);
  }
}
