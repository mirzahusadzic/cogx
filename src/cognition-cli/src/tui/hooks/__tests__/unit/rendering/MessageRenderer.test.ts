/**
 * Tests for MessageRenderer
 *
 * Week 2 Day 9-10: Extract Rendering Layer
 */

import { describe, it, expect } from 'vitest';
import {
  formatSystemMessage,
  formatUserMessage,
  formatAssistantMessage,
  formatToolProgressMessage,
} from '../../../rendering/MessageRenderer.js';

describe('MessageRenderer', () => {
  describe('formatSystemMessage()', () => {
    it('returns message unchanged', () => {
      const message = 'System notification';
      expect(formatSystemMessage(message)).toBe(message);
    });

    it('handles empty message', () => {
      expect(formatSystemMessage('')).toBe('');
    });
  });

  describe('formatUserMessage()', () => {
    it('returns message unchanged', () => {
      const message = 'User query';
      expect(formatUserMessage(message)).toBe(message);
    });

    it('handles empty message', () => {
      expect(formatUserMessage('')).toBe('');
    });
  });

  describe('formatAssistantMessage()', () => {
    it('strips ANSI codes from assistant message', () => {
      const message = '\x1b[32mAssistant response\x1b[0m';
      expect(formatAssistantMessage(message)).toBe('Assistant response');
    });

    it('handles message without ANSI codes', () => {
      const message = 'Plain assistant response';
      expect(formatAssistantMessage(message)).toBe(message);
    });

    it('handles empty message', () => {
      expect(formatAssistantMessage('')).toBe('');
    });

    it('strips SDK diff colors', () => {
      const message =
        'File: \x1b[1msrc/test.ts\x1b[0m\n\x1b[32m+ new line\x1b[0m';
      expect(formatAssistantMessage(message)).toBe(
        'File: src/test.ts\n+ new line'
      );
    });
  });

  describe('formatToolProgressMessage()', () => {
    it('returns message unchanged', () => {
      const message = 'Tool executing...';
      expect(formatToolProgressMessage(message)).toBe(message);
    });

    it('handles empty message', () => {
      expect(formatToolProgressMessage('')).toBe('');
    });
  });
});
