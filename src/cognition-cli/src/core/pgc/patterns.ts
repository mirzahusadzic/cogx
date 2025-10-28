import { VectorRecord } from '../overlays/vector-db/lance-store.js';

/**
 * Interface for pattern management implementations that support similarity search.
 */
export interface PatternManager {
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
  getVectorForSymbol(symbol: string): Promise<VectorRecord | undefined>;
}
