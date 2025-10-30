/**
 * Overlay Algebra Foundation
 *
 * Universal interface for lattice operations across all overlays.
 * Enables boolean algebra: Meet (∧), Union (∪), Intersection (∩), Difference (\), Complement (¬)
 *
 * DESIGN PRINCIPLE:
 * Build powerful primitives first, then compose UX sugar on top.
 * Every overlay implements this interface → every overlay gains algebraic operations.
 *
 * OPERATIONS:
 * - Meet (∧): Semantic alignment via vector similarity
 * - Union (∪): All items from multiple overlays
 * - Intersection (∩): Items present in all overlays
 * - Difference (\): Items in A but not in B
 * - Complement (¬): Items NOT in set (relative to universal set)
 * - Select: Filter by symbol/id set
 * - Exclude: Remove items matching symbol/id set
 * - Project (→): Query-guided traversal between overlays
 */

import { VectorRecord } from '../overlays/vector-db/lance-store.js';

/**
 * Metadata associated with overlay items.
 * Each overlay extends this with domain-specific fields.
 */
export interface OverlayMetadata {
  [key: string]: unknown;
  text: string; // The semantic content (for embedding)
  type?: string; // Domain-specific type (e.g., 'attack_vector', 'quest_structure')
  weight?: number; // Importance/confidence score
}

/**
 * Universal overlay item with embedding and metadata
 */
export interface OverlayItem<T extends OverlayMetadata = OverlayMetadata> {
  id: string; // Unique identifier
  embedding: number[]; // 768-dimensional vector
  metadata: T; // Domain-specific metadata
}

/**
 * Result of a Meet operation between two overlay items
 */
export interface MeetResult<
  A extends OverlayMetadata,
  B extends OverlayMetadata,
> {
  itemA: OverlayItem<A>;
  itemB: OverlayItem<B>;
  similarity: number; // Cosine similarity [0, 1]
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
   * @param query - Natural language query
   * @param topK - Number of results to return
   * @returns Items ranked by similarity to query
   */
  query(
    query: string,
    topK?: number
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
