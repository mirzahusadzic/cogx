/**
 * Markdown Parser for Overlay Documents
 *
 * Hierarchical parser for markdown documents that extracts structured sections
 * with content hashing for incremental updates. Used primarily for ingesting
 * strategic overlays (mission, security, operational) into the Grounded Context Pool (PGC).
 *
 * DESIGN:
 * The parser transforms flat markdown into a hierarchical tree based on heading levels:
 * - Each heading (H1-H6) starts a new section
 * - Sections are nested based on heading hierarchy (H2 under H1, H3 under H2, etc.)
 * - Each section has a structural hash for change detection
 * - Frontmatter (YAML) provides metadata like document type and target overlay
 *
 * STRUCTURAL HASHING:
 * Each section's hash is computed from:
 * - Heading text
 * - Section content
 * - Hashes of child sections
 *
 * This enables incremental updates: if a section's hash hasn't changed,
 * skip re-embedding it during overlay ingestion.
 *
 * OVERLAY INGESTION:
 * Markdown documents are the primary format for strategic guidance:
 * - O1 Mission: docs/mission/principles.md
 * - O2 Security: docs/security/guidelines.md
 * - O5 Operational: docs/operations/workflows.md
 *
 * The parser extracts sections as distinct overlay items, each embedded
 * separately for fine-grained semantic search.
 *
 * @example
 * // Parse security guidelines
 * const parser = new MarkdownParser();
 * const doc = await parser.parse('docs/security/guidelines.md');
 *
 * console.log(`Title: ${doc.metadata.title}`);
 * console.log(`Overlay: ${doc.metadata.overlay}`); // 'security'
 * console.log(`Sections: ${doc.sections.length}`);
 *
 * // Process each section
 * for (const section of doc.sections) {
 *   console.log(`${section.heading} (hash: ${section.structuralHash})`);
 *   await embedSection(section);
 * }
 *
 * @example
 * // Incremental update using hashes
 * const previousDoc = await loadPreviousVersion();
 * const currentDoc = await parser.parse('docs/mission/principles.md');
 *
 * for (const section of currentDoc.sections) {
 *   const prevSection = findSection(previousDoc, section.heading);
 *   if (prevSection?.structuralHash !== section.structuralHash) {
 *     console.log(`Section changed: ${section.heading}`);
 *     await reEmbedSection(section);
 *   }
 * }
 *
 * @example
 * // Parse with frontmatter
 * // File: docs/security/auth.md
 * // ---
 * // type: guideline
 * // overlay: security
 * // priority: critical
 * // ---
 * const doc = await parser.parse('docs/security/auth.md');
 * console.log(doc.metadata.type);     // 'guideline'
 * console.log(doc.metadata.overlay);  // 'security'
 * console.log(doc.metadata.priority); // 'critical'
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { Root, Heading, Node, PhrasingContent } from 'mdast';
import yaml from 'js-yaml';

/**
 * Hierarchical section extracted from a markdown document.
 *
 * Sections form a tree structure based on heading levels.
 * Each section includes position information for source mapping
 * and a structural hash for change detection.
 *
 * @example
 * const section: MarkdownSection = {
 *   heading: 'Authentication Requirements',
 *   level: 2,
 *   content: 'All API endpoints must validate JWT tokens...',
 *   children: [
 *     {
 *       heading: 'Token Validation',
 *       level: 3,
 *       content: 'Tokens must be verified using RS256...',
 *       children: [],
 *       structuralHash: 'abc123...',
 *       position: { ... }
 *     }
 *   ],
 *   structuralHash: 'def456...',
 *   position: {
 *     start: { line: 5, column: 1, offset: 123 },
 *     end: { line: 15, column: 1, offset: 456 }
 *   }
 * };
 */
export interface MarkdownSection {
  /** Heading text (without # prefix) */
  heading: string;
  /** Heading level: 1-6 (H1-H6) */
  level: number;
  /** Content between this heading and next heading */
  content: string;
  /** Child sections (higher-level headings) */
  children: MarkdownSection[];
  /** Hash of heading + content + children (for change detection) */
  structuralHash: string;
  /** Position in source file */
  position: {
    start: { line: number; column: number; offset?: number };
    end: { line: number; column: number; offset?: number };
  };
}

/**
 * Parsed markdown document with structured sections and metadata.
 *
 * The document includes both the hierarchical section tree and
 * metadata extracted from frontmatter (if present).
 *
 * @example
 * const doc: MarkdownDocument = {
 *   filePath: 'docs/security/guidelines.md',
 *   hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
 *   sections: [
 *     { heading: 'Security Guidelines', level: 1, ... }
 *   ],
 *   metadata: {
 *     title: 'Security Guidelines',
 *     type: 'guideline',
 *     overlay: 'security'
 *   },
 *   rawContent: '# Security Guidelines\n\n...'
 * };
 */
