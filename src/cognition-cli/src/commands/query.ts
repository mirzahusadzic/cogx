import { PGCManager } from '../core/pgc-manager.js';
import { IndexData } from '../types/index.js'; // Assuming IndexData is defined here

interface QueryOptions {
  projectRoot: string;
}

function extractEntities(question: string): string[] {
  const patterns = [
    /\b[A-Z][a-zA-Z0-9]+\b/g, // PascalCase (classes)
    /\b[a-z][a-zA-Z0-9]+\b/g, // camelCase (functions)
  ];

  const entities: string[] = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(question)) !== null) {
      entities.push(match[0]);
    }
  }
  return [...new Set(entities)]; // Dedupe
}

export async function queryCommand(question: string, options: QueryOptions) {
  const pgc = new PGCManager(options.projectRoot);

  // Stage 1: Simple entity extraction (no LLM needed yet!)
  const entities = extractEntities(question);

  // Stage 2: Direct index lookup
  const results: IndexData[] = await Promise.all(
    entities.map((entity) => pgc.index.search(entity))
  ).then((arr) => arr.flat().filter(Boolean)); // Flatten and remove empty/falsy results
  console.log('Debug: results array before map:', results);

  // Stage 3: Retrieve and format
  const context = await Promise.all(
    results.map((r) => pgc.objectStore.retrieve(r.structural_hash))
  );

  // Stage 4: Simple presentation (no LLM synthesis yet)
  displayResults(question, context);
}

function displayResults(question: string, context: unknown[]) {
  console.log(`Query: "${question}"`);
  if (context.length === 0) {
    console.log('No relevant information found.');
    return;
  }
  console.log('--- Relevant Context ---');
  context.forEach((item, index) => {
    console.log(`
Result ${index + 1}:`);
    try {
      // Assuming the item is a Buffer containing JSON
      console.log(
        JSON.stringify(JSON.parse((item as Buffer).toString()), null, 2)
      );
    } catch (e) {
      if (item instanceof Buffer) {
        console.log(item.toString());
      } else {
        console.log(item); // Fallback if not JSON or not a Buffer
      }
    }
  });
}
