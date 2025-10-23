/**
 * Graph traversal for blast radius analysis
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

export class GraphTraversal {
  constructor(private pgc: PGCManager) {}

  /**
   * Build a directed graph from structural patterns
   */
  async buildGraph(): Promise<DirectedGraph> {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const outgoing = new Map<string, Set<string>>();
    const incoming = new Map<string, Set<string>>();

    // Load manifest
    const manifest = await this.pgc.overlays.getManifest('structural_patterns');

    // For each symbol in manifest
    for (const [symbol, filePath] of Object.entries(manifest)) {
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
              toFile: manifest[importedSymbol],
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
                toFile: manifest[base],
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
                toFile: manifest[iface],
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
                    toFile: manifest[cleanType],
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
                  toFile: manifest[returnType],
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
   * Get blast radius for a symbol
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
   * Traverse up (find consumers)
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
   * Traverse down (find dependencies)
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
   * Calculate maximum depth reached
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
   * Find critical paths (high-impact chains)
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
   * Find shortest path between two symbols
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
   * Infer symbol type from structural signature
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
   * Clean type name to extract the base type
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
