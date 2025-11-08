import { describe, it, expect, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { MarkdownParser } from '../markdown-parser.js';

// Mock fs to use memfs
vi.mock('fs/promises', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

describe('MarkdownParser', () => {
  let parser: MarkdownParser;

  beforeEach(() => {
    vol.reset();
    parser = new MarkdownParser();
  });

  describe('parse', () => {
    it('should parse basic markdown document', async () => {
      const content = `# Test Document

This is the intro.

## Section 1

Content for section 1.

### Subsection 1.1

Nested content.

## Section 2

Content for section 2.
`;

      vol.fromJSON({
        '/test.md': content,
      });

      const doc = await parser.parse('/test.md');

      expect(doc.filePath).toBe('/test.md');
      expect(doc.hash).toBeTruthy();
      expect(doc.hash.length).toBe(64); // SHA-256 hex
      expect(doc.rawContent).toBe(content);
      expect(doc.metadata.title).toBe('Test Document');
      expect(doc.sections.length).toBe(1); // H1 at top level
      expect(doc.sections[0].children.length).toBe(2); // 2 H2s as children
    });

    it('should create hierarchical section structure', async () => {
      const content = `# Top

## Section A

### Subsection A1

### Subsection A2

## Section B
`;

      vol.fromJSON({
        '/test.md': content,
      });

      const doc = await parser.parse('/test.md');
      const topSection = doc.sections[0];

      expect(topSection.heading).toBe('Top');
      expect(topSection.level).toBe(1);
      expect(topSection.children.length).toBe(2); // Section A, Section B

      const sectionA = topSection.children[0];
      expect(sectionA.heading).toBe('Section A');
      expect(sectionA.level).toBe(2);
      expect(sectionA.children.length).toBe(2); // Subsection A1, A2

      expect(sectionA.children[0].heading).toBe('Subsection A1');
      expect(sectionA.children[1].heading).toBe('Subsection A2');
    });

    it('should compute structural hashes', async () => {
      const content = `# Test

## Section

Content here.
`;

      vol.fromJSON({
        '/test.md': content,
      });

      const doc = await parser.parse('/test.md');

      // Every section should have a hash
      expect(doc.sections[0].structuralHash).toBeTruthy();
      expect(doc.sections[0].structuralHash.length).toBe(64);

      if (doc.sections[0].children.length > 0) {
        expect(doc.sections[0].children[0].structuralHash).toBeTruthy();
      }
    });

    it('should extract heading text from complex inline elements', async () => {
      const content = `# **Bold** and _italic_ and \`code\`

Content.
`;

      vol.fromJSON({
        '/test.md': content,
      });

      const doc = await parser.parse('/test.md');

      expect(doc.sections[0].heading).toBe('Bold and italic and code');
    });

    it('should handle document without H1', async () => {
      const content = `## Section 1

Content.

## Section 2

More content.
`;

      vol.fromJSON({
        '/test.md': content,
      });

      const doc = await parser.parse('/test.md');

      expect(doc.metadata.title).toBeUndefined();
      expect(doc.sections.length).toBe(2);
      expect(doc.sections[0].level).toBe(2);
    });

    it('should capture section positions', async () => {
      const content = `# Test

## Section

Content.
`;

      vol.fromJSON({
        '/test.md': content,
      });

      const doc = await parser.parse('/test.md');

      const firstSection = doc.sections[0];
      expect(firstSection.position.start.line).toBeGreaterThan(0);
      expect(firstSection.position.end.line).toBeGreaterThanOrEqual(
        firstSection.position.start.line
      );
    });

    it('should extract content excluding heading', async () => {
      const content = `# Main

Intro paragraph.

## Section

Section content with **formatting** and lists:

- Item 1
- Item 2
`;

      vol.fromJSON({
        '/test.md': content,
      });

      const doc = await parser.parse('/test.md');

      const mainSection = doc.sections[0];
      expect(mainSection.content).toContain('Intro paragraph');
      expect(mainSection.content).not.toContain('# Main');

      if (mainSection.children.length > 0) {
        const subSection = mainSection.children[0];
        expect(subSection.content).toContain('Section content');
        expect(subSection.content).toContain('Item 1');
      }
    });

    it('should handle empty sections', async () => {
      const content = `# Empty

## Also Empty

## Has Content

Some text here.
`;

      vol.fromJSON({
        '/test.md': content,
      });

      const doc = await parser.parse('/test.md');

      expect(doc.sections[0].content).toBeTruthy();
      const children = doc.sections[0].children;
      expect(children.length).toBe(2);
    });

    it('should compute different hashes for different content', async () => {
      const content1 = `# Test

Content A.
`;

      const content2 = `# Test

Content B.
`;

      vol.fromJSON({
        '/test1.md': content1,
        '/test2.md': content2,
      });

      const doc1 = await parser.parse('/test1.md');
      const doc2 = await parser.parse('/test2.md');

      expect(doc1.sections[0].structuralHash).not.toBe(
        doc2.sections[0].structuralHash
      );
    });
  });
});
