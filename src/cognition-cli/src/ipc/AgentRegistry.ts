/**
 * Agent Registry
 *
 * Central registry for agent discovery and capability-based routing.
 * Each TUI maintains a local view of all registered agents via pub/sub.
 */

import { ZeroMQBus } from './ZeroMQBus.js';
import {
  AgentMessage,
  AgentRegisteredPayload,
  AgentUnregisteredPayload,
  AgentStatusChangedPayload,
  Topics,
  MessageFactory,
} from './AgentMessage.js';

/**
 * Represents an agent's capability.
 *
 * @interface AgentCapability
 * @property {string} name The unique name of the capability (e.g., 'code_review').
 * @property {string} description A brief description of what the capability does.
 * @property {string} model The preferred model for this capability (e.g., 'opus').
 */
export interface AgentCapability {
  name: string; // e.g., 'code_review', 'architecture_design'
  description: string;
  model: string; // 'gemini', 'claude', 'opus'
}

/**
 * Represents a registered agent in the system.
 *
 * @interface RegisteredAgent
 * @property {string} id The unique identifier for the agent.
 * @property {'interactive' | 'background'} type The type of the agent.
 * @property {string} model The underlying model of the agent.
 * @property {AgentCapability[]} capabilities The capabilities of the agent.
 * @property {'idle' | 'thinking' | 'working'} status The current status of the agent.
 * @property {Set<string>} subscriptions The set of message topics the agent is subscribed to.
 * @property {number} registeredAt Unix timestamp of when the agent was registered.
 * @property {number} lastSeen Unix timestamp of the agent's last activity.
 */
export interface RegisteredAgent {
  id: string; // Unique agent ID (e.g., 'claude-1')
  type: 'interactive' | 'background';
  model: string; // 'gemini', 'claude', 'opus'
  capabilities: AgentCapability[];
  status: 'idle' | 'thinking' | 'working';
  subscriptions: Set<string>; // Topics this agent subscribes to
  registeredAt: number; // Unix timestamp
  lastSeen: number; // Unix timestamp (for heartbeat)
}

/**
 * Statistics about the agent registry.
 *
 * @interface RegistryStats
 * @property {number} totalAgents The total number of registered agents.
 * @property {number} interactive The number of interactive agents.
 * @property {number} background The number of background agents.
 * @property {object} byModel The count of agents grouped by model.
 * @property {object} byStatus The count of agents grouped by status.
 */
export interface RegistryStats {
  totalAgents: number;
  interactive: number;
  background: number;
  byModel: {
    gemini: number;
    claude: number;
    opus: number;
  };
  byStatus: {
    idle: number;
    thinking: number;
    working: number;
  };
}

/**
 * Manages the discovery and lifecycle of agents in the multi-agent system.
 *
 * This class maintains a local view of all registered agents by listening to
 * registration, unregistration, and status change events on the ZeroMQ bus.
 * It provides methods for querying agents based on their capabilities, model,
 * or status, which is essential for dynamic task routing.
 *
 * @class AgentRegistry
 *
 * @example
 * const bus = new ZeroMQBus();
 * await bus.connect();
 * const registry = new AgentRegistry(bus, 'local-agent-1');
 *
 * // Register a local agent
 * registry.register({
 *   id: 'local-agent-1',
 *   type: 'interactive',
 *   model: 'gemini',
 *   capabilities: [{ name: 'coding', description: 'Writes code', model: 'gemini' }],
 *   status: 'idle',
 *   subscriptions: new Set(['code.*']),
 * });
 *
 * // Find an agent for a specific task
 * const codeReviewer = registry.findByCapability('code_review');
 */
export class AgentRegistry {
  private agents: Map<string, RegisteredAgent>;
  private bus: ZeroMQBus;
  private localAgentId: string;

  /**
   * Creates an instance of AgentRegistry.
   *
   * @param {ZeroMQBus} bus The ZeroMQ bus instance for communication.
   * @param {string} localAgentId The ID of the local agent.
   */
  constructor(bus: ZeroMQBus, localAgentId: string) {
    this.agents = new Map();
    this.bus = bus;
    this.localAgentId = localAgentId;

    this.setupSubscriptions();
  }

