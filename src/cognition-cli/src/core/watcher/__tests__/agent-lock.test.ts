import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { AgentLockManager } from '../agent-lock.js';

describe('AgentLockManager', () => {
  let tempDir: string;
  let manager: AgentLockManager;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `agent-lock-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    manager = new AgentLockManager(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('isLocked() returns false when no lock file exists', async () => {
    expect(await manager.isLocked()).toBe(false);
  });

  it('acquire() creates lock file with correct fields', async () => {
    await manager.acquire('claude-code', 60, 'session-1');
    const state = await manager.readState();

    expect(state).not.toBeNull();
    expect(state!.source).toBe('claude-code');
    expect(state!.timeout_seconds).toBe(60);
    expect(state!.session_id).toBe('session-1');
    expect(state!.acquired_at).toBeTruthy();
    expect(state!.expires_at).toBeTruthy();

    const acquiredMs = Date.parse(state!.acquired_at);
    const expiresMs = Date.parse(state!.expires_at);
    expect(expiresMs - acquiredMs).toBe(60 * 1000);
  });

  it('isLocked() returns true after acquire', async () => {
    await manager.acquire('tui', 30);
    expect(await manager.isLocked()).toBe(true);
  });

  it('release() removes lock file', async () => {
    await manager.acquire('tui', 30);
    await manager.release();
    const lockPath = path.join(tempDir, '.agent_lock');
    expect(await fs.pathExists(lockPath)).toBe(false);
  });

  it('isLocked() returns false after release', async () => {
    await manager.acquire('tui', 30);
    await manager.release();
    expect(await manager.isLocked()).toBe(false);
  });

  it('acquire() throws when lock is active and not expired', async () => {
    await manager.acquire('claude-code', 60);
    await expect(manager.acquire('other-agent', 30)).rejects.toThrow(
      'Lock already held by: claude-code'
    );
  });

  it('isLocked() returns false and deletes file when lock is expired', async () => {
    const expiredState = {
      acquired_at: new Date(Date.now() - 120_000).toISOString(),
      source: 'old-agent',
      timeout_seconds: 30,
      expires_at: new Date(Date.now() - 90_000).toISOString(),
    };
    const lockPath = path.join(tempDir, '.agent_lock');
    await fs.outputJson(lockPath, expiredState);

    expect(await manager.isLocked()).toBe(false);
    expect(await fs.pathExists(lockPath)).toBe(false);
  });

  it('acquire() succeeds (overwrites) when previous lock is expired', async () => {
    const expiredState = {
      acquired_at: new Date(Date.now() - 120_000).toISOString(),
      source: 'old-agent',
      timeout_seconds: 30,
      expires_at: new Date(Date.now() - 90_000).toISOString(),
    };
    const lockPath = path.join(tempDir, '.agent_lock');
    await fs.outputJson(lockPath, expiredState);

    await manager.acquire('new-agent', 30);
    const state = await manager.readState();
    expect(state).not.toBeNull();
    expect(state!.source).toBe('new-agent');
  });

  it('release() is a no-op when no lock exists (no throw)', async () => {
    await expect(manager.release()).resolves.not.toThrow();
  });

  it('readState() returns null when no lock file', async () => {
    const state = await manager.readState();
    expect(state).toBeNull();
  });
});
