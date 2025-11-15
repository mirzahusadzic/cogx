/**
 * Overlay Algebra Foundation
 *
 * Universal interface for lattice operations across all overlays in the system.
 * Enables boolean algebra and semantic queries over distributed knowledge graphs.
 *
 * THEORETICAL FOUNDATION:
 * Overlays form a lattice structure where:
 * - Meet (∧): Greatest lower bound (semantic alignment)
 * - Join (∨): Least upper bound (union of concepts)
 * - Partial ordering: Defined by semantic similarity
 *
 * This algebraic structure enables compositional reasoning:
 * "Which security threats (O2) align with mission principles (O4)?"
 * = meet(O2.filter(type='threat'), O4.filter(type='principle'))
 *
 * DESIGN PHILOSOPHY:
 * "Build powerful primitives first, then compose UX sugar on top."
 * - Every overlay implements OverlayAlgebra → every overlay is queryable
 * - Operations compose: filter().select().meet() chains naturally
 * - Type-safe: TypeScript generics preserve metadata types across operations
 *
 * ALGEBRAIC OPERATIONS:
 * - Meet (∧): Semantic alignment via vector similarity
 * - Union (∪): All items from multiple overlays (set union)
 * - Intersection (∩): Items present in all overlays (set intersection)
 * - Difference (\): Items in A but not in B (set difference)
 * - Complement (¬): Items NOT in set (relative to universal set)
 * - Select: Filter by symbol/id set (projection)
 * - Exclude: Remove items matching symbol/id set (anti-projection)
 * - Project (→): Query-guided traversal between overlays
 *
 * IMPLEMENTATION STRATEGY:
 * - Vector embeddings: Enable semantic operations (meet, project)
 * - Symbol sets: Enable exact set operations (union, intersection, difference)
 * - Lazy evaluation: Operations return promises (allows optimization)
 * - Metadata preservation: Generic types maintain domain-specific fields
 *
 * OVERLAY INTEGRATION:
 * Each overlay (O1-O7) implements this interface in the Grounded Context Pool (PGC):
 * - O1 (Structural): Code symbols and patterns
 * - O2 (Security): Threats, vulnerabilities, mitigations
 * - O3 (Semantic): Natural language descriptions
 * - O4 (Mission): Strategic principles and values
 * - O5 (Operational): Workflows and processes
 * - O6 (Assessment): Test coverage and quality metrics
 * - O7 (Context): Runtime behavior and traces
 *
 * @example
 * // Find security threats that violate mission principles
 * const security = await overlayRegistry.get('O2');
 * const mission = await overlayRegistry.get('O4');
 *
 * const violations = await meet(
 *   security.filter(m => m.type === 'threat'),
 *   mission.filter(m => m.type === 'principle'),
 *   { threshold: 0.75 }
 * );
 *
 * @example
 * // Find code symbols lacking security coverage
 * const structural = await overlayRegistry.get('O1');
 * const codeSymbols = await structural.getSymbolSet();
 * const secureSymbols = await security.getSymbolSet();
 * const uncovered = symbolDifference(codeSymbols, secureSymbols);
 */

/**
 * Metadata associated with overlay items.
 *
 * Base interface that all overlay metadata extends.
 * Provides common fields while allowing domain-specific extensions.
 *
 * REQUIRED FIELDS:
 * - text: Semantic content for embedding and display
 *
 * OPTIONAL FIELDS:
 * - type: Domain-specific classification (e.g., 'threat', 'principle', 'pattern')
 * - weight: Importance/confidence score [0, 1]
 *
 * EXTENSIBILITY:
 * Each overlay extends this with domain-specific fields:
 * - SecurityMetadata: severity, attack_vector, cwe_id
 * - MissionMetadata: category, stakeholder, priority
 * - StructuralMetadata: language, symbols, complexity
 *
 * @example
 * interface SecurityMetadata extends OverlayMetadata {
 *   text: string;
 *   type: 'threat' | 'vulnerability' | 'mitigation';
 *   severity: 'low' | 'medium' | 'high' | 'critical';
 *   cwe_id?: string;
 * }
 */
export interface OverlayMetadata {
  /** Arbitrary domain-specific fields */
  [key: string]: unknown;

  /** Semantic content for embedding and display */
  text: string;

  /** Domain-specific type classification */
  type?: string;