  /**
   * Subscribes to agent lifecycle events on the message bus.
   * @private
   */
  private setupSubscriptions(): void {
    // Listen for new agent registrations
    this.bus.subscribe(Topics.AGENT_REGISTERED, (msg) => {
      this.handleAgentRegistered(msg as AgentMessage<AgentRegisteredPayload>);
    });

    // Listen for agent unregistrations
    this.bus.subscribe(Topics.AGENT_UNREGISTERED, (msg) => {
      this.handleAgentUnregistered(
        msg as AgentMessage<AgentUnregisteredPayload>
      );
    });

    // Listen for agent status changes
    this.bus.subscribe(Topics.AGENT_STATUS_CHANGED, (msg) => {
      this.handleAgentStatusChanged(
        msg as AgentMessage<AgentStatusChangedPayload>
      );
    });
  }

  /**
   * Registers a new agent and broadcasts its presence to the network.
   *
   * @param {Omit<RegisteredAgent, 'registeredAt' | 'lastSeen'>} agent The agent to register.
   *
   * @example
   * registry.register({
   *   id: 'gemini-coder-1',
   *   type: 'background',
   *   model: 'gemini',
   *   capabilities: [{ name: 'coding', description: 'Writes TypeScript code', model: 'gemini' }],
   *   status: 'idle',
   *   subscriptions: new Set(['code.completion_request']),
   * });
   */
  register(agent: Omit<RegisteredAgent, 'registeredAt' | 'lastSeen'>): void {
    const now = Date.now();

    const fullAgent: RegisteredAgent = {
      ...agent,
      registeredAt: now,
      lastSeen: now,
    };

    this.agents.set(agent.id, fullAgent);

    // Publish registration event (broadcast to all agents)
    const message = MessageFactory.agentRegistered(this.localAgentId, '*', {
      agentId: agent.id,
      model: agent.model,
      type: agent.type,
      capabilities: agent.capabilities.map((c) => c.name),
    });

    this.bus.publish(Topics.AGENT_REGISTERED, message);

    console.log(`✅ Registered agent: ${agent.id} (${agent.model})`);
  }

  /**
   * Unregisters an agent and broadcasts its departure.
   *
   * @param {string} agentId The ID of the agent to unregister.
   */
  unregister(agentId: string): void {
    this.agents.delete(agentId);

    const message = MessageFactory.create(
      this.localAgentId,
      '*', // Broadcast to all agents
      Topics.AGENT_UNREGISTERED,
      {
        agentId,
      }
    );

    this.bus.publish(Topics.AGENT_UNREGISTERED, message);

    console.log(`❌ Unregistered agent: ${agentId}`);
  }

  /**
   * Updates the status of an agent and broadcasts the change.
   *
   * @param {string} agentId The ID of the agent to update.
   * @param {RegisteredAgent['status']} status The new status.
   */
  updateStatus(agentId: string, status: RegisteredAgent['status']): void {
    const agent = this.agents.get(agentId);

    if (agent) {
      agent.status = status;
      agent.lastSeen = Date.now();

      const message = MessageFactory.create(
        this.localAgentId,
        '*', // Broadcast to all agents
        Topics.AGENT_STATUS_CHANGED,
        {
          agentId,
          status,
        }
      );

      this.bus.publish(Topics.AGENT_STATUS_CHANGED, message);
    }
  }

  /**
   * Retrieves an agent by its ID.
   *
   * @param {string} agentId The ID of the agent to retrieve.
   * @returns {RegisteredAgent | undefined} The agent, or undefined if not found.
   */
  get(agentId: string): RegisteredAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Retrieves all registered agents.
   *
   * @returns {RegisteredAgent[]} An array of all registered agents.
   */
  getAll(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Finds all agents that have a specific capability.
   *
   * @param {string} capability The capability to search for.
   * @returns {RegisteredAgent[]} A list of agents with the specified capability.
   *
   * @example
   * const reviewers = registry.findByCapability('code_review');
   */
  findByCapability(capability: string): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter((agent) =>
      agent.capabilities.some((cap) => cap.name === capability)
    );
  }

