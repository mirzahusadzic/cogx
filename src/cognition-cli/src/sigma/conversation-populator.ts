/**
 * Conversation Overlay Populator
 *
 * Populates conversation overlays based on turn analysis and project alignment.
 * This is the bridge between turn analysis and conversation lattice storage.
 *
 * DESIGN:
 * Sigma maintains dual overlay systems:
 * 1. **Project Overlays** (O1-O7): Structural knowledge from codebase analysis
 *    Stored in .open_cognition/ (Grounded Context Pool)
 * 2. **Conversation Overlays** (O1-O7): Conversation turns aligned to each dimension
 *    Stored in .sigma/ (conversation lattice)
 *
 * This module bridges the two systems by:
 * - Taking analyzed conversation turns (with overlay alignment scores)
 * - Populating each conversation overlay with the turn
 * - Preserving alignment scores for each overlay dimension
 * - Enabling overlay-based conversation querying
 *
 * STRATEGY:
 * Every turn is added to ALL 7 conversation overlays, but each overlay stores
 * the turn's specific alignment score for that dimension. This creates a
 * multi-dimensional view where the same conversation can be queried from
 * different perspectives (structural, security, operational, etc.).
 */

import type { TurnAnalysis } from './types.js';
import type { ConversationOverlayRegistry } from './conversation-registry.js';
import type { OverlayAlgebra } from '../core/algebra/overlay-algebra.js';

/**
 * Extended interface for conversation overlay managers
 */
interface ConversationOverlayManager extends OverlayAlgebra {
  addTurn(turn: {
    turn_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    embedding: number[];
    novelty: number;
    importance: number;
    project_alignment_score: number;
  }): void;
  getInMemoryCount(): number;
}

/**
 * Populate conversation overlays based on turn analysis
 *
 * Adds a conversation turn to all 7 conversation overlays, preserving the
 * overlay-specific alignment scores computed during turn analysis. This
 * creates a multi-dimensional lattice where each turn can be queried from
 * different overlay perspectives.
 *
 * ALGORITHM:
 * 1. Extract turn metadata (ID, role, content, timestamp, embedding, scores)
 * 2. For each overlay (O1-O7):
 *    a. Get overlay instance from conversation registry
 *    b. Extract project_alignment_score for this specific overlay
 *    c. Call overlay.addTurn() with turn + alignment score
 * 3. All overlays now contain the turn with their specific alignment metadata
 *
 * DESIGN:
 * Unlike project overlays (which store different structural elements per overlay),
 * conversation overlays store the SAME turns but with DIFFERENT alignment scores.
 * This enables powerful queries like:
 * - "Show me high-structural conversations" (filter by O1 alignment)
 * - "Find security-focused discussions" (filter by O2 alignment)
 * - "Get operational action items" (filter by O5 alignment)
 *
 * The alignment scores (0-10) indicate how relevant the turn is to each dimension.
 * A turn about "implementing JWT authentication" might score:
 * - O1 (Structural): 8/10 (architecture decision)
 * - O2 (Security): 9/10 (security mechanism)
 * - O5 (Operational): 7/10 (implementation work)
 *
 * @param turnAnalysis - Analyzed conversation turn with overlay alignment scores
 * @param conversationRegistry - Registry of conversation overlays (O1-O7)
 * @returns Promise that resolves when turn is added to all overlays
 *
 * @example
 * // Populate overlays after analyzing a turn
 * const analysis = await analyzer.analyzeTurn(
 *   'user',
 *   'Implement user authentication with JWT tokens',
 *   timestamp
 * );
 *
 * await populateConversationOverlays(analysis, conversationRegistry);
 *
 * // Now the turn is queryable from any overlay perspective
 * const securityView = await conversationRegistry.get('O2');
 * const securityTurns = await securityView.query('authentication');
 *
 * @example
 * // Process entire conversation history
 * for (const turn of conversationHistory) {
 *   const analysis = await analyzer.analyzeTurn(
 *     turn.role,
 *     turn.content,
 *     turn.timestamp
 *   );
 *   await populateConversationOverlays(analysis, conversationRegistry);
 * }
 *
 * // Get statistics to see overlay distribution
 * const stats = await getConversationStats(conversationRegistry);
 * console.log(`Populated ${stats.total_turns} turns across 7 overlays`);
 */
