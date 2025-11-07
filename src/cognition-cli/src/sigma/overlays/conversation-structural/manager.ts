/**
 * Conversation Structural Overlay (O1)
 *
 * Tracks architecture/design discussions in conversation.
 * Aligned with project O1 via Meet operation.
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

export class ConversationStructuralManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-structural', workbenchUrl, debug);
  }

  getOverlayId(): string {
    return 'O1';
  }

  getOverlayName(): string {
    return 'Conversation Structural';
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }

  /**
   * Score turn relevance to O1 (Structural/Architecture).
   * High scores for architecture, design, structure discussions.
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
    // O1 gets boosted score, others get base score
    return {
      alignment_O1: baseScore,
      alignment_O2: 0,
      alignment_O3: 0,
      alignment_O4: 0,
      alignment_O5: 0,
      alignment_O6: 0,
      alignment_O7: 0,
    };
  }

  /**
   * Extract O1-specific semantic tags (architecture/design keywords).
   */
  protected extractSemanticTags(content: string): string[] {
    const structuralKeywords = [
      'architecture',
      'design',
      'structure',
      'component',
      'module',
      'class',
      'interface',
      'pattern',
      'refactor',
      'organize',
      'hierarchy',
      'dependency',
      'layer',
      'separation',
      'coupling',
      'cohesion',
    ];

    const lowerContent = content.toLowerCase();
    const tags = structuralKeywords.filter((keyword) =>
      lowerContent.includes(keyword)
    );

    // Add generic tags from base class
    const baseTags = super.extractSemanticTags(content);
    return [...new Set([...tags, ...baseTags])].slice(0, 10);
  }
}
