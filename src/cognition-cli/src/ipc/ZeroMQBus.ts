/**
 * ZeroMQ Pub/Sub Message Bus
 *
 * Provides pub/sub messaging between TUI instances using XPUB/XSUB broker pattern.
 *
 * Architecture:
 * - Bus Master acts as a broker using XPUB/XSUB sockets
 * - Frontend (XSUB): receives messages from all publishers
 * - Backend (XPUB): forwards messages to all subscribers
 * - Peers connect PUB to frontend, SUB to backend
 *
 * Message flow:
 *   Peer1.PUB → Frontend(XSUB) → [Forwarder] → Backend(XPUB) → Peer2.SUB
 */

import * as zmq from 'zeromq';
import { AgentMessage } from './AgentMessage.js';

export interface ZeroMQBusConfig {
  address: string; // e.g., 'ipc:///tmp/cognition-bus.sock' or 'tcp://127.0.0.1:5555'
  mode?: 'bind' | 'connect'; // 'bind' = Bus Master, 'connect' = Peer
}

export type MessageHandler = (message: AgentMessage) => void;

export class ZeroMQBus {
  private pubSocket: zmq.Publisher;
  private subSocket: zmq.Subscriber;
  // Broker sockets (only used in bind/master mode)
  private xsubSocket: zmq.XSubscriber | null = null;
  private xpubSocket: zmq.XPublisher | null = null;
  private config: ZeroMQBusConfig;
  private handlers: Map<string, Set<MessageHandler>>;
  private started: boolean = false;
  private isBroker: boolean = false;
  private forwarderRunning: boolean = false;

  constructor(config: ZeroMQBusConfig) {
    this.config = config;
    this.pubSocket = new zmq.Publisher();
    this.subSocket = new zmq.Subscriber();
    this.handlers = new Map();
  }

  /**
   * Start the bus in BIND mode (Bus Master / Broker)
   * First TUI to start becomes the Bus Master and runs the broker.
   *
   * Broker pattern:
   * - XSUB binds to frontend address (receives from publishers)
   * - XPUB binds to backend address (sends to subscribers)
   * - Forwarder proxies messages from XSUB to XPUB
   */
  async bind(): Promise<void> {
    if (this.started) {
      throw new Error('ZeroMQ Bus already started');
    }

    const frontendAddress = this.config.address; // Publishers connect here
    const backendAddress = this.getSubAddress(); // Subscribers connect here

    // Create and bind broker sockets
    this.xsubSocket = new zmq.XSubscriber();
    this.xpubSocket = new zmq.XPublisher();

    await this.xsubSocket.bind(frontendAddress);
    await this.xpubSocket.bind(backendAddress);

    this.isBroker = true;

    // Start the forwarder in the background
    this.startForwarder();

    // Bus Master also needs to publish/subscribe like peers
    // Connect our own pub/sub sockets to the broker
    await this.pubSocket.connect(frontendAddress);
    await this.subSocket.connect(backendAddress);

    this.started = true;
    this.startListening();

    console.log(
      `🚌 ZeroMQ Bus Master: Broker running (frontend: ${frontendAddress}, backend: ${backendAddress})`
    );
  }

  /**
   * Start the bus in CONNECT mode (Peer)
   * Subsequent TUIs connect to the Bus Master's broker.
   *
   * Peers:
   * - PUB connects to frontend (where XSUB is bound)
   * - SUB connects to backend (where XPUB is bound)
   */
  async connect(): Promise<void> {
    if (this.started) {
      throw new Error('ZeroMQ Bus already started');
    }

    const frontendAddress = this.config.address; // Where XSUB is bound
    const backendAddress = this.getSubAddress(); // Where XPUB is bound

    // Connect publisher to frontend (XSUB will receive our messages)
    await this.pubSocket.connect(frontendAddress);

    // Connect subscriber to backend (XPUB will send us messages)
    await this.subSocket.connect(backendAddress);

    this.started = true;
    this.startListening();

    console.log(`🔌 ZeroMQ Peer: Connected to broker at ${frontendAddress}`);
  }

