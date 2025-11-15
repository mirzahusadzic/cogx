/**
 * Dependency Graph Type Definitions
 *
 * Defines the data structures for directed dependency graphs used in blast radius analysis.
 * These types model code as a graph where symbols are nodes and dependencies are edges.
 *
 * DESIGN PRINCIPLES:
 * - Graphs are directed: edges represent "A depends on B" relationships
 * - Adjacency lists optimize traversal performance (O(1) neighbor lookup)
 * - Structural hashes enable change detection without content comparison
 * - Architectural roles categorize symbols by system responsibility
 *
 * GRAPH STRUCTURE:
 * - Nodes: Code symbols (classes, functions, interfaces)
 * - Edges: Dependency relationships (imports, extends, implements, uses)
 * - Adjacency lists: Fast lookups for traversal (outgoing = dependencies, incoming = consumers)
 *
 * BLAST RADIUS ANALYSIS:
 * When a symbol changes, the blast radius determines:
 * - Consumers: What needs to be tested (upstream impact)
 * - Dependencies: What might break this symbol (downstream risk)
 * - Critical paths: High-impact dependency chains
 *
 * @example
 * // Building a graph from structural patterns in Grounded Context Pool (PGC)
 * const traversal = new GraphTraversal(pgc);
 * const graph = await traversal.buildGraph();
 *
 * // Finding impact of changing a symbol
 * const blast = await traversal.getBlastRadius('AuthManager', { maxDepth: 3 });
 * console.log(`${blast.consumers.length} consumers will be impacted`);
 * console.log(`Critical path: ${blast.metrics.criticalPaths[0].path.join(' → ')}`);
 */

/**
 * Represents a code symbol node in the dependency graph.
 *
 * Each node corresponds to a symbol tracked in the structural overlay (O1).
 * The structural hash enables change detection, while architectural role
 * categorizes the symbol's purpose in the system.
 *
 * @example
 * const node: GraphNode = {
 *   symbol: 'AuthManager',
 *   filePath: '/src/auth/manager.ts',
 *   type: 'class',
 *   structuralHash: 'sha256:abc123...',
 *   architecturalRole: 'core_infrastructure'
 * };
 */
export interface GraphNode {
  /** Unique symbol name (e.g., 'AuthManager', 'validateToken') */
  symbol: string;

  /** Absolute path to the file containing this symbol */
  filePath: string;

  /** Symbol type determines its role in the dependency graph */
  type: 'class' | 'function' | 'interface';

  /** Content-addressable hash of the symbol's structural data (enables change detection) */
  structuralHash: string;

  /** Optional categorization by system responsibility (e.g., 'core_infrastructure', 'api_layer') */
  architecturalRole?: string;
}

/**
 * Represents a directed edge between two code symbols.
 *
 * Edges capture different types of dependencies:
 * - imports: Direct module import (strongest coupling)
 * - uses: Type usage in parameters/returns (interface coupling)
 * - extends: Inheritance relationship (structural coupling)
 * - implements: Interface implementation (contract coupling)
 *
 * DIRECTION SEMANTICS:
 * Edge from A to B means "A depends on B" (A is the consumer, B is the dependency)
 *
 * @example
 * // AuthManager imports UserService
 * const edge: GraphEdge = {
 *   from: 'AuthManager',
 *   to: 'UserService',
 *   type: 'imports',
 *   fromFile: '/src/auth/manager.ts',
 *   toFile: '/src/user/service.ts'
 * };
 */
export interface GraphEdge {
  /** Source symbol (consumer/dependent) */
  from: string;

  /** Target symbol (dependency/provider) */
  to: string;

  /** Type of dependency relationship */
  type: 'imports' | 'uses' | 'extends' | 'implements';

  /** Optional: File containing the source symbol */
  fromFile?: string;

  /** Optional: File containing the target symbol */
  toFile?: string;
}

/**
 * Represents a complete directed dependency graph with adjacency lists.
 *
 * PERFORMANCE OPTIMIZATION:
 * Adjacency lists enable O(1) neighbor lookup during traversal, critical for
 * real-time blast radius analysis on large codebases (10k+ symbols).
 *
 * GRAPH INVARIANTS:
 * - Every edge references existing nodes (referential integrity)
 * - Adjacency lists are synchronized with edge list
 * - No self-loops (symbol cannot depend on itself)
 *
 * MEMORY LAYOUT:
 * - nodes: O(N) where N = symbol count
 * - edges: O(E) where E = dependency count
 * - adjacency lists: O(N + E) total
 *
 * @example
 * // Querying the graph
 * const graph: DirectedGraph = await buildGraph();
 *
 * // Find what AuthManager depends on (downstream)
 * const dependencies = graph.outgoing.get('AuthManager');
 * console.log(`AuthManager depends on: ${[...dependencies].join(', ')}`);
 *
 * // Find what depends on AuthManager (upstream)
 * const consumers = graph.incoming.get('AuthManager');
 * console.log(`${consumers.size} symbols depend on AuthManager`);
 */
export interface DirectedGraph {
  /** Map of symbol name to node metadata */
  nodes: Map<string, GraphNode>;

  /** All dependency edges in the graph */
  edges: GraphEdge[];

  /** Adjacency list: symbol → symbols it depends on (downstream dependencies) */
  outgoing: Map<string, Set<string>>;

  /** Adjacency list: symbol → symbols that depend on it (upstream consumers) */
  incoming: Map<string, Set<string>>;
}

