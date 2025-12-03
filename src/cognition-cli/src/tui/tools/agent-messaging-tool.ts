/**
 * Agent Messaging Tool
 *
 * MCP tool that allows the AI agent to send messages to other agents
 * and list active agents in the IPC bus.
 *
 * This enables agent-to-agent collaboration where Claude can:
 * - Discover other active agents
 * - Send messages to specific agents
 * - Broadcast messages to all agents
 */

import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import type { MessagePublisher } from '../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../ipc/MessageQueue.js';
import {
  formatListAgents,
  formatMessageSent,
  formatBroadcastSent,
  formatPendingMessages,
  formatMessageMarked,
  formatMessageContent,
  formatError,
  formatNotInitialized,
  formatNotFound,
  type AgentInfo,
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
 * Create agent messaging MCP server
 *
 * This MCP server enables agent-to-agent communication.
 * The AI agent can discover other agents, send messages, and read pending messages.
 *
 * @param getPublisher - Function to get the MessagePublisher instance
 * @param getMessageQueue - Function to get the MessageQueue instance (for reading pending messages)
 * @param projectRoot - Project root directory (for reading agent-info.json files)
 * @param currentAgentId - Current agent's ID (to exclude self from listings)
 * @param claudeAgentSdk - The dynamically imported Claude Agent SDK module
 * @returns MCP server instance with messaging tools
 */
export function createAgentMessagingMcpServer(
  getPublisher: () => MessagePublisher | null,
  getMessageQueue: (() => MessageQueue | null) | undefined,
  projectRoot: string,
  currentAgentId: string,
  claudeAgentSdk: ClaudeAgentSdk | undefined
) {
  if (!claudeAgentSdk) {
    return undefined;
  }

  const { tool, createSdkMcpServer } = claudeAgentSdk;

  // Tool: List active agents
  const listAgentsTool = tool(
    'list_agents',
    'List all active agents in the IPC bus. Returns agent aliases, models, and status. Use this to discover other agents before sending messages.',
    {},
    async () => {
      try {
        const agents = getActiveAgents(projectRoot, currentAgentId);
        return {
          content: [{ type: 'text', text: formatListAgents(agents) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: formatError('list agents', (err as Error).message),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Send message to agent
  const sendMessageTool = tool(
    'send_agent_message',
    'Send a message to another agent. The recipient will see it in their pending messages. Use list_agents first to discover available agents.',
    {
      to: z
        .string()
        .describe(
          'Target agent alias (e.g., "opus1", "sonnet2") or full agent ID'
        ),
      message: z.string().describe('The message content to send'),
    },
    async (args: { to: string; message: string }) => {
      try {
        const publisher = getPublisher();

        if (!publisher) {
          return {
            content: [
              { type: 'text', text: formatNotInitialized('Message publisher') },
            ],
            isError: true,
          };
        }

        // Resolve alias to agent ID
        const targetAgentId = resolveAgentId(projectRoot, args.to);

        if (!targetAgentId) {
          return {
            content: [{ type: 'text', text: formatNotFound('agent', args.to) }],
            isError: true,
          };
        }

        // Send the message
        await publisher.sendMessage(targetAgentId, args.message);

        return {
          content: [
            {
              type: 'text',
              text: formatMessageSent(args.to, targetAgentId, args.message),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: formatError('send message', (err as Error).message),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Broadcast message to all agents
  const broadcastTool = tool(
    'broadcast_agent_message',
    'Broadcast a message to ALL active agents. Use sparingly - prefer send_agent_message for targeted communication.',
    {
      message: z.string().describe('The message content to broadcast'),
    },
    async (args: { message: string }) => {
      try {
        const publisher = getPublisher();

        if (!publisher) {
          return {
            content: [
              { type: 'text', text: formatNotInitialized('Message publisher') },
            ],
            isError: true,
          };
        }

        // Broadcast to all agents
        await publisher.broadcast('agent.message', {
          type: 'text',
          message: args.message,
        });

        const agents = getActiveAgents(projectRoot, currentAgentId);

        return {
          content: [
            {
              type: 'text',
              text: formatBroadcastSent(agents.length, args.message),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: formatError('broadcast message', (err as Error).message),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Get pending messages
  const getPendingMessagesTool = tool(
    'get_pending_messages',
    'Get all pending messages in your message queue. These are messages from other agents that you have not yet processed.',
    {},
    async () => {
      try {
        const queue = getMessageQueue ? getMessageQueue() : null;

        if (!queue) {
          return {
            content: [
              { type: 'text', text: formatNotInitialized('Message queue') },
            ],
            isError: true,
          };
        }

        const messages = await queue.getMessages('pending');

        return {
          content: [{ type: 'text', text: formatPendingMessages(messages) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: formatError('get pending messages', (err as Error).message),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Mark message as read/injected
  const markMessageReadTool = tool(
    'mark_message_read',
    'Mark a pending message as read/processed. Use this after you have handled a message from another agent.',
    {
      messageId: z.string().describe('The message ID to mark as read'),
      status: z
        .enum(['read', 'injected', 'dismissed'])
        .default('injected')
        .describe(
          'New status: "injected" (processed), "read" (seen), or "dismissed" (ignored)'
        ),
    },
    async (args: {
      messageId: string;
      status?: 'read' | 'injected' | 'dismissed';
    }) => {
      try {
        const queue = getMessageQueue ? getMessageQueue() : null;

        if (!queue) {
          return {
            content: [
              { type: 'text', text: formatNotInitialized('Message queue') },
            ],
            isError: true,
          };
        }

        const message = await queue.getMessage(args.messageId);

        if (!message) {
          return {
            content: [
              { type: 'text', text: formatNotFound('Message', args.messageId) },
            ],
            isError: true,
          };
        }

        const newStatus = args.status || 'injected';
        await queue.updateStatus(args.messageId, newStatus);

        return {
          content: [
            {
              type: 'text',
              text: formatMessageMarked(
                args.messageId,
                newStatus,
                message.from,
                formatMessageContent(message)
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: formatError('mark message', (err as Error).message),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return createSdkMcpServer({
    name: 'agent-messaging',
    version: '1.0.0',
    tools: [
      listAgentsTool,
      sendMessageTool,
      broadcastTool,
      getPendingMessagesTool,
      markMessageReadTool,
    ],
  });
}

/**
 * Get list of active agents from message_queue directory
 */
function getActiveAgents(
  projectRoot: string,
  excludeAgentId: string
): AgentInfo[] {
  const queueDir = path.join(projectRoot, '.sigma', 'message_queue');

  if (!fs.existsSync(queueDir)) {
    return [];
  }

  const agents: AgentInfo[] = [];
  const now = Date.now();
  const ACTIVE_THRESHOLD = 30000; // 30 seconds

  const entries = fs.readdirSync(queueDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const infoPath = path.join(queueDir, entry.name, 'agent-info.json');
    if (!fs.existsSync(infoPath)) continue;

    try {
      const info: AgentInfo = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));

      // Check if active (recent heartbeat) and not self
      const isActive =
        info.status === 'active' && now - info.lastHeartbeat < ACTIVE_THRESHOLD;

      // Exclude self (check both full ID and base ID)
      const isSelf =
        info.agentId === excludeAgentId ||
        excludeAgentId.startsWith(entry.name);

      if (isActive && !isSelf) {
        agents.push(info);
      }
    } catch {
      // Ignore parse errors
    }
  }

  return agents.sort((a, b) => (a.alias || '').localeCompare(b.alias || ''));
}

/**
 * Resolve alias or partial ID to full agent ID
 */
function resolveAgentId(projectRoot: string, aliasOrId: string): string | null {
  const queueDir = path.join(projectRoot, '.sigma', 'message_queue');

  if (!fs.existsSync(queueDir)) {
    return null;
  }

  const entries = fs.readdirSync(queueDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const infoPath = path.join(queueDir, entry.name, 'agent-info.json');
    if (!fs.existsSync(infoPath)) continue;

    try {
      const info: AgentInfo = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));

      // Match by alias (case-insensitive)
      if (info.alias && info.alias.toLowerCase() === aliasOrId.toLowerCase()) {
        return info.agentId;
      }

      // Match by full agent ID
      if (info.agentId === aliasOrId) {
        return info.agentId;
      }

      // Match by directory name (partial ID)
      if (entry.name === aliasOrId) {
        return info.agentId;
      }
    } catch {
      // Ignore parse errors
    }
  }

  return null;
}
