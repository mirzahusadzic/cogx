/**
 * Conversation Coherence Overlay (O7)
 *
 * Tracks conversation flow, topic transitions, and cross-overlay synthesis.
 * This is the meta-overlay that maintains conversational coherence across
 * all other overlays (O1-O6).
 *
 * Purpose:
 * - Monitor topic drift and conversation flow
 * - Track summaries and meta-discussions
 * - Detect conversation pivots and transitions
 * - Synthesize insights across all overlays
 *
 * Alignment indicators:
 * - Topic change keywords: "transition", "shift", "change focus"
 * - Summary keywords: "summary", "conclude", "overview", "recap"
 * - Meta keywords: "coherence", "consistency", "alignment"
 * - Synthesis keywords: "integrate", "unify", "overall"
 *
 * Use cases:
 * - Context reconstruction: prioritize turns that maintain flow
 * - Compression: preserve topic transitions and summaries
 * - Query: find conversation pivots and synthesis points
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

/**
 * Manager for Conversation Coherence overlay (O7)
 *
 * Stores turns related to conversation flow, topic transitions, and
 * meta-discussion about the conversation itself.
 */
export class ConversationCoherenceManager extends BaseConversationManager<ConversationTurnMetadata> {
  /**
   * Create a new ConversationCoherenceManager
   *
   * @param sigmaRoot - Path to .sigma directory
   * @param workbenchUrl - Optional workbench URL for embeddings
   * @param debug - Enable debug logging
   */
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-coherence', workbenchUrl, debug);
  }

  /**
   * Get overlay ID (O7)
   *
   * @returns Overlay identifier "O7"
   */
  getOverlayId(): string {
    return 'O7';
  }

  /**
   * Get human-readable overlay name
   *
   * @returns "Conversation Coherence"
   */
  getOverlayName(): string {
    return 'Conversation Coherence';
  }

  /**
   * Get supported turn types
   *
   * @returns Array of supported role types
   */
  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }

  /**
   * Extract alignment scores for O7 (Coherence/Flow)
   *
   * Boosts O7 score for turns related to conversation flow and coherence.
   * Sets other overlays to 0 to indicate this turn is O7-specific.
   *
   * High scores for:
   * - Topic changes and transitions
   * - Summaries and overviews
   * - Meta-discussion about conversation
   *
   * @param baseScore - Base alignment score from turn analysis
   * @returns Alignment scores with O7 boosted, others zeroed
   * @protected
   */
  protected extractAlignmentScores(baseScore: number): {
    alignment_O1: number;
    alignment_O2: number;
    alignment_O3: number;
    alignment_O4: number;
    alignment_O5: number;
    alignment_O6: number;
    alignment_O7: number;
  } {
    return {
      alignment_O1: 0,
      alignment_O2: 0,
      alignment_O3: 0,
      alignment_O4: 0,
      alignment_O5: 0,
      alignment_O6: 0,
      alignment_O7: baseScore,
    };
  }

  /**
   * Extract O7-specific semantic tags (coherence/flow keywords)
   *
   * Identifies keywords related to conversation flow, topic transitions,
   * and meta-discussion. Combines domain keywords with base extraction.
   *
   * Domain keywords:
   * - Topic control: "transition", "shift", "change", "focus"
   * - Summaries: "summary", "conclude", "overview", "recap"
   * - Meta: "coherence", "consistency", "alignment"
   * - Synthesis: "integrate", "unify", "overall"
   *
   * @param content - Turn content to extract tags from
   * @returns Array of unique semantic tags (max 10)
   * @protected
   */
  protected extractSemanticTags(content: string): string[] {
    const coherenceKeywords = [
      'summary',
      'conclude',
      'overview',
      'transition',
      'topic',
      'shift',
      'change',
      'focus',
      'coherence',
      'consistency',
      'alignment',
      'synthesis',
      'integrate',
      'unify',
      'overall',
      'recap',
    ];

    const lowerContent = content.toLowerCase();
    const tags = coherenceKeywords.filter((keyword) =>
      lowerContent.includes(keyword)
    );

    const baseTags = super.extractSemanticTags(content);
    return [...new Set([...tags, ...baseTags])].slice(0, 10);
  }
}
