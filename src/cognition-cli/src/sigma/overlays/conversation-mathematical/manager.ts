/**
 * Conversation Mathematical Overlay (O6)
 *
 * Tracks algorithms/logic discussions in conversation.
 * Aligned with project O6 via Meet operation.
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

export class ConversationMathematicalManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-mathematical', workbenchUrl, debug);
  }

  getOverlayId(): string {
    return 'O6';
  }

  getOverlayName(): string {
    return 'Conversation Mathematical';
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }

  /**
   * Score turn relevance to O6 (Mathematical/Algorithmic).
   * High scores for algorithms, logic, mathematical discussions.
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
      alignment_O6: baseScore,
      alignment_O7: 0,
    };
  }

  /**
   * Extract O6-specific semantic tags (mathematical keywords).
   */
  protected extractSemanticTags(content: string): string[] {
    const mathematicalKeywords = [
      'algorithm',
      'complexity',
      'optimization',
      'calculate',
      'formula',
      'theorem',
      'proof',
      'logic',
      'mathematical',
      'computation',
      'efficiency',
      'performance',
      'analysis',
      'big-o',
      'recursive',
      'iterate',
    ];

    const lowerContent = content.toLowerCase();
    const tags = mathematicalKeywords.filter((keyword) =>
      lowerContent.includes(keyword)
    );

    const baseTags = super.extractSemanticTags(content);
    return [...new Set([...tags, ...baseTags])].slice(0, 10);
  }
}
