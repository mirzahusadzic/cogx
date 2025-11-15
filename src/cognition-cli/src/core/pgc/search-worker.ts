/**
 * Search Worker - Parallel Symbol Search
 *
 * Worker thread for parallelizing symbol search across the PGC index.
 * Each worker processes a chunk of index entries, searching structural
 * data for matching symbols.
 *
 * ARCHITECTURE:
 * - Main thread: Splits index into chunks, spawns workers
 * - Workers: Process chunks in parallel, return matches
 * - Main thread: Aggregates results
 *
 * ALGORITHM:
 * 1. Receive chunk of index entries + search term
 * 2. For each entry:
 *    a. Load structural data from object store
 *    b. Deep search for symbol in all structures (classes, functions, etc.)
 *    c. If found, add to matches
 * 3. Send matches back to main thread
 *
 * PERFORMANCE:
 * - Parallel search across CPU cores
 * - Self-contained (no shared state between workers)
 * - Minimal data transfer (only matches sent back)
 *
 * @module search-worker
 */

import { parentPort, workerData } from 'worker_threads';
import { ObjectStore } from './object-store.js';
import { IndexData } from '../types/index.js';
import { StructuralData } from '../types/structural.js';

/**
 * Canonicalize symbol name for comparison.
 *
 * Converts camelCase/PascalCase to kebab-case for case-insensitive matching.
 * Duplicated here to make worker self-contained (no dependencies on main thread).
 *
 * @param symbol - Symbol name to canonicalize
 * @returns Canonicalized symbol in kebab-case
 * @private
 *
 * @example
 * canonicalizeSymbol('FooBar') // → 'foo-bar'
 * canonicalizeSymbol('fooBar') // → 'foo-bar'
 */
function canonicalizeSymbol(symbol: string): string {
  let canonical = symbol
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2')
    .toLowerCase();
  if (canonical.startsWith('-')) {
    canonical = canonical.substring(1);
  }
  return canonical.replace(/_/g, '-');
}

/**
 * Main worker function - performs parallel search across assigned chunk.
 *
 * ALGORITHM:
 * 1. Receive data from main thread (chunk, term, pgcRoot)
 * 2. Initialize object store
 * 3. For each index entry in chunk:
 *    a. Load structural data
 *    b. Deep search for symbol
 *    c. If found, add to matches
 * 4. Send matches back to main thread
 *
 * @private
 */
async function performSearch() {
  // Receive the data chunk and search term from the main thread.
  const {
    chunk,
    term,
    pgcRoot,
  }: { chunk: IndexData[]; term: string; pgcRoot: string } = workerData;

  if (!chunk || !term || !pgcRoot) {
    throw new Error('Worker thread received invalid data.');
  }

  const objectStore = new ObjectStore(pgcRoot);
  const canonicalTerm = canonicalizeSymbol(term);
  const matches: IndexData[] = [];

  // Iterate ONLY over the chunk of data assigned to this worker.
  for (const data of chunk) {
    try {
      const structuralDataBuffer = await objectStore.retrieve(
        data.structural_hash
      );
      if (structuralDataBuffer) {
        const structuralData = JSON.parse(
          structuralDataBuffer.toString()
        ) as StructuralData;

        // The exact same deep search logic from the previous single-threaded version.
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
                typeof e === 'string' && canonicalizeSymbol(e) === canonicalTerm
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
      console.warn(`Worker failed on file ${data.path}: ${e}`);
    }
  }

  // Send the array of matches found by this worker back to the main thread.
  parentPort?.postMessage(matches);
}

// Start the search and handle any catastrophic errors.
performSearch().catch((err) => {
  parentPort?.postMessage({ error: err.message });
});