  /** Importance or confidence score [0, 1] */
  weight?: number;
}

/**
 * Universal overlay item with embedding and metadata.
 *
 * Core data structure for all overlay entries in the Grounded Context Pool (PGC).
 * Combines semantic vectors with structured metadata.
 *
 * COMPONENTS:
 * - id: Content-addressable identifier (typically hash-based)
 * - embedding: 768-dimensional vector for semantic similarity
 * - metadata: Domain-specific structured data
 *
 * EMBEDDING MODEL:
 * - Dimensions: 768 (Gemma embedding model)
 * - Normalized: Unit vectors (cosine similarity = dot product)
 * - Semantic: Similar concepts have high cosine similarity (>0.7)
 *
 * @example
 * const item: OverlayItem<SecurityMetadata> = {
 *   id: 'sec:threat:sql-injection',
 *   embedding: [0.12, -0.34, ...], // 768 dimensions
 *   metadata: {
 *     text: 'SQL injection via user input',
 *     type: 'threat',
 *     severity: 'critical',
 *     cwe_id: 'CWE-89'
 *   }
 * };
 */
export interface OverlayItem<T extends OverlayMetadata = OverlayMetadata> {
  /** Unique identifier (content-addressable) */
  id: string;

  /** 768-dimensional semantic embedding vector */
  embedding: number[];

  /** Domain-specific metadata */
  metadata: T;
}

/**
 * Result of a Meet operation between two overlay items.
 *
 * Represents a semantic alignment between items from different overlays.
 * The similarity score quantifies the strength of the alignment.
 *
 * INTERPRETATION:
 * - similarity >= 0.9: Very strong alignment (nearly identical concepts)
 * - similarity >= 0.7: Strong alignment (related concepts)
 * - similarity >= 0.5: Moderate alignment (tangentially related)
 * - similarity < 0.5: Weak alignment (unrelated)
 *
 * @example
 * const result: MeetResult<SecurityMetadata, MissionMetadata> = {
 *   itemA: { // Security threat
 *     id: 'sec:threat:data-leak',
 *     embedding: [...],
 *     metadata: { text: 'User data exposure', type: 'threat' }
 *   },
 *   itemB: { // Mission principle
 *     id: 'mission:principle:privacy',
 *     embedding: [...],
 *     metadata: { text: 'Protect user privacy', type: 'principle' }
 *   },
 *   similarity: 0.82 // Strong semantic alignment
 * };
 */
export interface MeetResult<
  A extends OverlayMetadata,
  B extends OverlayMetadata,
> {
  /** Item from overlay A */
  itemA: OverlayItem<A>;

  /** Item from overlay B */
  itemB: OverlayItem<B>;

  /** Cosine similarity between embeddings [0, 1] */
  similarity: number;
}

/**
 * Universal OverlayAlgebra interface
 *
 * Every overlay manager implements this interface to participate in lattice operations.
 *
 * LATTICE OPERATIONS:
 * - Meet (∧): Find alignment between overlays via vector similarity
 * - Filter (|): Metadata-based predicates
 * - Project (→): Query-guided traversal between overlays
 *
 * EXAMPLE USAGE:
 * ```typescript
 * const security = await overlayRegistry.get('O2');
 * const mission = await overlayRegistry.get('O4');
 *
 * // Meet: Which attacks violate mission principles?
 * const aligned = await lattice.meet(
 *   security.filter({ type: 'attack_vector' }),
 *   mission.filter({ type: 'principle' }),
 *   0.7 // similarity threshold
 * );
 * ```
 */
export interface OverlayAlgebra<T extends OverlayMetadata = OverlayMetadata> {
  /**
   * Get overlay identifier (O1, O2, O3, O4, O5, O6, O7)
   */
  getOverlayId(): string;

  /**
   * Get human-readable overlay name
   */
  getOverlayName(): string;

  /**
   * Get all supported item types for this overlay
   * @example O2 → ['threat_model', 'attack_vector', 'mitigation', 'boundary', 'vulnerability']
   */
  getSupportedTypes(): string[];

  /**
   * Get all items from this overlay with embeddings
   * @returns Array of items with 768-dimensional embeddings
   */
  getAllItems(): Promise<OverlayItem<T>[]>;

  /**
   * Get items filtered by type
   * @param type - Domain-specific type (e.g., 'attack_vector', 'quest_structure')
   */
  getItemsByType(type: string): Promise<OverlayItem<T>[]>;

