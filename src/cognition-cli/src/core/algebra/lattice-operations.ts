/**
 * Core Lattice Operations
 *
 * Implements boolean algebra operations across overlays:
 * - Meet (∧): Semantic alignment via vector similarity
 * - Union (∪): Combine items from multiple overlays
 * - Intersection (∩): Items present in all overlays
 * - Difference (\): Items in A but not in B
 * - Complement (¬): Items NOT in set (relative to universal set)
 * - Project (→): Query-guided traversal between overlays
 *
 * DESIGN:
 * These are pure functions that operate on OverlayAlgebra instances.
 * They compose to form complex queries:
 *
 * @example
 * // Which symbols lack security coverage?
 * const uncovered = difference(
 *   await structural.getSymbolSet(),
 *   await security.getSymbolSet()
 * );
 *
 * @example
 * // Security guidelines that align with mission principles
 * const aligned = await meet(
 *   await security.filter(m => m.type === 'constraint'),
 *   await mission.filter(m => m.type === 'principle'),
 *   { threshold: 0.8 }
 * );
 */

import {
  OverlayAlgebra,
  OverlayItem,
  OverlayMetadata,
  MeetResult,
  MeetOptions,
  SetOperationResult,
} from './overlay-algebra.js';
import { LanceVectorStore } from '../overlays/vector-db/lance-store.js';

// ========================================
// SEMANTIC OPERATIONS (Vector-based)
// ========================================

/**
 * Meet (∧): Find semantic alignment between two overlays
 *
 * Returns pairs of items (A, B) where:
 * - A is from overlayA
 * - B is from overlayB
 * - cosine_similarity(A.embedding, B.embedding) >= threshold
 *
 * This is the core operation for strategic coherence.
 *
 * @example
 * // Which attack vectors violate mission principles?
 * const violations = await meet(
 *   security.filter(m => m.type === 'attack_vector'),
 *   mission.filter(m => m.type === 'principle'),
 *   { threshold: 0.7 }
 * );
 */
export async function meet<
  A extends OverlayMetadata,
  B extends OverlayMetadata,
>(
  itemsA: OverlayItem<A>[],
  itemsB: OverlayItem<B>[],
  options: MeetOptions = {}
): Promise<MeetResult<A, B>[]> {
  const { threshold = 0.7, topK = 5, distanceType = 'cosine' } = options;

  // Create temporary vector store for itemsB (for efficient similarity search)
  const tempStore = new LanceVectorStore(':memory:');
  await tempStore.initialize('temp_meet_store');

  // Store itemsB in vector store
  for (const itemB of itemsB) {
    await tempStore.storeVector(itemB.id, itemB.embedding, {
      symbol: itemB.id,
      architectural_role: 'temp',
      computed_at: new Date().toISOString(),
      lineage_hash: 'temp',
      metadata: JSON.stringify(itemB.metadata),
    });
  }

  // For each item in A, find top-K similar items in B
  const results: MeetResult<A, B>[] = [];

  for (const itemA of itemsA) {
    const similarItems = await tempStore.similaritySearch(
      itemA.embedding,
      topK,
      undefined,
      distanceType
    );

    // Filter by threshold and map to MeetResult
    for (const similar of similarItems) {
      if (similar.similarity >= threshold) {
        // Find the original itemB
        const itemB = itemsB.find((b) => b.id === similar.id);
        if (itemB) {
          results.push({
            itemA,
            itemB,
            similarity: similar.similarity,
          });
        }
      }
    }
  }

  await tempStore.close();

  // Sort by similarity descending
  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Project (→): Query-guided traversal from one overlay to another
 *
 * Given a natural language query, find relevant items in source overlay,
 * then find semantically related items in target overlay.
 *
 * This enables queries like:
 * "Given the workflow pattern for 'handling user input', what security guidelines apply?"
 *
 * @example
 * const guidance = await project(
 *   "handle user authentication",
 *   operational, // O5
 *   security,    // O2
 *   { threshold: 0.7 }
 * );
 */
export async function project<
  A extends OverlayMetadata,
  B extends OverlayMetadata,
>(
  query: string,
  from: OverlayAlgebra<A>,
  to: OverlayAlgebra<B>,
  options: MeetOptions = {}
): Promise<MeetResult<A, B>[]> {
  // 1. Find items in source overlay matching the query
  const sourceResults = await from.query(query, options.topK || 5);
  const sourceItems = sourceResults.map((r) => r.item);

  // 2. Find items in target overlay aligned with source items
  const targetItems = await to.getAllItems();

  return meet(sourceItems, targetItems, options);
}

// ========================================
// SET OPERATIONS (Exact matching)
// ========================================

/**
 * Union (∪): Combine items from multiple overlays
 *
 * Returns all unique items from all overlays.
 * Deduplicates by item ID.
 *
 * @example
 * const allGuidelines = union([
 *   await security.getAllItems(),
 *   await operational.getAllItems(),
 * ]);
 */
export function union<T extends OverlayMetadata>(
  itemSets: OverlayItem<T>[][],
  sourceOverlays: string[]
): SetOperationResult<T> {
  const seen = new Set<string>();
  const uniqueItems: OverlayItem<T>[] = [];

  for (const items of itemSets) {
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        uniqueItems.push(item);
      }
    }
  }

  return {
    items: uniqueItems,
    metadata: {
      operation: 'union',
      sourceOverlays,
      itemCount: uniqueItems.length,
    },
  };
}

