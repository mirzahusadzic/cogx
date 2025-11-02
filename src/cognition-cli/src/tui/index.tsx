import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput } from 'ink';
import { OverlaysBar } from './components/OverlaysBar.js';
import { ClaudePanelAgent } from './components/ClaudePanelAgent.js';
import { InputBox } from './components/InputBox.js';
import { StatusBar } from './components/StatusBar.js';
import { useClaudeAgent } from './hooks/useClaudeAgent.js';
import { useOverlays } from './hooks/useOverlays.js';

interface CognitionTUIProps {
  pgcRoot: string;
  projectRoot: string;
  sessionId?: string;
  workbenchUrl?: string;
}

const CognitionTUI: React.FC<CognitionTUIProps> = ({
  pgcRoot,
  projectRoot,
  sessionId,
  workbenchUrl,
}) => {
  const [focused, setFocused] = useState(true);
  const [renderError, setRenderError] = useState<Error | null>(null);

  const { overlays, loading } = useOverlays({ pgcRoot, workbenchUrl });
  const { messages, sendMessage, isThinking, error, tokenCount, interrupt } =
    useClaudeAgent({
      sessionId,
      cwd: projectRoot, // Use project root, not .open_cognition dir
    });

  // Enable mouse support in terminal
  useEffect(() => {
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      // Enable mouse tracking
      process.stdout.write('\x1b[?1000h'); // Enable mouse click tracking
      process.stdout.write('\x1b[?1002h'); // Enable mouse drag tracking
      process.stdout.write('\x1b[?1015h'); // Enable extended mouse mode
      process.stdout.write('\x1b[?1006h'); // Enable SGR mouse mode

      return () => {
        // Disable mouse tracking on cleanup
        process.stdout.write('\x1b[?1000l');
        process.stdout.write('\x1b[?1002l');
        process.stdout.write('\x1b[?1015l');
        process.stdout.write('\x1b[?1006l');
      };
    }
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

  // Handle input
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      // Exit
      process.exit(0);
    } else if (key.tab) {
      // Toggle focus between input and panel
      setFocused((prev) => !prev);
    }
    // Note: Arrow keys, etc. are handled by TextInput component
    // We just need to not interfere with them
  });

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
      <Box flexDirection="column" width="100%" height="100%" paddingTop={0} marginTop={0}>
        <OverlaysBar overlays={overlays} />
        <Box flexGrow={1} flexShrink={1} minHeight={0} width="100%" overflow="hidden">
          <ClaudePanelAgent
            messages={messages}
            isThinking={isThinking}
            focused={!focused}
            onScrollDetected={() => setFocused(false)}
          />
        </Box>
        <InputBox
          onSubmit={sendMessage}
          focused={focused}
          disabled={isThinking}
          onInterrupt={interrupt}
        />
        <StatusBar sessionId={sessionId} focused={focused} tokenCount={tokenCount} />
      </Box>
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