  /**
   * Filter items by metadata predicate
   * @param predicate - Function that tests metadata properties
   * @example overlay.filter(m => m.severity === 'critical')
   */
  filter(predicate: (metadata: T) => boolean): Promise<OverlayItem<T>[]>;

  /**
   * Query items by semantic similarity to a text query
   * @param query - Natural language query or pre-computed embedding
   * @param topK - Number of results to return
   * @param precomputedEmbedding - Optional pre-computed 768d embedding (avoids re-embedding)
   * @returns Items ranked by similarity to query
   */
  query(
    query: string,
    topK?: number,
    precomputedEmbedding?: number[]
  ): Promise<Array<{ item: OverlayItem<T>; similarity: number }>>;

  /**
   * Get the PGC root directory for this overlay
   */
  getPgcRoot(): string;

  // ========================================
  // SET OPERATIONS
  // ========================================

  /**
   * Select items matching a set of symbols/IDs
   * Returns only items whose symbols are in the provided set
   *
   * @example
   * // Get security guidelines for specific symbols
   * const authSymbols = new Set(['handleLogin', 'validateToken']);
   * const guidelines = await security.select({ symbols: authSymbols });
   */
  select(options: SelectOptions): Promise<OverlayItem<T>[]>;

  /**
   * Exclude items matching a set of symbols/IDs
   * Returns all items EXCEPT those whose symbols are in the provided set
   *
   * @example
   * // Get all security guidelines except for test-related ones
   * const testSymbols = new Set(['mockAuth', 'testHelper']);
   * const production = await security.exclude({ symbols: testSymbols });
   */
  exclude(options: SelectOptions): Promise<OverlayItem<T>[]>;

  /**
   * Get unique symbol identifiers referenced by items in this overlay
   * Used for set operations across overlays
   *
   * @returns Set of symbols that have coverage in this overlay
   * @example
   * const securitySymbols = await security.getSymbolSet();
   * const codeSymbols = await structural.getSymbolSet();
   * const uncovered = difference(codeSymbols, securitySymbols);
   */
  getSymbolSet(): Promise<Set<string>>;

  /**
   * Get unique item IDs in this overlay
   * Used for exact set operations (not semantic)
   *
   * @returns Set of all item IDs in this overlay
   */
  getIdSet(): Promise<Set<string>>;
}

/**
 * Predicate function for filtering overlay items
 */
export type OverlayPredicate<T extends OverlayMetadata = OverlayMetadata> = (
  metadata: T
) => boolean;

/**
 * Options for Meet operation
 */
export interface MeetOptions {
  /**
   * Similarity threshold [0, 1]
   * Only pairs above this threshold are returned
   * @default 0.7
   */
  threshold?: number;

  /**
   * Maximum number of results per item from overlay A
   * @default 5
   */
  topK?: number;

  /**
   * Distance metric for similarity calculation
   * @default 'cosine'
   */
  distanceType?: 'l2' | 'cosine' | 'dot';
}

/**
 * Options for Project operation
 */
export interface ProjectOptions extends MeetOptions {
  /**
   * Query string to guide the projection
   * @example "handle user input securely"
   */
  query: string;

  /**
   * Source overlay to project from
   */
  from: OverlayAlgebra;

  /**
   * Target overlay to project to
   */
  to: OverlayAlgebra;
}

/**
 * Options for set-based selection operations
 */
export interface SelectOptions {
  /**
   * Set of symbols/IDs to include or exclude
   * @example ['handleInput', 'processAuth', 'validateToken']
   */
  symbols?: Set<string>;

  /**
   * Set of item IDs to include or exclude
   */
  ids?: Set<string>;

  /**
   * Glob patterns for symbol matching
   * @example ['src/auth/*', 'lib/security/*']
   */
  patterns?: string[];
}

/**
 * Result of a set operation (union, intersection, difference)
 */
export interface SetOperationResult<
  T extends OverlayMetadata = OverlayMetadata,
> {
  /**
   * Resulting items from the set operation
   */
  items: OverlayItem<T>[];

  /**
   * Metadata about the operation
   */
  metadata: {
    operation: 'union' | 'intersection' | 'difference' | 'complement';
    sourceOverlays: string[]; // Overlay IDs involved
    itemCount: number;
  };
}
