/**
 * Agent Registry Tests
 *
 * Tests the AgentRegistry implementation for agent discovery and
 * capability-based routing in the multi-agent system.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentCapability, RegistryStats } from '../AgentRegistry.js';

// Create mock functions
const mockPublish = vi.fn();
const mockSubscribe = vi.fn();

// Mock ZeroMQBus
vi.mock('../ZeroMQBus.js', () => ({
  ZeroMQBus: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
    subscribe: mockSubscribe,
  })),
}));

// Mock AgentMessage
vi.mock('../AgentMessage.js', () => ({
  Topics: {
    AGENT_REGISTERED: 'agent.registered',
    AGENT_UNREGISTERED: 'agent.unregistered',
    AGENT_STATUS_CHANGED: 'agent.status_changed',
  },
  MessageFactory: {
    agentRegistered: vi.fn((from, to, payload) => ({
      from,
      to,
      topic: 'agent.registered',
      payload,
    })),
    create: vi.fn((from, to, topic, payload) => ({
      from,
      to,
      topic,
      payload,
    })),
  },
}));

describe('AgentRegistry', () => {
  let AgentRegistry: typeof import('../AgentRegistry.js').AgentRegistry;
  let ZeroMQBus: typeof import('../ZeroMQBus.js').ZeroMQBus;

  let subscriptionHandlers: Map<string, (msg: unknown) => void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    subscriptionHandlers = new Map();

    // Capture subscription handlers
    mockSubscribe.mockImplementation(
      (topic: string, handler: (msg: unknown) => void) => {
        subscriptionHandlers.set(topic, handler);
      }
    );

    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const registryModule = await import('../AgentRegistry.js');
    const busModule = await import('../ZeroMQBus.js');

    AgentRegistry = registryModule.AgentRegistry;
    ZeroMQBus = busModule.ZeroMQBus;
  });

  describe('Constructor', () => {
    it('should create instance with bus and local agent ID', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      expect(registry).toBeDefined();
    });

    it('should set up subscriptions for agent lifecycle events', () => {
      const bus = new ZeroMQBus({});
      new AgentRegistry(bus, 'local-agent-1');

      expect(mockSubscribe).toHaveBeenCalledWith(
        'agent.registered',
        expect.any(Function)
      );
      expect(mockSubscribe).toHaveBeenCalledWith(
        'agent.unregistered',
        expect.any(Function)
      );
      expect(mockSubscribe).toHaveBeenCalledWith(
        'agent.status_changed',
        expect.any(Function)
      );
    });
  });

  describe('register()', () => {
    it('should register an agent and publish event', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      const capability: AgentCapability = {
        name: 'coding',
        description: 'Writes TypeScript code',
        model: 'gemini',
      };

      registry.register({
        id: 'gemini-coder-1',
        type: 'background',
        model: 'gemini',
        capabilities: [capability],
        status: 'idle',
        subscriptions: new Set(['code.completion_request']),
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'agent.registered',
        expect.objectContaining({
          payload: expect.objectContaining({
            agentId: 'gemini-coder-1',
            model: 'gemini',
            type: 'background',
          }),
        })
      );
    });

    it('should set registeredAt and lastSeen timestamps', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      const beforeTime = Date.now();

      registry.register({
        id: 'test-agent',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      const afterTime = Date.now();
      const agent = registry.get('test-agent');

      expect(agent).toBeDefined();
      expect(agent!.registeredAt).toBeGreaterThanOrEqual(beforeTime);
      expect(agent!.registeredAt).toBeLessThanOrEqual(afterTime);
      expect(agent!.lastSeen).toEqual(agent!.registeredAt);
    });

    it('should store agent in registry', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      registry.register({
        id: 'test-agent',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      const agent = registry.get('test-agent');
      expect(agent).toBeDefined();
      expect(agent!.id).toBe('test-agent');
    });

    it('should include projectRoot and projectName if provided', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      registry.register({
        id: 'test-agent',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
        projectRoot: '/home/user/my-project',
        projectName: 'my-project',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'agent.registered',
        expect.objectContaining({
          payload: expect.objectContaining({
            projectRoot: '/home/user/my-project',
            projectName: 'my-project',
          }),
        })
      );
    });
  });

  describe('unregister()', () => {
    it('should remove agent and publish event', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      registry.register({
        id: 'test-agent',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      registry.unregister('test-agent');

      expect(mockPublish).toHaveBeenCalledWith(
        'agent.unregistered',
        expect.objectContaining({
          payload: expect.objectContaining({
            agentId: 'test-agent',
          }),
        })
      );

      expect(registry.get('test-agent')).toBeUndefined();
    });
  });

  describe('updateStatus()', () => {
    it('should update agent status and publish event', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      registry.register({
        id: 'test-agent',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      const beforeUpdate = Date.now();
      registry.updateStatus('test-agent', 'working');
      const afterUpdate = Date.now();

      const agent = registry.get('test-agent');
      expect(agent!.status).toBe('working');
      expect(agent!.lastSeen).toBeGreaterThanOrEqual(beforeUpdate);
      expect(agent!.lastSeen).toBeLessThanOrEqual(afterUpdate);

      expect(mockPublish).toHaveBeenCalledWith(
        'agent.status_changed',
        expect.objectContaining({
          payload: expect.objectContaining({
            agentId: 'test-agent',
            status: 'working',
          }),
        })
      );
    });

    it('should not publish if agent does not exist', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      // Clear calls from constructor
      mockPublish.mockClear();

      registry.updateStatus('nonexistent-agent', 'working');

      expect(mockPublish).not.toHaveBeenCalled();
    });
  });

  describe('get()', () => {
    it('should return agent by ID', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      registry.register({
        id: 'test-agent',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      const agent = registry.get('test-agent');
      expect(agent).toBeDefined();
      expect(agent!.id).toBe('test-agent');
    });

    it('should return undefined for unknown agent', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      expect(registry.get('unknown')).toBeUndefined();
    });
  });

  describe('getAll()', () => {
    it('should return all registered agents', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      registry.register({
        id: 'agent-1',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      registry.register({
        id: 'agent-2',
        type: 'background',
        model: 'gemini',
        capabilities: [],
        status: 'working',
        subscriptions: new Set(),
      });

      const agents = registry.getAll();
      expect(agents.length).toBe(2);
      expect(agents.map((a) => a.id)).toContain('agent-1');
      expect(agents.map((a) => a.id)).toContain('agent-2');
    });

    it('should return empty array when no agents registered', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('findByCapability()', () => {
    it('should find agents with specific capability', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      registry.register({
        id: 'coder-1',
        type: 'background',
        model: 'gemini',
        capabilities: [
          { name: 'coding', description: 'Writes code', model: 'gemini' },
        ],
        status: 'idle',
        subscriptions: new Set(),
      });

      registry.register({
        id: 'reviewer-1',
        type: 'background',
        model: 'claude',
        capabilities: [
          { name: 'code_review', description: 'Reviews code', model: 'claude' },
        ],
        status: 'idle',
        subscriptions: new Set(),
      });

      const coders = registry.findByCapability('coding');
      expect(coders.length).toBe(1);
      expect(coders[0].id).toBe('coder-1');

      const reviewers = registry.findByCapability('code_review');
      expect(reviewers.length).toBe(1);
      expect(reviewers[0].id).toBe('reviewer-1');
    });

    it('should return empty array if no agents have capability', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      registry.register({
        id: 'agent-1',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      const results = registry.findByCapability('unknown_capability');
      expect(results).toEqual([]);
    });
  });

  describe('findByModel()', () => {
    it('should find agents by model', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      registry.register({
        id: 'gemini-1',
        type: 'background',
        model: 'gemini',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      registry.register({
        id: 'claude-1',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      const geminiAgents = registry.findByModel('gemini');
      expect(geminiAgents.length).toBe(1);
      expect(geminiAgents[0].id).toBe('gemini-1');
    });
  });

  describe('findByType()', () => {
    it('should find agents by type', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      registry.register({
        id: 'interactive-1',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      registry.register({
        id: 'background-1',
        type: 'background',
        model: 'gemini',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      const interactiveAgents = registry.findByType('interactive');
      expect(interactiveAgents.length).toBe(1);
      expect(interactiveAgents[0].id).toBe('interactive-1');

      const backgroundAgents = registry.findByType('background');
      expect(backgroundAgents.length).toBe(1);
      expect(backgroundAgents[0].id).toBe('background-1');
    });
  });

  describe('getActiveAgents()', () => {
    it('should return non-idle agents', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      registry.register({
        id: 'idle-agent',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      registry.register({
        id: 'working-agent',
        type: 'background',
        model: 'gemini',
        capabilities: [],
        status: 'working',
        subscriptions: new Set(),
      });

      registry.register({
        id: 'thinking-agent',
        type: 'background',
        model: 'opus',
        capabilities: [],
        status: 'thinking',
        subscriptions: new Set(),
      });

      const activeAgents = registry.getActiveAgents();
      expect(activeAgents.length).toBe(2);
      expect(activeAgents.map((a) => a.id)).toContain('working-agent');
      expect(activeAgents.map((a) => a.id)).toContain('thinking-agent');
      expect(activeAgents.map((a) => a.id)).not.toContain('idle-agent');
    });
  });

  describe('Remote Agent Handling', () => {
    it('should handle agent.registered events from remote agents', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      // Simulate receiving a remote agent registration
      const handler = subscriptionHandlers.get('agent.registered');
      expect(handler).toBeDefined();

      handler!({
        payload: {
          agentId: 'remote-agent-1',
          model: 'gemini',
          type: 'background',
          capabilities: ['coding', 'review'],
          projectRoot: '/remote/project',
          projectName: 'remote-project',
        },
      });

      const remoteAgent = registry.get('remote-agent-1');
      expect(remoteAgent).toBeDefined();
      expect(remoteAgent!.model).toBe('gemini');
      expect(remoteAgent!.type).toBe('background');
      expect(remoteAgent!.projectName).toBe('remote-project');
    });

    it('should not re-register local agent from remote event', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      // Simulate receiving our own registration (echoed back)
      const handler = subscriptionHandlers.get('agent.registered');

      handler!({
        payload: {
          agentId: 'local-agent-1', // Same as localAgentId
          model: 'claude',
          type: 'interactive',
          capabilities: [],
        },
      });

      // Should not be in registry (we filter out self)
      expect(registry.get('local-agent-1')).toBeUndefined();
    });

    it('should handle agent.unregistered events from remote agents', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      // First register a remote agent
      const registerHandler = subscriptionHandlers.get('agent.registered');
      registerHandler!({
        payload: {
          agentId: 'remote-agent-1',
          model: 'gemini',
          type: 'background',
          capabilities: [],
        },
      });

      expect(registry.get('remote-agent-1')).toBeDefined();

      // Now unregister it
      const unregisterHandler = subscriptionHandlers.get('agent.unregistered');
      unregisterHandler!({
        payload: {
          agentId: 'remote-agent-1',
        },
      });

      expect(registry.get('remote-agent-1')).toBeUndefined();
    });

    it('should not unregister local agent from remote event', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      // Register local agent
      registry.register({
        id: 'local-agent-1',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      // Simulate receiving unregister for our own agent
      const handler = subscriptionHandlers.get('agent.unregistered');
      handler!({
        payload: {
          agentId: 'local-agent-1',
        },
      });

      // Should still be in registry (we filter out self)
      expect(registry.get('local-agent-1')).toBeDefined();
    });

    it('should handle agent.status_changed events from remote agents', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      // Register a remote agent
      const registerHandler = subscriptionHandlers.get('agent.registered');
      registerHandler!({
        payload: {
          agentId: 'remote-agent-1',
          model: 'gemini',
          type: 'background',
          capabilities: [],
        },
      });

      // Update status
      const statusHandler = subscriptionHandlers.get('agent.status_changed');
      const beforeUpdate = Date.now();

      statusHandler!({
        payload: {
          agentId: 'remote-agent-1',
          status: 'working',
        },
      });

      const afterUpdate = Date.now();
      const agent = registry.get('remote-agent-1');

      expect(agent!.status).toBe('working');
      expect(agent!.lastSeen).toBeGreaterThanOrEqual(beforeUpdate);
      expect(agent!.lastSeen).toBeLessThanOrEqual(afterUpdate);
    });

    it('should not update status for local agent from remote event', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      // Register local agent
      registry.register({
        id: 'local-agent-1',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      // Simulate receiving status change for our own agent
      const handler = subscriptionHandlers.get('agent.status_changed');
      handler!({
        payload: {
          agentId: 'local-agent-1',
          status: 'working',
        },
      });

      // Should remain idle (we filter out self)
      expect(registry.get('local-agent-1')!.status).toBe('idle');
    });
  });

  describe('cleanupStaleAgents()', () => {
    it('should remove agents not seen within threshold', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      // Register a remote agent
      const registerHandler = subscriptionHandlers.get('agent.registered');
      registerHandler!({
        payload: {
          agentId: 'stale-agent',
          model: 'gemini',
          type: 'background',
          capabilities: [],
        },
      });

      // Manually set lastSeen to be stale (>30 seconds ago)
      const agent = registry.get('stale-agent');
      agent!.lastSeen = Date.now() - 40000; // 40 seconds ago

      registry.cleanupStaleAgents();

      expect(registry.get('stale-agent')).toBeUndefined();
    });

    it('should not remove local agent even if stale', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      // Register local agent
      registry.register({
        id: 'local-agent-1',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      // Manually make it stale
      const agent = registry.get('local-agent-1');
      agent!.lastSeen = Date.now() - 40000;

      registry.cleanupStaleAgents();

      // Should still exist (local agent protected)
      expect(registry.get('local-agent-1')).toBeDefined();
    });

    it('should not remove recently seen agents', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      // Register a remote agent
      const registerHandler = subscriptionHandlers.get('agent.registered');
      registerHandler!({
        payload: {
          agentId: 'fresh-agent',
          model: 'gemini',
          type: 'background',
          capabilities: [],
        },
      });

      // Agent was just registered, so lastSeen is current
      registry.cleanupStaleAgents();

      // Should still exist
      expect(registry.get('fresh-agent')).toBeDefined();
    });
  });

  describe('getStats()', () => {
    it('should return correct statistics', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      registry.register({
        id: 'gemini-1',
        type: 'background',
        model: 'gemini',
        capabilities: [],
        status: 'idle',
        subscriptions: new Set(),
      });

      registry.register({
        id: 'claude-1',
        type: 'interactive',
        model: 'claude',
        capabilities: [],
        status: 'working',
        subscriptions: new Set(),
      });

      registry.register({
        id: 'opus-1',
        type: 'background',
        model: 'opus',
        capabilities: [],
        status: 'thinking',
        subscriptions: new Set(),
      });

      const stats: RegistryStats = registry.getStats();

      expect(stats.totalAgents).toBe(3);
      expect(stats.interactive).toBe(1);
      expect(stats.background).toBe(2);
      expect(stats.byModel.gemini).toBe(1);
      expect(stats.byModel.claude).toBe(1);
      expect(stats.byModel.opus).toBe(1);
      expect(stats.byStatus.idle).toBe(1);
      expect(stats.byStatus.working).toBe(1);
      expect(stats.byStatus.thinking).toBe(1);
    });

    it('should return zeros when no agents registered', () => {
      const bus = new ZeroMQBus({});
      const registry = new AgentRegistry(bus, 'local-agent-1');

      const stats = registry.getStats();

      expect(stats.totalAgents).toBe(0);
      expect(stats.interactive).toBe(0);
      expect(stats.background).toBe(0);
      expect(stats.byModel.gemini).toBe(0);
      expect(stats.byModel.claude).toBe(0);
      expect(stats.byModel.opus).toBe(0);
      expect(stats.byStatus.idle).toBe(0);
      expect(stats.byStatus.working).toBe(0);
      expect(stats.byStatus.thinking).toBe(0);
    });
  });
});
