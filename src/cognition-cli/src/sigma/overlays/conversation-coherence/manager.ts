/**
 * Conversation Coherence Overlay (O7)
 *
 * Tracks conversation flow and topic drift.
 * Cross-overlay synthesis for conversation.
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

export class ConversationCoherenceManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-coherence', workbenchUrl, debug);
  }

  getOverlayId(): string {
    return 'O7';
  }

  getOverlayName(): string {
    return 'Conversation Coherence';
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }
}
