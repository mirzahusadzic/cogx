/**
 * Shared formatters for agent messaging tool outputs
 *
 * Used by both Claude MCP tools and Gemini ADK tools to ensure
 * consistent output formatting across providers.
 */

import type { QueuedMessage } from './MessageQueue.js';

export interface AgentInfo {
  agentId: string;
  model: string;
  alias?: string;
  startedAt: number;
  lastHeartbeat: number;
  status: 'active' | 'idle' | 'disconnected';
}

/**
 * Format message content for display
 */
export function formatMessageContent(msg: QueuedMessage): string {
  if (
    typeof msg.content === 'object' &&
    msg.content !== null &&
    'message' in msg.content
  ) {
    return (msg.content as { message: string }).message;
  }
  return JSON.stringify(msg.content);
}

/**
 * Format list_agents output
 */
export function formatListAgents(agents: AgentInfo[]): string {
  if (agents.length === 0) {
    return 'No other active agents found. You are the only agent currently running.';
  }

  let text = `**Active Agents (${agents.length})**\n\n`;
  text += '| Alias | Model | Agent ID |\n';
  text += '|-------|-------|----------|\n';

  for (const agent of agents) {
    text += `| ${agent.alias || 'unknown'} | ${agent.model} | ${agent.agentId} |\n`;
  }

  text +=
    '\n**Usage**: Use `send_agent_message` tool with the alias or agent ID to send a message.';

  return text;
}

/**
 * Format send_agent_message success output
 */
export function formatMessageSent(
  to: string,
  agentId: string,
  content: string
): string {
  return `Message sent to ${to} (${agentId}).\n\nContent: "${content}"`;
}

/**
 * Format broadcast_agent_message success output
 */
export function formatBroadcastSent(
  agentCount: number,
  content: string
): string {
  return `Message broadcast to ${agentCount} agent(s).\n\nContent: "${content}"`;
}

/**
 * Format get_pending_messages output
 */
export function formatPendingMessages(messages: QueuedMessage[]): string {
  if (messages.length === 0) {
    return 'No pending messages. Your message queue is empty.';
  }

  let text = `**Pending Messages (${messages.length})**\n\n`;

  for (const msg of messages) {
    const date = new Date(msg.timestamp).toLocaleString();
    const contentText = formatMessageContent(msg);

    text += `---\n\n`;
    text += `**From**: \`${msg.from}\`\n`;
    text += `**Topic**: \`${msg.topic}\`\n`;
    text += `**Received**: ${date}\n`;
    text += `**Message ID**: \`${msg.id}\`\n\n`;
    text += `${contentText}\n\n`;
  }

  text += `---\n\n`;
  text += `**Actions**: Use \`mark_message_read\` with a message ID to mark it as processed.`;

  return text;
}

/**
 * Format mark_message_read success output
 */
export function formatMessageMarked(
  messageId: string,
  status: string,
  from: string,
  content: string
): string {
  return `Message ${messageId} marked as "${status}".\n\nFrom: ${from}\nContent: ${content}`;
}

/**
 * Format error messages consistently
 */
export function formatError(action: string, error: string): string {
  return `Failed to ${action}: ${error}`;
}

/**
 * Format "not initialized" errors
 */
export function formatNotInitialized(component: string): string {
  return `${component} not initialized. IPC system may not be running.`;
}

/**
 * Format "not found" errors
 */
export function formatNotFound(type: string, id: string): string {
  if (type === 'agent') {
    return `Agent not found: "${id}". Use list_agents to see available agents.`;
  }
  return `${type} not found: ${id}`;
}
