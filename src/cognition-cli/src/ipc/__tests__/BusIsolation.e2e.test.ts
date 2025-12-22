/**
 * Bus Isolation E2E Tests
 *
 * Tests actual message delivery across different bus configurations:
 * - Project-specific isolation
 * - Global mesh communication
 * - Agent discovery within/across buses
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { BusCoordinator } from '../BusCoordinator';
import { MessageQueueMonitor } from '../MessageQueueMonitor';
import { MessagePublisher } from '../MessagePublisher';
import { getActiveAgents, resolveAgentId } from '../agent-discovery';
import { ZeroMQBus } from '../ZeroMQBus';

describe('Bus Isolation E2E', () => {
  let tempDir: string;
  let coordinators: Array<{ cleanup: () => Promise<void> }> = [];
  let monitors: MessageQueueMonitor[] = [];

  beforeEach(async () => {
    // Create temp directory for .sigma structures
    tempDir = path.join(
      os.tmpdir(),
      `bus-isolation-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(tempDir);

    // Sandbox home directory to prevent pollution
    process.env.COGNITION_HOME_DIR = tempDir;

    // Clear IPC_SIGMA_BUS
    delete process.env.IPC_SIGMA_BUS;
  });

  afterEach(async () => {
    // Stop all monitors
    for (const monitor of monitors) {
      if (monitor.isRunning()) {
        await monitor.stop();
      }
    }
    monitors = [];

    // Cleanup all coordinators
    for (const coordinator of coordinators) {
      try {
        await coordinator.cleanup();
      } catch {
        // Ignore cleanup errors
      }
    }
    coordinators = [];

    // Restore environment
    delete process.env.COGNITION_HOME_DIR;

    // Clean up temp directory
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }

    // Wait for ZeroMQ to clean up
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('Project-Specific Isolation', () => {
    it('should isolate agents in different projects', async () => {
      // Create two separate project directories
      const projectA = path.join(tempDir, 'project-a');
      const projectB = path.join(tempDir, 'project-b');
      await fs.ensureDir(path.join(projectA, '.sigma'));
      await fs.ensureDir(path.join(projectB, '.sigma'));

      // Start bus for project A
      const coordA = new BusCoordinator(projectA);
      const busA = await coordA.connectWithFallback();
      coordinators.push(coordA);

      const monitorA = new MessageQueueMonitor(
        'agent-a',
        busA,
        ['agent.message'],
        path.join(projectA, '.sigma'),
        'test',
        projectA
      );
      await monitorA.start();
      monitors.push(monitorA);

      // Start bus for project B
      const coordB = new BusCoordinator(projectB);
      const busB = await coordB.connectWithFallback();
      coordinators.push(coordB);

      const monitorB = new MessageQueueMonitor(
        'agent-b',
        busB,
        ['agent.message'],
        path.join(projectB, '.sigma'),
        'test',
        projectB
      );
      await monitorB.start();
      monitors.push(monitorB);

      // Get actual agent IDs
      const agentAId = monitorA.getQueue().getAgentId();
      const agentBId = monitorB.getQueue().getAgentId();

      // Wait for monitors to stabilize
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Agent A should NOT see Agent B (different buses)
      const agentsSeenByA = getActiveAgents(projectA, agentAId);
      expect(agentsSeenByA).toHaveLength(0);

      // Agent B should NOT see Agent A (different buses)
      const agentsSeenByB = getActiveAgents(projectB, agentBId);
      expect(agentsSeenByB).toHaveLength(0);

      // Trying to resolve Agent B from Project A should fail
      const resolvedFromA = resolveAgentId(projectA, agentBId);
      expect(resolvedFromA).toBeNull();
    });

    it('should allow agents in same project to communicate', async () => {
      // Create single project directory
      const projectDir = path.join(tempDir, 'shared-project');
      await fs.ensureDir(path.join(projectDir, '.sigma'));

      // Create unique bus socket for this test
      const busSocket = `ipc://${path.join(os.tmpdir(), `cognition-test-${Date.now()}.sock`)}`;

      // Create master bus
      const bus1 = new ZeroMQBus({ address: busSocket });
      await bus1.bind();

      // Wait for master to stabilize
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Create peer bus
      const bus2 = new ZeroMQBus({ address: busSocket });
      await bus2.connect();

      // Wait for peer connection
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Start two agents in same project with separate bus instances
      const monitor1 = new MessageQueueMonitor(
        'agent-1',
        bus1,
        ['agent.message'],
        path.join(projectDir, '.sigma'),
        'test',
        projectDir
      );
      await monitor1.start();
      monitors.push(monitor1);

      const monitor2 = new MessageQueueMonitor(
        'agent-2',
        bus2,
        ['agent.message'],
        path.join(projectDir, '.sigma'),
        'test',
        projectDir
      );
      await monitor2.start();
      monitors.push(monitor2);

      // Manually close buses in cleanup
      coordinators.push({
        cleanup: async () => {
          await bus1?.close().catch(() => {});
          await bus2?.close().catch(() => {});
        },
      });

      const agent1Id = monitor1.getQueue().getAgentId();
      const agent2Id = monitor2.getQueue().getAgentId();

      // Wait for monitors to stabilize
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Agent 1 should see Agent 2
      const agentsSeenBy1 = getActiveAgents(projectDir, agent1Id);
      expect(agentsSeenBy1).toHaveLength(1);
      expect(agentsSeenBy1[0].agentId).toBe(agent2Id);

      // Agent 2 should see Agent 1
      const agentsSeenBy2 = getActiveAgents(projectDir, agent2Id);
      expect(agentsSeenBy2).toHaveLength(1);
      expect(agentsSeenBy2[0].agentId).toBe(agent1Id);

      // Send message from Agent 1 to Agent 2
      const publisher = new MessagePublisher(bus1, agent1Id);
      await publisher.sendMessage(agent2Id, 'Hello from Agent 1');

      // Wait for message delivery
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check Agent 2 received the message
      const messages2 = await monitor2.getQueue().getMessages('pending');
      expect(messages2).toHaveLength(1);
      expect(messages2[0].content).toEqual({
        type: 'text',
        message: 'Hello from Agent 1',
      });
      expect(messages2[0].from).toBe(agent1Id);
    });
  });

  describe('Global Mesh Communication', () => {
    it('should allow agents across projects to communicate on global bus', async () => {
      // Set global bus
      process.env.IPC_SIGMA_BUS = 'global';

      // Create two separate project directories
      const projectA = path.join(tempDir, 'project-a');
      const projectB = path.join(tempDir, 'project-b');
      await fs.ensureDir(projectA);
      await fs.ensureDir(projectB);

      // Create global sigma directory in tempDir (not ~/.cognition)
      const globalSigma = path.join(tempDir, 'sigma-global');
      await fs.ensureDir(globalSigma);

      // Start bus for project A (will become master)
      const coordA = new BusCoordinator(projectA);
      const busA = await coordA.connectWithFallback();
      coordinators.push(coordA);

      const monitorA = new MessageQueueMonitor(
        'agent-a',
        busA,
        ['agent.message'],
        globalSigma,
        'test',
        projectA
      );
      await monitorA.start();
      monitors.push(monitorA);

      // Wait for bus master to stabilize
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Start bus for project B (will connect as peer)
      const coordB = new BusCoordinator(projectB);
      const busB = await coordB.connectWithFallback();
      coordinators.push(coordB);

      const monitorB = new MessageQueueMonitor(
        'agent-b',
        busB,
        ['agent.message'],
        globalSigma,
        'test',
        projectB
      );
      await monitorB.start();
      monitors.push(monitorB);

      const agentAId = monitorA.getQueue().getAgentId();
      const agentBId = monitorB.getQueue().getAgentId();

      // Wait for monitors to stabilize and heartbeats to sync
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Agent A should see Agent B (same global bus)
      const agentsSeenByA = getActiveAgents(projectA, agentAId, globalSigma);
      expect(agentsSeenByA.length).toBeGreaterThanOrEqual(1);
      const agentBFromA = agentsSeenByA.find((a) => a.agentId === agentBId);
      expect(agentBFromA).toBeDefined();

      // Agent B should see Agent A (same global bus)
      const agentsSeenByB = getActiveAgents(projectB, agentBId, globalSigma);
      expect(agentsSeenByB.length).toBeGreaterThanOrEqual(1);
      const agentAFromB = agentsSeenByB.find((a) => a.agentId === agentAId);
      expect(agentAFromB).toBeDefined();

      // Send message from Agent A to Agent B
      const publisherA = new MessagePublisher(busA, agentAId);
      await publisherA.sendMessage(agentBId, 'Cross-project message');

      // Wait for message delivery
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check Agent B received the message
      const messagesB = await monitorB.getQueue().getMessages('pending');
      expect(messagesB.length).toBeGreaterThanOrEqual(1);
      const message = messagesB.find((m) => m.from === agentAId);
      expect(message).toBeDefined();
      expect(message?.content).toEqual({
        type: 'text',
        message: 'Cross-project message',
      });

      // Cleanup global sigma directory
      await fs.remove(globalSigma);
    });
  });

  describe('Named Mesh Isolation', () => {
    it('should isolate different named meshes', async () => {
      // Create two projects
      const projectA = path.join(tempDir, 'project-a');
      const projectB = path.join(tempDir, 'project-b');
      await fs.ensureDir(projectA);
      await fs.ensureDir(projectB);

      // Create sigma directories for two different meshes in tempDir
      const teamAlphaSigma = path.join(tempDir, 'sigma-team-alpha');
      const teamBetaSigma = path.join(tempDir, 'sigma-team-beta');
      await fs.ensureDir(teamAlphaSigma);
      await fs.ensureDir(teamBetaSigma);

      // Agent on team-alpha mesh
      process.env.IPC_SIGMA_BUS = 'team-alpha';
      const coordA = new BusCoordinator(projectA);
      const busA = await coordA.connectWithFallback();
      coordinators.push(coordA);

      const monitorA = new MessageQueueMonitor(
        'agent-alpha',
        busA,
        ['agent.message'],
        teamAlphaSigma,
        'test',
        projectA
      );
      await monitorA.start();
      monitors.push(monitorA);

      // Agent on team-beta mesh
      process.env.IPC_SIGMA_BUS = 'team-beta';
      const coordB = new BusCoordinator(projectB);
      const busB = await coordB.connectWithFallback();
      coordinators.push(coordB);

      const monitorB = new MessageQueueMonitor(
        'agent-beta',
        busB,
        ['agent.message'],
        teamBetaSigma,
        'test',
        projectB
      );
      await monitorB.start();
      monitors.push(monitorB);

      const agentAId = monitorA.getQueue().getAgentId();
      const agentBId = monitorB.getQueue().getAgentId();

      // Wait for monitors to stabilize
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Agent on team-alpha should NOT see agent on team-beta
      process.env.IPC_SIGMA_BUS = 'team-alpha'; // Restore env for agent A's perspective
      const agentsSeenByA = getActiveAgents(projectA, agentAId, teamAlphaSigma);
      expect(agentsSeenByA).toHaveLength(0);

      // Agent on team-beta should NOT see agent on team-alpha
      process.env.IPC_SIGMA_BUS = 'team-beta'; // Restore env for agent B's perspective
      const agentsSeenByB = getActiveAgents(projectB, agentBId, teamBetaSigma);
      expect(agentsSeenByB).toHaveLength(0);

      // Cleanup sigma directories
      await fs.remove(teamAlphaSigma);
      await fs.remove(teamBetaSigma);
    });
  });

  describe('Agent Discovery Isolation', () => {
    it('should only discover agents on same bus', async () => {
      // Create three projects
      const project1 = path.join(tempDir, 'project-1');
      const project2 = path.join(tempDir, 'project-2');
      const project3 = path.join(tempDir, 'project-3');
      await fs.ensureDir(path.join(project1, '.sigma'));
      await fs.ensureDir(path.join(project2, '.sigma'));

      // Create global sigma directory in tempDir
      const globalSigma = path.join(tempDir, 'sigma-global');
      await fs.ensureDir(globalSigma);

      // Agent 1: Project-specific bus
      delete process.env.IPC_SIGMA_BUS;
      const coord1 = new BusCoordinator(project1);
      const bus1 = await coord1.connectWithFallback();
      coordinators.push(coord1);

      const monitor1 = new MessageQueueMonitor(
        'agent-1',
        bus1,
        ['agent.message'],
        path.join(project1, '.sigma'),
        'test',
        project1
      );
      await monitor1.start();
      monitors.push(monitor1);

      // Agent 2: Different project-specific bus
      const coord2 = new BusCoordinator(project2);
      const bus2 = await coord2.connectWithFallback();
      coordinators.push(coord2);

      const monitor2 = new MessageQueueMonitor(
        'agent-2',
        bus2,
        ['agent.message'],
        path.join(project2, '.sigma'),
        'test',
        project2
      );
      await monitor2.start();
      monitors.push(monitor2);

      // Agent 3: Global bus
      process.env.IPC_SIGMA_BUS = 'global';
      const coord3 = new BusCoordinator(project3);
      const bus3 = await coord3.connectWithFallback();
      coordinators.push(coord3);

      const monitor3 = new MessageQueueMonitor(
        'agent-3',
        bus3,
        ['agent.message'],
        globalSigma,
        'test',
        project3
      );
      await monitor3.start();
      monitors.push(monitor3);

      const agent1Id = monitor1.getQueue().getAgentId();
      const agent2Id = monitor2.getQueue().getAgentId();
      const agent3Id = monitor3.getQueue().getAgentId();

      // Wait for stabilization
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Agent 1 should only see itself (isolated project)
      delete process.env.IPC_SIGMA_BUS; // Agent 1 is on project-specific bus
      const agentsSeenBy1 = getActiveAgents(project1, agent1Id);
      expect(agentsSeenBy1).toHaveLength(0);

      // Agent 2 should only see itself (isolated project)
      // (IPC_SIGMA_BUS already unset, project2 has its own bus)
      const agentsSeenBy2 = getActiveAgents(project2, agent2Id);
      expect(agentsSeenBy2).toHaveLength(0);

      // Agent 3 should only see itself (on global bus alone)
      process.env.IPC_SIGMA_BUS = 'global'; // Agent 3 is on global bus
      const agentsSeenBy3 = getActiveAgents(project3, agent3Id, globalSigma);
      expect(agentsSeenBy3).toHaveLength(0);

      // Cleanup
      await fs.remove(globalSigma);
    });
  });
});
