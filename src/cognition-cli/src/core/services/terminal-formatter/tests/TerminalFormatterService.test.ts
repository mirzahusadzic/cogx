import { TerminalFormatterService } from '../TerminalFormatterService.js';
import { describe, it, expect } from 'vitest';

describe('TerminalFormatterService', () => {
  const formatter = TerminalFormatterService.getInstance();

  describe('hexToAnsi', () => {
    it('converts hex to ANSI foreground sequence', () => {
      expect(formatter.hexToAnsi('#ff0000')).toBe('\x1b[38;2;255;0;0m');
      expect(formatter.hexToAnsi('#00ff00')).toBe('\x1b[38;2;0;255;0m');
      expect(formatter.hexToAnsi('#0000ff')).toBe('\x1b[38;2;0;0;255m');
      expect(formatter.hexToAnsi('ffffff')).toBe('\x1b[38;2;255;255;255m');
      expect(formatter.hexToAnsi('000')).toBe('\x1b[38;2;0;0;0m');
    });
  });

  describe('hexToAnsiBg', () => {
    it('converts hex to ANSI background sequence', () => {
      expect(formatter.hexToAnsiBg('#ff0000')).toBe('\x1b[48;2;255;0;0m');
    });
  });

  describe('stripCursorSequences', () => {
    it('removes cursor control sequences but preserves SGR', () => {
      const input = '\x1b[?25l\x1b[31mHello\x1b[0m\x1b[K';
      expect(formatter.stripCursorSequences(input)).toBe(
        '\x1b[31mHello\x1b[0m'
      );
    });
  });

  describe('stripSigmaMarkers', () => {
    it('removes sigma task markers', () => {
      const input = 'Hello\n<!-- sigma-task: task-1 -->\nWorld';
      expect(formatter.stripSigmaMarkers(input)).toBe('Hello\nWorld');
    });

    it('removes markers from end of string', () => {
      const input = 'Final output<!-- sigma-task: task-1 -->';
      expect(formatter.stripSigmaMarkers(input)).toBe('Final output');
    });
  });

  describe('cleanAnsi', () => {
    it('removes all ANSI escape codes', () => {
      const input = '\x1b[31mRed\x1b[0m \x1b[1mBold\x1b[0m';
      expect(formatter.cleanAnsi(input)).toBe('Red Bold');
    });
  });

  describe('renderMarkdown', () => {
    it('renders headers', () => {
      const input = '# Header 1';
      const output = formatter.renderMarkdown(input);
      expect(output).toContain('Header 1');
    });

    it('renders bold and italic text', () => {
      const input = 'This is **bold** and *italic*.';
      const output = formatter.renderMarkdown(input);
      expect(output).toContain('bold');
      expect(output).toContain('italic');
    });
  });
});
