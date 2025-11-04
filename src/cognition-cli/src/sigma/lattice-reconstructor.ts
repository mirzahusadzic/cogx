/**
 * Lattice Reconstruction from LanceDB
 *
 * Rebuilds in-memory lattice (turnAnalyses) from LanceDB storage.
 * Used when resuming a session that hasn't triggered compression yet.
 */

import type {
  TurnAnalysis,
  ConversationLattice,
  ConversationNode,
} from './types.js';
import { ConversationLanceStore } from './conversation-lance-store.js';
import path from 'path';

/**
 * Rebuild turnAnalyses array from LanceDB for a given session
 */
export async function rebuildTurnAnalysesFromLanceDB(
  sessionId: string,
  projectRoot: string
): Promise<TurnAnalysis[]> {
  // Initialize LanceDB store
  const lanceStore = new ConversationLanceStore(
    path.join(projectRoot, '.sigma')
  );

  await lanceStore.initialize();

  // Get all turns for this session
  const turns = await lanceStore.getSessionTurns(sessionId, 'asc');

  if (turns.length === 0) {
    return [];
  }

  // Convert LanceDB records to TurnAnalysis format
  const analyses: TurnAnalysis[] = turns.map((turn) => ({
    turn_id: turn.id,
    role: turn.role as 'user' | 'assistant' | 'system',
    content: turn.content,
    timestamp: turn.timestamp,
    embedding: turn.embedding,
    novelty: turn.novelty,
    importance_score: turn.importance,
    is_paradigm_shift: turn.is_paradigm_shift,
    is_routine: turn.importance < 3,
    overlay_scores: {
      O1_structural: turn.alignment_O1,
      O2_security: turn.alignment_O2,
      O3_lineage: turn.alignment_O3,
      O4_mission: turn.alignment_O4,
      O5_operational: turn.alignment_O5,
      O6_mathematical: turn.alignment_O6,
      O7_strategic: turn.alignment_O7,
    },
    references: Array.isArray(turn.references) ? turn.references : [],
    semantic_tags: Array.isArray(turn.semantic_tags) ? turn.semantic_tags : [],
  }));

  return analyses;
}

/**
 * Rebuild full lattice structure from LanceDB
 * (nodes + temporal edges)
 */
export async function rebuildLatticeFromLanceDB(
  sessionId: string,
  projectRoot: string
): Promise<ConversationLattice> {
  // Get turn analyses
  const analyses = await rebuildTurnAnalysesFromLanceDB(sessionId, projectRoot);

  // Build nodes from analyses
  const nodes: ConversationNode[] = analyses.map((analysis) => ({
    id: analysis.turn_id,
    type: 'conversation_turn' as const,
    turn_id: analysis.turn_id,
    role: analysis.role,
    content: analysis.content,
    timestamp: analysis.timestamp,
    embedding: analysis.embedding,
    novelty: analysis.novelty,
    overlay_scores: analysis.overlay_scores,
    importance_score: analysis.importance_score,
    is_paradigm_shift: analysis.is_paradigm_shift,
    semantic_tags: analysis.semantic_tags,
  }));

  // Build temporal edges (turn N -> turn N+1)
  const edges = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      from: nodes[i].turn_id,
      to: nodes[i + 1].turn_id,
      type: 'temporal' as const,
      weight: 1.0,
    });
  }

  // Create lattice
  const lattice: ConversationLattice = {
    nodes,
    edges,
    metadata: {
      session_id: sessionId,
      created_at: Date.now(),
      original_turn_count: nodes.length,
      compressed_turn_count: nodes.length, // Not compressed yet
      compression_ratio: 1.0, // No compression
    },
  };

  return lattice;
}
