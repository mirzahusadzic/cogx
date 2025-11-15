/**
 * Natural Language Query Interface for Grounded Context Pool (PGC)
 *
 * Enables developers to query their codebase using natural language questions.
 * Extracts code symbols from questions, retrieves structural data from PGC,
 * and performs dependency graph traversal to build complete context.
 *
 * DESIGN PHILOSOPHY:
 * Traditional code search operates on text patterns. This query system operates
 * on semantic structure - it understands symbols, dependencies, and architectural
 * relationships.
 *
 * QUERY ALGORITHM:
 * 1. Entity Extraction: Parse question for code symbols (PascalCase, camelCase)
 * 2. Context Retrieval: Fetch structural data for identified symbols
 * 3. Dependency Traversal: Follow type references to depth N
 * 4. Lineage Construction: Build dependency path from root to leaves
 * 5. Result Formatting: Present as human-readable or JSON lineage
 *
 * SUPPORTED QUERIES:
 * - "How does UserService work?"
 *   → Finds UserService + dependencies
 *
 * - "What does AuthController depend on?"
 *   → Finds AuthController + transitive dependencies
 *
 * - "Show me the DatabaseConnection implementation"
 *   → Finds DatabaseConnection + related types
 *
 * DEPTH CONTROL:
 * - depth=0: Only direct matches (no dependencies)
 * - depth=1: Direct dependencies (classes, interfaces, return types)
 * - depth=2+: Transitive dependencies
 *
 * @example
 * // Simple query for a single symbol
 * const result = await queryCommand(
 *   'How does PGCManager work?',
 *   { projectRoot: '/path/to/project', depth: '1' }
 * );
 * console.log(formatAsHumanReadable(result));
 *
 * @example
 * // Deep dependency analysis
 * const result = await queryCommand(
 *   'What does OverlayOracle depend on?',
 *   { projectRoot: '/path/to/project', depth: '2' }
 * );
 * console.log(formatAsLineageJSON(result));
 *
 * @example
 * // Multiple symbols in one query
 * const result = await queryCommand(
 *   'How do Index and ObjectStore interact?',
 *   { projectRoot: '/path/to/project', depth: '1' }
 * );
 */

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
 *
 * Each dependency includes its position in the dependency graph
 * (depth and lineage path) and the full structural data.
 */
export interface DependencyResult {
  /** Lineage path showing how this dependency was reached (e.g., "User -> AuthService -> Database") */
  path: string;

  /** Depth level in dependency graph (1 = direct dependency, 2 = transitive, etc.) */
  depth: number;

  /** Complete structural data for this dependency */
  structuralData: StructuralData;
}

/**
 * Represents the complete result of a query operation.
 *
 * Contains the original question, initial context (direct matches),
 * and discovered dependencies.
 */
export interface QueryResult {
  /** Original natural language question */
  question: string;

  /** Structural data for symbols directly matched in question */
  initialContext: StructuralData[];

  /** Dependencies discovered by traversal */
  dependencies: DependencyResult[];
}

/**
 * Options for configuring query behavior
 */
interface QueryOptions {
  /** Root directory of the project */
  projectRoot: string;

  /** Maximum dependency depth to traverse (e.g., '0', '1', '2') */
  depth: string;
}

