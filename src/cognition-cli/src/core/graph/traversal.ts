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
   * 2. For each symbol:
   *    a. Load structural metadata (types, methods, params)
   *    b. Parse imports to identify direct dependencies
   *    c. Extract type usage from method signatures
   *    d. Follow inheritance (extends/implements)
   * 3. Build adjacency lists for O(1) traversal
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
   *
   * @example
   * const graph = await traversal.buildGraph();
   * console.log(`Graph statistics:`);
   * console.log(`- Nodes: ${graph.nodes.size}`);
   * console.log(`- Edges: ${graph.edges.length}`);
   * console.log(`- Avg fan-out: ${graph.edges.length / graph.nodes.size}`);
   */
  async buildGraph(): Promise<DirectedGraph> {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const outgoing = new Map<string, Set<string>>();
    const incoming = new Map<string, Set<string>>();

    // Load manifest
    const manifest = await this.pgc.overlays.getManifest('structural_patterns');

    // For each symbol in manifest
    for (const [symbol, manifestEntry] of Object.entries(manifest)) {
      // Parse manifest entry (handles both old string and new object formats)
      const filePath =
        typeof manifestEntry === 'string'
          ? manifestEntry
          : manifestEntry.filePath || '';

      // Load structural pattern metadata
      const overlayKey = `${filePath}#${symbol}`;
      const metadata = await this.pgc.overlays.get(
        'structural_patterns',
        overlayKey,
        StructuralPatternMetadataSchema
      );

      if (!metadata) continue;

      // Add node
      const node: GraphNode = {
        symbol,
        filePath,
        type: this.inferSymbolType(metadata.structuralSignature),
        structuralHash: metadata.symbolStructuralDataHash,
        architecturalRole: metadata.architecturalRole,
      };
      nodes.set(symbol, node);

      // Load structural data to find dependencies
      const structuralDataBuffer = await this.pgc.objectStore.retrieve(
        metadata.symbolStructuralDataHash
      );

      if (!structuralDataBuffer) continue;

      const structuralData = JSON.parse(structuralDataBuffer.toString());

      // Extract dependencies from imports
      const imports = structuralData.imports || [];
      for (const imp of imports) {
        // Parse import statement to extract symbols
        // Examples:
        // import { Foo, Bar } from './file'
        // import Foo from './file'
        // import * as Foo from './file'
        const namedImportMatch = imp.match(/import\s+\{([^}]+)\}/);
        const defaultImportMatch = imp.match(/import\s+(\w+)\s+from/);

        const importedSymbols: string[] = [];

        if (namedImportMatch) {
          const names = namedImportMatch[1]
            .split(',')
            .map((s: string) => s.trim())
            .map((s: string) => s.split(' as ')[0].trim()); // Handle "Foo as Bar"
          importedSymbols.push(...names);
        } else if (defaultImportMatch) {
          importedSymbols.push(defaultImportMatch[1]);
        }

        // Add edges for each imported symbol that exists in manifest
        for (const importedSymbol of importedSymbols) {
          if (manifest[importedSymbol]) {
            const edge: GraphEdge = {
              from: symbol,
              to: importedSymbol,
              type: 'imports',
              fromFile: filePath,
              toFile: this.getFilePathFromManifestEntry(
                manifest[importedSymbol]
              ),
            };
            edges.push(edge);

            // Update adjacency lists
            if (!outgoing.has(symbol)) outgoing.set(symbol, new Set());
            if (!incoming.has(importedSymbol))
              incoming.set(importedSymbol, new Set());

            outgoing.get(symbol)!.add(importedSymbol);
            incoming.get(importedSymbol)!.add(symbol);
          }
        }
      }

      // Extract dependencies from type usage (classes, functions, interfaces)
      if (structuralData.classes) {
        for (const cls of structuralData.classes) {
          // base_classes
          for (const base of cls.base_classes || []) {
            if (manifest[base]) {
              edges.push({
                from: symbol,
                to: base,
                type: 'extends',
                fromFile: filePath,
                toFile: this.getFilePathFromManifestEntry(manifest[base]),
              });
              if (!outgoing.has(symbol)) outgoing.set(symbol, new Set());
              if (!incoming.has(base)) incoming.set(base, new Set());
              outgoing.get(symbol)!.add(base);
              incoming.get(base)!.add(symbol);
            }
          }

          // implements_interfaces
          for (const iface of cls.implements_interfaces || []) {
            if (manifest[iface]) {
              edges.push({
                from: symbol,
                to: iface,
                type: 'implements',
                fromFile: filePath,
                toFile: this.getFilePathFromManifestEntry(manifest[iface]),
              });
              if (!outgoing.has(symbol)) outgoing.set(symbol, new Set());
              if (!incoming.has(iface)) incoming.set(iface, new Set());
              outgoing.get(symbol)!.add(iface);
              incoming.get(iface)!.add(symbol);
            }
          }

          // Method parameter and return types
          for (const method of cls.methods || []) {
            for (const param of method.params || []) {
              const cleanType = this.cleanTypeName(param.type);
              if (cleanType && manifest[cleanType]) {
                if (
                  !edges.find(
                    (e) =>
                      e.from === symbol &&
                      e.to === cleanType &&
                      e.type === 'uses'
                  )
                ) {
                  edges.push({
                    from: symbol,
                    to: cleanType,
                    type: 'uses',
                    fromFile: filePath,
                    toFile: this.getFilePathFromManifestEntry(
                      manifest[cleanType]
                    ),
                  });
                  if (!outgoing.has(symbol)) outgoing.set(symbol, new Set());
                  if (!incoming.has(cleanType))
                    incoming.set(cleanType, new Set());
                  outgoing.get(symbol)!.add(cleanType);
                  incoming.get(cleanType)!.add(symbol);
                }
              }
            }

            const returnType = this.cleanTypeName(method.returns);
            if (returnType && manifest[returnType]) {
              if (
                !edges.find(
                  (e) =>
                    e.from === symbol &&
                    e.to === returnType &&
                    e.type === 'uses'
                )
              ) {
                edges.push({
                  from: symbol,
                  to: returnType,
                  type: 'uses',
                  fromFile: filePath,
                  toFile: this.getFilePathFromManifestEntry(
                    manifest[returnType]
                  ),
                });
                if (!outgoing.has(symbol)) outgoing.set(symbol, new Set());
                if (!incoming.has(returnType))
                  incoming.set(returnType, new Set());
                outgoing.get(symbol)!.add(returnType);
                incoming.get(returnType)!.add(symbol);
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
   * ALGORITHM:
   * 1. Build the complete dependency graph
   * 2. Locate the target symbol node
   * 3. Traverse upstream via BFS (find consumers)
   * 4. Traverse downstream via BFS (find dependencies)
   * 5. Calculate metrics:
   *    - Total impact: unique symbols in consumers + dependencies
   *    - Max depths: longest path in each direction
   *    - Critical paths: shortest paths to high-leverage symbols
   *
   * USE CASES:
   * - Pre-refactoring impact assessment
   * - Test scope planning (which tests to run)
   * - Architectural analysis (identifying bottlenecks)
   * - Code review prioritization
   *
   * @param symbol - The symbol name to analyze (e.g., 'AuthManager')
   * @param options - Traversal configuration (depth, direction, transitivity)
   * @returns Complete blast radius analysis with metrics
   * @throws Error if symbol not found in graph
   *
   * @example
   * // Full blast radius (consumers + dependencies, depth 3)
   * const blast = await traversal.getBlastRadius('AuthManager');
   *
   * @example
   * // Only consumers (what needs retesting)
   * const blast = await traversal.getBlastRadius('validateToken', {
   *   direction: 'up',
   *   maxDepth: 5
   * });
   *
   * @example
   * // Only direct dependencies (no transitive)
   * const blast = await traversal.getBlastRadius('UserService', {
   *   direction: 'down',
   *   maxDepth: 1,
   *   includeTransitive: false
   * });
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

    // Find the node
    const node = graph.nodes.get(symbol);
    if (!node) {
      throw new Error(`Symbol '${symbol}' not found in graph`);
    }

    // Traverse upstream (consumers)
    const consumers: GraphNode[] = [];
    if (direction === 'up' || direction === 'both') {
      const visited = new Set<string>();
      await this.traverseUp(
        symbol,
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
        symbol,
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
      symbol,
      graph,
      'up',
      maxDepth
    );
    const maxDependencyDepth = this.calculateMaxDepth(
      symbol,
      graph,
      'down',
      maxDepth
    );
    const criticalPaths = this.findCriticalPaths(symbol, graph, maxDepth);

    return {
      symbol,
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
   * ALGORITHM:
   * - BFS traversal following incoming edges (reverse dependencies)
   * - Depth-limited to prevent unbounded searches
   * - Visited set prevents cycles and duplicates
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
      if (node && !result.find((n) => n.symbol === consumer)) {
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
   * ALGORITHM:
   * - BFS traversal following outgoing edges (direct dependencies)
   * - Depth-limited to prevent unbounded searches
   * - Visited set prevents cycles and duplicates
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
      if (node && !result.find((n) => n.symbol === dep)) {
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
   * Finds the longest path from the starting symbol in the specified direction.
   * Used to measure how far impact propagates through the dependency graph.
   *
   * INTERPRETATION:
   * - High upstream depth: Impact propagates far (many levels of consumers)
   * - High downstream depth: Complex dependency tree (fragile architecture)
   *
   * @param symbol - Starting symbol
   * @param graph - The complete dependency graph
   * @param direction - 'up' for consumers, 'down' for dependencies
   * @param maxDepth - Maximum depth to search
   * @returns The deepest level reached
   *
   * @example
   * const depth = calculateMaxDepth('AuthManager', graph, 'up', 10);
   * console.log(`Impact propagates ${depth} levels upstream`);
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
   * Identifies paths from the target symbol to architectural bottlenecks
   * (symbols with many consumers). These paths deserve special attention
   * during refactoring because changes propagate widely.
   *
   * ALGORITHM:
   * 1. Calculate consumer count for all symbols (fan-in)
   * 2. Identify top 5 symbols by consumer count
   * 3. Find shortest path from target to each high-impact symbol
   * 4. Return paths sorted by impact
   *
   * RANKING CRITERIA:
   * - Primary: Consumer count (more consumers = higher impact)
   * - Secondary: Path length (shorter = more direct impact)
   *
   * @param symbol - Starting symbol
   * @param graph - The complete dependency graph
   * @param maxDepth - Maximum path length to consider
   * @returns Array of critical paths sorted by impact
   *
   * @example
   * const paths = findCriticalPaths('LoginButton', graph, 5);
   * for (const path of paths) {
   *   console.log(`${path.path.join(' → ')}`);
   *   console.log(`  ${path.reason}`);
   * }
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
          reason: `${targetSymbol} has ${consumerCount} consumers`,
        });
      }
    }

    return paths;
  }

  /**
   * Find shortest path between two symbols using BFS.
   *
   * Explores the graph bidirectionally (both incoming and outgoing edges)
   * to find the shortest path regardless of dependency direction.
   *
   * ALGORITHM:
   * - Breadth-first search (guarantees shortest path)
   * - Bidirectional edge following (allows traversal in both directions)
   * - Queue-based exploration (FIFO for BFS property)
   *
   * @param from - Starting symbol
   * @param to - Target symbol
   * @param graph - The complete dependency graph
   * @param maxDepth - Maximum path length
   * @returns Array of symbols forming the path, or null if no path exists
   *
   * @example
   * const path = findPath('LoginButton', 'Database', graph, 10);
   * if (path) {
   *   console.log(`Path: ${path.join(' → ')}`);
   * }
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
   * Structural signatures encode the symbol type as a prefix.
   * This helper extracts the type for graph node classification.
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
   * Removes TypeScript/JavaScript type syntax to extract the core type name.
   * Only returns user-defined types (starts with uppercase).
   *
   * TRANSFORMATIONS:
   * - Array syntax: User[] → User
   * - Generics: Promise<User> → Promise
   * - Unions: User | Admin → User
   * - Primitives: string, number → null (not tracked)
   *
   * @param type - Raw type string from AST
   * @returns Clean type name or null if not a user-defined type
   *
   * @example
   * cleanTypeName('User[]') // → 'User'
   * cleanTypeName('Promise<User>') // → 'Promise'
   * cleanTypeName('string') // → null (primitive)
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
