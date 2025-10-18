import fs from 'fs-extra';
import path from 'path';

import { IndexData, IndexDataSchema } from '../types/index.js';
import { StructuralData } from '../types/structural.js';
import { ObjectStore } from './object-store.js';

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

  async search(term: string, objectStore?: ObjectStore): Promise<IndexData[]> {
    const allData = await this.getAllData();
    const canonicalTerm = canonicalizeSymbol(term);
    const uniqueMatches = new Map<string, IndexData>();

    // Phase 1: Search within the content of the structural data
    if (objectStore) {
      for (const data of allData) {
        if (data.structural_hash) {
          try {
            const structuralDataBuffer = await objectStore.retrieve(
              data.structural_hash
            );
            if (structuralDataBuffer) {
              const structuralData = JSON.parse(
                structuralDataBuffer.toString()
              ) as StructuralData;

              // A safe, recursive function to find the symbol
              const foundInValue = (value: unknown): boolean => {
                // Base case: not an object, so it can't contain what we want
                if (typeof value !== 'object' || value === null) {
                  return false;
                }

                // Check if the current object itself has a matching name
                if (
                  'name' in value &&
                  typeof value.name === 'string' &&
                  canonicalizeSymbol(value.name) === canonicalTerm
                ) {
                  return true;
                }

                // Check if the current object has a matching export
                if (
                  'exports' in value &&
                  Array.isArray(value.exports) &&
                  value.exports.some(
                    (e) =>
                      typeof e === 'string' &&
                      canonicalizeSymbol(e) === canonicalTerm
                  )
                ) {
                  return true;
                }

                // Recurse into the contents of the object or array
                if (Array.isArray(value)) {
                  return value.some(foundInValue);
                }

                return Object.values(value).some(foundInValue);
              };

              if (foundInValue(structuralData)) {
                if (!uniqueMatches.has(data.structural_hash)) {
                  uniqueMatches.set(data.structural_hash, data);
                }
              }
            }
          } catch (e) {
            console.warn(
              `Failed to retrieve or parse structural data for ${data.path}: ${e}`
            );
          }
        }
      }
    }

    // Phase 2: Fallback to searching file paths
    for (const data of allData) {
      if (uniqueMatches.has(data.structural_hash)) continue;

      const dataCanonicalKey = this.getCanonicalKey(data.path).toLowerCase();
      if (dataCanonicalKey.includes(canonicalTerm)) {
        uniqueMatches.set(data.structural_hash, data);
      }
    }

    return Array.from(uniqueMatches.values());
  }

  public getCanonicalKey(key: string): string {
    return key
      .split(/[\\/]/)
      .map((segment) => segment.replace(/_/g, '-'))
      .join('_');
  }

  private getIndexPath(key: string): string {
    const canonicalKey = this.getCanonicalKey(key);
    return path.join(this.indexPath, `${canonicalKey}.json`);
  }
}
