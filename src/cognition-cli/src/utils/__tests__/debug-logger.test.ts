/**
 * Tests for debug-logger utility
 *
 * Coverage:
 * - [x] initDebugLog creates log file
 * - [x] isDebugEnabled returns correct state
 * - [x] getDebugLogPath returns path when enabled
 * - [x] debugLog writes entries when enabled
 * - [x] debugLog is no-op when disabled
 * - [x] debugError writes error with stack trace
 * - [x] debugTimer measures elapsed time
 * - [x] finalizeDebugLog writes footer
 * - [x] API key redaction
 * - [x] Fallback to temp directory
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// We need to reset the module state between tests
async function getDebugLogger() {
  // Reset modules to get fresh state
  vi.resetModules();

  // Re-import the module
  const module = await import('../debug-logger.js');
  return module;
}

describe('debug-logger', () => {
  let tempDir: string;
  let cogDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-logger-test-'));
    cogDir = path.join(tempDir, '.open_cognition');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('initDebugLog', () => {
    it('should create log file in .open_cognition when it exists', async () => {
      fs.mkdirSync(cogDir, { recursive: true });

      // Import fresh module
      const { initDebugLog, getDebugLogPath, isDebugEnabled } =
        await getDebugLogger();

      initDebugLog(tempDir);

      const logPath = getDebugLogPath();
      expect(logPath).not.toBeNull();
      expect(logPath).toContain('.open_cognition');
      expect(logPath).toContain('debug-');
      expect(logPath).toMatch(/\.log$/);
      expect(isDebugEnabled()).toBe(true);

      // Verify file was created
      expect(fs.existsSync(logPath!)).toBe(true);
    });

    it('should fall back to temp directory when .open_cognition does not exist', async () => {
      // Don't create cogDir
      const { initDebugLog, getDebugLogPath } = await getDebugLogger();

      initDebugLog(tempDir);

      const logPath = getDebugLogPath();
      expect(logPath).not.toBeNull();
      expect(logPath).toContain(os.tmpdir());
      expect(logPath).toContain('cognition-debug-');
    });

    it('should write header with system info', async () => {
      fs.mkdirSync(cogDir, { recursive: true });

      const { initDebugLog, getDebugLogPath } = await getDebugLogger();
      initDebugLog(tempDir);

      const logPath = getDebugLogPath()!;
      const content = fs.readFileSync(logPath, 'utf-8');

      expect(content).toContain('Cognition CLI Debug Log');
      expect(content).toContain('Platform:');
      expect(content).toContain('Node:');
      expect(content).toContain('CWD:');
    });
  });

  describe('isDebugEnabled', () => {
    it('should return false before initDebugLog is called', async () => {
      const { isDebugEnabled } = await getDebugLogger();
      expect(isDebugEnabled()).toBe(false);
    });

    it('should return true after initDebugLog is called', async () => {
      fs.mkdirSync(cogDir, { recursive: true });

      const { initDebugLog, isDebugEnabled } = await getDebugLogger();
      initDebugLog(tempDir);

      expect(isDebugEnabled()).toBe(true);
    });
  });

  describe('getDebugLogPath', () => {
    it('should return null before initDebugLog is called', async () => {
      const { getDebugLogPath } = await getDebugLogger();
      expect(getDebugLogPath()).toBeNull();
    });

    it('should return path after initDebugLog is called', async () => {
      fs.mkdirSync(cogDir, { recursive: true });

      const { initDebugLog, getDebugLogPath } = await getDebugLogger();
      initDebugLog(tempDir);

      expect(getDebugLogPath()).not.toBeNull();
    });
  });

  describe('debugLog', () => {
    it('should write log entry when debug is enabled', async () => {
      fs.mkdirSync(cogDir, { recursive: true });

      const { initDebugLog, debugLog, getDebugLogPath } =
        await getDebugLogger();
      initDebugLog(tempDir);
      debugLog('Test message', { key: 'value' });

      const logPath = getDebugLogPath()!;
      const content = fs.readFileSync(logPath, 'utf-8');

      expect(content).toContain('Test message');
      expect(content).toContain('"key": "value"');
    });

    it('should be no-op when debug is disabled', async () => {
      const { debugLog, getDebugLogPath } = await getDebugLogger();

      // Should not throw
      expect(() => debugLog('Test message')).not.toThrow();
      expect(getDebugLogPath()).toBeNull();
    });

    it('should include timestamp in log entry', async () => {
      fs.mkdirSync(cogDir, { recursive: true });

      const { initDebugLog, debugLog, getDebugLogPath } =
        await getDebugLogger();
      initDebugLog(tempDir);
      debugLog('Timestamp test');

      const logPath = getDebugLogPath()!;
      const content = fs.readFileSync(logPath, 'utf-8');

      // ISO timestamp pattern
      expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('debugError', () => {
    it('should log error with name and message', async () => {
      fs.mkdirSync(cogDir, { recursive: true });

      const { initDebugLog, debugError, getDebugLogPath } =
        await getDebugLogger();
      initDebugLog(tempDir);

      const error = new Error('Test error message');
      error.name = 'TestError';
      debugError('Error context', error);

      const logPath = getDebugLogPath()!;
      const content = fs.readFileSync(logPath, 'utf-8');

      expect(content).toContain('ERROR: Error context');
      expect(content).toContain('Name: TestError');
      expect(content).toContain('Message: Test error message');
    });

    it('should include stack trace', async () => {
      fs.mkdirSync(cogDir, { recursive: true });

      const { initDebugLog, debugError, getDebugLogPath } =
        await getDebugLogger();
      initDebugLog(tempDir);

      const error = new Error('Stack test');
      debugError('With stack', error);

      const logPath = getDebugLogPath()!;
      const content = fs.readFileSync(logPath, 'utf-8');

      expect(content).toContain('Stack:');
    });

    it('should handle non-Error objects', async () => {
      fs.mkdirSync(cogDir, { recursive: true });

      const { initDebugLog, debugError, getDebugLogPath } =
        await getDebugLogger();
      initDebugLog(tempDir);

      debugError('Non-error', 'string error');

      const logPath = getDebugLogPath()!;
      const content = fs.readFileSync(logPath, 'utf-8');

      expect(content).toContain('string error');
    });
  });

  describe('debugTimer', () => {
    it('should measure elapsed time', async () => {
      fs.mkdirSync(cogDir, { recursive: true });

      const { initDebugLog, debugTimer, getDebugLogPath } =
        await getDebugLogger();
      initDebugLog(tempDir);

      const done = debugTimer('Test operation');

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 10));

      done();

      const logPath = getDebugLogPath()!;
      const content = fs.readFileSync(logPath, 'utf-8');

      expect(content).toContain('TIMING: Test operation');
      expect(content).toContain('durationMs');
    });

    it('should return no-op function when debug is disabled', async () => {
      const { debugTimer } = await getDebugLogger();

      const done = debugTimer('Test');
      expect(typeof done).toBe('function');
      expect(() => done()).not.toThrow();
    });
  });

  describe('finalizeDebugLog', () => {
    it('should write completion footer', async () => {
      fs.mkdirSync(cogDir, { recursive: true });

      const { initDebugLog, finalizeDebugLog, getDebugLogPath } =
        await getDebugLogger();
      initDebugLog(tempDir);
      finalizeDebugLog(true, 0);

      const logPath = getDebugLogPath()!;
      const content = fs.readFileSync(logPath, 'utf-8');

      expect(content).toContain('Completed:');
      expect(content).toContain('Success: true');
      expect(content).toContain('Exit Code: 0');
    });

    it('should indicate failure when success is false', async () => {
      fs.mkdirSync(cogDir, { recursive: true });

      const { initDebugLog, finalizeDebugLog, getDebugLogPath } =
        await getDebugLogger();
      initDebugLog(tempDir);
      finalizeDebugLog(false, 1);

      const logPath = getDebugLogPath()!;
      const content = fs.readFileSync(logPath, 'utf-8');

      expect(content).toContain('Success: false');
      expect(content).toContain('Exit Code: 1');
    });
  });

  describe('API key redaction', () => {
    it('should redact ANTHROPIC_API_KEY', async () => {
      fs.mkdirSync(cogDir, { recursive: true });
      process.env.ANTHROPIC_API_KEY = 'sk-ant-secret123';

      const { initDebugLog, getDebugLogPath } = await getDebugLogger();
      initDebugLog(tempDir);

      const logPath = getDebugLogPath()!;
      const content = fs.readFileSync(logPath, 'utf-8');

      expect(content).not.toContain('sk-ant-secret123');
      expect(content).toContain('ANTHROPIC_API_KEY');
      expect(content).toContain('[SET]');

      delete process.env.ANTHROPIC_API_KEY;
    });

    it('should redact GEMINI_API_KEY', async () => {
      fs.mkdirSync(cogDir, { recursive: true });
      process.env.GEMINI_API_KEY = 'AIzaSecret456';

      const { initDebugLog, getDebugLogPath } = await getDebugLogger();
      initDebugLog(tempDir);

      const logPath = getDebugLogPath()!;
      const content = fs.readFileSync(logPath, 'utf-8');

      expect(content).not.toContain('AIzaSecret456');
      expect(content).toContain('GEMINI_API_KEY');
      expect(content).toContain('[SET]');

      delete process.env.GEMINI_API_KEY;
    });

    it('should show [NOT SET] when API key is not set', async () => {
      fs.mkdirSync(cogDir, { recursive: true });
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const { initDebugLog, getDebugLogPath } = await getDebugLogger();
      initDebugLog(tempDir);

      const logPath = getDebugLogPath()!;
      const content = fs.readFileSync(logPath, 'utf-8');

      expect(content).toContain('[NOT SET]');
    });
  });
});
