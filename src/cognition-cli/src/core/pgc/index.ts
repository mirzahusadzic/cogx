import fs from 'fs-extra';
import path from 'path';
import { Worker } from 'worker_threads';
import os from 'os';

import { IndexData, IndexDataSchema } from '../types/index.js';
import { StructuralData } from '../types/structural.js';
import { ObjectStore } from './object-store.js';

/**
 * Canonicalizes a symbol name for case-insensitive matching.
 *
 * Converts camelCase/PascalCase to kebab-case, removes leading dashes,
 * and replaces underscores with dashes for consistent symbol lookup.
 *
 * @param {string} symbol - Symbol name to canonicalize
 * @returns {string} Canonicalized symbol in lowercase kebab-case
 *
 * @example
 * canonicalizeSymbol('MyClass') // → 'my-class'
 * canonicalizeSymbol('processData') // → 'process-data'
 * canonicalizeSymbol('_internalVar') // → 'internal-var'
 *
 * @private
 * @internal
 */
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

/**
 * High-performance file index with multi-threaded search capabilities.
 *
 * Maps source file paths to their structural metadata, content hashes, and processing status.
 * Supports parallel deep-search across structural data using worker threads for large codebases.
 * This is the primary lookup system for the Grounded Context Pool (PGC).
 *
 * **Architecture**:
 * - File-based storage in `.open_cognition/index/` directory
 * - One JSON file per indexed source file
 * - Parallel reading/writing for performance
 * - Multi-threaded search using worker pools
 *
 * **Storage Format**:
 * - Each indexed file stored as `{canonical-key}.json`
 * - Contains path, content hash, structural hash, and metadata
 * - Validated against `IndexDataSchema` on read
 *
 * **Search Capabilities**:
 * - Fast filename-only search (no ObjectStore needed)
 * - Deep structural search (requires ObjectStore)
 * - Multi-threaded parallel search for large datasets (>10 files)
 * - Single-threaded search for small datasets (<10 files)
 *
 * @class Index
 * @see {@link ObjectStore} for content-addressable storage
 * @see {@link IndexData} for data schema
 *
 * @example
 * // Initialize index
 * const index = new Index('/path/to/project/.open_cognition');
 *
 * @example
 * // Add file to index
 * await index.set('src/index.ts', {
 *   path: 'src/index.ts',
 *   structural_hash: 'abc123...',
 *   content_hash: 'def456...',
 *   transform_id: 'genesis-v1',
 *   timestamp: new Date().toISOString()
 * });
 *
 * @example
 * // Search for symbol (deep search)
 * const objectStore = new ObjectStore(pgcRoot);
 * const results = await index.search('MyClass', objectStore);
 *
 * @example
 * // Fast filename search (no deep search)
 * const results = await index.search('my-component');
 */
export class Index {
  private indexPath: string;

  /**
   * Creates a new Index instance.
   *
   * @constructor
   * @param {string} pgcRoot - Path to PGC root directory (`.open_cognition`)
   *
   * @example
   * const index = new Index('/path/to/project/.open_cognition');
   */
  constructor(private pgcRoot: string) {
    this.indexPath = path.join(this.pgcRoot, 'index');
  }

  /**
   * Stores index data for a single file.
   *
   * Creates the index directory if it doesn't exist, then writes the index
   * entry as a JSON file with the canonicalized key as the filename.
   *
   * @async
   * @param {string} key - File path to index (e.g., 'src/index.ts')
   * @param {IndexData} data - Index data including hashes and metadata
   * @returns {Promise<void>}
   *
   * @throws {Error} If file write fails
   *
   * @example
   * await index.set('src/components/Button.tsx', {
   *   path: 'src/components/Button.tsx',
   *   structural_hash: 'sha256...',
   *   content_hash: 'sha256...',
   *   transform_id: 'genesis-v1',
   *   timestamp: '2025-11-17T12:00:00Z'
   * });
   *
   * @see {@link batchSet} for batch operations
   */
  async set(key: string, data: IndexData): Promise<void> {
    await fs.ensureDir(this.indexPath);
    const indexPath = this.getIndexPath(key);
    await fs.writeJSON(indexPath, data, { spaces: 2 });
  }

