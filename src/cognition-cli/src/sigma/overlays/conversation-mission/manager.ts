/**
 * Conversation Mission Overlay (O4)
 *
 * Tracks goals/objectives discussed in conversation.
 * Aligned with project O4 via Meet operation.
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

export class ConversationMissionManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-mission', workbenchUrl, debug);
  }

  getOverlayId(): string {
    return 'O4';
  }

  getOverlayName(): string {
    return 'Conversation Mission';
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }

  /**
   * Score turn relevance to O4 (Mission/Goals).
   * High scores for goal, objective, vision discussions.
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
      alignment_O4: baseScore,
      alignment_O5: 0,
      alignment_O6: 0,
      alignment_O7: 0,
    };
  }

  /**
   * Extract O4-specific semantic tags (mission/goal keywords).
   */
  protected extractSemanticTags(content: string): string[] {
    const missionKeywords = [
      'goal',
      'objective',
      'mission',
      'vision',
      'purpose',
      'target',
      'achieve',
      'strategy',
      'roadmap',
      'milestone',
      'priority',
      'requirement',
      'feature',
      'outcome',
      'deliverable',
      'success',
    ];

    const lowerContent = content.toLowerCase();
    const tags = missionKeywords.filter((keyword) =>
      lowerContent.includes(keyword)
    );

    const baseTags = super.extractSemanticTags(content);
    return [...new Set([...tags, ...baseTags])].slice(0, 10);
  }
}
