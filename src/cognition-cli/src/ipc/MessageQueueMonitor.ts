import fs from 'fs';
import path from 'path';
import { MessageQueue } from './MessageQueue.js';
import { ZeroMQBus } from './ZeroMQBus.js';
import { AgentMessage } from './AgentMessage.js';

/**
 * Agent info stored in agent-info.json for discovery
 */
export interface AgentInfo {
  agentId: string;
  model: string; // e.g., 'opus', 'sonnet', 'gemini', 'claude'
  alias?: string; // e.g., 'opus1', 'sonnet2', 'gemini1'
  startedAt: number; // Unix timestamp when agent started
  lastHeartbeat: number; // Unix timestamp of last heartbeat
  status: 'active' | 'idle' | 'disconnected';
}

/**
 * MessageQueueMonitor - Background task to monitor ZeroMQ bus
 *
 * Responsibilities:
 * - Subscribe to ZeroMQ topics for this agent
 * - Filter messages by recipient (only queue messages addressed to this agent)
 * - Write incoming messages to persistent MessageQueue
 * - Update queue index for O(1) pending count
 * - Maintain agent-info.json for agent discovery
 *
 * Debug Logging:
 * - Set DEBUG_IPC=1 environment variable to enable verbose monitoring logs
 */
export class MessageQueueMonitor {
  private queue: MessageQueue;
  private bus: ZeroMQBus;
  private agentId: string;
  private model: string;
  private topics: string[];
  private sigmaDir: string;
  private running: boolean = false;
  private abortController: AbortController | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private static DEBUG = process.env.DEBUG_IPC === '1';

  /**
   * @param agentId Unique agent ID (e.g., "claude-a7f3")
   * @param bus ZeroMQ bus instance
   * @param topics Topics to subscribe to (e.g., ["code.*", "arch.proposal_ready"])
   * @param sigmaDir Optional .sigma directory path (defaults to cwd)
   * @param model Model name (e.g., 'opus', 'sonnet', 'gemini')
   */
  constructor(
    agentId: string,
    bus: ZeroMQBus,
    topics: string[],
    sigmaDir?: string,
    model?: string
  ) {
    // Add unique suffix to prevent agent ID collisions when multiple TUIs
    // share the same anchor ID (e.g., started without --session-id)
    const uniqueSuffix = Math.random().toString(36).substring(2, 6);
    this.agentId = `${agentId}-${uniqueSuffix}`;
    this.bus = bus;
    this.topics = topics;
    this.sigmaDir = sigmaDir || process.cwd();
    // Always extract base model name (opus, sonnet, gemini, etc.)
    this.model = MessageQueueMonitor.extractModelFromId(model || agentId);
    this.queue = new MessageQueue(this.agentId, sigmaDir);
  }

  /**
   * Extract model name from agent ID or model string
   * Normalizes to base model name (opus, sonnet, gemini, claude, gpt, etc.)
   */
  static extractModelFromId(idOrModel: string): string {
    const lower = idOrModel.toLowerCase();

    // Check for known model patterns
    if (lower.includes('opus')) return 'opus';
    if (lower.includes('sonnet')) return 'sonnet';
    if (lower.includes('haiku')) return 'haiku';
    if (lower.includes('gemini')) return 'gemini';
    if (lower.includes('gpt-4')) return 'gpt4';
    if (lower.includes('gpt')) return 'gpt';
    if (lower.includes('claude')) return 'claude';

    // Default to 'agent' if unknown
    return 'agent';
  }

