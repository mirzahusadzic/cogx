/**
 * Formatter Tests
 *
 * Tests for CLI output formatting utilities including:
 * - Overlay badge coloring
 * - Severity level formatting
 * - Similarity score coloring
 * - Text cleaning and truncation
 * - Box and table formatting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock terminal-capabilities before importing formatter
vi.mock('../terminal-capabilities.js', () => ({
  useColor: vi.fn().mockReturnValue(true),
  getBoxChars: vi.fn().mockReturnValue({
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
  }),
  isPlainMode: vi.fn().mockReturnValue(false),
}));

import {
  truncateHash,
  extractOverlayType,
  colorOverlayBadge,
  colorSeverity,
  colorSimilarity,
  cleanText,
  smartTruncate,
  formatId,
  createBox,
  separator,
  formatKeyValue,
  tableHeader,
  tableRow,
} from '../formatter.js';
import { isPlainMode } from '../terminal-capabilities.js';

describe('Hash and ID Formatting', () => {
  describe('truncateHash()', () => {
    it('should truncate hash to 8 characters', () => {
      const hash =
        'abc123def456789012345678901234567890123456789012345678901234';
      expect(truncateHash(hash)).toBe('abc123de');
    });

    it('should return full hash if less than 8 chars', () => {
      expect(truncateHash('abc')).toBe('abc');
    });

    it('should return exactly 8 chars for 8-char input', () => {
      expect(truncateHash('12345678')).toBe('12345678');
    });

    it('should handle empty string', () => {
      expect(truncateHash('')).toBe('');
    });
  });

  describe('extractOverlayType()', () => {
    it('should extract overlay type from ID', () => {
      expect(extractOverlayType('abc123:[O2]:auth.login')).toBe('O2');
    });

    it('should handle lowercase overlay type', () => {
      expect(extractOverlayType('def456:[o4]:principle.trust')).toBe('O4');
    });

    it('should return null for ID without overlay', () => {
      expect(extractOverlayType('xyz789:no-overlay')).toBeNull();
    });

    it('should extract all valid overlay types O1-O7', () => {
      expect(extractOverlayType('hash:[O1]:path')).toBe('O1');
      expect(extractOverlayType('hash:[O2]:path')).toBe('O2');
      expect(extractOverlayType('hash:[O3]:path')).toBe('O3');
      expect(extractOverlayType('hash:[O4]:path')).toBe('O4');
      expect(extractOverlayType('hash:[O5]:path')).toBe('O5');
      expect(extractOverlayType('hash:[O6]:path')).toBe('O6');
      expect(extractOverlayType('hash:[O7]:path')).toBe('O7');
    });

    it('should return null for invalid overlay format', () => {
      expect(extractOverlayType('hash:[X2]:path')).toBeNull();
      expect(extractOverlayType('hash:O2:path')).toBeNull();
      expect(extractOverlayType('hash:[O]:path')).toBeNull();
    });

    it('should handle empty string', () => {
      expect(extractOverlayType('')).toBeNull();
    });
  });

  describe('formatId()', () => {
    it('should format ID with overlay type', () => {
      const result = formatId('abc123def:[O2]:auth.login');
      // Should contain truncated hash and overlay badge
      expect(result).toContain('[O2]');
    });

    it('should format ID without overlay type', () => {
      const result = formatId('xyz789abc:no-overlay');
      // Should not contain overlay badge (e.g., [O2])
      expect(result).not.toContain('[O');
    });

    it('should handle simple hash', () => {
      const result = formatId('abc123def456');
      expect(result).toBeDefined();
    });
  });
});

describe('Overlay Badge Coloring', () => {
  describe('colorOverlayBadge()', () => {
    it('should format overlay type as badge', () => {
      const badge = colorOverlayBadge('O2');
      expect(badge).toContain('[O2]');
    });

    it('should handle all overlay types', () => {
      for (let i = 1; i <= 7; i++) {
        const badge = colorOverlayBadge(`O${i}`);
        expect(badge).toContain(`[O${i}]`);
      }
    });

    it('should handle unknown overlay type gracefully', () => {
      const badge = colorOverlayBadge('O99');
      expect(badge).toContain('[O99]');
    });
  });
});

describe('Severity Formatting', () => {
  describe('colorSeverity()', () => {
    it('should format critical severity', () => {
      const result = colorSeverity('critical');
      expect(result).toContain('critical');
    });

    it('should format high severity', () => {
      const result = colorSeverity('high');
      expect(result).toContain('high');
    });

    it('should format medium severity', () => {
      const result = colorSeverity('medium');
      expect(result).toContain('medium');
    });

    it('should format low severity', () => {
      const result = colorSeverity('low');
      expect(result).toContain('low');
    });

    it('should format info severity', () => {
      const result = colorSeverity('info');
      expect(result).toContain('info');
    });

    it('should handle uppercase severity', () => {
      const result = colorSeverity('HIGH');
      expect(result).toContain('HIGH');
    });

    it('should handle unknown severity gracefully', () => {
      const result = colorSeverity('unknown');
      expect(result).toContain('unknown');
    });
  });
});

describe('Similarity Score Formatting', () => {
  describe('colorSimilarity()', () => {
    it('should format high similarity (>=80%)', () => {
      const result = colorSimilarity(0.87);
      expect(result).toContain('87.0%');
    });

    it('should format medium-high similarity (60-79%)', () => {
      const result = colorSimilarity(0.65);
      expect(result).toContain('65.0%');
    });

    it('should format medium-low similarity (40-59%)', () => {
      const result = colorSimilarity(0.42);
      expect(result).toContain('42.0%');
    });

    it('should format low similarity (<40%)', () => {
      const result = colorSimilarity(0.15);
      expect(result).toContain('15.0%');
    });

    it('should handle boundary values', () => {
      expect(colorSimilarity(0.8)).toContain('80.0%');
      expect(colorSimilarity(0.6)).toContain('60.0%');
      expect(colorSimilarity(0.4)).toContain('40.0%');
    });

    it('should handle 0 and 1', () => {
      expect(colorSimilarity(0)).toContain('0.0%');
      expect(colorSimilarity(1)).toContain('100.0%');
    });
  });
});

describe('Text Cleaning', () => {
  describe('cleanText()', () => {
    it('should return simple text unchanged', () => {
      expect(cleanText('Hello world')).toBe('Hello world');
    });

    it('should remove duplicate sentences', () => {
      const text = 'Hello world. Hello world. Goodbye.';
      const result = cleanText(text);
      // Should deduplicate, ending format may vary
      expect(result).toContain('Hello world');
      expect(result).toContain('Goodbye');
      // Should be shorter than original
      expect(result.length).toBeLessThanOrEqual(text.length);
    });

    it('should handle JSON lineage format', () => {
      const json = JSON.stringify({
        symbol: 'auth.login',
        lineage: [
          { type: 'user', relationship: 'depends on' },
          { type: 'db', relationship: 'calls' },
        ],
      });
      const result = cleanText(json);
      expect(result).toContain('auth.login');
      expect(result).toContain('→');
    });

    it('should handle JSON with empty lineage', () => {
      const json = JSON.stringify({
        symbol: 'standalone.module',
        lineage: [],
      });
      const result = cleanText(json);
      expect(result).toContain('standalone.module');
      expect(result).toContain('no dependencies');
    });

    it('should strip ASCII art and keep text before', () => {
      const text = 'Data before ┌──────┐\n│ Box │\n└──────┘';
      const result = cleanText(text);
      expect(result).toContain('Data before');
      expect(result).toContain('[...]');
    });

    it('should return [ASCII diagram] for ASCII art only', () => {
      const text = '┌──────┐\n│ Box │\n└──────┘';
      const result = cleanText(text);
      expect(result).toBe('[ASCII diagram]');
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = '{ invalid json }';
      const result = cleanText(invalidJson);
      expect(result).toBe(invalidJson);
    });

    it('should handle JSON arrays', () => {
      const json = '[1, 2, 3]';
      const result = cleanText(json);
      expect(result).toBe('[1,2,3]');
    });
  });

  describe('smartTruncate()', () => {
    it('should not truncate short text', () => {
      expect(smartTruncate('Short', 100)).toBe('Short');
    });

    it('should truncate at word boundary', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const result = smartTruncate(text, 20);
      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(23); // 20 + '...'
    });

    it('should truncate mid-word if no good boundary', () => {
      const text = 'Supercalifragilisticexpialidocious';
      const result = smartTruncate(text, 10);
      expect(result).toContain('...');
    });

    it('should clean text before truncating', () => {
      const text = 'This is unique. This is unique. Also unique.';
      const result = smartTruncate(text, 100);
      // Should contain the cleaned text
      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('should handle maxLength of 0', () => {
      const result = smartTruncate('Any text', 0);
      expect(result).toBe('...');
    });
  });
});

describe('Box and Table Formatting', () => {
  describe('createBox()', () => {
    it('should create box with content', () => {
      const box = createBox(['Line 1', 'Line 2']);
      expect(box).toContain('┌');
      expect(box).toContain('┐');
      expect(box).toContain('└');
      expect(box).toContain('┘');
      expect(box).toContain('Line 1');
      expect(box).toContain('Line 2');
    });

    it('should include title when provided', () => {
      const box = createBox(['Content'], 'Title');
      expect(box).toContain('Title');
      expect(box).toContain('Content');
    });

    it('should handle empty content array', () => {
      const box = createBox([]);
      expect(box).toContain('┌');
      expect(box).toContain('└');
    });

    it('should wrap long lines', () => {
      const longLine = 'A'.repeat(100);
      const box = createBox([longLine]);
      // Should have at least top, content, and bottom lines
      const lines = box.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(3); // top, content line(s), bottom
      // Content should be truncated if it exceeded max width
      expect(box).toContain('A');
    });
  });

  describe('createBox() in plain mode', () => {
    beforeEach(() => {
      (isPlainMode as ReturnType<typeof vi.fn>).mockReturnValue(true);
    });

    afterEach(() => {
      (isPlainMode as ReturnType<typeof vi.fn>).mockReturnValue(false);
    });

    it('should use simple text format in plain mode', async () => {
      // Re-import to pick up mock change
      vi.resetModules();
      vi.doMock('../terminal-capabilities.js', () => ({
        useColor: vi.fn().mockReturnValue(false),
        getBoxChars: vi.fn().mockReturnValue({
          topLeft: '+',
          topRight: '+',
          bottomLeft: '+',
          bottomRight: '+',
          horizontal: '-',
          vertical: '|',
        }),
        isPlainMode: vi.fn().mockReturnValue(true),
      }));

      const { createBox: plainCreateBox } = await import('../formatter.js');
      const box = plainCreateBox(['Content'], 'Title');
      expect(box).toContain('=== Title ===');
      expect(box).toContain('Content');
    });
  });

  describe('separator()', () => {
    it('should create default separator', () => {
      const sep = separator();
      expect(sep.length).toBeGreaterThan(0);
    });

    it('should respect custom character', () => {
      const sep = separator('=', 40);
      // The separator will be dimmed via chalk
      expect(sep).toBeDefined();
    });

    it('should respect custom length', () => {
      const sep = separator('-', 20);
      expect(sep).toBeDefined();
    });
  });

  describe('formatKeyValue()', () => {
    it('should format key-value pair', () => {
      const result = formatKeyValue('Type', 'attack_vector');
      expect(result).toContain('Type');
      expect(result).toContain(':');
      expect(result).toContain('attack_vector');
    });

    it('should pad key to default width', () => {
      const result = formatKeyValue('ID', 'value');
      // Key should be padded (default 12 chars)
      expect(result).toContain('ID');
    });

    it('should respect custom key width', () => {
      const result = formatKeyValue('Key', 'value', 20);
      expect(result).toContain('Key');
    });
  });

  describe('tableHeader()', () => {
    it('should create header with columns', () => {
      const header = tableHeader(['ID', 'Type', 'Severity']);
      expect(header).toContain('ID');
      expect(header).toContain('Type');
      expect(header).toContain('Severity');
    });

    it('should separate columns with vertical bar', () => {
      const header = tableHeader(['Col1', 'Col2']);
      expect(header).toContain('│');
    });

    it('should handle single column', () => {
      const header = tableHeader(['Single']);
      expect(header).toContain('Single');
    });

    it('should handle empty columns array', () => {
      const header = tableHeader([]);
      expect(header).toBe('');
    });
  });

  describe('tableRow()', () => {
    it('should create row with values', () => {
      const row = tableRow(['abc123', 'threat_model', 'critical']);
      expect(row).toContain('abc123');
      expect(row).toContain('threat_model');
      expect(row).toContain('critical');
    });

    it('should separate values with vertical bar', () => {
      const row = tableRow(['a', 'b']);
      expect(row).toContain('│');
    });

    it('should handle single value', () => {
      const row = tableRow(['Single']);
      expect(row).toBe('Single');
    });

    it('should handle empty values array', () => {
      const row = tableRow([]);
      expect(row).toBe('');
    });
  });
});

describe('No Color Mode', () => {
  it('should handle text with or without ANSI codes', () => {
    // The formatting functions should always return strings containing the text
    // regardless of color mode - we're testing the module with colors enabled
    const badge = colorOverlayBadge('O2');
    const severity = colorSeverity('critical');
    const similarity = colorSimilarity(0.87);

    // Should contain the expected text content
    expect(badge).toContain('[O2]');
    expect(severity).toContain('critical');
    expect(similarity).toContain('87.0%');

    // Results should be non-empty strings
    expect(typeof badge).toBe('string');
    expect(typeof severity).toBe('string');
    expect(typeof similarity).toBe('string');
  });
});

describe('Edge Cases', () => {
  it('should handle unicode characters in text', () => {
    const text = 'Hello 世界 🌍';
    const result = cleanText(text);
    expect(result).toBe(text);
  });

  it('should handle newlines in text', () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const result = cleanText(text);
    expect(result).toContain('Line 1');
  });

  it('should handle very long single word', () => {
    const longWord = 'a'.repeat(200);
    const result = smartTruncate(longWord, 50);
    expect(result.length).toBeLessThan(60);
    expect(result).toContain('...');
  });

  it('should handle special regex characters in text', () => {
    const text = 'Test [with] (special) {chars} $and^ *regex*.';
    const result = cleanText(text);
    expect(result).toContain('Test');
  });
});
