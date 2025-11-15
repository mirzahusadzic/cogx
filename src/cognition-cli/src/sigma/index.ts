/**
 * Context Sampling Sigma - Main Module
 *
 * Compression infrastructure for conversation context management using
 * lattice-based semantic compression. Achieves 30-50x compression while
 * preserving paradigm shifts and creative breakthroughs.
 *
 * Core Components:
 * - Analyzer: Detects novelty and project alignment via embeddings
 * - Compressor: Builds lattice representation with selective preservation
 * - Reconstructor: Rebuilds context from compressed lattice
 *
 * Key Innovations:
 * 1. Embedding-based novelty detection (automatic paradigm shift detection)
 * 2. Project alignment via Meet operation (Conversation ∧ Project)
 * 3. Lattice compression (30-50x reduction with semantic edges)
 * 4. Dual storage (LanceDB for embeddings, JSON for human-readable metadata)
 *
 * Architecture:
 * - 7 Project Overlays (O1-O7): Structural, Security, Lineage, Mission,
 *   Operational, Mathematical, Coherence
 * - LanceDB: Fast semantic search with vector embeddings
 * - Lattice: Directed graph with temporal + semantic edges
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
