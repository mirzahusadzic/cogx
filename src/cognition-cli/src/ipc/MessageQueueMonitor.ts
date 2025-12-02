import { MessageQueue } from './MessageQueue.js';
import { ZeroMQBus } from './ZeroMQBus.js';
import { AgentMessage } from './AgentMessage.js';

/**
 * MessageQueueMonitor - Background task to monitor ZeroMQ bus
 *
 * Responsibilities:
 * - Subscribe to ZeroMQ topics for this agent
 * - Filter messages by recipient (only queue messages addressed to this agent)
 * - Write incoming messages to persistent MessageQueue
 * - Update queue index for O(1) pending count
 */
export class MessageQueueMonitor {
  private queue: MessageQueue;
  private bus: ZeroMQBus;
  private agentId: string;
  private topics: string[];
  private running: boolean = false;
  private abortController: AbortController | null = null;

  /**
   * @param agentId Unique agent ID (e.g., "claude-a7f3")
   * @param bus ZeroMQ bus instance
   * @param topics Topics to subscribe to (e.g., ["code.*", "arch.proposal_ready"])
   * @param sigmaDir Optional .sigma directory path (defaults to cwd)
   */
  constructor(
    agentId: string,
    bus: ZeroMQBus,
    topics: string[],
    sigmaDir?: string
  ) {
    this.agentId = agentId;
    this.bus = bus;
    this.topics = topics;
    this.queue = new MessageQueue(agentId, sigmaDir);
  }

  /**
   * Start monitoring the ZeroMQ bus
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('MessageQueueMonitor is already running');
    }

    // Initialize queue storage
    await this.queue.initialize();

    this.running = true;
    this.abortController = new AbortController();

    // Subscribe to all topics for this agent
    for (const topic of this.topics) {
      this.bus.subscribe(topic, this.handleMessage.bind(this));
    }

    console.log(
      `[MessageQueueMonitor] Started for agent ${this.agentId} (topics: ${this.topics.join(', ')})`
    );
  }

  /**
   * Stop monitoring the ZeroMQ bus
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Unsubscribe from all topics
    for (const topic of this.topics) {
      this.bus.unsubscribe(topic, this.handleMessage.bind(this));
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    console.log(`[MessageQueueMonitor] Stopped for agent ${this.agentId}`);
  }

  /**
   * Handle incoming message from ZeroMQ bus
   */
  private async handleMessage(message: AgentMessage): Promise<void> {
    if (!this.running) {
      return;
    }

    // Filter: Only queue messages addressed to this agent or broadcast (*)
    if (message.to !== this.agentId && message.to !== '*') {
      return; // Not for us, ignore
    }

    try {
      // Queue the message
      const messageId = await this.queue.enqueue({
        from: message.from,
        to: message.to,
        topic: message.topic,
        content: message.payload,
        timestamp: message.timestamp,
      });

      console.log(
        `[MessageQueueMonitor] Queued message ${messageId} from ${message.from} (topic: ${message.topic})`
      );

      // TODO: Notify TUI status bar of new message (via IPC or event emitter)
      // For now, the TUI will poll getPendingCount() or check on startup
    } catch (error) {
      console.error('[MessageQueueMonitor] Error queueing message:', error);
    }
  }

  /**
   * Get pending message count (for status bar display)
   */
  async getPendingCount(): Promise<number> {
    return await this.queue.getPendingCount();
  }

  /**
   * Get queue instance (for direct access if needed)
   */
  getQueue(): MessageQueue {
    return this.queue;
  }

  /**
   * Check if monitor is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Subscribe to additional topic
   */
  subscribeToTopic(topic: string): void {
    if (!this.topics.includes(topic)) {
      this.topics.push(topic);
      this.bus.subscribe(topic, this.handleMessage.bind(this));
      console.log(
        `[MessageQueueMonitor] Subscribed to additional topic: ${topic}`
      );
    }
  }

  /**
   * Unsubscribe from topic
   */
  unsubscribeFromTopic(topic: string): void {
    const index = this.topics.indexOf(topic);
    if (index !== -1) {
      this.topics.splice(index, 1);
      this.bus.unsubscribe(topic, this.handleMessage.bind(this));
      console.log(`[MessageQueueMonitor] Unsubscribed from topic: ${topic}`);
    }
  }

  /**
   * Get current subscribed topics
   */
  getTopics(): string[] {
    return [...this.topics];
  }
}
