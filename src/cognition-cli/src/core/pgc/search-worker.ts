// src/core/search-worker.ts

import { parentPort, workerData } from 'worker_threads';
import { ObjectStore } from './object-store.js';
import { IndexData } from '../types/index.js';
import { StructuralData } from '../types/structural.js';

// This helper function is duplicated here to make the worker self-contained.
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
 * This is the main function for the worker thread. It performs the heavy lifting.
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
