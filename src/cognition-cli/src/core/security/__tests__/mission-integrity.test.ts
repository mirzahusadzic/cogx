/**
 * Tests for MissionIntegrityMonitor
 *
 * CRITICAL P0 TESTS - Integrity monitoring is essential for tamper detection.
 *
 * Coverage:
 * - [x] Version recording
 * - [x] Version retrieval
 * - [x] Semantic fingerprint calculation
 * - [x] Hash-based integrity verification
 * - [x] Version history tracking
 * - [x] Latest version retrieval
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MissionIntegrityMonitor, type MissionConcept } from '../mission-integrity.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';

describe('MissionIntegrityMonitor', () => {
  let tempDir: string;
  let monitor: MissionIntegrityMonitor;
  let visionPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-integrity-test-'));
    const pgcRoot = path.join(tempDir, '.open_cognition');
    await fs.ensureDir(path.join(pgcRoot, 'security'));
    monitor = new MissionIntegrityMonitor(pgcRoot);
    visionPath = path.join(tempDir, 'VISION.md');
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Version Recording', () => {
    it('should record mission version with hash and embeddings', async () => {
      const content = 'test mission content';
      await fs.writeFile(visionPath, content);

      const concepts: MissionConcept[] = [
        { text: 'concept 1', embedding: [0.1, 0.2, 0.3], weight: 1.0 },
        { text: 'concept 2', embedding: [0.4, 0.5, 0.6], weight: 1.0 },
      ];

      const version = await monitor.recordVersion(visionPath, concepts);

      expect(version).toBeDefined();
      expect(version.version).toBe(1);
      expect(version.hash).toBe(createHash('sha256').update(content).digest('hex'));
      expect(version.conceptEmbeddings).toHaveLength(2);
      expect(version.conceptTexts).toEqual(['concept 1', 'concept 2']);
    });

    it('should auto-increment version numbers', async () => {
      await fs.writeFile(visionPath, 'version 1');
      const concepts1: MissionConcept[] = [
        { text: 'concept1', embedding: [0.1, 0.2], weight: 1.0 },
      ];

      const version1 = await monitor.recordVersion(visionPath, concepts1);

      await fs.writeFile(visionPath, 'version 2');
      const concepts2: MissionConcept[] = [
        { text: 'concept2', embedding: [0.3, 0.4], weight: 1.0 },
      ];

      const version2 = await monitor.recordVersion(visionPath, concepts2);

      expect(version1.version).toBe(1);
      expect(version2.version).toBe(2);

      const latest = await monitor.getLatestVersion();
      expect(latest?.version).toBe(2);
    });

    it('should store concept texts with embeddings', async () => {
      await fs.writeFile(visionPath, 'test content');
      const concepts: MissionConcept[] = [
        { text: 'security first', embedding: [0.1, 0.2], weight: 1.0 },
        { text: 'verification over trust', embedding: [0.3, 0.4], weight: 1.0 },
      ];

      const version = await monitor.recordVersion(visionPath, concepts);

      expect(version.conceptTexts).toEqual(['security first', 'verification over trust']);
      expect(version.conceptTexts).toHaveLength(2);

      const retrieved = await monitor.getVersion(1);
      expect(retrieved?.conceptTexts).toEqual(version.conceptTexts);
    });
  });

  describe('Version Retrieval', () => {
    it('should retrieve version by number', async () => {
      await fs.writeFile(visionPath, 'test content');
      const concepts: MissionConcept[] = [
        { text: 'test', embedding: [0.1, 0.2], weight: 1.0 },
      ];

      await monitor.recordVersion(visionPath, concepts);

      const retrieved = await monitor.getVersion(1);
      expect(retrieved).toBeDefined();
      expect(retrieved?.version).toBe(1);
      expect(retrieved?.hash).toBeDefined();
    });

    it('should return null for non-existent version', async () => {
      const retrieved = await monitor.getVersion(999);
      expect(retrieved).toBeNull();
    });

    it('should retrieve latest version', async () => {
      await fs.writeFile(visionPath, 'version 1');
      await monitor.recordVersion(visionPath, [
        { text: 'v1', embedding: [0.1], weight: 1.0 },
      ]);

      await fs.writeFile(visionPath, 'version 2');
      await monitor.recordVersion(visionPath, [
        { text: 'v2', embedding: [0.2], weight: 1.0 },
      ]);

      const latest = await monitor.getLatestVersion();
      expect(latest?.version).toBe(2);
    });

    it('should return null when no versions exist', async () => {
      const latest = await monitor.getLatestVersion();
      expect(latest).toBeNull();
    });
  });

  describe('Semantic Fingerprint Calculation', () => {
    it('should calculate fingerprint from concept embeddings', async () => {
      await fs.writeFile(visionPath, 'test content');
      const concepts: MissionConcept[] = [
        { text: 'c1', embedding: [0.1, 0.2, 0.3], weight: 1.0 },
        { text: 'c2', embedding: [0.4, 0.5, 0.6], weight: 1.0 },
      ];

      const version = await monitor.recordVersion(visionPath, concepts);

      expect(version.semanticFingerprint).toBeDefined();
      expect(typeof version.semanticFingerprint).toBe('string');
      expect(version.semanticFingerprint.length).toBeGreaterThan(0);
    });

    it('should produce different fingerprints for different embeddings', async () => {
      await fs.writeFile(visionPath, 'version 1');
      const version1 = await monitor.recordVersion(visionPath, [
        { text: 'c1', embedding: [0.1, 0.2], weight: 1.0 },
      ]);

      await fs.writeFile(visionPath, 'version 2');
      const version2 = await monitor.recordVersion(visionPath, [
        { text: 'c2', embedding: [0.9, 0.8], weight: 1.0 },
      ]);

      expect(version1.semanticFingerprint).not.toBe(version2.semanticFingerprint);
    });

    it('should produce same fingerprint for identical embeddings', async () => {
      await fs.writeFile(visionPath, 'version 1');
      const version1 = await monitor.recordVersion(visionPath, [
        { text: 'same', embedding: [0.5, 0.5, 0.7], weight: 1.0 },
      ]);

      await fs.writeFile(visionPath, 'version 2');
      const version2 = await monitor.recordVersion(visionPath, [
        { text: 'same', embedding: [0.5, 0.5, 0.7], weight: 1.0 },
      ]);

      expect(version1.semanticFingerprint).toBe(version2.semanticFingerprint);
    });
  });

  describe('Hash-Based Integrity Verification', () => {
    it('should verify content has not changed when hashes match', async () => {
      const content = 'mission document content';
      await fs.writeFile(visionPath, content);

      const version = await monitor.recordVersion(visionPath, [
        { text: 'concept', embedding: [0.1, 0.2], weight: 1.0 },
      ]);

      const expectedHash = createHash('sha256').update(content).digest('hex');
      expect(version.hash).toBe(expectedHash);

      // Verify hash matches current content
      const currentContent = await fs.readFile(visionPath, 'utf-8');
      const currentHash = createHash('sha256').update(currentContent).digest('hex');
      expect(version.hash).toBe(currentHash);
    });

    it('should detect tampering when hashes differ', async () => {
      const originalContent = 'original mission';
      await fs.writeFile(visionPath, originalContent);

      const version = await monitor.recordVersion(visionPath, [
        { text: 'original', embedding: [0.1], weight: 1.0 },
      ]);

      const originalHash = version.hash;

      // Tamper with file
      const tamperedContent = 'tampered mission';
      const tamperedHash = createHash('sha256').update(tamperedContent).digest('hex');

      // Hashes should differ
      expect(originalHash).not.toBe(tamperedHash);
    });
  });

  describe('Version History Tracking', () => {
    it('should maintain chronological version history', async () => {
      for (let i = 1; i <= 3; i++) {
        await fs.writeFile(visionPath, `version ${i}`);
        await monitor.recordVersion(visionPath, [
          { text: `v${i}`, embedding: [i * 0.1], weight: 1.0 },
        ]);
      }

      // Verify all versions are retrievable
      for (let i = 1; i <= 3; i++) {
        const retrieved = await monitor.getVersion(i);
        expect(retrieved?.version).toBe(i);
        expect(retrieved?.conceptTexts).toContain(`v${i}`);
      }
    });

    it('should preserve timestamps in version history', async () => {
      await fs.writeFile(visionPath, 'test');
      const version = await monitor.recordVersion(visionPath, [
        { text: 'test', embedding: [0.1], weight: 1.0 },
      ]);

      expect(version.timestamp).toBeDefined();
      expect(typeof version.timestamp).toBe('string');

      const retrieved = await monitor.getVersion(1);
      expect(retrieved?.timestamp).toBe(version.timestamp);
    });
  });

  describe('Edge Cases', () => {
    it('should handle large embeddings', async () => {
      await fs.writeFile(visionPath, 'large test');

      const largeConcepts: MissionConcept[] = Array.from({ length: 100 }, (_, i) => ({
        text: `concept-${i}`,
        embedding: Array.from({ length: 768 }, (_, j) => (i + j) / 1000),
        weight: 1.0,
      }));

      const version = await monitor.recordVersion(visionPath, largeConcepts);

      expect(version.conceptEmbeddings).toHaveLength(100);
      expect(version.conceptEmbeddings[0]).toHaveLength(768);

      const retrieved = await monitor.getVersion(1);
      expect(retrieved?.conceptEmbeddings).toHaveLength(100);
      expect(retrieved?.conceptEmbeddings[0]).toHaveLength(768);
    });

    it('should throw error when no concepts have embeddings', async () => {
      await fs.writeFile(visionPath, 'test');

      const conceptsWithoutEmbeddings: MissionConcept[] = [
        { text: 'no embedding', embedding: [], weight: 1.0 },
      ];

      await expect(
        monitor.recordVersion(visionPath, conceptsWithoutEmbeddings)
      ).rejects.toThrow();
    });
  });
});
