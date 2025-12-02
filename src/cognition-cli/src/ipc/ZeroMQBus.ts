/**
 * ZeroMQ Pub/Sub Message Bus
 *
 * Provides pub/sub messaging between TUI instances.
 * Supports both binding (Bus Master) and connecting (Peer) modes.
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
  private config: ZeroMQBusConfig;
  private handlers: Map<string, Set<MessageHandler>>;
  private started: boolean = false;

  constructor(config: ZeroMQBusConfig) {
    this.config = config;
    this.pubSocket = new zmq.Publisher();
    this.subSocket = new zmq.Subscriber();
    this.handlers = new Map();
  }

  /**
   * Start the bus in BIND mode (Bus Master)
   * First TUI to start becomes the Bus Master and binds the socket.
   */
  async bind(): Promise<void> {
    if (this.started) {
      throw new Error('ZeroMQ Bus already started');
    }

    // Bind publisher socket
    await this.pubSocket.bind(this.config.address);

    // Bind subscriber socket (separate port for feedback)
    const subAddress = this.getSubAddress();
    await this.subSocket.bind(subAddress);

    this.started = true;
    this.startListening();

    console.log(`🚌 ZeroMQ Bus Master: Bound to ${this.config.address}`);
  }

  /**
   * Start the bus in CONNECT mode (Peer)
   * Subsequent TUIs connect to the Bus Master.
   */
  async connect(): Promise<void> {
    if (this.started) {
      throw new Error('ZeroMQ Bus already started');
    }

    // Connect publisher socket
    await this.pubSocket.connect(this.config.address);

    // Connect subscriber socket
    const subAddress = this.getSubAddress();
    await this.subSocket.connect(subAddress);

    this.started = true;
    this.startListening();

    console.log(`🔌 ZeroMQ Peer: Connected to ${this.config.address}`);
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
   */
  subscribe(topic: string, handler: MessageHandler): void {
    // Add handler to internal registry
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());

      // Tell ZeroMQ to subscribe to this topic
      this.subSocket.subscribe(topic);
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
        this.subSocket.unsubscribe(topic);
      }
    }
  }

  /**
   * Unsubscribe from all topics
   */
  unsubscribeAll(): void {
    for (const topic of this.handlers.keys()) {
      this.subSocket.unsubscribe(topic);
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

    this.unsubscribeAll();

    await this.pubSocket.close();
    await this.subSocket.close();

    this.started = false;
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
            handler(message);
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
   * Get bus statistics (for debugging)
   */
  getStats(): BusStats {
    return {
      started: this.started,
      address: this.config.address,
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
  subscribedTopics: string[];
  handlerCounts: Record<string, number>;
}
