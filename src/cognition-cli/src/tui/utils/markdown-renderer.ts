import { unified } from 'unified';
import remarkParse from 'remark-parse';
import stripAnsi from 'strip-ansi';
import type {
  Root,
  Content,
  Text,
  Code,
  Link,
  List,
  ListItem,
  Heading,
  InlineCode,
  Parent,
} from 'mdast';
import { TUITheme } from '../theme.js';

/**
 * Represents a styled segment of text within a line
 */
export interface TextChunk {
  text: string;
  color?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  dim?: boolean;
  inverse?: boolean;
}

/**
 * Represents a single line in the terminal, composed of multiple styled chunks
 */
export interface StyledLine {
  chunks: TextChunk[];
  /**
   * Optional stable key for rendering (e.g. in React/Ink)
   */
  key?: string;
}

/**
 * Configuration for the markdown renderer
 */
export interface MarkdownRendererOptions {
  width: number;
  baseColor?: string;
  baseBg?: string;
  baseDim?: boolean;
  bulletColor?: string;
  inlineCodeColor?: string;
  inlineCodeBg?: string;
  inlineCodeDim?: boolean;
  inlineCodeBold?: boolean;
  codeBlockColor?: string;
  codeBlockDim?: boolean;
  headingColor?: string;
  headingDim?: boolean;
  strongDim?: boolean;
  emphasisDim?: boolean;
  vibrantTitles?: string[];
  wrapIndent?: number;
}

/**
 * Internal state for the recursive processNode call
 */
interface RendererState extends Partial<TextChunk> {
  indent: number;
  wrapIndent?: number;
  suppressInitialGap?: boolean;
}

const processor = unified().use(remarkParse);

/**
 * Professional Markdown to TUI Line Renderer.
 *
 * Flattens Markdown AST into a list of lines with multiple style chunks per line.
 * Handles responsive word wrapping to ensure scrolling logic in the TUI remains accurate.
 */
export class MarkdownRenderer {
  private processor = processor;
  private options: MarkdownRendererOptions;
  private lines: StyledLine[] = [];
  private currentLine: StyledLine = { chunks: [] };

  constructor(options: MarkdownRendererOptions) {
    this.options = {
      baseColor: TUITheme.text.primary,
      ...options,
    };
  }

  /**
   * Main entry point: converts a markdown string to a flat list of styled lines.
   */
  render(markdown: string): StyledLine[] {
    if (!markdown) return [];

    const tree = this.processor.parse(markdown) as Root;
    this.lines = [];
    this.currentLine = { chunks: [] };

    tree.children.forEach((node) =>
      this.processNode(node as Content, {
        color: this.options.baseColor,
        bg: this.options.baseBg,
        dim: this.options.baseDim,
        indent: 0,
        wrapIndent: this.options.wrapIndent,
      })
    );

    // Final flush if anything left
    if (this.currentLine.chunks.length > 0) {
      this.flushLine();
    }

    // Remove trailing empty lines
    while (
      this.lines.length > 0 &&
      this.lines[this.lines.length - 1].chunks.length === 0
    ) {
      this.lines.pop();
    }

    return this.lines;
  }

  private flushLine() {
    this.lines.push(this.currentLine);
    this.currentLine = { chunks: [] };
  }

  /**
   * Ensures there is exactly one empty line before a new block.
   */
  private ensureGap(state: RendererState) {
    if (state.suppressInitialGap) return;

    if (this.currentLine.chunks.length > 0) {
      this.flushLine();
    }
    if (
      this.lines.length > 0 &&
      this.lines[this.lines.length - 1].chunks.length > 0
    ) {
      this.lines.push({ chunks: [] });
    }
  }

