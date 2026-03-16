/**
 * TerminalFormatterService Tests
 *
 * Tests for CLI output formatting utilities including:
 * - Overlay badge coloring
 * - Severity level formatting
 * - Similarity score coloring
 * - Text cleaning and truncation
 * - Box and table formatting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import chalk from 'chalk';
import { terminalFormatter } from '../TerminalFormatterService.js';

// Mock environment service
vi.mock('../../environment/EnvironmentService.js', () => ({
  environmentService: {
    getEnv: vi.fn().mockReturnValue(undefined),
    isCI: vi.fn().mockReturnValue(false),
    isMac: vi.fn().mockReturnValue(true),
  },
}));

describe('TerminalFormatterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Force colors on for tests
    chalk.level = 3;
    vi.spyOn(terminalFormatter, 'useColor').mockReturnValue(true);
    vi.spyOn(terminalFormatter, 'useEmoji').mockReturnValue(true);
    vi.spyOn(terminalFormatter, 'useBoxDrawing').mockReturnValue(true);
  });

  describe('Hash and ID Formatting', () => {
    describe('truncateHash()', () => {
      it('should truncate hash to 8 characters', () => {
        const hash =
          'abc123def456789012345678901234567890123456789012345678901234';
        expect(terminalFormatter.truncateHash(hash)).toBe('abc123de');
      });

      it('should return full hash if less than 8 chars', () => {
        expect(terminalFormatter.truncateHash('abc')).toBe('abc');
      });

      it('should return exactly 8 chars for 8-char input', () => {
        expect(terminalFormatter.truncateHash('12345678')).toBe('12345678');
      });

      it('should handle empty string', () => {
        expect(terminalFormatter.truncateHash('')).toBe('');
      });
    });

    describe('extractOverlayType()', () => {
      it('should extract overlay type from ID', () => {
        expect(
          terminalFormatter.extractOverlayType('abc123:[O2]:auth.login')
        ).toBe('O2');
      });

      it('should handle lowercase overlay type', () => {
        expect(
          terminalFormatter.extractOverlayType('def456:[o4]:principle.trust')
        ).toBe('O4');
      });

      it('should return null for ID without overlay', () => {
        expect(
          terminalFormatter.extractOverlayType('xyz789:no-overlay')
        ).toBeNull();
      });

      it('should extract all valid overlay types O1-O7', () => {
        expect(terminalFormatter.extractOverlayType('hash:[O1]:path')).toBe(
          'O1'
        );
        expect(terminalFormatter.extractOverlayType('hash:[O2]:path')).toBe(
          'O2'
        );
        expect(terminalFormatter.extractOverlayType('hash:[O3]:path')).toBe(
          'O3'
        );
        expect(terminalFormatter.extractOverlayType('hash:[O4]:path')).toBe(
          'O4'
        );
        expect(terminalFormatter.extractOverlayType('hash:[O5]:path')).toBe(
          'O5'
        );
        expect(terminalFormatter.extractOverlayType('hash:[O6]:path')).toBe(
          'O6'
        );
        expect(terminalFormatter.extractOverlayType('hash:[O7]:path')).toBe(
          'O7'
        );
      });
    });

    describe('formatId()', () => {
      it('should format ID with dimmed hash and colored badge', () => {
        const id = 'abc123def:[O2]:auth.login';
        const formatted = terminalFormatter.formatId(id);
        expect(formatted).toContain('abc123de');
        expect(formatted).toContain('[O2]');
      });

      it('should format ID with only dimmed hash when no overlay', () => {
        const id = 'abc123def:no-overlay';
        const formatted = terminalFormatter.formatId(id);
        expect(formatted).toContain('\u001b[2m');
        expect(formatted).toContain('abc123de');
      });
    });
  });

  describe('Text Cleaning and Truncation', () => {
    describe('cleanText()', () => {
      it('should format JSON lineage correctly', () => {
        const json = JSON.stringify({
          symbol: 'auth.login',
          lineage: [
            { type: 'user', relationship: 'depends on' },
            { type: 'db', relationship: 'calls' },
          ],
        });
        expect(terminalFormatter.cleanText(json)).toBe(
          'auth.login → depends on user, calls db'
        );
      });

      it('should handle JSON with no lineage', () => {
        const json = JSON.stringify({ symbol: 'test', lineage: [] });
        expect(terminalFormatter.cleanText(json)).toBe(
          'test (no dependencies)'
        );
      });

      it('should remove duplicate sentences', () => {
        const text = 'Hello world. Hello world. Goodbye.';
        expect(terminalFormatter.cleanText(text)).toBe('Hello world. Goodbye.');
      });

      it('should strip ASCII art boxes', () => {
        const text = 'Data before ┌──────┐\n│ Box │\n└──────┘';
        expect(terminalFormatter.cleanText(text)).toBe('Data before [...]');
      });
    });

    describe('smartTruncate()', () => {
      it('should truncate at word boundary', () => {
        const text = 'The quick brown fox jumps over the lazy dog';
        expect(terminalFormatter.smartTruncate(text, 20)).toBe(
          'The quick brown fox...'
        );
      });

      it('should not truncate if shorter than maxLength', () => {
        const text = 'Short text';
        expect(terminalFormatter.smartTruncate(text, 100)).toBe('Short text');
      });
    });
  });

  describe('Box and Table Formatting', () => {
    describe('createBox()', () => {
      it('should create a box with content', () => {
        const box = terminalFormatter.createBox(['Line 1', 'Line 2']);
        expect(box).toContain('┌');
        expect(box).toContain('┐');
        expect(box).toContain('Line 1');
        expect(box).toContain('Line 2');
        expect(box).toContain('└');
        expect(box).toContain('┘');
      });

      it('should include title in box', () => {
        const box = terminalFormatter.createBox(['Content'], 'Title');
        expect(box).toContain('Title');
      });
    });

    describe('tableHeader()', () => {
      it('should format headers with separators', () => {
        const header = terminalFormatter.tableHeader(['ID', 'Type']);
        expect(header).toContain('ID');
        expect(header).toContain('│');
        expect(header).toContain('Type');
      });
    });

    describe('tableRow()', () => {
      it('should format values with separators', () => {
        const row = terminalFormatter.tableRow(['val1', 'val2']);
        expect(row).toContain('val1');
        expect(row).toContain('│');
        expect(row).toContain('val2');
      });
    });
  });
});
