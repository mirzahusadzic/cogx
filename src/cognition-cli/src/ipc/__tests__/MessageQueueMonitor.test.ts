import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { MessageQueueMonitor } from '../MessageQueueMonitor';
import { ZeroMQBus } from '../ZeroMQBus';
import { AgentMessage } from '../AgentMessage';

// Mock ZeroMQBus
vi.mock('../ZeroMQBus');

describe('MessageQueueMonitor', () => {
  let tempDir: string;
  let monitor: MessageQueueMonitor;
  let mockBus: ZeroMQBus;
  const agentId = 'claude-test123';
  let actualAgentId: string; // Actual agent ID with suffix
  const topics = ['code.*', 'arch.proposal_ready'];

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = path.join(
      os.tmpdir(),
      `msgqueue-monitor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(tempDir);

    // Create mock bus
    mockBus = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
    } as unknown as ZeroMQBus;

    monitor = new MessageQueueMonitor(agentId, mockBus, topics, tempDir);

    // The monitor adds a unique suffix to agentId, so we need to wait for start() to get it
    // For now, we'll get it from the queue after the monitor is initialized
  });

  afterEach(async () => {
    // Stop monitor if running
    if (monitor.isRunning()) {
      await monitor.stop();
    }

    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  describe('start/stop', () => {
    it('starts and subscribes to topics', async () => {
      await monitor.start();

      expect(monitor.isRunning()).toBe(true);
      expect(mockBus.subscribe).toHaveBeenCalledTimes(2);
      expect(mockBus.subscribe).toHaveBeenCalledWith(
        'code.*',
        expect.any(Function)
      );
      expect(mockBus.subscribe).toHaveBeenCalledWith(
        'arch.proposal_ready',
        expect.any(Function)
      );
    });

    it('stops and unsubscribes from topics', async () => {
      await monitor.start();
      await monitor.stop();

      expect(monitor.isRunning()).toBe(false);
      expect(mockBus.unsubscribe).toHaveBeenCalledTimes(2);
    });

    it('throws error when starting twice', async () => {
      await monitor.start();
      await expect(monitor.start()).rejects.toThrow(
        'MessageQueueMonitor is already running'
      );
    });

    it('handles stop when not running', async () => {
      await expect(monitor.stop()).resolves.not.toThrow();
    });
  });

  describe('message handling', () => {
    it('queues messages addressed to this agent', async () => {
      await monitor.start();

      // Get the actual agent ID (with suffix) from the queue
      actualAgentId = monitor.getQueue().getAgentId();

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'opus-abc',
        to: actualAgentId, // Use actual ID with suffix
        topic: 'code.review_completed',
        timestamp: Date.now(),
        payload: { files: ['test.ts'], approved: true },
      };

      // Simulate message from bus by calling the handler directly
      const handler = (mockBus.subscribe as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      await handler(message);

      const queue = monitor.getQueue();
      const messages = await queue.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].from).toBe('opus-abc');
      expect(messages[0].topic).toBe('code.review_completed');
    });

    it('queues broadcast messages (*)', async () => {
      await monitor.start();

      const message: AgentMessage = {
        id: 'msg-2',
        from: 'gemini-def',
        to: '*', // Broadcast
        topic: 'agent.status_changed',
        timestamp: Date.now(),
        payload: { status: 'idle' },
      };

      const handler = (mockBus.subscribe as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      await handler(message);

      const queue = monitor.getQueue();
      const messages = await queue.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].from).toBe('gemini-def');
    });

    it('ignores messages not addressed to this agent', async () => {
      await monitor.start();

      const message: AgentMessage = {
        id: 'msg-3',
        from: 'opus-abc',
        to: 'other-agent-id', // Not for us
        topic: 'code.review_completed',
        timestamp: Date.now(),
        payload: {},
      };

      const handler = (mockBus.subscribe as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      await handler(message);

      const queue = monitor.getQueue();
      const messages = await queue.getMessages();
      expect(messages).toHaveLength(0); // Should be ignored
    });

    it('handles multiple messages', async () => {
      await monitor.start();

      // Get the actual agent ID (with suffix) from the queue
      actualAgentId = monitor.getQueue().getAgentId();

      const messages: AgentMessage[] = [
        {
          id: 'msg-4',
          from: 'opus-abc',
          to: actualAgentId,
          topic: 'code.review_completed',
          timestamp: Date.now(),
          payload: {},
        },
        {
          id: 'msg-5',
          from: 'gemini-def',
          to: actualAgentId,
          topic: 'arch.proposal_ready',
          timestamp: Date.now() + 1000,
          payload: {},
        },
      ];

      const handler = (mockBus.subscribe as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      for (const msg of messages) {
        await handler(msg);
      }

      const queue = monitor.getQueue();
      const queuedMessages = await queue.getMessages();
      expect(queuedMessages).toHaveLength(2);
    });

    it('does not queue messages when stopped', async () => {
      await monitor.start();

      // Get the actual agent ID before stopping
      actualAgentId = monitor.getQueue().getAgentId();

      await monitor.stop();

      const message: AgentMessage = {
        id: 'msg-6',
        from: 'opus-abc',
        to: actualAgentId,
        topic: 'code.review_completed',
        timestamp: Date.now(),
        payload: {},
      };

      const handler = (mockBus.subscribe as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      await handler(message);

      const queue = monitor.getQueue();
      const messages = await queue.getMessages();
      expect(messages).toHaveLength(0); // Should not be queued when stopped
    });
  });

  describe('getPendingCount', () => {
    it('returns pending message count', async () => {
      await monitor.start();

      // Get the actual agent ID (with suffix) from the queue
      actualAgentId = monitor.getQueue().getAgentId();

      expect(await monitor.getPendingCount()).toBe(0);

      const message: AgentMessage = {
        id: 'msg-7',
        from: 'opus-abc',
        to: actualAgentId,
        topic: 'code.review_completed',
        timestamp: Date.now(),
        payload: {},
      };

      const handler = (mockBus.subscribe as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      await handler(message);

      expect(await monitor.getPendingCount()).toBe(1);
    });
  });

  describe('topic management', () => {
    it('subscribes to additional topic', async () => {
      await monitor.start();

      monitor.subscribeToTopic('security.*');

      expect(mockBus.subscribe).toHaveBeenCalledWith(
        'security.*',
        expect.any(Function)
      );
      expect(monitor.getTopics()).toContain('security.*');
    });

    it('does not subscribe to duplicate topic', async () => {
      await monitor.start();

      const initialCallCount = (mockBus.subscribe as ReturnType<typeof vi.fn>)
        .mock.calls.length;

      monitor.subscribeToTopic('code.*'); // Already subscribed

      const finalCallCount = (mockBus.subscribe as ReturnType<typeof vi.fn>)
        .mock.calls.length;

      expect(finalCallCount).toBe(initialCallCount); // No new subscription
    });

    it('unsubscribes from topic', async () => {
      await monitor.start();

      monitor.unsubscribeFromTopic('code.*');

      expect(mockBus.unsubscribe).toHaveBeenCalledWith(
        'code.*',
        expect.any(Function)
      );
      expect(monitor.getTopics()).not.toContain('code.*');
    });

    it('handles unsubscribe from non-existent topic', () => {
      monitor.unsubscribeFromTopic('non-existent-topic');
      expect(mockBus.unsubscribe).not.toHaveBeenCalled();
    });
  });

  describe('getQueue', () => {
    it('returns queue instance', () => {
      const queue = monitor.getQueue();
      expect(queue).toBeDefined();
    });
  });
});