  /**
   * Helper to add a chunk to the current line, handling wrapping and internal newlines
   */
  private addChunk(chunk: TextChunk, state: RendererState) {
    const text = chunk.text;
    if (!text) return;

    // Handle internal newlines: they should always trigger a flush
    if (text.includes('\n')) {
      const parts = text.split('\n');
      parts.forEach((part, i) => {
        if (part) this.addChunk({ ...chunk, text: part }, state);
        if (i < parts.length - 1) {
          this.flushLine();
          const totalIndent = state.indent + (state.wrapIndent || 0);
          if (totalIndent > 0) {
            this.currentLine.chunks.push({
              text: ' '.repeat(totalIndent),
              color: state.color,
              bg: state.bg,
              dim: state.dim,
            });
          }
        }
      });
      return;
    }

    const remainingWidth =
      this.options.width - this.getLineLength(this.currentLine);

    // Safety: ensure we have at least some width to work with, even if width is negative
    const effectiveWidth = Math.max(2, this.options.width);

    // Ensure indentation is applied to the start of a fresh line
    const totalIndent = state.indent + (state.wrapIndent || 0);
    // Only apply indent if it doesn't consume the entire line
    const safeIndent = totalIndent < effectiveWidth ? totalIndent : 0;

    if (this.currentLine.chunks.length === 0 && safeIndent > 0) {
      this.currentLine.chunks.push({
        text: ' '.repeat(safeIndent),
        color: state.color,
        bg: state.bg,
        dim: state.dim,
      });
    }

    // Strip ANSI to check actual visual length
    const visualLength = stripAnsi(text).length;

    if (visualLength <= remainingWidth) {
      this.currentLine.chunks.push(chunk);
    } else {
      // Word wrap
      // We split by words (whitespace). This is generally safe even with ANSI
      // escape codes, as they rarely contain spaces. If a word itself is
      // longer than the width, we let it overflow for now to avoid breaking
      // ANSI sequences.
      const words = text.split(/(\s+)/);
      let currentChunkText = '';

      for (const word of words) {
        const lineLen = this.getLineLength(this.currentLine);
        if (lineLen + currentChunkText.length + word.length > effectiveWidth) {
          // Flush current accumulated text in this chunk
          if (currentChunkText) {
            this.currentLine.chunks.push({ ...chunk, text: currentChunkText });
            currentChunkText = '';
          }

          // If currentLine is not empty, flush it
          if (this.getLineLength(this.currentLine) > 0) {
            this.flushLine();
          }

          // Apply indent for the new wrapped line
          if (safeIndent > 0) {
            this.currentLine.chunks.push({
              text: ' '.repeat(safeIndent),
              color: state.color,
              bg: state.bg,
              dim: state.dim,
            });
          }

          // Start new line with the word, trimming leading space if it was the wrap trigger
          const nextPart = word.trimStart();
          if (nextPart) {
            currentChunkText = nextPart;
          }
        } else {
          currentChunkText += word;
        }
      }

      if (currentChunkText) {
        this.currentLine.chunks.push({ ...chunk, text: currentChunkText });
      }
    }
  }

