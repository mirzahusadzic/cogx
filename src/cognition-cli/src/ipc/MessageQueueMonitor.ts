import fs from 'fs';
import path from 'path';
import { MessageQueue } from './MessageQueue.js';
import { ZeroMQBus } from './ZeroMQBus.js';
import { AgentMessage } from './AgentMessage.js';

/**
 * Represents metadata about an active agent for discovery purposes.
 * This information is stored in `agent-info.json` within each agent's queue directory.
 *
 * @interface AgentInfo
 * @property {string} agentId The unique identifier for the agent.
 * @property {string} model The base model of the agent (e.g., 'opus', 'gemini').
 * @property {string} [alias] A short, human-readable alias (e.g., 'opus1').
 * @property {number} startedAt Unix timestamp of when the agent was started.
 * @property {number} lastHeartbeat Unix timestamp of the agent's last heartbeat.
 * @property {'active' | 'idle' | 'disconnected'} status The current status of the agent.
 * @property {string} [projectRoot] Absolute path to the project root directory.
 * @property {string} [projectName] Project name (inferred from package.json or folder name).
 */
export interface AgentInfo {
  agentId: string;
  model: string; // e.g., 'opus', 'sonnet', 'gemini', 'claude'
  alias?: string; // e.g., 'opus1', 'sonnet2', 'gemini1'
  startedAt: number; // Unix timestamp when agent started
  lastHeartbeat: number; // Unix timestamp of last heartbeat
  status: 'active' | 'idle' | 'disconnected';
  projectRoot?: string; // Absolute path to project directory
  projectName?: string; // Inferred from package.json or folder name
}

/**
 * Monitors the ZeroMQ bus and routes incoming messages to a persistent queue.
 *
 * This class runs as a background task for each agent. It subscribes to relevant
 * topics on the bus, filters messages intended for its agent, and enqueues them.
 * It also maintains an `agent-info.json` file with heartbeat data, allowing other
 * agents to discover it and see its status.
 *
 * @class MessageQueueMonitor
 *
 * @example
 * const bus = new ZeroMQBus();
 * await bus.connect();
 * const monitor = new MessageQueueMonitor(
 *   'claude-agent-xyz',
 *   bus,
 *   ['code.*'],
 *   './.sigma',
 *   'claude'
 * );
 * await monitor.start();
 *
 * // ... later, on shutdown ...
 * await monitor.stop();
 */
export class MessageQueueMonitor {
  private queue: MessageQueue;
  private bus: ZeroMQBus;
  private agentId: string;
  private model: string;
  private topics: string[];
  private sigmaDir: string;
  private projectRoot: string;
  private running: boolean = false;
  private abortController: AbortController | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private static DEBUG = process.env.DEBUG_IPC === '1';

  /**
   * Creates an instance of MessageQueueMonitor.
   *
   * @param {string} agentId The base ID for the agent (a unique suffix will be added).
   * @param {ZeroMQBus} bus The connected ZeroMQ bus instance.
   * @param {string[]} topics The initial list of topics to subscribe to.
   * @param {string} [sigmaDir] The path to the .sigma directory. Defaults to the current working directory.
   * @param {string} [model] The model name of the agent (e.g., 'opus'). If not provided, it's inferred from the agentId.
   * @param {string} [projectRoot] Absolute path to the project root directory.
   */
  constructor(
    agentId: string,
    bus: ZeroMQBus,
    topics: string[],
    sigmaDir?: string,
    model?: string,
    projectRoot?: string
  ) {
    // Add unique suffix to prevent agent ID collisions when multiple TUIs
    // share the same anchor ID (e.g., started without --session-id)
    const uniqueSuffix = Math.random().toString(36).substring(2, 6);
    this.agentId = `${agentId}-${uniqueSuffix}`;
    this.bus = bus;
    this.topics = topics;
    this.sigmaDir = sigmaDir || process.cwd();
    this.projectRoot = projectRoot || process.cwd();
    // Always extract base model name (opus, sonnet, gemini, etc.)
    this.model = MessageQueueMonitor.extractModelFromId(model || agentId);
    this.queue = new MessageQueue(this.agentId, sigmaDir);
  }