/**
 * Find the best index result for a symbol (highest fidelity)
 *
 * ALGORITHM:
 * When multiple files define the same symbol (e.g., barrel exports),
 * prefer the one with highest fidelity score (most accurate structural data).
 *
 * @param pgc - PGC manager instance
 * @param symbolName - Symbol to search for
 * @param context - Search context for debugging
 * @returns Best matching index entry, or null if not found
 */
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
 * Execute a natural language query against the Grounded Context Pool (PGC)
 *
 * ALGORITHM:
 * Phase 1 - Entity Extraction:
 *   - Parse question for code symbols (PascalCase, camelCase)
 *   - Extract unique symbol names
 *
 * Phase 2 - Initial Context:
 *   - For each symbol, find best matching index entry
 *   - Retrieve structural data from object store
 *
 * Phase 3 - Dependency Traversal (if depth > 0):
 *   - For each symbol in current level:
 *     - Extract type references (base classes, interfaces, params, returns)
 *     - Find structural data for referenced types
 *     - Add to next level
 *   - Repeat for each depth level
 *   - Track lineage path (A -> B -> C)
 *
 * Phase 4 - Result Construction:
 *   - Combine initial context + dependencies
 *   - Return as QueryResult
 *
 * @param question - Natural language question
 * @param options - Query configuration (projectRoot, depth)
 * @returns Query result with context and dependencies
 *
 * @example
 * // Find a class and its direct dependencies
 * const result = await queryCommand(
 *   'How does UserService work?',
 *   { projectRoot: '/path/to/project', depth: '1' }
 * );
 * console.log(`Found ${result.initialContext.length} symbols`);
 * console.log(`Found ${result.dependencies.length} dependencies`);
 *
 * @example
 * // Deep dependency analysis
 * const result = await queryCommand(
 *   'What does AuthController depend on?',
 *   { projectRoot: '/path/to/project', depth: '2' }
 * );
 * result.dependencies.forEach(dep => {
 *   console.log(`${dep.path} (depth ${dep.depth})`);
 * });
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

/**
 * Extract code symbols from a natural language question
 *
 * ALGORITHM:
 * - Match PascalCase patterns (e.g., UserService, AuthController)
 * - Match camelCase patterns (e.g., parseJSON, getUserById)
 * - Deduplicate results
 *
 * LIMITATIONS:
 * - Simple regex-based extraction (no NLP)
 * - May capture non-code words (e.g., "This" in "This is...")
 * - Does not understand context or semantics
 *
 * @param question - Natural language question
 * @returns Array of unique symbol names
 *
 * @example
 * extractEntities('How does UserService work?')
 * // Returns: ['How', 'UserService', 'does', 'work']
 *
 * @example
 * extractEntities('What does parseJSON return?')
 * // Returns: ['What', 'parseJSON', 'does', 'return']
 */
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
 * Format a query result as human-readable text
 *
 * Produces indented, hierarchical output showing:
 * - Query question
 * - Initial context (direct matches)
 * - Dependencies (indented by depth)
 *
 * @param queryResult - Query result to format
 * @returns Formatted string for console output
 *
 * @example
 * const result = await queryCommand('How does UserService work?', options);
 * console.log(formatAsHumanReadable(result));
 * // Output:
 * // Query: "How does UserService work?"
 * // --- Relevant Context ---
 * // Result 1:
 * // { class: "UserService", ... }
 * // --- Dependencies ---
 * //   Lineage: UserService -> Database
 * //   { class: "Database", ... }
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
 * Format a query result as lineage JSON structure
 *
 * Produces a structured JSON representation showing:
 * - Root symbol
 * - Lineage array with type, relationship, and depth
 *
 * RELATIONSHIP TYPES:
 * - extends: Class inheritance
 * - implements: Interface implementation
 * - returns: Function return type
 * - uses: Parameter type or general usage
 *
 * @param queryResult - Query result to format
 * @returns JSON string with lineage structure
 *
 * @example
 * const result = await queryCommand('How does UserService work?', options);
 * console.log(formatAsLineageJSON(result));
 * // Output:
 * // {
 * //   "symbol": "How does UserService work?",
 * //   "lineage": [
 * //     { "type": "Database", "relationship": "uses", "depth": 1 },
 * //     { "type": "UserRepository", "relationship": "uses", "depth": 1 }
 * //   ]
 * // }
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

/**
 * Infer the relationship type between parent and child symbol
 *
 * ALGORITHM:
 * - Check if child is a base class → 'extends'
 * - Check if child is an interface → 'implements'
 * - Check if child appears in return type → 'returns'
 * - Check if child appears in parameters → 'uses'
 * - Default → 'uses'
 *
 * @param parent - Parent symbol's structural data
 * @param childSymbol - Child symbol name
 * @returns Relationship type ('extends' | 'implements' | 'returns' | 'uses')
 */
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
