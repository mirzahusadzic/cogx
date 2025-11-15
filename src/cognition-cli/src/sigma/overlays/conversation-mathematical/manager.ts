/**
 * Conversation Mathematical Overlay (O6)
 *
 * Tracks algorithms, logic, performance analysis, and mathematical discussions
 * in conversation. Captures turns related to computational complexity,
 * optimization, and algorithmic reasoning.
 *
 * Purpose:
 * - Track algorithm design and analysis
 * - Monitor complexity and performance discussions
 * - Document optimization strategies
 * - Capture mathematical/logical reasoning
 *
 * Alignment indicators:
 * - Algorithms: "algorithm", "complexity", "optimization", "recursive"
 * - Performance: "performance", "efficiency", "big-o"
 * - Math: "formula", "theorem", "proof", "mathematical"
 * - Logic: "logic", "computation", "calculate", "analysis"
 *
 * Use cases:
 * - Context reconstruction: preserve algorithm discussions
 * - Compression: maintain performance-critical insights
 * - Query: find optimization opportunities
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

/**
 * Manager for Conversation Mathematical overlay (O6)
 *
 * Stores turns related to algorithms, logic, performance analysis,
 * and mathematical reasoning in conversation.
 */
export class ConversationMathematicalManager extends BaseConversationManager<ConversationTurnMetadata> {
  /**
   * Create a new ConversationMathematicalManager
   *
   * @param sigmaRoot - Path to .sigma directory
   * @param workbenchUrl - Optional workbench URL for embeddings
   * @param debug - Enable debug logging
   */
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-mathematical', workbenchUrl, debug);
  }

  /**
   * Get overlay ID (O6)
   *
   * @returns Overlay identifier "O6"
   */
  getOverlayId(): string {
    return 'O6';
  }

  /**
   * Get human-readable overlay name
   *
   * @returns "Conversation Mathematical"
   */
  getOverlayName(): string {
    return 'Conversation Mathematical';
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
   * Extract alignment scores for O6 (Mathematical/Algorithmic)
   *
   * Boosts O6 score for turns with algorithm, performance, or math discussions.
   * Sets other overlays to 0 to indicate this turn is O6-specific.
   *
   * High scores for:
   * - Algorithm design and analysis
   * - Performance and complexity discussions
   * - Mathematical reasoning and proofs
   *
   * @param baseScore - Base alignment score from turn analysis
   * @returns Alignment scores with O6 boosted, others zeroed
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
      alignment_O4: 0,
      alignment_O5: 0,
      alignment_O6: baseScore,
      alignment_O7: 0,
    };
  }

  /**
   * Extract O6-specific semantic tags (mathematical/algorithmic keywords)
   *
   * Identifies keywords related to algorithms, performance, complexity,
   * and mathematical reasoning. Combines domain keywords with base extraction.
   *
   * Domain keywords:
   * - Algorithms: "algorithm", "complexity", "optimization", "recursive"
   * - Performance: "performance", "efficiency", "big-o"
   * - Math: "formula", "theorem", "proof", "mathematical"
   * - Logic: "logic", "computation", "calculate", "analysis"
   *
   * @param content - Turn content to extract tags from
   * @returns Array of unique semantic tags (max 10)
   * @protected
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
