import { VectorRecord } from '../lib/patterns/vector-db/lance-vector-store.js';

export interface PatternManager {
  findSimilarPatterns(
    symbol: string,
    topK: number
  ): Promise<
    Array<{
      symbol: string;
      similarity: number;
      architecturalRole: string;
      explanation: string;
    }>
  >;
  getVectorForSymbol(symbol: string): Promise<VectorRecord | undefined>;
}
