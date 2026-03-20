import { ZeroMQBus, MessageHandler } from './ZeroMQBus.js';
import { BusCoordinator } from './BusCoordinator.js';
import { AgentMessage } from './AgentMessage.js';
import { AgentRegistry, RegisteredAgent } from './AgentRegistry.js';
import { MessagePublisher } from './MessagePublisher.js';
import { systemDiagnosticsService } from '../core/services/diagnostics/SystemDiagnosticsService.js';

/**
 * Configuration for the unified MessageBus.
 */
export interface MessageBusConfig {
  agentId: string;
  model: string;
  projectRoot?: string;
  debug?: boolean;
}

/**
 * Unified MessageBus service that consolidates ZeroMQBus and BusCoordinator.
 *
 * This service provides a single entry point for all IPC (Inter-Process Communication)
 * operations, including bus coordination, message publishing, subscription, and
 * agent registration.
 *
 * It reduces the complexity for consumers by managing the lifecycle of the
 * underlying ZeroMQ sockets and coordination locks.
 *
 * @class MessageBus
 */
export class MessageBus {
  private bus: ZeroMQBus | null = null;
  private coordinator: BusCoordinator;
  private registry: AgentRegistry | null = null;
  private publisher: MessagePublisher | null = null;
  private config: MessageBusConfig;
  private connected: boolean = false;

  /**
   * Creates an instance of MessageBus.
   * @param config The configuration for the message bus.
   */
  constructor(config: MessageBusConfig) {
    this.config = config;
    this.coordinator = new BusCoordinator(config.projectRoot);
  }

  /**
   * Connects to the message bus, performing master/peer coordination.
   *
   * @returns A promise that resolves when the connection is established.
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      if (this.config.debug) {
        systemDiagnosticsService.systemLog('ipc', 'MessageBus: Connecting...');
      }

      // 1. Coordinate and connect/bind the underlying ZeroMQ bus
      this.bus = await this.coordinator.connectWithFallback();

      // 2. Initialize registry and publisher
      this.registry = new AgentRegistry(this.bus, this.config.agentId);
      this.publisher = new MessagePublisher(this.bus, this.config.agentId);

      this.connected = true;

      if (this.config.debug) {
        systemDiagnosticsService.systemLog(
          'ipc',
          `MessageBus: Connected (${this.isMaster() ? 'Master' : 'Peer'})`
        );
      }
    } catch (error) {
      if (this.config.debug) {
        systemDiagnosticsService.systemLog(
          'ipc',
          'MessageBus: Connection failed',
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
      throw error;
    }
  }

  /**
   * Disconnects from the message bus and cleans up resources.
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      // 1. Unregister if registry exists
      if (this.registry && this.config.agentId) {
        this.registry.unregister(this.config.agentId);
      }

      // 2. Cleanup coordinator (closes bus sockets and releases locks)
      await this.coordinator.cleanup();

      this.bus = null;
      this.registry = null;
      this.publisher = null;
      this.connected = false;

      if (this.config.debug) {
        systemDiagnosticsService.systemLog('ipc', 'MessageBus: Disconnected');
      }
    } catch (error) {
      if (this.config.debug) {
        systemDiagnosticsService.systemLog(
          'ipc',
          'MessageBus: Disconnect error',
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
      throw error;
    }
  }

  /**
   * Registers the current agent with the registry.
   * @param agent Initial agent data.
   */
  register(
    agent: Omit<
      RegisteredAgent,
      'id' | 'registeredAt' | 'lastSeen' | 'subscriptions'
    >
  ): void {
    if (!this.registry) throw new Error('MessageBus not connected');
    this.registry.register({
      ...agent,
      id: this.config.agentId,
      subscriptions: new Set(),
    });
  }

  /**
   * Publishes a raw AgentMessage to a topic.
   */
  publish(topic: string, message: AgentMessage): void {
    if (!this.bus) throw new Error('MessageBus not connected');
    this.bus.publish(topic, message);
  }

  /**
   * Subscribes to a topic.
   */
  subscribe(topic: string, handler: MessageHandler): void {
    if (!this.bus) throw new Error('MessageBus not connected');
    this.bus.subscribe(topic, handler);
  }

  /**
   * Unsubscribes from a topic.
   */
  unsubscribe(topic: string, handler: MessageHandler): void {
    if (!this.bus) throw new Error('MessageBus not connected');
    this.bus.unsubscribe(topic, handler);
  }

  /**
   * Broadcasts a payload to a topic (wrapped in an AgentMessage).
   */
  async broadcast(topic: string, payload: unknown): Promise<void> {
    if (!this.publisher) throw new Error('MessageBus not connected');
    await this.publisher.broadcast(topic, payload);
  }

  /**
   * Sends a direct message to a specific agent.
   */
  async sendToAgent(
    agentId: string,
    topic: string,
    payload: unknown
  ): Promise<void> {
    if (!this.publisher) throw new Error('MessageBus not connected');
    await this.publisher.sendTo(agentId, topic, payload);
  }

  /**
   * Returns whether the bus is connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Returns whether this instance is the bus master.
   */
  isMaster(): boolean {
    return this.coordinator.getIsBusMaster();
  }

  /**
   * Returns the message publisher.
   */
  getPublisher(): MessagePublisher | null {
    return this.publisher;
  }

  /**
   * Returns the underlying ZeroMQBus instance.
   * @deprecated Use MessageBus methods directly if possible.
   */
  getUnderlyingBus(): ZeroMQBus | null {
    return this.bus;
  }

  /**
   * Returns the agent registry.
   */
  getRegistry(): AgentRegistry | null {
    return this.registry;
  }
}
