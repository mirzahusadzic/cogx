/**
 * Graph Traversal Engine for Blast Radius Analysis
 *
 * Builds and traverses dependency graphs from structural patterns stored in the
 * Grounded Context Pool (PGC). Enables impact analysis by computing blast radius
 * for code changes.
 *
 * ALGORITHM OVERVIEW:
 * 1. Graph Construction:
 *    - Load all symbols from structural overlay (O1) in PGC
 *    - Parse import statements, type references, and inheritance relationships
 *    - Build directed graph with adjacency lists for O(1) traversal
 *
 * 2. Blast Radius Calculation:
 *    - BFS traversal upstream (consumers) and downstream (dependencies)
 *    - Depth-limited to prevent infinite recursion
 *    - Deduplication to handle diamond dependencies
 *
 * 3. Critical Path Detection:
 *    - Identify symbols with high fan-in (architectural bottlenecks)
 *    - Find shortest paths to these high-impact symbols
 *    - Rank by consumer count and depth
 *
 * PERFORMANCE CHARACTERISTICS:
 * - Graph construction: O(N × M) where N=symbols, M=avg imports per symbol
 * - Traversal: O(V + E) where V=vertices, E=edges (standard BFS)
 * - Memory: O(N + E) for adjacency lists
 *
 * DESIGN DECISIONS:
 * - Adjacency lists over adjacency matrix (sparse graphs in real codebases)
 * - In-memory graph (fast repeated queries, acceptable for <100k symbols)
 * - Structural hashes enable incremental updates (future optimization)
 *
 * @example
 * // Initialize traversal engine with PGC access
 * const traversal = new GraphTraversal(pgcManager);
 *
 * // Build the complete dependency graph
 * const graph = await traversal.buildGraph();
 * console.log(`Graph: ${graph.nodes.size} symbols, ${graph.edges.length} edges`);
 *
 * // Analyze blast radius for a symbol change
 * const blast = await traversal.getBlastRadius('AuthManager', {
 *   maxDepth: 3,
 *   direction: 'both',
 *   includeTransitive: true
 * });
 *
 * // Report impact
 * console.log(`Changing AuthManager impacts ${blast.metrics.totalImpacted} symbols`);
 * console.log(`Critical paths:`);
 * for (const path of blast.metrics.criticalPaths) {
 *   console.log(`  ${path.path.join(' → ')} (${path.reason})`);
 * }
 */

import { PGCManager } from '../pgc/manager.js';
import { StructuralPatternMetadataSchema } from '../types/structural.js';
import {
  GraphNode,
  GraphEdge,
  DirectedGraph,
  TraversalOptions,
  BlastRadiusResult,
  CriticalPath,
} from './types.js';

/**
 * Performs graph traversal operations for blast radius and dependency analysis.
 *
 * Coordinates with Grounded Context Pool (PGC) to build and query dependency graphs.
 */
export class GraphTraversal {
  /**
   * Creates a new graph traversal engine.
   *
   * @param pgc - Manager for accessing structural patterns in Grounded Context Pool (PGC)
   */
  constructor(private pgc: PGCManager) {}

  /**
   * Helper to extract filePath from manifest entry (handles both old and new formats).
   *
   * BACKWARDS COMPATIBILITY:
   * Manifest format evolved from simple strings to rich objects.
   * This helper normalizes both formats.
   *
   * @param entry - Manifest entry (string or object)
   * @returns File path for the symbol
   */
  private getFilePathFromManifestEntry(
    entry: string | { filePath?: string; [key: string]: unknown }
  ): string {
    return typeof entry === 'string' ? entry : entry.filePath || '';
  }

