/**
 * Tests for DocumentObject
 *
 * Coverage:
 * - [x] Document creation and initialization
 * - [x] Metadata handling
 * - [x] Content access
 * - [x] Hash calculation
 * - [x] Serialization and deserialization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentObject } from '../document-object.js';
import { createHash } from 'crypto';

describe('DocumentObject', () => {
  let sampleContent: string;
  let sampleHash: string;

  beforeEach(() => {
    sampleContent = 'Sample document content\nwith multiple lines';
    sampleHash = createHash('sha256').update(sampleContent).digest('hex');
  });

  describe('Document Creation', () => {
    it('should create document with content and metadata', () => {
      const doc = new DocumentObject(sampleContent, {
        path: 'test.md',
        type: 'markdown',
      });

      expect(doc).toBeDefined();
      expect(doc.content).toBe(sampleContent);
    });

    it('should store metadata correctly', () => {
      const metadata = {
        path: 'docs/test.md',
        type: 'markdown',
        author: 'test',
      };

      const doc = new DocumentObject(sampleContent, metadata);

      expect(doc.metadata).toEqual(metadata);
    });

    it('should handle empty content', () => {
      const doc = new DocumentObject('', { path: 'empty.md' });

      expect(doc.content).toBe('');
      expect(doc.metadata.path).toBe('empty.md');
    });
  });

  describe('Hash Calculation', () => {
    it('should calculate SHA-256 hash of content', () => {
      const doc = new DocumentObject(sampleContent, { path: 'test.md' });

      expect(doc.hash).toBe(sampleHash);
    });

    it('should produce different hashes for different content', () => {
      const doc1 = new DocumentObject('content1', { path: 'test1.md' });
      const doc2 = new DocumentObject('content2', { path: 'test2.md' });

      expect(doc1.hash).not.toBe(doc2.hash);
    });

    it('should produce same hash for identical content', () => {
      const doc1 = new DocumentObject(sampleContent, { path: 'test1.md' });
      const doc2 = new DocumentObject(sampleContent, { path: 'test2.md' });

      expect(doc1.hash).toBe(doc2.hash);
    });
  });

  describe('Content Access', () => {
    it('should allow reading content', () => {
      const doc = new DocumentObject(sampleContent, { path: 'test.md' });

      expect(doc.content).toBe(sampleContent);
    });

    it('should preserve line breaks', () => {
      const multilineContent = 'line1\nline2\nline3';
      const doc = new DocumentObject(multilineContent, { path: 'test.md' });

      expect(doc.content).toContain('\n');
      expect(doc.content.split('\n')).toHaveLength(3);
    });

    it('should handle unicode content', () => {
      const unicodeContent = 'Hello 世界 🌍';
      const doc = new DocumentObject(unicodeContent, { path: 'unicode.md' });

      expect(doc.content).toBe(unicodeContent);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      const doc = new DocumentObject(sampleContent, {
        path: 'test.md',
        type: 'markdown',
      });

      const json = doc.toJSON();

      expect(json).toHaveProperty('content');
      expect(json).toHaveProperty('metadata');
      expect(json).toHaveProperty('hash');
    });

    it('should deserialize from JSON', () => {
      const doc = new DocumentObject(sampleContent, {
        path: 'test.md',
        type: 'markdown',
      });

      const json = doc.toJSON();
      const restored = DocumentObject.fromJSON(json);

      expect(restored.content).toBe(doc.content);
      expect(restored.metadata).toEqual(doc.metadata);
      expect(restored.hash).toBe(doc.hash);
    });

    it('should preserve all metadata through serialization', () => {
      const metadata = {
        path: 'docs/guide.md',
        type: 'documentation',
        section: 'user-guide',
        version: '1.0.0',
      };

      const doc = new DocumentObject(sampleContent, metadata);
      const json = doc.toJSON();
      const restored = DocumentObject.fromJSON(json);

      expect(restored.metadata).toEqual(metadata);
    });
  });

  describe('Immutability', () => {
    it('should not allow modifying content after creation', () => {
      const doc = new DocumentObject(sampleContent, { path: 'test.md' });

      // TypeScript should prevent this, but test runtime behavior
      expect(() => {
        // @ts-expect-error - Testing immutability
        doc.content = 'modified';
      }).toThrow();
    });

    it('should not allow modifying hash', () => {
      const doc = new DocumentObject(sampleContent, { path: 'test.md' });

      expect(() => {
        // @ts-expect-error - Testing immutability
        doc.hash = 'fake-hash';
      }).toThrow();
    });
  });
});