  /**
   * Extracts a normalized model name from a string.
   *
   * @param {string} idOrModel The string to parse (e.g., 'claude-3-opus' or 'opus').
   * @returns {string} The normalized model name (e.g., 'claude' or 'opus').
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
   * Infers the project name from package.json or uses the folder name as fallback.
   *
   * @param {string} projectRoot Absolute path to the project root directory.
   * @returns {string} The inferred project name.
   */
  private inferProjectName(projectRoot: string): string {
    // Try to read name from package.json
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf-8')
        );
        if (packageJson.name) {
          return packageJson.name;
        }
      } catch {
        // Ignore parse errors, fall through to folder name
      }
    }

    // Fallback: use folder name
    return path.basename(projectRoot);
  }

  /**
   * Generates a unique, sequential alias for this agent based on its model.
   * @private
   * @returns {Promise<string>} The generated alias (e.g., 'opus1').
   */
  private async generateAlias(): Promise<string> {
    const queueDir = path.join(this.sigmaDir, 'message_queue');

    if (!fs.existsSync(queueDir)) {
      return `${this.model}1`;
    }

    // Read all agent-info.json files to find existing aliases for this model
    // Only count ACTIVE agents (heartbeat within last 5 seconds) to keep numbers low
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
   * Checks if another active agent is already using a given alias.
   * @private
   * @param {string} alias The alias to check.
   * @returns {Promise<boolean>} `true` if a collision is detected, otherwise `false`.
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
   * Writes the `agent-info.json` file for this agent.
   * @private
   * @param {string} alias The alias to write into the info file.
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
      projectRoot: this.projectRoot,
      projectName: this.inferProjectName(this.projectRoot),
    };

    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
  }

  /**
   * Updates the heartbeat timestamp in the `agent-info.json` file.
   * @private
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
   * Marks the agent as 'disconnected' in its info file.
   * @private
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
   * Starts the message monitor.
   *
   * This initializes the queue, generates an alias, starts the heartbeat,
   * and begins listening for messages on the bus.
   *
   * @returns {Promise<void>}
   * @throws {Error} If the monitor is already running.
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

    // Start heartbeat (every 3 seconds - must be less than ACTIVE_THRESHOLD of 5s)
    this.heartbeatInterval = setInterval(() => {
      this.updateHeartbeat();
    }, 3000);

    if (MessageQueueMonitor.DEBUG) {
      console.log(
        `[MessageQueueMonitor] Started for agent ${this.agentId} as ${alias} (topics: ${this.topics.join(', ')})`
      );
    }
  }

  /**
   * Stops the message monitor.
   *
   * This stops the heartbeat, marks the agent as disconnected, and unsubscribes
   * from all topics on the bus.
   *
   * @returns {Promise<void>}
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
   * Handles an incoming message from the ZeroMQ bus.
   * @private
   * @param {AgentMessage} message The incoming message.
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
    } catch (error) {
      if (MessageQueueMonitor.DEBUG) {
        console.error('[MessageQueueMonitor] Error queueing message:', error);
      }
    }
  }

  /**
   * Gets the current number of pending messages in the queue.
   *
   * @returns {Promise<number>} The pending message count.
   */
  async getPendingCount(): Promise<number> {
    return await this.queue.getPendingCount();
  }

  /**
   * Gets the underlying `MessageQueue` instance.
   *
   * @returns {MessageQueue} The message queue instance.
   */
  getQueue(): MessageQueue {
    return this.queue;
  }

  /**
   * Checks if the monitor is currently running.
   *
   * @returns {boolean} `true` if the monitor is running, otherwise `false`.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Subscribes the monitor to an additional topic on the bus.
   *
   * @param {string} topic The topic to subscribe to.
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
   * Unsubscribes the monitor from a topic.
   *
   * @param {string} topic The topic to unsubscribe from.
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
   * Gets the list of topics the monitor is currently subscribed to.
   *
   * @returns {string[]} A copy of the current topics array.
   */
  getTopics(): string[] {
    return [...this.topics];
  }
}
