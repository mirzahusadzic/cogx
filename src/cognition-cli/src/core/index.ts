import fs from 'fs-extra';
import path from 'path';
import { Worker } from 'worker_threads';
import os from 'os';

import { IndexData, IndexDataSchema } from '../types/index.js';
import { ObjectStore } from './object-store.js';

function canonicalizeSymbol(symbol: string): string {
  let canonical = symbol
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2')
    .toLowerCase();
  if (canonical.startsWith('-')) {
    canonical = canonical.substring(1);
  }
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

  // This is the new multi-threaded search coordinator.
  async search(term: string, objectStore?: ObjectStore): Promise<IndexData[]> {
    if (!objectStore) {
      console.warn(
        'Performing a fast, filename-only search. Provide an ObjectStore for a full deep search.'
      );
      const allData = await this.getAllData();
      const canonicalTerm = canonicalizeSymbol(term);
      const normalizedTerm = canonicalTerm.replace(/[^a-z0-9]/g, '');
      return allData.filter((data) => {
        const normalizedKey = this.getCanonicalKey(data.path)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        return normalizedKey.includes(normalizedTerm);
      });
    }

    const allData = await this.getAllData();
    if (allData.length === 0) {
      return [];
    }

    const numWorkers = Math.min(os.cpus().length, allData.length);
    const chunkSize = Math.ceil(allData.length / numWorkers);
    const promises: Promise<IndexData[]>[] = [];

    console.log(
      `[Search] Starting parallel search with ${numWorkers} workers for ${allData.length} files.`
    );

    for (let i = 0; i < numWorkers; i++) {
      const chunk = allData.slice(i * chunkSize, (i + 1) * chunkSize);
      if (chunk.length === 0) continue;

      const promise = new Promise<IndexData[]>((resolve, reject) => {
        // This path must resolve to the compiled JavaScript worker file at runtime.
        // Using `import.meta.url` makes this robust.
        const worker = new Worker(
          new URL('./search-worker.js', import.meta.url),
          {
            workerData: {
              chunk,
              term,
              pgcRoot: this.pgcRoot,
            },
          }
        );

        worker.on('message', (result) => {
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        });

        worker.on('error', reject);

        worker.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });
      promises.push(promise);
    }

    const resultsFromWorkers = await Promise.all(promises);

    const uniqueMatches = new Map<string, IndexData>();
    for (const match of resultsFromWorkers.flat()) {
      uniqueMatches.set(match.structural_hash, match);
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