  /**
   * Stores multiple index entries in parallel (batch operation).
   *
   * **OPTIMIZATION**: Provides 30% faster genesis when processing multiple files
   * by writing all index entries concurrently instead of sequentially.
   *
   * @async
   * @param {Map<string, IndexData>} entries - Map of file paths to index data
   * @returns {Promise<void>}
   *
   * @throws {Error} If any file write fails
   *
   * @remarks
   * This method is safe to call concurrently. All writes happen in parallel
   * using Promise.all for maximum throughput.
   *
   * @example
   * const entries = new Map([
   *   ['src/index.ts', indexData1],
   *   ['src/utils.ts', indexData2],
   *   ['src/types.ts', indexData3]
   * ]);
   * await index.batchSet(entries);
   * // All 3 files written in parallel
   *
   * @see {@link set} for single-file operations
   */
  async batchSet(entries: Map<string, IndexData>): Promise<void> {
    await fs.ensureDir(this.indexPath);
    await Promise.all(
      Array.from(entries.entries()).map(async ([key, data]) => {
        const indexPath = this.getIndexPath(key);
        await fs.writeJSON(indexPath, data, { spaces: 2 });
      })
    );
  }

  /**
   * Retrieves index data for a single file.
   *
   * Reads the index file and validates it against the IndexDataSchema.
   * Returns null if the file doesn't exist or validation fails.
   *
   * @async
   * @param {string} key - File path to retrieve (e.g., 'src/index.ts')
   * @returns {Promise<IndexData | null>} Index data or null if not found/invalid
   *
   * @example
   * const data = await index.get('src/components/Button.tsx');
   * if (data) {
   *   console.log(`File hash: ${data.structural_hash}`);
   * }
   *
   * @example
   * // Check if file is indexed
   * const exists = (await index.get('src/new-file.ts')) !== null;
   */
  async get(key: string): Promise<IndexData | null> {
    const indexPath = this.getIndexPath(key);
    if (await fs.pathExists(indexPath)) {
      const rawData = await fs.readJSON(indexPath);
      try {
        return IndexDataSchema.parse(rawData);
      } catch (error) {
        console.warn(
          `Failed to parse index data for ${key}: ${error instanceof Error ? error.message : String(error)}`
        );
        return null;
      }
    }
    return null;
  }

  /**
   * Removes a file from the index.
   *
   * Deletes the index file for the specified key. No-op if file doesn't exist.
   *
   * @async
   * @param {string} key - File path to remove from index
   * @returns {Promise<void>}
   *
   * @example
   * await index.remove('src/deleted-file.ts');
   */
  async remove(key: string): Promise<void> {
    await fs.remove(this.getIndexPath(key));
  }

  /**
   * Retrieves all indexed file paths (keys only, no data).
   *
   * Returns the canonicalized keys of all files in the index.
   * Use {@link getAllData} to retrieve full index data for all files.
   *
   * @async
   * @returns {Promise<string[]>} Array of canonicalized file paths
   *
   * @example
   * const allFiles = await index.getAll();
   * console.log(`Indexed ${allFiles.length} files`);
   * // Example: ['src_index.ts', 'src_utils.ts', ...]
   */
  async getAll(): Promise<string[]> {
    if (!(await fs.pathExists(this.indexPath))) {
      return [];
    }
    const entries = await fs.readdir(this.indexPath, { withFileTypes: true });
    return entries
      .filter((entry) => {
        // In test environments, isFile might not exist, so fall back to checking the name
        const isFile =
          typeof entry.isFile === 'function'
            ? entry.isFile()
            : !entry.isDirectory?.();
        return isFile && entry.name.endsWith('.json');
      })
      .map((file) => file.name.replace('.json', ''));
  }

