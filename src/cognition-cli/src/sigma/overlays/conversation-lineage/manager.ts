/**
 * Conversation Lineage Overlay (O3)
 *
 * Tracks knowledge evolution in conversation ("earlier we discussed...").
 * Aligned with project O3 via Meet operation.
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

export class ConversationLineageManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(sigmaRoot: string, workbenchUrl?: string) {
    super(sigmaRoot, 'conversation-lineage', workbenchUrl);
  }

  getOverlayId(): string {
    return 'O3';
  }

  getOverlayName(): string {
    return 'Conversation Lineage';
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }
}
