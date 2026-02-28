import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAgentServices } from '../../../useAgent/useAgentServices.js';
import {
  createAgentTestWrapper,
  createMockAgentState,
} from '../../helpers/TestWrapper.js';
import type { AgentState } from '../../../useAgent/useAgentState.js';
import type { UseAgentOptions } from '../../../useAgent/types.js';
import { ConversationOverlayRegistry } from '../../../../../sigma/conversation-registry.js';

// Mock dependencies
vi.mock('../../../../../llm/index.js', () => ({
  initializeProviders: vi.fn().mockResolvedValue(undefined),
  registry: { list: vi.fn().mockReturnValue(['claude', 'gemini']) },
}));

vi.mock('../../../../../core/services/embedding.js', () => ({
  EmbeddingService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../../../../sigma/conversation-registry.js', () => ({
  ConversationOverlayRegistry: vi.fn().mockImplementation(() => ({
    setCurrentSession: vi.fn(),
    flushAll: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../../../../sigma/recall-tool.js', () => ({
  createRecallMcpServer: vi.fn(),
}));

vi.mock('../../../../services/BackgroundTaskManager.js', () => ({
  getBackgroundTaskManager: vi.fn(),
}));

vi.mock('../../../../tools/background-tasks-tool.js', () => ({
  createBackgroundTasksMcpServer: vi.fn(),
}));

vi.mock('../../../../tools/agent-messaging-tool.js', () => ({
  createAgentMessagingMcpServer: vi.fn(),
}));

vi.mock('../../../../tools/cross-project-query-tool.js', () => ({
  createCrossProjectQueryMcpServer: vi.fn(),
}));

vi.mock('../../../../tools/sigma-task-update-tool.js', () => ({
  createSigmaTaskUpdateMcpServer: vi.fn(),
}));

vi.mock('../../../../../utils/workbench-detect.js', () => ({
  checkWorkbenchHealthDetailed: vi.fn().mockResolvedValue({
    reachable: true,
    embeddingReady: true,
    summarizationReady: true,
  }),
}));

vi.mock('../../../../commands/loader.js', () => ({
  loadCommands: vi
    .fn()
    .mockResolvedValue({ commands: new Map(), errors: [], warnings: [] }),
}));

describe('useAgentServices', () => {
  let mockState: AgentState;
  let mockOptions: UseAgentOptions;

  beforeEach(() => {
    vi.clearAllMocks();

    mockState = createMockAgentState({
      conversationRegistryRef: {
        current: {
          setCurrentSession: vi.fn(),
          flushAll: vi.fn().mockResolvedValue(undefined),
        } as unknown as ConversationOverlayRegistry,
      },
    });

    mockOptions = {
      cwd: '/test',
      debug: false,
    };
  });

  it('should initialize services on mount', async () => {
    // console.log('Mock State Conversation Registry:', mockState.conversationRegistryRef.current);
    renderHook(() => useAgentServices(), {
      wrapper: createAgentTestWrapper(mockOptions, mockState),
    });

    await waitFor(() => {
      expect(mockState.embedderRef.current).toBeDefined();
      expect(mockState.conversationRegistryRef.current).toBeDefined();
      expect(mockState.setWorkbenchHealth).toHaveBeenCalled();
    });
  });
});
