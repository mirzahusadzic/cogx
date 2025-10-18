import fs from 'fs-extra';
import path from 'path';

import { IndexData, IndexDataSchema } from '../types/index.js';

function canonicalizeSymbol(symbol: string): string {
  // Convert PascalCase to kebab-case
  let canonical = symbol
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2')
    .toLowerCase();
  // Remove leading hyphen if present (from PascalCase conversion)
  if (canonical.startsWith('-')) {
    canonical = canonical.substring(1);
  }
  // Replace underscores with hyphens
  canonical = canonical.replace(/_/g, '-');
  return canonical;
}

export class Index {
  private indexPath: string;

  constructor(private pgcRoot: string) {
    this.indexPath = path.join(this.pgcRoot, 'index');
  }

  async set(key: string, data: IndexData): Promise<void> {
    await fs.ensureDir(this.indexPath);
    const indexPath = this.getIndexPath(key);
    console.log(`Attempting to write to: ${indexPath}`);
    await fs.writeJSON(indexPath, data, { spaces: 2 });
  }

  async get(key: string): Promise<IndexData | null> {
    const indexPath = this.getIndexPath(key);
    if (await fs.pathExists(indexPath)) {
      const rawData = await fs.readJSON(indexPath);
      try {
        return IndexDataSchema.parse(rawData);
      } catch (error) {
        return null;
      }
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

  async getAllData(): Promise<IndexData[]> {
    if (!(await fs.pathExists(this.indexPath))) {
      return [];
    }
    const indexFiles = await fs.readdir(this.indexPath);
    const allData: IndexData[] = [];
    for (const file of indexFiles) {
      try {
        const fullPath = path.join(this.indexPath, file);
        const rawData = await fs.readJSON(fullPath);
        const data = IndexDataSchema.parse(rawData);
        allData.push(data);
      } catch (error) {
        // Ignore files that fail validation
      }
    }
    return allData;
  }

  async search(term: string): Promise<IndexData[]> {
    const allData = await this.getAllData();

    // Canonicalize the search term using the new helper function
    const canonicalTerm = canonicalizeSymbol(term);

    return allData.filter((data) => {
      const dataCanonicalKey = this.getCanonicalKey(data.path).toLowerCase();
      const components = dataCanonicalKey.split(':');

      const includesResult = components.some((component) => {
        // Remove file extension from the component if present
        const lastDotIndex = component.lastIndexOf('.');
        let componentWithoutExtension = component;
        if (
          lastDotIndex > 0 &&
          component.slice(lastDotIndex).match(/\.[a-z0-9]+$/i)
        ) {
          componentWithoutExtension = component.slice(0, lastDotIndex);
        }
        return componentWithoutExtension.includes(canonicalTerm);
      });
      return includesResult;
    });
  }

  public getCanonicalKey(key: string): string {
    // Replace path separators with colons, and underscores in names with hyphens.
    return key
      .split(/[\\/]/)
      .map((segment) => segment.replace(/_/g, '-'))
      .join(':');
  }

  private getIndexPath(key: string): string {
    const canonicalKey = this.getCanonicalKey(key);
    return path.join(this.indexPath, `${canonicalKey}.json`);
  }
}
