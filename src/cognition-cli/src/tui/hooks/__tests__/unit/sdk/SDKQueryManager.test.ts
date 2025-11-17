/**
 * Tests for SDKQueryManager
 *
 * Week 2 Day 6-8: Extract SDK Layer
 */

import { describe, it, expect } from 'vitest';
import {
  isAuthenticationError,
  formatAuthError,
  formatSDKError,
} from '../../../sdk/SDKQueryManager.js';

describe('SDKQueryManager', () => {
  describe('isAuthenticationError()', () => {
    it('detects 401 authentication_error', () => {
      const stderrLines = [
        'Error: 401',
        'authentication_error: OAuth token has expired',
      ];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('detects 401 with "OAuth token has expired"', () => {
      const stderrLines = [
        'HTTP Error 401',
        'OAuth token has expired. Please refresh.',
      ];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('detects 401 with "token has expired"', () => {
      const stderrLines = ['API returned 401', 'Your token has expired'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('returns false for 401 without auth keywords', () => {
      const stderrLines = ['Error 401', 'Something else went wrong'];
      expect(isAuthenticationError(stderrLines)).toBe(false);
    });

    it('returns true for explicit OAuth expiration messages', () => {
      // Enhanced detection: catches OAuth expiration even without HTTP 401
      // This handles cases where the SDK error message doesn't include status codes
      const stderrLines = ['OAuth token has expired'];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('returns false for empty stderr', () => {
      expect(isAuthenticationError([])).toBe(false);
    });

    it('returns false for non-auth errors', () => {
      const stderrLines = ['Error: Network timeout', 'Connection failed'];
      expect(isAuthenticationError(stderrLines)).toBe(false);
    });

    it('handles multiple stderr lines correctly', () => {
      const stderrLines = [
        'Debug log line 1',
        'Debug log line 2',
        'Error: 401 authentication_error',
        'Stack trace...',
      ];
      expect(isAuthenticationError(stderrLines)).toBe(true);
    });

    it('detects various OAuth error patterns', () => {
      expect(isAuthenticationError(['token expired'])).toBe(true);
      expect(isAuthenticationError(['authentication failed'])).toBe(true);
      expect(isAuthenticationError(['invalid_grant'])).toBe(true);
      expect(isAuthenticationError(['credentials have expired'])).toBe(true);
    });

    it('detects errors with 401 and generic auth keywords', () => {
      expect(isAuthenticationError(['Error 401 unauthorized'])).toBe(true);
      expect(isAuthenticationError(['401 token invalid'])).toBe(true);
      expect(isAuthenticationError(['HTTP 401 oauth error'])).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isAuthenticationError(['OAUTH TOKEN HAS EXPIRED'])).toBe(true);
      expect(isAuthenticationError(['401 Authentication_Error'])).toBe(true);
      expect(isAuthenticationError(['Token Expired'])).toBe(true);
    });
  });

  describe('formatAuthError()', () => {
    it('returns formatted authentication error message', () => {
      const result = formatAuthError();
      expect(result).toContain('API Error: 401');
      expect(result).toContain('OAuth token has expired');
      expect(result).toContain('/login');
    });

    it('includes instruction to run /login', () => {
      const result = formatAuthError();
      expect(result).toContain('Please run /login');
    });
  });

  describe('formatSDKError()', () => {
    it('formats stderr messages', () => {
      const stderrLines = ['Error: Something went wrong', 'Stack trace...'];
      const result = formatSDKError(stderrLines, true);
      expect(result).toContain('SDK error:');
      expect(result).toContain('Something went wrong');
      expect(result).toContain('Stack trace');
    });

    it('returns default message when no stderr and no messages', () => {
      const result = formatSDKError([], false);
      expect(result).toBe(
        'SDK completed without response - check authentication'
      );
    });

    it('joins multiple stderr lines', () => {
      const stderrLines = ['Line 1', 'Line 2', 'Line 3'];
      const result = formatSDKError(stderrLines, true);
      expect(result).toContain('Line 1 Line 2 Line 3');
    });

    it('handles empty stderr with messages received', () => {
      const result = formatSDKError([], true);
      expect(result).toContain('SDK error:');
    });
  });
});
