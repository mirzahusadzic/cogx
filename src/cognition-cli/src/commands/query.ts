import { PGCManager } from '../core/pgc-manager.js';
import { IndexData } from '../types/index.js';
import {
  StructuralData,
  ClassData,
  FunctionData,
  InterfaceData,
} from '../types/structural.js';

interface QueryOptions {
  projectRoot: string;
  depth: string;
}

// Helper to find the single best file for a symbol (highest fidelity)
async function findBestResultForSymbol(
  pgc: PGCManager,
  symbolName: string
): Promise<IndexData | null> {
  const results = await pgc.index.search(symbolName, pgc.objectStore);
  if (results.length === 0) return null;

  let bestResult: IndexData | null = null;
  let maxFidelity = -1;

  for (const result of results) {
    const buffer = await pgc.objectStore.retrieve(result.structural_hash);
    if (buffer) {
      const data = JSON.parse(buffer.toString()) as StructuralData;
      const fidelity = data.fidelity || 0;
      if (fidelity > maxFidelity) {
        maxFidelity = fidelity;
        bestResult = result;
      }
    }
  }
  return bestResult;
}

export async function queryCommand(question: string, options: QueryOptions) {
  const pgc = new PGCManager(options.projectRoot);
  const entities = extractEntities(question);

  let currentResults: IndexData[] = [];
  for (const entity of entities) {
    const result = await findBestResultForSymbol(pgc, entity);
    if (result) {
      currentResults.push(result);
    }
  }

  const initialContext = await Promise.all(
    currentResults.map((r) => pgc.objectStore.retrieve(r.structural_hash))
  );
  displayResults(question, initialContext);

  const maxDepth = parseInt(options.depth, 10);
  if (maxDepth > 0 && currentResults.length > 0) {
    console.log('\n--- Dependencies ---');

    // --- START FIX ---
    // We will track processed SYMBOLS, not file hashes, to allow exploring
    // multiple dependencies that live in the same file.
    const processedSymbols = new Set<string>(entities);
    // --- END FIX ---

    // Initialize lineage for the initial results
    for (const result of currentResults) {
      const buffer = await pgc.objectStore.retrieve(result.structural_hash);
      if (buffer) {
        const data = JSON.parse(buffer.toString()) as StructuralData;
        result.path =
          data.classes?.[0]?.name ||
          data.functions?.[0]?.name ||
          data.interfaces?.[0]?.name ||
          question;
      }
    }

    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      if (currentResults.length === 0) break;

      const newDependenciesForNextLevel: IndexData[] = [];
      const dependencySymbolToLineage = new Map<string, string>();

      for (const result of currentResults) {
        const structuralDataBuffer = await pgc.objectStore.retrieve(
          result.structural_hash
        );
        if (structuralDataBuffer) {
          const structuralData = JSON.parse(
            structuralDataBuffer.toString()
          ) as StructuralData;
          const parentLineage = result.path;

          const processType = (type: string | undefined, lineage: string) => {
            const cleanType = type?.replace('[]', '').split('|')[0].trim();
            if (
              cleanType &&
              ![
                'string',
                'number',
                'boolean',
                'any',
                'void',
                'unknown',
              ].includes(cleanType)
            ) {
              dependencySymbolToLineage.set(cleanType, lineage);
            }
          };

          structuralData.classes?.forEach((c: ClassData) => {
            const classLineage = parentLineage.endsWith(c.name)
              ? parentLineage
              : `${parentLineage} -> ${c.name}`;
            c.base_classes?.forEach((s) =>
              dependencySymbolToLineage.set(s, classLineage)
            );
            c.implements_interfaces?.forEach((s) =>
              dependencySymbolToLineage.set(s, classLineage)
            );
            c.methods?.forEach((m) => {
              const methodLineage = `${classLineage} -> ${m.name}`;
              m.params?.forEach((p) => processType(p.type, methodLineage));
            });
          });

          structuralData.functions?.forEach((f: FunctionData) => {
            const funcLineage = parentLineage.endsWith(f.name)
              ? parentLineage
              : `${parentLineage} -> ${f.name}`;
            f.params?.forEach((p) => processType(p.type, funcLineage));
          });

          structuralData.interfaces?.forEach((i: InterfaceData) => {
            const interfaceLineage = parentLineage.endsWith(i.name)
              ? parentLineage
              : `${parentLineage} -> ${i.name}`;
            i.properties?.forEach((p) => processType(p.type, interfaceLineage));
          });
        }
      }

      // Search for each symbol, but only if we haven't processed that symbol before.
      for (const [
        symbol,
        parentLineage,
      ] of dependencySymbolToLineage.entries()) {
        if (processedSymbols.has(symbol)) {
          continue;
        }
        processedSymbols.add(symbol);

        const bestResult = await findBestResultForSymbol(pgc, symbol);
        if (bestResult) {
          const displayResult = { ...bestResult };
          displayResult.path = `${parentLineage} -> ${symbol}`;
          newDependenciesForNextLevel.push(displayResult);
        }
      }

      if (newDependenciesForNextLevel.length > 0) {
        await displayDependencies(
          newDependenciesForNextLevel,
          pgc,
          currentDepth
        );
      }

      currentResults = newDependenciesForNextLevel;
    }
  }
}

async function displayDependencies(
  dependencies: IndexData[],
  pgc: PGCManager,
  depth: number
) {
  const indent = '  '.repeat(depth);
  for (const dep of dependencies) {
    const structuralDataBuffer = await pgc.objectStore.retrieve(
      dep.structural_hash
    );
    if (structuralDataBuffer) {
      console.log(`\n${indent}Lineage: ${dep.path}`);
      console.log(
        `${indent}${JSON.stringify(
          JSON.parse(structuralDataBuffer.toString()),
          null,
          2
        )}`
      );
    }
  }
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
  return [...new Set(entities)];
}

export function displayResults(question: string, context: (Buffer | null)[]) {
  console.log(`Query: "${question}"`);
  if (context.every((c) => c === null)) {
    console.log('No relevant information found.');
    return;
  }
  console.log('--- Relevant Context ---');
  context.forEach((item, index) => {
    if (item) {
      console.log(`\nResult ${index + 1}:`);
      try {
        console.log(JSON.stringify(JSON.parse(item.toString()), null, 2));
      } catch (e) {
        console.log(item.toString());
      }
    }
  });
}