  /**
   * Start the forwarder that proxies messages from XSUB to XPUB
   * This is the heart of the broker pattern
   */
  private startForwarder(): void {
    if (!this.xsubSocket || !this.xpubSocket) {
      throw new Error('Broker sockets not initialized');
    }

    this.forwarderRunning = true;
    const xsub = this.xsubSocket;
    const xpub = this.xpubSocket;

    // Forward messages from XSUB to XPUB
    (async () => {
      try {
        for await (const msg of xsub) {
          if (!this.forwarderRunning) break;
          // Forward the entire message (topic + payload) to XPUB
          await xpub.send(msg);
        }
      } catch (err) {
        if (this.forwarderRunning) {
          console.error('Forwarder error (XSUB→XPUB):', err);
        }
      }
    })();

    // Forward subscription messages from XPUB to XSUB
    // This allows dynamic subscriptions to propagate through the broker
    (async () => {
      try {
        for await (const msg of xpub) {
          if (!this.forwarderRunning) break;
          // Forward subscription messages to XSUB
          await xsub.send(msg);
        }
      } catch (err) {
        if (this.forwarderRunning) {
          console.error('Forwarder error (XPUB→XSUB):', err);
        }
      }
    })();
  }

  /**
   * Publish a message to a topic
   */
  publish(topic: string, message: AgentMessage): void {
    if (!this.started) {
      throw new Error('ZeroMQ Bus not started');
    }

    const payload = JSON.stringify(message);

    // ZeroMQ pub/sub uses multipart messages: [topic, payload]
    this.pubSocket.send([topic, payload]).catch((err) => {
      console.error('Failed to publish message:', err);
    });
  }

  /**
   * Subscribe to a topic
   * Supports wildcards: "code.*" matches "code.completed", "code.review_requested"
   *
   * Note: ZeroMQ uses prefix matching for subscriptions. For wildcard patterns
   * like "code.*", we subscribe to the prefix "code." in ZeroMQ but store
   * the full pattern for internal wildcard matching.
   */
  subscribe(topic: string, handler: MessageHandler): void {
    // Add handler to internal registry
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());

      // For ZeroMQ, convert wildcard patterns to prefixes
      // "code.*" -> "code." (ZeroMQ will match any topic starting with "code.")
      // "*" -> "" (subscribe to all topics)
      let zmqTopic = topic;
      if (topic.endsWith('*')) {
        zmqTopic = topic.slice(0, -1); // Remove trailing *
      }

