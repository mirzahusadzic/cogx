import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { OverlaysBar } from './OverlaysBar.js';
import { ClaudePanelAgent } from './ClaudePanelAgent.js';
import { InputBox } from './InputBox.js';
import { StatusBar } from './StatusBar.js';
import { SigmaInfoPanel } from './SigmaInfoPanel.js';
import { ComponentErrorBoundary } from './ErrorBoundaries/ComponentErrorBoundary.js';
import type { TUIMessage } from '../hooks/useAgent/types.js';
import type { BackgroundTask } from '../services/BackgroundTaskManager.js';
import type { ToolConfirmationState } from '../hooks/useToolConfirmation.js';
import type { WizardConfirmationState } from '../hooks/useOnboardingWizard.js';
import type { WorkbenchHealthStatus } from './OverlaysBar.js';
import type { SigmaStats, OverlayScores } from './SigmaInfoPanel.js';
import type { TokenCount } from '../hooks/tokens/useTokenCount.js';

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
  isDropdownVisible: boolean;
  inputLineCount: number;
  chatAreaHeight: number;
  saveMessage: string | null;
  currentSessionId: string | undefined;
  tokenCount: TokenCount;
  sessionTokens: number | undefined;
  provider: string | undefined;
  model: string | undefined;
  displayThinking: boolean;
  confirmationState: ToolConfirmationState | null;
  wizardConfirmationState: WizardConfirmationState | null;
  sendMessage: (msg: string) => Promise<void>;
  interrupt: () => void;
  setIsDropdownVisible: (visible: boolean) => void;
  handlePasteContent: (content: string, filepath: string) => void;
  setInputLineCount: (count: number) => void;
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
  isDropdownVisible,
  inputLineCount,
  chatAreaHeight,
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
}) => {
  const { stdout } = useStdout();

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
      width="100%"
      height="100%"
      paddingTop={0}
      marginTop={0}
    >
      <ComponentErrorBoundary componentName="OverlaysBar">
        <OverlaysBar
          sigmaStats={sigmaStats}
          activeTask={activeTask}
          pendingMessageCount={pendingMessageCount}
          monitorError={monitorError}
          workbenchHealth={adaptedHealth}
        />
      </ComponentErrorBoundary>
      <Text color="#3a3f4b">{'─'.repeat(stdout?.columns || 80)}</Text>
      <Box
        height={chatAreaHeight}
        width="100%"
        overflow="hidden"
        flexDirection="row"
      >
        <ComponentErrorBoundary componentName="ClaudePanelAgent">
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
        </ComponentErrorBoundary>
        {showInfoPanel && sigmaStats && (
          <Box marginLeft={1}>
            <ComponentErrorBoundary componentName="SigmaInfoPanel">
              <SigmaInfoPanel sigmaStats={sigmaStats} overlays={avgOverlays} />
            </ComponentErrorBoundary>
          </Box>
        )}
      </Box>

      <Box
        height={(() => {
          const wizardSelectHeight =
            wizardConfirmationState?.mode === 'select' &&
            wizardConfirmationState.items
              ? Math.min(wizardConfirmationState.items.length + 4, 12)
              : 0;
          if (isDropdownVisible) return 9 + inputLineCount + 2;
          if (wizardSelectHeight > 0)
            return wizardSelectHeight + inputLineCount + 2;
          if (confirmationState?.pending || wizardConfirmationState?.pending)
            return 5 + inputLineCount + 2;
          return inputLineCount + 2;
        })()}
        flexDirection="column"
        justifyContent="flex-end"
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
          />
        </ComponentErrorBoundary>
      </Box>
      <Box height={1}>
        {saveMessage && <Text color="green">{saveMessage}</Text>}
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
  );
};
