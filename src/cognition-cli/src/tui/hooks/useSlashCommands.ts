import { useCallback, useMemo } from 'react';
import fs from 'fs';
import path from 'path';
import { getSigmaDirectory } from '../../ipc/sigma-directory.js';
import type { MessageQueue } from '../../ipc/MessageQueue.js';
import type { MessagePublisher } from '../../ipc/MessagePublisher.js';

interface UseSlashCommandsOptions {
  projectRoot: string;
  anchorId: string | null;
  addSystemMessage: (content: string) => void;
  originalSendMessage: (msg: string) => void;
  messageQueueRef: React.RefObject<MessageQueue | null>;
  messagePublisherRef: React.RefObject<MessagePublisher | null>;
  setStreamingPaste: (paste: string) => void;
}

export function useSlashCommands({
  projectRoot,
  anchorId,
  addSystemMessage,
  originalSendMessage,
  messageQueueRef,
  messagePublisherRef,
  setStreamingPaste,
}: UseSlashCommandsOptions) {
  const handleSlashCommand = useCallback(
    async (msg: string): Promise<boolean> => {
      // Handle /send command for inter-agent messaging
      if (msg.startsWith('/send')) {
        const args = msg.slice(5).trim();
        const spaceIndex = args.indexOf(' ');

        if (spaceIndex === -1) {
          addSystemMessage(
            '❌ Missing message content\n\nUsage: /send <alias> <message>'
          );
          return true;
        }

        const targetAliasOrId = args.slice(0, spaceIndex);
        const messageContent = args.slice(spaceIndex + 1);

        if (!messageContent.trim()) {
          addSystemMessage('❌ Message content cannot be empty');
          return true;
        }

        let targetAgentId: string | null = null;
        const sigmaDir = getSigmaDirectory(projectRoot);
        const queueDir = path.join(sigmaDir, 'message_queue');
        const ACTIVE_THRESHOLD_MS = 5000;
        const now = Date.now();

        if (fs.existsSync(queueDir)) {
          const entries = fs.readdirSync(queueDir, { withFileTypes: true });

          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const infoPath = path.join(queueDir, entry.name, 'agent-info.json');
            if (fs.existsSync(infoPath)) {
              try {
                const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
                const isActive =
                  info.status === 'active' &&
                  now - info.lastHeartbeat < ACTIVE_THRESHOLD_MS;

                const aliasMatch =
                  info.alias &&
                  info.alias.toLowerCase() === targetAliasOrId.toLowerCase();
                const idMatch = info.agentId === targetAliasOrId;

                if ((aliasMatch || idMatch) && isActive) {
                  targetAgentId = info.agentId || entry.name;
                  break;
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        if (!targetAgentId) {
          addSystemMessage(
            `❌ Agent "${targetAliasOrId}" not found\n\nUse /agents to see available agents`
          );
          return true;
        }

        try {
          const publisher = messagePublisherRef.current;
          if (!publisher) {
            addSystemMessage('❌ MessagePublisher not initialized');
            return true;
          }

          await publisher.sendMessage(targetAgentId, messageContent);
          addSystemMessage(
            `📤 Sent to ${targetAliasOrId}: "${messageContent}"`
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          addSystemMessage(`❌ Send failed: ${errorMsg}`);
        }

        return true;
      }

      // Handle /pending command
      if (msg.trim() === '/pending') {
        try {
          const messageQueue = messageQueueRef.current;
          if (!messageQueue) {
            addSystemMessage('❌ MessageQueue not initialized');
            return true;
          }

          const messages = await messageQueue.getMessages('pending');

          if (messages.length === 0) {
            addSystemMessage('📭 No pending messages');
            return true;
          }

          let output = `📬 Pending Messages (${messages.length})\n\n`;

          for (const msg of messages) {
            const time = new Date(msg.timestamp).toLocaleTimeString();
            const contentPreview =
              typeof msg.content === 'object' &&
              msg.content !== null &&
              'message' in msg.content
                ? (msg.content as { message: string }).message
                : JSON.stringify(msg.content);

            const preview =
              contentPreview.length > 80
                ? contentPreview.slice(0, 77) + '...'
                : contentPreview;

            output += `• [${msg.id.slice(0, 8)}] ${msg.from} (${time})\n`;
            output += `  "${preview}"\n\n`;
          }

          output += `💬 /inject <id> | /inject-all | /dismiss <id>`;
          addSystemMessage(output);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          addSystemMessage(`❌ Error: ${errorMsg}`);
        }

        return true;
      }

      // Handle /inject command
      if (msg.startsWith('/inject')) {
        const messageId = msg.slice(7).trim();

        if (!messageId) {
          originalSendMessage(
            '❌ Error: Missing message ID\n\nUsage: /inject <message-id>\n\nUse `/pending` to see available messages.'
          );
          return true;
        }

        try {
          const messageQueue = messageQueueRef.current;
          if (!messageQueue) {
            originalSendMessage('❌ Error: MessageQueue not initialized.');
            return true;
          }

          const message = await messageQueue.getMessage(messageId);

          if (!message) {
            originalSendMessage(
              `❌ **Error: Message not found**\n\nMessage ID \`${messageId}\` does not exist in the queue.\n\nUse \`/pending\` to see available messages.`
            );
            return true;
          }

          await messageQueue.updateStatus(messageId, 'injected');

          const date = new Date(message.timestamp).toLocaleString();
          const contentText =
            typeof message.content === 'object' &&
            message.content !== null &&
            'message' in message.content
              ? (message.content as { message: string }).message
              : JSON.stringify(message.content);

          const output =
            `📨 **Injected Message from ${message.from}**\n\n` +
            `**Topic**: \`${message.topic}\`\n` +
            `**Received**: ${date}\n\n` +
            `---\n\n` +
            `${contentText}\n\n` +
            `---\n\n` +
            `_Message status updated to: injected_`;

          originalSendMessage(output);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          originalSendMessage(`❌ Error injecting message: ${errorMsg}`);
        }

        return true;
      }

      // Handle /inject-all command
      if (msg.trim() === '/inject-all') {
        try {
          const messageQueue = messageQueueRef.current;
          if (!messageQueue) {
            originalSendMessage('❌ Error: MessageQueue not initialized.');
            return true;
          }

          const messages = await messageQueue.getMessages('pending');

          if (messages.length === 0) {
            originalSendMessage(
              '📭 **No pending messages to inject**\n\nYour message queue is empty.'
            );
            return true;
          }

          let output = `📨 **Injecting ${messages.length} Messages**\n\n`;

          for (const msg of messages) {
            const date = new Date(msg.timestamp).toLocaleString();
            const contentText =
              typeof msg.content === 'object' &&
              msg.content !== null &&
              'message' in msg.content
                ? (msg.content as { message: string }).message
                : JSON.stringify(msg.content);

            output += `---\n\n`;
            output += `**From**: \`${msg.from}\` | **Topic**: \`${msg.topic}\` | **Received**: ${date}\n\n`;
            output += `${contentText}\n\n`;

            await messageQueue.updateStatus(msg.id, 'injected');
          }

          output += `---\n\n_All messages marked as injected_`;
          originalSendMessage(output);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          originalSendMessage(`❌ Error injecting messages: ${errorMsg}`);
        }

        return true;
      }

      // Handle /dismiss command
      if (msg.startsWith('/dismiss')) {
        const messageId = msg.slice(8).trim();

        if (!messageId) {
          addSystemMessage('❌ Missing message ID\n\nUsage: /dismiss <id>');
          return true;
        }

        try {
          const messageQueue = messageQueueRef.current;
          if (!messageQueue) {
            addSystemMessage('❌ MessageQueue not initialized');
            return true;
          }

          const message = await messageQueue.getMessage(messageId);

          if (!message) {
            addSystemMessage(`❌ Message not found: ${messageId}`);
            return true;
          }

          await messageQueue.updateStatus(messageId, 'dismissed');
          addSystemMessage(`🗑️ Dismissed message from ${message.from}`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          addSystemMessage(`❌ Error: ${errorMsg}`);
        }

        return true;
      }

      // Handle /agents command
      if (msg.trim() === '/agents') {
        const getProviderEmoji = (model: string): string => {
          if (model.includes('gemini')) return '🔵';
          if (
            model.includes('opus') ||
            model.includes('sonnet') ||
            model.includes('claude')
          )
            return '🟠';
          return '⚪';
        };

        try {
          const sigmaDir = getSigmaDirectory(projectRoot);
          const queueDir = path.join(sigmaDir, 'message_queue');

          if (!fs.existsSync(queueDir)) {
            addSystemMessage(
              '📭 No agents found\n\nNo message queue directory exists yet. Agents will appear here once they connect.'
            );
            return true;
          }

          const entries = fs.readdirSync(queueDir, { withFileTypes: true });
          const agentDirs = entries.filter((e) => e.isDirectory());

          if (agentDirs.length === 0) {
            addSystemMessage(
              '📭 No agents found\n\nNo agents have connected yet.'
            );
            return true;
          }

          interface AgentDisplayInfo {
            id: string;
            alias: string;
            model: string;
            lastHeartbeat: number;
            status: string;
            isYou: boolean;
            isActive: boolean;
            projectRoot?: string;
          }

          const agents: AgentDisplayInfo[] = [];
          const now = Date.now();
          const ACTIVE_THRESHOLD = 30000;
          let currentAgent: AgentDisplayInfo | null = null;

          for (const dir of agentDirs) {
            const agentDir = path.join(queueDir, dir.name);
            const infoPath = path.join(agentDir, 'agent-info.json');

            if (!fs.existsSync(infoPath)) continue;

            try {
              const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
              const isActive =
                info.status === 'active' &&
                now - info.lastHeartbeat < ACTIVE_THRESHOLD;

              if (!isActive) continue;

              const isYou = info.agentId?.startsWith(anchorId + '-') || false;

              const agentInfo: AgentDisplayInfo = {
                id: info.agentId || dir.name,
                alias: info.alias || info.model || 'agent',
                model: info.model || 'unknown',
                lastHeartbeat: info.lastHeartbeat || 0,
                status: info.status || 'unknown',
                isYou,
                isActive,
                projectRoot: info.projectRoot,
              };

              if (isYou) currentAgent = agentInfo;
              agents.push(agentInfo);
            } catch {
              // Ignore parse errors
            }
          }

          if (agents.length === 0) {
            addSystemMessage(
              '📭 No active agents\n\nNo agents are currently connected. Start another TUI instance to see it here.'
            );
            return true;
          }

          agents.sort((a, b) => {
            if (a.isYou) return -1;
            if (b.isYou) return 1;
            return a.alias.localeCompare(b.alias);
          });

          let output = '';
          if (currentAgent) {
            const emoji = getProviderEmoji(currentAgent.model);
            const project = currentAgent.projectRoot
              ? ` [${currentAgent.projectRoot}]`
              : '';
            output += `👤 You are: ${emoji} ${currentAgent.alias} (${currentAgent.model})${project}\n`;
          }

          const otherAgents = agents.filter((a) => !a.isYou);
          if (otherAgents.length > 0) {
            output += `  🤖 Other Agents (${otherAgents.length}):\n`;
            for (const agent of otherAgents) {
              const emoji = getProviderEmoji(agent.model);
              const project = agent.projectRoot
                ? ` [${agent.projectRoot}]`
                : '';
              output += `     ${emoji} ${agent.alias} (${agent.model})${project}\n`;
            }
          } else {
            output += `  🤖 No other agents online\n`;
          }

          output += `  💬 /send <alias> <message>`;
          addSystemMessage(output);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          addSystemMessage(`❌ Error listing agents: ${errorMsg}`);
        }

        return true;
      }

      // Not a slash command or not handled here
      if (!msg.startsWith('[Pasted content')) {
        setStreamingPaste('');
      }

      return false;
    },
    [
      projectRoot,
      anchorId,
      addSystemMessage,
      originalSendMessage,
      messageQueueRef,
      messagePublisherRef,
      setStreamingPaste,
    ]
  );

  return useMemo(() => ({ handleSlashCommand }), [handleSlashCommand]);
}
