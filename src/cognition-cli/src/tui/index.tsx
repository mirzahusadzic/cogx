import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { isAuthenticationError } from './hooks/sdk/index.js';
import type { TUIMessage } from './hooks/useAgent.js';

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
}) => {
  const { stdout } = useStdout();
  const [focused, setFocused] = useState(true);
  const [renderError, setRenderError] = useState<Error | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [streamingPaste, setStreamingPaste] = useState<string>('');
  const [inputLineCount, setInputLineCount] = useState(1);

  // Tool confirmation hook (guardrails) - must be before chatAreaHeight useMemo
  const { confirmationState, requestConfirmation, allow, deny, alwaysAllow } =
    useToolConfirmation();

  // Calculate fixed chat area height to prevent InputBox from shifting
  // when messages populate - memoize to avoid recalculation on every render
  const chatAreaHeight = useMemo(() => {
    const terminalHeight = stdout?.rows || 24;
    // Dynamic reserved space: expand when dropdown OR confirmation modal is visible
    // OverlaysBar(1) + separator(1) + separator(1) + InputBox+Dropdown/Modal(variable) + separator(1) + saveMessage(1) + StatusBar(3)
    // Dropdown needs more space (9 lines) than confirmation modal (5 lines)
    const inputAndDropdownHeight = isDropdownVisible
      ? 9 // Dropdown is tall (command list)
      : confirmationState?.pending
        ? 5 // Confirmation modal is compact (just 2-3 lines)
        : 1; // Just input when nothing is open
    const reservedHeight = 3 + inputAndDropdownHeight + 5; // 3 top + input area + 5 bottom
    return Math.max(5, terminalHeight - reservedHeight); // Minimum 5 lines for chat
  }, [stdout?.rows, isDropdownVisible, confirmationState?.pending]);

  const { loading } = useOverlays({ pgcRoot, workbenchUrl });

  const {
    messages,
    sendMessage: originalSendMessage,
    isThinking,
    error,
    tokenCount,
    interrupt,
    sigmaStats,
    avgOverlays,
    currentSessionId,
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
  });

  // Wrap sendMessage to clear streaming paste on regular messages
  const sendMessage = useCallback(
    (msg: string) => {
      // Clear streaming paste when sending a regular message
      if (!msg.startsWith('[Pasted content')) {
        setStreamingPaste('');
      }
      originalSendMessage(msg);
    },
    [originalSendMessage]
  );

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
      const sigmaDir = path.join(projectRoot, '.sigma');
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

      setSaveMessage(`💾 Saved ${messages.length} messages to ${logFileName}`);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage(`❌ Save failed: ${(err as Error).message}`);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // Handle input - make sure this is always active for Ctrl+C
  useInput(
    (input, key) => {
      // PRIORITY 1: Handle confirmation modal keyboard input FIRST
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

      // PRIORITY 2: Global keyboard shortcuts (only when modal NOT active)
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
          <OverlaysBar sigmaStats={sigmaStats} />
          <Text>{'─'.repeat(process.stdout.columns || 80)}</Text>
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
            height={
              isDropdownVisible
                ? 9 + inputLineCount + 2 // Dropdown + input + borders
                : confirmationState?.pending
                  ? 5 + inputLineCount + 2 // Confirmation + input + borders
                  : inputLineCount + 2 // Just input + borders
            }
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
    patchConsole: true, // Patch console to prevent output mixing
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