  /**
   * Build a directed graph from structural patterns in the Grounded Context Pool (PGC).
   *
   * ALGORITHM:
   * 1. Load structural overlay manifest (symbol → file mapping)
   * 2. Build a symbol index (name -> uniqueKey[]) for fast dependency resolution
   * 3. For each symbol (unique key):
   *    a. Load structural metadata (types, methods, params)
   *    b. Parse imports to identify direct dependencies
   *    c. Extract type usage from method signatures
   *    d. Follow inheritance (extends/implements)
   * 4. Build adjacency lists for O(1) traversal
   *
   * EDGE TYPES:
   * - imports: Direct import statements (strongest coupling)
   * - uses: Type usage in parameters/returns (interface coupling)
   * - extends: Class inheritance (structural coupling)
   * - implements: Interface implementation (contract coupling)
   *
   * PERFORMANCE:
   * - Typical: O(N × M) where N=symbols, M=avg imports per symbol
   * - Worst case: O(N²) for fully interconnected graph (rare in practice)
   * - Optimization: Structural hashes enable incremental updates
   *
   * @returns Complete directed graph with nodes, edges, and adjacency lists
   */
  async buildGraph(): Promise<DirectedGraph> {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const outgoing = new Map<string, Set<string>>();
    const incoming = new Map<string, Set<string>>();

    // Load manifest
    const manifest = await this.pgc.overlays.getManifest('structural_patterns');

    // Build symbol index (raw name -> unique keys)
    const symbolIndex = new Map<string, string[]>();
    for (const key of Object.keys(manifest)) {
      const name = key.includes('#') ? key.split('#')[1] : key;
      if (!symbolIndex.has(name)) symbolIndex.set(name, []);
      symbolIndex.get(name)!.push(key);
    }

    // Helper to resolve a symbol name to a unique key from the manifest
    const resolveToKey = (name: string): string | null => {
      if (manifest[name]) return name; // Direct match (unique key or legacy)
      const matches = symbolIndex.get(name);
      return matches && matches.length > 0 ? matches[0] : null; // Pick first if multiple
    };

    // For each unique key in manifest
    for (const [uniqueKey, manifestEntry] of Object.entries(manifest)) {
      const parsedEntry = this.pgc.overlays.parseManifestEntry(manifestEntry);
      const filePath = parsedEntry.filePath || '';
      const symbolName = uniqueKey.includes('#')
        ? uniqueKey.split('#')[1]
        : uniqueKey;

      // Load structural pattern metadata
      const metadata = await this.pgc.overlays.get(
        'structural_patterns',
        uniqueKey,
        StructuralPatternMetadataSchema
      );

      if (!metadata) continue;

      // Add node
      const node: GraphNode = {
        symbol: symbolName, // Keep the raw name for display
        filePath,
        type: this.inferSymbolType(metadata.structuralSignature),
        structuralHash: metadata.symbolStructuralDataHash,
        architecturalRole: metadata.architecturalRole,
      };
      nodes.set(uniqueKey, node);

      // Load structural data to find dependencies
      const structuralDataBuffer = await this.pgc.objectStore.retrieve(
        metadata.symbolStructuralDataHash
      );

      if (!structuralDataBuffer) continue;

      const structuralData = JSON.parse(structuralDataBuffer.toString());

      // Extract dependencies from imports
      const imports = structuralData.imports || [];
      for (const imp of imports) {
        const namedImportMatch = imp.match(/import\s+\{([^}]+)\}/);
        const defaultImportMatch = imp.match(/import\s+(\w+)\s+from/);

        const importedSymbols: string[] = [];

        if (namedImportMatch) {
          const names = namedImportMatch[1]
            .split(',')
            .map((s: string) => s.trim())
            .map((s: string) => s.split(' as ')[0].trim());
          importedSymbols.push(...names);
        } else if (defaultImportMatch) {
          importedSymbols.push(defaultImportMatch[1]);
        }

        for (const importedSymbolName of importedSymbols) {
          const targetKey = resolveToKey(importedSymbolName);
          if (targetKey) {
            const edge: GraphEdge = {
              from: uniqueKey,
              to: targetKey,
              type: 'imports',
              fromFile: filePath,
              toFile: this.getFilePathFromManifestEntry(manifest[targetKey]),
            };
            edges.push(edge);

            if (!outgoing.has(uniqueKey)) outgoing.set(uniqueKey, new Set());
            if (!incoming.has(targetKey)) incoming.set(targetKey, new Set());

            outgoing.get(uniqueKey)!.add(targetKey);
            incoming.get(targetKey)!.add(uniqueKey);
          }
        }
      }

      // Extract dependencies from type usage (classes, functions, interfaces)
      if (structuralData.classes) {
        for (const cls of structuralData.classes) {
          for (const base of cls.base_classes || []) {
            const targetKey = resolveToKey(base);
            if (targetKey) {
              edges.push({
                from: uniqueKey,
                to: targetKey,
                type: 'extends',
                fromFile: filePath,
                toFile: this.getFilePathFromManifestEntry(manifest[targetKey]),
              });
              if (!outgoing.has(uniqueKey)) outgoing.set(uniqueKey, new Set());
              if (!incoming.has(targetKey)) incoming.set(targetKey, new Set());
              outgoing.get(uniqueKey)!.add(targetKey);
              incoming.get(targetKey)!.add(uniqueKey);
            }
          }

          for (const iface of cls.implements_interfaces || []) {
            const targetKey = resolveToKey(iface);
            if (targetKey) {
              edges.push({
                from: uniqueKey,
                to: targetKey,
                type: 'implements',
                fromFile: filePath,
                toFile: this.getFilePathFromManifestEntry(manifest[targetKey]),
              });
              if (!outgoing.has(uniqueKey)) outgoing.set(uniqueKey, new Set());
              if (!incoming.has(targetKey)) incoming.set(targetKey, new Set());
              outgoing.get(uniqueKey)!.add(targetKey);
              incoming.get(targetKey)!.add(uniqueKey);
            }
          }

          for (const method of cls.methods || []) {
            for (const param of method.params || []) {
              const cleanType = this.cleanTypeName(param.type);
              const targetKey = cleanType ? resolveToKey(cleanType) : null;
              if (targetKey) {
                if (
                  !edges.find(
                    (e) =>
                      e.from === uniqueKey &&
                      e.to === targetKey &&
                      e.type === 'uses'
                  )
                ) {
                  edges.push({
                    from: uniqueKey,
                    to: targetKey,
                    type: 'uses',
                    fromFile: filePath,
                    toFile: this.getFilePathFromManifestEntry(
                      manifest[targetKey]
                    ),
                  });
                  if (!outgoing.has(uniqueKey))
                    outgoing.set(uniqueKey, new Set());
                  if (!incoming.has(targetKey))
                    incoming.set(targetKey, new Set());
                  outgoing.get(uniqueKey)!.add(targetKey);
                  incoming.get(targetKey)!.add(uniqueKey);
                }
              }
            }

            const returnType = this.cleanTypeName(method.returns);
            const targetKey = returnType ? resolveToKey(returnType) : null;
            if (targetKey) {
              if (
                !edges.find(
                  (e) =>
                    e.from === uniqueKey &&
                    e.to === targetKey &&
                    e.type === 'uses'
                )
              ) {
                edges.push({
                  from: uniqueKey,
                  to: targetKey,
                  type: 'uses',
                  fromFile: filePath,
                  toFile: this.getFilePathFromManifestEntry(
                    manifest[targetKey]
                  ),
                });
                if (!outgoing.has(uniqueKey)) outgoing.set(uniqueKey, new Set());
                if (!incoming.has(targetKey))
                  incoming.set(targetKey, new Set());
                outgoing.get(uniqueKey)!.add(targetKey);
                incoming.get(targetKey)!.add(uniqueKey);
              }
            }

            const bodyDeps = (method as any).body_dependencies;
            if (bodyDeps?.instantiations) {
              for (const className of bodyDeps.instantiations) {
                const targetKey = resolveToKey(className);
                if (targetKey) {
                  if (
                    !edges.find(
                      (e) =>
                        e.from === uniqueKey &&
                        e.to === targetKey &&
                        e.type === 'uses'
                    )
                  ) {
                    edges.push({
                      from: uniqueKey,
                      to: targetKey,
                      type: 'uses',
                      fromFile: filePath,
                      toFile: this.getFilePathFromManifestEntry(
                        manifest[targetKey]
                      ),
                    });
                    if (!outgoing.has(uniqueKey))
                      outgoing.set(uniqueKey, new Set());
                    if (!incoming.has(targetKey))
                      incoming.set(targetKey, new Set());
                    outgoing.get(uniqueKey)!.add(targetKey);
                    incoming.get(targetKey)!.add(uniqueKey);
                  }
                }
              }
            }
          }
        }
      }

      if (structuralData.functions) {
        for (const func of structuralData.functions) {
          for (const param of func.params || []) {
            const cleanType = this.cleanTypeName(param.type);
            const targetKey = cleanType ? resolveToKey(cleanType) : null;
            if (targetKey) {
              if (
                !edges.find(
                  (e) =>
                    e.from === uniqueKey && e.to === targetKey && e.type === 'uses'
                )
              ) {
                edges.push({
                  from: uniqueKey,
                  to: targetKey,
                  type: 'uses',
                  fromFile: filePath,
                  toFile: this.getFilePathFromManifestEntry(
                    manifest[targetKey]
                  ),
                });
                if (!outgoing.has(uniqueKey)) outgoing.set(uniqueKey, new Set());
                if (!incoming.has(targetKey))
                  incoming.set(targetKey, new Set());
                outgoing.get(uniqueKey)!.add(targetKey);
                incoming.get(targetKey)!.add(uniqueKey);
              }
            }
          }

          const returnType = this.cleanTypeName(func.returns);
          const targetKey = returnType ? resolveToKey(returnType) : null;
          if (targetKey) {
            if (
              !edges.find(
                (e) =>
                  e.from === uniqueKey && e.to === targetKey && e.type === 'uses'
              )
            ) {
              edges.push({
                from: uniqueKey,
                to: targetKey,
                type: 'uses',
                fromFile: filePath,
                toFile: this.getFilePathFromManifestEntry(manifest[targetKey]),
              });
              if (!outgoing.has(uniqueKey)) outgoing.set(uniqueKey, new Set());
              if (!incoming.has(targetKey)) incoming.set(targetKey, new Set());
              outgoing.get(uniqueKey)!.add(targetKey);
              incoming.get(targetKey)!.add(uniqueKey);
            }
          }

          const bodyDeps = (func as any).body_dependencies;
          if (bodyDeps?.instantiations) {
            for (const className of bodyDeps.instantiations) {
              const targetKey = resolveToKey(className);
              if (targetKey) {
                if (
                  !edges.find(
                    (e) =>
                      e.from === uniqueKey &&
                      e.to === targetKey &&
                      e.type === 'uses'
                  )
                ) {
                  edges.push({
                    from: uniqueKey,
                    to: targetKey,
                    type: 'uses',
                    fromFile: filePath,
                    toFile: this.getFilePathFromManifestEntry(
                      manifest[targetKey]
                    ),
                  });
                  if (!outgoing.has(uniqueKey))
                    outgoing.set(uniqueKey, new Set());
                  if (!incoming.has(targetKey))
                    incoming.set(targetKey, new Set());
                  outgoing.get(uniqueKey)!.add(targetKey);
                  incoming.get(targetKey)!.add(uniqueKey);
                }
              }
            }
          }
        }
      }
    }

