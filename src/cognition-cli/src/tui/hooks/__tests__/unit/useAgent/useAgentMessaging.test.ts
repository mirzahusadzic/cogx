import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAgentMessaging } from '../../../useAgent/useAgentMessaging.js';
import {
  createAgentTestWrapper,
  createMockAgentState,
} from '../../helpers/TestWrapper.js';
import type { AgentState } from '../../../useAgent/useAgentState.js';
import type { UseAgentOptions } from '../../../useAgent/types.js';
import type { MessageQueue } from '../../../../ipc/MessageQueue.js';

// Mock dependencies
vi.mock('../../../../../ipc/agent-messaging-formatters.js', () => ({
  formatPendingMessages: vi.fn().mockReturnValue('Formatted messages'),
}));

describe('useAgentMessaging', () => {
  let mockState: AgentState;
  let mockOptions: UseAgentOptions;
  let mockQueue: MessageQueue;

  beforeEach(() => {
    vi.clearAllMocks();

    mockQueue = {
      on: vi.fn(),
      off: vi.fn(),
      getPendingCount: vi.fn().mockResolvedValue(0),
      getMessages: vi.fn().mockResolvedValue([]),
    } as unknown as MessageQueue;

    mockState = createMockAgentState({
      setPendingMessageNotification: vi.fn(),
      setShouldAutoRespond: vi.fn(),
      setMessages: vi.fn(),
      autoResponseTimestamps: { current: [] },
    });

    mockOptions = {
      getMessageQueue: vi.fn().mockReturnValue(mockQueue),
      autoResponse: true,
      cwd: '/test',
    };
  });

  it('should set up a listener on the message queue', () => {
    renderHook(() => useAgentMessaging(), {
      wrapper: createAgentTestWrapper(mockOptions, mockState),
    });

    expect(mockQueue.on).toHaveBeenCalledWith(
      'countChanged',
      expect.any(Function)
    );
  });

  it('should clean up the listener on unmount', () => {
    const { unmount } = renderHook(() => useAgentMessaging(), {
      wrapper: createAgentTestWrapper(mockOptions, mockState),
    });

    unmount();

    expect(mockQueue.off).toHaveBeenCalledWith(
      'countChanged',
      expect.any(Function)
    );
  });

  it('should handle new messages when count increases', async () => {
    renderHook(() => useAgentMessaging(), {
      wrapper: createAgentTestWrapper(mockOptions, mockState),
    });

    // Find the handler passed to queue.on
    const calls = vi.mocked(mockQueue.on).mock.calls;
    const handlerCall = calls.find((call) => call[0] === 'countChanged');
    const handler = handlerCall
      ? (handlerCall[1] as (count: number) => void)
      : null;

    if (!handler) {
      throw new Error('Handler not found');
    }

    vi.mocked(mockQueue.getMessages).mockResolvedValue([
      { id: '1', content: 'hello' },
    ]);

    await handler(1); // Trigger count changed from 0 to 1

    expect(mockState.setPendingMessageNotification).toHaveBeenCalled();
    expect(mockState.setShouldAutoRespond).toHaveBeenCalledWith(true);
    expect(mockState.setMessages).toHaveBeenCalled();
  });
});
