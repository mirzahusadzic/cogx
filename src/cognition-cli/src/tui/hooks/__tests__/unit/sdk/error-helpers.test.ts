/**
 * Tests for sdk/error-helpers.ts
 *
 * Tests authentication error detection and error formatting functions.
 */

import { describe, it, expect } from 'vitest';
import {
  isAuthenticationError,
  formatAuthError,
  formatSDKError,
} from '../../../sdk/error-helpers.js';

describe('error-helpers', () => {
  describe('isAuthenticationError', () => {
    it('should detect HTTP 401 with authentication_error', () => {
      const stderrLines = ['Error: 401 - authentication_error'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should detect HTTP 401 with oauth keyword', () => {
      const stderrLines = ['HTTP 401 - OAuth authentication required'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should detect HTTP 401 with token keyword', () => {
      const stderrLines = ['Error 401: token invalid'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should detect HTTP 401 with unauthorized keyword', () => {
      const stderrLines = ['401 Unauthorized access'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should detect OAuth token expired message', () => {
      const stderrLines = ['OAuth token has expired'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should detect token has expired message', () => {
      const stderrLines = ['Your token has expired, please refresh'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should detect token expired message', () => {
      const stderrLines = ['token expired'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should detect authentication failed message', () => {
      const stderrLines = ['Authentication failed for user'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should detect invalid_grant error', () => {
      const stderrLines = ['OAuth error: invalid_grant'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should detect credentials have expired message', () => {
      const stderrLines = ['Your credentials have expired'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should detect anthropic_api_error', () => {
      const stderrLines = ['anthropic_api_error: unauthorized'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should detect authentication error message', () => {
      const stderrLines = ['Authentication error occurred'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should detect Claude Code unexpected exit message', () => {
      const stderrLines = ['Claude Code exited unexpectedly with code 1'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should detect login prompt message', () => {
      const stderrLines = ['Please run: claude /login'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should handle multiple lines', () => {
      const stderrLines = [
        'Starting request...',
        'Error: 401 - token invalid',
        'Request failed',
      ];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should be case insensitive', () => {
      const stderrLines = ['ERROR: 401 - TOKEN INVALID'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('should return false for non-auth errors', () => {
      const stderrLines = ['Error: 500 Internal Server Error'];
      expect(isAuthenticationError(stderrLines)).toBe(false);
    });

    it('should return false for network errors', () => {
      const stderrLines = ['ECONNREFUSED - Connection refused'];
      expect(isAuthenticationError(stderrLines)).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(isAuthenticationError([])).toBe(false);
    });

    it('should return false for 401 without auth keywords', () => {
      // Just 401 alone shouldn't match without auth-related keywords
      const stderrLines = ['Status code: 401'];
      expect(isAuthenticationError(stderrLines)).toBe(false);
    });

    it('should return false for rate limiting errors', () => {
      const stderrLines = ['Error 429: Rate limit exceeded'];
      expect(isAuthenticationError(stderrLines)).toBe(false);
    });
  });

  describe('formatAuthError', () => {
    it('should return formatted auth error message', () => {
      const result = formatAuthError();
      expect(result).toContain('401');
      expect(result).toContain('OAuth token has expired');
      expect(result).toContain('/login');
    });

    it('should include login instruction', () => {
      const result = formatAuthError();
      expect(result).toContain('Please run /login');
    });
  });

  describe('formatSDKError', () => {
    it('should format stderr lines into error message', () => {
      const stderrLines = ['Error: Connection failed', 'Retrying...'];
      const result = formatSDKError(stderrLines, true);
      expect(result).toBe('SDK error: Error: Connection failed Retrying...');
    });

    it('should handle empty stderr with no messages', () => {
      const result = formatSDKError([], false);
      expect(result).toBe(
        'SDK completed without response - check authentication'
      );
    });

    it('should handle empty stderr with messages received', () => {
      const result = formatSDKError([], true);
      expect(result).toBe('SDK error: ');
    });

    it('should join multiple lines with space', () => {
      const stderrLines = ['Line 1', 'Line 2', 'Line 3'];
      const result = formatSDKError(stderrLines, false);
      expect(result).toBe('SDK error: Line 1 Line 2 Line 3');
    });

    it('should handle single line', () => {
      const stderrLines = ['Single error message'];
      const result = formatSDKError(stderrLines, true);
      expect(result).toBe('SDK error: Single error message');
    });
  });
});
