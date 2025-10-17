import { PGCManager } from '../core/pgc-manager.js';
import { IndexData } from '../types/index.js';
import { StructuralData, ClassData } from '../types/structural.js';

interface QueryOptions {
  projectRoot: string;
  depth: string;
}

interface Dependency {
  lineage: string;
  structuralData: StructuralData | Buffer;
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

async function searchSymbolInStructuralData(
  pgc: PGCManager,
  symbolName: string
): Promise<IndexData | null> {
  // Use the index search directly instead of scanning all files
  const results = await pgc.index.search(symbolName);
  if (results.length > 0) {
    return results[0]; // Return first match
  }
  return null;
}

export async function queryCommand(question: string, options: QueryOptions) {
  const pgc = new PGCManager(options.projectRoot);

  // Stage 1: Simple entity extraction
  const entities = extractEntities(question);

  // Stage 2: Direct index lookup
  const results: IndexData[] = [];
  for (const entity of entities) {
    const result = await searchSymbolInStructuralData(pgc, entity);
    if (result) {
      results.push(result);
    }
  }

  const depth = parseInt(options.depth, 10);

  // Stage 3: Retrieve and format
  if (depth > 0) {
    // Display the initial queried symbols first
    const initialContext = await Promise.all(
      results.map((r) => pgc.objectStore.retrieve(r.structural_hash))
    );
    displayResults(question, initialContext);

    // Then get and display their dependencies
    const dependencies = await getSymbolDependencies(results, pgc, '');
    if (dependencies.length > 0) {
      console.log('\n--- Dependencies ---');
      await displayResultsWithDependencies(dependencies, pgc, 1, depth); // Add await here
    }
  } else {
    // Depth = 0 - only show direct results, no dependency traversal
    const context = await Promise.all(
      results.map((r) => pgc.objectStore.retrieve(r.structural_hash))
    );
    displayResults(question, context);
  }
}

async function getSymbolDependencies(
  results: IndexData[],

  pgc: PGCManager,

  parentLineage: string = ''
): Promise<Dependency[]> {
  const dependencies: Dependency[] = [];

  for (const result of results) {
    const structuralDataBuffer = await pgc.objectStore.retrieve(
      result.structural_hash
    );

    if (structuralDataBuffer) {
      try {
        const structuralData = JSON.parse(
          structuralDataBuffer.toString()
        ) as StructuralData;

        const processClass = async (c: ClassData) => {
          const classLineage = parentLineage
            ? `${parentLineage} -> ${c.name}`
            : c.name;

          for (const base of c.base_classes) {
            const depResults = await pgc.index.search(base);

            for (const depResult of depResults) {
              const depStructuralDataBuffer = await pgc.objectStore.retrieve(
                depResult.structural_hash
              );

              if (depStructuralDataBuffer) {
                dependencies.push({
                  lineage: `${classLineage} -> extends ${base}`,

                  structuralData: JSON.parse(
                    depStructuralDataBuffer.toString()
                  ),
                });
              }
            }
          }

          if (c.implements_interfaces) {
            for (const iface of c.implements_interfaces) {
              const depResults = await pgc.index.search(iface);

              for (const depResult of depResults) {
                const depStructuralDataBuffer = await pgc.objectStore.retrieve(
                  depResult.structural_hash
                );

                if (depStructuralDataBuffer) {
                  dependencies.push({
                    lineage: `${classLineage} -> implements ${iface}`,

                    structuralData: JSON.parse(
                      depStructuralDataBuffer.toString()
                    ),
                  });
                }
              }
            }
          }

          for (const m of c.methods) {
            const methodLineage = `${classLineage} -> ${m.name}`;

            for (const p of m.params) {
              const depResults = await pgc.index.search(p.type);

              for (const depResult of depResults) {
                const depStructuralDataBuffer = await pgc.objectStore.retrieve(
                  depResult.structural_hash
                );

                if (depStructuralDataBuffer) {
                  dependencies.push({
                    lineage: `${methodLineage} -> param ${p.name}: ${p.type}`,

                    structuralData: JSON.parse(
                      depStructuralDataBuffer.toString()
                    ),
                  });
                }
              }
            }
          }
        };

        for (const c of structuralData.classes) {
          await processClass(c);
        }
      } catch (e) {
        dependencies.push({
          lineage: parentLineage,

          structuralData: structuralDataBuffer,
        });
      }
    }
  }

  return dependencies;
}

async function displayResultsWithDependencies(
  context: Dependency[],
  pgc: PGCManager,
  currentDepth: number,
  maxDepth: number
) {
  if (context.length === 0 || currentDepth > maxDepth) {
    return;
  }

  // Use for...of for proper async iteration
  for (const item of context) {
    const indent = '  '.repeat(currentDepth);

    if (item.structuralData instanceof Buffer) {
      console.log(`${indent}Lineage: ${item.lineage}`);
      console.log(`${indent}${item.structuralData.toString()}`);
    } else {
      console.log(`\n${indent}Lineage: ${item.lineage}`);
      console.log(`${indent}${JSON.stringify(item.structuralData, null, 2)}`);

      if (currentDepth < maxDepth) {
        const structuralData = item.structuralData as StructuralData;
        const nextLevelEntities: string[] = [];

        if (structuralData.classes) {
          for (const c of structuralData.classes) {
            nextLevelEntities.push(...c.base_classes);
            if (c.implements_interfaces) {
              nextLevelEntities.push(...c.implements_interfaces);
            }
            for (const m of c.methods) {
              for (const p of m.params) {
                nextLevelEntities.push(p.type);
              }
            }
          }
        }

        if (nextLevelEntities.length > 0) {
          const nextLevelDependencies: Dependency[] = [];
          for (const entity of nextLevelEntities) {
            const entityResult = await searchSymbolInStructuralData(
              pgc,
              entity
            );
            if (entityResult) {
              const entityStructuralDataBuffer = await pgc.objectStore.retrieve(
                entityResult.structural_hash
              );
              if (entityStructuralDataBuffer) {
                nextLevelDependencies.push({
                  lineage: `${item.lineage} -> ${entity}`,
                  structuralData: JSON.parse(
                    entityStructuralDataBuffer.toString()
                  ),
                });
              }
            }
          }

          // Recursive call with proper async/await
          await displayResultsWithDependencies(
            nextLevelDependencies,
            pgc,
            currentDepth + 1,
            maxDepth
          );
        }
      }
    }
  }
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
