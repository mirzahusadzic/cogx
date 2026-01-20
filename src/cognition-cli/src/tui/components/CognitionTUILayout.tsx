import React, { useMemo, useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import { OverlaysBar } from './OverlaysBar.js';
import { ClaudePanelAgent } from './ClaudePanelAgent.js';
import { InputBox } from './InputBox.js';
import { StatusBar } from './StatusBar.js';
import { SigmaInfoPanel } from './SigmaInfoPanel.js';
import { ComponentErrorBoundary } from './ErrorBoundaries/ComponentErrorBoundary.js';
import { terminal } from '../services/TerminalService.js';
import type { TUIMessage } from '../hooks/useAgent/types.js';
import type { BackgroundTask } from '../services/BackgroundTaskManager.js';
import type { ToolConfirmationState } from '../hooks/useToolConfirmation.js';
import type { WizardConfirmationState } from '../hooks/useOnboardingWizard.js';
import type { WorkbenchHealthStatus } from './OverlaysBar.js';
import type { SigmaStats, OverlayScores } from './SigmaInfoPanel.js';
import type { TokenCount } from '../hooks/tokens/useTokenCount.js';
import { TUITheme } from '../theme.js';

export interface CognitionTUILayoutProps {
  sigmaStats: SigmaStats;
  activeTask: BackgroundTask | null;
  pendingMessageCount: number;
  monitorError: string | null;
  workbenchHealth: {
    reachable: boolean;
    embeddingReady: boolean;
    summarizationReady: boolean;
    hasApiKey: boolean;
  } | null;
  messages: TUIMessage[];
  isThinking: boolean;
  focused: boolean;
  streamingPaste: string;
  showInfoPanel: boolean;
  avgOverlays: OverlayScores;
  saveMessage: string | null;
  currentSessionId: string | undefined;
  tokenCount: TokenCount;
  sessionTokens: number | undefined;
  provider: string | undefined;
  model: string | undefined;
  displayThinking: boolean;
  confirmationState: ToolConfirmationState | null;
  wizardConfirmationState: WizardConfirmationState | null;
  cwd?: string;
  sendMessage: (msg: string) => Promise<void>;
  interrupt: () => void;
  setIsDropdownVisible: (visible: boolean) => void;
  handlePasteContent: (content: string, filepath: string) => void;
  setInputLineCount: (count: number) => void;
  inputLineCount: number;
  isDropdownVisible: boolean;
}

export const CognitionTUILayout: React.FC<CognitionTUILayoutProps> = ({
  sigmaStats,
  activeTask,
  pendingMessageCount,
  monitorError,
  workbenchHealth,
  messages,
  isThinking,
  focused,
  streamingPaste,
  showInfoPanel,
  avgOverlays,
  saveMessage,
  currentSessionId,
  tokenCount,
  sessionTokens,
  provider,
  model,
  displayThinking,
  confirmationState,
  wizardConfirmationState,
  sendMessage,
  interrupt,
  setIsDropdownVisible,
  handlePasteContent,
  setInputLineCount,
  inputLineCount,
  isDropdownVisible,
  cwd,
}) => {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    rows: stdout?.rows || 24,
    columns: stdout?.columns || 80,
  });

  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      // Debounce resize to prevent render storms during terminal drag
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setDimensions({
          rows: stdout?.rows || 24,
          columns: stdout?.columns || 80,
        });
      }, 50);
    };

    stdout?.on('resize', handleResize);
    return () => {
      stdout?.off('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [stdout]);

  // Ensure cursor is hidden (InputBox uses its own manual cursor)
  // Re-apply whenever thinking status, focus, messages or dimensions change
  // to prevent terminal-intensive tools from showing the cursor.
  useEffect(() => {
    terminal.setCursorVisibility(false);
  }, [isThinking, focused, messages, dimensions]);

  // Memoize filtered messages to prevent unnecessary re-renders of ClaudePanelAgent
  const filteredMessages = useMemo(() => {
    return displayThinking
      ? messages
      : messages.filter((m) => m.type !== 'thinking');
  }, [messages, displayThinking]);

  // Adapt to WorkbenchHealthStatus for OverlaysBar
  const adaptedHealth: WorkbenchHealthStatus | undefined = workbenchHealth
    ? {
        reachable: workbenchHealth.reachable,
        embeddingReady: workbenchHealth.embeddingReady,
        summarizationReady: workbenchHealth.summarizationReady,
        hasApiKey: workbenchHealth.hasApiKey,
      }
    : undefined;

  return (
    <Box
      flexDirection="column"
      width={dimensions.columns}
      height={dimensions.rows}
      paddingTop={0}
      marginTop={0}
      backgroundColor={TUITheme.background.primary}
    >
      <Box flexShrink={0} flexDirection="column" width={dimensions.columns}>
        <ComponentErrorBoundary componentName="OverlaysBar">
          <OverlaysBar
            sigmaStats={sigmaStats}
            activeTask={activeTask}
            pendingMessageCount={pendingMessageCount}
            monitorError={monitorError}
            workbenchHealth={adaptedHealth}
          />
        </ComponentErrorBoundary>
        <Text color={TUITheme.ui.border.dim}>
          {'─'.repeat(dimensions.columns)}
        </Text>
      </Box>

      {/* Use flexGrow: 1 to automatically fill available space */}
      <Box
        flexGrow={1}
        flexShrink={1}
        width={dimensions.columns}
        flexDirection="row"
      >
        <ComponentErrorBoundary componentName="ClaudePanelAgent">
          <ClaudePanelAgent
            messages={filteredMessages}
            isThinking={isThinking}
            focused={!focused}
            showInfoPanel={showInfoPanel}
            streamingPaste={streamingPaste}
            layoutVersion={`${inputLineCount}-${isDropdownVisible}-${dimensions.rows}-${dimensions.columns}`}
          />
        </ComponentErrorBoundary>
        {showInfoPanel && sigmaStats && (
          <Box marginLeft={1} flexShrink={0} width={40}>
            <ComponentErrorBoundary componentName="SigmaInfoPanel">
              <SigmaInfoPanel sigmaStats={sigmaStats} overlays={avgOverlays} />
            </ComponentErrorBoundary>
          </Box>
        )}
      </Box>

      {/* Input area naturally takes only as much space as it needs */}
      <Box
        flexDirection="column"
        justifyContent="flex-end"
        flexShrink={0}
        width="100%"
      >
        <ComponentErrorBoundary componentName="InputBox">
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
            wizardConfirmationState={wizardConfirmationState}
            cwd={cwd}
          />
        </ComponentErrorBoundary>
        <Box height={1} flexShrink={0}>
          {saveMessage && (
            <Text color={TUITheme.text.success}>{saveMessage}</Text>
          )}
        </Box>
        <ComponentErrorBoundary componentName="StatusBar">
          <StatusBar
            sessionId={currentSessionId}
            focused={focused}
            tokenCount={tokenCount}
            compressionThreshold={sessionTokens}
            providerName={provider}
            modelId={model}
          />
        </ComponentErrorBoundary>
      </Box>
    </Box>
  );
};