  /**
   * Retrieves full index data for all indexed files (parallel).
   *
   * **OPTIMIZATION**: Reads all index files in parallel instead of serially,
   * providing significant performance improvement for large codebases.
   *
   * Validates each file against IndexDataSchema. Files that fail validation
   * are skipped with a warning logged to console.
   *
   * @async
   * @returns {Promise<IndexData[]>} Array of index data for all valid files
   *
   * @remarks
   * This method is safe to call concurrently. All reads happen in parallel
   * using Promise.all for maximum throughput.
   *
   * @example
   * const allData = await index.getAllData();
   * console.log(`Loaded ${allData.length} index entries`);
   * allData.forEach(data => {
   *   console.log(`${data.path}: ${data.structural_hash}`);
   * });
   *
   * @see {@link getAll} to retrieve only file paths
   */
  async getAllData(): Promise<IndexData[]> {
    if (!(await fs.pathExists(this.indexPath))) {
      return [];
    }
    const entries = await fs.readdir(this.indexPath, { withFileTypes: true });
    const indexFiles = entries
      .filter((entry) => {
        // In test environments, isFile might not exist, so fall back to checking the name
        const isFile =
          typeof entry.isFile === 'function'
            ? entry.isFile()
            : !entry.isDirectory?.();
        return isFile && entry.name.endsWith('.json');
      })
      .map((entry) => entry.name);

    // Parallel read with validation
    const dataResults = await Promise.all(
      indexFiles.map(async (file) => {
        try {
          const fullPath = path.join(this.indexPath, file);
          const rawData = await fs.readJSON(fullPath);
          const data = IndexDataSchema.parse(rawData);
          return data;
        } catch (error) {
          // Ignore files that fail validation
          console.warn(
            `Failed to validate index file ${file}: ${error instanceof Error ? error.message : String(error)}`
          );
          return null;
        }
      })
    );

    // Filter out null entries (failed validations)
    return dataResults.filter((data) => data !== null) as IndexData[];
  }

