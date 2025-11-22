/**
 * Recall Past Conversation Tool
 *
 * MCP tool that allows Claude to query past conversation on-demand.
 * Uses SDK's MCP support to provide seamless memory access.
 */

import { z } from 'zod';
import { queryConversationLattice } from './query-conversation.js';
import type { ConversationOverlayRegistry } from './conversation-registry.js';

type ClaudeAgentSdk = {
  tool: (
    name: string,
    description: string,
    inputSchema: unknown,
    action: unknown
  ) => unknown;
  createSdkMcpServer: (config: unknown) => unknown;
};

/**
 * Create recall conversation MCP server
 *
 * This MCP server provides Claude with the ability to search past conversation
 * using semantic search across all conversation overlays (O1-O7).
 *
 * DESIGN:
 * - MCP tool integration via SDK's createSdkMcpServer
 * - Natural language queries (e.g., "What did we discuss about TUI scrolling?")
 * - Semantic search across LanceDB conversation stores
 * - SLM + LLM synthesis for accurate answers
 *
 * @param conversationRegistry - Registry of conversation overlay managers
 * @param claudeAgentSdk - The dynamically imported Claude Agent SDK module
 * @param workbenchUrl - Optional URL for workbench API access
 * @returns MCP server instance with recall_past_conversation tool
 *
 * @example
 * const server = createRecallMcpServer(registry, claudeSdk, 'http://localhost:3001');
 * // Claude can now use: "recall_past_conversation" tool to query history
 */
export function createRecallMcpServer(
  conversationRegistry: ConversationOverlayRegistry,
  claudeAgentSdk: ClaudeAgentSdk | undefined,
  workbenchUrl?: string
) {
  if (!claudeAgentSdk) {
    return undefined;
  }

  const { tool, createSdkMcpServer } = claudeAgentSdk;
  const recallTool = tool(
    'recall_past_conversation',
    'Retrieve FULL untruncated messages from conversation history. The recap you see is truncated to 150 chars - when you see "..." it means more content is available. Use this tool to get complete details. Searches all 7 overlays (O1-O7) in LanceDB with semantic search. Ask about topics, not exact phrases.',
    {
      query: z
        .string()
        .describe(
          'What to search for in past conversation (e.g., "What did we discuss about TUI scrolling?" or "What were the goals mentioned?")'
        ),
    },
    async (args: { query: string }) => {
      try {
        // Query conversation lattice with SLM + LLM synthesis
        const answer = await queryConversationLattice(
          args.query,
          conversationRegistry,
          {
            workbenchUrl,
            topK: 10, // Increased from 5 for better coverage
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
