import fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

/**
 * Represents the status of a message in the queue.
 * @typedef {'pending' | 'read' | 'injected' | 'dismissed'} MessageStatus
 */
export type MessageStatus = 'pending' | 'read' | 'injected' | 'dismissed';

/**
 * Represents a message stored in an agent's persistent queue.
 *
 * @interface QueuedMessage
 * @property {string} id Unique message identifier (UUID).
 * @property {string} from The ID of the sending agent.
 * @property {string} to The ID of the recipient agent.
 * @property {string} topic The message topic (e.g., "code.review_completed").
 * @property {unknown} content The message payload.
 * @property {number} timestamp Unix timestamp (in milliseconds) of when the message was enqueued.
 * @property {MessageStatus} status The current status of the message.
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

/**
 * Provides an index for fast lookups of message counts by status.
 *
 * @interface QueueIndex
 * @property {number} total The total number of messages in the queue.
 * @property {number} pending The number of messages with 'pending' status.
 * @property {number} read The number of messages with 'read' status.
 * @property {number} injected The number of messages with 'injected' status.
 * @property {number} dismissed The number of messages with 'dismissed' status.
 * @property {number} lastUpdated Unix timestamp of the last index update.
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
 * Manages a persistent, file-system-based message queue for a single agent.
 *
 * Each agent has its own queue, stored in the `.sigma/message_queue/{agent-id}`
 * directory. This class handles CRUD operations for messages and maintains an
 * index for efficient status queries. It also emits events when the queue changes.
 *
 * @class MessageQueue
 * @extends {EventEmitter}
 *
 * @example
 * const queue = new MessageQueue('gemini-agent-1');
 * await queue.initialize();
 *
 * queue.on('countChanged', (count) => {
 *   console.log(`Pending messages: ${count}`);
 * });
 *
 * await queue.enqueue({
 *   from: 'opus-agent-2',
 *   to: 'gemini-agent-1',
 *   topic: 'agent.question',
 *   content: { question: 'Are you ready?' },
 *   timestamp: Date.now(),
 * });
 */
export class MessageQueue {
  private queueDir: string;
  private indexPath: string;
  private emitter: EventEmitter;

  /**
   * Creates an instance of MessageQueue.
   *
   * @param {string} agentId The unique ID of the agent this queue belongs to.
   * @param {string} [sigmaDir] The path to the .sigma directory. Defaults to `${process.cwd()}/.sigma`.
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
   * Subscribes to events emitted by the message queue.
   *
   * @param {'countChanged' | 'messageAdded' | 'error'} event The event to subscribe to.
   * @param {(...args: any[]) => void} listener The callback function.
   * @returns {void}
   *
   * @example
   * queue.on('messageAdded', (message) => {
   *   console.log('New message received:', message.topic);
   * });
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.emitter.on(event, listener);
  }

  /**
   * Unsubscribes from a queue event.
   *
   * @param {string} event The event to unsubscribe from.
   * @param {(...args: any[]) => void} listener The callback function to remove.
   * @returns {void}
   */
  off(event: string, listener: (...args: unknown[]) => void): void {
    this.emitter.off(event, listener);
  }

  /**
   * Initializes the message queue by ensuring its directory and index file exist.
   *
   * @async
   * @returns {Promise<void>}
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
   * Adds a new message to the queue.
   *
   * The message is assigned a unique ID and its status is set to 'pending'.
   *
   * @async
   * @param {Omit<QueuedMessage, 'id' | 'status'>} message The message to enqueue.
   * @returns {Promise<string>} The ID of the newly enqueued message.
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
   * Retrieves all messages from the queue, optionally filtering by status.
   *
   * @async
   * @param {MessageStatus} [status] An optional status to filter messages by.
   * @returns {Promise<QueuedMessage[]>} A sorted array of messages (newest first).
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
   * Retrieves a single message by its full ID or a unique short prefix.
   *
   * @async
   * @param {string} id The full or partial message ID.
   * @returns {Promise<QueuedMessage | null>} The message, or `null` if not found.
   */
  async getMessage(id: string): Promise<QueuedMessage | null> {
    // First try exact match
    const messagePath = path.join(this.queueDir, `msg-${id}.json`);
    if (await fs.pathExists(messagePath)) {
      return await fs.readJson(messagePath);
    }

    // If not found and looks like a short ID, try prefix match
    if (id.length < 36) {
      const resolvedId = await this.resolveMessageId(id);
      if (resolvedId) {
        const resolvedPath = path.join(this.queueDir, `msg-${resolvedId}.json`);
        return await fs.readJson(resolvedPath);
      }
    }

    return null;
  }

  /**
   * Resolves a short message ID prefix to the full UUID.
   *
   * @async
   * @param {string} shortId The first N characters of a message UUID.
   * @returns {Promise<string | null>} The full UUID if a unique match is found, otherwise `null`.
   */
  async resolveMessageId(shortId: string): Promise<string | null> {
    await this.initialize();

    const files = await fs.readdir(this.queueDir);
    const messageFiles = files.filter(
      (f) => f.startsWith('msg-') && f.endsWith('.json')
    );

    const matches: string[] = [];
    for (const file of messageFiles) {
      // Extract UUID from "msg-{uuid}.json"
      const uuid = file.slice(4, -5);
      if (uuid.startsWith(shortId)) {
        matches.push(uuid);
      }
    }

    // Return only if exactly one match
    if (matches.length === 1) {
      return matches[0];
    }

    return null;
  }

  /**
   * Updates the status of a message.
   *
   * @async
   * @param {string} id The full or partial ID of the message to update.
   * @param {MessageStatus} status The new status for the message.
   * @returns {Promise<void>}
   * @throws {Error} If the message is not found.
   */
  async updateStatus(id: string, status: MessageStatus): Promise<void> {
    const message = await this.getMessage(id);
    if (!message) {
      throw new Error(`Message not found: ${id}`);
    }

    const oldStatus = message.status;
    message.status = status;

    // Use message.id (full UUID) for path, not the potentially short input id
    const messagePath = path.join(this.queueDir, `msg-${message.id}.json`);
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
   * Deletes a message from the queue.
   *
   * @async
   * @param {string} id The full or partial ID of the message to delete.
   * @returns {Promise<void>}
   * @throws {Error} If the message is not found.
   */
  async deleteMessage(id: string): Promise<void> {
    const message = await this.getMessage(id);
    if (!message) {
      throw new Error(`Message not found: ${id}`);
    }

    const wasPending = message.status === 'pending';
    // Use message.id (full UUID) for path, not the potentially short input id
    const messagePath = path.join(this.queueDir, `msg-${message.id}.json`);
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
   * Permanently deletes all messages with 'dismissed' status.
   *
   * @async
   * @returns {Promise<number>} The number of messages cleared.
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
   * Gets the number of pending messages in O(1) time using the index.
   *
   * @async
   * @returns {Promise<number>} The count of pending messages.
   */
  async getPendingCount(): Promise<number> {
    const index = await this.getIndex();
    return index.pending;
  }

  /**
   * Retrieves queue statistics from the index.
   *
   * @async
   * @returns {Promise<QueueIndex>} An object with queue statistics.
   */
  async getStats(): Promise<QueueIndex> {
    return await this.getIndex();
  }

  /**
   * Gets the ID of the agent this queue belongs to.
   *
   * @returns {string} The agent ID.
   */
  getAgentId(): string {
    return this.agentId;
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
