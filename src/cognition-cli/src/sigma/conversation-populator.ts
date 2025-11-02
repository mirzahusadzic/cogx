/**
 * Conversation Overlay Populator
 *
 * Populates conversation overlays based on turn analysis and project alignment.
 * This is the bridge between turn analysis and conversation lattice storage.
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
 * Strategy:
 * - Add turn to ALL overlays (for complete lattice)
 * - Project alignment scores determine importance per overlay
 * - Each overlay stores the same turn with its specific alignment score
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
