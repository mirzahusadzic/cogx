/**
 * Conversation Mission Overlay (O4)
 *
 * Tracks goals, objectives, requirements, and strategic vision discussed
 * in conversation. Captures turns related to project purpose, deliverables,
 * and success criteria.
 *
 * Purpose:
 * - Track project goals and objectives
 * - Monitor requirement discussions
 * - Document strategic vision and roadmap
 * - Capture success criteria and milestones
 *
 * Alignment indicators:
 * - Goals: "goal", "objective", "purpose", "target", "achieve"
 * - Vision: "mission", "vision", "strategy", "roadmap"
 * - Requirements: "requirement", "feature", "deliverable"
 * - Success: "milestone", "priority", "outcome", "success"
 *
 * Use cases:
 * - Context reconstruction: maintain goal context
 * - Compression: preserve strategic decisions
 * - Query: find requirements and objectives
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

/**
 * Manager for Conversation Mission overlay (O4)
 *
 * Stores turns related to goals, objectives, requirements,
 * and strategic vision in conversation.
 */
export class ConversationMissionManager extends BaseConversationManager<ConversationTurnMetadata> {
  /**
   * Create a new ConversationMissionManager
   *
   * @param sigmaRoot - Path to .sigma directory
   * @param workbenchUrl - Optional workbench URL for embeddings
   * @param debug - Enable debug logging
   */
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-mission', workbenchUrl, debug);
  }

  /**
   * Get overlay ID (O4)
   *
   * @returns Overlay identifier "O4"
   */
  getOverlayId(): string {
    return 'O4';
  }

  /**
   * Get human-readable overlay name
   *
   * @returns "Conversation Mission"
   */
  getOverlayName(): string {
    return 'Conversation Mission';
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
   * Extract alignment scores for O4 (Mission/Goals)
   *
   * Boosts O4 score for turns with goal, requirement, or vision discussions.
   * Sets other overlays to 0 to indicate this turn is O4-specific.
   *
   * High scores for:
   * - Goal and objective definitions
   * - Requirement specifications
   * - Strategic vision and roadmap
   *
   * @param baseScore - Base alignment score from turn analysis
   * @returns Alignment scores with O4 boosted, others zeroed
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
      alignment_O4: baseScore,
      alignment_O5: 0,
      alignment_O6: 0,
      alignment_O7: 0,
    };
  }

  /**
   * Extract O4-specific semantic tags (mission/goal keywords)
   *
   * Identifies keywords related to goals, objectives, requirements,
   * and strategic vision. Combines domain keywords with base extraction.
   *
   * Domain keywords:
   * - Goals: "goal", "objective", "purpose", "target", "achieve"
   * - Vision: "mission", "vision", "strategy", "roadmap"
   * - Requirements: "requirement", "feature", "deliverable"
   * - Success: "milestone", "priority", "outcome", "success"
   *
   * @param content - Turn content to extract tags from
   * @returns Array of unique semantic tags (max 10)
   * @protected
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
