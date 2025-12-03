/**
 * End-to-End Tests for Agent-to-Agent Messaging
 *
 * These tests verify the complete flow:
 * MessagePublisher → ZeroMQBus → MessageQueueMonitor → MessageQueue
 *
 * This simulates real agent communication between TUI instances.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ZeroMQBus } from '../ZeroMQBus.js';
import { MessagePublisher } from '../MessagePublisher.js';
import { MessageQueueMonitor } from '../MessageQueueMonitor.js';
import { MessageQueue } from '../MessageQueue.js';

describe('Agent Messaging E2E', () => {
  let testId: string;
  let busAddress: string;
  let tempDir: string;

  // Agent 1 (opus) - will be Bus Master
  let opus1Bus: ZeroMQBus;
  let opus1Publisher: MessagePublisher;
  let opus1Monitor: MessageQueueMonitor;
  let opus1Queue: MessageQueue;
  const opus1AgentId = 'opus-test-agent-1';
  let opus1ActualId: string; // Actual ID with suffix

  // Agent 2 (sonnet) - will be Peer
  let sonnet1Bus: ZeroMQBus;
  let sonnet1Publisher: MessagePublisher;
  let sonnet1Monitor: MessageQueueMonitor;
  let sonnet1Queue: MessageQueue;
  const sonnet1AgentId = 'sonnet-test-agent-1';
  let sonnet1ActualId: string; // Actual ID with suffix

  beforeEach(async () => {
    // Generate unique test ID
    testId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    busAddress = `ipc://${path.join(os.tmpdir(), `cognition-bus-${testId}.sock`)}`;

    // Create temp directory for message queues
    tempDir = path.join(os.tmpdir(), `agent-msg-test-${testId}`);
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    // Stop monitors first
    if (opus1Monitor?.isRunning()) await opus1Monitor.stop();
    if (sonnet1Monitor?.isRunning()) await sonnet1Monitor.stop();

    // Close buses
    await opus1Bus?.close().catch(() => {});
    await sonnet1Bus?.close().catch(() => {});

    // Give ZeroMQ context time to fully terminate to avoid segfaults
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Clean up temp directory
    await fs.remove(tempDir).catch(() => {});
  });

  afterAll(async () => {
    // Final cleanup delay to let ZeroMQ context fully terminate
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  async function setupOpus1AsBusMaster() {
    opus1Bus = new ZeroMQBus({ address: busAddress });
    await opus1Bus.bind();

    const topics = ['agent.message', 'agent.notification', 'code.*'];
    opus1Monitor = new MessageQueueMonitor(
      opus1AgentId,
      opus1Bus,
      topics,
      tempDir,
      'opus'
    );
    await opus1Monitor.start();

    opus1Queue = opus1Monitor.getQueue();

    // Use the monitor's actual agent ID (with suffix) for the publisher
    opus1ActualId = opus1Queue.getAgentId();
    opus1Publisher = new MessagePublisher(opus1Bus, opus1ActualId);
  }

  async function setupSonnet1AsPeer() {
    sonnet1Bus = new ZeroMQBus({ address: busAddress });
    await sonnet1Bus.connect();

    const topics = ['agent.message', 'agent.notification', 'code.*'];
    sonnet1Monitor = new MessageQueueMonitor(
      sonnet1AgentId,
      sonnet1Bus,
      topics,
      tempDir,
      'sonnet'
    );
    await sonnet1Monitor.start();

    sonnet1Queue = sonnet1Monitor.getQueue();

    // Use the monitor's actual agent ID (with suffix) for the publisher
    sonnet1ActualId = sonnet1Queue.getAgentId();
    sonnet1Publisher = new MessagePublisher(sonnet1Bus, sonnet1ActualId);
  }

  describe('Complete messaging flow', () => {
    it('opus1 sends message to sonnet1 and it appears in queue', async () => {
      // Setup both agents
      await setupOpus1AsBusMaster();
      await setupSonnet1AsPeer();

      // Wait for connections to establish
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify initial queue state
      expect(await sonnet1Queue.getPendingCount()).toBe(0);

      // opus1 sends message to sonnet1
      await opus1Publisher.sendMessage(sonnet1ActualId, 'Hello from opus1!');

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify message arrived in sonnet1's queue
      const pendingCount = await sonnet1Queue.getPendingCount();
      expect(pendingCount).toBe(1);

      const messages = await sonnet1Queue.getMessages('pending');
      expect(messages).toHaveLength(1);
      expect(messages[0].from).toBe(opus1ActualId);
      expect(messages[0].to).toBe(sonnet1ActualId);
      expect(messages[0].topic).toBe('agent.message');

      // Check payload content
      const payload = messages[0].content as { type: string; message: string };
      expect(payload.message).toBe('Hello from opus1!');
    });

    it('sonnet1 sends message to opus1 and it appears in queue', async () => {
      // Setup both agents
      await setupOpus1AsBusMaster();
      await setupSonnet1AsPeer();

      await new Promise((resolve) => setTimeout(resolve, 200));

      // sonnet1 sends message to opus1
      await sonnet1Publisher.sendMessage(opus1ActualId, 'Hello from sonnet1!');

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify message arrived in opus1's queue
      const pendingCount = await opus1Queue.getPendingCount();
      expect(pendingCount).toBe(1);

      const messages = await opus1Queue.getMessages('pending');
      expect(messages).toHaveLength(1);
      expect(messages[0].from).toBe(sonnet1ActualId);
      expect(messages[0].to).toBe(opus1ActualId);
    });

    it('bidirectional messaging works', async () => {
      await setupOpus1AsBusMaster();
      await setupSonnet1AsPeer();

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Send messages in both directions
      await opus1Publisher.sendMessage(
        sonnet1ActualId,
        'Message 1: opus→sonnet'
      );
      await sonnet1Publisher.sendMessage(
        opus1ActualId,
        'Message 2: sonnet→opus'
      );

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify both queues have messages
      expect(await opus1Queue.getPendingCount()).toBe(1);
      expect(await sonnet1Queue.getPendingCount()).toBe(1);

      // Verify correct messages in each queue
      const opus1Messages = await opus1Queue.getMessages('pending');
      expect(opus1Messages[0].from).toBe(sonnet1ActualId);

      const sonnet1Messages = await sonnet1Queue.getMessages('pending');
      expect(sonnet1Messages[0].from).toBe(opus1ActualId);
    });

    it('code review request flows through correctly', async () => {
      await setupOpus1AsBusMaster();
      await setupSonnet1AsPeer();

      await new Promise((resolve) => setTimeout(resolve, 200));

      // sonnet1 requests code review from opus1
      await sonnet1Publisher.requestCodeReview(
        opus1ActualId,
        ['src/index.ts', 'src/utils.ts'],
        'Please review my changes to the authentication module'
      );

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify opus1 received the code review request
      const messages = await opus1Queue.getMessages('pending');
      expect(messages).toHaveLength(1);
      expect(messages[0].topic).toBe('code.review_request');

      const payload = messages[0].content as {
        files: string[];
        context: string;
        requestedBy: string;
      };
      expect(payload.files).toEqual(['src/index.ts', 'src/utils.ts']);
      expect(payload.context).toBe(
        'Please review my changes to the authentication module'
      );
      expect(payload.requestedBy).toBe(sonnet1ActualId);
    });

    it('task completion notification flows correctly', async () => {
      await setupOpus1AsBusMaster();
      await setupSonnet1AsPeer();

      await new Promise((resolve) => setTimeout(resolve, 200));

      // sonnet1 notifies opus1 of task completion
      await sonnet1Publisher.notifyTaskComplete(
        opus1ActualId,
        'Implemented authentication module with OAuth2 support'
      );

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify opus1 received the notification
      const messages = await opus1Queue.getMessages('pending');
      expect(messages).toHaveLength(1);
      expect(messages[0].topic).toBe('agent.notification');

      const payload = messages[0].content as {
        type: string;
        description: string;
      };
      expect(payload.type).toBe('task_complete');
      expect(payload.description).toBe(
        'Implemented authentication module with OAuth2 support'
      );
    });

    it('broadcast message reaches all agents', async () => {
      await setupOpus1AsBusMaster();
      await setupSonnet1AsPeer();

      await new Promise((resolve) => setTimeout(resolve, 200));

      // opus1 broadcasts a message
      await opus1Publisher.broadcast('agent.notification', {
        type: 'system_announcement',
        message: 'System maintenance in 5 minutes',
      });

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Both agents should receive the broadcast
      // (note: sender also receives via broker, which is expected behavior)
      const sonnet1Messages = await sonnet1Queue.getMessages('pending');

      // At least sonnet1 should have the message
      expect(sonnet1Messages.length).toBeGreaterThanOrEqual(1);

      const sonnetBroadcast = sonnet1Messages.find(
        (m) => (m.content as { type: string }).type === 'system_announcement'
      );
      expect(sonnetBroadcast).toBeDefined();
      expect(sonnetBroadcast?.to).toBe('*');
    });
  });

  describe('Message filtering', () => {
    it('messages not addressed to agent are ignored', async () => {
      await setupOpus1AsBusMaster();
      await setupSonnet1AsPeer();

      await new Promise((resolve) => setTimeout(resolve, 200));

      // opus1 sends message to a different agent (not sonnet1)
      await opus1Publisher.sendMessage(
        'other-agent-id',
        'This should not reach sonnet1'
      );

      await new Promise((resolve) => setTimeout(resolve, 300));

      // sonnet1's queue should be empty
      expect(await sonnet1Queue.getPendingCount()).toBe(0);
    });
  });

  describe('Queue status tracking', () => {
    it('pending count updates correctly as messages arrive', async () => {
      await setupOpus1AsBusMaster();
      await setupSonnet1AsPeer();

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Initial count
      expect(await sonnet1Monitor.getPendingCount()).toBe(0);

      // Send multiple messages
      await opus1Publisher.sendMessage(sonnet1ActualId, 'Message 1');
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(await sonnet1Monitor.getPendingCount()).toBe(1);

      await opus1Publisher.sendMessage(sonnet1ActualId, 'Message 2');
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(await sonnet1Monitor.getPendingCount()).toBe(2);

      await opus1Publisher.sendMessage(sonnet1ActualId, 'Message 3');
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(await sonnet1Monitor.getPendingCount()).toBe(3);
    });

    it('message status can be updated', async () => {
      await setupOpus1AsBusMaster();
      await setupSonnet1AsPeer();

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Send a message
      await opus1Publisher.sendMessage(sonnet1ActualId, 'Test message');
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Get the message and update status
      const messages = await sonnet1Queue.getMessages('pending');
      expect(messages).toHaveLength(1);

      await sonnet1Queue.updateStatus(messages[0].id, 'read');

      // Verify status changed
      const updatedMessage = await sonnet1Queue.getMessage(messages[0].id);
      expect(updatedMessage?.status).toBe('read');

      // Pending count should be 0 now
      expect(await sonnet1Queue.getPendingCount()).toBe(0);
    });
  });

  describe('Agent info', () => {
    it('agent info files are created correctly', async () => {
      await setupOpus1AsBusMaster();
      await setupSonnet1AsPeer();

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check that agent-info.json files exist
      const opus1InfoPath = path.join(
        tempDir,
        'message_queue',
        opus1ActualId,
        'agent-info.json'
      );
      const sonnet1InfoPath = path.join(
        tempDir,
        'message_queue',
        sonnet1ActualId,
        'agent-info.json'
      );

      expect(await fs.pathExists(opus1InfoPath)).toBe(true);
      expect(await fs.pathExists(sonnet1InfoPath)).toBe(true);

      // Verify content
      const opus1Info = await fs.readJson(opus1InfoPath);
      expect(opus1Info.agentId).toBe(opus1ActualId);
      expect(opus1Info.model).toBe('opus');
      expect(opus1Info.status).toBe('active');

      const sonnet1Info = await fs.readJson(sonnet1InfoPath);
      expect(sonnet1Info.agentId).toBe(sonnet1ActualId);
      expect(sonnet1Info.model).toBe('sonnet');
      expect(sonnet1Info.status).toBe('active');
    });

    it('agent status updates to disconnected on stop', async () => {
      await setupOpus1AsBusMaster();
      await setupSonnet1AsPeer();

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Stop sonnet1's monitor
      await sonnet1Monitor.stop();

      // Check status
      const sonnet1InfoPath = path.join(
        tempDir,
        'message_queue',
        sonnet1ActualId,
        'agent-info.json'
      );
      const sonnet1Info = await fs.readJson(sonnet1InfoPath);
      expect(sonnet1Info.status).toBe('disconnected');
    });
  });
});
