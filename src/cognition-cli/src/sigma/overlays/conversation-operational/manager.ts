/**
 * Conversation Operational Overlay (O5)
 *
 * Tracks commands, actions, workflows, and execution patterns discussed
 * in conversation. Captures turns related to implementation, deployment,
 * testing, and operational procedures.
 *
 * Purpose:
 * - Track command execution and actions
 * - Monitor workflow and process discussions
 * - Document deployment and testing procedures
 * - Capture automation and scripting patterns
 *
 * Alignment indicators:
 * - Commands: "command", "execute", "run", "deploy"
 * - Actions: "action", "implement", "build", "test", "debug"
 * - Workflows: "workflow", "process", "pipeline", "automation"
 * - Operations: "operation", "procedure", "script"
 *
 * Use cases:
 * - Context reconstruction: preserve operational context
 * - Compression: maintain critical execution details
 * - Query: find implementation and deployment patterns
 */

import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../base-conversation-manager.js';

/**
 * Manager for Conversation Operational overlay (O5)
 *
 * Stores turns related to commands, actions, workflows,
 * and operational procedures in conversation.
 */
export class ConversationOperationalManager extends BaseConversationManager<ConversationTurnMetadata> {
  /**
   * Create a new ConversationOperationalManager
   *
   * @param sigmaRoot - Path to .sigma directory
   * @param workbenchUrl - Optional workbench URL for embeddings
   * @param debug - Enable debug logging
   */
  constructor(sigmaRoot: string, workbenchUrl?: string, debug?: boolean) {
    super(sigmaRoot, 'conversation-operational', workbenchUrl, debug);
  }

  /**
   * Get overlay ID (O5)
   *
   * @returns Overlay identifier "O5"
   */
  getOverlayId(): string {
    return 'O5';
  }

  /**
   * Get human-readable overlay name
   *
   * @returns "Conversation Operational"
   */
  getOverlayName(): string {
    return 'Conversation Operational';
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
   * Extract alignment scores for O5 (Operational/Actions)
   *
   * Boosts O5 score for turns with command, workflow, or execution discussions.
   * Sets other overlays to 0 to indicate this turn is O5-specific.
   *
   * High scores for:
   * - Command execution and actions
   * - Workflow and process design
   * - Deployment and testing procedures
   *
   * @param baseScore - Base alignment score from turn analysis
   * @returns Alignment scores with O5 boosted, others zeroed
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
      alignment_O5: baseScore,
      alignment_O6: 0,
      alignment_O7: 0,
    };
  }

  /**
   * Extract O5-specific semantic tags (operational/action keywords)
   *
   * Identifies keywords related to commands, workflows, execution,
   * and operational procedures. Combines domain keywords with base extraction.
   *
   * Domain keywords:
   * - Commands: "command", "execute", "run", "deploy"
   * - Actions: "action", "implement", "build", "test", "debug"
   * - Workflows: "workflow", "process", "pipeline", "automation"
   * - Operations: "operation", "procedure", "script"
   *
   * @param content - Turn content to extract tags from
   * @returns Array of unique semantic tags (max 10)
   * @protected
   */
  protected extractSemanticTags(content: string): string[] {
    const operationalKeywords = [
      'command',
      'execute',
      'run',
      'deploy',
      'build',
      'test',
      'debug',
      'implement',
      'action',
      'workflow',
      'process',
      'pipeline',
      'automation',
      'script',
      'operation',
      'procedure',
    ];

    const lowerContent = content.toLowerCase();
    const tags = operationalKeywords.filter((keyword) =>
      lowerContent.includes(keyword)
    );

    const baseTags = super.extractSemanticTags(content);
    return [...new Set([...tags, ...baseTags])].slice(0, 10);
  }
}
