import chalk from 'chalk';
import stripAnsi from 'strip-ansi';

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
