/**
 * Conversation Operational Overlay (O5)
 *
 * Tracks commands/actions executed in conversation.
 * Aligned with project O5 via Meet operation.
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

export class ConversationOperationalManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-operational', workbenchUrl, debug);
  }

  getOverlayId(): string {
    return 'O5';
  }

  getOverlayName(): string {
    return 'Conversation Operational';
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }

  /**
   * Score turn relevance to O5 (Operational/Actions).
   * High scores for commands, actions, execution discussions.
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
      alignment_O5: baseScore,
      alignment_O6: 0,
      alignment_O7: 0,
    };
  }

  /**
   * Extract O5-specific semantic tags (operational keywords).
   */
  protected extractSemanticTags(content: string): string[] {
    const operationalKeywords = [
      'command',
      'execute',
      'run',
      'deploy',
      'build',
      'test',
      'debug',
      'implement',
      'action',
      'workflow',
      'process',
      'pipeline',
      'automation',
      'script',
      'operation',
      'procedure',
    ];

    const lowerContent = content.toLowerCase();
    const tags = operationalKeywords.filter((keyword) =>
      lowerContent.includes(keyword)
    );

    const baseTags = super.extractSemanticTags(content);
    return [...new Set([...tags, ...baseTags])].slice(0, 10);
  }
}
