import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageBus } from '../MessageBus.js';
import * as path from 'path';
import * as os from 'os';
import fs from 'fs-extra';

describe('MessageBus', () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    originalHome = process.env.COGNITION_HOME_DIR;
    tempDir = path.join(
      os.tmpdir(),
      `mbt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    );
    await fs.ensureDir(path.join(tempDir, '.cognition'));
    process.env.COGNITION_HOME_DIR = tempDir;
  });

  afterEach(async () => {
    if (originalHome) {
      process.env.COGNITION_HOME_DIR = originalHome;
    } else {
      delete process.env.COGNITION_HOME_DIR;
    }

    if (tempDir && (await fs.pathExists(tempDir))) {
      await fs.remove(tempDir);
    }
  });

  it('should connect and disconnect successfully', async () => {
    const bus = new MessageBus({
      agentId: 'test-agent',
      model: 'test-model',
      debug: false,
    });

    await bus.connect();
    expect(bus.isConnected()).toBe(true);
    expect(bus.isMaster()).toBe(true);
    expect(bus.getUnderlyingBus()).not.toBeNull();
    expect(bus.getRegistry()).not.toBeNull();

    await bus.disconnect();
    expect(bus.isConnected()).toBe(false);
    expect(bus.getUnderlyingBus()).toBeNull();
    expect(bus.getRegistry()).toBeNull();
  });

  it('should allow publishing and subscribing', async () => {
    const bus = new MessageBus({
      agentId: 'test-agent',
      model: 'test-model',
    });

    await bus.connect();

    let receivedPayload: unknown = null;
    bus.subscribe('test.topic', (msg) => {
      receivedPayload = msg.payload;
    });

    // We need a small delay for ZMQ to settle (especially for subscriptions)
    await new Promise((r) => setTimeout(r, 200));

    await bus.broadcast('test.topic', { greeting: 'hello' });

    // Wait for message to arrive
    for (let i = 0; i < 10; i++) {
      if (receivedPayload) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(receivedPayload).toEqual({ greeting: 'hello' });

    await bus.disconnect();
  });

  it('should support multiple instances (master and peer)', async () => {
    const masterBus = new MessageBus({
      agentId: 'master-agent',
      model: 'master-model',
    });

    const peerBus = new MessageBus({
      agentId: 'peer-agent',
      model: 'peer-model',
    });

    await masterBus.connect();
    await peerBus.connect();

    expect(masterBus.isMaster()).toBe(true);
    expect(peerBus.isMaster()).toBe(false);

    let masterReceived = false;
    let peerReceived = false;

    masterBus.subscribe('chat', () => {
      masterReceived = true;
    });
    peerBus.subscribe('chat', () => {
      peerReceived = true;
    });

    // Wait for ZMQ
    await new Promise((r) => setTimeout(r, 200));

    await peerBus.broadcast('chat', 'hello from peer');

    // Wait for message to arrive
    for (let i = 0; i < 20; i++) {
      if (masterReceived && peerReceived) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(masterReceived).toBe(true);
    expect(peerReceived).toBe(true);

    await peerBus.disconnect();
    await masterBus.disconnect();
  });
});
