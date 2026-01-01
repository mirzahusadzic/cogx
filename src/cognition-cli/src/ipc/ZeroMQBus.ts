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
import { systemLog } from '../utils/debug-logger.js';

/**
 * Configuration for the ZeroMQBus.
 *
 * @interface ZeroMQBusConfig
 * @property {string} address The primary address for the bus (e.g., 'ipc:///tmp/cognition-bus.sock').
 * @property {'bind' | 'connect'} [mode] The connection mode. 'bind' for the master/broker, 'connect' for peers.
 */
export interface ZeroMQBusConfig {
  address: string; // e.g., 'ipc:///tmp/cognition-bus.sock' or 'tcp://127.0.0.1:5555'
  mode?: 'bind' | 'connect'; // 'bind' = Bus Master, 'connect' = Peer
}

/**
 * Defines the signature for a message handler function.
 * @callback MessageHandler
 * @param {AgentMessage} message The received message.
 * @returns {void}
 */
export type MessageHandler = (message: AgentMessage) => void;

/**
 * Represents statistics about the ZeroMQ bus state.
 *
 * @interface BusStats
 * @property {boolean} started Whether the bus is currently started.
 * @property {string} address The connection address of the bus.
 * @property {boolean} isBroker Whether this instance is the broker (bus master).
 * @property {string[]} subscribedTopics A list of all subscribed topics.
 * @property {Record<string, number>} handlerCounts A map of topics to their handler counts.
 */
export interface BusStats {
  started: boolean;
  address: string;
  isBroker: boolean;
  subscribedTopics: string[];
  handlerCounts: Record<string, number>;
}

