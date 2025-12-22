import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { MessageQueueMonitor } from '../MessageQueueMonitor';
import { ZeroMQBus } from '../ZeroMQBus';

// Mock ZeroMQBus
vi.mock('../ZeroMQBus');

describe('MessageQueueMonitor Cleanup', () => {
  let tempDir: string;
  let mockBus: ZeroMQBus;
  const agentId = 'test-agent';
  const topics = ['test.topic'];

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      `msgqueue-cleanup-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(tempDir);

    mockBus = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
    } as unknown as ZeroMQBus;
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should clean up stale disconnected agents (> 1 hour)', async () => {
    const queueDir = path.join(tempDir, 'message_queue');
    await fs.ensureDir(queueDir);

    const staleAgentId = 'stale-agent-123';
    const staleAgentDir = path.join(queueDir, staleAgentId);
    await fs.ensureDir(staleAgentDir);

    const now = Date.now();
    const oneHourAndAMinuteAgo = now - (3600000 + 60000);

    const agentInfo = {
      agentId: staleAgentId,
      alias: 'stale-alias',
      status: 'disconnected',
      lastHeartbeat: oneHourAndAMinuteAgo,
      topics: [],
    };

    await fs.writeJson(path.join(staleAgentDir, 'agent-info.json'), agentInfo);

    // Also create a fresh disconnected agent that should NOT be cleaned up
    const freshAgentId = 'fresh-agent-456';
    const freshAgentDir = path.join(queueDir, freshAgentId);
    await fs.ensureDir(freshAgentDir);

    const tenMinutesAgo = now - 600000;
    const freshAgentInfo = {
      agentId: freshAgentId,
      alias: 'fresh-alias',
      status: 'disconnected',
      lastHeartbeat: tenMinutesAgo,
      topics: [],
    };
    await fs.writeJson(
      path.join(freshAgentDir, 'agent-info.json'),
      freshAgentInfo
    );

    const monitor = new MessageQueueMonitor(agentId, mockBus, topics, tempDir);
    await monitor.start();
    await monitor.stop();

    expect(fs.existsSync(staleAgentDir)).toBe(false);
    expect(fs.existsSync(freshAgentDir)).toBe(true);
  });

  it('should clean up crashed active agents (> 24 hours)', async () => {
    const queueDir = path.join(tempDir, 'message_queue');
    await fs.ensureDir(queueDir);

    const crashedAgentId = 'crashed-agent-789';
    const crashedAgentDir = path.join(queueDir, crashedAgentId);
    await fs.ensureDir(crashedAgentDir);

    const now = Date.now();
    const twentyFiveHoursAgo = now - (86400000 + 3600000);

    const agentInfo = {
      agentId: crashedAgentId,
      alias: 'crashed-alias',
      status: 'active', // Marked active but old heartbeat
      lastHeartbeat: twentyFiveHoursAgo,
      topics: [],
    };

    await fs.writeJson(
      path.join(crashedAgentDir, 'agent-info.json'),
      agentInfo
    );

    const monitor = new MessageQueueMonitor(agentId, mockBus, topics, tempDir);
    await monitor.start();
    await monitor.stop();

    expect(fs.existsSync(crashedAgentDir)).toBe(false);
  });
});