  /**
   * Generate unique alias for this agent based on model
   * Only counts ACTIVE agents (recent heartbeat) to keep numbers low
   * e.g., opus1, opus2, sonnet1, gemini1
   */
  private async generateAlias(): Promise<string> {
    const queueDir = path.join(this.sigmaDir, 'message_queue');

    if (!fs.existsSync(queueDir)) {
      return `${this.model}1`;
    }

    // Read all agent-info.json files to find existing aliases for this model
    // Only count ACTIVE agents (heartbeat within last 5 seconds)
    const entries = fs.readdirSync(queueDir, { withFileTypes: true });
    const existingNumbers: number[] = [];
    const now = Date.now();
    const ACTIVE_THRESHOLD_MS = 5000; // 5 seconds

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const infoPath = path.join(queueDir, entry.name, 'agent-info.json');
      if (fs.existsSync(infoPath)) {
        try {
          const info: AgentInfo = JSON.parse(
            fs.readFileSync(infoPath, 'utf-8')
          );
          // Only count active agents of the same model (not disconnected)
          const isActive =
            now - info.lastHeartbeat < ACTIVE_THRESHOLD_MS &&
            info.status !== 'disconnected';
          if (info.model === this.model && info.alias && isActive) {
            const match = info.alias.match(/(\d+)$/);
            if (match) {
              existingNumbers.push(parseInt(match[1], 10));
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Find first available number (fills gaps: if opus2 exists but not opus1, use opus1)
    let nextNumber = 1;
    const sortedNumbers = existingNumbers.sort((a, b) => a - b);
    for (const num of sortedNumbers) {
      if (num === nextNumber) {
        nextNumber++;
      } else {
        break; // Found a gap
      }
    }
    return `${this.model}${nextNumber}`;
  }

  /**
   * Check if another agent has the same alias (collision detection)
   */
  private async checkAliasCollision(alias: string): Promise<boolean> {
    const queueDir = path.join(this.sigmaDir, 'message_queue');
    if (!fs.existsSync(queueDir)) return false;

    const entries = fs.readdirSync(queueDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === this.agentId) continue; // Skip self

      const infoPath = path.join(queueDir, entry.name, 'agent-info.json');
      if (fs.existsSync(infoPath)) {
        try {
          const info: AgentInfo = JSON.parse(
            fs.readFileSync(infoPath, 'utf-8')
          );
          if (info.alias === alias) {
            return true; // Collision found
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    return false;
  }

  /**
   * Write agent-info.json file
   */
  private async writeAgentInfo(alias: string): Promise<void> {
    const queueDir = path.join(this.sigmaDir, 'message_queue', this.agentId);
    const infoPath = path.join(queueDir, 'agent-info.json');

    fs.mkdirSync(queueDir, { recursive: true });

    const info: AgentInfo = {
      agentId: this.agentId,
      model: this.model,
      alias,
      startedAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
    };

    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
  }

  /**
   * Update heartbeat timestamp
   */
  private updateHeartbeat(): void {
    const infoPath = path.join(
      this.sigmaDir,
      'message_queue',
      this.agentId,
      'agent-info.json'
    );

    if (!fs.existsSync(infoPath)) return;

    try {
      const info: AgentInfo = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
      info.lastHeartbeat = Date.now();
      info.status = 'active';
      fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
    } catch {
      // Ignore errors
    }
  }

  /**
   * Mark agent as disconnected
   */
  private markDisconnected(): void {
    const infoPath = path.join(
      this.sigmaDir,
      'message_queue',
      this.agentId,
      'agent-info.json'
    );

    if (!fs.existsSync(infoPath)) return;

    try {
      const info: AgentInfo = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
      info.status = 'disconnected';
      info.lastHeartbeat = Date.now();
      fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
    } catch {
      // Ignore errors
    }
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

    // Generate alias and write agent info (with collision detection)
    let alias = await this.generateAlias();
    await this.writeAgentInfo(alias);

    // Check for collision (another agent took same alias)
    // Retry up to 3 times if collision detected
    for (let retry = 0; retry < 3; retry++) {
      const collision = await this.checkAliasCollision(alias);
      if (!collision) break;

      // Small delay to desynchronize
      await new Promise((resolve) =>
        setTimeout(resolve, 50 + Math.random() * 100)
      );
      alias = await this.generateAlias();
      await this.writeAgentInfo(alias);
    }

    this.running = true;
    this.abortController = new AbortController();

    // Subscribe to all topics for this agent
    for (const topic of this.topics) {
      this.bus.subscribe(topic, this.handleMessage.bind(this));
    }

    // Start heartbeat (every 10 seconds)
    this.heartbeatInterval = setInterval(() => {
      this.updateHeartbeat();
    }, 10000);

    if (MessageQueueMonitor.DEBUG) {
      console.log(
        `[MessageQueueMonitor] Started for agent ${this.agentId} as ${alias} (topics: ${this.topics.join(', ')})`
      );
    }
  }

  /**
   * Stop monitoring the ZeroMQ bus
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Mark agent as disconnected
    this.markDisconnected();

    // Unsubscribe from all topics
    for (const topic of this.topics) {
      this.bus.unsubscribe(topic, this.handleMessage.bind(this));
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (MessageQueueMonitor.DEBUG) {
      console.log(`[MessageQueueMonitor] Stopped for agent ${this.agentId}`);
    }
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

      if (MessageQueueMonitor.DEBUG) {
        console.log(
          `[MessageQueueMonitor] Queued message ${messageId} from ${message.from} (topic: ${message.topic})`
        );
      }

      // TODO: Notify TUI status bar of new message (via IPC or event emitter)
      // For now, the TUI will poll getPendingCount() or check on startup
    } catch (error) {
      if (MessageQueueMonitor.DEBUG) {
        console.error('[MessageQueueMonitor] Error queueing message:', error);
      }
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
      if (MessageQueueMonitor.DEBUG) {
        console.log(
          `[MessageQueueMonitor] Subscribed to additional topic: ${topic}`
        );
      }
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
      if (MessageQueueMonitor.DEBUG) {
        console.log(`[MessageQueueMonitor] Unsubscribed from topic: ${topic}`);
      }
    }
  }

  /**
   * Get current subscribed topics
   */
  getTopics(): string[] {
    return [...this.topics];
  }
}
