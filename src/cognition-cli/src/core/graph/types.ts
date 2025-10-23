/**
 * Graph types for blast radius and dependency analysis
 */

export interface GraphNode {
  symbol: string;
  filePath: string;
  type: 'class' | 'function' | 'interface';
  structuralHash: string;
  architecturalRole?: string;
}

export interface GraphEdge {
  from: string; // symbol name
  to: string; // symbol name
  type: 'imports' | 'uses' | 'extends' | 'implements';
  fromFile?: string;
  toFile?: string;
}

export interface DirectedGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  // Adjacency lists for fast lookups
  outgoing: Map<string, Set<string>>; // symbol -> symbols it depends on
  incoming: Map<string, Set<string>>; // symbol -> symbols that depend on it
}

export interface TraversalOptions {
  maxDepth?: number;
  direction?: 'up' | 'down' | 'both';
  includeTransitive?: boolean;
}

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

export interface CriticalPath {
  path: string[]; // symbol names
  depth: number;
  reason: string; // why it's critical (e.g., "most consumers")
}

export interface Path {
  nodes: string[]; // symbol names in order
  edges: GraphEdge[];
  length: number;
}
