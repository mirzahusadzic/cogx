import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSlashCommands } from '../useSlashCommands.js';
import type { MessageQueue } from '../../../ipc/MessageQueue.js';
import type { MessagePublisher } from '../../../ipc/MessagePublisher.js';

// Mock fs and path
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
  },
}));

describe('useSlashCommands', () => {
  const mockAddSystemMessage = vi.fn();
  const mockOriginalSendMessage = vi.fn();
  const mockSetStreamingPaste = vi.fn();
  const mockMessageQueue = {
    getMessages: vi.fn(),
    getMessage: vi.fn(),
    updateStatus: vi.fn(),
  } as unknown as MessageQueue;
  const mockMessagePublisher = {
    sendMessage: vi.fn(),
  } as unknown as MessagePublisher;

  const options = {
    projectRoot: '/test/root',
    anchorId: 'test-anchor',
    addSystemMessage: mockAddSystemMessage,
    originalSendMessage: mockOriginalSendMessage,
    messageQueueRef: { current: mockMessageQueue },
    messagePublisherRef: { current: mockMessagePublisher },
    setStreamingPaste: mockSetStreamingPaste,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle /pending command', async () => {
    const { result } = renderHook(() => useSlashCommands(options));

    vi.mocked(mockMessageQueue.getMessages).mockResolvedValue([
      {
        id: 'msg-1',
        from: 'agent-1',
        timestamp: Date.now(),
        content: { message: 'Hello' },
        status: 'pending',
        topic: 'test',
      },
    ]);

    const handled = await result.current.handleSlashCommand('/pending');

    expect(handled).toBe(true);
    expect(mockMessageQueue.getMessages).toHaveBeenCalledWith('pending');
    expect(mockAddSystemMessage).toHaveBeenCalledWith(
      expect.stringContaining('📬 Pending Messages (1)')
    );
  });

  it('should handle /inject command', async () => {
    const { result } = renderHook(() => useSlashCommands(options));

    vi.mocked(mockMessageQueue.getMessage).mockResolvedValue({
      id: 'msg-1',
      from: 'agent-1',
      timestamp: Date.now(),
      content: { message: 'Injected content' },
      status: 'pending',
      topic: 'test',
    });

    const handled = await result.current.handleSlashCommand('/inject msg-1');

    expect(handled).toBe(true);
    expect(mockMessageQueue.getMessage).toHaveBeenCalledWith('msg-1');
    expect(mockMessageQueue.updateStatus).toHaveBeenCalledWith(
      'msg-1',
      'injected'
    );
    expect(mockOriginalSendMessage).toHaveBeenCalledWith(
      expect.stringContaining('📨 **Injected Message from agent-1**')
    );
    expect(mockOriginalSendMessage).toHaveBeenCalledWith(
      expect.stringContaining('Injected content')
    );
  });

  it('should return false for non-slash commands', async () => {
    const { result } = renderHook(() => useSlashCommands(options));

    const handled = await result.current.handleSlashCommand('Hello world');

    expect(handled).toBe(false);
    expect(mockAddSystemMessage).not.toHaveBeenCalled();
    expect(mockOriginalSendMessage).not.toHaveBeenCalled();
  });

  it('should show usage for /send without arguments', async () => {
    const { result } = renderHook(() => useSlashCommands(options));

    const handled = await result.current.handleSlashCommand('/send');

    expect(handled).toBe(true);
    expect(mockAddSystemMessage).toHaveBeenCalledWith(
      expect.stringContaining('Usage: /send <alias> <message>')
    );
  });
});
