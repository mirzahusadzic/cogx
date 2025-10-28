/**
 * Graph types for blast radius and dependency analysis
 */

/**
 * Represents a code symbol node in the dependency graph.
 */
export interface GraphNode {
  symbol: string;
  filePath: string;
  type: 'class' | 'function' | 'interface';
  structuralHash: string;
  architecturalRole?: string;
}

/**
 * Represents a directed edge between two code symbols.
 */
export interface GraphEdge {
  from: string; // symbol name
  to: string; // symbol name
  type: 'imports' | 'uses' | 'extends' | 'implements';
  fromFile?: string;
  toFile?: string;
}

/**
 * Represents a complete directed dependency graph with adjacency lists.
 */
export interface DirectedGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  // Adjacency lists for fast lookups
  outgoing: Map<string, Set<string>>; // symbol -> symbols it depends on
  incoming: Map<string, Set<string>>; // symbol -> symbols that depend on it
}

/**
 * Represents options for configuring graph traversal operations.
 */
export interface TraversalOptions {
  maxDepth?: number;
  direction?: 'up' | 'down' | 'both';
  includeTransitive?: boolean;
}

/**
 * Represents the complete blast radius analysis result for a symbol.
 */
export interface BlastRadiusResult {
  symbol: string;
  filePath: string;
  consumers: GraphNode[]; // Who uses this (upstream)
  dependencies: GraphNode[]; // What this uses (downstream)
  graph: DirectedGraph;
  metrics: {
    totalImpacted: number;
    maxConsumerDepth: number;
    maxDependencyDepth: number;
    criticalPaths: CriticalPath[];
  };
}

/**
 * Represents a high-impact chain through the dependency graph.
 */
export interface CriticalPath {
  path: string[]; // symbol names
  depth: number;
  reason: string; // why it's critical (e.g., "most consumers")
}

/**
 * Represents a path through the dependency graph.
 */
export interface Path {
  nodes: string[]; // symbol names in order
  edges: GraphEdge[];
  length: number;
}
