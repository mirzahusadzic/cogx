import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { render, Box, Text, useInput, useStdout, type TextProps } from 'ink';
import { ThemeProvider, extendTheme, defaultTheme } from '@inkjs/ui';
import fs from 'fs';
import path from 'path';

// Toggle mouse tracking - disable to restore native terminal text selection
const ENABLE_MOUSE_TRACKING = false;
import { OverlaysBar } from './components/OverlaysBar.js';
import { ClaudePanelAgent } from './components/ClaudePanelAgent.js';
import { InputBox } from './components/InputBox.js';
import { StatusBar } from './components/StatusBar.js';
import { SigmaInfoPanel } from './components/SigmaInfoPanel.js';
import { useAgent } from './hooks/useAgent.js';
import { useOverlays } from './hooks/useOverlays.js';
import { useToolConfirmation } from './hooks/useToolConfirmation.js';
import { useBackgroundTaskManager } from './hooks/useBackgroundTaskManager.js';
import { useOnboardingWizard } from './hooks/useOnboardingWizard.js';
import { isAuthenticationError } from './hooks/sdk/index.js';
import type { TUIMessage } from './hooks/useAgent.js';
import { MessageQueueMonitor } from '../ipc/MessageQueueMonitor.js';
import { MessageQueue } from '../ipc/MessageQueue.js';
import { MessagePublisher } from '../ipc/MessagePublisher.js';
import { BusCoordinator } from '../ipc/BusCoordinator.js';
import { getSigmaDirectory } from '../ipc/sigma-directory.js';
import type { WorkbenchHealthResult } from '../utils/workbench-detect.js';

// Custom theme with vivid AIEcho cyan spinner
const customTheme = extendTheme(defaultTheme, {
  components: {
    Spinner: {
      styles: {
        frame: (): TextProps => ({
          color: '#9ed2f5', // AIEcho accent-green-light (vivid cyan)
        }),
      },
    },
  },
});

interface CognitionTUIProps {
  pgcRoot: string;
  projectRoot: string;
  sessionId?: string;
  workbenchUrl?: string;
  sessionTokens?: number;
  maxThinkingTokens?: number;
  debug?: boolean;
  provider?: string;
  model?: string;
  displayThinking?: boolean;
  /** If true, show onboarding wizard instead of normal TUI */
  onboardingMode?: boolean;
  /** Auto-respond to agent messages without user input (default: true) */
  autoResponse?: boolean;
  /** Pre-computed workbench health result (avoids redundant health checks) */
  workbenchHealth?: WorkbenchHealthResult | null;
}

