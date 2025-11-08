import { describe, it, expect } from 'vitest';
import { ConceptExtractor } from '../concept-extractor.js';
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
            content: '**Our goal is to build verifiable AI.**',
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
            content: '**This should be ignored completely.**',
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

      // Should extract bold sentence from Vision
      expect(
        concepts.some((c) => c.text === 'Our goal is to build verifiable AI.')
      ).toBe(true);
      // Should NOT extract from Random Section
      expect(
        concepts.some((c) => c.text === 'This should be ignored completely.')
      ).toBe(false);
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
            content: '**Our mission is to build trust.**',
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
                content: '**Cryptographic truth is essential.**',
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

      // Overview is now whitelisted (technical docs), and Principles is whitelisted
      // Should extract bold sentence from Principles child section
      expect(
        concepts.some((c) => c.text === 'Cryptographic truth is essential.')
      ).toBe(true);
    });
  });

  describe('Pattern 1: Blockquote Extraction', () => {
    it('should extract blockquotes/epigraphs', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Vision',
            level: 1,
            content: '> _Augment human consciousness through verifiable AI._',
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

      expect(
        concepts.some(
          (c) => c.text === 'Augment human consciousness through verifiable AI.'
        )
      ).toBe(true);
    });
  });

  describe('Pattern 2: Subsection Header Extraction', () => {
    it('should extract ### subsection headers as concepts', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Principles',
            level: 1,
            content: '### 1. Knowledge is a Lattice\n\nContent here.',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 3, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      expect(concepts.some((c) => c.text === '1. Knowledge is a Lattice')).toBe(
        true
      );
    });
  });

  describe('Pattern 3: Bullet Prefix Extraction', () => {
    it('should extract bullet points with bold prefix and context', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Mission',
            level: 1,
            content:
              '- **AI reasoning is grounded in cryptographic truth**, anchoring intelligence in facts',
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

      expect(
        concepts.some(
          (c) =>
            c.text ===
            'AI reasoning is grounded in cryptographic truth: anchoring intelligence in facts'
        )
      ).toBe(true);
    });
  });

  describe('Pattern 4: Bold Complete Sentence Extraction', () => {
    it('should extract bold complete sentences (with punctuation)', () => {
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
              '**Our mission is to establish verifiable AI-human symbiosis.**',
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

      expect(
        concepts.some(
          (c) =>
            c.text ===
            'Our mission is to establish verifiable AI-human symbiosis.'
        )
      ).toBe(true);
    });

    it('should NOT extract short bold text without punctuation', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Vision',
            level: 1,
            content: 'We value **verifiable AI** in our work.',
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

      // Should NOT extract "verifiable AI" (no punctuation, not a sentence)
      expect(concepts.some((c) => c.text === 'verifiable AI')).toBe(false);
    });
  });

  describe('Pattern 5: Emoji-Prefixed Item Extraction', () => {
    it('should extract emoji-prefixed items', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Goals',
            level: 1,
            content: '✅ **Verifiable understanding is essential**',
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

      expect(
        concepts.some((c) => c.text === 'Verifiable understanding is essential')
      ).toBe(true);
    });
  });

  describe('Pattern 6: Quoted Phrase Extraction', () => {
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
            content: 'Our motto is "embrace, extend, extinguish".',
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

      expect(
        concepts.some((c) => c.text === 'embrace, extend, extinguish')
      ).toBe(true);
    });

    it('should skip questions in quotes', () => {
      const doc: MarkdownDocument = {
        filePath: '/test.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Vision',
            level: 1,
            content: 'We ask "What does this mean?"',
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

      // Questions should be filtered out
      expect(concepts.some((c) => c.text === 'What does this mean?')).toBe(
        false
      );
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
            content: '**First concept is very important.**',
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
            content: '**Second concept is also important.**',
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

      const firstConcept = concepts.find(
        (c) => c.text === 'First concept is very important.'
      );
      const secondConcept = concepts.find(
        (c) => c.text === 'Second concept is also important.'
      );

      expect(firstConcept).toBeTruthy();
      expect(secondConcept).toBeTruthy();
      expect(firstConcept!.weight).toBeGreaterThan(secondConcept!.weight);
    });

    it('should assign different weights to different patterns', () => {
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
              '> Blockquote concept here\n\n**Bold sentence concept here.**',
            children: [],
            structuralHash: 'hash1',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 3, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      const blockquote = concepts.find((c) => c.text.includes('Blockquote'));
      const boldSentence = concepts.find((c) =>
        c.text.includes('Bold sentence')
      );

      if (blockquote && boldSentence) {
        // Blockquote weight (1.0) should be higher than bold sentence (0.85)
        expect(blockquote.weight).toBeGreaterThan(boldSentence.weight);
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
              '**Verifiable systems are essential.** We need **verifiable systems are essential.**',
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

      const verifiable = concepts.find(
        (c) => c.text === 'Verifiable systems are essential.'
      );

      expect(verifiable).toBeTruthy();
      // Should see it twice and merge
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
            content: '> the and',
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
            content: '> the lattice structure',
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

      expect(concepts.some((c) => c.text === 'the lattice structure')).toBe(
        true
      );
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
            content: '**Not a mission section at all.**',
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
            content: '**Trust is essential for progress.**',
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

      const trustConcept = concepts.find(
        (c) => c.text === 'Trust is essential for progress.'
      );

      expect(trustConcept).toBeTruthy();
      expect(trustConcept!.section).toBe('Mission');
      expect(trustConcept!.sectionHash).toBe('hash-mission');
    });
  });

  describe('Meta-Cognitive Extraction: Parser Mining Itself', () => {
    it('should extract concepts from pattern mining documentation', () => {
      // This demonstrates the parser understanding its own methodology
      // by extracting concepts from the mining process documentation
      const doc: MarkdownDocument = {
        filePath: '/PATTERN_LIBRARY.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Meta', // Whitelisted section
            level: 2,
            content: `
### The L2→L3 Structural Mining Process

**This parser was derived through structural observation of VISION.md.**

We analyzed VISION.md to find best-fit extraction patterns.

The mining loop:

> Pattern Discovery → Pattern Documentation → Pattern Library

**The code is docs, the docs is code.**

### Pattern 1: Blockquote Essence

Blockquotes in strategic documents represent distilled essence.

### Oracle Validation Metrics

**All heuristics passed - the pattern-based approach is validated.**
            `,
            children: [],
            structuralHash: 'hash-meta',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 30, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      // Should extract the meta-concept about L2→L3 mining
      expect(
        concepts.some((c) => c.text === 'The L2→L3 Structural Mining Process')
      ).toBe(true);

      // Should extract bold complete sentence about methodology
      expect(
        concepts.some(
          (c) =>
            c.text ===
            'This parser was derived through structural observation of VISION.md.'
        )
      ).toBe(true);

      // Should extract the key insight
      expect(
        concepts.some((c) => c.text === 'The code is docs, the docs is code.')
      ).toBe(true);

      // Should extract pattern names as H3 headers
      expect(
        concepts.some((c) => c.text === 'Pattern 1: Blockquote Essence')
      ).toBe(true);

      // Should extract validation statement
      expect(
        concepts.some(
          (c) =>
            c.text ===
            'All heuristics passed - the pattern-based approach is validated.'
        )
      ).toBe(true);

      // Should extract blockquote
      expect(
        concepts.some(
          (c) =>
            c.text ===
            'Pattern Discovery → Pattern Documentation → Pattern Library'
        )
      ).toBe(true);
    });

    it('should extract meta-concepts about extraction patterns themselves', () => {
      // The parser extracts concepts about how it works
      const doc: MarkdownDocument = {
        filePath: '/PATTERN_LIBRARY.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Patterns', // Whitelisted section
            level: 2,
            content: `
> Blockquotes represent distilled essence statements.

### Pattern-Based Extraction vs. Sliding Window

**Pattern-based extraction targets structural markers.**

Before: 1,076 concepts @ 50% similarity (noise)
After: 26 concepts @ 85% similarity (signal)

**Improvement represents a 97.6% reduction in noise.**
            `,
            children: [],
            structuralHash: 'hash-patterns',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 15, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      // Should extract blockquote about blockquotes (meta!)
      expect(
        concepts.some(
          (c) =>
            c.text === 'Blockquotes represent distilled essence statements.'
        )
      ).toBe(true);

      // Should extract the approach comparison header
      expect(
        concepts.some(
          (c) => c.text === 'Pattern-Based Extraction vs. Sliding Window'
        )
      ).toBe(true);

      // Should extract bold sentence about methodology
      expect(
        concepts.some(
          (c) =>
            c.text === 'Pattern-based extraction targets structural markers.'
        )
      ).toBe(true);

      // Should extract improvement metric
      expect(
        concepts.some(
          (c) => c.text === 'Improvement represents a 97.6% reduction in noise.'
        )
      ).toBe(true);

      // All concepts should be from the whitelisted section
      concepts.forEach((concept) => {
        expect(concept.section).toBe('Patterns');
      });
    });

    it('should demonstrate full recursive self-awareness', () => {
      // This test shows the system understanding its own implementation
      // by extracting concepts that describe the extraction process
      const doc: MarkdownDocument = {
        filePath: '/09_Mission_Concept_Extraction.md',
        hash: 'abc123',
        rawContent: '',
        metadata: {},
        sections: [
          {
            heading: 'Meta: How This Parser Was Built',
            level: 2,
            content: `
**This parser was built using L2→L3 structural mining.**

We observed VISION.md structure and derived 6 extraction patterns:

### 1. Blockquotes (weight 1.0)
### 2. Subsection Headers (weight 0.95)
### 3. Bullet Prefixes (weight 0.9)

> The system extracted its own methodology when run on this documentation.

**Full meta-cognitive recursion achieved.**

✅ **Recursion boundary defined** — Pattern library is the termination point
            `,
            children: [],
            structuralHash: 'hash-meta-doc',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 18, column: 1 },
            },
          },
        ],
      };

      const concepts = extractor.extract(doc);

      // Should extract statement about its own construction
      expect(
        concepts.some(
          (c) =>
            c.text === 'This parser was built using L2→L3 structural mining.'
        )
      ).toBe(true);

      // Should extract pattern names
      expect(
        concepts.some((c) => c.text === '1. Blockquotes (weight 1.0)')
      ).toBe(true);
      expect(
        concepts.some((c) => c.text === '2. Subsection Headers (weight 0.95)')
      ).toBe(true);

      // Should extract blockquote about self-extraction
      expect(
        concepts.some(
          (c) =>
            c.text ===
            'The system extracted its own methodology when run on this documentation.'
        )
      ).toBe(true);

      // Should extract meta-cognitive statement
      expect(
        concepts.some(
          (c) => c.text === 'Full meta-cognitive recursion achieved.'
        )
      ).toBe(true);

      // Should extract recursion boundary concept
      expect(
        concepts.some(
          (c) =>
            c.text ===
            'Recursion boundary defined — Pattern library is the termination point'
        )
      ).toBe(true);

      // Verify weighting: blockquote should be highest
      const blockquoteConcept = concepts.find(
        (c) =>
          c.text ===
          'The system extracted its own methodology when run on this documentation.'
      );
      const boldSentenceConcept = concepts.find(
        (c) => c.text === 'Full meta-cognitive recursion achieved.'
      );

      if (blockquoteConcept && boldSentenceConcept) {
        expect(blockquoteConcept.weight).toBeGreaterThan(
          boldSentenceConcept.weight
        );
      }
    });
  });
});
