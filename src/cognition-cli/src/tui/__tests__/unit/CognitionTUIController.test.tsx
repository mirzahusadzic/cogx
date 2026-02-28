import React from 'react';
import { render } from 'ink-testing-library';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { CognitionTUIController } from '../../index';
import { useAgentContext } from '../../contexts/AgentContext';
import { useTUI } from '../../context/TUIContext';
import type { AgentContextType } from '../../contexts/AgentContext';
import { terminal } from '../../services';
import type { UseBackgroundTaskManagerResult } from '../../hooks/useBackgroundTaskManager';
import type { ToolConfirmationState } from '../../hooks/useToolConfirmation';

// Mock dependencies
vi.mock('../../hooks/useBackgroundTaskManager', () => ({
  useBackgroundTaskManager: vi.fn(() => ({
    getManager: vi.fn(),
  })),
}));

vi.mock('../../hooks/useOverlays', () => ({
  useOverlays: vi.fn(() => ({ loading: false })),
}));

vi.mock('../../contexts/AgentContext', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useAgentContext: vi.fn(),
  };
});

vi.mock('../../hooks/useMessageMonitor', () => ({
  useMessageMonitor: vi.fn(() => ({})),
}));

vi.mock('../../hooks/useSlashCommands', () => ({
  useSlashCommands: vi.fn(() => ({ handleSlashCommand: vi.fn() })),
}));

vi.mock('../../services', () => ({
  terminal: {
    forceKill: vi.fn(),
    enterAlternateScreen: vi.fn(),
    setTerminalBackgroundColor: vi.fn(),
    setCursorVisibility: vi.fn(),
    cleanup: vi.fn(),
    resetColors: vi.fn(),
    setBracketedPaste: vi.fn(),
  },
}));

vi.mock('../../utils/auth', () => ({
  isAuthenticationError: vi.fn(() => false),
}));

vi.mock('../../hooks/useToolConfirmation', () => ({
  useToolConfirmation: vi.fn(() => ({
    confirmationState: null,
    requestConfirmation: vi.fn(),
    allow: vi.fn(),
    deny: vi.fn(),
    alwaysAllow: vi.fn(),
  })),
}));

vi.mock('../../hooks/useOnboardingWizard', () => ({
  useOnboardingWizard: vi.fn(() => ({
    confirmationState: null,
    startWizard: vi.fn(),
  })),
}));

// Mock TUI hooks
const mockToggleInfoPanel = vi.fn();
const mockToggleTaskPanel = vi.fn();
const mockToggleFocus = vi.fn();

vi.mock('../../context/TUIContext', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useTUI: vi.fn(),
  };
});

describe('CognitionTUIController Keyboard Shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useAgentContext as Mock).mockReturnValue({
      state: {
        messages: [],
        setMessages: vi.fn(),
        isThinking: false,
        setIsThinking: vi.fn(),
        error: null,
        tokenCount: { prompt: 0, completion: 0, total: 0 },
        sessionTokenCount: { threshold: 0, count: 0 },
        retryCount: 0,
        activeModel: 'test-model',
        sigmaStats: {
          nodes: 0,
          edges: 0,
          paradigmShifts: 0,
          avgNovelty: 0,
          avgImportance: 0,
        },
        sigmaTasks: { tasks: [] },
        avgOverlays: {},
        currentSessionId: 'test-session',
        anchorId: 'test-anchor',
        workbenchHealth: { healthy: true },
        overlayScores: {},
      },
      options: {
        cwd: '/test',
        debug: false,
        sessionId: 'test-session',
        provider: 'test-provider',
        model: 'test-model',
      },
      messages: [],
      sendMessage: vi.fn(),
      addSystemMessage: vi.fn(),
      interrupt: vi.fn(),
    } as unknown as AgentContextType);

    (useTUI as Mock).mockReturnValue({
      state: {
        focused: false,
        showInfoPanel: false,
        showTaskPanel: false,
      },
      toggleInfoPanel: mockToggleInfoPanel,
      toggleTaskPanel: mockToggleTaskPanel,
      toggleFocus: mockToggleFocus,
      setSaveMessage: vi.fn(),
      setIsDropdownVisible: vi.fn(),
      setStreamingPaste: vi.fn(),
      setInputLineCount: vi.fn(),
    });
  });

  const defaultProps = {
    projectRoot: '/test',
    onboardingMode: false,
    displayThinking: true,
    solo: false,
    taskManager: {
      tasks: [],
      activeTask: null,
      summary: { total: 0, active: 0, completed: 0, failed: 0, cancelled: 0 },
      startGenesis: vi.fn(),
      startGenesisDocs: vi.fn(),
      startOverlay: vi.fn(),
      cancelTask: vi.fn(),
      clearHistory: vi.fn(),
      getManager: vi.fn(),
    } as unknown as UseBackgroundTaskManagerResult,
    confirmationState: null as ToolConfirmationState | null,
    allow: vi.fn(),
    deny: vi.fn(),
    alwaysAllow: vi.fn(),
    messageQueueRef: { current: null },
    messagePublisherRef: { current: null },
    messageQueueMonitorRef: { current: null },
  };

  it('toggles Info Panel when "i" is pressed and NOT focused', async () => {
    const { stdin } = render(<CognitionTUIController {...defaultProps} />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    stdin.write('i');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockToggleInfoPanel).toHaveBeenCalled();
  });

  it('toggles Task Panel when "t" is pressed and NOT focused', async () => {
    const { stdin } = render(<CognitionTUIController {...defaultProps} />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    stdin.write('t');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockToggleTaskPanel).toHaveBeenCalled();
  });

  it('toggles Info Panel when "Ctrl+P" is pressed', async () => {
    const { stdin } = render(<CognitionTUIController {...defaultProps} />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    // Ctrl+P is \u0010
    stdin.write('\u0010');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockToggleInfoPanel).toHaveBeenCalled();
  });

  it('toggles Task Panel when "Ctrl+T" is pressed', async () => {
    const { stdin } = render(<CognitionTUIController {...defaultProps} />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    // Ctrl+T is \u0014
    stdin.write('\u0014');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockToggleTaskPanel).toHaveBeenCalled();
  });

  it('calls terminal.forceKill when "Ctrl+C" is pressed', async () => {
    const { stdin } = render(<CognitionTUIController {...defaultProps} />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    // Ctrl+C is \u0003
    stdin.write('\u0003');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(terminal.forceKill).toHaveBeenCalled();
  });
});