export async function populateConversationOverlays(
  turnAnalysis: TurnAnalysis,
  conversationRegistry: ConversationOverlayRegistry
): Promise<void> {
  const turn = {
    turn_id: turnAnalysis.turn_id,
    role: turnAnalysis.role,
    content: turnAnalysis.content,
    timestamp: turnAnalysis.timestamp,
    embedding: turnAnalysis.embedding,
    novelty: turnAnalysis.novelty,
    importance: turnAnalysis.importance_score,
  };

  // Populate each overlay with the turn and its project alignment score
  const overlayIds = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'] as const;

  for (const overlayId of overlayIds) {
    const overlay = await conversationRegistry.get(overlayId);

    // Get alignment score for this specific overlay
    const scoreKey = Object.keys(turnAnalysis.overlay_scores).find((key) =>
      key.startsWith(overlayId)
    ) as keyof typeof turnAnalysis.overlay_scores;

    const projectAlignmentScore = scoreKey
      ? turnAnalysis.overlay_scores[scoreKey]
      : 0;

    // Add turn to this overlay
    if (
      'addTurn' in overlay &&
      typeof (overlay as ConversationOverlayManager).addTurn === 'function'
    ) {
      (overlay as ConversationOverlayManager).addTurn({
        ...turn,
        project_alignment_score: projectAlignmentScore,
      });
    }
  }
}

/**
 * Get conversation overlay statistics
 *
 * Retrieves in-memory turn counts from all conversation overlays. Since all
 * overlays contain the same turns (just with different alignment scores),
 * this provides validation that the overlays are synchronized and shows the
 * total conversation volume.
 *
 * ALGORITHM:
 * 1. For each overlay (O1-O7):
 *    a. Get overlay instance from registry
 *    b. Call getInMemoryCount() to get turn count
 *    c. Track maximum count across all overlays
 * 2. Return total_turns (max count) and per-overlay counts
 *
 * DESIGN:
 * All conversation overlays should have the same count (since every turn goes
 * to every overlay). If counts differ, it indicates a synchronization issue.
 * The total_turns reflects the conversation volume before compression.
 *
 * Use this to:
 * - Monitor conversation growth
 * - Validate overlay synchronization (counts should match)
 * - Determine when compression threshold is reached (typically 50 turns)
 * - Debug overlay population issues
 *
 * @param conversationRegistry - Registry of conversation overlays (O1-O7)
 * @returns Statistics with total turn count and per-overlay counts
 *
 * @example
 * // Check conversation volume
 * const stats = await getConversationStats(conversationRegistry);
 * console.log(`Total turns: ${stats.total_turns}`);
 * console.log('Per-overlay counts:', stats.overlay_counts);
 *
 * // Validate synchronization
 * const counts = Object.values(stats.overlay_counts);
 * const allSame = counts.every(c => c === stats.total_turns);
 * if (!allSame) {
 *   console.warn('WARNING: Overlay counts are not synchronized!');
 *   console.warn(stats.overlay_counts);
 * }
 *
 * @example
 * // Monitor compression threshold
 * const COMPRESSION_THRESHOLD = 50;
 * const stats = await getConversationStats(conversationRegistry);
 *
 * if (stats.total_turns >= COMPRESSION_THRESHOLD) {
 *   console.log('Compression threshold reached - triggering compression');
 *   await compressor.compress(lattice);
 * } else {
 *   console.log(`${COMPRESSION_THRESHOLD - stats.total_turns} turns until compression`);
 * }
 *
 * @example
 * // Debug overlay population
 * const statsBefore = await getConversationStats(conversationRegistry);
 * await populateConversationOverlays(turnAnalysis, conversationRegistry);
 * const statsAfter = await getConversationStats(conversationRegistry);
 *
 * console.log(`Added 1 turn to all overlays`);
 * console.log(`Before: ${statsBefore.total_turns}, After: ${statsAfter.total_turns}`);
 */
export async function getConversationStats(
  conversationRegistry: ConversationOverlayRegistry
): Promise<{
  total_turns: number;
  overlay_counts: Record<string, number>;
}> {
  const overlayIds = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'] as const;
  const overlayCounts: Record<string, number> = {};

  let maxCount = 0;

  for (const overlayId of overlayIds) {
    const overlay = await conversationRegistry.get(overlayId);

    if (
      'getInMemoryCount' in overlay &&
      typeof (overlay as ConversationOverlayManager).getInMemoryCount ===
        'function'
    ) {
      const count = (overlay as ConversationOverlayManager).getInMemoryCount();
      overlayCounts[overlayId] = count;
      maxCount = Math.max(maxCount, count);
    }
  }

  return {
    total_turns: maxCount, // All overlays should have same count
    overlay_counts: overlayCounts,
  };
}
