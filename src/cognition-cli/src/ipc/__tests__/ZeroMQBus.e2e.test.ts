/**
 * End-to-End Tests for ZeroMQ Bus
 *
 * These tests verify the actual ZeroMQ message passing between multiple
 * bus instances, simulating real agent-to-agent communication.
 *
 * Test scenarios:
 * 1. Bus Master ↔ Peer communication
 * 2. Peer ↔ Peer communication (via broker)
 * 3. Broadcast messages
 * 4. Topic filtering
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { ZeroMQBus } from '../ZeroMQBus.js';
import { AgentMessage } from '../AgentMessage.js';

describe('ZeroMQBus E2E', () => {
  // Use unique addresses for each test to prevent conflicts
  let testId: string;
  let busAddress: string;
  let busMaster: ZeroMQBus;
  let peer1: ZeroMQBus;
  let peer2: ZeroMQBus;

  beforeEach(() => {
    // Generate unique test ID for socket paths
    testId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    busAddress = `ipc://${path.join(os.tmpdir(), `cognition-bus-${testId}.sock`)}`;
  });

  afterEach(async () => {
    // Clean up all bus instances
    const buses = [busMaster, peer1, peer2].filter(Boolean);
    await Promise.all(buses.map((bus) => bus?.close().catch(() => {})));

    // Give ZeroMQ context time to fully terminate to avoid segfaults
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterAll(async () => {
    // Final cleanup delay to let ZeroMQ context fully terminate
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('Basic connectivity', () => {
    it('Bus Master can bind and start', async () => {
      busMaster = new ZeroMQBus({ address: busAddress });
      await busMaster.bind();

      const stats = busMaster.getStats();
      expect(stats.started).toBe(true);
      expect(stats.isBroker).toBe(true);
    });

    it('Peer can connect to Bus Master', async () => {
      busMaster = new ZeroMQBus({ address: busAddress });
      await busMaster.bind();

      peer1 = new ZeroMQBus({ address: busAddress });
      await peer1.connect();

      const stats = peer1.getStats();
      expect(stats.started).toBe(true);
      expect(stats.isBroker).toBe(false);
    });

    it('Multiple peers can connect', async () => {
      busMaster = new ZeroMQBus({ address: busAddress });
      await busMaster.bind();

      peer1 = new ZeroMQBus({ address: busAddress });
      await peer1.connect();

      peer2 = new ZeroMQBus({ address: busAddress });
      await peer2.connect();

      expect(peer1.getStats().started).toBe(true);
      expect(peer2.getStats().started).toBe(true);
    });
  });

  describe('Message passing', () => {
    it('Peer receives message from Bus Master', async () => {
      // Setup
      busMaster = new ZeroMQBus({ address: busAddress });
      await busMaster.bind();

      peer1 = new ZeroMQBus({ address: busAddress });
      await peer1.connect();

      // Give sockets time to establish connection
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Subscribe peer to topic
      const receivedMessages: AgentMessage[] = [];
      peer1.subscribe('test.topic', (msg) => {
        receivedMessages.push(msg);
      });

      // Wait for subscription to propagate through broker
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send message from Bus Master
      const testMessage: AgentMessage = {
        id: 'msg-1',
        from: 'bus-master',
        to: 'peer-1',
        topic: 'test.topic',
        payload: { hello: 'world' },
        timestamp: Date.now(),
      };

      busMaster.publish('test.topic', testMessage);

      // Wait for message delivery
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].from).toBe('bus-master');
      expect(receivedMessages[0].payload).toEqual({ hello: 'world' });
    });

    it('Bus Master receives message from Peer', async () => {
      // Setup
      busMaster = new ZeroMQBus({ address: busAddress });
      await busMaster.bind();

      peer1 = new ZeroMQBus({ address: busAddress });
      await peer1.connect();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Subscribe Bus Master to topic
      const receivedMessages: AgentMessage[] = [];
      busMaster.subscribe('agent.message', (msg) => {
        receivedMessages.push(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send message from Peer
      const testMessage: AgentMessage = {
        id: 'msg-2',
        from: 'peer-1',
        to: 'bus-master',
        topic: 'agent.message',
        payload: { message: 'hello from peer' },
        timestamp: Date.now(),
      };

      peer1.publish('agent.message', testMessage);

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].from).toBe('peer-1');
      expect(receivedMessages[0].payload).toEqual({
        message: 'hello from peer',
      });
    });

    it('Peer1 receives message from Peer2 (via broker)', async () => {
      // Setup - this is the critical test for agent-to-agent messaging
      busMaster = new ZeroMQBus({ address: busAddress });
      await busMaster.bind();

      peer1 = new ZeroMQBus({ address: busAddress });
      await peer1.connect();

      peer2 = new ZeroMQBus({ address: busAddress });
      await peer2.connect();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Subscribe Peer1 to topic
      const receivedMessages: AgentMessage[] = [];
      peer1.subscribe('agent.message', (msg) => {
        receivedMessages.push(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send message from Peer2 to Peer1
      const testMessage: AgentMessage = {
        id: 'msg-3',
        from: 'peer-2',
        to: 'peer-1',
        topic: 'agent.message',
        payload: { message: 'hello from peer 2' },
        timestamp: Date.now(),
      };

      peer2.publish('agent.message', testMessage);

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify - message should have been forwarded by broker
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].from).toBe('peer-2');
      expect(receivedMessages[0].to).toBe('peer-1');
      expect(receivedMessages[0].payload).toEqual({
        message: 'hello from peer 2',
      });
    });

    it('Bidirectional communication works between peers', async () => {
      // Setup
      busMaster = new ZeroMQBus({ address: busAddress });
      await busMaster.bind();

      peer1 = new ZeroMQBus({ address: busAddress });
      await peer1.connect();

      peer2 = new ZeroMQBus({ address: busAddress });
      await peer2.connect();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Subscribe both peers
      const peer1Received: AgentMessage[] = [];
      const peer2Received: AgentMessage[] = [];

      peer1.subscribe('agent.message', (msg) => {
        peer1Received.push(msg);
      });

      peer2.subscribe('agent.message', (msg) => {
        peer2Received.push(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send messages in both directions
      const msg1to2: AgentMessage = {
        id: 'msg-4',
        from: 'peer-1',
        to: 'peer-2',
        topic: 'agent.message',
        payload: { direction: '1->2' },
        timestamp: Date.now(),
      };

      const msg2to1: AgentMessage = {
        id: 'msg-5',
        from: 'peer-2',
        to: 'peer-1',
        topic: 'agent.message',
        payload: { direction: '2->1' },
        timestamp: Date.now(),
      };

      peer1.publish('agent.message', msg1to2);
      peer2.publish('agent.message', msg2to1);

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Both peers should receive messages (note: they receive their own messages too via broker)
      // Peer1 should have received msg2to1
      const peer1FromPeer2 = peer1Received.find((m) => m.from === 'peer-2');
      expect(peer1FromPeer2).toBeDefined();
      expect(peer1FromPeer2?.payload).toEqual({ direction: '2->1' });

      // Peer2 should have received msg1to2
      const peer2FromPeer1 = peer2Received.find((m) => m.from === 'peer-1');
      expect(peer2FromPeer1).toBeDefined();
      expect(peer2FromPeer1?.payload).toEqual({ direction: '1->2' });
    });
  });

  describe('Topic filtering', () => {
    it('Only receives messages for subscribed topics', async () => {
      busMaster = new ZeroMQBus({ address: busAddress });
      await busMaster.bind();

      peer1 = new ZeroMQBus({ address: busAddress });
      await peer1.connect();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Subscribe to specific topic
      const receivedMessages: AgentMessage[] = [];
      peer1.subscribe('code.review', (msg) => {
        receivedMessages.push(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send messages to different topics
      const codeReviewMsg: AgentMessage = {
        id: 'msg-6',
        from: 'master',
        to: 'peer-1',
        topic: 'code.review',
        payload: { type: 'code.review' },
        timestamp: Date.now(),
      };

      const otherMsg: AgentMessage = {
        id: 'msg-7',
        from: 'master',
        to: 'peer-1',
        topic: 'agent.status',
        payload: { type: 'agent.status' },
        timestamp: Date.now(),
      };

      busMaster.publish('code.review', codeReviewMsg);
      busMaster.publish('agent.status', otherMsg);

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should only receive code.review message
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].topic).toBe('code.review');
    });

    it('Wildcard subscriptions work', async () => {
      busMaster = new ZeroMQBus({ address: busAddress });
      await busMaster.bind();

      peer1 = new ZeroMQBus({ address: busAddress });
      await peer1.connect();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Subscribe to wildcard topic
      const receivedMessages: AgentMessage[] = [];
      peer1.subscribe('code.*', (msg) => {
        receivedMessages.push(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send messages to various code.* topics
      const msg1: AgentMessage = {
        id: 'msg-8',
        from: 'master',
        to: 'peer-1',
        topic: 'code.review',
        payload: { type: 'review' },
        timestamp: Date.now(),
      };

      const msg2: AgentMessage = {
        id: 'msg-9',
        from: 'master',
        to: 'peer-1',
        topic: 'code.completed',
        payload: { type: 'completed' },
        timestamp: Date.now(),
      };

      const msg3: AgentMessage = {
        id: 'msg-10',
        from: 'master',
        to: 'peer-1',
        topic: 'agent.status',
        payload: { type: 'status' },
        timestamp: Date.now(),
      };

      busMaster.publish('code.review', msg1);
      busMaster.publish('code.completed', msg2);
      busMaster.publish('agent.status', msg3);

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should receive both code.* messages but not agent.status
      expect(receivedMessages).toHaveLength(2);
      expect(receivedMessages.map((m) => m.topic).sort()).toEqual([
        'code.completed',
        'code.review',
      ]);
    });
  });

  describe('Multiple subscribers', () => {
    it('Multiple subscribers on same topic all receive message', async () => {
      busMaster = new ZeroMQBus({ address: busAddress });
      await busMaster.bind();

      peer1 = new ZeroMQBus({ address: busAddress });
      await peer1.connect();

      peer2 = new ZeroMQBus({ address: busAddress });
      await peer2.connect();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Both peers subscribe to same topic
      const peer1Received: AgentMessage[] = [];
      const peer2Received: AgentMessage[] = [];
      const masterReceived: AgentMessage[] = [];

      peer1.subscribe('broadcast.announcement', (msg) => {
        peer1Received.push(msg);
      });

      peer2.subscribe('broadcast.announcement', (msg) => {
        peer2Received.push(msg);
      });

      busMaster.subscribe('broadcast.announcement', (msg) => {
        masterReceived.push(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send broadcast message
      const broadcast: AgentMessage = {
        id: 'msg-11',
        from: 'system',
        to: '*',
        topic: 'broadcast.announcement',
        payload: { announcement: 'Hello everyone!' },
        timestamp: Date.now(),
      };

      busMaster.publish('broadcast.announcement', broadcast);

      await new Promise((resolve) => setTimeout(resolve, 200));

      // All subscribers should receive the message
      expect(peer1Received).toHaveLength(1);
      expect(peer2Received).toHaveLength(1);
      expect(masterReceived).toHaveLength(1);

      expect(peer1Received[0].payload).toEqual({
        announcement: 'Hello everyone!',
      });
      expect(peer2Received[0].payload).toEqual({
        announcement: 'Hello everyone!',
      });
      expect(masterReceived[0].payload).toEqual({
        announcement: 'Hello everyone!',
      });
    });
  });

  describe('Cleanup', () => {
    it('Bus closes cleanly', async () => {
      busMaster = new ZeroMQBus({ address: busAddress });
      await busMaster.bind();

      peer1 = new ZeroMQBus({ address: busAddress });
      await peer1.connect();

      await busMaster.close();
      await peer1.close();

      expect(busMaster.getStats().started).toBe(false);
      expect(peer1.getStats().started).toBe(false);
    });
  });
});
