/**
 * Conversation Security Overlay (O2)
 *
 * Tracks security discussions in conversation.
 * Aligned with project O2 via Meet operation.
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

export class ConversationSecurityManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-security', workbenchUrl, debug);
  }

  getOverlayId(): string {
    return 'O2';
  }

  getOverlayName(): string {
    return 'Conversation Security';
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }

  /**
   * Score turn relevance to O2 (Security).
   * High scores for security, threat, vulnerability discussions.
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
      alignment_O2: baseScore,
      alignment_O3: 0,
      alignment_O4: 0,
      alignment_O5: 0,
      alignment_O6: 0,
      alignment_O7: 0,
    };
  }

  /**
   * Extract O2-specific semantic tags (security keywords).
   */
  protected extractSemanticTags(content: string): string[] {
    const securityKeywords = [
      'security',
      'threat',
      'vulnerability',
      'attack',
      'exploit',
      'authentication',
      'authorization',
      'encryption',
      'sanitize',
      'validate',
      'injection',
      'xss',
      'csrf',
      'malware',
      'breach',
      'mitigation',
    ];

    const lowerContent = content.toLowerCase();
    const tags = securityKeywords.filter((keyword) =>
      lowerContent.includes(keyword)
    );

    const baseTags = super.extractSemanticTags(content);
    return [...new Set([...tags, ...baseTags])].slice(0, 10);
  }
}
