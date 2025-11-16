/**
 * CLI Output Formatting Utilities
 *
 * Provides consistent, colorful formatting for CLI output including:
 * - Overlay type badges with color coding
 * - Severity level formatting (critical/high/medium/low)
 * - Similarity scores with visual feedback
 * - Text cleaning and truncation
 * - Box drawing and table formatting
 *
 * DESIGN:
 * Uses chalk for ANSI color codes. Color schemes are centralized
 * for consistency across all commands. Formatters are pure functions
 * that take data and return styled strings.
 *
 * COLOR SCHEME:
 * - O₁ (Structural): Blue
 * - O₂ (Security): Red
 * - O₃ (Lineage): Yellow
 * - O₄ (Mission): Magenta
 * - O₅ (Operational): Cyan
 * - O₆ (Mathematical): Green
 * - O₇ (Strategic Coherence): White
 *
 * DESIGN RATIONALE:
 * - stripAnsi is used for accurate width calculations when wrapping
 * - cleanText removes artifacts (ASCII art, repeated sentences) before display
 * - smartTruncate preserves word boundaries for readability
 * - Box formatting auto-wraps long lines to 80 chars max
 *
 * @example
 * // Format an overlay badge
 * const badge = colorOverlayBadge('O2'); // "[O2]" in red
 *
 * // Format a similarity score
 * const score = colorSimilarity(0.87); // "87.0%" in green
 *
 * // Create a formatted box
 * const box = createBox([
 *   formatKeyValue('Type', 'attack_vector'),
 *   formatKeyValue('Severity', colorSeverity('critical'))
 * ], 'Security Alert');
 *
 * @example
 * // Table formatting
 * console.log(tableHeader(['ID', 'Type', 'Severity']));
 * console.log(separator());
 * console.log(tableRow([
 *   formatId('abc123...[O2]'),
 *   'threat_model',
 *   colorSeverity('high')
 * ]));
 */

import chalk from 'chalk';
import { useColor, emoji as emojiHelper, getBoxChars, isPlainMode } from './terminal-capabilities.js';

// ========================================
// CONDITIONAL CHALK (Accessibility-Aware)
// ========================================

/**
 * Create chalk-like object that respects accessibility settings
 * Returns identity functions when colors are disabled
 */
function createConditionalChalk() {
  if (useColor()) {
    return chalk;
  }
  // No-op functions when colors disabled
  const identity = (s: string) => s;
  const noop: any = new Proxy({}, {
    get: () => noop,
    apply: (_target: any, _thisArg: any, args: any[]) => args[0] || ''
  });
  return noop;
}

/** Conditional chalk instance - respects --no-color flag */
const c = createConditionalChalk();

// ========================================
// COLOR SCHEMES
// ========================================

/**
 * Color schemes for different overlay types
 * Maps overlay identifier (O1-O7) to chalk color function
 * Automatically respects --no-color flag via conditional chalk
 */
const OVERLAY_COLORS: Record<string, (text: string) => string> = {
  O1: c.blue, // Structural
  O2: c.red, // Security
  O3: c.yellow, // Lineage
  O4: c.magenta, // Mission
  O5: c.cyan, // Operational
  O6: c.green, // Mathematical
  O7: c.white, // Strategic Coherence
};

/**
 * Color schemes for severity levels
 * Maps severity string to chalk color function
 * Automatically respects --no-color flag via conditional chalk
 */
const SEVERITY_COLORS: Record<string, (text: string) => string> = {
  critical: c.red.bold,
  high: c.red,
  medium: c.yellow,
  low: c.blue,
  info: c.gray,
};

// ========================================
// HASH AND ID FORMATTING
// ========================================

/**
 * Truncate hash to first 8 characters
 *
 * Makes hashes readable in table output while maintaining
 * enough entropy for human disambiguation.
 *
 * @param hash - Full SHA-256 hash (64 chars)
 * @returns First 8 characters of hash
 *
 * @example
 * truncateHash('abc123def456...') // 'abc123de'
 */
