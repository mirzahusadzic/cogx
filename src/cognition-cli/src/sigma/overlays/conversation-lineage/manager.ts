/**
 * Conversation Lineage Overlay (O3)
 *
 * Tracks knowledge evolution in conversation ("earlier we discussed...").
 * Aligned with project O3 via Meet operation.
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

export class ConversationLineageManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-lineage', workbenchUrl, debug);
  }

  getOverlayId(): string {
    return 'O3';
  }

  getOverlayName(): string {
    return 'Conversation Lineage';
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }

  /**
   * Score turn relevance to O3 (Lineage/Evolution).
   * High scores for references to past discussions, evolution tracking.
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
   * Extract O3-specific semantic tags (lineage keywords).
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
