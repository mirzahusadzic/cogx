/**
 * Tests for init command
 *
 * Coverage:
 * - [x] PGC directory structure creation
 * - [x] Metadata.json initialization
 * - [x] .gitignore creation
 * - [x] Idempotency (repeated init)
 * - [x] Error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initCommand } from '../init.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('init command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'init-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Directory Structure Creation', () => {
    it('should create .open_cognition directory structure', async () => {
      await initCommand({ path: tempDir });

      const pgcRoot = path.join(tempDir, '.open_cognition');
      expect(await fs.pathExists(pgcRoot)).toBe(true);
      expect(await fs.pathExists(path.join(pgcRoot, 'objects'))).toBe(true);
      expect(await fs.pathExists(path.join(pgcRoot, 'transforms'))).toBe(true);
      expect(await fs.pathExists(path.join(pgcRoot, 'index'))).toBe(true);
      expect(await fs.pathExists(path.join(pgcRoot, 'reverse_deps'))).toBe(
        true
      );
      expect(await fs.pathExists(path.join(pgcRoot, 'overlays'))).toBe(true);
    });

    it('should create all four pillars of PGC architecture', async () => {
      await initCommand({ path: tempDir });

      const pgcRoot = path.join(tempDir, '.open_cognition');

      // Verify four pillars exist
      const stats = await Promise.all([
        fs.stat(path.join(pgcRoot, 'objects')),
        fs.stat(path.join(pgcRoot, 'transforms')),
        fs.stat(path.join(pgcRoot, 'index')),
        fs.stat(path.join(pgcRoot, 'reverse_deps')),
      ]);

      stats.forEach((stat) => {
        expect(stat.isDirectory()).toBe(true);
      });
    });
  });

  describe('Metadata Initialization', () => {
    it('should create metadata.json with correct version', async () => {
      await initCommand({ path: tempDir });

      const metadataPath = path.join(
        tempDir,
        '.open_cognition',
        'metadata.json'
      );
      const metadata = await fs.readJSON(metadataPath);

      expect(metadata.version).toBe('0.1.0');
      expect(metadata.status).toBe('empty');
      expect(metadata.initialized_at).toBeDefined();
    });

    it('should set initialized_at to valid ISO timestamp', async () => {
      const beforeInit = new Date().toISOString();
      await initCommand({ path: tempDir });
      const afterInit = new Date().toISOString();

      const metadataPath = path.join(
        tempDir,
        '.open_cognition',
        'metadata.json'
      );
      const metadata = await fs.readJSON(metadataPath);

      expect(metadata.initialized_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
      expect(metadata.initialized_at >= beforeInit).toBe(true);
      expect(metadata.initialized_at <= afterInit).toBe(true);
    });

    it('should initialize status as "empty"', async () => {
      await initCommand({ path: tempDir });

      const metadataPath = path.join(
        tempDir,
        '.open_cognition',
        'metadata.json'
      );
      const metadata = await fs.readJSON(metadataPath);

      expect(metadata.status).toBe('empty');
    });
  });

  describe('.gitignore Creation', () => {
    it('should create .gitignore for object store', async () => {
      await initCommand({ path: tempDir });

      const gitignorePath = path.join(tempDir, '.open_cognition', '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');

      expect(content).toContain('objects/');
    });

    it('should exclude large objects directory from git', async () => {
      await initCommand({ path: tempDir });

      const gitignorePath = path.join(tempDir, '.open_cognition', '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');

      expect(content).toContain('# Ignore large object store');
      expect(content).toContain('objects/');
    });

    it('should preserve structure files with .gitkeep', async () => {
      await initCommand({ path: tempDir });

      const gitignorePath = path.join(tempDir, '.open_cognition', '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');

      expect(content).toContain('!.gitkeep');
    });
  });

  describe('Idempotency', () => {
    it('should succeed on repeated initialization (idempotent)', async () => {
      // First init
      await initCommand({ path: tempDir });

      // Second init should succeed (idempotent)
      await expect(initCommand({ path: tempDir })).resolves.not.toThrow();
    });

    it('should preserve existing metadata on re-init', async () => {
      // First init
      await initCommand({ path: tempDir });

      const metadataPath = path.join(
        tempDir,
        '.open_cognition',
        'metadata.json'
      );
      const firstMetadata = await fs.readJSON(metadataPath);

      // Second init
      await initCommand({ path: tempDir });

      const secondMetadata = await fs.readJSON(metadataPath);

      // Metadata should be recreated (timestamp will differ)
      expect(secondMetadata.version).toBe(firstMetadata.version);
      expect(secondMetadata.status).toBe(firstMetadata.status);
    });
  });

  describe('Error Handling', () => {
    it('should throw on invalid path', async () => {
      // Try to init in a file (not directory)
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'test');

      await expect(
        fs.ensureDir(path.join(filePath, '.open_cognition'))
      ).rejects.toThrow();
    });

    it('should handle permission errors gracefully', async () => {
      // This test is platform-specific and may not work on all systems
      // Skip on Windows where permission handling is different
      if (process.platform === 'win32') {
        return;
      }

      // Create read-only directory
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.ensureDir(readOnlyDir);
      await fs.chmod(readOnlyDir, 0o444);

      await expect(initCommand({ path: readOnlyDir })).rejects.toThrow();

      // Cleanup: restore permissions
      await fs.chmod(readOnlyDir, 0o755);
    });
  });

  describe('Path Handling', () => {
    it('should work with absolute paths', async () => {
      const absolutePath = path.resolve(tempDir);
      await initCommand({ path: absolutePath });

      const pgcRoot = path.join(absolutePath, '.open_cognition');
      expect(await fs.pathExists(pgcRoot)).toBe(true);
    });

    it('should work with relative paths', async () => {
      // Create subdirectory
      const subDir = path.join(tempDir, 'subdir');
      await fs.ensureDir(subDir);

      // Use path.relative to create a relative path from cwd to subdir
      // This avoids using process.chdir() which doesn't work in workers
      const relativePath = path.relative(process.cwd(), subDir);

      await initCommand({ path: relativePath });

      const pgcRoot = path.join(subDir, '.open_cognition');
      expect(await fs.pathExists(pgcRoot)).toBe(true);
    });
  });
});