const CognitionTUI: React.FC<CognitionTUIProps> = ({
  pgcRoot,
  projectRoot,
  sessionId,
  workbenchUrl,
  sessionTokens,
  maxThinkingTokens,
  debug,
  provider,
  model,
  displayThinking = true,
  onboardingMode = false,
  autoResponse = true,
  workbenchHealth: initialWorkbenchHealth,
}) => {
  const { stdout } = useStdout();
  const [focused, setFocused] = useState(true);
  const [renderError, setRenderError] = useState<Error | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [streamingPaste, setStreamingPaste] = useState<string>('');
  const [inputLineCount, setInputLineCount] = useState(1);
  const [pendingMessageCount, setPendingMessageCount] = useState(0);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const messageQueueMonitorRef = useRef<MessageQueueMonitor | null>(null);
  const messageQueueRef = useRef<MessageQueue | null>(null);
  const messagePublisherRef = useRef<MessagePublisher | null>(null);

  // Getter for message publisher (used by agent messaging tool)
  const getMessagePublisher = useCallback(
    () => messagePublisherRef.current,
    []
  );

  // Getter for message queue (used by agent messaging tool)
  const getMessageQueue = useCallback(() => messageQueueRef.current, []);

  // Tool confirmation hook (guardrails) - must be before chatAreaHeight useMemo
  const { confirmationState, requestConfirmation, allow, deny, alwaysAllow } =
    useToolConfirmation();

  // Background task manager for async operations
  const taskManager = useBackgroundTaskManager({
    projectRoot,
    workbenchUrl:
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000',
    workbenchApiKey: process.env.WORKBENCH_API_KEY,
    debug,
  });

  const { loading } = useOverlays({ pgcRoot, workbenchUrl });

  const {
    messages,
    sendMessage: originalSendMessage,
    addSystemMessage,
    isThinking,
    error,
    tokenCount,
    interrupt,
    sigmaStats,
    avgOverlays,
    currentSessionId,
    anchorId,
    workbenchHealth,
  } = useAgent({
    sessionId,
    cwd: projectRoot, // Use project root, not .open_cognition dir
    sessionTokens, // Pass custom token threshold
    maxThinkingTokens, // Pass extended thinking token limit
    displayThinking, // Control thinking block generation
    debug, // Pass debug flag
    provider, // Pass LLM provider
    model, // Pass model name
    onRequestToolConfirmation: requestConfirmation, // Guardrail callback
    getTaskManager: taskManager.getManager, // Pass task manager getter (returns BackgroundTaskManager instance)
    getMessagePublisher, // Pass message publisher getter (for agent-to-agent messaging tool)
    getMessageQueue, // Pass message queue getter (for agent-to-agent messaging tool)
    autoResponse, // Auto-respond to agent messages (--no-auto-response disables)
    initialWorkbenchHealth, // Pre-computed health (avoids redundant /health call)
  });

  // Wrap sendMessage to clear streaming paste on regular messages
  const sendMessage = useCallback(
    async (msg: string) => {
      // Handle /send command for inter-agent messaging (display-only)
      if (msg.startsWith('/send')) {
        const args = msg.slice(5).trim(); // Remove '/send'
        const spaceIndex = args.indexOf(' ');

        if (spaceIndex === -1) {
          addSystemMessage(
            '❌ Missing message content\n\nUsage: /send <alias> <message>'
          );
          return;
        }

        const targetAliasOrId = args.slice(0, spaceIndex);
        const messageContent = args.slice(spaceIndex + 1);

        if (!messageContent.trim()) {
          addSystemMessage('❌ Message content cannot be empty');
          return;
        }

        // Resolve alias to agent ID (ONLY active agents - no fallback to disconnected)
        let targetAgentId: string | null = null;
        const sigmaDir = getSigmaDirectory(projectRoot);
        const queueDir = path.join(sigmaDir, 'message_queue');
        const ACTIVE_THRESHOLD_MS = 5000; // 5 seconds (matches heartbeat interval)
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

                // Match by alias (case-insensitive) or full agent ID
                const aliasMatch =
                  info.alias &&
                  info.alias.toLowerCase() === targetAliasOrId.toLowerCase();
                const idMatch = info.agentId === targetAliasOrId;

                // Only return ACTIVE agents
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

        // Error if agent not found (instead of silently using alias)
        if (!targetAgentId) {
          addSystemMessage(
            `❌ Agent "${targetAliasOrId}" not found\n\nUse /agents to see available agents`
          );
          return;
        }

        // Send the message using MessagePublisher
        try {
          const publisher = messagePublisherRef.current;
          if (!publisher) {
            addSystemMessage('❌ MessagePublisher not initialized');
            return;
          }

          await publisher.sendMessage(targetAgentId, messageContent);
          addSystemMessage(
            `📤 Sent to ${targetAliasOrId}: "${messageContent}"`
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          addSystemMessage(`❌ Send failed: ${errorMsg}`);
        }

        return;
      }

      // Handle /pending command to list messages (display-only)
      if (msg.trim() === '/pending') {
        try {
          const messageQueue = messageQueueRef.current;
          if (!messageQueue) {
            addSystemMessage('❌ MessageQueue not initialized');
            return;
          }

          const messages = await messageQueue.getMessages('pending');

          if (messages.length === 0) {
            addSystemMessage('📭 No pending messages');
            return;
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

            // Truncate long messages
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

        return;
      }

      // Handle /inject command to inject a specific message
      if (msg.startsWith('/inject')) {
        const messageId = msg.slice(7).trim();

        if (!messageId) {
          originalSendMessage(
            '❌ Error: Missing message ID\n\nUsage: /inject <message-id>\n\nUse `/pending` to see available messages.'
          );
          return;
        }

        try {
          const messageQueue = messageQueueRef.current;
          if (!messageQueue) {
            originalSendMessage('❌ Error: MessageQueue not initialized.');
            return;
          }

          const message = await messageQueue.getMessage(messageId);

          if (!message) {
            originalSendMessage(
              `❌ **Error: Message not found**\n\nMessage ID \`${messageId}\` does not exist in the queue.\n\nUse \`/pending\` to see available messages.`
            );
            return;
          }

          // Update status to injected
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

        return;
      }

      // Handle /inject-all command
      if (msg.trim() === '/inject-all') {
        try {
          const messageQueue = messageQueueRef.current;
          if (!messageQueue) {
            originalSendMessage('❌ Error: MessageQueue not initialized.');
            return;
          }

          const messages = await messageQueue.getMessages('pending');

          if (messages.length === 0) {
            originalSendMessage(
              '📭 **No pending messages to inject**\n\nYour message queue is empty.'
            );
            return;
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

            // Update status
            await messageQueue.updateStatus(msg.id, 'injected');
          }

          output += `---\n\n_All messages marked as injected_`;

          originalSendMessage(output);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          originalSendMessage(`❌ Error injecting messages: ${errorMsg}`);
        }

        return;
      }

      // Handle /dismiss command (display-only)
      if (msg.startsWith('/dismiss')) {
        const messageId = msg.slice(8).trim();

        if (!messageId) {
          addSystemMessage('❌ Missing message ID\n\nUsage: /dismiss <id>');
          return;
        }

        try {
          const messageQueue = messageQueueRef.current;
          if (!messageQueue) {
            addSystemMessage('❌ MessageQueue not initialized');
            return;
          }

          const message = await messageQueue.getMessage(messageId);

          if (!message) {
            addSystemMessage(`❌ Message not found: ${messageId}`);
            return;
          }

          // Update status to dismissed
          await messageQueue.updateStatus(messageId, 'dismissed');
          addSystemMessage(`🗑️ Dismissed message from ${message.from}`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          addSystemMessage(`❌ Error: ${errorMsg}`);
        }

        return;
      }

      // Handle /agents command to list active agents (display-only, not sent to agent)
      if (msg.trim() === '/agents') {
        // Provider emoji mapping (matches StatusBar)
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

          // Check if message_queue directory exists
          if (!fs.existsSync(queueDir)) {
            addSystemMessage(
              '📭 No agents found\n\nNo message queue directory exists yet. Agents will appear here once they connect.'
            );
            return;
          }

          // Get all agent directories
          const entries = fs.readdirSync(queueDir, { withFileTypes: true });
          const agentDirs = entries.filter((e) => e.isDirectory());

          if (agentDirs.length === 0) {
            addSystemMessage(
              '📭 No agents found\n\nNo agents have connected yet.'
            );
            return;
          }

          // Get stats for each agent from agent-info.json
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
          const ACTIVE_THRESHOLD = 30000; // 30 seconds
          let currentAgent: AgentDisplayInfo | null = null;

          for (const dir of agentDirs) {
            const agentDir = path.join(queueDir, dir.name);
            const infoPath = path.join(agentDir, 'agent-info.json');

            // Only show agents with agent-info.json (properly registered)
            if (!fs.existsSync(infoPath)) {
              continue;
            }

            try {
              const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
              const isActive =
                info.status === 'active' &&
                now - info.lastHeartbeat < ACTIVE_THRESHOLD;

              // Only include active agents (heartbeat within threshold)
              if (!isActive) {
                continue;
              }

              // Check if this is "you" by matching anchor ID pattern
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

              if (isYou) {
                currentAgent = agentInfo;
              }

              agents.push(agentInfo);
            } catch {
              // Ignore parse errors
            }
          }

          if (agents.length === 0) {
            addSystemMessage(
              '📭 No active agents\n\nNo agents are currently connected. Start another TUI instance to see it here.'
            );
            return;
          }

          // Sort by alias (for consistent ordering), but put "you" first
          agents.sort((a, b) => {
            if (a.isYou) return -1;
            if (b.isYou) return 1;
            return a.alias.localeCompare(b.alias);
          });

          // Build clean output (note: system messages get • prefix automatically)
          let output = '';

          // Show current agent identity prominently
          if (currentAgent) {
            const emoji = getProviderEmoji(currentAgent.model);
            const project = currentAgent.projectRoot
              ? ` [${currentAgent.projectRoot}]`
              : '';
            output += `👤 You are: ${emoji} ${currentAgent.alias} (${currentAgent.model})${project}\n`;
          }

          // List other agents
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

        return;
      }

      // Clear streaming paste when sending a regular message
      if (!msg.startsWith('[Pasted content')) {
        setStreamingPaste('');
      }
      originalSendMessage(msg);
    },
    [
      originalSendMessage,
      addSystemMessage,
      currentSessionId,
      projectRoot,
      anchorId,
    ]
  );

  // Onboarding wizard (async, non-blocking) - must be after sendMessage
  const wizard = useOnboardingWizard({
    taskManager,
    projectRoot,
    autoStart: onboardingMode,
    debug,
    onSendMessage: sendMessage, // Allow wizard to execute slash commands
  });

  // Calculate fixed chat area height to prevent InputBox from shifting
  // when messages populate - memoize to avoid recalculation on every render
  const chatAreaHeight = useMemo(() => {
    const terminalHeight = stdout?.rows || 24;
    // Dynamic reserved space: expand when dropdown OR confirmation modal is visible
    // OverlaysBar(1) + separator(1) + separator(1) + InputBox+Dropdown/Modal(variable) + separator(1) + saveMessage(1) + StatusBar(3)
    // Dropdown needs more space (9 lines) than confirmation modal (5 lines)
    // Wizard selection mode needs more space based on items count
    const wizardSelectHeight =
      wizard.confirmationState?.mode === 'select' &&
      wizard.confirmationState.items
        ? Math.min(wizard.confirmationState.items.length + 4, 12) // items + header/footer, max 12
        : 0;
    const inputAndDropdownHeight = isDropdownVisible
      ? 9 // Dropdown is tall (command list)
      : wizardSelectHeight > 0
        ? wizardSelectHeight // Wizard selection
        : confirmationState?.pending || wizard.confirmationState?.pending
          ? 5 // Confirmation modal is compact (just 2-3 lines)
          : 1; // Just input when nothing is open
    const reservedHeight = 3 + inputAndDropdownHeight + 5; // 3 top + input area + 5 bottom
    return Math.max(5, terminalHeight - reservedHeight); // Minimum 5 lines for chat
  }, [
    stdout?.rows,
    isDropdownVisible,
    confirmationState?.pending,
    wizard.confirmationState,
  ]);

  // Add Ctrl+C handler and optionally enable mouse tracking
  useEffect(() => {
    // Add direct SIGINT handler for Ctrl+C - use 'once' to ensure it only fires once
    const sigintHandler = () => {
      try {
        process.stdout.write('\x1b[0m'); // Reset colors
        if (ENABLE_MOUSE_TRACKING) {
          process.stdout.write('\x1b[?1000l\x1b[?1006l'); // Disable mouse
        }
      } catch (e) {
        // Ignore errors during cleanup
        console.error(
          `Cleanup error: ${e instanceof Error ? e.message : String(e)}`
        );
      }
      // Kill the entire process group to ensure workers die too
      // SIGKILL (-9) is unblockable and immediate
      try {
        process.kill(-process.pid, 'SIGKILL');
      } catch (e) {
        // If that fails, use abort as fallback
        console.error(
          `Process kill error: ${e instanceof Error ? e.message : String(e)}`
        );
        process.abort();
      }
    };

    // Use 'once' instead of 'on' to prevent multiple firings
    process.once('SIGINT', sigintHandler);

    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      // Enable bracketed paste mode (always on)
      // 2004 = Bracketed paste mode (pastes wrapped with \x1b[200~ and \x1b[201~)
      process.stdout.write('\x1b[?2004h');

      if (ENABLE_MOUSE_TRACKING) {
        // Enable mouse scroll tracking
        // 1000 = Basic mouse tracking (needed for scroll wheel events)
        // 1006 = SGR mouse mode (better coordinate encoding)
        process.stdout.write('\x1b[?1000h'); // Basic mouse tracking (clicks + scroll)
        process.stdout.write('\x1b[?1006h'); // SGR encoding (position-aware)
      }

      return () => {
        // Disable bracketed paste
        process.stdout.write('\x1b[?2004l');

        if (ENABLE_MOUSE_TRACKING) {
          // Disable mouse tracking on cleanup
          process.stdout.write('\x1b[?1000l');
          process.stdout.write('\x1b[?1006l');
        }
        // Reset colors on exit
        process.stdout.write('\x1b[0m');
      };
    }

    return () => {
      // Reset colors on exit
      process.stdout.write('\x1b[0m');
    };
  }, []);

  // Error boundary - catch render errors
  useEffect(() => {
    // Skip in Node.js environment (Ink runs in Node, not browser)
    if (typeof window === 'undefined') {
      return;
    }
    const errorHandler = (err: ErrorEvent) => {
      setRenderError(err.error);
    };
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  // Graceful exit on OAuth token expiration
  useEffect(() => {
    if (error) {
      // Debug: log the actual error to help diagnose OAuth detection issues
      if (debug) {
        console.error('[TUI Debug] Error detected:', error);
        console.error(
          '[TUI Debug] Is auth error?',
          isAuthenticationError([error])
        );
      }

      if (isAuthenticationError([error])) {
        const sessionStateFile = sessionId
          ? path.join(projectRoot, '.sigma', `${sessionId}.state.json`)
          : 'session state file';

        // Display error message
        console.error(
          '\n\n╔════════════════════════════════════════════════════════════════════════════╗'
        );
        console.error(
          '║                     OAuth Token Expired                                    ║'
        );
        console.error(
          '╚════════════════════════════════════════════════════════════════════════════╝\n'
        );
        console.error(
          '  Your OAuth token has expired and the TUI must exit.\n'
        );
        console.error('  📝 Your session has been saved automatically.\n');
        console.error('  To continue:\n');
        console.error('  1. Run: claude /login');
        console.error(
          '  2. Restart with: cognition tui --file ' + sessionStateFile + '\n'
        );
        console.error('  Press any key to exit...\n');

        // Clean up and exit after user presses a key or 5 seconds
        let exited = false;
        const cleanup = () => {
          if (exited) return;
          exited = true;
          try {
            process.stdout.write('\x1b[0m'); // Reset colors
            process.stdout.write('\x1b[?1000l\x1b[?1006l'); // Disable mouse
          } catch (e) {
            // Ignore cleanup errors
            console.error(
              `Cleanup error: ${e instanceof Error ? e.message : String(e)}`
            );
          }
          process.exit(1);
        };

        // Exit on any key press
        const keyHandler = () => cleanup();
        process.stdin.once('data', keyHandler);

        // Auto-exit after 5 seconds
        const timeout = setTimeout(cleanup, 5000);

        return () => {
          clearTimeout(timeout);
          process.stdin.removeListener('data', keyHandler);
        };
      }
    }
  }, [error, sessionId, projectRoot]);

  // Initialize MessageQueueMonitor when anchor starts
  // Use a ref to prevent double initialization
  // anchorId is stable (doesn't change during compression), unlike currentSessionId
  const monitorInitializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!anchorId || !projectRoot) {
      return;
    }

    // Prevent double initialization for the same anchor
    if (monitorInitializedRef.current === anchorId) {
      return;
    }

    // If we have a different anchor, clean up the old one first
    if (
      messageQueueMonitorRef.current &&
      monitorInitializedRef.current !== anchorId
    ) {
      messageQueueMonitorRef.current.stop().catch(() => {});
      messageQueueMonitorRef.current = null;
      messagePublisherRef.current = null;
      messageQueueRef.current = null;
    }

    monitorInitializedRef.current = anchorId;

    let mounted = true;
    let cleanupFn: (() => void) | null = null;

    const initializeMonitor = async () => {
      try {
        // Use anchor ID as agent ID for message routing (stable across session compression)
        const agentId = anchorId;
        const sigmaDir = getSigmaDirectory(projectRoot);

        // Initialize ZeroMQ bus using BusCoordinator
        // This will either start a new Bus Master or connect to existing one
        // Pass projectRoot to create project-specific bus when IPC_SIGMA_BUS is not set
        const coordinator = new BusCoordinator(projectRoot);
        const bus = await coordinator.connectWithFallback();

        if (!mounted) return;

        // Topics to subscribe to
        const topics = ['agent.command', 'agent.notification', 'agent.message'];

        // Create and start monitor
        // Pass model to monitor for alias generation (use model prop or extract from provider)
        const modelName = model || provider || 'agent';
        const monitor = new MessageQueueMonitor(
          agentId,
          bus,
          topics,
          sigmaDir,
          modelName,
          projectRoot // Pass projectRoot for cross-project agent discovery
        );
        await monitor.start();

        if (!mounted) {
          await monitor.stop();
          return;
        }

        // Store monitor instance for cleanup
        messageQueueMonitorRef.current = monitor;

        // Create MessagePublisher for sending messages to other agents
        // Use the monitor's actual agent ID (with suffix) so replies go to the right queue
        const monitorAgentId = monitor.getQueue().getAgentId();
        const publisher = new MessagePublisher(bus, monitorAgentId);
        messagePublisherRef.current = publisher;

        // Use the monitor's queue instance for event-driven updates
        // This ensures /pending reads from the same queue where messages are delivered
        const messageQueue = monitor.getQueue();
        messageQueueRef.current = messageQueue;

        // Subscribe to count changes via event emitter
        const handleCountChanged = (...args: unknown[]) => {
          const count = args[0] as number;
          setPendingMessageCount(count);
        };

        messageQueue.on('countChanged', handleCountChanged);

        // Get initial count
        const initialCount = await messageQueue.getPendingCount();
        setPendingMessageCount(initialCount);

        // Clear any previous errors
        setMonitorError(null);

        // Store cleanup function
        cleanupFn = () => {
          messageQueue.off('countChanged', handleCountChanged);
          monitor.stop().catch((err) => {
            if (debug) {
              console.error('[MessageQueueMonitor] Stop error:', err);
            }
          });
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMonitorError(`Failed to initialize message monitor: ${errorMsg}`);
        if (debug) {
          console.error('[MessageQueueMonitor] Initialization error:', err);
        }
      }
    };

    initializeMonitor();

    return () => {
      mounted = false;
      if (cleanupFn) cleanupFn();
    };
  }, [anchorId, projectRoot, debug, model, provider]);

  // Handle pasted content - stream it line by line
  const handlePasteContent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (content: string, filepath: string) => {
      const lines = content.split('\n');
      let currentLine = 0;

      // Stream lines rapidly
      const streamInterval = setInterval(() => {
        if (currentLine < lines.length) {
          const displayedLines = lines.slice(0, currentLine + 1).join('\n');
          setStreamingPaste(displayedLines);
          currentLine++;
        } else {
          // Streaming complete
          clearInterval(streamInterval);
          setStreamingPaste('');
          // Send the actual content (it's already in memory, no need to reference file)
          sendMessage(content);
        }
      }, 5); // 5ms per line = very fast streaming
    },
    [sendMessage]
  );

  // Save conversation log to file
  const saveConversationLog = () => {
    try {
      const sigmaDir = getSigmaDirectory(projectRoot);
      fs.mkdirSync(sigmaDir, { recursive: true });

      const providerName = provider || 'gemini'; // Default to 'gemini'
      const logFileName = sessionId
        ? `${sessionId}-${providerName}-magic.log`
        : `session-${Date.now()}-${providerName}-magic.log`;
      const logPath = path.join(sigmaDir, logFileName);

      // Format messages for log
      const logContent = messages
        .map((msg: TUIMessage) => {
          const timestamp = msg.timestamp.toISOString();
          const type = msg.type.toUpperCase().padEnd(9);
          const separator = '='.repeat(80);
          return `${separator}\n[${timestamp}] ${type}\n${separator}\n${msg.content}\n`;
        })
        .join('\n');

      fs.writeFileSync(logPath, logContent, 'utf-8');

      setSaveMessage(
        `💾 Saved ${messages.length} messages to .sigma/${logFileName}`
      );
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage(`❌ Save failed: ${(err as Error).message}`);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // Handle input - make sure this is always active for Ctrl+C
  useInput(
    (input, key) => {
      // Debug: Log all ESC key presses
      if (key.escape && process.env.DEBUG_ESC_INPUT) {
        console.error(
          '[TUI.useInput] ESC pressed, confirmationPending:',
          confirmationState?.pending,
          'isThinking:',
          isThinking
        );
      }

      // PRIORITY 1: Handle tool confirmation modal keyboard input FIRST
      if (confirmationState?.pending) {
        if (input === 'y' || input === 'Y') {
          allow();
          return;
        } else if (input === 'n' || input === 'N') {
          deny();
          return;
        } else if (input === 'a' || input === 'A') {
          alwaysAllow();
          return;
        } else if (key.escape) {
          deny();
          return;
        }
        // Ignore all other input when modal is active
        return;
      }

      // PRIORITY 1.5: Handle wizard modal keyboard input
      if (wizard.confirmationState?.pending) {
        const isSelectMode = wizard.confirmationState.mode === 'select';

        if (process.env.DEBUG_WIZARD || process.env.DEBUG_ESC_INPUT) {
          console.error(
            '[TUI] Wizard modal active, mode:',
            wizard.confirmationState.mode,
            'input:',
            JSON.stringify(input),
            'input.length:',
            input?.length,
            'key:',
            Object.keys(key).filter((k) => key[k as keyof typeof key])
          );
        }

        if (isSelectMode) {
          // Selection mode: arrow/space/enter
          if (key.upArrow) {
            wizard.moveUp();
            return;
          } else if (key.downArrow) {
            wizard.moveDown();
            return;
          } else if (input === ' ') {
            if (process.env.DEBUG_WIZARD) {
              console.error('[TUI] Space pressed, toggling selection');
            }
            wizard.toggleSelection();
            return;
          } else if (key.return) {
            wizard.confirm();
            return;
          } else if (key.escape) {
            if (process.env.DEBUG_WIZARD || process.env.DEBUG_ESC_INPUT) {
              console.error('[TUI] ESC pressed, calling wizard.cancel()');
            }
            wizard.cancel();
            return;
          }
        } else {
          // Confirm mode: Y/N
          if (input === 'y' || input === 'Y') {
            wizard.confirm();
            return;
          } else if (input === 'n' || input === 'N') {
            wizard.skip();
            return;
          } else if (key.escape) {
            wizard.cancel();
            return;
          }
        }
        // Ignore all other input when wizard modal is active
        return;
      }

      // PRIORITY 2: ESC to abort agent (only when thinking)
      if (key.escape && isThinking) {
        if (process.env.DEBUG_ESC_INPUT) {
          console.error(
            '[TUI.useInput] Calling interrupt() - isThinking:',
            isThinking
          );
        }
        interrupt();
        return;
      }

      // PRIORITY 3: Global keyboard shortcuts (only when modal NOT active)
      if (key.ctrl && input === 'c') {
        // Force immediate exit - kill entire process group including workers
        try {
          process.stdout.write('\x1b[0m'); // Reset colors
          if (ENABLE_MOUSE_TRACKING) {
            process.stdout.write('\x1b[?1000l\x1b[?1006l'); // Disable mouse
          }
        } catch (e) {
          // Ignore errors
          console.error(
            `Cleanup error: ${e instanceof Error ? e.message : String(e)}`
          );
        }
        // Kill process group to ensure workers die
        try {
          process.kill(-process.pid, 'SIGKILL');
        } catch (e) {
          console.error(
            `Process kill error: ${e instanceof Error ? e.message : String(e)}`
          );
          process.abort(); // Fallback if process group kill fails
        }
      } else if (key.ctrl && input === 's') {
        // Save conversation log with Ctrl+S
        saveConversationLog();
      } else if (key.ctrl && input === 'w') {
        // Restart/resume onboarding wizard with Ctrl+W
        wizard.startWizard();
      } else if (key.tab) {
        // Toggle focus between input and panel
        setFocused((prev) => !prev);
      } else if (
        input === 'i' &&
        !key.ctrl &&
        !key.shift &&
        !key.meta &&
        !focused
      ) {
        // Toggle info panel with 'i' key (only when NOT in input box)
        setShowInfoPanel((prev) => !prev);
      }
      // Note: Arrow keys, etc. are handled by TextInput component
      // We just need to not interfere with them
    },
    { isActive: true }
  );

  if (renderError) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderColor="red" borderStyle="single" padding={1}>
          <Text color="red">💥 Render Error (Hot reload will fix this):</Text>
        </Box>
        <Box paddingTop={1}>
          <Text>{renderError.message}</Text>
        </Box>
        <Box paddingTop={1}>
          <Text dimColor>
            {renderError.stack?.split('\n').slice(0, 5).join('\n')}
          </Text>
        </Box>
      </Box>
    );
  }

  // Old synchronous wizard removed - now using async wizard with useOnboardingWizard hook
  // The wizard runs inside the live TUI via wizard.confirmationState and WizardConfirmationModal

  if (loading) {
    return (
      <Box>
        <Text>Loading overlays...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Box borderStyle="single" borderColor="red" padding={1}>
          <Text>Error: {error}</Text>
        </Box>
      </Box>
    );
  }

  try {
    return (
      <ThemeProvider theme={customTheme}>
        <Box
          flexDirection="column"
          width="100%"
          height="100%"
          paddingTop={0}
          marginTop={0}
        >
          <OverlaysBar
            sigmaStats={sigmaStats}
            activeTask={taskManager.activeTask}
            pendingMessageCount={pendingMessageCount}
            monitorError={monitorError}
            workbenchHealth={workbenchHealth ?? undefined}
          />
          <Text color="#3a3f4b">
            {'─'.repeat(process.stdout.columns || 80)}
          </Text>
          <Box
            height={chatAreaHeight}
            width="100%"
            overflow="hidden"
            flexDirection="row"
          >
            <ClaudePanelAgent
              messages={
                displayThinking
                  ? messages
                  : messages.filter((m) => m.type !== 'thinking')
              }
              isThinking={isThinking}
              focused={!focused}
              streamingPaste={streamingPaste}
            />
            {showInfoPanel && sigmaStats && (
              <Box marginLeft={1}>
                <SigmaInfoPanel
                  sigmaStats={sigmaStats}
                  overlays={avgOverlays}
                />
              </Box>
            )}
          </Box>

          {/* Reserved space for dropdown/confirmation - dynamically sized based on visibility */}
          <Box
            height={(() => {
              const wizardSelectHeight =
                wizard.confirmationState?.mode === 'select' &&
                wizard.confirmationState.items
                  ? Math.min(wizard.confirmationState.items.length + 4, 12)
                  : 0;
              if (isDropdownVisible) return 9 + inputLineCount + 2;
              if (wizardSelectHeight > 0)
                return wizardSelectHeight + inputLineCount + 2;
              if (
                confirmationState?.pending ||
                wizard.confirmationState?.pending
              )
                return 5 + inputLineCount + 2;
              return inputLineCount + 2;
            })()}
            flexDirection="column"
            justifyContent="flex-end"
          >
            <InputBox
              onSubmit={sendMessage}
              focused={focused}
              disabled={isThinking}
              onInterrupt={interrupt}
              onDropdownVisibleChange={setIsDropdownVisible}
              onPasteContent={handlePasteContent}
              onInputChange={(value: string) =>
                setInputLineCount(value.split('\n').length)
              }
              providerName={provider}
              confirmationState={confirmationState}
              wizardConfirmationState={wizard.confirmationState}
            />
          </Box>
          {/* Always reserve space for save message to prevent layout shift */}
          <Box height={1}>
            {saveMessage && <Text color="green">{saveMessage}</Text>}
          </Box>
          <StatusBar
            sessionId={currentSessionId}
            focused={focused}
            tokenCount={tokenCount}
            compressionThreshold={sessionTokens}
            providerName={provider}
            modelId={model}
          />
        </Box>
      </ThemeProvider>
    );
  } catch (err) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderColor="red" borderStyle="single" padding={1}>
          <Text color="red">💥 Caught Error (Hot reload will fix this):</Text>
        </Box>
        <Box paddingTop={1}>
          <Text>{(err as Error).message}</Text>
        </Box>
      </Box>
    );
  }
};

/**
 * Start the TUI
 */
export function startTUI(options: CognitionTUIProps) {
  // Set up global error handlers for uncaught errors
  const handleUncaughtError = (error: Error) => {
    console.error('\n[TUI] Uncaught error:', error.message);
    if (options.debug) {
      console.error('[TUI] Stack trace:', error.stack);
    }

    // Check if it's an OAuth error
    if (isAuthenticationError([error.message])) {
      console.error(
        '\n\n╔════════════════════════════════════════════════════════════════════════════╗'
      );
      console.error(
        '║                     OAuth Token Expired                                    ║'
      );
      console.error(
        '╚════════════════════════════════════════════════════════════════════════════╝\n'
      );
      console.error('  Your OAuth token has expired.\n');
      console.error('  Please run: claude /login\n');
    }

    process.exit(1);
  };

  // Catch unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    handleUncaughtError(error);
  });

  // Catch uncaught exceptions
  process.on('uncaughtException', handleUncaughtError);

  const { unmount, waitUntilExit } = render(<CognitionTUI {...options} />, {
    debug: false,
    maxFps: 120, // Higher FPS for smoother rendering and less visible flicker
  });

  // Only handle SIGTERM gracefully (kill command)
  // SIGINT (Ctrl+C) is handled inside the component with immediate kill
  const cleanup = () => {
    unmount();
  };

  process.on('SIGTERM', cleanup);

  return waitUntilExit();
}