    return {
      nodes,
      edges,
      outgoing,
      incoming,
    };
  }

  /**
   * Get blast radius for a symbol change.
   *
   * Computes the complete impact of modifying a symbol by traversing
   * both upstream (consumers) and downstream (dependencies).
   *
   * @param symbol - The symbol name to analyze (e.g., 'AuthManager')
   * @param options - Traversal configuration (depth, direction, transitivity)
   * @returns Complete blast radius analysis with metrics
   * @throws Error if symbol not found in graph
   */
  async getBlastRadius(
    symbol: string,
    options: TraversalOptions = {}
  ): Promise<BlastRadiusResult> {
    const {
      maxDepth = 3,
      direction = 'both',
      includeTransitive = true,
    } = options;

    // Build the graph
    const graph = await this.buildGraph();

    // Resolve target symbol to unique key
    let targetKey: string | undefined;
    if (graph.nodes.has(symbol)) {
      targetKey = symbol; // Direct match (unique key or legacy)
    } else {
      // Try suffix match (raw symbol name)
      for (const key of graph.nodes.keys()) {
        if (key.endsWith(`#${symbol}`)) {
          targetKey = key;
          break;
        }
      }
    }

    if (!targetKey) {
      throw new Error(`Symbol '${symbol}' not found in graph`);
    }

    const node = graph.nodes.get(targetKey)!;

    // Traverse upstream (consumers)
    const consumers: GraphNode[] = [];
    if (direction === 'up' || direction === 'both') {
      const visited = new Set<string>();
      await this.traverseUp(
        targetKey,
        graph,
        consumers,
        visited,
        maxDepth,
        includeTransitive
      );
    }

    // Traverse downstream (dependencies)
    const dependencies: GraphNode[] = [];
    if (direction === 'down' || direction === 'both') {
      const visited = new Set<string>();
      await this.traverseDown(
        targetKey,
        graph,
        dependencies,
        visited,
        maxDepth,
        includeTransitive
      );
    }

    // Calculate metrics
    const totalImpacted = consumers.length + dependencies.length + 1; // +1 for the symbol itself
    const maxConsumerDepth = this.calculateMaxDepth(
      targetKey,
      graph,
      'up',
      maxDepth
    );
    const maxDependencyDepth = this.calculateMaxDepth(
      targetKey,
      graph,
      'down',
      maxDepth
    );
    const criticalPaths = this.findCriticalPaths(targetKey, graph, maxDepth);

    return {
      symbol: node.symbol,
      filePath: node.filePath,
      consumers,
      dependencies,
      graph,
      metrics: {
        totalImpacted,
        maxConsumerDepth,
        maxDependencyDepth,
        criticalPaths,
      },
    };
  }

  /**
   * Traverse up (find consumers) using breadth-first search.
   *
   * Finds all symbols that depend on the given symbol (upstream impact).
   * Uses the incoming adjacency list for O(1) neighbor lookup.
   *
   * @param symbol - Starting symbol
   * @param graph - The complete dependency graph
   * @param result - Accumulator for discovered consumer nodes
   * @param visited - Set of already-visited symbols (prevents cycles)
   * @param maxDepth - Maximum traversal depth
   * @param includeTransitive - Whether to follow transitive dependencies
   * @param currentDepth - Current depth in traversal (internal)
   */
  private async traverseUp(
    symbol: string,
    graph: DirectedGraph,
    result: GraphNode[],
    visited: Set<string>,
    maxDepth: number,
    includeTransitive: boolean,
    currentDepth = 0
  ): Promise<void> {
    if (currentDepth >= maxDepth || visited.has(symbol)) return;
    visited.add(symbol);

    const consumers = graph.incoming.get(symbol);
    if (!consumers) return;

    for (const consumer of consumers) {
      const node = graph.nodes.get(consumer);
      if (node && !result.find((n) => n.symbol === node.symbol && n.filePath === node.filePath)) {
        result.push(node);
      }

      if (includeTransitive) {
        await this.traverseUp(
          consumer,
          graph,
          result,
          visited,
          maxDepth,
          includeTransitive,
          currentDepth + 1
        );
      }
    }
  }

  /**
   * Traverse down (find dependencies) using breadth-first search.
   *
   * Finds all symbols that this symbol depends on (downstream risk).
   * Uses the outgoing adjacency list for O(1) neighbor lookup.
   *
   * @param symbol - Starting symbol
   * @param graph - The complete dependency graph
   * @param result - Accumulator for discovered dependency nodes
   * @param visited - Set of already-visited symbols (prevents cycles)
   * @param maxDepth - Maximum traversal depth
   * @param includeTransitive - Whether to follow transitive dependencies
   * @param currentDepth - Current depth in traversal (internal)
   */
  private async traverseDown(
    symbol: string,
    graph: DirectedGraph,
    result: GraphNode[],
    visited: Set<string>,
    maxDepth: number,
    includeTransitive: boolean,
    currentDepth = 0
  ): Promise<void> {
    if (currentDepth >= maxDepth || visited.has(symbol)) return;
    visited.add(symbol);

    const dependencies = graph.outgoing.get(symbol);
    if (!dependencies) return;

    for (const dep of dependencies) {
      const node = graph.nodes.get(dep);
      if (node && !result.find((n) => n.symbol === node.symbol && n.filePath === node.filePath)) {
        result.push(node);
      }

      if (includeTransitive) {
        await this.traverseDown(
          dep,
          graph,
          result,
          visited,
          maxDepth,
          includeTransitive,
          currentDepth + 1
        );
      }
    }
  }

  /**
   * Calculate maximum depth reached during traversal.
   *
   * @param symbol - Starting symbol
   * @param graph - The complete dependency graph
   * @param direction - 'up' for consumers, 'down' for dependencies
   * @param maxDepth - Maximum depth to search
   * @returns The deepest level reached
   */
  private calculateMaxDepth(
    symbol: string,
    graph: DirectedGraph,
    direction: 'up' | 'down',
    maxDepth: number
  ): number {
    const visited = new Set<string>();
    let max = 0;

    const traverse = (current: string, depth: number) => {
      if (depth > maxDepth || visited.has(current)) return;
      visited.add(current);
      max = Math.max(max, depth);

      const neighbors =
        direction === 'up'
          ? graph.incoming.get(current)
          : graph.outgoing.get(current);

      if (neighbors) {
        for (const neighbor of neighbors) {
          traverse(neighbor, depth + 1);
        }
      }
    };

    traverse(symbol, 0);
    return max;
  }

  /**
   * Find critical paths (high-impact dependency chains).
   *
   * @param symbol - Starting symbol
   * @param graph - The complete dependency graph
   * @param maxDepth - Maximum path length to consider
   * @returns Array of critical paths sorted by impact
   */
  private findCriticalPaths(
    symbol: string,
    graph: DirectedGraph,
    maxDepth: number
  ): CriticalPath[] {
    const paths: CriticalPath[] = [];

    // Find symbols with most consumers (high fan-in)
    const consumerCounts = new Map<string, number>();
    for (const [sym, consumers] of graph.incoming.entries()) {
      consumerCounts.set(sym, consumers.size);
    }

    // Sort by consumer count
    const topSymbols = Array.from(consumerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Find paths from our symbol to these high-impact symbols
    for (const [targetSymbol, consumerCount] of topSymbols) {
      const path = this.findPath(symbol, targetSymbol, graph, maxDepth);
      if (path) {
        paths.push({
          path,
          depth: path.length - 1,
          reason: `${targetSymbol.includes('#') ? targetSymbol.split('#')[1] : targetSymbol} has ${consumerCount} consumers`,
        });
      }
    }

    return paths;
  }

  /**
   * Find shortest path between two symbols using BFS.
   *
   * @param from - Starting symbol
   * @param to - Target symbol
   * @param graph - The complete dependency graph
   * @param maxDepth - Maximum path length
   * @returns Array of symbols forming the path, or null if no path exists
   */
  private findPath(
    from: string,
    to: string,
    graph: DirectedGraph,
    maxDepth: number
  ): string[] | null {
    const queue: { symbol: string; path: string[] }[] = [
      { symbol: from, path: [from] },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { symbol, path } = queue.shift()!;

      if (symbol === to) {
        return path;
      }

      if (path.length > maxDepth || visited.has(symbol)) {
        continue;
      }

      visited.add(symbol);

      // Check both incoming and outgoing
      const neighbors = new Set<string>();
      const outgoing = graph.outgoing.get(symbol);
      const incoming = graph.incoming.get(symbol);

      if (outgoing) {
        for (const n of outgoing) neighbors.add(n);
      }
      if (incoming) {
        for (const n of incoming) neighbors.add(n);
      }

      for (const neighbor of neighbors) {
        queue.push({ symbol: neighbor, path: [...path, neighbor] });
      }
    }

    return null;
  }

  /**
   * Infer symbol type from structural signature.
   *
   * @param signature - Structural signature (e.g., "class:AuthManager:...")
   * @returns Symbol type or 'class' as default
   */
  private inferSymbolType(
    signature: string
  ): 'class' | 'function' | 'interface' {
    if (signature.includes('class:')) return 'class';
    if (signature.includes('function:')) return 'function';
    if (signature.includes('interface:')) return 'interface';
    return 'class'; // default
  }

  /**
   * Clean type name to extract the base type identifier.
   *
   * @param type - Raw type string from AST
   * @returns Clean type name or null if not a user-defined type
   */
  private cleanTypeName(type: string | undefined): string | null {
    if (!type) return null;

    const cleaned = type
      .replace(/\[\]/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\([^)]*\)/g, '')
      .split('|')[0]
      .split('&')[0]
      .trim();

    // Only return if it looks like a user-defined type (starts with uppercase)
    if (cleaned && /^[A-Z]/.test(cleaned) && cleaned.length > 1) {
      return cleaned;
    }

    return null;
  }
}
