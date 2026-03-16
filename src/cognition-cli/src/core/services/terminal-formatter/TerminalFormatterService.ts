import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import { environmentService } from '../environment/EnvironmentService.js';

/**
 * TerminalFormatterService
 *
 * Centralized service for ANSI manipulation, Markdown rendering to ANSI,
 * JSON/Table formatting for CLI, and specialized string cleaning.
 */
export class TerminalFormatterService {
  private static instance: TerminalFormatterService;

  private constructor() {}

  public static getInstance(): TerminalFormatterService {
    if (!TerminalFormatterService.instance) {
      TerminalFormatterService.instance = new TerminalFormatterService();
    }
    return TerminalFormatterService.instance;
  }

  /**
   * Check if color output is enabled.
   *
   * Respects:
   * 1. COGNITION_NO_COLOR env var (CLI flag)
   * 2. NO_COLOR env var (standard)
   * 3. TTY detection (disable if piped)
   * 4. CI environment detection
   */
  public useColor(): boolean {
    if (environmentService.getEnv('COGNITION_NO_COLOR') === '1') return false;
    if (environmentService.getEnv('NO_COLOR')) return false;
    if (!process.stdout.isTTY) return false;
    if (environmentService.isCI()) return false;
    return true;
  }

  /**
   * Check if emoji output is enabled.
   *
   * Respects:
   * 1. COGNITION_NO_EMOJI env var (CLI flag)
   * 2. Terminal Unicode support detection
   * 3. Plain format mode
   */
  public useEmoji(): boolean {
    if (environmentService.getEnv('COGNITION_NO_EMOJI') === '1') return false;
    if (this.isPlainMode()) return false;

    const lang = environmentService.getEnv('LANG') || '';
    const supportsUnicode =
      lang.toLowerCase().includes('utf-8') || environmentService.isMac();

    return supportsUnicode;
  }

  /**
   * Check if box-drawing characters are supported.
   */
  public useBoxDrawing(): boolean {
    if (environmentService.getEnv('TERM') === 'dumb') return false;
    if (this.isPlainMode()) return false;

    const lang = environmentService.getEnv('LANG') || '';
    return lang.toLowerCase().includes('utf-8') || environmentService.isMac();
  }

  /**
   * Helper function that returns emoji or fallback based on terminal support.
   */
  public emoji(emojiChar: string, fallback: string): string {
    return this.useEmoji() ? emojiChar : fallback;
  }

  /**
   * Get box-drawing characters based on terminal support.
   */
  public getBoxChars() {
    if (this.useBoxDrawing()) {
      return {
        topLeft: '┌',
        topRight: '┐',
        bottomLeft: '└',
        bottomRight: '┘',
        horizontal: '─',
        vertical: '│',
        leftT: '├',
        rightT: '┤',
        topT: '┬',
        bottomT: '┴',
        cross: '┼',
      };
    }
    return {
      topLeft: '+',
      topRight: '+',
      bottomLeft: '+',
      bottomRight: '+',
      horizontal: '-',
      vertical: '|',
      leftT: '+',
      rightT: '+',
      topT: '+',
      bottomT: '+',
      cross: '+',
    };
  }

  /**
   * Returns the current output format.
   */
  public getFormat(): 'auto' | 'plain' | 'json' {
    const format = environmentService.getEnv('COGNITION_FORMAT');
    if (format === 'plain' || format === 'json') return format;
    return 'auto';
  }

  /**
   * Check if output should be in plain mode.
   */
  public isPlainMode(): boolean {
    return this.getFormat() === 'plain';
  }

  /**
   * Check if output should be in JSON mode.
   */
  public isJsonMode(): boolean {
    return this.getFormat() === 'json';
  }

