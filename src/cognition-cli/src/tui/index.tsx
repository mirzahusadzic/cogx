import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { render, Box, Text, useInput, type TextProps } from 'ink';
import { ThemeProvider, extendTheme, defaultTheme } from '@inkjs/ui';
import fs from 'fs';
import path from 'path';
import { logEmitter, LogEvent, systemLog } from '../utils/debug-logger.js';

// Toggle mouse tracking - disable to restore native terminal text selection
const ENABLE_MOUSE_TRACKING = false;
import { cleanAnsi } from '../utils/string-utils.js';
import { CognitionTUILayout } from './components/CognitionTUILayout.js';
import { useAgent } from './hooks/useAgent.js';
import { useOverlays } from './hooks/useOverlays.js';
import { useToolConfirmation } from './hooks/useToolConfirmation.js';
import { useBackgroundTaskManager } from './hooks/useBackgroundTaskManager.js';
import { useOnboardingWizard } from './hooks/useOnboardingWizard.js';
import { useSlashCommands } from './hooks/useSlashCommands.js';
import { useMessageMonitor } from './hooks/useMessageMonitor.js';
import { TUIProvider, useTUI } from './context/TUIContext.js';
import { AgentProvider, useAgentContext } from './contexts/AgentContext.js';
import { terminal } from './services/index.js';
import { isAuthenticationError } from './hooks/sdk/index.js';
import type { TUIMessage } from './hooks/useAgent.js';
import { MessageQueueMonitor } from '../ipc/MessageQueueMonitor.js';
import { MessageQueue } from '../ipc/MessageQueue.js';
import { MessagePublisher } from '../ipc/MessagePublisher.js';
import { getSigmaDirectory } from '../ipc/sigma-directory.js';
import type { WorkbenchHealthResult } from '../utils/workbench-detect.js';
import { TUITheme } from './theme.js';

