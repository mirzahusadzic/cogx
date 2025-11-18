/**
 * LanceDB Vector Store Tests
 *
 * Tests vector storage operations with emphasis on SQL injection prevention
 * and special character handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LanceVectorStore } from '../lance-store.js';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../../../config.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('LanceVectorStore', () => {
  let store: LanceVectorStore;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for test database
    tempDir = path.join(os.tmpdir(), `lance-test-${Date.now()}`);
    await fs.ensureDir(tempDir);

    store = new LanceVectorStore(tempDir);
    await store.initialize('test_vectors');
  });

  afterEach(async () => {
    // CRITICAL: Close LanceDB connection before cleanup to prevent heap corruption
    if (store) {
      await store.close();
      // Wait for native async cleanup to complete (LanceDB native bindings)
      // Without this delay, native resources aren't fully released before next test
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // Cleanup temp directory
    await fs.remove(tempDir);
  });

  describe('basic operations', () => {
    it('should store and retrieve a vector', async () => {
      const id = 'test-vector-1';
      const embedding = Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.5);
      const metadata = {
        symbol: 'TestSymbol',
        architectural_role: 'function',
        computed_at: new Date().toISOString(),
        lineage_hash: 'abc123',
        document_hash: 'test-doc-hash-1',
      };

      await store.storeVector(id, embedding, metadata);
      const retrieved = await store.getVector(id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(id);
      expect(retrieved!.symbol).toBe('TestSymbol');
      expect(retrieved!.embedding).toHaveLength(DEFAULT_EMBEDDING_DIMENSIONS);
    });

    it('should update existing vector with same ID', async () => {
      const id = 'test-vector-update';
      const embedding = Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.5);
      const metadata1 = {
        symbol: 'Original',
        architectural_role: 'function',
        computed_at: new Date().toISOString(),
        lineage_hash: 'hash1',
        document_hash: 'test-doc-hash-2',
      };
      const metadata2 = {
        symbol: 'Updated',
        architectural_role: 'class',
        computed_at: new Date().toISOString(),
        lineage_hash: 'hash2',
        document_hash: 'test-doc-hash-2',
      };

      await store.storeVector(id, embedding, metadata1);
      await store.storeVector(id, embedding, metadata2);

      const retrieved = await store.getVector(id);
      expect(retrieved!.symbol).toBe('Updated');
      expect(retrieved!.architectural_role).toBe('class');
    });

    it('should delete a vector', async () => {
      const id = 'test-vector-delete';
      const embedding = Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.5);
      const metadata = {
        symbol: 'ToDelete',
        architectural_role: 'function',
        computed_at: new Date().toISOString(),
        lineage_hash: 'abc123',
        document_hash: 'test-doc-hash-3',
      };

      await store.storeVector(id, embedding, metadata);
      const beforeDelete = await store.getVector(id);
      expect(beforeDelete).toBeDefined();

      await store.deleteVector(id);
      const afterDelete = await store.getVector(id);
      expect(afterDelete).toBeUndefined();
    });

    it('should perform similarity search', async () => {
      // Create more distinct embeddings using different patterns
      const embedding1 = Array(DEFAULT_EMBEDDING_DIMENSIONS)
        .fill(0)
        .map((_, i) => Math.sin(i / 10));
      const embedding2 = Array(DEFAULT_EMBEDDING_DIMENSIONS)
        .fill(0)
        .map((_, i) => Math.sin(i / 10) + 0.01); // Very similar
      const embedding3 = Array(DEFAULT_EMBEDDING_DIMENSIONS)
        .fill(0)
        .map((_, i) => Math.cos(i / 5)); // Different pattern

      await store.storeVector('vec1', embedding1, {
        symbol: 'Symbol1',
        architectural_role: 'function',
        computed_at: new Date().toISOString(),
        lineage_hash: 'hash1',
        document_hash: 'test-doc-hash-4',
      });

      await store.storeVector('vec2', embedding2, {
        symbol: 'Symbol2',
        architectural_role: 'function',
        computed_at: new Date().toISOString(),
        lineage_hash: 'hash2',
        document_hash: 'test-doc-hash-5',
      });

      await store.storeVector('vec3', embedding3, {
        symbol: 'Symbol3',
        architectural_role: 'function',
        computed_at: new Date().toISOString(),
        lineage_hash: 'hash3',
        document_hash: 'test-doc-hash-6',
      });

      const queryEmbedding = Array(DEFAULT_EMBEDDING_DIMENSIONS)
        .fill(0)
        .map((_, i) => Math.sin(i / 10));
      const results = await store.similaritySearch(queryEmbedding, 3);

      expect(results).toHaveLength(3);
      // Should return all 3, but vec1 and vec2 should be most similar to query
      const ids = results.map((r) => r.id);
      expect(ids).toContain('vec1');
      expect(ids).toContain('vec2');
      expect(ids).toContain('vec3');

      // vec1 should be the most similar (exact match with query)
      expect(results[0].id).toBe('vec1');
    });
  });

  describe('SQL injection prevention (CRITICAL)', () => {
    it('should handle IDs with single quotes', async () => {
      const dangerousId = "item'; DROP TABLE overlays; --";
      const embedding = Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.5);
      const metadata = {
        symbol: 'Test',
        architectural_role: 'function',
        computed_at: new Date().toISOString(),
        lineage_hash: 'abc123',
        document_hash: 'test-doc-hash-sql-1',
      };

      // Should not throw or break the database
      await expect(
        store.storeVector(dangerousId, embedding, metadata)
      ).resolves.toBeDefined();

      // Should be able to retrieve it
      const retrieved = await store.getVector(dangerousId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(dangerousId);

      // Should be able to delete it
      await expect(store.deleteVector(dangerousId)).resolves.toBe(true);
    });

    it('should handle IDs with double quotes', async () => {
      const dangerousId = 'item" OR 1=1 --';
      const embedding = Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.5);
      const metadata = {
        symbol: 'Test',
        architectural_role: 'function',
        computed_at: new Date().toISOString(),
        lineage_hash: 'abc123',
        document_hash: 'test-doc-hash-sql-2',
      };

      await expect(
        store.storeVector(dangerousId, embedding, metadata)
      ).resolves.toBeDefined();
      const retrieved = await store.getVector(dangerousId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(dangerousId);
    });

    it('should handle IDs with SQL keywords', async () => {
      const dangerousIds = [
        'SELECT * FROM vectors',
        'DROP TABLE vectors',
        'DELETE FROM vectors WHERE 1=1',
        'UPDATE vectors SET id=null',
        'INSERT INTO vectors VALUES (1,2,3)',
      ];

      for (const id of dangerousIds) {
        const embedding = Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.5);
        const metadata = {
          symbol: 'Test',
          architectural_role: 'function',
          computed_at: new Date().toISOString(),
          lineage_hash: 'abc123',
          document_hash: 'test-doc-hash-sql-3',
        };

        await expect(
          store.storeVector(id, embedding, metadata)
        ).resolves.toBeDefined();
        const retrieved = await store.getVector(id);
        expect(retrieved).toBeDefined();
        expect(retrieved!.id).toBe(id);
      }
    });

    it('should handle IDs with special characters from CVE format', async () => {
      // This is the actual bug we found!
      const cveId = "CVE-2024-12345: _vector','";
      const embedding = Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.5);
      const metadata = {
        symbol: 'CVE Test',
        architectural_role: 'security',
        computed_at: new Date().toISOString(),
        lineage_hash: 'abc123',
        document_hash: 'test-doc-hash-cve',
      };

      await expect(
        store.storeVector(cveId, embedding, metadata)
      ).resolves.toBeDefined();
      const retrieved = await store.getVector(cveId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(cveId);
    });

    it('should handle IDs with newlines and special whitespace', async () => {
      const dangerousIds = [
        'item\nwith\nnewlines',
        'item\twith\ttabs',
        'item\rwith\rcarriage',
        'item with   spaces',
      ];

      for (const id of dangerousIds) {
        const embedding = Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.5);
        const metadata = {
          symbol: 'Test',
          architectural_role: 'function',
          computed_at: new Date().toISOString(),
          lineage_hash: 'abc123',
          document_hash: 'test-doc-hash-whitespace',
        };

        await expect(
          store.storeVector(id, embedding, metadata)
        ).resolves.toBeDefined();
        const retrieved = await store.getVector(id);
        expect(retrieved).toBeDefined();
        expect(retrieved!.id).toBe(id);
      }
    });

    it('should handle IDs with backslashes (escape character)', async () => {
      const dangerousId = 'item\\\'with\\"escapes';
      const embedding = Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.5);
      const metadata = {
        symbol: 'Test',
        architectural_role: 'function',
        computed_at: new Date().toISOString(),
        lineage_hash: 'abc123',
        document_hash: 'test-doc-hash-backslash',
      };

      await expect(
        store.storeVector(dangerousId, embedding, metadata)
      ).resolves.toBeDefined();
      const retrieved = await store.getVector(dangerousId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(dangerousId);
    });

    it('should handle IDs with Unicode characters', async () => {
      const unicodeIds = [
        'item-with-emoji-🚀',
        'item-with-中文',
        'item-with-العربية',
        'item-with-Русский',
      ];

      for (const id of unicodeIds) {
        const embedding = Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.5);
        const metadata = {
          symbol: 'Test',
          architectural_role: 'function',
          computed_at: new Date().toISOString(),
          lineage_hash: 'abc123',
          document_hash: 'test-doc-hash-unicode',
        };

        await expect(
          store.storeVector(id, embedding, metadata)
        ).resolves.toBeDefined();
        const retrieved = await store.getVector(id);
        expect(retrieved).toBeDefined();
        expect(retrieved!.id).toBe(id);
      }
    });
  });

  describe('error handling', () => {
    it('should reject embedding with wrong dimensions', async () => {
      const id = 'wrong-dimensions';
      const wrongEmbedding = Array(128).fill(0.5); // Should be 1536
      const metadata = {
        symbol: 'Test',
        architectural_role: 'function',
        computed_at: new Date().toISOString(),
        lineage_hash: 'abc123',
        document_hash: 'test-doc-hash-error',
      };

      await expect(
        store.storeVector(id, wrongEmbedding, metadata)
      ).rejects.toThrow(/Embedding dimension mismatch/);
    });

    it('should reject missing required metadata fields', async () => {
      const id = 'missing-metadata';
      const embedding = Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.5);
      const incompleteMetadata = {
        symbol: 'Test',
        // Missing: architectural_role, computed_at, lineage_hash
      } as Partial<
        Omit<import('./lance-store.js').VectorRecord, 'id' | 'embedding'>
      >;

      await expect(
        store.storeVector(id, embedding, incompleteMetadata)
      ).rejects.toThrow(/Missing required fields/);
    });

    it('should return undefined for non-existent vector', async () => {
      const result = await store.getVector('non-existent-id');
      expect(result).toBeUndefined();
    });
  });
});
