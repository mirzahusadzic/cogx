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
  constructor(sigmaRoot: string, workbenchUrl?: string) {
    super(sigmaRoot, 'conversation-security', workbenchUrl);
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
}