/**
 * Provides a pub/sub message bus using ZeroMQ's XPUB/XSUB broker pattern.
 *
 * This class allows multiple processes (agents, TUIs) to communicate in a
 * decoupled manner. The first process to start `bind()`s as the "bus master",
 * running a broker that forwards messages. All other processes `connect()` as
 * peers.
 *
 * @class ZeroMQBus
 *
 * @example
 * // In the bus master process
 * const masterBus = new ZeroMQBus({ address: 'ipc:///tmp/bus.sock' });
 * await masterBus.bind();
 *
 * // In a peer process
 * const peerBus = new ZeroMQBus({ address: 'ipc:///tmp/bus.sock' });
 * await peerBus.connect();
 *
 * peerBus.subscribe('chat.message', (msg) => {
 *   systemLog('ipc', `Chat message: ${msg.payload}`);
 * });
 * masterBus.publish('chat.message', { from: 'master', text: 'Hello!' });
 */
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

  /**
   * Creates an instance of ZeroMQBus.
   * @constructor
   * @param {ZeroMQBusConfig} config The configuration for the bus.
   */
  constructor(config: ZeroMQBusConfig) {
    this.config = config;
    this.pubSocket = new zmq.Publisher();
    this.subSocket = new zmq.Subscriber();
    this.handlers = new Map();
  }

  /**
   * Starts the bus in BIND mode, acting as the broker (bus master).
   *
   * This sets up XPUB/XSUB sockets and starts a forwarder to relay messages
   * between publishers and subscribers.
   *
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If the bus is already started.
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

    systemLog(
      'ipc',
      `ZeroMQ Bus Master: Broker running (frontend: ${frontendAddress}, backend: ${backendAddress})`
    );
  }

  /**
   * Starts the bus in CONNECT mode, acting as a peer.
   *
   * This connects the PUB and SUB sockets to the master broker's addresses.
   *
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If the bus is already started.
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

    systemLog('ipc', `ZeroMQ Peer: Connected to broker at ${frontendAddress}`);
  }

  /**
   * Starts the message forwarding logic for the broker.
   * @private
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
          systemLog(
            'ipc',
            'Forwarder error (XSUB→XPUB)',
            { error: err instanceof Error ? err.message : String(err) },
            'error'
          );
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
          systemLog(
            'ipc',
            'Forwarder error (XPUB→XSUB)',
            { error: err instanceof Error ? err.message : String(err) },
            'error'
          );
        }
      }
    })();
  }

  /**
   * Publishes a message to a specific topic.
   *
   * @param {string} topic The topic to publish the message on.
   * @param {AgentMessage} message The message to publish.
   * @returns {void}
   * @throws {Error} If the bus is not started.
   */
  publish(topic: string, message: AgentMessage): void {
    if (!this.started) {
      throw new Error('ZeroMQ Bus not started');
    }

    const payload = JSON.stringify(message);

    // ZeroMQ pub/sub uses multipart messages: [topic, payload]
    this.pubSocket.send([topic, payload]).catch((err) => {
      systemLog(
        'ipc',
        'Failed to publish message',
        { topic, error: err instanceof Error ? err.message : String(err) },
        'error'
      );
    });
  }

  /**
   * Subscribes to a topic and registers a handler.
   *
   * @param {string} topic The topic to subscribe to. Supports wildcards (e.g., "code.*").
   * @param {MessageHandler} handler The function to call when a message is received on this topic.
   * @returns {void}
   *
   * @example
   * // Subscribe to specific topic
   * bus.subscribe('agent.message', (msg) => {
   *   systemLog('ipc', 'Received message', { topic: msg.topic });
   * });
   *
   * @example
   * // Subscribe using wildcard
   * bus.subscribe('code.*', (msg) => {
   *   systemLog('ipc', `Code event: ${msg.topic}`);
   * });
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
   * Unsubscribes a specific handler from a topic.
   *
   * @param {string} topic The topic to unsubscribe from.
   * @param {MessageHandler} handler The handler function to remove.
   * @returns {void}
   *
   * @example
   * const handler = (msg: AgentMessage) => {
   *   systemLog('ipc', 'Received message', { topic: msg.topic });
   * };
   * bus.subscribe('agent.message', handler);
   * // Later...
   * bus.unsubscribe('agent.message', handler);
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
   * Unsubscribes from all topics and removes all handlers.
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
   * Closes all sockets and cleans up resources.
   * @async
   * @returns {Promise<void>}
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

    systemLog('ipc', 'ZeroMQ Bus: Closed');
  }

  /**
   * Starts the background listener for incoming messages.
   * @private
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
            systemLog(
              'ipc',
              'Failed to parse message',
              {
                payload,
                error: err instanceof Error ? err.message : String(err),
              },
              'error'
            );
          }
        }
      } catch (err) {
        // Socket closed or error
        if (this.started) {
          systemLog(
            'ipc',
            'ZeroMQ listener error',
            { error: err instanceof Error ? err.message : String(err) },
            'error'
          );
        }
      }
    })();
  }

  /**
   * Dispatches a received message to all matching handlers.
   * @private
   * @param {string} topic The topic the message was received on.
   * @param {AgentMessage} message The received message.
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
                systemLog(
                  'ipc',
                  `Async handler error for topic ${topic}:`,
                  { error: err instanceof Error ? err.message : String(err) },
                  'error'
                );
              });
            }
          } catch (err) {
            systemLog(
              'ipc',
              `Handler error for topic ${topic}:`,
              { error: err instanceof Error ? err.message : String(err) },
              'error'
            );
          }
        }
      }
    }
  }

  /**
   * Checks if a topic matches a subscription pattern (supports wildcards).
   * @private
   * @param {string} topic The received topic.
   * @param {string} pattern The subscription pattern.
   * @returns {boolean} `true` if the topic matches the pattern.
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
   * Generates the address for the subscriber socket.
   * @private
   * @returns {string} The subscriber address.
   * @throws {Error} If the address format is unsupported.
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
   * Checks if this bus instance is the broker/bus master.
   *
   * @returns {boolean} `true` if this instance is the broker.
   */
  isBusMaster(): boolean {
    return this.isBroker;
  }

  /**
   * Retrieves statistics about the bus for debugging.
   *
   * @returns {BusStats} An object containing bus statistics.
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
