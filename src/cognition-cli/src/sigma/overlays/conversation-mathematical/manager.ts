/**
 * Conversation Mathematical Overlay (O6)
 *
 * Tracks algorithms/logic discussions in conversation.
 * Aligned with project O6 via Meet operation.
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

export class ConversationMathematicalManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(sigmaRoot: string, workbenchUrl?: string) {
    super(sigmaRoot, 'conversation-mathematical', workbenchUrl);
  }

  getOverlayId(): string {
    return 'O6';
  }

  getOverlayName(): string {
    return 'Conversation Mathematical';
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }
}
