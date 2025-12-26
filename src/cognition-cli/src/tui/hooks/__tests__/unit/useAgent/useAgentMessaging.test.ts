import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAgentMessaging } from '../../../useAgent/useAgentMessaging.js';
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
    };

    mockState = {
      setPendingMessageNotification: vi.fn(),
      setShouldAutoRespond: vi.fn(),
      setMessages: vi.fn(),
      autoResponseTimestamps: { current: [] },
    };

    mockOptions = {
      getMessageQueue: vi.fn().mockReturnValue(mockQueue),
      autoResponse: true,
    };
  });

  it('should set up a listener on the message queue', () => {
    renderHook(() =>
      useAgentMessaging({
        options: mockOptions,
        state: mockState,
      })
    );

    expect(mockQueue.on).toHaveBeenCalledWith(
      'countChanged',
      expect.any(Function)
    );
  });

  it('should clean up the listener on unmount', () => {
    const { unmount } = renderHook(() =>
      useAgentMessaging({
        options: mockOptions,
        state: mockState,
      })
    );

    unmount();

    expect(mockQueue.off).toHaveBeenCalledWith(
      'countChanged',
      expect.any(Function)
    );
  });

  it('should handle new messages when count increases', async () => {
    renderHook(() =>
      useAgentMessaging({
        options: mockOptions,
        state: mockState,
      })
    );

    // Find the handler passed to queue.on
    const handler = mockQueue.on.mock.calls.find(
      (call) => call[0] === 'countChanged'
    )[1];

    mockQueue.getMessages.mockResolvedValue([{ id: '1', content: 'hello' }]);

    await handler(1); // Trigger count changed from 0 to 1

    expect(mockState.setPendingMessageNotification).toHaveBeenCalled();
    expect(mockState.setShouldAutoRespond).toHaveBeenCalledWith(true);
    expect(mockState.setMessages).toHaveBeenCalled();
  });
});
