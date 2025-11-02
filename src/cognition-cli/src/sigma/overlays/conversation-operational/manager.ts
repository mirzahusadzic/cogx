/**
 * Conversation Operational Overlay (O5)
 *
 * Tracks commands/actions executed in conversation.
 * Aligned with project O5 via Meet operation.
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

export class ConversationOperationalManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-operational', workbenchUrl, debug);
  }

  getOverlayId(): string {
    return 'O5';
  }

  getOverlayName(): string {
    return 'Conversation Operational';
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }
}
