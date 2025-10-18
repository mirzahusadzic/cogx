import fs from 'fs-extra';
import path from 'path';

import { IndexData, IndexDataSchema } from '../types/index.js';
import { ClassData, FunctionData, InterfaceData } from '../types/structural.js';

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

  async search(term: string): Promise<IndexData[]> {
    const allData = await this.getAllData();

    // Canonicalize the search term using the new helper function
    const canonicalTerm = canonicalizeSymbol(term);

    const directMatches: IndexData[] = [];
    const otherMatches: IndexData[] = [];

    for (const data of allData) {
      let isDirectMatch = false;

      // Check for direct name match in structuralData (e.g., class name, function name)
      if (data.structuralData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const checkDirectNameMatch = (structuralData: any): boolean => {
          if (typeof structuralData === 'object' && structuralData !== null) {
            if (
              structuralData.name &&
              canonicalizeSymbol(structuralData.name) === canonicalTerm
            ) {
              return true;
            }
            // Check classes, functions, interfaces, exports directly
            if (Array.isArray(structuralData.classes)) {
              if (
                structuralData.classes.some(
                  (c: ClassData) => canonicalizeSymbol(c.name) === canonicalTerm
                )
              )
                return true;
            }
            if (Array.isArray(structuralData.functions)) {
              if (
                structuralData.functions.some(
                  (f: FunctionData) =>
                    canonicalizeSymbol(f.name) === canonicalTerm
                )
              )
                return true;
            }
            if (Array.isArray(structuralData.interfaces)) {
              if (
                structuralData.interfaces.some(
                  (i: InterfaceData) =>
                    canonicalizeSymbol(i.name) === canonicalTerm
                )
              )
                return true;
            }
            if (Array.isArray(structuralData.exports)) {
              if (
                structuralData.exports.some(
                  (e: string) => canonicalizeSymbol(e) === canonicalTerm
                )
              )
                return true;
            }
          }
          return false;
        };
        if (checkDirectNameMatch(data.structuralData)) {
          isDirectMatch = true;
        }
      }

      if (isDirectMatch) {
        directMatches.push(data);
      } else {
        // Existing logic for path and other structural data matches
        const dataCanonicalKey = this.getCanonicalKey(data.path).toLowerCase();
        const components = dataCanonicalKey.split('_');

        const includesResult = components.some((component) => {
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

        if (includesResult) {
          otherMatches.push(data);
        } else if (data.structuralData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const searchInStructuralData = (structuralData: any): boolean => {
            if (typeof structuralData === 'string') {
              return canonicalizeSymbol(structuralData).includes(canonicalTerm);
            }
            if (typeof structuralData === 'object' && structuralData !== null) {
              // Already checked for direct name match, so skip structuralData.name here
              for (const key in structuralData) {
                if (Object.prototype.hasOwnProperty.call(structuralData, key)) {
                  if (searchInStructuralData(structuralData[key])) {
                    return true;
                  }
                }
              }
            }
            return false;
          };
          if (searchInStructuralData(data.structuralData)) {
            otherMatches.push(data);
          }
        }
      }
    }

    // Prioritize direct matches
    return [...directMatches, ...otherMatches];
  }

  public getCanonicalKey(key: string): string {
    // Replace path separators with underscores, and underscores in names with hyphens.
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