  private processNode(node: Content, state: RendererState) {
    switch (node.type) {
      case 'heading': {
        const h = node as Heading;
        const hLevel = h.depth;
        const hColor =
          this.options.headingColor ||
          (hLevel === 1
            ? TUITheme.syntax.heading.h1
            : hLevel === 2
              ? TUITheme.syntax.heading.h2
              : TUITheme.syntax.heading.h3);

        this.ensureGap(state);

        const hashPrefix = '#'.repeat(hLevel) + ' ';
        // Style the hashes as dim/muted gray to make them secondary to the text
        this.addChunk(
          {
            text: hashPrefix,
            color: TUITheme.syntax.heading.prefix,
            dim: true,
          },
          state
        );

        h.children.forEach((child) =>
          this.processNode(child as Content, {
            ...state,
            color: hColor,
            bold: true,
            dim:
              this.options.headingDim !== undefined
                ? this.options.headingDim
                : state.dim,
            suppressInitialGap: false,
          })
        );
        this.flushLine();
        break;
      }

      case 'paragraph':
        this.ensureGap(state);
        node.children.forEach((child) =>
          this.processNode(child as Content, {
            ...state,
            suppressInitialGap: false,
          })
        );
        this.flushLine();
        break;

      case 'text': {
        const t = node as Text;
        let dim = state.dim;
        const trimmed = t.value.trim();
        // Highlight specific thinking block titles even if they aren't styled
        if (state.dim && this.options.vibrantTitles) {
          const lowerTrimmed = trimmed.toLowerCase().replace(/[:.!?]$/, '');
          const isVibrant = this.options.vibrantTitles.some((title) => {
            const lowerTitle = title.toLowerCase();
            return lowerTrimmed === lowerTitle;
          });
          if (isVibrant) {
            dim = false;
          }
        }
        this.addChunk({ ...state, text: t.value, dim }, state);
        break;
      }

      case 'strong':
        node.children.forEach((child) =>
          this.processNode(child as Content, {
            ...state,
            bold: true,
            dim:
              this.options.strongDim !== undefined
                ? this.options.strongDim
                : state.dim,
          })
        );
        break;

      case 'emphasis':
        node.children.forEach((child) =>
          this.processNode(child as Content, {
            ...state,
            italic: true,
            dim:
              this.options.emphasisDim !== undefined
                ? this.options.emphasisDim
                : state.dim,
          })
        );
        break;

      case 'inlineCode': {
        const ic = node as InlineCode;
        this.addChunk(
          {
            ...state,
            text: ic.value,
            color: this.options.inlineCodeColor || TUITheme.syntax.code.inline,
            bg:
              this.options.inlineCodeBg ||
              TUITheme.syntax.code.inlineBg ||
              state.bg,
            bold:
              this.options.inlineCodeBold !== undefined
                ? this.options.inlineCodeBold
                : true, // Default to bold for better visibility
            dim:
              this.options.inlineCodeDim !== undefined
                ? this.options.inlineCodeDim
                : state.dim,
          },
          state
        );
        break;
      }

      case 'code': {
        const c = node as Code;
        this.ensureGap(state);

        const codeLines = c.value.split('\n');
        // Determine if this block should use diff highlighting
        // Always for diff/patch, or if text/untagged blocks look like diffs
        const isDiffBlock =
          c.lang === 'diff' ||
          c.lang === 'patch' ||
          ((c.lang === 'text' || !c.lang) &&
            codeLines.slice(0, 10).some((l) => {
              const clean = stripAnsi(l);
              return (
                clean.startsWith('--- ') ||
                clean.startsWith('+++ ') ||
                clean.startsWith('diff --git') ||
                clean.startsWith('@@ -') ||
                /^\s*\d+[│|][+-]/.test(clean)
              );
            }));

        codeLines.forEach((line) => {
          let lineColor =
            this.options.codeBlockColor || TUITheme.syntax.code.block;
          let lineBg = state.bg;
          let isAdd = false;
          let isRemove = false;
          let isHeader = false;

          // Simple Diff Highlighting
          if (isDiffBlock) {
            // Enhanced detection for both standard git diffs and CLI 'edit' views
            // Strip ANSI for detection and to ensure our colors take precedence
            const cleanLine = stripAnsi(line);
            isAdd =
              cleanLine.startsWith('+') || /^\s*\d+[│|]\s*\+/.test(cleanLine);
            isRemove =
              cleanLine.startsWith('-') || /^\s*\d+[│|]\s*-/.test(cleanLine);
            isHeader =
              cleanLine.startsWith('@') || /^\s*\d+[│|]\s*@/.test(cleanLine);

            if (isAdd) {
              lineColor = TUITheme.syntax.diff.add;
              lineBg = TUITheme.syntax.diff.addBg;
              line = cleanLine; // Use clean line to ensure coloring works
            } else if (isRemove) {
              lineColor = TUITheme.syntax.diff.remove;
              lineBg = TUITheme.syntax.diff.removeBg;
              line = cleanLine; // Use clean line to ensure coloring works
            } else if (isHeader) {
              lineColor = TUITheme.syntax.diff.header;
              line = cleanLine;
            } else if (
              cleanLine.startsWith('index') ||
              cleanLine.startsWith('diff')
            ) {
              lineColor = TUITheme.syntax.diff.meta;
              line = cleanLine;
            }
          }

          // Use addChunk to handle wrapping within the code block
          this.addChunk(
            {
              text: line,
              color: lineColor,
              bg: lineBg,
              dim:
                this.options.codeBlockDim !== undefined
                  ? this.options.codeBlockDim
                  : isAdd || isRemove || isHeader
                    ? false
                    : state.dim,
            },
            {
              ...state,
              bg: lineBg, // Ensure wrapped lines and indentation use the diff background
              dim: isAdd || isRemove || isHeader ? false : state.dim,
            }
          );
          this.flushLine();
        });
        break;
      }

      case 'list': {
        const l = node as List;
        this.ensureGap(state);
        l.children.forEach((item, index) => {
          if (this.currentLine.chunks.length === 0 && state.indent > 0) {
            this.currentLine.chunks.push({
              text: ' '.repeat(state.indent),
              color: state.color,
              bg: state.bg,
              dim: state.dim,
            });
          }

          const bullet = l.ordered ? `${index + 1}. ` : '- ';
          this.currentLine.chunks.push({
            text: bullet,
            color: this.options.bulletColor || TUITheme.roles.assistant,
            bg: state.bg,
            bold: true,
            dim: state.dim,
          });

          // Pass the bullet length as indent for the list item content
          this.processNode(item as Content, {
            ...state,
            indent: state.indent + bullet.length,
            suppressInitialGap: true, // First child shouldn't force a newline
          });
        });
        break;
      }

      case 'listItem': {
        const li = node as ListItem;
        li.children.forEach((child, idx) => {
          this.processNode(child as Content, {
            ...state,
            suppressInitialGap: state.suppressInitialGap && idx === 0,
          });
        });
        break;
      }

      case 'break':
        this.flushLine();
        break;

      case 'link': {
        const link = node as Link;
        this.addChunk({ ...state, text: '[', dim: true }, state);
        link.children.forEach((child) =>
          this.processNode(child as Content, state)
        );
        this.addChunk({ ...state, text: ']', dim: true }, state);
        this.addChunk(
          {
            text: `(${link.url})`,
            color: TUITheme.syntax.link,
            dim: true,
          },
          state
        );
        break;
      }

      default:
        if ('children' in node) {
          (node as Parent).children.forEach((child: Content) =>
            this.processNode(child as Content, state)
          );
        }
    }
  }

  private getLineLength(line: StyledLine): number {
    return line.chunks.reduce(
      (sum, chunk) => sum + stripAnsi(chunk.text).length,
      0
    );
  }
}

/**
 * Convenience function to render markdown to styled lines.
 */
export function markdownToLines(
  markdown: string,
  width: number,
  options: Partial<MarkdownRendererOptions> = {}
): StyledLine[] {
  const renderer = new MarkdownRenderer({ width, ...options });
  return renderer.render(markdown);
}
