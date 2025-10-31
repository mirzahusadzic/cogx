import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { Root, Heading, Node, PhrasingContent } from 'mdast';
import yaml from 'js-yaml';

/**
 * Represents a hierarchical section extracted from a markdown document.
 */
export interface MarkdownSection {
  heading: string;
  level: number; // 1-6 (H1-H6)
  content: string;
  children: MarkdownSection[];
  structuralHash: string;
  position: {
    start: { line: number; column: number; offset?: number };
    end: { line: number; column: number; offset?: number };
  };
}

/**
 * Represents a parsed markdown document with structured sections.
 */
export interface MarkdownDocument {
  filePath: string;
  hash: string; // SHA-256 of entire document
  sections: MarkdownSection[];
  metadata: {
    title?: string;
    author?: string;
    date?: string;
    type?: string; // Document type from frontmatter
    overlay?: string; // Target overlay from frontmatter
    [key: string]: unknown; // Additional frontmatter fields
  };
  rawContent: string;
}

/**
 * Represents a position in the markdown source file.
 */
interface Position {
  start: { line: number; column: number; offset?: number };
  end: { line: number; column: number; offset?: number };
}

/**
 * Represents heading metadata extracted during parsing.
 */
interface HeadingInfo {
  text: string;
  level: number;
  position: Position | undefined;
}

/**
 * Parses markdown files into structured, hierarchical representations.
 */
export class MarkdownParser {
  /**
   * Parse a markdown file into structured format
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
   * Extract hierarchical sections from AST
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
   * Create a section with structural hash
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
   * Add section to hierarchy based on heading levels
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
   * Extract text from heading node
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
   * Convert AST node to text (for content accumulation)
   */
  private nodeToText(node: Node, fullContent: string): string {
    if (!node.position) return '';

    const { start, end } = node.position;
    if (start.offset === undefined || end.offset === undefined) return '';

    return fullContent.substring(start.offset, end.offset);
  }

  /**
   * Compute SHA-256 hash of content
   */
  private computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Compute structural hash for a section
   * Hash = hash(heading + content + children_hashes)
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
   * Extract metadata from document
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
   * Extract YAML frontmatter from markdown content
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