export interface MarkdownDocument {
  /** Original file path */
  filePath: string;
  /** SHA-256 hash of entire document */
  hash: string;
  /** Hierarchical sections extracted from document */
  sections: MarkdownSection[];
  /** Metadata from frontmatter and first heading */
  metadata: {
    title?: string;
    author?: string;
    date?: string;
    type?: string; // Document type from frontmatter
    overlay?: string; // Target overlay from frontmatter
    [key: string]: unknown; // Additional frontmatter fields
  };
  /** Raw markdown content */
  rawContent: string;
}

/**
 * Position in the markdown source file.
 *
 * Used internally to track where sections appear in the original file.
 */
interface Position {
  start: { line: number; column: number; offset?: number };
  end: { line: number; column: number; offset?: number };
}

/**
 * Heading metadata extracted during AST traversal.
 *
 * Used internally to accumulate headings before creating sections.
 */
interface HeadingInfo {
  text: string;
  level: number;
  position: Position | undefined;
}

/**
 * Parser for markdown documents with hierarchical section extraction.
 *
 * Converts flat markdown into structured, content-hashed sections
 * suitable for overlay ingestion and incremental updates.
 *
 * @example
 * const parser = new MarkdownParser();
 * const doc = await parser.parse('docs/mission/principles.md');
 *
 * // Access sections
 * for (const section of doc.sections) {
 *   console.log(`${section.heading}: ${section.content.substring(0, 100)}...`);
 * }
 */
export class MarkdownParser {
  /**
   * Parse a markdown file into structured format.
   *
   * Reads the file, parses it into an AST, extracts hierarchical sections,
   * and computes hashes for change detection.
   *
   * @param filePath - Absolute path to markdown file
   * @returns Parsed document with sections and metadata
   *
   * @example
   * const parser = new MarkdownParser();
   * const doc = await parser.parse('/docs/security/guidelines.md');
   * console.log(`Found ${doc.sections.length} top-level sections`);
   */
  async parse(filePath: string): Promise<MarkdownDocument> {
    // Read file
    const content = await readFile(filePath, 'utf-8');

    // Parse with remark
    const processor = unified().use(remarkParse);
    const ast = processor.parse(content) as Root;

    // Extract sections
    const sections = this.extractSections(ast, content);

    // Compute document hash
    const hash = this.computeHash(content);

    // Extract metadata (first H1 as title, etc.)
    const metadata = this.extractMetadata(sections);

    // Extract and merge frontmatter
    const frontmatter = this.extractFrontmatter(content);
    if (frontmatter) {
      Object.assign(metadata, frontmatter);
    }

    return {
      filePath,
      hash,
      sections,
      metadata,
      rawContent: content,
    };
  }

  /**
   * Extract hierarchical sections from markdown AST.
   *
   * Traverses the AST accumulating content under each heading.
   * Sections are nested based on heading levels: H2 becomes child of H1, etc.
   *
   * @param ast - Remark AST root node
   * @param content - Original markdown content for position mapping
   * @returns Array of top-level sections with nested children
   */
  private extractSections(ast: Root, content: string): MarkdownSection[] {
    const sections: MarkdownSection[] = [];
    const sectionStack: Array<{ section: MarkdownSection; level: number }> = [];

    let currentContent: string[] = [];
    let currentHeading: HeadingInfo | null = null;

    visit(ast, (node) => {
      if (node.type === 'heading') {
        // Save previous section if exists
        if (currentHeading) {
          const section = this.createSection(
            currentHeading.text,
            currentHeading.level,
            currentContent.join('\n'),
            currentHeading.position
          );

          this.addSectionToHierarchy(section, sections, sectionStack);
        }

        // Start new section
        currentHeading = {
          text: this.extractHeadingText(node as Heading),
          level: (node as Heading).depth,
          position: node.position,
        };
        currentContent = [];
      } else if (currentHeading) {
        // Accumulate content for current section
        const text = this.nodeToText(node, content);
        if (text) {
          currentContent.push(text);
        }
      }
    });

    // Add final section
    if (currentHeading) {
      const heading: HeadingInfo = currentHeading;
      const section = this.createSection(
        heading.text,
        heading.level,
        currentContent.join('\n'),
        heading.position
      );
      this.addSectionToHierarchy(section, sections, sectionStack);
    }

    return sections;
  }