/**
 * Represents options for configuring graph traversal operations.
 *
 * Controls the scope and direction of blast radius analysis.
 *
 * @example
 * // Find immediate consumers only (1 level up)
 * const options: TraversalOptions = {
 *   maxDepth: 1,
 *   direction: 'up',
 *   includeTransitive: false
 * };
 *
 * @example
 * // Deep transitive dependency analysis (3 levels down)
 * const options: TraversalOptions = {
 *   maxDepth: 3,
 *   direction: 'down',
 *   includeTransitive: true
 * };
 */
export interface TraversalOptions {
  /**
   * Maximum depth to traverse from the starting symbol
   * @default 3
   * @example maxDepth: 1 → only immediate neighbors
   * @example maxDepth: 5 → explore up to 5 levels deep
   */
  maxDepth?: number;

  /**
   * Direction of traversal:
   * - 'up': Find consumers (who depends on this symbol)
   * - 'down': Find dependencies (what this symbol depends on)
   * - 'both': Complete blast radius (consumers + dependencies)
   * @default 'both'
   */
  direction?: 'up' | 'down' | 'both';

  /**
   * Whether to include transitive dependencies
   * - true: Follow the full dependency chain
   * - false: Only direct neighbors
   * @default true
   */
  includeTransitive?: boolean;
}

/**
 * Represents the complete blast radius analysis result for a symbol.
 *
 * Answers the critical question: "If I change this symbol, what breaks?"
 *
 * INTERPRETATION:
 * - totalImpacted: Symbols that may need retesting
 * - maxConsumerDepth: How far upstream the impact propagates
 * - maxDependencyDepth: Complexity of the dependency tree
 * - criticalPaths: High-leverage chains (e.g., paths to widely-used symbols)
 *
 * USE CASES:
 * - Planning refactoring scope
 * - Estimating test coverage needs
 * - Identifying architectural bottlenecks
 * - Risk assessment for changes
 *
 * @example
 * const blast = await traversal.getBlastRadius('AuthManager');
 *
 * console.log(`Impact Assessment:`);
 * console.log(`- ${blast.consumers.length} consumers need review`);
 * console.log(`- ${blast.dependencies.length} dependencies at risk`);
 * console.log(`- ${blast.metrics.totalImpacted} total symbols impacted`);
 * console.log(`- Max propagation depth: ${blast.metrics.maxConsumerDepth}`);
 *
 * // Show critical paths
 * for (const path of blast.metrics.criticalPaths) {
 *   console.log(`Critical: ${path.path.join(' → ')} (${path.reason})`);
 * }
 */
export interface BlastRadiusResult {
  /** The symbol being analyzed */
  symbol: string;

  /** File path where the symbol is defined */
  filePath: string;

  /** Symbols that consume this symbol (upstream impact) */
  consumers: GraphNode[];

  /** Symbols that this symbol depends on (downstream risk) */
  dependencies: GraphNode[];

  /** The complete dependency graph (for advanced analysis) */
  graph: DirectedGraph;

  /** Quantitative metrics about the blast radius */
  metrics: {
    /** Total number of symbols impacted (consumers + dependencies + self) */
    totalImpacted: number;

    /** Maximum depth reached when traversing consumers (upstream propagation) */
    maxConsumerDepth: number;

    /** Maximum depth reached when traversing dependencies (downstream complexity) */
    maxDependencyDepth: number;

    /** High-impact dependency chains requiring special attention */
    criticalPaths: CriticalPath[];
  };
}

/**
 * Represents a high-impact chain through the dependency graph.
 *
 * Critical paths highlight dependency chains that deserve special attention
 * during refactoring or impact analysis. A path is critical if it connects
 * to symbols with high fan-in (many consumers) or other architectural significance.
 *
 * RANKING CRITERIA:
 * - Paths to symbols with most consumers (high leverage)
 * - Paths to architectural bottlenecks
 * - Long dependency chains (high coupling risk)
 *
 * @example
 * const criticalPath: CriticalPath = {
 *   path: ['LoginButton', 'AuthService', 'UserDatabase', 'Connection'],
 *   depth: 3,
 *   reason: 'Connection has 47 consumers (architectural bottleneck)'
 * };
 *
 * // Interpretation: Changes to LoginButton could impact 47+ symbols
 * // through the Connection bottleneck
 */
export interface CriticalPath {
  /** Sequence of symbol names forming the dependency chain */
  path: string[];

  /** Number of edges in the path (length - 1) */
  depth: number;

  /** Human-readable explanation of why this path is critical */
  reason: string;
}

/**
 * Represents a path through the dependency graph.
 *
 * Generic path structure for graph algorithms (e.g., shortest path, cycle detection).
 *
 * @example
 * // Path from AuthManager to Database
 * const path: Path = {
 *   nodes: ['AuthManager', 'UserService', 'UserRepository', 'Database'],
 *   edges: [
 *     { from: 'AuthManager', to: 'UserService', type: 'imports' },
 *     { from: 'UserService', to: 'UserRepository', type: 'uses' },
 *     { from: 'UserRepository', to: 'Database', type: 'imports' }
 *   ],
 *   length: 3
 * };
 */
export interface Path {
  /** Ordered list of symbol names in the path */
  nodes: string[];

  /** Edges connecting the nodes (in order) */
  edges: GraphEdge[];

  /** Number of edges in the path */
  length: number;
}
