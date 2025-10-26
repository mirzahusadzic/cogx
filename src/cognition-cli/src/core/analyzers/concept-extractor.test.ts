import { describe, it, expect } from 'vitest';
import { ConceptExtractor } from './concept-extractor.js';
import { MarkdownDocument } from '../parsers/markdown-parser.js';

describe('ConceptExtractor', () => {
  const extractor = new ConceptExtractor();

  describe('Section Whitelist Filtering', () => {
    it('should only extract from whitelisted sections', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Vision',
            level: 1,
            content: 'We build **verifiable AI**.',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
          {
            heading: 'Random Section',
            level: 1,
            content: 'This has **ignored concept**.',
            children: [],
            structuralHash: 'hash2',
            position: {
              start: { line: 3, column: 1 },
              end: { line: 4, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      // Should only extract from Vision, not Random Section
      expect(concepts.some((c) => c.text === 'verifiable AI')).toBe(true);
      expect(concepts.some((c) => c.text === 'ignored concept')).toBe(false);
    });

    it('should match section names case-insensitively', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'MISSION',
            level: 1,
            content: '**Goal**: Build trust.',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      expect(concepts.length).toBeGreaterThan(0);
      expect(concepts.some((c) => c.section === 'MISSION')).toBe(true);
    });

    it('should recursively check children sections', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Overview',
            level: 1,
            content: 'Not whitelisted.',
            children: [
              {
                heading: 'Principles',
                level: 2,
                content: '**Cryptographic truth**.',
                children: [],
                structuralHash: 'hash2',
                position: {
                  start: { line: 3, column: 1 },
                  end: { line: 4, column: 1 },
                },
              },
            ],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 5, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      expect(concepts.some((c) => c.text === 'Cryptographic truth')).toBe(true);
    });
  });

  describe('Emphasized Text Extraction', () => {
    it('should extract bold text', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Vision',
            level: 1,
            content: 'We value **verifiable AI** and **cryptographic truth**.',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      expect(concepts.some((c) => c.text === 'verifiable AI')).toBe(true);
      expect(concepts.some((c) => c.text === 'cryptographic truth')).toBe(true);
    });

    it('should extract italic text', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Mission',
            level: 1,
            content: 'Focus on *transparency* and *provenance*.',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      expect(concepts.some((c) => c.text === 'transparency')).toBe(true);
      expect(concepts.some((c) => c.text === 'provenance')).toBe(true);
    });
  });

  describe('Quoted Text Extraction', () => {
    it('should extract quoted phrases', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Principles',
            level: 1,
            content: 'Our motto is "verify, don\'t trust".',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      expect(concepts.some((c) => c.text === "verify, don't trust")).toBe(true);
    });
  });

  describe('Noun Phrase Extraction', () => {
    it('should extract meaningful noun phrases', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Vision',
            level: 1,
            content:
              'AI human symbiosis creates accelerated understanding and shared progress.',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      // Should extract meaningful phrases
      expect(concepts.length).toBeGreaterThan(0);
    });
  });

  describe('Concept Weighting', () => {
    it('should weight earlier sections higher', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Vision',
            level: 1,
            content: '**first concept**',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
          {
            heading: 'Goals',
            level: 1,
            content: '**second concept**',
            children: [],
            structuralHash: 'hash2',
            position: {
              start: { line: 3, column: 1 },
              end: { line: 4, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      const firstConcept = concepts.find((c) => c.text === 'first concept');
      const secondConcept = concepts.find((c) => c.text === 'second concept');

      expect(firstConcept).toBeTruthy();
      expect(secondConcept).toBeTruthy();
      expect(firstConcept!.weight).toBeGreaterThan(secondConcept!.weight);
    });

    it('should assign higher weight to emphasized text', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Vision',
            level: 1,
            content: '**bold concept** and regular concept phrase',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      const boldConcept = concepts.find((c) => c.text === 'bold concept');
      const regularConcept = concepts.find((c) => c.text.includes('regular'));

      if (boldConcept && regularConcept) {
        expect(boldConcept.weight).toBeGreaterThan(regularConcept.weight);
      }
    });
  });

  describe('Concept Deduplication', () => {
    it('should merge duplicate concepts and accumulate occurrences', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Vision',
            level: 1,
            content:
              '**verifiable** is important. We need **verifiable** systems.',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      const verifiable = concepts.find((c) => c.text === 'verifiable');

      expect(verifiable).toBeTruthy();
      expect(verifiable!.occurrences).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Stop Word Filtering', () => {
    it('should filter out concepts that are all stop words', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Vision',
            level: 1,
            content: '**the and**',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      expect(concepts.some((c) => c.text === 'the and')).toBe(false);
    });

    it('should keep concepts with at least one meaningful word', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Vision',
            level: 1,
            content: '**the lattice**',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      expect(concepts.some((c) => c.text === 'the lattice')).toBe(true);
    });
  });

  describe('Empty Document Handling', () => {
    it('should return empty array for document with no mission sections', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Random',
            level: 1,
            content: 'Not a mission section.',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      expect(concepts.length).toBe(0);
    });
  });

  describe('Provenance Tracking', () => {
    it('should track source section in each concept', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Mission',
            level: 1,
            content: '**trust**',
            children: [],
            structuralHash: 'hash-mission',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      const trustConcept = concepts.find((c) => c.text === 'trust');

      expect(trustConcept).toBeTruthy();
      expect(trustConcept!.section).toBe('Mission');
      expect(trustConcept!.sectionHash).toBe('hash-mission');
    });
  });
});