      // Tell ZeroMQ to subscribe to this topic/prefix
      this.subSocket.subscribe(zmqTopic);
    }

    this.handlers.get(topic)!.add(handler);
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(topic);

    if (handlers) {
      handlers.delete(handler);

      // If no more handlers for this topic, unsubscribe from ZeroMQ
      if (handlers.size === 0) {
        this.handlers.delete(topic);

        // Use same prefix conversion as subscribe
        let zmqTopic = topic;
        if (topic.endsWith('*')) {
          zmqTopic = topic.slice(0, -1);
        }
        this.subSocket.unsubscribe(zmqTopic);
      }
    }
  }

  /**
   * Unsubscribe from all topics
   */
  unsubscribeAll(): void {
    for (const topic of this.handlers.keys()) {
      // Use same prefix conversion as subscribe
      let zmqTopic = topic;
      if (topic.endsWith('*')) {
        zmqTopic = topic.slice(0, -1);
      }
      this.subSocket.unsubscribe(zmqTopic);
    }
    this.handlers.clear();
  }

  /**
   * Close the bus and cleanup resources
   */
  async close(): Promise<void> {
    if (!this.started) {
      return;
    }

    // Mark as stopped first to prevent new operations
    this.started = false;

    this.unsubscribeAll();

    // Stop the forwarder
    this.forwarderRunning = false;

    // Give async iterators a moment to break out of their loops
    await new Promise((resolve) => setImmediate(resolve));

    await this.pubSocket.close();
    await this.subSocket.close();

    // Close broker sockets if we're the broker
    if (this.isBroker) {
      if (this.xsubSocket) {
        await this.xsubSocket.close();
        this.xsubSocket = null;
      }
      if (this.xpubSocket) {
        await this.xpubSocket.close();
        this.xpubSocket = null;
      }
      this.isBroker = false;
    }

    console.log('🛑 ZeroMQ Bus: Closed');
  }

  /**
   * Start listening for incoming messages
   * Runs in the background, dispatching to registered handlers
   */
  private async startListening(): Promise<void> {
    // Run async iterator in background
    (async () => {
      try {
        for await (const [topicBuffer, payloadBuffer] of this.subSocket) {
          const topic = topicBuffer.toString();
          const payload = payloadBuffer.toString();

          try {
            const message: AgentMessage = JSON.parse(payload);
            this.dispatchMessage(topic, message);
          } catch (err) {
            console.error('Failed to parse message:', err);
          }
        }
      } catch (err) {
        // Socket closed or error
        if (this.started) {
          console.error('ZeroMQ listener error:', err);
        }
      }
    })();
  }

  /**
   * Dispatch incoming message to registered handlers
   * Supports wildcard matching: "code.*" matches "code.completed"
   */
  private dispatchMessage(topic: string, message: AgentMessage): void {
    // Find all handlers that match this topic (including wildcards)
    for (const [pattern, handlers] of this.handlers.entries()) {
      if (this.matchesTopic(topic, pattern)) {
        for (const handler of handlers) {
          try {
            const result = handler(message);
            // If handler returns a promise, catch async errors
            if (
              result !== undefined &&
              result !== null &&
              typeof result === 'object' &&
              'catch' in result
            ) {
              (result as Promise<void>).catch((err: unknown) => {
                console.error(`Async handler error for topic ${topic}:`, err);
              });
            }
          } catch (err) {
            console.error(`Handler error for topic ${topic}:`, err);
          }
        }
      }
    }
  }

  /**
   * Check if topic matches pattern (supports wildcards)
   * Examples:
   *   matchesTopic('code.completed', 'code.*') => true
   *   matchesTopic('code.completed', 'code.completed') => true
   *   matchesTopic('code.completed', 'arch.*') => false
   */
  private matchesTopic(topic: string, pattern: string): boolean {
    // Exact match
    if (topic === pattern) {
      return true;
    }

    // Wildcard match
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(topic);
    }

    return false;
  }

  /**
   * Get subscriber address (separate port for bidirectional communication)
   * For IPC: Use different socket file
   * For TCP: Use different port
   */
  private getSubAddress(): string {
    if (this.config.address.startsWith('ipc://')) {
      // IPC: Add -sub suffix to socket path
      return this.config.address.replace('.sock', '-sub.sock');
    } else if (this.config.address.startsWith('tcp://')) {
      // TCP: Increment port by 1
      const match = this.config.address.match(/tcp:\/\/(.*):(\d+)/);
      if (match) {
        const host = match[1];
        const port = parseInt(match[2]) + 1;
        return `tcp://${host}:${port}`;
      }
    }

    throw new Error(`Unsupported address format: ${this.config.address}`);
  }

  /**
   * Check if this instance is the broker (Bus Master)
   */
  isBusMaster(): boolean {
    return this.isBroker;
  }

  /**
   * Get bus statistics (for debugging)
   */
  getStats(): BusStats {
    return {
      started: this.started,
      address: this.config.address,
      isBroker: this.isBroker,
      subscribedTopics: Array.from(this.handlers.keys()),
      handlerCounts: Object.fromEntries(
        Array.from(this.handlers.entries()).map(([topic, handlers]) => [
          topic,
          handlers.size,
        ])
      ),
    };
  }
}

export interface BusStats {
  started: boolean;
  address: string;
  isBroker: boolean;
  subscribedTopics: string[];
  handlerCounts: Record<string, number>;
}
