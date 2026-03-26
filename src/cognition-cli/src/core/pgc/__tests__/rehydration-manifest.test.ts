import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  RehydrationManifest,
  RehydrationManifestData,
} from '../rehydration-manifest.js';

describe('RehydrationManifest', () => {
  let tempDir: string;
  let manifest: RehydrationManifest;

  const sampleData: RehydrationManifestData = {
    last_rehydrated_commit: 'abc123def456abc123def456abc123def456abc1',
    total_commits_processed: 10,
    total_transforms_recorded: 25,
    rehydrated_at: '2025-01-01T00:00:00.000Z',
    branch: 'main',
    depth: null,
    since: null,
  };

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      `rehydration-manifest-test-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(tempDir);
    manifest = new RehydrationManifest(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should return null when no manifest exists', async () => {
    const result = await manifest.read();
    expect(result).toBeNull();
  });

  it('should round-trip write and read correctly', async () => {
    await manifest.write(sampleData);
    const result = await manifest.read();
    expect(result).toBeDefined();
    expect(result?.last_rehydrated_commit).toBe(
      sampleData.last_rehydrated_commit
    );
    expect(result?.total_commits_processed).toBe(
      sampleData.total_commits_processed
    );
    expect(result?.total_transforms_recorded).toBe(
      sampleData.total_transforms_recorded
    );
    expect(result?.rehydrated_at).toBe(sampleData.rehydrated_at);
    expect(result?.branch).toBe(sampleData.branch);
    expect(result?.depth).toBeNull();
    expect(result?.since).toBeNull();
  });

  it('should create parent directory if missing', async () => {
    // Use a deeply nested path that does not exist yet
    const nestedManifest = new RehydrationManifest(
      path.join(tempDir, 'nested', 'deep')
    );
    await expect(nestedManifest.write(sampleData)).resolves.not.toThrow();
    const result = await nestedManifest.read();
    expect(result?.branch).toBe('main');
  });

  it('should return null gracefully on corrupt JSON', async () => {
    const manifestPath = path.join(tempDir, 'rehydration', 'manifest.json');
    await fs.ensureDir(path.dirname(manifestPath));
    await fs.writeFile(manifestPath, '{ invalid json <<<', 'utf-8');
    const result = await manifest.read();
    expect(result).toBeNull();
  });
});
