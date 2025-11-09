import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, type TextProps } from 'ink';
import {
  ThemeProvider,
  extendTheme,
  defaultTheme,
} from '@inkjs/ui';
import fs from 'fs';
import path from 'path';
import { OverlaysBar } from './components/OverlaysBar.js';
import { ClaudePanelAgent } from './components/ClaudePanelAgent.js';
import { InputBox } from './components/InputBox.js';
import { StatusBar } from './components/StatusBar.js';
import { SigmaInfoPanel } from './components/SigmaInfoPanel.js';
import { useClaudeAgent } from './hooks/useClaudeAgent.js';
import { useOverlays } from './hooks/useOverlays.js';
import { isAuthenticationError } from './hooks/sdk/index.js';
import type { ClaudeMessage } from './hooks/useClaudeAgent.js';

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
}

const CognitionTUI: React.FC<CognitionTUIProps> = ({
  pgcRoot,
  projectRoot,
  sessionId,
  workbenchUrl,
  sessionTokens,
  maxThinkingTokens,
  debug,
}) => {
  const [focused, setFocused] = useState(true);
  const [renderError, setRenderError] = useState<Error | null>(null);
  const [mouseEnabled, setMouseEnabled] = useState(true);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const { overlays, loading } = useOverlays({ pgcRoot, workbenchUrl });
  const { messages, sendMessage, isThinking, error, tokenCount, interrupt, sigmaStats, avgOverlays, currentSessionId } =
    useClaudeAgent({
      sessionId,
      cwd: projectRoot, // Use project root, not .open_cognition dir
      sessionTokens, // Pass custom token threshold
      maxThinkingTokens, // Pass extended thinking token limit
      debug, // Pass debug flag
    });

  // Enable mouse support and add Ctrl+C handler (colors set in tui.ts command)
  useEffect(() => {
    // Add direct SIGINT handler for Ctrl+C
    const sigintHandler = () => {
      try {
        process.stdout.write('\x1b[0m'); // Reset colors
        process.stdout.write('\x1b[?1000l'); // Disable mouse
        process.stdout.write('\x1b[?1002l');
        process.stdout.write('\x1b[?1015l');
        process.stdout.write('\x1b[?1006l');
      } catch (e) {
        // Ignore errors during cleanup
      }
      // Use process.abort() - truly immediate, bypasses everything
      process.abort();
    };

    process.on('SIGINT', sigintHandler);

    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      // Enable mouse tracking on startup
      if (mouseEnabled) {
        process.stdout.write('\x1b[?1000h'); // Enable mouse click tracking
        process.stdout.write('\x1b[?1002h'); // Enable mouse drag tracking
        process.stdout.write('\x1b[?1015h'); // Enable extended mouse mode
        process.stdout.write('\x1b[?1006h'); // Enable SGR mouse mode
      }

      return () => {
        // Disable mouse tracking on cleanup
        process.stdout.write('\x1b[?1000l');
        process.stdout.write('\x1b[?1002l');
        process.stdout.write('\x1b[?1015l');
        process.stdout.write('\x1b[?1006l');
        // Reset colors on exit
        process.stdout.write('\x1b[0m');
        // Remove SIGINT handler
        process.off('SIGINT', sigintHandler);
      };
    }

    return () => {
      process.off('SIGINT', sigintHandler);
    };
  }, []);

  // Toggle mouse mode when 'm' is pressed
  useEffect(() => {
    if (process.stdin.isTTY) {
      if (mouseEnabled) {
        process.stdout.write('\x1b[?1000h\x1b[?1002h\x1b[?1015h\x1b[?1006h');
      } else {
        process.stdout.write('\x1b[?1000l\x1b[?1002l\x1b[?1015l\x1b[?1006l');
      }
    }
  }, [mouseEnabled]);

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
    if (error && isAuthenticationError([error])) {
      const sessionStateFile = sessionId
        ? path.join(projectRoot, '.sigma', `${sessionId}.state.json`)
        : 'session state file';

      // Display error message
      console.error('\n\n╔════════════════════════════════════════════════════════════════════════════╗');
      console.error('║                     OAuth Token Expired                                    ║');
      console.error('╚════════════════════════════════════════════════════════════════════════════╝\n');
      console.error('  Your OAuth token has expired and the TUI must exit.\n');
      console.error('  📝 Your session has been saved automatically.\n');
      console.error('  To continue:\n');
      console.error('  1. Run: claude /login');
      console.error('  2. Restart with: cognition tui --file ' + sessionStateFile + '\n');
      console.error('  Press any key to exit...\n');

      // Clean up and exit after user presses a key or 5 seconds
      let exited = false;
      const cleanup = () => {
        if (exited) return;
        exited = true;
        try {
          process.stdout.write('\x1b[0m'); // Reset colors
          process.stdout.write('\x1b[?1000l\x1b[?1002l\x1b[?1015l\x1b[?1006l'); // Disable mouse
        } catch (e) {
          // Ignore cleanup errors
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
  }, [error, sessionId, projectRoot]);

  // Save conversation log to file
  const saveConversationLog = () => {
    try {
      const sigmaDir = path.join(projectRoot, '.sigma');
      fs.mkdirSync(sigmaDir, { recursive: true });

      const logFileName = sessionId
        ? `${sessionId}-claude-magic.log`
        : `session-${Date.now()}-claude-magic.log`;
      const logPath = path.join(sigmaDir, logFileName);

      // Format messages for log
      const logContent = messages
        .map((msg: ClaudeMessage) => {
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
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      // Force immediate exit - use process.abort() to bypass event loop
      try {
        process.stdout.write('\x1b[0m'); // Reset colors
        process.stdout.write('\x1b[?1000l\x1b[?1002l\x1b[?1015l\x1b[?1006l'); // Disable mouse
      } catch (e) {
        // Ignore errors
      }
      process.abort(); // Immediate termination, no cleanup
    } else if (key.ctrl && input === 's') {
      // Save conversation log with Ctrl+S
      saveConversationLog();
    } else if (key.tab) {
      // Toggle focus between input and panel
      setFocused((prev) => !prev);
    } else if (input === 'i' && !key.ctrl && !key.shift && !key.meta && !focused) {
      // Toggle info panel with 'i' key (only when NOT in input box)
      setShowInfoPanel((prev) => !prev);
    } else if (input === 'm' && !key.ctrl && !key.shift && !key.meta && !focused) {
      // Toggle mouse mode with 'm' key (only when NOT in input box)
      setMouseEnabled((prev) => !prev);
    }
    // Note: Arrow keys, etc. are handled by TextInput component
    // We just need to not interfere with them
  }, { isActive: true });

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
          <Text dimColor>{renderError.stack?.split('\n').slice(0, 5).join('\n')}</Text>
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
        <Box flexDirection="column" width="100%" height="100%" paddingTop={0} marginTop={0}>
          <OverlaysBar sigmaStats={sigmaStats} />
          <Text>{'─'.repeat(process.stdout.columns || 80)}</Text>
          <Box flexGrow={1} flexShrink={1} minHeight={0} width="100%" overflow="hidden" flexDirection="row">
            <ClaudePanelAgent
              messages={messages}
              isThinking={isThinking}
              focused={!focused}
              onScrollDetected={() => setFocused(false)}
            />
            {showInfoPanel && sigmaStats && (
              <Box marginLeft={1}>
                <SigmaInfoPanel sigmaStats={sigmaStats} overlays={avgOverlays} />
              </Box>
            )}
          </Box>
          <Text>{'─'.repeat(process.stdout.columns || 80)}</Text>
          <InputBox
            onSubmit={sendMessage}
            focused={focused}
            disabled={isThinking}
            onInterrupt={interrupt}
          />
          <Text>{'─'.repeat(process.stdout.columns || 80)}</Text>
          {saveMessage && (
            <Box>
              <Text color="green">{saveMessage}</Text>
            </Box>
          )}
          <StatusBar sessionId={currentSessionId} focused={focused} tokenCount={tokenCount} mouseEnabled={mouseEnabled} compressionThreshold={sessionTokens} />
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
  const { unmount, waitUntilExit } = render(<CognitionTUI {...options} />);

  // Graceful shutdown
  const cleanup = () => {
    unmount();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return waitUntilExit();
}
