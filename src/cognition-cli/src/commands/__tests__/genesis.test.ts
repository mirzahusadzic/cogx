import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { genesisCommand } from '../genesis.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { WorkbenchClient } from '../../core/executors/workbench-client.js';

// Mocking external dependencies
vi.mock('../../core/pgc/manager.js');
vi.mock('../../core/executors/workbench-client.js');
vi.mock('../../core/orchestrators/miners/structural.js');
vi.mock('../../core/orchestrators/genesis.js');
vi.mock('../../core/pgc/oracles/genesis.js');
vi.mock('../../core/overlays/lineage/manager.js');
vi.mock('../../core/overlays/vector-db/lance-store.js');
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('genesis command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genesis-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
    vi.clearAllMocks();
  });

  it('should throw if PGC is not initialized', async () => {
    await expect(
      genesisCommand({
        sources: ['src'],
        workbench: 'http://localhost:8000',
        projectRoot: tempDir,
      })
    ).rejects.toThrow(/PGC not initialized/);
  });

  it('should throw if metadata.json is missing', async () => {
    const pgcRoot = path.join(tempDir, '.open_cognition');
    await fs.ensureDir(pgcRoot);

    await expect(
      genesisCommand({
        sources: ['src'],
        workbench: 'http://localhost:8000',
        projectRoot: tempDir,
      })
    ).rejects.toThrow(/metadata.json not found/);
  });

  it('should exit if workbench is not reachable', async () => {
    // Setup PGC
    const pgcRoot = path.join(tempDir, '.open_cognition');
    await fs.ensureDir(pgcRoot);
    await fs.writeJSON(path.join(pgcRoot, 'metadata.json'), {
      version: '0.1.0',
    });

    // Mock workbench health to fail
    const mockHealth = vi
      .fn()
      .mockRejectedValue(new Error('Connection refused'));
    vi.mocked(WorkbenchClient).prototype.health = mockHealth;

    // We expect it to return early after logging error
    await genesisCommand({
      sources: ['src'],
      workbench: 'http://localhost:8000',
      projectRoot: tempDir,
    });

    expect(mockHealth).toHaveBeenCalled();
  });

  it('should execute dry-run without connecting to workbench', async () => {
    const pgcRoot = path.join(tempDir, '.open_cognition');
    await fs.ensureDir(pgcRoot);
    await fs.writeJSON(path.join(pgcRoot, 'metadata.json'), {
      version: '0.1.0',
    });

    const mockHealth = vi.fn();
    vi.mocked(WorkbenchClient).prototype.health = mockHealth;

    await genesisCommand({
      sources: ['src'],
      workbench: 'http://localhost:8000',
      projectRoot: tempDir,
      dryRun: true,
    });

    // Health should NOT be called in dry run (actually looking at the code it returns early before health check)
    expect(mockHealth).not.toHaveBeenCalled();
  });
});
