import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocumentLanceStore } from '../document-lance-store.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import YAML from 'yaml';

describe('DocumentLanceStore', () => {
  let store: DocumentLanceStore;
  let testDir: string;
  let pgcRoot: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lance-test-'));
    pgcRoot = path.join(testDir, '.open_cognition');
    await fs.ensureDir(pgcRoot);

    // Initialize store
    store = new DocumentLanceStore(pgcRoot);
    await store.initialize();
  });

  afterEach(async () => {
    // Clean up
    await store.close();
    await fs.remove(testDir);
  });

  describe('initialization', () => {
    it('should create LanceDB database', async () => {
      const dbPath = path.join(pgcRoot, 'lance', 'documents.lancedb');
      expect(await fs.pathExists(dbPath)).toBe(true);
    });

    it('should create document_concepts table', async () => {
      // Store a test concept to verify table exists
      const conceptId = await store.storeConcept(
        'O4',
        'test-hash',
        'test/doc.md',
        'transform-123',
        0,
        {
          text: 'Test concept',
          section: 'Test Section',
          sectionHash: 'section-hash',
          type: 'concept',
          weight: 1.0,
          occurrences: 1,
          embedding: new Array(768).fill(0.1),
        }
      );

      // ID format changed to use embedding hash instead of index
      expect(conceptId).toMatch(/^O4:test-hash:[a-f0-9]+$/);
    });
  });

  describe('storeConcept', () => {
    it('should store a single concept', async () => {
      const embedding = new Array(768).fill(0.5);
      const conceptId = await store.storeConcept(
        'O4',
        'doc-hash-1',
        'docs/vision.md',
        'transform-1',
        0,
        {
          text: 'Strategic vision for the project',
          section: 'Vision',
          sectionHash: 'vision-hash',
          type: 'vision',
          weight: 0.95,
          occurrences: 3,
          embedding,
        }
      );

      // ID format changed to use embedding hash instead of index
      expect(conceptId).toMatch(/^O4:doc-hash-1:[a-f0-9]+$/);

      // Verify it was stored
      const retrieved = await store.getConcept(conceptId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.text).toBe('Strategic vision for the project');
      expect(retrieved?.overlay_type).toBe('O4');
      expect(retrieved?.weight).toBe(0.95);
      expect(retrieved?.embedding).toHaveLength(768);
    });

    it('should replace existing concept with same ID', async () => {
      // Same embedding = same content-based ID
      const embedding = new Array(768).fill(0.5);

      // Store first version
      const id1 = await store.storeConcept(
        'O4',
        'doc-1',
        'test.md',
        'trans-1',
        0,
        {
          text: 'Version 1',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 0.5,
          occurrences: 1,
          embedding,
        }
      );

      // Store second version with same embedding (should replace)
      const id2 = await store.storeConcept(
        'O4',
        'doc-1',
        'test.md',
        'trans-1',
        0,
        {
          text: 'Version 2',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 0.8,
          occurrences: 2,
          embedding, // Same embedding = same content-based ID
        }
      );

      // Same embedding should produce same ID
      expect(id1).toBe(id2);

      const retrieved = await store.getConcept(id2);
      expect(retrieved?.text).toBe('Version 2');
      expect(retrieved?.weight).toBe(0.8);
    });

    it('should reject invalid embedding dimensions', async () => {
      const invalidEmbedding = new Array(512).fill(0.1); // Wrong dimension

      await expect(
        store.storeConcept('O4', 'doc-1', 'test.md', 'trans-1', 0, {
          text: 'Test',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 1.0,
          occurrences: 1,
          embedding: invalidEmbedding,
        })
      ).rejects.toThrow('Embedding dimension mismatch');
    });
  });

  describe('storeConceptsBatch', () => {
    it('should store multiple concepts efficiently', async () => {
      const concepts = [
        {
          text: 'Concept 1',
          section: 'Section A',
          sectionHash: 'hash-a',
          type: 'concept',
          weight: 0.9,
          occurrences: 2,
          embedding: new Array(768).fill(0.1),
        },
        {
          text: 'Concept 2',
          section: 'Section B',
          sectionHash: 'hash-b',
          type: 'principle',
          weight: 0.85,
          occurrences: 1,
          embedding: new Array(768).fill(0.2),
        },
        {
          text: 'Concept 3',
          section: 'Section C',
          sectionHash: 'hash-c',
          type: 'goal',
          weight: 0.75,
          occurrences: 3,
          embedding: new Array(768).fill(0.3),
        },
      ];

      const ids = await store.storeConceptsBatch(
        'O4',
        'doc-batch',
        'docs/batch.md',
        'transform-batch',
        concepts
      );

      expect(ids).toHaveLength(3);
      // ID format changed to use embedding hash instead of index
      expect(ids[0]).toMatch(/^O4:doc-batch:[a-f0-9]+$/);
      expect(ids[1]).toMatch(/^O4:doc-batch:[a-f0-9]+$/);
      expect(ids[2]).toMatch(/^O4:doc-batch:[a-f0-9]+$/);
      // Each should have a unique hash (different embeddings)
      expect(new Set(ids).size).toBe(3);

      // Verify all were stored
      const retrieved = await store.getDocumentConcepts('O4', 'doc-batch');
      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].text).toBe('Concept 1');
      expect(retrieved[1].text).toBe('Concept 2');
      expect(retrieved[2].text).toBe('Concept 3');
    });

    it('should delete old concepts before storing new batch', async () => {
      // Store initial batch
      await store.storeConceptsBatch('O4', 'doc-1', 'test.md', 'trans-1', [
        {
          text: 'Old concept 1',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 1.0,
          occurrences: 1,
          embedding: new Array(768).fill(0.1),
        },
        {
          text: 'Old concept 2',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 1.0,
          occurrences: 1,
          embedding: new Array(768).fill(0.2),
        },
      ]);

      // Store new batch (should replace all)
      await store.storeConceptsBatch('O4', 'doc-1', 'test.md', 'trans-2', [
        {
          text: 'New concept',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 1.0,
          occurrences: 1,
          embedding: new Array(768).fill(0.5),
        },
      ]);

      const retrieved = await store.getDocumentConcepts('O4', 'doc-1');
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].text).toBe('New concept');
    });
  });

  describe('similaritySearch', () => {
    beforeEach(async () => {
      // Store test concepts with different embeddings
      await store.storeConceptsBatch(
        'O4',
        'doc-1',
        'docs/vision.md',
        'trans-1',
        [
          {
            text: 'Strategic vision',
            section: 'Vision',
            sectionHash: 'hash-1',
            type: 'vision',
            weight: 0.95,
            occurrences: 1,
            embedding: new Array(768).fill(0.9), // High values
          },
          {
            text: 'Technical architecture',
            section: 'Architecture',
            sectionHash: 'hash-2',
            type: 'concept',
            weight: 0.8,
            occurrences: 1,
            embedding: new Array(768).fill(0.1), // Low values
          },
        ]
      );

      await store.storeConceptsBatch(
        'O2',
        'doc-2',
        'docs/security.md',
        'trans-2',
        [
          {
            text: 'Security guideline',
            section: 'Security',
            sectionHash: 'hash-3',
            type: 'guideline',
            weight: 0.9,
            occurrences: 1,
            embedding: new Array(768).fill(0.5), // Mid values
          },
        ]
      );
    });

    it('should find similar concepts', async () => {
      const queryEmbedding = new Array(768).fill(0.9); // Similar to first concept

      const results = await store.similaritySearch(queryEmbedding, 3);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].text).toBe('Strategic vision'); // Should be most similar
      expect(results[0].similarity).toBeGreaterThan(0.9);
    });

    it('should filter by overlay type', async () => {
      const queryEmbedding = new Array(768).fill(0.5);

      const results = await store.similaritySearch(queryEmbedding, 10, {
        overlay_type: 'O2',
      });

      expect(results).toHaveLength(1);
      expect(results[0].overlay_type).toBe('O2');
      expect(results[0].text).toBe('Security guideline');
    });

    it('should filter by weight', async () => {
      const queryEmbedding = new Array(768).fill(0.5);

      const results = await store.similaritySearch(queryEmbedding, 10, {
        min_weight: 0.9,
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((r) => {
        expect(r.metadata.weight).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should filter by document hash', async () => {
      const queryEmbedding = new Array(768).fill(0.5);

      const results = await store.similaritySearch(queryEmbedding, 10, {
        document_hash: 'doc-1',
      });

      expect(results).toHaveLength(2);
      results.forEach((r) => {
        expect(r.document_hash).toBe('doc-1');
      });
    });

    it('should limit results to topK', async () => {
      const queryEmbedding = new Array(768).fill(0.5);

      const results = await store.similaritySearch(queryEmbedding, 1);

      expect(results).toHaveLength(1);
    });
  });

  describe('getDocumentConcepts', () => {
    it('should retrieve all concepts for a document', async () => {
      await store.storeConceptsBatch('O4', 'doc-1', 'test.md', 'trans-1', [
        {
          text: 'Concept 1',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 1.0,
          occurrences: 1,
          embedding: new Array(768).fill(0.1),
        },
        {
          text: 'Concept 2',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 1.0,
          occurrences: 1,
          embedding: new Array(768).fill(0.2),
        },
      ]);

      const concepts = await store.getDocumentConcepts('O4', 'doc-1');

      expect(concepts).toHaveLength(2);
      expect(concepts[0].text).toBe('Concept 1');
      expect(concepts[1].text).toBe('Concept 2');
    });

    it('should return empty array for non-existent document', async () => {
      const concepts = await store.getDocumentConcepts('O4', 'nonexistent');
      expect(concepts).toHaveLength(0);
    });
  });

  describe('getOverlayConcepts', () => {
    it('should retrieve all concepts for an overlay type', async () => {
      await store.storeConceptsBatch('O4', 'doc-1', 'test1.md', 'trans-1', [
        {
          text: 'O4 Concept 1',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 1.0,
          occurrences: 1,
          embedding: new Array(768).fill(0.1),
        },
      ]);

      await store.storeConceptsBatch('O4', 'doc-2', 'test2.md', 'trans-2', [
        {
          text: 'O4 Concept 2',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 1.0,
          occurrences: 1,
          embedding: new Array(768).fill(0.2),
        },
      ]);

      await store.storeConceptsBatch('O2', 'doc-3', 'test3.md', 'trans-3', [
        {
          text: 'O2 Guideline',
          section: 'Section',
          sectionHash: 'hash',
          type: 'guideline',
          weight: 1.0,
          occurrences: 1,
          embedding: new Array(768).fill(0.3),
        },
      ]);

      const o4Concepts = await store.getOverlayConcepts('O4');
      const o2Concepts = await store.getOverlayConcepts('O2');

      expect(o4Concepts).toHaveLength(2);
      expect(o2Concepts).toHaveLength(1);
      expect(o4Concepts.every((c) => c.overlay_type === 'O4')).toBe(true);
      expect(o2Concepts.every((c) => c.overlay_type === 'O2')).toBe(true);
    });
  });

  describe('deleteDocumentConcepts', () => {
    it('should delete all concepts for a document', async () => {
      await store.storeConceptsBatch('O4', 'doc-1', 'test.md', 'trans-1', [
        {
          text: 'Concept 1',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 1.0,
          occurrences: 1,
          embedding: new Array(768).fill(0.1),
        },
        {
          text: 'Concept 2',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 1.0,
          occurrences: 1,
          embedding: new Array(768).fill(0.2),
        },
      ]);

      await store.deleteDocumentConcepts('O4', 'doc-1');

      const concepts = await store.getDocumentConcepts('O4', 'doc-1');
      expect(concepts).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return statistics about stored concepts', async () => {
      await store.storeConceptsBatch('O4', 'doc-1', 'test1.md', 'trans-1', [
        {
          text: 'Concept 1',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 0.9,
          occurrences: 1,
          embedding: new Array(768).fill(0.1),
        },
        {
          text: 'Concept 2',
          section: 'Section',
          sectionHash: 'hash',
          type: 'concept',
          weight: 0.7,
          occurrences: 1,
          embedding: new Array(768).fill(0.2),
        },
      ]);

      await store.storeConceptsBatch('O2', 'doc-2', 'test2.md', 'trans-2', [
        {
          text: 'Guideline',
          section: 'Section',
          sectionHash: 'hash',
          type: 'guideline',
          weight: 0.8,
          occurrences: 1,
          embedding: new Array(768).fill(0.3),
        },
      ]);

      const stats = await store.getStats();

      expect(stats.total_concepts).toBe(3);
      expect(stats.total_documents).toBe(2);
      expect(stats.by_overlay['O4']).toBe(2);
      expect(stats.by_overlay['O2']).toBe(1);
      expect(stats.avg_weight).toBeCloseTo(0.8, 1);
    });
  });

  describe('real-world YAML migration', () => {
    it('should correctly migrate mission concepts from YAML', async () => {
      // Load real YAML fixture
      const fixturePath = path.join(
        __dirname,
        'fixtures',
        'mission-concepts-sample.yaml'
      );
      const yamlContent = await fs.readFile(fixturePath, 'utf-8');
      const overlay = YAML.parse(yamlContent);

      interface ExtractedConcept {
        text: string;
        section?: string;
        sectionHash?: string;
        weight?: number;
        occurrences?: number;
        embedding?: number[];
      }

      // Extract concepts with embeddings
      const concepts = (
        overlay.extracted_concepts as ExtractedConcept[]
      ).filter((c) => c.embedding && c.embedding.length === 768);

      expect(concepts.length).toBeGreaterThan(0);

      // Migrate to LanceDB
      const ids = await store.storeConceptsBatch(
        'O4',
        overlay.document_hash,
        overlay.document_path,
        overlay.document_hash, // Using doc hash as transform ID
        concepts.map((c) => ({
          text: c.text,
          section: c.section || 'unknown',
          sectionHash: c.sectionHash || overlay.document_hash,
          type: 'concept',
          weight: c.weight || 1.0,
          occurrences: c.occurrences || 1,
          embedding: c.embedding,
        }))
      );

      expect(ids.length).toBe(concepts.length);

      // Verify retrieval
      const retrieved = await store.getDocumentConcepts(
        'O4',
        overlay.document_hash
      );
      expect(retrieved).toHaveLength(concepts.length);
      expect(retrieved[0].text).toBe(concepts[0].text);
      expect(retrieved[0].embedding).toHaveLength(768);

      // Test similarity search
      const firstEmbedding = concepts[0].embedding;
      const searchResults = await store.similaritySearch(firstEmbedding, 5);

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].text).toBe(concepts[0].text);
      expect(searchResults[0].similarity).toBeGreaterThan(0.99); // Should be nearly identical
    });
  });
});
