/**
 * Conversation Structural Overlay (O1)
 *
 * Tracks architecture, design patterns, and structural discussions in
 * conversation. This is the PRIMARY overlay that stores ALL conversation
 * turns to ensure complete conversation history in LanceDB.
 *
 * Purpose:
 * - Track architecture and design decisions
 * - Monitor structural patterns and refactoring
 * - Document component organization
 * - Store ALL turns for complete conversation record
 *
 * Alignment indicators:
 * - Architecture: "architecture", "design", "structure", "pattern"
 * - Components: "component", "module", "class", "interface"
 * - Organization: "refactor", "organize", "hierarchy", "layer"
 * - Relationships: "dependency", "coupling", "cohesion", "separation"
 *
 * SPECIAL BEHAVIOR:
 * - O1 stores ALL turns regardless of alignment score
 * - This ensures embeddings are always written to LanceDB
 * - Other overlays can reference O1's complete LanceDB data
 *
 * Use cases:
 * - Context reconstruction: preserve structural context
 * - Compression: maintain architectural decisions
 * - Query: find design patterns and component relationships
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

/**
 * Manager for Conversation Structural overlay (O1)
 *
 * Stores ALL conversation turns to maintain complete history in LanceDB.
 * Also specifically tracks architecture, design, and structural discussions.
 */
export class ConversationStructuralManager extends BaseConversationManager<ConversationTurnMetadata> {
  /**
   * Create a new ConversationStructuralManager
   *
   * @param sigmaRoot - Path to .sigma directory
   * @param workbenchUrl - Optional workbench URL for embeddings
   * @param debug - Enable debug logging
   */
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-structural', workbenchUrl, debug);
  }

  /**
   * Get overlay ID (O1)
   *
   * @returns Overlay identifier "O1"
   */
  getOverlayId(): string {
    return 'O1';
  }

  /**
   * Get human-readable overlay name
   *
   * @returns "Conversation Structural"
   */
  getOverlayName(): string {
    return 'Conversation Structural';
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
   * Extract alignment scores for O1 (Structural/Architecture)
   *
   * Boosts O1 score for turns with architecture or design discussions.
   * Sets other overlays to 0 to indicate this turn is O1-specific.
   *
   * High scores for:
   * - Architecture and design decisions
   * - Structural patterns and refactoring
   * - Component organization and relationships
   *
   * Note: O1 stores ALL turns regardless of score (see isRelevantToOverlay)
   *
   * @param baseScore - Base alignment score from turn analysis
   * @returns Alignment scores with O1 boosted, others zeroed
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
   * Extract O1-specific semantic tags (architecture/design keywords)
   *
   * Identifies keywords related to architecture, design patterns,
   * and structural organization. Combines domain keywords with base extraction.
   *
   * Domain keywords:
   * - Architecture: "architecture", "design", "structure", "pattern"
   * - Components: "component", "module", "class", "interface"
   * - Organization: "refactor", "organize", "hierarchy", "layer"
   * - Relationships: "dependency", "coupling", "cohesion", "separation"
   *
   * @param content - Turn content to extract tags from
   * @returns Array of unique semantic tags (max 10)
   * @protected
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
