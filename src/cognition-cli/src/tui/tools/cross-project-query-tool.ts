/**
 * Cross-Project Query Tool
 *
 * MCP tool that allows agents to semantically query each other across
 * repository boundaries via the ZeroMQ bus. This enables "Peer-to-Peer
 * Grounding" where agents can ask questions about other projects and get
 * grounded answers based on the target agent's Grounded Context Pool (PGC).
 *
 * Example usage:
 *   query_agent('egemma_agent', 'How does the lattice merger handle conflicts?')
 *
 * The target agent will automatically answer the query by running its local
 * PGC query logic and sending the result back.
 */

import { z } from 'zod';
import type { MessagePublisher } from '../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../ipc/MessageQueue.js';
import { resolveAgentId } from '../../ipc/agent-discovery.js';
import {
  formatError,
  formatNotInitialized,
  formatNotFound,
} from '../../ipc/agent-messaging-formatters.js';

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
 * Create cross-project query MCP server
 *
 * This MCP server enables cross-project semantic queries between agents.
 * Agents can ask questions to other agents working in different repositories.
 *
 * @param getPublisher - Function to get the MessagePublisher instance
 * @param getMessageQueue - Function to get the MessageQueue instance
 * @param projectRoot - Project root directory
 * @param currentAgentId - Current agent's ID
 * @param claudeAgentSdk - The dynamically imported Claude Agent SDK module
 * @param addSystemMessage - Function to display system messages in the TUI
 * @returns MCP server instance with cross-project query tools
 */
export function createCrossProjectQueryMcpServer(
  getPublisher: () => MessagePublisher | null,
  getMessageQueue: (() => MessageQueue | null) | undefined,
  projectRoot: string,
  currentAgentId: string,
  claudeAgentSdk: ClaudeAgentSdk | undefined,
  addSystemMessage?: (msg: string) => void
) {
  if (!claudeAgentSdk) {
    return undefined;
  }

  const { tool, createSdkMcpServer } = claudeAgentSdk;

  // Tool: Query another agent
  const queryAgentTool = tool(
    'query_agent',
    'Ask a semantic question to another agent and get a grounded answer based on their Grounded Context Pool (PGC). Use this to query agents working in different repositories. Example: query_agent("egemma_agent", "How does the lattice merger handle conflicts?")',
    {
      target_alias: z
        .string()
        .describe(
          'Target agent alias (e.g., "opus1", "sonnet2") or full agent ID'
        ),
      question: z
        .string()
        .describe('The semantic question to ask about their codebase'),
    },
    async (args: { target_alias: string; question: string }) => {
      try {
        const publisher = getPublisher();
        const queue = getMessageQueue ? getMessageQueue() : null;

        if (!publisher || !queue) {
          return {
            content: [
              {
                type: 'text',
                text: formatNotInitialized('Message publisher or queue'),
              },
            ],
            isError: true,
          };
        }

        // Resolve alias to agent ID
        const targetAgentId = resolveAgentId(projectRoot, args.target_alias);

        if (!targetAgentId) {
          return {
            content: [
              {
                type: 'text',
                text: formatNotFound('agent', args.target_alias),
              },
            ],
            isError: true,
          };
        }

        // Generate a unique query ID for request/response correlation
        const queryId = crypto.randomUUID();

        // Display visual feedback in TUI
        if (addSystemMessage) {
          addSystemMessage(
            `🔍 Querying ${args.target_alias} (${targetAgentId}): "${args.question}"`
          );
        }

        // Send the query to the target agent
        await publisher.sendMessage(
          targetAgentId,
          JSON.stringify({
            type: 'query_request',
            queryId,
            question: args.question,
          })
        );

        // Wait for the response (with 60s timeout)
        const TIMEOUT_MS = 60000;
        const startTime = Date.now();

        while (Date.now() - startTime < TIMEOUT_MS) {
          // Check for response messages
          const messages = await queue.getMessages('pending');

          for (const msg of messages) {
            // Try to find query_response (may be direct object or JSON-encoded in message field)
            let responseData: { queryId: string; answer: string } | null = null;

            // Check if it's a direct query_response object
            if (
              msg.content &&
              typeof msg.content === 'object' &&
              'type' in msg.content &&
              msg.content.type === 'query_response' &&
              'queryId' in msg.content &&
              msg.content.queryId === queryId &&
              'answer' in msg.content
            ) {
              responseData = msg.content as { queryId: string; answer: string };
            }
            // Check if it's a text message with JSON-encoded query_response
            else if (
              msg.content &&
              typeof msg.content === 'object' &&
              'type' in msg.content &&
              msg.content.type === 'text' &&
              'message' in msg.content &&
              typeof msg.content.message === 'string'
            ) {
              try {
                const parsed = JSON.parse(msg.content.message);
                if (
                  parsed.type === 'query_response' &&
                  parsed.queryId === queryId &&
                  parsed.answer
                ) {
                  responseData = parsed;
                }
              } catch {
                // Not JSON, continue
              }
            }

            if (responseData) {
              // Found our response!
              const answer = responseData.answer;

              // Mark message as processed
              await queue.updateStatus(msg.id, 'injected');

              // Display visual feedback in TUI
              if (addSystemMessage) {
                addSystemMessage(
                  `✅ Received answer from ${args.target_alias}:\n\n${answer}`
                );
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: `Query: "${args.question}"\n\nAnswer from ${args.target_alias}:\n\n${answer}`,
                  },
                ],
              };
            }
          }

          // Poll every 500ms
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Timeout - no response received
        if (addSystemMessage) {
          addSystemMessage(
            `⏱️ Timeout: No response from ${args.target_alias} after ${TIMEOUT_MS / 1000}s`
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: `⏱️ Timeout: No response from ${args.target_alias} after ${TIMEOUT_MS / 1000}s. The agent may be offline or busy.`,
            },
          ],
          isError: true,
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: formatError('query agent', (err as Error).message),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return createSdkMcpServer({
    name: 'cross-project-query',
    version: '1.0.0',
    tools: [queryAgentTool],
  });
}
