import { ZeroMQBus } from './ZeroMQBus.js';
import {
  AgentMessage,
  MessageFactory,
  Topics,
  AgentRegisteredPayload,
  AgentUnregisteredPayload,
  AgentStatusChangedPayload,
} from './index.js';
import { systemDiagnosticsService } from '../core/services/diagnostics/SystemDiagnosticsService.js';
import { BaseRegistry } from '../core/common/registry.js';

/**
 * Represents an agent's capability.
 */
export interface AgentCapability {
  name: string; // e.g., 'code_review', 'architecture_design'
  description: string;
  model: string; // 'gemini', 'claude', 'opus'
}

/**
 * Represents a registered agent in the system.
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
  projectRoot?: string; // Absolute path to project directory
  projectName?: string; // Inferred from package.json or folder name
  scope?: string; // Subsystem/path this agent manages (e.g., "drivers/net", "kernel/mm").
}

/**
 * Statistics about the agent registry.
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
 */
export class AgentRegistry extends BaseRegistry<RegisteredAgent> {
  private bus: ZeroMQBus;
  private localAgentId: string;

  /**
   * Creates an instance of AgentRegistry.
   *
   * @param {ZeroMQBus} bus The ZeroMQ bus instance for communication.
   * @param {string} localAgentId The ID of the local agent.
   */
  constructor(bus: ZeroMQBus, localAgentId: string) {
    super('AgentRegistry');
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
   */
  // @ts-expect-error - Compatibility override: AgentRegistry.register uses a single argument
  override register(
    agent: Omit<RegisteredAgent, 'registeredAt' | 'lastSeen'>
  ): void {
    const now = Date.now();

    const fullAgent: RegisteredAgent = {
      ...agent,
      registeredAt: now,
      lastSeen: now,
    };

    if (this.has(agent.id)) {
      super.unregister(agent.id);
    }
    super.register(agent.id, fullAgent);

    // Publish registration event (broadcast to all agents)
    const message = MessageFactory.agentRegistered(this.localAgentId, '*', {
      agentId: agent.id,
      model: agent.model,
      type: agent.type,
      capabilities: agent.capabilities.map((c) => c.name),
      projectRoot: agent.projectRoot,
      projectName: agent.projectName,
      scope: agent.scope,
    });

    this.bus.publish(Topics.AGENT_REGISTERED, message);

    systemDiagnosticsService.systemLog(
      'ipc',
      `Registered agent: ${agent.id} (${agent.model})`
    );
  }

  /**
   * Unregisters an agent and broadcasts its departure.
   *
   * @param {string} agentId The ID of the agent to unregister.
   */
  override unregister(agentId: string): boolean {
    const removed = super.unregister(agentId);

    const message = MessageFactory.create(
      this.localAgentId,
      '*', // Broadcast to all agents
      Topics.AGENT_UNREGISTERED,
      {
        agentId,
      }
    );

    this.bus.publish(Topics.AGENT_UNREGISTERED, message);

    systemDiagnosticsService.systemLog('ipc', `Unregistered agent: ${agentId}`);
    return removed;
  }

  /**
   * Updates the status of an agent and broadcasts the change.
   *
   * @param {string} agentId The ID of the agent to update.
   * @param {RegisteredAgent['status']} status The new status.
   */
  updateStatus(agentId: string, status: RegisteredAgent['status']): void {
    const agent = this.tryGet(agentId);

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
  // @ts-expect-error - Compatibility override: AgentRegistry.get returns undefined instead of throwing
  override get(agentId: string): RegisteredAgent | undefined {
    return this.tryGet(agentId);
  }

  /**
   * Finds all agents that have a specific capability.
   */
  findByCapability(capability: string): RegisteredAgent[] {
    return this.getAll().filter((agent) =>
      agent.capabilities.some((cap) => cap.name === capability)
    );
  }

  /**
   * Finds all agents of a specific model.
   */
  findByModel(model: string): RegisteredAgent[] {
    return this.getAll().filter((agent) => agent.model === model);
  }

  /**
   * Finds all agents of a specific type.
   */
  findByType(type: 'interactive' | 'background'): RegisteredAgent[] {
    return this.getAll().filter((agent) => agent.type === type);
  }

  /**
   * Retrieves all agents that are not idle.
   */
  getActiveAgents(): RegisteredAgent[] {
    return this.getAll().filter((agent) => agent.status !== 'idle');
  }

  /**
   * Handles an incoming `agent.registered` event from the bus.
   */
  private handleAgentRegistered(
    msg: AgentMessage<AgentRegisteredPayload>
  ): void {
    const {
      agentId,
      model,
      type,
      capabilities,
      projectRoot,
      projectName,
      scope,
    } = msg.payload;

    // Don't re-register ourselves
    if (agentId === this.localAgentId) {
      return;
    }

    const now = Date.now();

    // Create agent entry with minimal info
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
      projectRoot,
      projectName,
      scope,
    };

    if (this.has(agentId)) {
      super.unregister(agentId);
    }
    // We call BaseRegistry.register directly to avoid the Omit type mismatch in our override
    super.register(agentId, agent);

    systemDiagnosticsService.systemLog(
      'ipc',
      `Remote agent registered: ${agentId} (${model})${projectName ? ` from ${projectName}` : ''}${scope ? ` [${scope}]` : ''}`
    );
  }

  /**
   * Handles an incoming `agent.unregistered` event from the bus.
   */
  private handleAgentUnregistered(
    msg: AgentMessage<AgentUnregisteredPayload>
  ): void {
    const { agentId } = msg.payload;

    // Don't unregister ourselves
    if (agentId === this.localAgentId) {
      return;
    }

    this.unregister(agentId);

    systemDiagnosticsService.systemLog(
      'ipc',
      `Remote agent unregistered: ${agentId}`
    );
  }

  /**
   * Handles an incoming `agent.status_changed` event from the bus.
   */
  private handleAgentStatusChanged(
    msg: AgentMessage<AgentStatusChangedPayload>
  ): void {
    const { agentId, status } = msg.payload;

    // Update status for remote agents
    const agent = this.tryGet(agentId);

    if (agent && agentId !== this.localAgentId) {
      agent.status = status;
      agent.lastSeen = Date.now();
    }
  }

  /**
   * Removes stale agents that have not been seen for a certain period.
   */
  cleanupStaleAgents(): void {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds

    for (const agent of this.getAll()) {
      if (
        agent.id !== this.localAgentId &&
        now - agent.lastSeen > staleThreshold
      ) {
        this.unregister(agent.id);
        systemDiagnosticsService.systemLog(
          'ipc',
          `Cleaned up stale agent: ${agent.id}`
        );
      }
    }
  }

  /**
   * Retrieves statistics about the agent registry.
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

  /**
   * Discovers the lattice topology based on agent scopes.
   */
  getLatticeTopology(): Record<string, string[]> {
    const topology: Record<string, string[]> = {};

    for (const agent of this.getAll()) {
      if (agent.scope) {
        if (!topology[agent.scope]) {
          topology[agent.scope] = [];
        }
        topology[agent.scope].push(agent.id);
      }
    }

    return topology;
  }
}