  /**
   * Create chalk-like object that respects accessibility settings
   * Returns identity functions when colors are disabled
   */
  private get c() {
    if (this.useColor()) return chalk;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noop: any = new Proxy(() => {}, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get: () => noop,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apply: (_target: any, _thisArg: any, args: any[]) => args[0] || '',
    });
    return noop;
  }

  /**
   * Color schemes for different overlay types
   * Maps overlay identifier (O1-O7) to chalk color function
   */
  private get OVERLAY_COLORS(): Record<string, (text: string) => string> {
    const c = this.c;
    return {
      O1: c.blue, // Structural
      O2: c.red, // Security
      O3: c.yellow, // Lineage
      O4: c.magenta, // Mission
      O5: c.cyan, // Operational
      O6: c.green, // Mathematical
      O7: c.white, // Strategic Coherence
    };
  }

  /**
   * Color schemes for severity levels
   * Maps severity string to chalk color function
   */
  private get SEVERITY_COLORS(): Record<string, (text: string) => string> {
    const c = this.c;
    return {
      critical: c.red.bold,
      high: c.red,
      medium: c.yellow,
      low: c.blue,
      info: c.gray,
    };
  }

  /**
   * Truncate hash to first 8 characters
   *
   * Makes hashes readable in table output while maintaining
   * enough entropy for human disambiguation.
   *
   * @param hash - Full SHA-256 hash (64 chars)
   * @returns First 8 characters of hash
   */
  public truncateHash(hash: string): string {
    return hash.substring(0, 8);
  }

  /**
   * Extract overlay type from ID
   *
   * Parses the overlay identifier from a PGC ID string.
   * IDs follow the format: "hash:[O2]:semantic_path"
   *
   * @param id - PGC item ID
   * @returns Overlay type (e.g., "O2") or null if not found
   */
  public extractOverlayType(id: string): string | null {
    const match = id.match(/\[([O]\d+)\]/i);
    return match ? match[1].toUpperCase() : null;
  }

  /**
   * Color code an overlay type badge
   *
   * Returns the overlay identifier wrapped in brackets with
   * the appropriate color from OVERLAY_COLORS scheme.
   *
   * @param type - Overlay identifier (e.g., 'O2', 'O4')
   * @returns Colored badge string
   */
  public colorOverlayBadge(type: string): string {
    const colorFn = this.OVERLAY_COLORS[type] || this.c.white;
    return colorFn(`[${type}]`);
  }

  /**
   * Color code a severity level
   *
   * Applies consistent color coding to severity strings.
   * Case-insensitive matching against SEVERITY_COLORS.
   *
   * @param severity - Severity level (critical|high|medium|low|info)
   * @returns Colored severity string
   */
  public colorSeverity(severity: string): string {
    const colorFn =
      this.SEVERITY_COLORS[severity.toLowerCase()] || this.c.white;
    return colorFn(severity);
  }

  /**
   * Color code a similarity score (percentage)
   *
   * Visual feedback for semantic similarity scores from vector search.
   * Color intensity indicates match quality:
   * - Green: >= 80% (strong match)
   * - Yellow: 60-79% (moderate match)
   * - Yellow dim: 40-59% (weak match)
   * - Red dim: < 40% (very weak match)
   *
   * @param similarity - Similarity score (0.0 to 1.0)
   * @returns Colored percentage string
   */
  public colorSimilarity(similarity: number): string {
    const percent = similarity * 100;
    const c = this.c;
    if (percent >= 80) return c.green.bold(`${percent.toFixed(1)}%`);
    if (percent >= 60) return c.yellow(`${percent.toFixed(1)}%`);
    if (percent >= 40) return c.yellow.dim(`${percent.toFixed(1)}%`);
    return c.red.dim(`${percent.toFixed(1)}%`);
  }

  /**
   * Clean text - remove repeated sentences and ASCII art artifacts
   *
   * Preprocesses text before display by:
   * 1. Detecting and inline-formatting JSON (lineage patterns)
   * 2. Removing duplicate sentences (common in malformed data)
   * 3. Stripping ASCII art boxes and keeping text before them
   *
   * Does NOT truncate - use smartTruncate() if length limit needed.
   *
   * @param text - Raw text to clean
   * @returns Cleaned text (no length limit)
   */
  public cleanText(text: string): string {
    let cleaned = text;

    // Check if text is JSON - parse and format inline
    if (cleaned.trim().startsWith('{') || cleaned.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(cleaned);
        // Format JSON for lineage patterns
        if (parsed.symbol && Array.isArray(parsed.lineage)) {
          const lineageCount = parsed.lineage.length;
          if (lineageCount === 0) {
            return `${parsed.symbol} (no dependencies)`;
          }
          const relationships = parsed.lineage
            .map(
              (l: { type: string; relationship: string }) =>
                `${l.relationship} ${l.type}`
            )
            .join(', ');
          return `${parsed.symbol} → ${relationships}`;
        }
        // Fallback: inline JSON
        return JSON.stringify(parsed);
      } catch {
        // Not valid JSON, continue with text processing
      }
    }

    // Remove repeated sentences (common in malformed data)
    const sentences = text.split(/\.\s+/);
    if (sentences.length > 1) {
      const uniqueSentences: string[] = [];
      for (const sentence of sentences) {
        if (!uniqueSentences.includes(sentence.trim()) && sentence.trim()) {
          uniqueSentences.push(sentence.trim());
        }
      }
      if (uniqueSentences.length < sentences.length) {
        cleaned = uniqueSentences.join('. ');
      }
    }

    // Check if text contains ASCII art (box-drawing characters)
    if (/[─│┌┐└┘├┤┬┴┼↓▼]/.test(cleaned)) {
      // Strip ASCII art, keep text before it
      const beforeArt = cleaned.split(/[─│┌┐└┘├┤┬┴┼↓▼]/)[0].trim();
      if (beforeArt) {
        return beforeArt + ' [...]';
      }
      return '[ASCII diagram]';
    }

    return cleaned;
  }

  /**
   * Smart truncate - break at word boundaries, preserve readability
   *
   * Truncates text to maxLength while preserving word boundaries.
   * First cleans text using cleanText(), then truncates intelligently.
   *
   * @param text - Text to truncate
   * @param maxLength - Maximum character length
   * @returns Truncated text with '...' suffix if needed
   */
  public smartTruncate(text: string, maxLength: number): string {
    const cleaned = this.cleanText(text);
    if (cleaned.length <= maxLength) return cleaned;

    // Truncate at word boundary
    const truncated = cleaned.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Format an ID for display (hash + overlay type if present)
   *
   * Formats PGC item IDs for table display:
   * - Truncates hash to 8 chars (dimmed)
   * - Extracts and color-codes overlay badge if present
   *
   * @param id - PGC item ID (format: "hash:[O2]:path")
   * @returns Formatted ID with colored overlay badge
   */
  public formatId(id: string): string {
    const parts = id.split(':');
    const hash = this.truncateHash(parts[0]);
    const overlayType = this.extractOverlayType(id);

    if (overlayType) {
      return `${this.c.dim(hash)} ${this.colorOverlayBadge(overlayType)}`;
    }

    return this.c.dim(hash);
  }

  /**
   * Wrap a long line into multiple lines at word boundaries
   *
   * Internal helper for createBox(). Wraps text to fit within maxWidth
   * while respecting ANSI color codes (uses stripAnsi for width calc).
   *
   * @param line - Line to wrap (may contain ANSI codes)
   * @param maxWidth - Maximum display width
   * @returns Array of wrapped lines (preserving ANSI codes)
   */
  private wrapLine(line: string, maxWidth: number): string[] {
    const stripped = this.cleanAnsi(line);
    if (stripped.length <= maxWidth) {
      return [line];
    }

    const words = line.split(' ');
    const wrappedLines: string[] = [];
    let currentLine = '';
    let currentStripped = '';

    for (const word of words) {
      const wordStripped = this.cleanAnsi(word);
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testStripped = currentStripped
        ? `${currentStripped} ${wordStripped}`
        : wordStripped;

      if (testStripped.length <= maxWidth) {
        currentLine = testLine;
        currentStripped = testStripped;
      } else {
        if (currentLine) {
          wrappedLines.push(currentLine);
        }
        // If single word is too long, truncate it
        if (wordStripped.length > maxWidth) {
          const excess = word.length - maxWidth + 3;
          wrappedLines.push(word.substring(0, word.length - excess) + '...');
          currentLine = '';
          currentStripped = '';
        } else {
          currentLine = word;
          currentStripped = wordStripped;
        }
      }
    }

    if (currentLine) {
      wrappedLines.push(currentLine);
    }

    return wrappedLines.length > 0 ? wrappedLines : [''];
  }

  /**
   * Create a box border for grouping related content
   *
   * Draws a Unicode box around content with optional title.
   * Auto-wraps long lines to 80 chars max. Handles ANSI colors correctly.
   *
   * @param content - Array of content lines (may contain ANSI codes)
   * @param title - Optional title for top border
   * @returns Formatted box as multiline string
   */
  public createBox(content: string[], title?: string): string {
    // Plain mode: simple text without box
    if (this.isPlainMode()) {
      const lines: string[] = [];
      if (title) {
        lines.push(`=== ${title} ===`);
      }
      lines.push(...content);
      if (title) {
        lines.push('='.repeat(title.length + 8));
      }
      return lines.join('\n');
    }

    const maxBoxWidth = 80;
    const maxContentWidth = maxBoxWidth - 4; // Account for "│ " and " │"
    const chars = this.getBoxChars();

    // Wrap content lines that are too long
    const wrappedContent: string[] = [];
    for (const line of content) {
      const wrapped = this.wrapLine(line, maxContentWidth);
      wrappedContent.push(...wrapped);
    }

    const maxWidth = Math.max(
      ...wrappedContent.map((line) => this.cleanAnsi(line).length),
      title ? this.cleanAnsi(title).length + 4 : 0
    );
    const width = Math.min(maxWidth + 4, maxBoxWidth);

    const top = title
      ? `${chars.topLeft}${chars.horizontal} ${this.c.bold(title)} ${chars.horizontal.repeat(Math.max(0, width - this.cleanAnsi(title).length - 5))}${chars.topRight}`
      : `${chars.topLeft}${chars.horizontal.repeat(width - 2)}${chars.topRight}`;
    const bottom = `${chars.bottomLeft}${chars.horizontal.repeat(width - 2)}${chars.bottomRight}`;

    const lines = wrappedContent.map((line) => {
      const stripped = this.cleanAnsi(line);
      const padding = ' '.repeat(Math.max(0, width - stripped.length - 4));
      return `${chars.vertical} ${line}${padding} ${chars.vertical}`;
    });

    return [top, ...lines, bottom].join('\n');
  }

  /**
   * Create a simple separator line
   *
   * Draws a horizontal separator using repeated characters.
   * Output is dimmed for visual hierarchy.
   *
   * @param char - Character to repeat (default: box-drawing horizontal)
   * @param length - Number of repetitions (default: 60)
   * @returns Dimmed separator string
   */
  public separator(char: string = '─', length: number = 60): string {
    const chars = this.getBoxChars();
    const separatorChar = char === '─' ? chars.horizontal : char;
    return this.c.dim(separatorChar.repeat(length));
  }

  /**
   * Format a key-value pair with aligned colons
   *
   * Creates consistent key-value formatting with dimmed keys
   * and aligned colons for readability.
   *
   * @param key - Key name (will be dimmed and padded)
   * @param value - Value (may contain ANSI codes)
   * @param keyWidth - Width to pad key to (default: 12)
   * @returns Formatted "key: value" string
   */
  public formatKeyValue(
    key: string,
    value: string,
    keyWidth: number = 12
  ): string {
    const paddedKey = key.padEnd(keyWidth);
    return `${this.c.dim(paddedKey)}: ${value}`;
  }

  /**
   * Create a table header
   *
   * Formats column headers with bold text and vertical separators.
   * Used with tableRow() for consistent table formatting.
   *
   * @param columns - Array of column header strings
   * @returns Bold header with separators
   */
  public tableHeader(columns: string[]): string {
    const chars = this.getBoxChars();
    return this.c.bold(columns.join(`  ${chars.vertical}  `));
  }

  /**
   * Create a table row
   *
   * Formats row values with vertical separators matching tableHeader().
   * Values may contain ANSI codes for coloring.
   *
   * @param values - Array of cell values
   * @returns Row with separators
   */
  public tableRow(values: string[]): string {
    const chars = this.getBoxChars();
    return values.join(`  ${chars.vertical}  `);
  }

  /**
   * Formats a number into a compact string representation (e.g., 1.7M, 269k).
   * Useful for displaying large counts in space-constrained UI elements.
   */
  public formatCompactNumber(num: number): string {
    const absNum = Math.abs(num);
    if (absNum === 0) return '0';

    if (absNum >= 1_000_000) {
      return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }

    if (absNum >= 1_000) {
      return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    }

    return num.toString();
  }

  /**
   * ANSI Constants
   */
  public readonly ANSI_RESET = '\x1b[0m';
  public readonly ANSI_DIM = '\x1b[2m';
  public readonly ANSI_ITALIC = '\x1b[3m';
  public readonly ANSI_BOLD = '\x1b[1m';
  public readonly ANSI_INVERSE = '\x1b[7m';

  /**
   * Regex to match terminal cursor control sequences
   */
  /* eslint-disable no-control-regex */
  private readonly CURSOR_CONTROL_RE =
    /\x1b\[(?:\?[\d;]*[hl]|[\d;]*[A-LN-Za-ln-z])/g;
  /* eslint-enable no-control-regex */

  /**
   * Convert hex color to ANSI foreground sequence (TrueColor)
   * @param hex Hex color (e.g., #ff0000)
   */
  public hexToAnsi(hex: string): string {
    const { r, g, b } = this.hexToRgb(hex);
    return `\x1b[38;2;${r};${g};${b}m`;
  }

  /**
   * Convert hex color to ANSI background sequence (TrueColor)
   * @param hex Hex color (e.g., #ff0000)
   */
  public hexToAnsiBg(hex: string): string {
    const { r, g, b } = this.hexToRgb(hex);
    return `\x1b[48;2;${r};${g};${b}m`;
  }

  /**
   * Get the ANSI escape sequence for a set of styles
   */
  public getStyleAnsi(styles: {
    color?: string;
    bg?: string;
    bold?: boolean;
    italic?: boolean;
    dim?: boolean;
    inverse?: boolean;
  }): string {
    let ansi = '';
    if (styles.color) ansi += this.hexToAnsi(styles.color);
    if (styles.bg) ansi += this.hexToAnsiBg(styles.bg);
    if (styles.bold) ansi += this.ANSI_BOLD;
    if (styles.italic) ansi += this.ANSI_ITALIC;
    if (styles.dim) ansi += this.ANSI_DIM;
    if (styles.inverse) ansi += this.ANSI_INVERSE;
    return ansi;
  }

  /**
   * Strip terminal cursor control sequences from a string
   */
  public stripCursorSequences(text: string): string {
    if (!text) return text;
    return text.replace(this.CURSOR_CONTROL_RE, '');
  }

  /**
   * Strips ANSI escape codes from a string.
   */
  public cleanAnsi(text: string): string {
    if (typeof text !== 'string') return text;
    return stripAnsi(text);
  }

  /**
   * Strips Sigma task markers (<!-- sigma-task: ... -->) from a string.
   */
  public stripSigmaMarkers(text: string): string {
    if (typeof text !== 'string') return text;
    let result = text.replace(
      /(\r?\n|^)\s*<!-- sigma-task: [^>]+ -->\s*(?:\r?\n|$)/g,
      (_, prefix) => (prefix ? '\n' : '')
    );
    result = result.replace(/\s*<!-- sigma-task: [^>]+ -->\s*/g, (match) => {
      return match.startsWith(' ') && match.endsWith(' ') ? ' ' : '';
    });

    if (result.trim().length === 0) return '';
    return result.trimEnd();
  }

  /**
   * Simple Markdown to ANSI renderer
   */
  public renderMarkdown(content: string): string {
    const lines = content.split('\n');
    const output: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('# ')) {
        output.push('');
        output.push(chalk.bold.cyan(line.slice(2)));
        output.push('');
      } else if (line.startsWith('## ')) {
        output.push('');
        output.push(chalk.bold.yellow(line.slice(3)));
        output.push('');
      } else if (line.startsWith('### ')) {
        output.push('');
        output.push(chalk.bold(line.slice(4)));
      } else if (line.startsWith('```')) {
        i++;
        const codeLines: string[] = [];
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(chalk.gray(lines[i]));
          i++;
        }
        output.push('');
        output.push(codeLines.join('\n'));
        output.push('');
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        output.push(chalk.cyan('  •') + line.slice(1));
      } else if (line.match(/^\d+\./)) {
        output.push(chalk.cyan(line));
      } else if (line.trim() === '') {
        output.push('');
      } else if (line.startsWith('>')) {
        output.push(chalk.italic.gray(line.slice(1).trim()));
      } else {
        let formatted = line;
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, (_, text) =>
          chalk.bold(text)
        );
        formatted = formatted.replace(/__(.*?)__/g, (_, text) =>
          chalk.bold(text)
        );
        formatted = formatted.replace(/\*(.*?)\*/g, (_, text) =>
          chalk.italic(text)
        );
        formatted = formatted.replace(/_(.*?)_/g, (_, text) =>
          chalk.italic(text)
        );
        formatted = formatted.replace(/`([^`]+)`/g, (_, code) =>
          chalk.cyan(code)
        );
        output.push(formatted);
      }
    }
    return output.join('\n');
  }

  /**
   * Helper to parse hex to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      return {
        r: parseInt(cleanHex[0] + cleanHex[0], 16) || 0,
        g: parseInt(cleanHex[1] + cleanHex[1], 16) || 0,
        b: parseInt(cleanHex[2] + cleanHex[2], 16) || 0,
      };
    }
    return {
      r: parseInt(cleanHex.substring(0, 2), 16) || 0,
      g: parseInt(cleanHex.substring(2, 4), 16) || 0,
      b: parseInt(cleanHex.substring(4, 6), 16) || 0,
    };
  }
}

export const terminalFormatter = TerminalFormatterService.getInstance();
