import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from './base-conversation-manager.js';
import { AlignmentScores, ConversationOverlayConfig } from './types.js';

/**
 * Generic Conversation Overlay Manager
 *
 * Replaces redundant subclass implementations (O1-O7) by using configuration
 * objects from src/sigma/overlays/types.ts.
 *
 * This manager handles:
 * 1. Metadata management for conversation turns
 * 2. Semantic alignment scoring using keywords from config
 * 3. Relevance filtering (O1 stores all, others filter by score)
 * 4. Persistence to YAML and LanceDB (via BaseConversationManager)
 *
 * @example
 * const config = CONVERSATION_OVERLAY_CONFIGS['O1'];
 * const manager = new ConversationOverlayManager(sigmaRoot, config);
 * await manager.initializeLanceStore();
 */
export class ConversationOverlayManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(
    sigmaRoot: string,
    private config: ConversationOverlayConfig,
    workbenchUrl?: string,
    debug?: boolean
  ) {
    super(sigmaRoot, config.slug, workbenchUrl, debug);
  }

  getOverlayId(): string {
    return this.config.id;
  }

  getOverlayName(): string {
    return this.config.name;
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }

  /**
   * Only the current overlay gets the alignment score, others are 0
   */
  protected extractAlignmentScores(baseScore: number): AlignmentScores {
    const scores: AlignmentScores = {
      alignment_O1: 0,
      alignment_O2: 0,
      alignment_O3: 0,
      alignment_O4: 0,
      alignment_O5: 0,
      alignment_O6: 0,
      alignment_O7: 0,
    };

    const key = `alignment_${this.config.id}` as keyof AlignmentScores;
    scores[key] = baseScore;

    return scores;
  }

  /**
   * Extract semantic tags based on overlay-specific keywords
   */
  protected extractSemanticTags(content: string): string[] {
    const lowerContent = content.toLowerCase();

    // Find matching keywords from configuration
    const tags = this.config.keywords.filter((keyword) =>
      lowerContent.includes(keyword)
    );

    // Merge with base tags (which identifies things like 'sigma', 'context', etc.)
    const baseTags = super.extractSemanticTags(content);
    const combined = [...new Set([...tags, ...baseTags])];

    // Return top 10 unique tags
    return combined.slice(0, 10);
  }
}
