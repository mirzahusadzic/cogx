/**
 * Lattice Reconstruction from LanceDB
 *
 * Rebuilds in-memory lattice (turnAnalyses) from LanceDB storage.
 * Used when resuming a session that hasn't triggered compression yet.
 *
 * DESIGN:
 * Sigma stores all conversation turns in LanceDB for persistence and vector search.
 * When a session resumes before the compression threshold (50 turns), we need to
 * reconstruct the in-memory turn analyses array from the database. This enables
 * the analyzer to continue tracking novelty, importance, and alignment scores
 * without losing historical context.
 *
 * The reconstruction process:
 * 1. Query LanceDB for all turns in the session (ordered chronologically)
 * 2. Convert LanceDB schema to TurnAnalysis format
 * 3. Restore all metadata (overlay scores, semantic tags, references)
 * 4. Return array ready for continued analysis
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
 *
 * Converts persisted LanceDB conversation records back into the in-memory
 * TurnAnalysis format used by the analyzer. This allows session resumption
 * with full historical context before compression occurs.
 *
 * ALGORITHM:
 * 1. Initialize LanceDB store at `.sigma/` directory
 * 2. Query all turns for sessionId in ascending order (chronological)
 * 3. Map each LanceDB record to TurnAnalysis format:
 *    - Restore role, content, timestamp, embedding
 *    - Restore novelty, importance, paradigm shift flags
 *    - Reconstruct overlay_scores object from individual alignment fields
 *    - Parse JSON arrays for references and semantic_tags
 * 4. Return complete turnAnalyses array
 *
 * @param sessionId - Unique identifier for the conversation session
 * @param projectRoot - Absolute path to project root (contains .sigma/ directory)
 * @returns Array of TurnAnalysis objects in chronological order, empty array if no turns found
 *
 * @example
 * // Resume session after application restart
 * const analyses = await rebuildTurnAnalysesFromLanceDB(
 *   'session_2024-01-15_10-30-45',
 *   '/home/user/my-project'
 * );
 * console.log(`Restored ${analyses.length} turns from LanceDB`);
 * // Continue analysis with full historical context
 *
 * @example
 * // Check if session has any stored turns
 * const turns = await rebuildTurnAnalysesFromLanceDB(sessionId, cwd);
 * if (turns.length === 0) {
 *   console.log('New session - no previous turns');
 * } else {
 *   console.log(`Resuming session with ${turns.length} previous turns`);
 * }
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
 * Rebuild full lattice structure from LanceDB (nodes + temporal edges)
 *
 * Reconstructs the complete ConversationLattice graph structure from LanceDB
 * storage. This creates a time-ordered graph with conversation turns as nodes
 * and temporal relationships as edges.
 *
 * ALGORITHM:
 * 1. Rebuild turn analyses from LanceDB (via rebuildTurnAnalysesFromLanceDB)
 * 2. Convert each TurnAnalysis to ConversationNode:
 *    - Preserve all metadata (embedding, novelty, overlay scores)
 *    - Set node type to 'conversation_turn'
 *    - Include semantic tags and importance metrics
 * 3. Build temporal edges linking consecutive turns:
 *    - Edge from turn[i] -> turn[i+1]
 *    - Type: 'temporal', Weight: 1.0
 *    - Creates linear conversation flow graph
 * 4. Construct lattice with metadata:
 *    - Original turn count (before any compression)
 *    - Compression ratio (1.0 = uncompressed)
 *    - Session ID and creation timestamp
 *
 * DESIGN:
 * The lattice is a directed acyclic graph (DAG) representing conversation flow.
 * Temporal edges preserve chronological order. This structure enables:
 * - Graph-based querying (find paths, detect cycles)
 * - Compression algorithms (merge nodes based on similarity)
 * - Semantic search (traverse by overlay alignment)
 *
 * @param sessionId - Unique identifier for the conversation session
 * @param projectRoot - Absolute path to project root (contains .sigma/ directory)
 * @returns Complete ConversationLattice with nodes, edges, and metadata
 *
 * @example
 * // Rebuild lattice for visualization or compression
 * const lattice = await rebuildLatticeFromLanceDB(
 *   'session_2024-01-15_10-30-45',
 *   '/home/user/my-project'
 * );
 *
 * console.log(`Lattice has ${lattice.nodes.length} nodes`);
 * console.log(`Connected by ${lattice.edges.length} temporal edges`);
 * console.log(`Compression ratio: ${lattice.metadata.compression_ratio}`);
 *
 * // Find paradigm shifts in the lattice
 * const shifts = lattice.nodes.filter(n => n.is_paradigm_shift);
 * console.log(`Found ${shifts.length} paradigm shifts`);
 *
 * @example
 * // Use lattice for context reconstruction
 * const lattice = await rebuildLatticeFromLanceDB(sessionId, cwd);
 * const context = await reconstructSessionContext(lattice, cwd);
 * console.log(`Session mode: ${context.mode}`);
 * console.log(context.recap); // Compressed markdown summary
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
