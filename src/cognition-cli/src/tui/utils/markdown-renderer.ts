import { unified } from 'unified';
import remarkParse from 'remark-parse';
import stripAnsi from 'strip-ansi';
import stringWidth from 'string-width';
import type {
  Root,
  RootContent,
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
      this.processNode(node as RootContent, {
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

    // Remove trailing empty lines (including those with only whitespace/indentation)
    while (
      this.lines.length > 0 &&
      (this.lines[this.lines.length - 1].chunks.length === 0 ||
        this.lines[this.lines.length - 1].chunks.every(
          (c) => c.text.trim() === ''
        ))
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
    const visualLength = stringWidth(text);

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
        const currentChunkWidth = stringWidth(currentChunkText);
        const wordWidth = stringWidth(word);

        if (lineLen + currentChunkWidth + wordWidth > effectiveWidth) {
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

  private processNode(node: RootContent, state: RendererState) {
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
          this.processNode(child as RootContent, {
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
          this.processNode(child as RootContent, {
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
          this.processNode(child as RootContent, {
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
          this.processNode(child as RootContent, {
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
          ((c.lang === 'text' || c.lang === 'bash' || !c.lang) &&
            (() => {
              const samples = codeLines.slice(0, 20);
              const hasStrongIndicator = samples.some((l) => {
                const clean = stripAnsi(l).trimStart();
                return (
                  clean.startsWith('--- ') ||
                  clean.startsWith('+++ ') ||
                  clean.startsWith('diff --git') ||
                  clean.startsWith('@@ -')
                );
              });
              const numberedLines = samples.filter((l) =>
                /^\s*([+-]\s*)?\d+\s*[│|]/.test(stripAnsi(l))
              );
              const numberedDiffCount = numberedLines.filter((l) => {
                const clean = stripAnsi(l);
                return (
                  /^\s*\d+\s*[│|]\s*[+-]/.test(clean) || // [+-] after line number
                  /^[+-]\s*\d+\s*[│|]/.test(clean) // [+-] before line number (Edit tool)
                );
              }).length;

              if (hasStrongIndicator) return true;
              if (numberedDiffCount >= 2) return true;

              // If it has line numbers, but also has lines WITHOUT +/- indicators,
              // then it's likely a read_file output, not a diff, unless it has strong headers.
              if (numberedLines.length > 0 && numberedDiffCount === 0) {
                return false;
              }

              // Check for git log/commit output - should not be treated as a diff unless it has strong markers
              const looksLikeGitOutput = samples.some((l) => {
                const clean = stripAnsi(l).trim();
                return (
                  clean.startsWith('commit ') ||
                  clean.startsWith('Author: ') ||
                  clean.startsWith('Date: ') ||
                  clean.startsWith('Merge: ') ||
                  clean.startsWith('On branch ') ||
                  clean.startsWith('Changes to be committed:') ||
                  clean.startsWith('Changes not staged for commit:') ||
                  /^[0-9a-f]{7,40}(?: \(.*\))?$/.test(clean) || // git log --oneline
                  /^[0-9a-f]{7,40}\s/.test(clean) || // Hash followed by space
                  /^\[\S+ [0-9a-f]{7,40}\]/.test(clean) // git commit summary [branch hash]
                );
              });

              if (looksLikeGitOutput && !hasStrongIndicator) return false;

              // Check for simple +/- markers at the start of lines even without headers
              // We are more strict here: lines must start with +/- (not indented)
              // to avoid false positives with commit messages or lists.
              const plusCount = samples.filter((l) =>
                stripAnsi(l).startsWith('+')
              ).length;
              const minusCount = samples.filter((l) =>
                stripAnsi(l).startsWith('-')
              ).length;

              // If we have both, it's very likely a diff
              if (
                plusCount > 0 &&
                minusCount > 0 &&
                plusCount + minusCount >= 2
              )
                return true;

              // If only one type, require more evidence
              if (plusCount >= 5 || minusCount >= 5) return true;

              return false;
            })());

        let baselineIndent = -1;

        codeLines.forEach((line) => {
          let lineColor =
            this.options.codeBlockColor || TUITheme.syntax.code.block;
          let lineBg = state.bg;
          let isAdd = false;
          let isRemove = false;
          let isHeader = false;

          // Simple Diff Highlighting
          if (isDiffBlock) {
            // Calculate baseline indentation once per block
            if (baselineIndent === -1) {
              const cleanLines = codeLines.map((l) => stripAnsi(l));
              const headerLine = cleanLines.find((l) => {
                const t = l.trimStart();
                return (
                  t.startsWith('diff --git') ||
                  t.startsWith('index ') ||
                  t.startsWith('--- ') ||
                  t.startsWith('+++ ') ||
                  t.startsWith('@@ ')
                );
              });

              if (headerLine) {
                baselineIndent = headerLine.match(/^\s*/)?.[0].length || 0;
              } else {
                // Fallback: find first line starting with + or - (trimmed)
                const diffLine = cleanLines.find((l) => {
                  const t = l.trimStart();
                  return t.startsWith('+') || t.startsWith('-');
                });
                if (diffLine) {
                  baselineIndent = diffLine.match(/^\s*/)?.[0].length || 0;
                } else {
                  baselineIndent = 0;
                }
              }
            }

            const cleanLine = stripAnsi(line);
            const lineIndent = cleanLine.match(/^\s*/)?.[0].length || 0;
            const trimmedLine = cleanLine.trimStart();

            // Strict indentation check to avoid identifying context lines as additions
            const isAtBaseline = lineIndent === baselineIndent;

            if (isAtBaseline) {
              isAdd =
                trimmedLine.startsWith('+') ||
                /^\+\s*\d+\s*[│|]/.test(trimmedLine) ||
                /^\s*\d+\s*[│|]\s*\+([ \t]|$|[^0-9])/.test(trimmedLine);
              isRemove =
                trimmedLine.startsWith('-') ||
                /^-\s*\d+\s*[│|]/.test(trimmedLine) ||
                /^\s*\d+\s*[│|]\s*-([ \t]|$|[^0-9])/.test(trimmedLine);
              isHeader =
                trimmedLine.startsWith('@') ||
                /^\s*\d+\s*[│|]\s*@/.test(trimmedLine);
            }

            if (isAdd) {
              lineColor = TUITheme.syntax.diff.add;
              lineBg = TUITheme.syntax.diff.addBg;
              line = cleanLine; // Use clean line to ensure wrapping and consistent background
            } else if (isRemove) {
              lineColor = TUITheme.syntax.diff.remove;
              lineBg = TUITheme.syntax.diff.removeBg;
              line = cleanLine; // Use clean line to ensure wrapping and consistent background
            } else if (isHeader) {
              lineColor = TUITheme.syntax.diff.header;
              line = cleanLine;
            } else if (
              isAtBaseline &&
              (trimmedLine.startsWith('index') ||
                trimmedLine.startsWith('diff'))
            ) {
              lineColor = TUITheme.syntax.diff.meta;
              line = cleanLine;
            }
          }

          // Regex to match: optional marker ([+-]), optional spaces, digits, separator (│ or |), optional space
          const diffMatch = line.match(/^(([+-]\s*)?\s*\d+\s*[│|]\s*)(.*)$/);
          if (diffMatch && isDiffBlock) {
            const [, prefix, markerPart, rest] = diffMatch;
            // Marker (+/-) if present at the very start
            if (markerPart) {
              this.addChunk(
                {
                  text: markerPart,
                  color: isAdd
                    ? TUITheme.syntax.diff.add
                    : TUITheme.syntax.diff.remove,
                  bg: lineBg,
                  bold: true,
                },
                { ...state, bg: lineBg }
              );
            }

            // Line number prefix
            const lineNumPart = markerPart
              ? prefix.slice(markerPart.length)
              : prefix;
            this.addChunk(
              {
                text: lineNumPart,
                color: TUITheme.syntax.lineNumber,
                bg: lineBg,
              },
              {
                ...state,
                bg: lineBg,
              }
            );

            // Content (bright if add/remove)
            this.addChunk(
              {
                text: rest,
                color: lineColor,
                bg: lineBg,
                dim: isAdd || isRemove || isHeader ? false : state.dim,
              },
              {
                ...state,
                bg: lineBg,
                dim: isAdd || isRemove || isHeader ? false : state.dim,
              }
            );
          } else {
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
          }
          this.flushLine();
        });
        break;
      }

      case 'list': {
        const l = node as List;
        this.ensureGap(state);
        l.children.forEach((item, index) => {
          if (this.currentLine.chunks.length > 0) {
            this.flushLine();
          }

          if (state.indent > 0) {
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
          this.processNode(item as RootContent, {
            ...state,
            indent: state.indent + bullet.length,
            suppressInitialGap: true, // First child shouldn't force a newline
          });
        });
        this.flushLine();
        break;
      }

      case 'listItem': {
        const li = node as ListItem;
        li.children.forEach((child, idx) => {
          this.processNode(child as RootContent, {
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
          this.processNode(child as RootContent, state)
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
          (node as Parent).children.forEach((child: RootContent) =>
            this.processNode(child as RootContent, state)
          );
        }
    }
  }

  private getLineLength(line: StyledLine): number {
    return line.chunks.reduce((sum, chunk) => sum + stringWidth(chunk.text), 0);
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
