import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { MessageQueue } from '../MessageQueue';

describe('MessageQueue', () => {
  let tempDir: string;
  let queue: MessageQueue;
  const agentId = 'claude-test123';

  beforeEach(async () => {
    // Create temporary directory for testing (use crypto for uniqueness)
    tempDir = path.join(
      os.tmpdir(),
      `msgqueue-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(tempDir);

    queue = new MessageQueue(agentId, tempDir);
    await queue.initialize();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  describe('initialization', () => {
    it('creates queue directory and index', async () => {
      const queueDir = path.join(tempDir, 'message_queue', agentId);
      const indexPath = path.join(queueDir, 'queue-index.json');

      expect(await fs.pathExists(queueDir)).toBe(true);
      expect(await fs.pathExists(indexPath)).toBe(true);

      const index = await fs.readJson(indexPath);
      expect(index.total).toBe(0);
      expect(index.pending).toBe(0);
    });
  });

  describe('enqueue', () => {
    it('adds a new message to the queue', async () => {
      const messageId = await queue.enqueue({
        from: 'opus-abc',
        to: agentId,
        topic: 'code.review_completed',
        content: { files: ['test.ts'], approved: true },
        timestamp: Date.now(),
      });

      expect(messageId).toBeTruthy();

      const message = await queue.getMessage(messageId);
      expect(message).not.toBeNull();
      expect(message?.from).toBe('opus-abc');
      expect(message?.to).toBe(agentId);
      expect(message?.status).toBe('pending');
    });

    it('updates the index with pending count', async () => {
      await queue.enqueue({
        from: 'opus-abc',
        to: agentId,
        topic: 'test.topic',
        content: {},
        timestamp: Date.now(),
      });

      const stats = await queue.getStats();
      expect(stats.total).toBe(1);
      expect(stats.pending).toBe(1);
    });

    it('supports multiple messages', async () => {
      const id1 = await queue.enqueue({
        from: 'opus-abc',
        to: agentId,
        topic: 'test.topic1',
        content: {},
        timestamp: Date.now(),
      });

      const id2 = await queue.enqueue({
        from: 'gemini-def',
        to: agentId,
        topic: 'test.topic2',
        content: {},
        timestamp: Date.now(),
      });

      expect(id1).not.toBe(id2);

      const stats = await queue.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
    });
  });

  describe('getMessages', () => {
    beforeEach(async () => {
      // Add some test messages
      await queue.enqueue({
        from: 'opus-abc',
        to: agentId,
        topic: 'test.topic1',
        content: {},
        timestamp: Date.now(),
      });

      const id2 = await queue.enqueue({
        from: 'gemini-def',
        to: agentId,
        topic: 'test.topic2',
        content: {},
        timestamp: Date.now() + 1000,
      });

      // Mark second message as read
      await queue.updateStatus(id2, 'read');
    });

    it('returns all messages when no filter', async () => {
      const messages = await queue.getMessages();
      expect(messages).toHaveLength(2);
    });

    it('filters by status', async () => {
      const pending = await queue.getMessages('pending');
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe('pending');

      const read = await queue.getMessages('read');
      expect(read).toHaveLength(1);
      expect(read[0].status).toBe('read');
    });

    it('sorts messages by timestamp (newest first)', async () => {
      const messages = await queue.getMessages();
      expect(messages[0].topic).toBe('test.topic2'); // Newer
      expect(messages[1].topic).toBe('test.topic1'); // Older
    });
  });

  describe('updateStatus', () => {
    it('updates message status', async () => {
      const id = await queue.enqueue({
        from: 'opus-abc',
        to: agentId,
        topic: 'test.topic',
        content: {},
        timestamp: Date.now(),
      });

      await queue.updateStatus(id, 'read');

      const message = await queue.getMessage(id);
      expect(message?.status).toBe('read');
    });

    it('updates index counts when status changes', async () => {
      const id = await queue.enqueue({
        from: 'opus-abc',
        to: agentId,
        topic: 'test.topic',
        content: {},
        timestamp: Date.now(),
      });

      let stats = await queue.getStats();
      expect(stats.pending).toBe(1);
      expect(stats.read).toBe(0);

      await queue.updateStatus(id, 'read');

      stats = await queue.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.read).toBe(1);
    });

    it('throws error for non-existent message', async () => {
      await expect(
        queue.updateStatus('non-existent-id', 'read')
      ).rejects.toThrow('Message not found');
    });
  });

  describe('deleteMessage', () => {
    it('removes message from queue', async () => {
      const id = await queue.enqueue({
        from: 'opus-abc',
        to: agentId,
        topic: 'test.topic',
        content: {},
        timestamp: Date.now(),
      });

      await queue.deleteMessage(id);

      const message = await queue.getMessage(id);
      expect(message).toBeNull();
    });

    it('updates index counts', async () => {
      const id = await queue.enqueue({
        from: 'opus-abc',
        to: agentId,
        topic: 'test.topic',
        content: {},
        timestamp: Date.now(),
      });

      let stats = await queue.getStats();
      expect(stats.total).toBe(1);
      expect(stats.pending).toBe(1);

      await queue.deleteMessage(id);

      stats = await queue.getStats();
      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
    });
  });

  describe('clearDismissed', () => {
    it('removes all dismissed messages', async () => {
      const id1 = await queue.enqueue({
        from: 'opus-abc',
        to: agentId,
        topic: 'test.topic1',
        content: {},
        timestamp: Date.now(),
      });

      const id2 = await queue.enqueue({
        from: 'gemini-def',
        to: agentId,
        topic: 'test.topic2',
        content: {},
        timestamp: Date.now(),
      });

      await queue.updateStatus(id1, 'dismissed');
      await queue.updateStatus(id2, 'dismissed');

      const cleared = await queue.clearDismissed();
      expect(cleared).toBe(2);

      const messages = await queue.getMessages();
      expect(messages).toHaveLength(0);

      const stats = await queue.getStats();
      expect(stats.total).toBe(0);
      expect(stats.dismissed).toBe(0);
    });

    it('only removes dismissed messages', async () => {
      const id1 = await queue.enqueue({
        from: 'opus-abc',
        to: agentId,
        topic: 'test.topic1',
        content: {},
        timestamp: Date.now(),
      });

      const id2 = await queue.enqueue({
        from: 'gemini-def',
        to: agentId,
        topic: 'test.topic2',
        content: {},
        timestamp: Date.now(),
      });

      await queue.updateStatus(id1, 'dismissed');
      await queue.updateStatus(id2, 'read');

      const cleared = await queue.clearDismissed();
      expect(cleared).toBe(1);

      const messages = await queue.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].status).toBe('read');
    });
  });

  describe('getPendingCount', () => {
    it('returns pending message count via index', async () => {
      expect(await queue.getPendingCount()).toBe(0);

      await queue.enqueue({
        from: 'opus-abc',
        to: agentId,
        topic: 'test.topic',
        content: {},
        timestamp: Date.now(),
      });

      expect(await queue.getPendingCount()).toBe(1);

      await queue.enqueue({
        from: 'gemini-def',
        to: agentId,
        topic: 'test.topic',
        content: {},
        timestamp: Date.now(),
      });

      expect(await queue.getPendingCount()).toBe(2);
    });

    it('updates when status changes', async () => {
      const id = await queue.enqueue({
        from: 'opus-abc',
        to: agentId,
        topic: 'test.topic',
        content: {},
        timestamp: Date.now(),
      });

      expect(await queue.getPendingCount()).toBe(1);

      await queue.updateStatus(id, 'read');

      expect(await queue.getPendingCount()).toBe(0);
    });
  });

  describe('getStats', () => {
    it('returns comprehensive queue statistics', async () => {
      const id1 = await queue.enqueue({
        from: 'opus-abc',
        to: agentId,
        topic: 'test.topic1',
        content: {},
        timestamp: Date.now(),
      });

      const id2 = await queue.enqueue({
        from: 'gemini-def',
        to: agentId,
        topic: 'test.topic2',
        content: {},
        timestamp: Date.now(),
      });

      await queue.updateStatus(id1, 'read');
      await queue.updateStatus(id2, 'injected');

      const stats = await queue.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(0);
      expect(stats.read).toBe(1);
      expect(stats.injected).toBe(1);
      expect(stats.dismissed).toBe(0);
      expect(stats.lastUpdated).toBeGreaterThan(0);
    });
  });
});
