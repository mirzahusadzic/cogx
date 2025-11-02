/**
 * Conversation Mission Overlay (O4)
 *
 * Tracks goals/objectives discussed in conversation.
 * Aligned with project O4 via Meet operation.
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

export class ConversationMissionManager extends BaseConversationManager<ConversationTurnMetadata> {
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-mission', workbenchUrl, debug);
  }

  getOverlayId(): string {
    return 'O4';
  }

  getOverlayName(): string {
    return 'Conversation Mission';
  }

  getSupportedTypes(): string[] {
    return ['user', 'assistant'];
  }
}
