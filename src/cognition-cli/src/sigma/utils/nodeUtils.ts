import type { ConversationNode, OverlayScores } from '../types.js';

export interface MessageLike {
  type: 'user' | 'assistant' | 'system' | 'tool_progress' | 'thinking';
  content: string;
}

/**
 * Creates a pending conversation node from a message.
 * used to preserve the most recent turn during context compression.
 *
 * @param message The message to convert (generic to support TUIMessage or other message types)
 * @param timestamp The timestamp for the node
 * @returns A generic ConversationNode with default scores
 */
export function createPendingTurnNode(
  message: MessageLike,
  timestamp: number
): ConversationNode {
  const role: 'user' | 'assistant' | 'system' =
    message.type === 'user'
      ? 'user'
      : message.type === 'system'
        ? 'system'
        : 'assistant';

  const defaultScores: OverlayScores = {
    O1_structural: 0,
    O2_security: 0,
    O3_lineage: 0,
    O4_mission: 0,
    O5_operational: 0,
    O6_mathematical: 0,
    O7_strategic: 0,
  };

  return {
    id: `pending_${timestamp}`,
    type: 'conversation_turn',
    turn_id: `pending_${timestamp}`,
    role,
    content: message.content,
    timestamp: timestamp,
    embedding: [],
    novelty: 0.5, // Default novelty for pending turns
    overlay_scores: defaultScores,
    importance_score: 5, // Default importance
    is_paradigm_shift: false,
    semantic_tags: [],
  };
}