// Custom theme with vivid AIEcho cyan spinner
const customTheme = extendTheme(defaultTheme, {
  components: {
    Spinner: {
      styles: {
        frame: (): TextProps => ({
          color: TUITheme.overlays.o7_strategic, // AIEcho accent-green-light (vivid cyan)
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
  solo?: boolean;
  taskLogEvictionThreshold?: number;
  displayThinking?: boolean;
  /** If true, show onboarding wizard instead of normal TUI */
  onboardingMode?: boolean;
  /** Auto-respond to agent messages without user input (default: true) */
  autoResponse?: boolean;
  /** Pre-computed workbench health result (avoids redundant health checks) */
  workbenchHealth?: WorkbenchHealthResult | null;
}

/**
 * Controller component for the TUI that handles interactions and integration.
 * This component runs inside the AgentProvider and can consume AgentContext.
 */
import { type UseBackgroundTaskManagerResult } from './hooks/useBackgroundTaskManager.js';
import { type ToolConfirmationState } from './hooks/useToolConfirmation.js';

// ...
export const CognitionTUIController: React.FC<{
  projectRoot: string;
  onboardingMode: boolean;
  model?: string;
  provider?: string;
  displayThinking: boolean;
  solo: boolean;
  sessionTokens?: number;
  taskManager: UseBackgroundTaskManagerResult;
  confirmationState: ToolConfirmationState | null;
  allow: () => void;
  deny: () => void;
  alwaysAllow: () => void;
  messageQueueRef: React.RefObject<MessageQueue | null>;
  messagePublisherRef: React.RefObject<MessagePublisher | null>;
  messageQueueMonitorRef: React.RefObject<MessageQueueMonitor | null>;
}> = ({
  projectRoot,
  onboardingMode,
  model,
  provider,
  displayThinking,
  solo,
  sessionTokens,
  taskManager,
  confirmationState,
  allow,
  deny,
  alwaysAllow,
  messageQueueRef,
  messagePublisherRef,
  messageQueueMonitorRef,
}) => {
  const {
    state: tuiState,
    toggleFocus,
    toggleInfoPanel,
    toggleTaskPanel,
    setSaveMessage,
    setIsDropdownVisible,
    setStreamingPaste,
    setInputLineCount,
  } = useTUI();

  const {
    focused,
    showInfoPanel,
    showTaskPanel,
    saveMessage,
    streamingPaste,
    inputLineCount,
    isDropdownVisible,
  } = tuiState;

  const agent = useAgentContext();
  const {
    messages,
    sendMessage: originalSendMessage,
    addSystemMessage,
    isThinking,
    retryCount,
    activeModel,
    error,
    tokenCount,
    sessionTokenCount,
    interrupt,
    sigmaStats,
    avgOverlays,
    currentSessionId,
    anchorId,
    workbenchHealth,
    sigmaTasks,
    options: { debug, sessionId },
  } = agent;

  const { pendingMessageCount, monitorError } = useMessageMonitor({
    anchorId: anchorId || null,
    projectRoot,
    debug,
    model,
    provider,
    messageQueueMonitorRef,
    messageQueueRef,
    messagePublisherRef,
  });

  const { handleSlashCommand } = useSlashCommands({
    projectRoot,
    anchorId: anchorId || null,
    addSystemMessage,
    originalSendMessage,
    messageQueueRef,
    messagePublisherRef,
    setStreamingPaste,
  });

  // Wrap sendMessage to clear streaming paste on regular messages
  const sendMessage = useCallback(
    async (msg: string) => {
      const handled = await handleSlashCommand(msg);
      if (!handled) {
        originalSendMessage(msg);
      }
    },
    [handleSlashCommand, originalSendMessage]
  );

  // Onboarding wizard (async, non-blocking) - must be after sendMessage
  const wizard = useOnboardingWizard({
    taskManager,
    projectRoot,
    autoStart: onboardingMode,
    debug,
    onSendMessage: sendMessage, // Allow wizard to execute slash commands
  });

  // Handle pasted content - stream it line by line
  const handlePasteContent = useCallback(
    (content: string) => {
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
          // Send the actual content
          sendMessage(content);
        }
      }, 5);
    },
    [sendMessage, setStreamingPaste]
  );

  // Save conversation log to file
  const saveConversationLog = useCallback(() => {
    try {
      const sigmaDir = getSigmaDirectory(projectRoot);
      fs.mkdirSync(sigmaDir, { recursive: true });

      const providerName = provider || 'gemini';
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
          return `${separator}\n[${timestamp}] ${type}\n${separator}\n${cleanAnsi(msg.content)}\n`;
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
  }, [projectRoot, messages, sessionId, provider, setSaveMessage]);

  // Handle input
  useInput(
    (input, key) => {
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
        return;
      }

      // PRIORITY 1.5: Handle wizard modal keyboard input
      if (wizard.confirmationState?.pending) {
        const isSelectMode = wizard.confirmationState.mode === 'select';
        if (isSelectMode) {
          if (key.upArrow) {
            wizard.moveUp();
            return;
          } else if (key.downArrow) {
            wizard.moveDown();
            return;
          } else if (input === ' ') {
            wizard.toggleSelection();
            return;
          } else if (key.return) {
            wizard.confirm();
            return;
          } else if (key.escape) {
            wizard.cancel();
            return;
          }
        } else {
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
        return;
      }

      // PRIORITY 2: ESC to abort agent (only when thinking)
      if (key.escape && isThinking) {
        interrupt();
        return;
      }

      // PRIORITY 3: Global keyboard shortcuts
      if (key.ctrl && input === 'c') {
        terminal.forceKill();
      } else if (key.ctrl && input === 's') {
        saveConversationLog();
      } else if (key.ctrl && input === 'w') {
        wizard.startWizard();
      } else if (key.tab) {
        toggleFocus();
      } else if (key.ctrl && input === 'p') {
        toggleInfoPanel();
      } else if (key.ctrl && input === 't') {
        toggleTaskPanel();
      } else if (
        input === 'i' &&
        !key.ctrl &&
        !key.shift &&
        !key.meta &&
        !focused
      ) {
        toggleInfoPanel();
      } else if (
        input === 't' &&
        !key.ctrl &&
        !key.shift &&
        !key.meta &&
        !focused
      ) {
        toggleTaskPanel();
      }
    },
    { isActive: true }
  );

  // Subscribe to system logs for TUI display
  useEffect(() => {
    const logHandler = (event: LogEvent) => {
      if (event.level !== 'error') return;

      let content = `[${event.level.toUpperCase()}]`;
      if (event.source) content += ` [${event.source}]`;
      content += ` ${event.message}`;
      if (event.data) {
        try {
          const dataString = JSON.stringify(event.data, null, 2);
          content += `\n${dataString.split('\n').slice(0, 3).join('\n')}`;
          if (dataString.split('\n').length > 3) content += '...';
        } catch {
          content += ' [Unserializable data]';
        }
      }
      addSystemMessage(content);
    };

    logEmitter.on('log', logHandler);
    return () => {
      logEmitter.off('log', logHandler);
    };
  }, [addSystemMessage]);

  // Graceful exit on OAuth token expiration
  useEffect(() => {
    if (error && isAuthenticationError([error])) {
      const sessionStateFile = sessionId
        ? path.join(projectRoot, '.sigma', `${sessionId}.state.json`)
        : 'session state file';

      const authErrorMessage = [
        '\n\n╔════════════════════════════════════════════════════════════════════════════╗',
        '║                     Authentication Failed                                  ║',
        '╚════════════════════════════════════════════════════════════════════════════╝\n',
        '  Your API key is invalid or has expired and the TUI must exit.\n',
        '  📝 Your session has been saved automatically.\n',
        '  To continue:\n',
        '  1. Check your API key environment variable (e.g. ANTHROPIC_API_KEY)',
        '  2. Restart with: cognition tui --file ' + sessionStateFile + '\n',
        '  Press any key to exit...\n',
      ].join('\n');

      systemLog('tui', authErrorMessage, {}, 'error');

      let exited = false;
      const cleanup = () => {
        if (exited) return;
        exited = true;
        try {
          terminal.cleanup();
        } catch {
          // Ignore cleanup errors
        }
        process.exit(1);
      };

      process.stdin.once('data', cleanup);
      const timeout = setTimeout(cleanup, 5000);

      return () => {
        clearTimeout(timeout);
        process.stdin.removeListener('data', cleanup);
      };
    }
  }, [error, sessionId, projectRoot]);

  return (
    <CognitionTUILayout
      sigmaStats={sigmaStats}
      activeTask={taskManager.activeTask}
      pendingMessageCount={pendingMessageCount}
      monitorError={monitorError}
      workbenchHealth={workbenchHealth}
      messages={messages}
      isThinking={isThinking}
      retryCount={retryCount}
      model={activeModel || model}
      focused={focused}
      streamingPaste={streamingPaste}
      showInfoPanel={showInfoPanel}
      showTaskPanel={showTaskPanel}
      avgOverlays={avgOverlays}
      saveMessage={saveMessage}
      currentSessionId={currentSessionId}
      tokenCount={tokenCount}
      sessionTokenCount={sessionTokenCount}
      sigmaTasks={sigmaTasks}
      sessionTokens={sessionTokens}
      provider={provider}
      displayThinking={displayThinking}
      confirmationState={confirmationState}
      wizardConfirmationState={wizard.confirmationState}
      sendMessage={sendMessage}
      interrupt={interrupt}
      setIsDropdownVisible={setIsDropdownVisible}
      handlePasteContent={handlePasteContent}
      setInputLineCount={setInputLineCount}
      inputLineCount={inputLineCount}
      isDropdownVisible={isDropdownVisible}
      cwd={process.cwd()}
      solo={solo}
    />
  );
};

export const CognitionTUI: React.FC<CognitionTUIProps> = ({
  pgcRoot,
  projectRoot,
  sessionId,
  workbenchUrl,
  sessionTokens,
  maxThinkingTokens,
  debug,
  provider,
  model,
  solo,
  taskLogEvictionThreshold,
  displayThinking = true,
  onboardingMode = false,
  autoResponse = true,
  workbenchHealth: initialWorkbenchHealth,
}) => {
  const { setRenderError } = useTUI();

  const messageQueueMonitorRef = useRef<MessageQueueMonitor | null>(null);
  const messageQueueRef = useRef<MessageQueue | null>(null);
  const messagePublisherRef = useRef<MessagePublisher | null>(null);

  const getMessagePublisher = useCallback(
    () => messagePublisherRef.current,
    []
  );
  const getMessageQueue = useCallback(() => messageQueueRef.current, []);

  const { confirmationState, requestConfirmation, allow, deny, alwaysAllow } =
    useToolConfirmation();

  const taskManager = useBackgroundTaskManager({
    projectRoot,
    workbenchUrl:
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000',
    workbenchApiKey: process.env.WORKBENCH_API_KEY,
    debug,
  });

  const { loading } = useOverlays({ pgcRoot, workbenchUrl });

  const agentOptions = useMemo(
    () => ({
      sessionId,
      cwd: projectRoot,
      sessionTokens,
      maxThinkingTokens,
      displayThinking,
      debug,
      provider,
      model,
      solo: solo || false,
      onRequestToolConfirmation: requestConfirmation,
      getTaskManager: taskManager.getManager,
      getMessagePublisher,
      getMessageQueue,
      autoResponse,
      initialWorkbenchHealth,
      taskLogEvictionThreshold,
    }),
    [
      sessionId,
      projectRoot,
      sessionTokens,
      maxThinkingTokens,
      displayThinking,
      debug,
      provider,
      model,
      solo,
      requestConfirmation,
      taskManager.getManager,
      getMessagePublisher,
      getMessageQueue,
      autoResponse,
      initialWorkbenchHealth,
      taskLogEvictionThreshold,
    ]
  );

  const agent = useAgent(agentOptions);

  useEffect(() => {
    const sigintHandler = () => terminal.forceKill();
    process.once('SIGINT', sigintHandler);

    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      terminal.setBracketedPaste(true);
      terminal.setCursorVisibility(false);
      if (ENABLE_MOUSE_TRACKING) terminal.setMouseTracking(true);
      return () => terminal.cleanup();
    }
    return () => terminal.resetColors();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const errorHandler = (err: ErrorEvent) => setRenderError(err.error);
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, [setRenderError]);

  if (loading) {
    return (
      <Box height="100%" alignItems="center" justifyContent="center">
        <Text>Loading overlays...</Text>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={customTheme}>
      <AgentProvider options={agent.options} state={agent.state}>
        <CognitionTUIController
          projectRoot={projectRoot}
          onboardingMode={onboardingMode}
          model={model}
          provider={provider}
          displayThinking={displayThinking}
          solo={solo || false}
          sessionTokens={sessionTokens}
          taskManager={taskManager}
          confirmationState={confirmationState}
          allow={allow}
          deny={deny}
          alwaysAllow={alwaysAllow}
          messageQueueRef={messageQueueRef}
          messagePublisherRef={messagePublisherRef}
          messageQueueMonitorRef={messageQueueMonitorRef}
        />
      </AgentProvider>
    </ThemeProvider>
  );
};

export function startTUI(options: CognitionTUIProps) {
  const handleUncaughtError = (error: Error) => {
    systemLog(
      'tui',
      '[TUI] Uncaught error',
      { message: error.message },
      'error'
    );
    if (options.debug)
      systemLog('tui', '[TUI] Stack trace', { stack: error.stack }, 'error');

    if (isAuthenticationError([error.message])) {
      systemLog(
        'tui',
        '\n\n╔════════════════════════════════════════════════════════════════════════════╗',
        {},
        'error'
      );
      systemLog(
        'tui',
        '║                     Authentication Failed                                  ║',
        {},
        'error'
      );
      systemLog(
        'tui',
        '╚════════════════════════════════════════════════════════════════════════════╝\n',
        {},
        'error'
      );
    }
    terminal.cleanup();
    process.exit(1);
  };

  process.on('unhandledRejection', (reason) => {
    handleUncaughtError(
      reason instanceof Error ? reason : new Error(String(reason))
    );
  });
  process.on('uncaughtException', handleUncaughtError);

  terminal.enterAlternateScreen();
  terminal.setTerminalBackgroundColor(TUITheme.background.primary);
  terminal.setCursorVisibility(false);

  const { unmount, waitUntilExit } = render(
    <TUIProvider>
      <CognitionTUI {...options} />
    </TUIProvider>,
    { debug: false, maxFps: 120 }
  );

  process.on('SIGTERM', () => unmount());
  return waitUntilExit();
}
