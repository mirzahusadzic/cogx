/**
 * Shared formatters for agent messaging tool outputs
 *
 * Used by both Claude MCP tools and Gemini ADK tools to ensure
 * consistent output formatting across providers.
 */

import type { QueuedMessage } from './MessageQueue.js';

/**
 * Represents metadata about an active agent.
 *
 * @interface AgentInfo
 * @property {string} agentId The unique identifier for the agent.
 * @property {string} model The base model of the agent (e.g., 'opus', 'gemini').
 * @property {string} [alias] A short, human-readable alias (e.g., 'opus1').
 * @property {number} startedAt Unix timestamp of when the agent was started.
 * @property {number} lastHeartbeat Unix timestamp of the agent's last heartbeat.
 * @property {'active' | 'idle' | 'disconnected'} status The current status of the agent.
 */
export interface AgentInfo {
  agentId: string;
  model: string;
  alias?: string;
  startedAt: number;
  lastHeartbeat: number;
  status: 'active' | 'idle' | 'disconnected';
}

/**
 * Formats the content of a queued message for display.
 *
 * @param {QueuedMessage} msg The message to format.
 * @returns {string} The formatted message content as a string.
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
 * Formats the output of the `list_agents` tool.
 *
 * @param {AgentInfo[]} agents An array of active agent information.
 * @returns {string} A formatted markdown table of active agents.
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
 * Formats the success output for the `send_agent_message` tool.
 *
 * @param {string} to The target alias or ID the message was sent to.
 * @param {string} agentId The resolved agent ID of the recipient.
 * @param {string} content The content of the message that was sent.
 * @returns {string} A confirmation string.
 */
export function formatMessageSent(
  to: string,
  agentId: string,
  content: string
): string {
  return `Message sent to ${to} (${agentId}).\n\nContent: "${content}"`;
}

/**
 * Formats the success output for the `broadcast_agent_message` tool.
 *
 * @param {number} agentCount The number of agents the message was broadcast to.
 * @param {string} content The content of the message that was broadcast.
 * @returns {string} A confirmation string.
 */
export function formatBroadcastSent(
  agentCount: number,
  content: string
): string {
  return `Message broadcast to ${agentCount} agent(s).\n\nContent: "${content}"`;
}

/**
 * Formats the output for the `list_pending_messages` tool.
 *
 * @param {QueuedMessage[]} messages An array of pending messages.
 * @returns {string} A formatted string listing the pending messages.
 */
export function formatPendingMessages(messages: QueuedMessage[]): string {
  if (messages.length === 0) {
    return 'No pending messages. Your message queue is empty.';
  }

  let text = `**Pending Messages (${messages.length})**\n\n`;

  for (const msg of messages) {
    const date = new Date(msg.timestamp).toLocaleString();

    // Try to detect query_request messages (they may be in message field as JSON string)
    let isQueryRequest = false;
    let queryContent: {
      type: string;
      queryId: string;
      question: string;
    } | null = null;

    // Check if it's a direct query_request object
    if (
      typeof msg.content === 'object' &&
      msg.content !== null &&
      'type' in msg.content &&
      msg.content.type === 'query_request' &&
      'question' in msg.content &&
      'queryId' in msg.content
    ) {
      isQueryRequest = true;
      queryContent = msg.content as {
        type: string;
        queryId: string;
        question: string;
      };
    }
    // Check if it's a text message with JSON-encoded query_request
    else if (
      typeof msg.content === 'object' &&
      msg.content !== null &&
      'type' in msg.content &&
      msg.content.type === 'text' &&
      'message' in msg.content &&
      typeof msg.content.message === 'string'
    ) {
      try {
        const parsed = JSON.parse(msg.content.message);
        if (
          parsed.type === 'query_request' &&
          parsed.question &&
          parsed.queryId
        ) {
          isQueryRequest = true;
          queryContent = parsed;
        }
      } catch {
        // Not JSON, continue as regular message
      }
    }

    if (isQueryRequest && queryContent) {
      // Format as cross-project query request
      text += `---\n\n`;
      text += `🔍 **Cross-Project Query Request**\n\n`;
      text += `**From**: \`${msg.from}\`\n`;
      text += `**Query ID**: \`${queryContent.queryId}\`\n`;
      text += `**Received**: ${date}\n\n`;
      text += `**Question**: "${queryContent.question}"\n\n`;
      text += `**Action Required**: Please answer this question using your knowledge of the codebase. When you have the answer, send it back using:\n\n`;
      text += `\`\`\`\nsend_agent_message("${msg.from}", JSON.stringify({\n  "type": "query_response",\n  "queryId": "${queryContent.queryId}",\n  "answer": "<your answer here>"\n}))\n\`\`\`\n\n`;
      text += `Then use \`mark_message_read("${msg.id}")\` to mark this query as processed.\n\n`;
    } else {
      // Regular message formatting
      const contentText = formatMessageContent(msg);

      text += `---\n\n`;
      text += `**From**: \`${msg.from}\`\n`;
      text += `**Topic**: \`${msg.topic}\`\n`;
      text += `**Received**: ${date}\n`;
      text += `**Message ID**: \`${msg.id}\`\n\n`;
      text += `${contentText}\n\n`;
    }
  }

  text += `---\n\n`;
  text += `**Actions**: Use \`mark_message_read\` with a message ID to mark it as processed.`;

  return text;
}

/**
 * Formats the success output for the `mark_message_read` tool.
 *
 * @param {string} messageId The ID of the message that was marked.
 * @param {string} status The new status of the message.
 * @param {string} from The sender of the original message.
 * @param {string} content The content of the original message.
 * @returns {string} A confirmation string.
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
 * Formats a generic error message for a tool.
 *
 * @param {string} action The action that failed (e.g., 'send message').
 * @param {string} error The error description.
 * @returns {string} A formatted error string.
 */
export function formatError(action: string, error: string): string {
  return `Failed to ${action}: ${error}`;
}

/**
 * Formats an error message for when a required component is not initialized.
 *
 * @param {string} component The name of the uninitialized component (e.g., 'MessageQueue').
 * @returns {string} A formatted error string.
 */
export function formatNotInitialized(component: string): string {
  return `${component} not initialized. IPC system may not be running.`;
}

/**
 * Formats an error message for when an entity is not found.
 *
 * @param {string} type The type of entity that was not found (e.g., 'agent', 'message').
 * @param {string} id The ID of the entity that was not found.
 * @returns {string} A formatted error string.
 */
export function formatNotFound(type: string, id: string): string {
  if (type === 'agent') {
    return `Agent not found: "${id}". Use list_agents to see available agents.`;
  }
  return `${type} not found: ${id}`;
}
