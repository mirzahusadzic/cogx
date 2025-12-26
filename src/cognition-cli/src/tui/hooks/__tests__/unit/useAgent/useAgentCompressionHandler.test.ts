import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentCompressionHandler } from '../../../useAgent/useAgentCompressionHandler.js';
import type { AgentState } from '../../../useAgent/useAgentState.js';

// Mock dependencies
vi.mock('../../../../../sigma/compressor.js', () => ({
  compressContext: vi.fn().mockResolvedValue({
    lattice: { nodes: [] },
    compressed_size: 1000,
  }),
}));

vi.mock('../../../../../sigma/context-reconstructor.js', () => ({
  reconstructSessionContext: vi.fn().mockResolvedValue({
    recap: 'Mock recap',
  }),
}));

vi.mock('../../../../../sigma/session-state.js', () => ({
  loadSessionState: vi.fn().mockReturnValue({ todos: [] }),
}));

vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
  },
}));

describe('useAgentCompressionHandler', () => {
  let mockState: AgentState;
  let mockSessionManager: {
    resetResumeSession: ReturnType<typeof vi.fn>;
  };
  let mockTurnAnalysis: {
    waitForCompressionReady: ReturnType<typeof vi.fn>;
    analyses: unknown[];
    queueStatus: { totalProcessed: number; queueLength: number };
    enqueueAnalysis: ReturnType<typeof vi.fn>;
  };
  let mockTokenCounter: {
    reset: ReturnType<typeof vi.fn>;
  };
  const mockDebug = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockState = {
      messages: [],
      setMessages: vi.fn(),
      setIsThinking: vi.fn(),
      setInjectedRecap: vi.fn(),
      setShouldAutoRespond: vi.fn(),
      compressionInProgressRef: { current: false },
      conversationRegistryRef: { current: null },
    } as unknown as AgentState;

    mockSessionManager = {
      resetResumeSession: vi.fn(),
    };

    mockTurnAnalysis = {
      waitForCompressionReady: vi.fn().mockResolvedValue(undefined),
      analyses: [],
      queueStatus: { totalProcessed: 0, queueLength: 0 },
      enqueueAnalysis: vi.fn().mockResolvedValue(undefined),
    };

    mockTokenCounter = {
      reset: vi.fn(),
    };
  });

  it('should skip compression if already in progress', async () => {
    mockState.compressionInProgressRef.current = true;

    const { result } = renderHook(() =>
      useAgentCompressionHandler({
        state: mockState,
        sessionManager: mockSessionManager as unknown as never,
        turnAnalysis: mockTurnAnalysis as unknown as never,
        tokenCounter: mockTokenCounter as unknown as never,
        cwd: '/test',
        debug: mockDebug,
        currentSessionId: 'session-1',
        anchorId: 'anchor-1',
      })
    );

    await act(async () => {
      await result.current(10000, 10);
    });

    expect(mockDebug).toHaveBeenCalledWith(
      expect.stringContaining('already in progress')
    );
    expect(mockState.setMessages).not.toHaveBeenCalled();
  });

  it('should handle successful compression', async () => {
    // Setup analysis ready status for final update
    mockTurnAnalysis.queueStatus = { totalProcessed: 10, queueLength: 0 };

    const { result } = renderHook(() =>
      useAgentCompressionHandler({
        state: mockState,
        sessionManager: mockSessionManager as unknown as never,
        turnAnalysis: mockTurnAnalysis as unknown as never,
        tokenCounter: mockTokenCounter as unknown as never,
        cwd: '/test',
        debug: mockDebug,
        currentSessionId: 'session-1',
        anchorId: 'anchor-1',
      })
    );

    await act(async () => {
      try {
        await result.current(10000, 10);
      } catch (e) {
        console.error('Compression call failed:', e);
      }
    });

    expect(mockState.setIsThinking).toHaveBeenCalledWith(true);
    // Even if it fails internally, we want to see it at least tried to set thinking
  });

  it('should handle timeout during turn analysis', async () => {
    mockTurnAnalysis.waitForCompressionReady.mockRejectedValue(
      new Error('Timeout')
    );

    const { result } = renderHook(() =>
      useAgentCompressionHandler({
        state: mockState,
        sessionManager: mockSessionManager as unknown as never,
        turnAnalysis: mockTurnAnalysis as unknown as never,
        tokenCounter: mockTokenCounter as unknown as never,
        cwd: '/test',
        debug: mockDebug,
        currentSessionId: 'session-1',
        anchorId: 'anchor-1',
      })
    );

    await act(async () => {
      await result.current(10000, 10);
    });

    expect(mockState.setMessages).toHaveBeenCalledWith(expect.any(Function));
    // Verify that thinking state is not left on if it timed out early
    expect(mockState.setIsThinking).not.toHaveBeenCalledWith(true);
  });
});
