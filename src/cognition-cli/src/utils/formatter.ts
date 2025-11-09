import chalk from 'chalk';

/**
 * Shared formatter utilities for consistent, colorful CLI output
 */

// Color schemes for different overlay types
const OVERLAY_COLORS: Record<string, (text: string) => string> = {
  O1: chalk.blue,
  O2: chalk.red,
  O3: chalk.yellow,
  O4: chalk.magenta,
  O5: chalk.cyan,
  O6: chalk.green,
  O7: chalk.white,
};

// Severity colors
const SEVERITY_COLORS: Record<string, (text: string) => string> = {
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.blue,
  info: chalk.gray,
};

/**
 * Truncate hash to first 8 characters
 */
export function truncateHash(hash: string): string {
  return hash.substring(0, 8);
}

/**
 * Extract overlay type from ID (e.g., "[O2]" from the ID string)
 */
export function extractOverlayType(id: string): string | null {
  const match = id.match(/\[([O]\d+)\]/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Color code an overlay type badge
 */
export function colorOverlayBadge(type: string): string {
  const colorFn = OVERLAY_COLORS[type] || chalk.white;
  return colorFn(`[${type}]`);
}

/**
 * Color code a severity level
 */
export function colorSeverity(severity: string): string {
  const colorFn = SEVERITY_COLORS[severity.toLowerCase()] || chalk.white;
  return colorFn(severity);
}

/**
 * Color code a similarity score (percentage)
 */
export function colorSimilarity(similarity: number): string {
  const percent = similarity * 100;
  if (percent >= 80) return chalk.green.bold(`${percent.toFixed(1)}%`);
  if (percent >= 60) return chalk.yellow(`${percent.toFixed(1)}%`);
  if (percent >= 40) return chalk.yellow.dim(`${percent.toFixed(1)}%`);
  return chalk.red.dim(`${percent.toFixed(1)}%`);
}

/**
 * Clean text - remove repeated sentences and ASCII art artifacts
 * (no truncation, just cleanup)
 */
export function cleanText(text: string): string {
  let cleaned = text;

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
 * (use cleanText instead if you don't need truncation)
 */
export function smartTruncate(text: string, maxLength: number): string {
  const cleaned = cleanText(text);
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
 */
export function formatId(id: string): string {
  const parts = id.split(':');
  const hash = truncateHash(parts[0]);
  const overlayType = extractOverlayType(id);

  if (overlayType) {
    return `${chalk.dim(hash)} ${colorOverlayBadge(overlayType)}`;
  }

  return chalk.dim(hash);
}

/**
 * Wrap a long line into multiple lines at word boundaries
 */
function wrapLine(line: string, maxWidth: number): string[] {
  const stripped = stripAnsi(line);
  if (stripped.length <= maxWidth) {
    return [line];
  }

  const words = line.split(' ');
  const wrappedLines: string[] = [];
  let currentLine = '';
  let currentStripped = '';

  for (const word of words) {
    const wordStripped = stripAnsi(word);
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
 */
export function createBox(content: string[], title?: string): string {
  const maxBoxWidth = 80;
  const maxContentWidth = maxBoxWidth - 4; // Account for "│ " and " │"

  // Wrap content lines that are too long
  const wrappedContent: string[] = [];
  for (const line of content) {
    const wrapped = wrapLine(line, maxContentWidth);
    wrappedContent.push(...wrapped);
  }

  const maxWidth = Math.max(
    ...wrappedContent.map((line) => stripAnsi(line).length),
    title ? stripAnsi(title).length + 4 : 0
  );
  const width = Math.min(maxWidth + 4, maxBoxWidth);

  const top = title
    ? `┌─ ${chalk.bold(title)} ${'─'.repeat(Math.max(0, width - stripAnsi(title).length - 5))}┐`
    : `┌${'─'.repeat(width - 2)}┐`;
  const bottom = `└${'─'.repeat(width - 2)}┘`;

  const lines = wrappedContent.map((line) => {
    const stripped = stripAnsi(line);
    const padding = ' '.repeat(Math.max(0, width - stripped.length - 4));
    return `│ ${line}${padding} │`;
  });

  return [top, ...lines, bottom].join('\n');
}

/**
 * Create a simple separator line
 */
export function separator(char: string = '─', length: number = 60): string {
  return chalk.dim(char.repeat(length));
}

/**
 * Strip ANSI color codes for length calculation
 */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

/**
 * Format a key-value pair with aligned colons
 */
export function formatKeyValue(
  key: string,
  value: string,
  keyWidth: number = 12
): string {
  const paddedKey = key.padEnd(keyWidth);
  return `${chalk.dim(paddedKey)}: ${value}`;
}

/**
 * Create a table header
 */
export function tableHeader(columns: string[]): string {
  return chalk.bold(columns.join('  │  '));
}

/**
 * Create a table row
 */
export function tableRow(values: string[]): string {
  return values.join('  │  ');
}