/**
 * Intersection (∩): Items present in ALL overlays
 *
 * Returns items that appear in every overlay (matched by ID).
 * Useful for finding common concepts across domains.
 *
 * @example
 * // Which items are BOTH security constraints AND mission principles?
 * const shared = intersection([
 *   await security.filter(m => m.type === 'constraint'),
 *   await mission.filter(m => m.type === 'principle'),
 * ]);
 */
export function intersection<T extends OverlayMetadata>(
  itemSets: OverlayItem<T>[][],
  sourceOverlays: string[]
): SetOperationResult<T> {
  if (itemSets.length === 0) {
    return {
      items: [],
      metadata: {
        operation: 'intersection',
        sourceOverlays,
        itemCount: 0,
      },
    };
  }

  // Build ID sets for each overlay
  const idSets = itemSets.map((items) => new Set(items.map((i) => i.id)));

  // Find IDs present in ALL sets
  const firstSet = idSets[0];
  const commonIds = new Set<string>();

  for (const id of firstSet) {
    if (idSets.every((set) => set.has(id))) {
      commonIds.add(id);
    }
  }

  // Get items for common IDs (from first set)
  const items = itemSets[0].filter((item) => commonIds.has(item.id));

  return {
    items,
    metadata: {
      operation: 'intersection',
      sourceOverlays,
      itemCount: items.length,
    },
  };
}

/**
 * Difference (\): Items in A but NOT in B
 *
 * Returns items from A whose IDs are not present in B.
 * Useful for finding coverage gaps.
 *
 * @example
 * // Which code symbols lack security coverage?
 * const uncovered = difference(
 *   await structural.getAllItems(),
 *   await security.getAllItems()
 * );
 */
export function difference<T extends OverlayMetadata>(
  itemsA: OverlayItem<T>[],
  itemsB: OverlayItem<T>[],
  sourceOverlays: [string, string]
): SetOperationResult<T> {
  const idsB = new Set(itemsB.map((i) => i.id));
  const items = itemsA.filter((item) => !idsB.has(item.id));

  return {
    items,
    metadata: {
      operation: 'difference',
      sourceOverlays,
      itemCount: items.length,
    },
  };
}

/**
 * Complement (¬): Items NOT in set (relative to universal set)
 *
 * Returns items from universal set that are not in the given set.
 *
 * @example
 * // All code symbols that have NO security guidelines
 * const unguarded = complement(
 *   await structural.getAllItems(), // universal set (all code)
 *   await security.getAllItems()    // exclusion set (covered by security)
 * );
 */
export function complement<T extends OverlayMetadata>(
  universalSet: OverlayItem<T>[],
  exclusionSet: OverlayItem<T>[],
  sourceOverlays: [string, string]
): SetOperationResult<T> {
  return difference(universalSet, exclusionSet, sourceOverlays);
}

// ========================================
// SYMBOL-BASED SET OPERATIONS
// ========================================

/**
 * Symbol difference: Symbols in A but not in B
 *
 * Works directly with symbol sets (not items).
 * Used for coverage analysis.
 *
 * @example
 * const codeSymbols = await structural.getSymbolSet();
 * const secureSymbols = await security.getSymbolSet();
 * const gaps = symbolDifference(codeSymbols, secureSymbols);
 * console.log(`${gaps.size} symbols lack security coverage`);
 */
export function symbolDifference(
  symbolsA: Set<string>,
  symbolsB: Set<string>
): Set<string> {
  const result = new Set<string>();
  for (const symbol of symbolsA) {
    if (!symbolsB.has(symbol)) {
      result.add(symbol);
    }
  }
  return result;
}

/**
 * Symbol intersection: Symbols present in both A and B
 */
export function symbolIntersection(
  symbolsA: Set<string>,
  symbolsB: Set<string>
): Set<string> {
  const result = new Set<string>();
  for (const symbol of symbolsA) {
    if (symbolsB.has(symbol)) {
      result.add(symbol);
    }
  }
  return result;
}

/**
 * Symbol union: All symbols from A and B
 */
export function symbolUnion(
  symbolsA: Set<string>,
  symbolsB: Set<string>
): Set<string> {
  return new Set([...symbolsA, ...symbolsB]);
}
