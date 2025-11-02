/**
 * Context Sampling Sigma
 *
 * Compression infrastructure for conversation context management.
 * Achieves 30-50x compression while preserving creative breakthroughs.
 *
 * Part of cognition-cli (AGPLv3)
 *
 * @module sigma
 */

// Types
export type {
  OverlayScores,
  ConversationTurn,
  ConversationContext,
  TurnAnalysis,
  CompressionResult,
  ReconstructedContext,
  ConversationNode,
  ConversationEdge,
  ConversationLattice,
  AnalyzerOptions,
  CompressorOptions,
  ReconstructorOptions,
} from './types.js';

// Analyzer
export { analyzeTurn, analyzeTurns } from './analyzer.js';

// Compressor
export {
  compressContext,
  addSemanticEdges,
  getLatticeStats,
} from './compressor.js';

// Reconstructor
export { reconstructContext, getReconstructionStats } from './reconstructor.js';
