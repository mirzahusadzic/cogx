/**
 * Recall Past Conversation Tool
 *
 * MCP tool that allows Claude to query past conversation on-demand.
 * Uses SDK's MCP support to provide seamless memory access.
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { queryConversationLattice } from './query-conversation.js';
import type { ConversationOverlayRegistry } from './conversation-registry.js';

/**
 * Create recall conversation MCP server
 *
 * This MCP server provides Claude with the ability to search past conversation
 * using semantic search across all conversation overlays (O1-O7).
 */
export function createRecallMcpServer(
  conversationRegistry: ConversationOverlayRegistry,
  workbenchUrl?: string
) {
  const recallTool = tool(
    'recall_past_conversation',
    'Search your memory for relevant past conversation context. Use this when you need to remember what was discussed earlier, especially after context compression. Queries are semantic - you can ask about topics, not just exact phrases.',
    {
      query: z
        .string()
        .describe(
          'What to search for in past conversation (e.g., "What did we discuss about TUI scrolling?" or "What were the goals mentioned?")'
        ),
    },
    async (args) => {
      try {
        // Query conversation lattice with SLM + LLM synthesis
        const answer = await queryConversationLattice(
          args.query,
          conversationRegistry,
          {
            workbenchUrl,
            topK: 5,
            verbose: false,
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: `Found relevant context:\n\n${answer}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to recall conversation: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return createSdkMcpServer({
    name: 'conversation-memory',
    version: '1.0.0',
    tools: [recallTool],
  });
}