  /**
   * Create a section with structural hash.
   *
   * The structural hash is computed from heading, content, and child hashes,
   * enabling efficient change detection during incremental updates.
   *
   * @param heading - Heading text
   * @param level - Heading level (1-6)
   * @param content - Section content
   * @param position - Position in source file
   * @returns Section with computed structural hash
   */
  private createSection(
    heading: string,
    level: number,
    content: string,
    position: Position | undefined
  ): MarkdownSection {
    const section: MarkdownSection = {
      heading,
      level,
      content: content.trim(),
      children: [],
      structuralHash: '',
      position: position || {
        start: { line: 0, column: 0, offset: 0 },
        end: { line: 0, column: 0, offset: 0 },
      },
    };

    // Compute hash after creating section
    section.structuralHash = this.computeSectionHash(section);

    return section;
  }

  /**
   * Add section to hierarchy based on heading levels.
   *
   * Uses a stack to track the current section nesting. Sections with higher
   * level numbers (H2, H3, etc.) become children of lower level headings (H1).
   *
   * @param section - Section to add
   * @param rootSections - Array of top-level sections
   * @param stack - Stack tracking current nesting context
   */
  private addSectionToHierarchy(
    section: MarkdownSection,
    rootSections: MarkdownSection[],
    stack: Array<{ section: MarkdownSection; level: number }>
  ): void {
    // Pop stack until we find a parent (higher level heading)
    while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level section
      rootSections.push(section);
    } else {
      // Child of previous section
      stack[stack.length - 1].section.children.push(section);
    }

    // Add to stack for future children
    stack.push({ section, level: section.level });
  }

  /**
   * Extract text from heading node.
   *
   * Handles inline formatting (strong, emphasis, code) within headings.
   *
   * @param heading - Heading AST node
   * @returns Plain text heading content
   */
  private extractHeadingText(heading: Heading): string {
    return heading.children
      .map((child: PhrasingContent) => {
        if (child.type === 'text') return child.value;
        if (child.type === 'inlineCode') return child.value;
        if (child.type === 'strong' || child.type === 'emphasis') {
          return child.children
            .map((c) => ('value' in c ? c.value : ''))
            .join('');
        }
        return '';
      })
      .join('')
      .trim();
  }

  /**
   * Convert AST node to text for content accumulation.
   *
   * Uses source position offsets to extract original text, preserving
   * exact formatting from the source file.
   *
   * @param node - AST node to convert
   * @param fullContent - Original markdown content
   * @returns Text representation of node
   */
  private nodeToText(node: Node, fullContent: string): string {
    if (!node.position) return '';

    const { start, end } = node.position;
    if (start.offset === undefined || end.offset === undefined) return '';

    return fullContent.substring(start.offset, end.offset);
  }

  /**
   * Compute SHA-256 hash of content.
   *
   * @param content - Content to hash
   * @returns Hex-encoded SHA-256 hash
   */
  private computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Compute structural hash for a section.
   *
   * The hash is computed from heading, content, and child hashes,
   * creating a Merkle tree structure. This enables efficient
   * change detection: if a section's hash matches the previous
   * version, neither it nor its children have changed.
   *
   * @param section - Section to hash
   * @returns SHA-256 hash of section structure
   */
  private computeSectionHash(section: MarkdownSection): string {
    const data = [
      section.heading,
      section.content,
      ...section.children.map((c) => c.structuralHash),
    ].join('||');

    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Extract metadata from document.
   *
   * Uses the first H1 heading as the document title if present.
   * Additional metadata comes from frontmatter (see extractFrontmatter).
   *
   * @param sections - Parsed sections
   * @returns Metadata object with title
   */
  private extractMetadata(sections: MarkdownSection[]): {
    title?: string;
    author?: string;
    date?: string;
    [key: string]: unknown; // Allow additional frontmatter fields
  } {
    // Use first H1 as title
    const firstH1 = sections.find((s) => s.level === 1);

    return {
      title: firstH1?.heading,
    };
  }

  /**
   * Extract YAML frontmatter from markdown content.
   *
   * Frontmatter is YAML between --- delimiters at the start of the file:
   * ```
   * ---
   * type: guideline
   * overlay: security
   * ---
   * ```
   *
   * This metadata is used to:
   * - Determine target overlay for ingestion
   * - Classify document type (guideline, principle, workflow)
   * - Add custom metadata fields
   *
   * @param content - Markdown content
   * @returns Parsed frontmatter object, or null if not present
   */
  private extractFrontmatter(content: string): Record<string, unknown> | null {
    // Match YAML frontmatter: ---\n...content...\n---
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return null;
    }

    try {
      const yamlContent = match[1];
      const parsed = yaml.load(yamlContent);
      return parsed as Record<string, unknown>;
    } catch (err) {
      console.warn('Failed to parse frontmatter:', err);
      return null;
    }
  }
}
