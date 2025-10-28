import { PGCManager } from '../pgc/manager.js';
import { IndexData } from '../types/index.js';
import {
  StructuralData,
  ClassData,
  FunctionData,
  InterfaceData,
} from '../types/structural.js';

/**
 * Represents a dependency discovered during query traversal.
 */
export interface DependencyResult {
  path: string;
  depth: number;
  structuralData: StructuralData;
}

/**
 * Represents the complete result of a query operation.
 */
export interface QueryResult {
  question: string;
  initialContext: StructuralData[];
  dependencies: DependencyResult[];
}

interface QueryOptions {
  projectRoot: string;
  depth: string;
}

// Helper to find the single best file for a symbol (highest fidelity)
async function findBestResultForSymbol(
  pgc: PGCManager,
  symbolName: string,
  context?: string
): Promise<IndexData | null> {
  const results = await pgc.index.search(symbolName, pgc.objectStore, context);
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

/**
 * Executes a query to find code symbols and their dependencies based on a natural language question.
 */
export async function queryCommand(
  question: string,
  options: QueryOptions
): Promise<QueryResult> {
  const pgc = new PGCManager(options.projectRoot);
  const entities = extractEntities(question);

  const queryResult: QueryResult = {
    question,
    initialContext: [],
    dependencies: [],
  };

  let currentResults: IndexData[] = [];
  for (const entity of entities) {
    const result = await findBestResultForSymbol(
      pgc,
      entity,
      'initial entity search'
    );
    if (result) {
      currentResults.push(result);
    }
  }

  const initialContextBuffers = await Promise.all(
    currentResults.map((r) => pgc.objectStore.retrieve(r.structural_hash))
  );
  queryResult.initialContext = initialContextBuffers
    .filter((b) => b)
    .map((b) => JSON.parse(b!.toString()));

  const maxDepth = parseInt(options.depth, 10);
  if (maxDepth > 0 && currentResults.length > 0) {
    const processedSymbols = new Set<string>(entities);

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
          const parentLineage = result.path!;

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

      for (const [
        symbol,
        parentLineage,
      ] of dependencySymbolToLineage.entries()) {
        if (processedSymbols.has(symbol)) {
          continue;
        }
        processedSymbols.add(symbol);

        const bestResult = await findBestResultForSymbol(
          pgc,
          symbol,
          `dependency search at depth ${currentDepth}`
        );
        if (bestResult) {
          const structuralDataBuffer = await pgc.objectStore.retrieve(
            bestResult.structural_hash
          );
          if (structuralDataBuffer) {
            const structuralData = JSON.parse(
              structuralDataBuffer.toString()
            ) as StructuralData;
            queryResult.dependencies.push({
              path: `${parentLineage} -> ${symbol}`,
              depth: currentDepth,
              structuralData: structuralData,
            });
            bestResult.path = `${parentLineage} -> ${symbol}`;
            newDependenciesForNextLevel.push(bestResult);
          }
        }
      }
      currentResults = newDependenciesForNextLevel;
    }
  }

  return queryResult;
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

/**
 * Formats a query result as human-readable text.
 */
export function formatAsHumanReadable(queryResult: QueryResult): string {
  let output = '';
  output += `Query: "${queryResult.question}"`;

  if (queryResult.initialContext.length === 0) {
    output += '\nNo relevant information found.';
    return output;
  }

  output += '\n--- Relevant Context ---';
  queryResult.initialContext.forEach((item, index) => {
    output += `\n\nResult ${index + 1}:`;
    output += `\n${JSON.stringify(item, null, 2)}`;
  });

  if (queryResult.dependencies.length > 0) {
    output += '\n\n--- Dependencies ---';
    queryResult.dependencies.forEach((dep) => {
      const indent = '  '.repeat(dep.depth);
      output += `\n${indent}Lineage: ${dep.path}`;
      output += `\n${indent}${JSON.stringify(dep.structuralData, null, 2)}`;
    });
  }

  return output;
}

/**
 * Formats a query result as lineage JSON structure.
 */
export function formatAsLineageJSON(queryResult: QueryResult): string {
  const { question, dependencies } = queryResult;

  const rootData = queryResult.initialContext[0];
  if (!rootData) {
    return JSON.stringify({ symbol: question, lineage: [] }, null, 2);
  }

  const lineageItems = dependencies.map((dep) => {
    const parts = dep.path.split(' -> ');
    const type = parts[parts.length - 1];
    const parentType = parts.length > 1 ? parts[parts.length - 2] : question;

    // Find parent data by searching through the whole result
    const parentData = [
      ...queryResult.initialContext,
      ...dependencies.map((d) => d.structuralData),
    ].find(
      (d) =>
        d.classes?.[0]?.name === parentType ||
        d.functions?.[0]?.name === parentType ||
        d.interfaces?.[0]?.name === parentType
    );

    const relationship = parentData
      ? inferRelationship(parentData, type)
      : 'uses';

    return { type, relationship, depth: dep.depth };
  });

  const uniqueLineage = Array.from(
    new Map(lineageItems.map((item) => [JSON.stringify(item), item])).values()
  );

  return JSON.stringify({ symbol: question, lineage: uniqueLineage }, null, 2);
}

function inferRelationship(
  parent: StructuralData,
  childSymbol: string
): string {
  for (const c of parent.classes || []) {
    if (c.base_classes?.includes(childSymbol)) return 'extends';
    if (c.implements_interfaces?.includes(childSymbol)) return 'implements';
    for (const m of c.methods || []) {
      if (m.returns?.includes(childSymbol)) return 'returns';
      if (m.params?.some((p) => p.type.includes(childSymbol))) return 'uses';
    }
  }
  return 'uses'; // Default
}
