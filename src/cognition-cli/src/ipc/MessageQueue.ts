import fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

/**
 * Queued message from another agent
 */
export interface QueuedMessage {
  id: string; // Unique message ID
  from: string; // Sender agent ID (e.g., "opus-a7f3")
  to: string; // Recipient agent ID (e.g., "claude-b2c4")
  topic: string; // Event topic (e.g., "code.review_completed")
  content: unknown; // Message payload
  timestamp: number; // Unix timestamp (ms)
  status: MessageStatus;
}

export type MessageStatus = 'pending' | 'read' | 'injected' | 'dismissed';

/**
 * Queue index for fast pending count lookups
 */
interface QueueIndex {
  total: number;
  pending: number;
  read: number;
  injected: number;
  dismissed: number;
  lastUpdated: number;
}

/**
 * Persistent message queue storage
 *
 * Structure:
 * .sigma/message_queue/
 *   {agent-id}/
 *     msg-{id}.json      # Individual messages
 *     queue-index.json   # Fast lookup index
 */
export class MessageQueue {
  private queueDir: string;
  private indexPath: string;
  private emitter: EventEmitter;

  /**
   * @param agentId Unique agent ID (e.g., "claude-a7f3")
   * @param sigmaDir Path to .sigma directory (defaults to cwd)
   */
  constructor(
    private agentId: string,
    private sigmaDir: string = path.join(process.cwd(), '.sigma')
  ) {
    this.queueDir = path.join(sigmaDir, 'message_queue', agentId);
    this.indexPath = path.join(this.queueDir, 'queue-index.json');
    this.emitter = new EventEmitter();
  }

  /**
   * Subscribe to queue events
   * @param event Event name ('countChanged', 'messageAdded', 'error')
   * @param listener Event handler
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.emitter.on(event, listener);
  }

  /**
   * Unsubscribe from queue events
   */
  off(event: string, listener: (...args: unknown[]) => void): void {
    this.emitter.off(event, listener);
  }

  /**
   * Initialize queue directory and index
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.queueDir);

    // Create index if it doesn't exist
    if (!(await fs.pathExists(this.indexPath))) {
      await this.saveIndex({
        total: 0,
        pending: 0,
        read: 0,
        injected: 0,
        dismissed: 0,
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * Enqueue a new message
   */
  async enqueue(
    message: Omit<QueuedMessage, 'id' | 'status'>
  ): Promise<string> {
    const id = crypto.randomUUID();
    const queuedMessage: QueuedMessage = {
      ...message,
      id,
      status: 'pending',
    };

    // Write message file
    const messagePath = path.join(this.queueDir, `msg-${id}.json`);
    await fs.writeJson(messagePath, queuedMessage, { spaces: 2 });

    // Update index
    await this.incrementIndex('pending');

    // Emit events
    const pendingCount = await this.getPendingCount();
    this.emitter.emit('messageAdded', queuedMessage);
    this.emitter.emit('countChanged', pendingCount);

    return id;
  }

  /**
   * Get all messages with optional status filter
   */
  async getMessages(status?: MessageStatus): Promise<QueuedMessage[]> {
    await this.initialize();

    const files = await fs.readdir(this.queueDir);
    const messageFiles = files.filter(
      (f) => f.startsWith('msg-') && f.endsWith('.json')
    );

    const messages: QueuedMessage[] = [];
    for (const file of messageFiles) {
      const filePath = path.join(this.queueDir, file);
      const message = (await fs.readJson(filePath)) as QueuedMessage;

      if (!status || message.status === status) {
        messages.push(message);
      }
    }

    // Sort by timestamp (newest first)
    return messages.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get message by ID
   */
  async getMessage(id: string): Promise<QueuedMessage | null> {
    const messagePath = path.join(this.queueDir, `msg-${id}.json`);

    if (!(await fs.pathExists(messagePath))) {
      return null;
    }

    return await fs.readJson(messagePath);
  }

  /**
   * Update message status
   */
  async updateStatus(id: string, status: MessageStatus): Promise<void> {
    const message = await this.getMessage(id);
    if (!message) {
      throw new Error(`Message not found: ${id}`);
    }

    const oldStatus = message.status;
    message.status = status;

    // Write updated message
    const messagePath = path.join(this.queueDir, `msg-${id}.json`);
    await fs.writeJson(messagePath, message, { spaces: 2 });

    // Update index status counts (NOT total, just moving between statuses)
    const index = await this.getIndex();
    if (index[oldStatus] > 0) {
      index[oldStatus]--;
    }
    index[status]++;
    index.lastUpdated = Date.now();
    await this.saveIndex(index);

    // Emit countChanged if pending count changed
    if (oldStatus === 'pending' || status === 'pending') {
      const pendingCount = await this.getPendingCount();
      this.emitter.emit('countChanged', pendingCount);
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(id: string): Promise<void> {
    const message = await this.getMessage(id);
    if (!message) {
      throw new Error(`Message not found: ${id}`);
    }

    const wasPending = message.status === 'pending';
    const messagePath = path.join(this.queueDir, `msg-${id}.json`);
    await fs.remove(messagePath);

    // Update index
    await this.decrementIndex(message.status);
    await this.decrementTotal();

    // Emit countChanged if pending count changed
    if (wasPending) {
      const pendingCount = await this.getPendingCount();
      this.emitter.emit('countChanged', pendingCount);
    }
  }

  /**
   * Clear all dismissed messages
   */
  async clearDismissed(): Promise<number> {
    const dismissed = await this.getMessages('dismissed');

    for (const message of dismissed) {
      const messagePath = path.join(this.queueDir, `msg-${message.id}.json`);
      await fs.remove(messagePath);
    }

    // Reset dismissed count in index
    const index = await this.getIndex();
    index.dismissed = 0;
    index.total -= dismissed.length;
    index.lastUpdated = Date.now();
    await this.saveIndex(index);

    return dismissed.length;
  }

  /**
   * Get pending message count (O(1) via index)
   */
  async getPendingCount(): Promise<number> {
    const index = await this.getIndex();
    return index.pending;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueIndex> {
    return await this.getIndex();
  }

  // ========== Private Methods ==========

  private async getIndex(): Promise<QueueIndex> {
    await this.initialize();
    return await fs.readJson(this.indexPath);
  }

  private async saveIndex(index: QueueIndex): Promise<void> {
    await fs.writeJson(this.indexPath, index, { spaces: 2 });
  }

  private async incrementIndex(status: MessageStatus): Promise<void> {
    const index = await this.getIndex();
    index[status]++;
    index.total++;
    index.lastUpdated = Date.now();
    await this.saveIndex(index);
  }

  private async decrementIndex(status: MessageStatus): Promise<void> {
    const index = await this.getIndex();
    if (index[status] > 0) {
      index[status]--;
    }
    index.lastUpdated = Date.now();
    await this.saveIndex(index);
  }

  private async decrementTotal(): Promise<void> {
    const index = await this.getIndex();
    if (index.total > 0) {
      index.total--;
    }
    index.lastUpdated = Date.now();
    await this.saveIndex(index);
  }
}
