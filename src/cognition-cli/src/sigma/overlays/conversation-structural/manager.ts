/**
 * Conversation Structural Overlay (O1)
 *
 * Tracks architecture/design discussions in conversation.
 * Aligned with project O1 via Meet operation.
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

export class ConversationStructuralManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(sigmaRoot: string, workbenchUrl?: string) {
    super(sigmaRoot, 'conversation-structural', workbenchUrl);
  }

  getOverlayId(): string {
    return 'O1';
  }

  getOverlayName(): string {
    return 'Conversation Structural';
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }
}
