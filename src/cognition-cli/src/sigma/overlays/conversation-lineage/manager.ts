/**
 * Conversation Lineage Overlay (O3)
 *
 * Tracks knowledge evolution and historical references in conversation.
 * Captures turns that reference past discussions and document the progression
 * of ideas over time.
 *
 * Purpose:
 * - Track references to earlier discussions
 * - Monitor knowledge evolution and progression
 * - Document decision history and rationale changes
 * - Maintain temporal context and dependencies
 *
 * Alignment indicators:
 * - Temporal references: "earlier", "previously", "before", "mentioned"
 * - Evolution tracking: "history", "evolution", "lineage", "progression"
 * - Context references: "remember", "discussed", "context"
 * - Origin tracking: "derivation", "origin", "trace", "ancestor"
 *
 * Use cases:
 * - Context reconstruction: maintain historical context
 * - Compression: preserve key evolution points
 * - Query: find decision history and rationale
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

/**
 * Manager for Conversation Lineage overlay (O3)
 *
 * Stores turns related to knowledge evolution, historical references,
 * and temporal dependencies in conversation.
 */
export class ConversationLineageManager extends BaseConversationManager<ConversationTurnMetadata> {
  /**
   * Create a new ConversationLineageManager
   *
   * @param sigmaRoot - Path to .sigma directory
   * @param workbenchUrl - Optional workbench URL for embeddings
   * @param debug - Enable debug logging
   */
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-lineage', workbenchUrl, debug);
  }

  /**
   * Get overlay ID (O3)
   *
   * @returns Overlay identifier "O3"
   */
  getOverlayId(): string {
    return 'O3';
  }

  /**
   * Get human-readable overlay name
   *
   * @returns "Conversation Lineage"
   */
  getOverlayName(): string {
    return 'Conversation Lineage';
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
   * Extract alignment scores for O3 (Lineage/Evolution)
   *
   * Boosts O3 score for turns with historical references and evolution tracking.
   * Sets other overlays to 0 to indicate this turn is O3-specific.
   *
   * High scores for:
   * - References to past discussions
   * - Knowledge evolution tracking
   * - Decision history documentation
   *
   * @param baseScore - Base alignment score from turn analysis
   * @returns Alignment scores with O3 boosted, others zeroed
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
      alignment_O3: baseScore,
      alignment_O4: 0,
      alignment_O5: 0,
      alignment_O6: 0,
      alignment_O7: 0,
    };
  }

  /**
   * Extract O3-specific semantic tags (lineage/evolution keywords)
   *
   * Identifies keywords related to historical references, knowledge evolution,
   * and temporal dependencies. Combines domain keywords with base extraction.
   *
   * Domain keywords:
   * - Temporal: "earlier", "previously", "before"
   * - Evolution: "history", "evolution", "lineage", "progression"
   * - References: "remember", "discussed", "mentioned", "context"
   * - Origins: "derivation", "origin", "trace", "ancestor"
   *
   * @param content - Turn content to extract tags from
   * @returns Array of unique semantic tags (max 10)
   * @protected
   */
  protected extractSemanticTags(content: string): string[] {
    const lineageKeywords = [
      'earlier',
      'previously',
      'history',
      'evolution',
      'lineage',
      'derivation',
      'origin',
      'trace',
      'ancestor',
      'progression',
      'timeline',
      'before',
      'remember',
      'discussed',
      'mentioned',
      'context',
    ];

    const lowerContent = content.toLowerCase();
    const tags = lineageKeywords.filter((keyword) =>
      lowerContent.includes(keyword)
    );

    const baseTags = super.extractSemanticTags(content);
    return [...new Set([...tags, ...baseTags])].slice(0, 10);
  }
}
