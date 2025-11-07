/**
 * Conversation Coherence Overlay (O7)
 *
 * Tracks conversation flow and topic drift.
 * Cross-overlay synthesis for conversation.
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

export class ConversationCoherenceManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-coherence', workbenchUrl, debug);
  }

  getOverlayId(): string {
    return 'O7';
  }

  getOverlayName(): string {
    return 'Conversation Coherence';
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }

  /**
   * Score turn relevance to O7 (Coherence/Flow).
   * High scores for topic changes, summaries, meta-discussion.
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
   * Extract O7-specific semantic tags (coherence keywords).
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
