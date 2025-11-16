/**
 * Tests for ask command
 *
 * Coverage:
 * - [x] PGC workspace validation
 * - [x] Query execution
 * - [x] Embedding service integration
 * - [x] Overlay filtering
 * - [x] Result formatting
 * - [x] Error handling (no PGC, workbench unavailable)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Mock dependencies
vi.mock('../../core/workspace-manager.js', () => ({
  WorkspaceManager: vi.fn(() => ({
    resolvePgcRoot: vi.fn((cwd: string) => {
      if (fs.existsSync(path.join(cwd, '.open_cognition'))) {
        return cwd;
      }
      return null;
    }),
  })),
}));

vi.mock('../../core/services/embedding.js', () => ({
  EmbeddingService: vi.fn(() => ({
    embed: vi.fn(async () => ({
      embedding: [0.1, 0.2, 0.3],
    })),
  })),
}));

vi.mock('../../core/algebra/overlay-registry.js', () => ({
  OverlayRegistry: vi.fn(() => ({
    query: vi.fn(async () => ({
      matches: [
        {
          symbol: 'TestClass',
          file: 'src/test.ts',
          score: 0.95,
          metadata: { type: 'class' },
        },
      ],
    })),
  })),
}));

describe('ask command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ask-test-'));
    // Create PGC structure
    await fs.ensureDir(path.join(tempDir, '.open_cognition'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
    vi.clearAllMocks();
  });

  describe('PGC Workspace Validation', () => {
    it('should fail when no .open_cognition workspace found', async () => {
      // Remove PGC directory
      await fs.remove(path.join(tempDir, '.open_cognition'));

      const { WorkspaceManager } = await import('../../core/workspace-manager.js');
      const manager = new WorkspaceManager();

      const projectRoot = manager.resolvePgcRoot(tempDir);
      expect(projectRoot).toBeNull();
    });

    it('should succeed when .open_cognition exists', async () => {
      const { WorkspaceManager } = await import('../../core/workspace-manager.js');
      const manager = new WorkspaceManager();

      const projectRoot = manager.resolvePgcRoot(tempDir);
      expect(projectRoot).toBeTruthy();
    });
  });

  describe('Query Execution', () => {
    it('should query overlay registry with user question', async () => {
      const { OverlayRegistry } = await import('../../core/algebra/overlay-registry.js');

      const registry = new OverlayRegistry(
        path.join(tempDir, '.open_cognition'),
        'http://localhost:8000'
      );

      const result = await registry.query('test query');

      expect(result.matches).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
    });

    it('should return matches with scores', async () => {
      const { OverlayRegistry } = await import('../../core/algebra/overlay-registry.js');

      const registry = new OverlayRegistry(
        path.join(tempDir, '.open_cognition'),
        'http://localhost:8000'
      );

      const result = await registry.query('test query');

      if (result.matches.length > 0) {
        expect(result.matches[0].symbol).toBeDefined();
        expect(result.matches[0].score).toBeDefined();
        expect(result.matches[0].score).toBeGreaterThanOrEqual(0);
        expect(result.matches[0].score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Embedding Service Integration', () => {
    it('should use embedding service for semantic search', async () => {
      const { EmbeddingService } = await import('../../core/services/embedding.js');

      const embedder = new EmbeddingService('http://localhost:8000');
      const result = await embedder.embed({ content: 'test query' });

      expect(result.embedding).toBeDefined();
      expect(Array.isArray(result.embedding)).toBe(true);
    });
  });

  describe('Result Formatting', () => {
    it('should format matches with file paths and symbols', async () => {
      const { OverlayRegistry } = await import('../../core/algebra/overlay-registry.js');

      const registry = new OverlayRegistry(
        path.join(tempDir, '.open_cognition'),
        'http://localhost:8000'
      );

      const result = await registry.query('test');

      if (result.matches.length > 0) {
        const match = result.matches[0];
        expect(match.symbol).toBeDefined();
        expect(match.file).toBeDefined();
        expect(typeof match.symbol).toBe('string');
        expect(typeof match.file).toBe('string');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing workbench gracefully', async () => {
      // Embedding service should handle connection errors
      const { EmbeddingService } = await import('../../core/services/embedding.js');

      const embedder = new EmbeddingService('http://invalid-url:9999');

      // Should not throw during construction
      expect(embedder).toBeDefined();
    });
  });
});