export function truncateHash(hash: string): string {
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
 *
 * @example
 * extractOverlayType('abc123:[O2]:auth.handleLogin') // 'O2'
 * extractOverlayType('def456:[o4]:principle.trust')  // 'O4'
 * extractOverlayType('xyz789:no-overlay')            // null
 */
export function extractOverlayType(id: string): string | null {
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
 *
 * @example
 * colorOverlayBadge('O2') // "[O2]" in red
 * colorOverlayBadge('O4') // "[O4]" in magenta
 */
export function colorOverlayBadge(type: string): string {
  const colorFn = OVERLAY_COLORS[type] || chalk.white;
  return colorFn(`[${type}]`);
}

// ========================================
// SEVERITY AND SCORE FORMATTING
// ========================================

/**
 * Color code a severity level
 *
 * Applies consistent color coding to severity strings.
 * Case-insensitive matching against SEVERITY_COLORS.
 *
 * @param severity - Severity level (critical|high|medium|low|info)
 * @returns Colored severity string
 *
 * @example
 * colorSeverity('critical') // "critical" in red bold
 * colorSeverity('HIGH')     // "HIGH" in red
 * colorSeverity('medium')   // "medium" in yellow
 */
export function colorSeverity(severity: string): string {
  const colorFn = SEVERITY_COLORS[severity.toLowerCase()] || chalk.white;
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
 *
 * @example
 * colorSimilarity(0.87) // "87.0%" in green bold
 * colorSimilarity(0.65) // "65.0%" in yellow
 * colorSimilarity(0.42) // "42.0%" in yellow dim
 * colorSimilarity(0.15) // "15.0%" in red dim
 */
export function colorSimilarity(similarity: number): string {
  const percent = similarity * 100;
  if (percent >= 80) return chalk.green.bold(`${percent.toFixed(1)}%`);
  if (percent >= 60) return chalk.yellow(`${percent.toFixed(1)}%`);
  if (percent >= 40) return chalk.yellow.dim(`${percent.toFixed(1)}%`);
  return chalk.red.dim(`${percent.toFixed(1)}%`);
}

// ========================================
// TEXT CLEANING AND TRUNCATION
// ========================================

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
 * ALGORITHM:
 * - JSON Detection: Try parsing, format as "symbol → relationships"
 * - Deduplication: Split by sentence, filter duplicates
 * - ASCII Art: Detect box-drawing chars, extract text before
 *
 * @param text - Raw text to clean
 * @returns Cleaned text (no length limit)
 *
 * @example
 * // JSON lineage formatting
 * cleanText('{"symbol":"auth.login","lineage":[...]}')
 * // → "auth.login → depends on user, calls db"
 *
 * @example
 * // Duplicate sentence removal
 * cleanText('Hello world. Hello world. Goodbye.')
 * // → "Hello world. Goodbye."
 *
 * @example
 * // ASCII art stripping
 * cleanText('Data before ┌──────┐\n│ Box │\n└──────┘')
 * // → "Data before [...]"
 */
export function cleanText(text: string): string {
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
 * ALGORITHM:
 * 1. Clean text first (remove artifacts)
 * 2. If under limit, return as-is
 * 3. Find last space within 80% of maxLength
 * 4. Truncate at space boundary and append '...'
 *
 * Use cleanText() directly if you don't need length limit.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum character length
 * @returns Truncated text with '...' suffix if needed
 *
 * @example
 * smartTruncate('The quick brown fox jumps over the lazy dog', 20)
 * // → "The quick brown..."
 *
 * smartTruncate('Short', 100)
 * // → "Short" (no truncation)
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
 *
 * Formats PGC item IDs for table display:
 * - Truncates hash to 8 chars (dimmed)
 * - Extracts and color-codes overlay badge if present
 *
 * @param id - PGC item ID (format: "hash:[O2]:path")
 * @returns Formatted ID with colored overlay badge
 *
 * @example
 * formatId('abc123def:[O2]:auth.login')
 * // → "abc123de [O2]" (hash dimmed, O2 in red)
 *
 * formatId('xyz789abc:no-overlay')
 * // → "xyz789ab" (hash only, dimmed)
 */
export function formatId(id: string): string {
  const parts = id.split(':');
  const hash = truncateHash(parts[0]);
  const overlayType = extractOverlayType(id);

  if (overlayType) {
    return `${c.dim(hash)} ${colorOverlayBadge(overlayType)}`;
  }

  return c.dim(hash);
}

// ========================================
// BOX AND TABLE FORMATTING
// ========================================

/**
 * Wrap a long line into multiple lines at word boundaries
 *
 * Internal helper for createBox(). Wraps text to fit within maxWidth
 * while respecting ANSI color codes (uses stripAnsi for width calc).
 *
 * ALGORITHM:
 * 1. Strip ANSI codes to measure actual display width
 * 2. If under limit, return as-is
 * 3. Split into words, accumulate until width exceeded
 * 4. If single word exceeds limit, truncate with '...'
 *
 * @param line - Line to wrap (may contain ANSI codes)
 * @param maxWidth - Maximum display width
 * @returns Array of wrapped lines (preserving ANSI codes)
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
 *
 * Draws a Unicode box around content with optional title.
 * Auto-wraps long lines to 80 chars max. Handles ANSI colors correctly.
 *
 * DESIGN:
 * - Uses Unicode box-drawing characters (┌─┐│└┘)
 * - Title integrated into top border if provided
 * - Content auto-wrapped at 76 chars (80 - 4 for borders)
 * - Preserves ANSI color codes in content
 *
 * @param content - Array of content lines (may contain ANSI codes)
 * @param title - Optional title for top border
 * @returns Formatted box as multiline string
 *
 * @example
 * createBox([
 *   'Type: attack_vector',
 *   'Severity: critical'
 * ], 'Security Alert')
 * // ┌─ Security Alert ──────┐
 * // │ Type: attack_vector   │
 * // │ Severity: critical    │
 * // └───────────────────────┘
 *
 * @example
 * // Auto-wrapping
 * createBox([
 *   'This is a very long line that exceeds the maximum width and will be wrapped automatically'
 * ])
 * // ┌──────────────────────────────┐
 * // │ This is a very long line     │
 * // │ that exceeds the maximum...  │
 * // └──────────────────────────────┘
 */
export function createBox(content: string[], title?: string): string {
  // Plain mode: simple text without box
  if (isPlainMode()) {
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
  const chars = getBoxChars();

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
    ? `${chars.topLeft}${chars.horizontal} ${c.bold(title)} ${chars.horizontal.repeat(Math.max(0, width - stripAnsi(title).length - 5))}${chars.topRight}`
    : `${chars.topLeft}${chars.horizontal.repeat(width - 2)}${chars.topRight}`;
  const bottom = `${chars.bottomLeft}${chars.horizontal.repeat(width - 2)}${chars.bottomRight}`;

  const lines = wrappedContent.map((line) => {
    const stripped = stripAnsi(line);
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
 *
 * @example
 * separator() // ──────────... (60 chars, dimmed)
 * separator('=', 40) // ======== (40 chars, dimmed)
 */
export function separator(char: string = '─', length: number = 60): string {
  const chars = getBoxChars();
  const separatorChar = char === '─' ? chars.horizontal : char;
  return c.dim(separatorChar.repeat(length));
}

/**
 * Strip ANSI color codes for length calculation
 *
 * Internal utility for accurate width measurement when text
 * contains ANSI escape sequences. Essential for proper box
 * formatting and text wrapping.
 *
 * @param text - Text with ANSI codes
 * @returns Plain text without ANSI codes
 */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '');
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
 *
 * @example
 * formatKeyValue('Type', 'attack_vector')
 * // "Type        : attack_vector" (key dimmed)
 *
 * formatKeyValue('ID', formatId('abc123:[O2]'), 15)
 * // "ID             : abc123de [O2]" (15-char key width)
 */
export function formatKeyValue(
  key: string,
  value: string,
  keyWidth: number = 12
): string {
  const paddedKey = key.padEnd(keyWidth);
  return `${c.dim(paddedKey)}: ${value}`;
}

/**
 * Create a table header
 *
 * Formats column headers with bold text and vertical separators.
 * Used with tableRow() for consistent table formatting.
 *
 * @param columns - Array of column header strings
 * @returns Bold header with separators
 *
 * @example
 * tableHeader(['ID', 'Type', 'Severity'])
 * // "ID  │  Type  │  Severity" (bold)
 */
export function tableHeader(columns: string[]): string {
  const chars = getBoxChars();
  return c.bold(columns.join(`  ${chars.vertical}  `));
}

/**
 * Create a table row
 *
 * Formats row values with vertical separators matching tableHeader().
 * Values may contain ANSI codes for coloring.
 *
 * @param values - Array of cell values
 * @returns Row with separators
 *
 * @example
 * tableRow([
 *   formatId('abc123:[O2]'),
 *   'threat_model',
 *   colorSeverity('critical')
 * ])
 * // "abc123de [O2]  │  threat_model  │  critical"
 */
export function tableRow(values: string[]): string {
  const chars = getBoxChars();
  return values.join(`  ${chars.vertical}  `);
}
