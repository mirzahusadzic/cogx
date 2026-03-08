import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Box, Text, useStdout, measureElement, DOMElement } from 'ink';
import { OverlaysBar } from './OverlaysBar.js';
import { ClaudePanelAgent } from './ClaudePanelAgent.js';
import { InputBox } from './InputBox.js';
import { StatusBar } from './StatusBar.js';
import { SigmaInfoPanel } from './SigmaInfoPanel.js';
import { SigmaTaskPanel } from './SigmaTaskPanel.js';
import { ComponentErrorBoundary } from './ErrorBoundaries/ComponentErrorBoundary.js';
import { terminal } from '../services/TerminalService.js';
import type { TUIMessage, SigmaTasks } from '../hooks/useAgent/types.js';
import { ThinkingState } from '../hooks/useAgent/types.js';
import type { BackgroundTask } from '../services/BackgroundTaskManager.js';
import type { ToolConfirmationState } from '../hooks/useToolConfirmation.js';
import type { WizardConfirmationState } from '../hooks/useOnboardingWizard.js';
import type { WorkbenchHealthStatus } from './OverlaysBar.js';
import type { SigmaStats, OverlayScores } from './SigmaInfoPanel.js';
import type { TokenCount } from '../hooks/tokens/useTokenCount.js';
import type { SessionTokenCount } from '../hooks/tokens/useSessionTokenCount.js';
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
  thinkingState?: ThinkingState;
  setThinkingState?: (state: ThinkingState) => void;
  retryCount?: number;
  focused: boolean;
  streamingPaste: string;
  showInfoPanel: boolean;
  showTaskPanel: boolean;
  avgOverlays: OverlayScores;
  sigmaTasks: SigmaTasks;
  saveMessage: string | null;
  currentSessionId: string | undefined;
  tokenCount: TokenCount;
  sessionTokenCount: SessionTokenCount;
  sessionTokens: number | undefined;
  provider: string | undefined;
  model: string | undefined;
  displayThinking: boolean;
  confirmationState: ToolConfirmationState | null;
  wizardConfirmationState: WizardConfirmationState | null;
  cwd?: string;
  solo?: boolean;
  sendMessage: (msg: string) => Promise<void>;
  interrupt: () => void;
  setIsDropdownVisible: (visible: boolean) => void;
  handlePasteContent: (content: string, filepath: string) => void;
  setInputLineCount: (count: number) => void;
  inputLineCount: number;
  isDropdownVisible: boolean;
}

const CognitionTUILayoutComponent: React.FC<CognitionTUILayoutProps> = ({
  sigmaStats,
  activeTask,
  pendingMessageCount,
  monitorError,
  workbenchHealth,
  messages,
  isThinking,
  thinkingState = ThinkingState.IDLE,
  setThinkingState,
  retryCount,
  focused,
  streamingPaste,
  showInfoPanel,
  showTaskPanel,
  avgOverlays,
  sigmaTasks,
  saveMessage,
  currentSessionId,
  tokenCount,
  sessionTokenCount,
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
  solo = false,
}) => {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    rows: stdout?.rows || 24,
    columns: stdout?.columns || 80,
  });
  const [inputAreaHeight, setInputAreaHeight] = useState(5);
  const inputAreaRef = React.useRef<DOMElement>(null);

  // Measure the total height of the input area (InputBox + saveMessage + StatusBar)
  // to help Siggy calculate its absolute terminal position accurately.
  useEffect(() => {
    const measure = () => {
      if (inputAreaRef.current) {
        try {
          const dims = measureElement(inputAreaRef.current);
          if (dims.height !== inputAreaHeight && dims.height > 0) {
            setInputAreaHeight(dims.height);
          }
        } catch {
          // ignore
        }
      }
    };

    // Initial measure
    measure();

    // Re-measure after a short delay to allow layout to settle
    const timer = setTimeout(measure, 0); // Changed from 50ms to 0 to be more reactive
    return () => clearTimeout(timer);
  }, [
    inputLineCount,
    isDropdownVisible,
    confirmationState,
    wizardConfirmationState,
    saveMessage,
    dimensions,
  ]);

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
  useEffect(() => {
    terminal.setCursorVisibility(false);
  }, [isThinking, focused, dimensions]);

  // Clear typing timeout when thinking starts
  useEffect(() => {
    if (isThinking && typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [isThinking]);

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

  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleActivity = useCallback(() => {
    // Trigger typing state for Siggy
    if (
      setThinkingState &&
      !isThinking &&
      thinkingState !== ThinkingState.TYPING
    ) {
      setThinkingState(ThinkingState.TYPING);
    }

    // Always reset the idle timeout if we're in TYPING state or just transitioned to it
    if (setThinkingState && !isThinking) {
      // Reset to IDLE after 1.5s of no typing
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setThinkingState(ThinkingState.IDLE);
      }, 1500);
    }
  }, [setThinkingState, isThinking, thinkingState]);

  const handleInputChange = useCallback(
    (value: string) => {
      setInputLineCount(value.split('\n').length);
      handleActivity();
    },
    [setInputLineCount, handleActivity]
  );

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
            thinkingState={thinkingState}
            retryCount={retryCount}
            focused={!focused}
            showInfoPanel={showInfoPanel}
            showTaskPanel={showTaskPanel}
            streamingPaste={streamingPaste}
            layoutVersion={`${inputLineCount}-${isDropdownVisible}-${dimensions.rows}-${dimensions.columns}-${!!saveMessage}-${inputAreaHeight}`}
            terminalRows={dimensions.rows}
            terminalOffset={inputAreaHeight}
          />
        </ComponentErrorBoundary>
        {dimensions.columns > 120 && (showInfoPanel || showTaskPanel) && (
          <Box marginLeft={1} flexShrink={0} width={50}>
            {showInfoPanel && sigmaStats ? (
              <ComponentErrorBoundary componentName="SigmaInfoPanel">
                <SigmaInfoPanel
                  sigmaStats={sigmaStats}
                  overlays={avgOverlays}
                />
              </ComponentErrorBoundary>
            ) : showTaskPanel ? (
              <ComponentErrorBoundary componentName="SigmaTaskPanel">
                <SigmaTaskPanel
                  sigmaTasks={sigmaTasks}
                  tokenCount={tokenCount}
                  sessionTokenCount={sessionTokenCount}
                />
              </ComponentErrorBoundary>
            ) : null}
          </Box>
        )}
      </Box>

      {/* Input area naturally takes only as much space as it needs */}
      <Box
        ref={inputAreaRef}
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
            onInputChange={handleInputChange}
            onActivity={handleActivity}
            providerName={provider}
            confirmationState={confirmationState}
            wizardConfirmationState={wizardConfirmationState}
            cwd={cwd}
            solo={solo}
          />
        </ComponentErrorBoundary>
        {saveMessage && (
          <Box height={1} flexShrink={0}>
            <Text color={TUITheme.text.success}>{saveMessage}</Text>
          </Box>
        )}
        <ComponentErrorBoundary componentName="StatusBar">
          <StatusBar
            sessionId={currentSessionId}
            focused={focused}
            tokenCount={tokenCount}
            sessionTokenCount={sessionTokenCount}
            compressionThreshold={sessionTokens}
            providerName={provider}
            modelId={model}
          />
        </ComponentErrorBoundary>
      </Box>
    </Box>
  );
};

export const CognitionTUILayout = React.memo(CognitionTUILayoutComponent);
