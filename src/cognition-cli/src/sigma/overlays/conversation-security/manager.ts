/**
 * Conversation Security Overlay (O2)
 *
 * Tracks security, threat, vulnerability, and privacy discussions in
 * conversation. Captures turns related to authentication, authorization,
 * encryption, and security best practices.
 *
 * Purpose:
 * - Track security requirements and threats
 * - Monitor vulnerability discussions
 * - Document authentication/authorization patterns
 * - Capture security mitigation strategies
 *
 * Alignment indicators:
 * - Security: "security", "threat", "vulnerability", "breach"
 * - Auth: "authentication", "authorization", "encryption"
 * - Attacks: "attack", "exploit", "injection", "xss", "csrf"
 * - Protection: "sanitize", "validate", "mitigation", "malware"
 *
 * Use cases:
 * - Context reconstruction: preserve security context
 * - Compression: maintain critical security insights
 * - Query: find vulnerabilities and mitigations
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

/**
 * Manager for Conversation Security overlay (O2)
 *
 * Stores turns related to security, threats, vulnerabilities,
 * and protection mechanisms in conversation.
 */
export class ConversationSecurityManager extends BaseConversationManager<ConversationTurnMetadata> {
  /**
   * Create a new ConversationSecurityManager
   *
   * @param sigmaRoot - Path to .sigma directory
   * @param workbenchUrl - Optional workbench URL for embeddings
   * @param debug - Enable debug logging
   */
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-security', workbenchUrl, debug);
  }

  /**
   * Get overlay ID (O2)
   *
   * @returns Overlay identifier "O2"
   */
  getOverlayId(): string {
    return 'O2';
  }

  /**
   * Get human-readable overlay name
   *
   * @returns "Conversation Security"
   */
  getOverlayName(): string {
    return 'Conversation Security';
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
   * Extract alignment scores for O2 (Security)
   *
   * Boosts O2 score for turns with security, threat, or vulnerability discussions.
   * Sets other overlays to 0 to indicate this turn is O2-specific.
   *
   * High scores for:
   * - Security requirements and threats
   * - Vulnerability identification
   * - Authentication and authorization patterns
   *
   * @param baseScore - Base alignment score from turn analysis
   * @returns Alignment scores with O2 boosted, others zeroed
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
      alignment_O2: baseScore,
      alignment_O3: 0,
      alignment_O4: 0,
      alignment_O5: 0,
      alignment_O6: 0,
      alignment_O7: 0,
    };
  }

  /**
   * Extract O2-specific semantic tags (security keywords)
   *
   * Identifies keywords related to security, threats, vulnerabilities,
   * and protection mechanisms. Combines domain keywords with base extraction.
   *
   * Domain keywords:
   * - Security: "security", "threat", "vulnerability", "breach"
   * - Auth: "authentication", "authorization", "encryption"
   * - Attacks: "attack", "exploit", "injection", "xss", "csrf"
   * - Protection: "sanitize", "validate", "mitigation", "malware"
   *
   * @param content - Turn content to extract tags from
   * @returns Array of unique semantic tags (max 10)
   * @protected
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
