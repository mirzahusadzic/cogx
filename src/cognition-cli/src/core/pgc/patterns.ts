/**
 * Pattern Management Interface for Grounded Context Pool (PGC)
 *
 * Defines the contract for implementations that manage structural patterns
 * and provide semantic similarity search capabilities. Used primarily by
 * overlay generators to find and analyze code patterns.
 *
 * DESIGN RATIONALE:
 * - Abstraction Layer: Decouples pattern consumers from storage implementation
 * - Vector-based Similarity: Enables semantic pattern matching beyond exact matches
 * - Architectural Awareness: Patterns carry role metadata (data, logic, orchestrator)
 * - Extensibility: Multiple implementations can coexist (LanceDB, in-memory, etc.)
 *
 * IMPLEMENTATIONS:
 * - StructuralPatternsOverlay: Production implementation using LanceDB
 * - MockPatternManager: Test double for unit tests
 *
 * @example
 * // Find patterns similar to a function
 * const patterns = await patternManager.findSimilarPatterns('processUser', 5);
 * for (const pattern of patterns) {
 *   console.log(`${pattern.symbol} (${pattern.similarity.toFixed(2)}): ${pattern.explanation}`);
 * }
 *
 * @example
 * // Get embedding for a specific symbol
 * const vector = await patternManager.getVectorForSymbol('UserController');
 * if (vector) {
 *   console.log(`Found embedding with ${vector.vector.length} dimensions`);
 * }
 */

import { VectorRecord } from '../overlays/vector-db/lance-store.js';

/**
 * Interface for pattern management implementations that support similarity search.
 *
 * Implementations must provide:
 * 1. Semantic search across code patterns
 * 2. Vector retrieval for individual symbols
 */
export interface PatternManager {
  /**
   * Find code patterns semantically similar to a given symbol
   *
   * ALGORITHM:
   * 1. Retrieve vector embedding for query symbol
   * 2. Perform K-nearest neighbors search in vector space
   * 3. Return top-K results with similarity scores
   *
   * @param symbol - Name of the code symbol to find patterns for
   * @param topK - Maximum number of similar patterns to return
   * @returns Array of similar patterns sorted by similarity (descending)
   *
   * @example
   * // Find functions similar to 'parseJSON'
   * const similar = await patternManager.findSimilarPatterns('parseJSON', 5);
   * similar.forEach(p => {
   *   console.log(`${p.symbol} (${p.architecturalRole}): ${p.similarity.toFixed(2)}`);
   * });
   *
   * @example
   * // Discover related patterns for refactoring
   * const patterns = await patternManager.findSimilarPatterns('AuthService', 10);
   * const services = patterns.filter(p => p.architecturalRole === 'orchestrator');
   * console.log(`Found ${services.length} similar service patterns`);
   */
  findSimilarPatterns(
    symbol: string,
    topK: number
  ): Promise<
    Array<{
      symbol: string;
      filePath: string;
      similarity: number;
      architecturalRole: string;
      explanation: string;
    }>
  >;

  /**
   * Retrieve vector embedding for a specific code symbol
   *
   * Used for:
   * - Custom similarity computations
   * - Embedding visualization
   * - Cross-overlay semantic alignment
   *
   * @param symbol - Name of the code symbol
   * @returns Vector record if found, undefined otherwise
   *
   * @example
   * // Check if symbol has been embedded
   * const vector = await patternManager.getVectorForSymbol('DatabaseConnection');
   * if (vector) {
   *   console.log(`Symbol embedded at ${vector.computed_at}`);
   *   console.log(`Role: ${vector.architectural_role}`);
   * }
   *
   * @example
   * // Compute custom similarity between two symbols
   * const v1 = await patternManager.getVectorForSymbol('UserService');
   * const v2 = await patternManager.getVectorForSymbol('OrderService');
   * if (v1 && v2) {
   *   const similarity = cosineSimilarity(v1.vector, v2.vector);
   *   console.log(`Services are ${(similarity * 100).toFixed(1)}% similar`);
   * }
   */
  getVectorForSymbol(symbol: string): Promise<VectorRecord | undefined>;
}
