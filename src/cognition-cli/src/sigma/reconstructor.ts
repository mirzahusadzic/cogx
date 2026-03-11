/**
 * Context Sampling Sigma - Reconstructor Module
 *
 * Rebuilds context from compressed lattice for Claude queries.
 * Query-driven graph traversal with overlay-based relevance.
 *
 * @deprecated Use latticeQueryService from src/core/services/lattice/LatticeQueryService.js
 */

import { latticeQueryService } from '../core/services/lattice/LatticeQueryService.js';
import type {
  ConversationLattice,
  ReconstructedContext,
  ReconstructorOptions,
} from './types.js';

/**
 * Reconstruct context from lattice for a query
 *
 * @deprecated Use latticeQueryService.reconstructContext()
 */
export async function reconstructContext(
  query: string,
  lattice: ConversationLattice,
  options: ReconstructorOptions = {}
): Promise<ReconstructedContext> {
  return latticeQueryService.reconstructContext(query, lattice, options);
}

/**
 * Get reconstruction statistics (for debugging)
 *
 * @deprecated Use latticeQueryService.getReconstructionStats()
 */
export function getReconstructionStats(context: ReconstructedContext): {
  turn_count: number;
  token_count: number;
  relevance_score: number;
  active_overlays: string[];
  token_efficiency: number;
} {
  return latticeQueryService.getReconstructionStats(context);
}
