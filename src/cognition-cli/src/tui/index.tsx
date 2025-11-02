import React, { useState } from 'react';
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
  const { overlays, loading } = useOverlays({ pgcRoot, workbenchUrl });
  const { messages, sendMessage, isThinking, error } = useClaudeAgent({
    sessionId,
    cwd: projectRoot, // Use project root, not .open_cognition dir
  });

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

  return (
    <Box flexDirection="column" width="100%" height="100%" paddingTop={0} marginTop={0}>
      <OverlaysBar overlays={overlays} />
      <Box flexGrow={1} flexShrink={1} minHeight={0} width="100%" overflow="hidden">
        <ClaudePanelAgent
          messages={messages}
          isThinking={isThinking}
          focused={!focused}
        />
      </Box>
      <InputBox
        onSubmit={sendMessage}
        focused={focused}
        disabled={isThinking}
      />
      <StatusBar sessionId={sessionId} focused={focused} />
    </Box>
  );
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
