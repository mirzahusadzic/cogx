import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import { render, Box, Text, useInput, useStdout, type TextProps } from 'ink';
import { ThemeProvider, extendTheme, defaultTheme } from '@inkjs/ui';
import fs from 'fs';
import path from 'path';
import { logEmitter, LogEvent, systemLog } from '../utils/debug-logger.js';

// Toggle mouse tracking - disable to restore native terminal text selection
const ENABLE_MOUSE_TRACKING = false;
import { CognitionTUILayout } from './components/CognitionTUILayout.js';
import { useAgent } from './hooks/useAgent.js';
import { useOverlays } from './hooks/useOverlays.js';
import { useToolConfirmation } from './hooks/useToolConfirmation.js';
import { useBackgroundTaskManager } from './hooks/useBackgroundTaskManager.js';
import { useOnboardingWizard } from './hooks/useOnboardingWizard.js';
import { useSlashCommands } from './hooks/useSlashCommands.js';
import { useMessageMonitor } from './hooks/useMessageMonitor.js';
import { TUIProvider, useTUI } from './context/TUIContext.js';
import { terminal } from './services/index.js';
import { isAuthenticationError } from './hooks/sdk/index.js';
import type { TUIMessage } from './hooks/useAgent.js';
import { MessageQueueMonitor } from '../ipc/MessageQueueMonitor.js';
import { MessageQueue } from '../ipc/MessageQueue.js';
import { MessagePublisher } from '../ipc/MessagePublisher.js';
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
  const {
    state,
    toggleFocus,
    setRenderError,
    toggleInfoPanel,
    setSaveMessage,
    setIsDropdownVisible,
    setStreamingPaste,
    setInputLineCount,
  } = useTUI();
  const {
    focused,
    renderError,
    showInfoPanel,
    saveMessage,
    isDropdownVisible,
    streamingPaste,
    inputLineCount,
  } = state;

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

  const { pendingMessageCount, monitorError } = useMessageMonitor({
    anchorId,
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
    anchorId,
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
      terminal.forceKill();
    };

    // Use 'once' instead of 'on' to prevent multiple firings
    process.once('SIGINT', sigintHandler);

    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      // Enable bracketed paste mode (always on)
      terminal.setBracketedPaste(true);

      if (ENABLE_MOUSE_TRACKING) {
        terminal.setMouseTracking(true);
      }

      return () => {
        terminal.cleanup();
      };
    }

    return () => {
      terminal.resetColors();
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
        systemLog(
          'tui',
          '[TUI Debug] Error detected',
          { error: String(error) },
          'error'
        );
        systemLog(
          'tui',
          '[TUI Debug] Is auth error?',
          { isAuthError: isAuthenticationError([error]) },
          'error'
        );
      }

      if (isAuthenticationError([error])) {
        const sessionStateFile = sessionId
          ? path.join(projectRoot, '.sigma', `${sessionId}.state.json`)
          : 'session state file';

        // Display error message
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
            systemLog(
              'tui',
              `Cleanup error: ${e instanceof Error ? e.message : String(e)}`,
              {},
              'error'
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

  // Subscribe to system logs for TUI display
  useEffect(() => {
    const logHandler = (event: LogEvent) => {
      // Only show ERROR logs in the main chat window
      // Info/Debug/Warn logs are still written to file but kept out of the UI to avoid clutter
      if (event.level !== 'error') {
        return;
      }

      // Format the log event into a TUIMessage
      let content = `[${event.level.toUpperCase()}]`;
      if (event.source) {
        content += ` [${event.source}]`;
      }
      content += ` ${event.message}`;
      if (event.data) {
        try {
          // Only show first 2 lines of data to avoid clutter
          const dataString = JSON.stringify(event.data, null, 2);
          content += `\n${dataString.split('\n').slice(0, 3).join('\n')}`;
          if (dataString.split('\n').length > 3) {
            content += '...';
          }
        } catch {
          content += ' [Unserializable data]';
        }
      }

      // Add to TUI messages as a system message
      addSystemMessage(content);
    };

    logEmitter.on('log', logHandler);

    return () => {
      logEmitter.off('log', logHandler);
    };
  }, [addSystemMessage]); // Dependency: addSystemMessage from useAgent

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
        systemLog(
          'tui',
          '[TUI.useInput] ESC pressed',
          {
            confirmationPending: confirmationState?.pending,
            isThinking: isThinking,
          },
          'error'
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
          systemLog(
            'tui',
            '[TUI] Wizard modal active',
            {
              mode: wizard.confirmationState.mode,
              input: input,
              inputLength: input?.length,
              key: Object.keys(key).filter(
                (k) => k && key[k as keyof typeof key]
              ),
            },
            'error'
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
              systemLog(
                'tui',
                '[TUI] Space pressed, toggling selection',
                {},
                'error'
              );
            }
            wizard.toggleSelection();
            return;
          } else if (key.return) {
            wizard.confirm();
            return;
          } else if (key.escape) {
            if (process.env.DEBUG_WIZARD || process.env.DEBUG_ESC_INPUT) {
              systemLog(
                'tui',
                '[TUI] ESC pressed, calling wizard.cancel()',
                {},
                'error'
              );
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
          systemLog(
            'tui',
            '[TUI.useInput] Calling interrupt()',
            { isThinking: isThinking },
            'error'
          );
        }
        interrupt();
        return;
      }

      // PRIORITY 3: Global keyboard shortcuts (only when modal NOT active)
      if (key.ctrl && input === 'c') {
        // Force immediate exit - kill entire process group including workers
        terminal.forceKill();
      } else if (key.ctrl && input === 's') {
        // Save conversation log with Ctrl+S
        saveConversationLog();
      } else if (key.ctrl && input === 'w') {
        // Restart/resume onboarding wizard with Ctrl+W
        wizard.startWizard();
      } else if (key.tab) {
        // Toggle focus between input and panel
        toggleFocus();
      } else if (
        input === 'i' &&
        !key.ctrl &&
        !key.shift &&
        !key.meta &&
        !focused
      ) {
        // Toggle info panel with 'i' key (only when NOT in input box)
        toggleInfoPanel();
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
        <CognitionTUILayout
          sigmaStats={sigmaStats}
          activeTask={taskManager.activeTask}
          pendingMessageCount={pendingMessageCount}
          monitorError={monitorError}
          workbenchHealth={workbenchHealth}
          messages={messages}
          isThinking={isThinking}
          focused={focused}
          streamingPaste={streamingPaste}
          showInfoPanel={showInfoPanel}
          avgOverlays={avgOverlays}
          isDropdownVisible={isDropdownVisible}
          inputLineCount={inputLineCount}
          chatAreaHeight={chatAreaHeight}
          saveMessage={saveMessage}
          currentSessionId={currentSessionId}
          tokenCount={tokenCount}
          sessionTokens={sessionTokens}
          provider={provider}
          model={model}
          displayThinking={displayThinking}
          confirmationState={confirmationState}
          wizardConfirmationState={wizard.confirmationState}
          sendMessage={sendMessage}
          interrupt={interrupt}
          setIsDropdownVisible={setIsDropdownVisible}
          handlePasteContent={handlePasteContent}
          setInputLineCount={setInputLineCount}
        />
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
    systemLog(
      'tui',
      '[TUI] Uncaught error',
      { message: error.message },
      'error'
    );
    if (options.debug) {
      systemLog('tui', '[TUI] Stack trace', { stack: error.stack }, 'error');
    }

    // Check if it's an auth error
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
      systemLog(
        'tui',
        '  Your API key is invalid or has expired.\n',
        {},
        'error'
      );
      systemLog(
        'tui',
        '  Please check your environment variables.\n',
        {},
        'error'
      );
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

  const { unmount, waitUntilExit } = render(
    <TUIProvider>
      <CognitionTUI {...options} />
    </TUIProvider>,
    {
      debug: false,
      maxFps: 120, // Higher FPS for smoother rendering and less visible flicker
    }
  );

  // Only handle SIGTERM gracefully (kill command)
  // SIGINT (Ctrl+C) is handled inside the component with immediate kill
  const cleanup = () => {
    unmount();
  };

  process.on('SIGTERM', cleanup);

  return waitUntilExit();
}