  /**
   * Finds all agents of a specific model.
   *
   * @param {string} model The model to search for (e.g., 'gemini').
   * @returns {RegisteredAgent[]} A list of agents of the specified model.
   */
  findByModel(model: string): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.model === model
    );
  }

  /**
   * Finds all agents of a specific type.
   *
   * @param {'interactive' | 'background'} type The agent type to search for.
   * @returns {RegisteredAgent[]} A list of agents of the specified type.
   */
  findByType(type: 'interactive' | 'background'): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.type === type
    );
  }

  /**
   * Retrieves all agents that are not idle.
   *
   * @returns {RegisteredAgent[]} A list of active agents.
   */
  getActiveAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.status !== 'idle'
    );
  }

  /**
   * Handles an incoming `agent.registered` event from the bus.
   * @private
   * @param {AgentMessage<AgentRegisteredPayload>} msg The registration message.
   */
  private handleAgentRegistered(
    msg: AgentMessage<AgentRegisteredPayload>
  ): void {
    const { agentId, model, type, capabilities } = msg.payload;

    // Don't re-register ourselves
    if (agentId === this.localAgentId) {
      return;
    }

    const now = Date.now();

    // Create agent entry with minimal info (we don't have full details)
    const agent: RegisteredAgent = {
      id: agentId,
      type,
      model,
      capabilities: capabilities.map((name: string) => ({
        name,
        description: '',
        model,
      })),
      status: 'idle',
      subscriptions: new Set(),
      registeredAt: now,
      lastSeen: now,
    };

    this.agents.set(agentId, agent);

    console.log(`📥 Remote agent registered: ${agentId} (${model})`);
  }

  /**
   * Handles an incoming `agent.unregistered` event from the bus.
   * @private
   * @param {AgentMessage<AgentUnregisteredPayload>} msg The unregistration message.
   */
  private handleAgentUnregistered(
    msg: AgentMessage<AgentUnregisteredPayload>
  ): void {
    const { agentId } = msg.payload;

    // Don't unregister ourselves
    if (agentId === this.localAgentId) {
      return;
    }

    this.agents.delete(agentId);

    console.log(`📤 Remote agent unregistered: ${agentId}`);
  }

  /**
   * Handles an incoming `agent.status_changed` event from the bus.
   * @private
   * @param {AgentMessage<AgentStatusChangedPayload>} msg The status change message.
   */
  private handleAgentStatusChanged(
    msg: AgentMessage<AgentStatusChangedPayload>
  ): void {
    const { agentId, status } = msg.payload;

    // Update status for remote agents
    const agent = this.agents.get(agentId);

    if (agent && agentId !== this.localAgentId) {
      agent.status = status;
      agent.lastSeen = Date.now();
    }
  }

  /**
   * Removes stale agents that have not been seen for a certain period.
   * This method should be called periodically to keep the registry clean.
   *
   * @example
   * setInterval(() => registry.cleanupStaleAgents(), 30000);
   */
  cleanupStaleAgents(): void {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds

    for (const [agentId, agent] of this.agents.entries()) {
      if (
        agentId !== this.localAgentId &&
        now - agent.lastSeen > staleThreshold
      ) {
        this.agents.delete(agentId);
        console.log(`🧹 Cleaned up stale agent: ${agentId}`);
      }
    }
  }

  /**
   * Retrieves statistics about the agent registry.
   *
   * @returns {RegistryStats} An object containing registry statistics.
   */
  getStats(): RegistryStats {
    const agents = this.getAll();

    return {
      totalAgents: agents.length,
      interactive: agents.filter((a) => a.type === 'interactive').length,
      background: agents.filter((a) => a.type === 'background').length,
      byModel: {
        gemini: agents.filter((a) => a.model === 'gemini').length,
        claude: agents.filter((a) => a.model === 'claude').length,
        opus: agents.filter((a) => a.model === 'opus').length,
      },
      byStatus: {
        idle: agents.filter((a) => a.status === 'idle').length,
        thinking: agents.filter((a) => a.status === 'thinking').length,
        working: agents.filter((a) => a.status === 'working').length,
      },
    };
  }
}
