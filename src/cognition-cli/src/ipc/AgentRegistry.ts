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

export interface AgentCapability {
  name: string; // e.g., 'code_review', 'architecture_design'
  description: string;
  model: string; // 'gemini', 'claude', 'opus'
}

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

export class AgentRegistry {
  private agents: Map<string, RegisteredAgent>;
  private bus: ZeroMQBus;
  private localAgentId: string;

  constructor(bus: ZeroMQBus, localAgentId: string) {
    this.agents = new Map();
    this.bus = bus;
    this.localAgentId = localAgentId;

    this.setupSubscriptions();
  }

  /**
   * Subscribe to agent lifecycle events
   */
  private setupSubscriptions(): void {
    // Listen for new agent registrations
    this.bus.subscribe(Topics.AGENT_REGISTERED, (msg) => {
      this.handleAgentRegistered(msg as AgentMessage<AgentRegisteredPayload>);
    });

    // Listen for agent unregistrations
    this.bus.subscribe(Topics.AGENT_UNREGISTERED, (msg) => {
      this.handleAgentUnregistered(msg as AgentMessage<AgentUnregisteredPayload>);
    });

    // Listen for agent status changes
    this.bus.subscribe(Topics.AGENT_STATUS_CHANGED, (msg) => {
      this.handleAgentStatusChanged(msg as AgentMessage<AgentStatusChangedPayload>);
    });
  }

  /**
   * Register a new agent
   * Publishes agent.registered event to notify other TUI instances
   */
  register(agent: Omit<RegisteredAgent, 'registeredAt' | 'lastSeen'>): void {
    const now = Date.now();

    const fullAgent: RegisteredAgent = {
      ...agent,
      registeredAt: now,
      lastSeen: now,
    };

    this.agents.set(agent.id, fullAgent);

    // Publish registration event
    const message = MessageFactory.agentRegistered(this.localAgentId, {
      agentId: agent.id,
      model: agent.model,
      type: agent.type,
      capabilities: agent.capabilities.map((c) => c.name),
    });

    this.bus.publish(Topics.AGENT_REGISTERED, message);

    console.log(`✅ Registered agent: ${agent.id} (${agent.model})`);
  }

  /**
   * Unregister an agent
   * Publishes agent.unregistered event to notify other TUI instances
   */
  unregister(agentId: string): void {
    this.agents.delete(agentId);

    const message = MessageFactory.create(
      this.localAgentId,
      Topics.AGENT_UNREGISTERED,
      {
        agentId,
      }
    );

    this.bus.publish(Topics.AGENT_UNREGISTERED, message);

    console.log(`❌ Unregistered agent: ${agentId}`);
  }

  /**
   * Update agent status
   * Publishes agent.status_changed event
   */
  updateStatus(agentId: string, status: RegisteredAgent['status']): void {
    const agent = this.agents.get(agentId);

    if (agent) {
      agent.status = status;
      agent.lastSeen = Date.now();

      const message = MessageFactory.create(
        this.localAgentId,
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
   * Get agent by ID
   */
  get(agentId: string): RegisteredAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAll(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Find agents by capability
   * Returns all agents that have the specified capability
   */
  findByCapability(capability: string): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter((agent) =>
      agent.capabilities.some((cap) => cap.name === capability)
    );
  }

  /**
   * Find agents by model
   */
  findByModel(model: string): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.model === model
    );
  }

  /**
   * Find agents by type
   */
  findByType(type: 'interactive' | 'background'): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.type === type
    );
  }

  /**
   * Get active agents (not idle)
   */
  getActiveAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.status !== 'idle'
    );
  }

  /**
   * Handle incoming agent.registered event
   */
  private handleAgentRegistered(msg: AgentMessage<AgentRegisteredPayload>): void {
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
   * Handle incoming agent.unregistered event
   */
  private handleAgentUnregistered(msg: AgentMessage<AgentUnregisteredPayload>): void {
    const { agentId } = msg.payload;

    // Don't unregister ourselves
    if (agentId === this.localAgentId) {
      return;
    }

    this.agents.delete(agentId);

    console.log(`📤 Remote agent unregistered: ${agentId}`);
  }

  /**
   * Handle incoming agent.status_changed event
   */
  private handleAgentStatusChanged(msg: AgentMessage<AgentStatusChangedPayload>): void {
    const { agentId, status } = msg.payload;

    // Update status for remote agents
    const agent = this.agents.get(agentId);

    if (agent && agentId !== this.localAgentId) {
      agent.status = status;
      agent.lastSeen = Date.now();
    }
  }

  /**
   * Cleanup stale agents (no heartbeat for 30 seconds)
   * Should be called periodically
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
   * Get registry statistics
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