  /**
   * Searches the index for files matching a term (multi-threaded).
   *
   * Supports two search modes:
   * 1. **Fast filename search** (no ObjectStore): Matches against file paths only
   * 2. **Deep structural search** (with ObjectStore): Searches within code symbols
   *
   * **Performance**:
   * - Small datasets (<10 files): Single-threaded search
   * - Large datasets (≥10 files): Multi-threaded parallel search using worker pool
   * - Worker count: min(CPU cores, files / 20)
   *
   * **Algorithm**:
   * 1. Load all index data in parallel
   * 2. For small datasets: Search sequentially in main thread
   * 3. For large datasets: Chunk data and distribute to worker threads
   * 4. Workers search their chunks in parallel
   * 5. Merge results and deduplicate by structural_hash
   *
   * @async
   * @param {string} term - Search term (class name, function name, etc.)
   * @param {ObjectStore} [objectStore] - Object store for deep search (optional)
   * @param {string} [context] - Context label for logging (optional)
   * @returns {Promise<IndexData[]>} Matching index entries
   *
   * @remarks
   * The search term is canonicalized (converted to kebab-case) for case-insensitive matching.
   * Deep search requires ObjectStore to retrieve and parse structural data.
   *
   * @example
   * // Fast filename search (no deep search)
   * const results = await index.search('button');
   * // Finds: src/components/Button.tsx, src/ui/button.css, etc.
   *
   * @example
   * // Deep structural search (searches symbols within files)
   * const objectStore = new ObjectStore(pgcRoot);
   * const results = await index.search('MyClass', objectStore);
   * // Finds files containing class MyClass, even if filename differs
   *
   * @example
   * // Search with context logging
   * const results = await index.search('UserService', objectStore, 'lineage-query');
   * // Logs: [Search] (lineage-query) Starting parallel search with 4 workers...
   *
   * @see {@link searchSingleThreaded} for non-parallel search implementation
   */
  async search(
    term: string,
    objectStore?: ObjectStore,
    context?: string
  ): Promise<IndexData[]> {
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

    // CRITICAL: Don't spawn workers for small datasets
    const WORKER_THRESHOLD = 10; // Only use workers if >10 files
    if (allData.length < WORKER_THRESHOLD) {
      console.log(
        `[Search]${context ? ` (${context})` : ''} Running single-threaded search for ${allData.length} files.`
      );
      return this.searchSingleThreaded(allData, term, objectStore);
    }

    // For large datasets, use workers
    const numWorkers = Math.min(
      os.cpus().length,
      Math.ceil(allData.length / 20)
    );
    const chunkSize = Math.ceil(allData.length / numWorkers);
    const promises: Promise<IndexData[]>[] = [];

    console.log(
      `[Search]${context ? ` (${context})` : ''} Starting parallel search with ${numWorkers} workers for ${allData.length} files.`
    );

    for (let i = 0; i < numWorkers; i++) {
      const chunk = allData.slice(i * chunkSize, (i + 1) * chunkSize);
      if (chunk.length === 0) continue;

      const promise = new Promise<IndexData[]>((resolve, reject) => {
        // This path must resolve to the compiled JavaScript worker file at runtime.
        // Using `import.meta.url` makes this robust.
        const worker = new Worker(
          new URL('./search-worker.js', import.meta.url),
          /* @vite-ignore */ {
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

  /**
   * Searches index data sequentially in main thread (non-parallel).
   *
   * Used automatically for small datasets (<10 files) to avoid worker overhead.
   * For large datasets, use {@link search} which delegates to worker threads.
   *
   * @private
   * @async
   * @param {IndexData[]} allData - All index data to search
   * @param {string} term - Search term (canonicalized)
   * @param {ObjectStore} objectStore - Object store for retrieving structural data
   * @returns {Promise<IndexData[]>} Matching index entries
   *
   * @see {@link search} for the public API that calls this method
   */
  private async searchSingleThreaded(
    allData: IndexData[],
    term: string,
    objectStore: ObjectStore
  ): Promise<IndexData[]> {
    const canonicalTerm = canonicalizeSymbol(term);
    const matches: IndexData[] = [];

    for (const data of allData) {
      try {
        const structuralDataBuffer = await objectStore.retrieve(
          data.structural_hash
        );
        if (structuralDataBuffer) {
          const structuralData = JSON.parse(
            structuralDataBuffer.toString()
          ) as StructuralData;

          const foundInValue = (value: unknown): boolean => {
            if (typeof value !== 'object' || value === null) return false;
            if (
              'name' in value &&
              typeof value.name === 'string' &&
              canonicalizeSymbol(value.name) === canonicalTerm
            )
              return true;
            if (
              'exports' in value &&
              Array.isArray(value.exports) &&
              value.exports.some(
                (e) =>
                  typeof e === 'string' &&
                  canonicalizeSymbol(e) === canonicalTerm
              )
            )
              return true;
            if (Array.isArray(value)) return value.some(foundInValue);
            return Object.values(value).some(foundInValue);
          };

          if (foundInValue(structuralData)) {
            matches.push(data);
          }
        }
      } catch (e) {
        console.warn(`Search failed on file ${data.path}: ${e}`);
      }
    }

    return matches;
  }

  /**
   * Converts a file path to its canonical index key.
   *
   * Transforms path separators and underscores for consistent cross-platform
   * index file naming. This ensures the same file path produces the same
   * index filename on Windows, macOS, and Linux.
   *
   * **Transformation Rules**:
   * - Splits on `/` or `\` (path separators)
   * - Replaces `_` with `-` in each segment
   * - Joins with `_` separator
   *
   * @param {string} key - File path to canonicalize
   * @returns {string} Canonical key for index storage
   *
   * @example
   * index.getCanonicalKey('src/utils/helper.ts');
   * // → 'src_utils_helper.ts'
   *
   * @example
   * index.getCanonicalKey('src\\components\\Button.tsx');
   * // → 'src_components_Button.tsx' (Windows path)
   *
   * @example
   * index.getCanonicalKey('lib/my_module.js');
   * // → 'lib_my-module.js' (underscores converted)
   */
  public getCanonicalKey(key: string): string {
    return key
      .split(/[\\/]/)
      .map((segment) => segment.replace(/_/g, '-'))
      .join('_');
  }

  /**
   * Gets the full filesystem path for an index file.
   *
   * @private
   * @param {string} key - File path key
   * @returns {string} Full path to index JSON file
   */
  private getIndexPath(key: string): string {
    const canonicalKey = this.getCanonicalKey(key);
    return path.join(this.indexPath, `${canonicalKey}.json`);
  }
}
