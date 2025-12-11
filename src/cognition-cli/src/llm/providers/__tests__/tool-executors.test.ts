import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import { glob as globLib } from 'glob';
import { EventEmitter } from 'events';

// Mock dependencies BEFORE imports
vi.mock('fs/promises');
vi.mock('child_process');
vi.mock('glob');

// Mock tool-helpers
vi.mock('../tool-helpers.js', () => {
  return {
    smartCompressOutput: (output) => Promise.resolve(output || ''),
    getWorkbenchClient: () => {},
    truncateOutput: (output) => output,
    MAX_TOOL_OUTPUT_CHARS: 50000,
    EGEMMA_SUMMARIZE_THRESHOLD: 50000,
    PRE_TRUNCATE_THRESHOLD: 250000,
  };
});

// Import AFTER mocks
import {
  executeReadFile,
  executeWriteFile,
  executeGlob,
  executeGrep,
  executeBash,
  executeEditFile,
  executeFetchUrl,
} from '../tool-executors.js';

describe('Tool Executors', () => {
  // Track EventEmitters to clean up after each test
  const activeEmitters: EventEmitter[] = [];

  const createMockProc = (): ChildProcess => {
    const mockProc = new EventEmitter() as unknown as ChildProcess;
    mockProc.stdout = new EventEmitter();
    mockProc.stderr = new EventEmitter();

    // Track for cleanup
    activeEmitters.push(mockProc, mockProc.stdout, mockProc.stderr);

    return mockProc;
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    // Clean up all EventEmitters to prevent leaks
    activeEmitters.forEach((emitter) => {
      emitter.removeAllListeners();
    });
    activeEmitters.length = 0;

    vi.restoreAllMocks();
  });

  describe('executeReadFile', () => {
    test('should read file content successfully', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2\nline3');

      const result = await executeReadFile('/path/to/file.txt');

      expect(fs.readFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf-8');
      expect(result).toBeTruthy();
      expect(result).toContain('line1');
      expect(result).toContain('line2');
      expect(result).toContain('line3');
      expect(result).toContain('│line1'); // Check formatting
    });

    test('should respect limit and offset', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2\nline3\nline4');

      const result = await executeReadFile('/path/to/file.txt', 2, 1);

      expect(result).toBeTruthy();
      expect(result).not.toContain('line1');
      expect(result).toContain('line2');
      expect(result).toContain('line3');
      expect(result).not.toContain('line4');
    });

    test('should handle errors gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await executeReadFile('/nonexistent.txt');

      expect(result).toContain('Error reading file');
      expect(result).toContain('File not found');
    });
  });

  describe('executeWriteFile', () => {
    test('should write file successfully', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await executeWriteFile('/path/to/file.txt', 'content');

      expect(fs.mkdir).toHaveBeenCalledWith('/path/to', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/path/to/file.txt',
        'content',
        'utf-8'
      );
      expect(result).toContain('Successfully wrote');
    });

    test('should handle errors gracefully', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'));

      const result = await executeWriteFile('/protected/file.txt', 'content');

      expect(result).toContain('Error writing file');
      expect(result).toContain('Permission denied');
    });
  });

  describe('executeGlob', () => {
    test('should return matched files', async () => {
      // @ts-expect-error - mock implementation matches usage
      vi.mocked(globLib).mockResolvedValue([
        '/path/file1.ts',
        '/path/file2.ts',
      ]);

      const result = await executeGlob('*.ts', '/cwd');

      expect(globLib).toHaveBeenCalledWith(
        '*.ts',
        expect.objectContaining({ cwd: '/cwd' })
      );
      expect(result).toContain('/path/file1.ts');
      expect(result).toContain('/path/file2.ts');
    });

    test('should handle no matches', async () => {
      // @ts-expect-error - testing no match scenario
      vi.mocked(globLib).mockResolvedValue([]);

      const result = await executeGlob('*.nonexistent', '/cwd');

      expect(result).toBe('No matches found');
    });
  });

  describe('executeGrep', () => {
    test('should execute grep command and return output', async () => {
      vi.useFakeTimers();
      const mockProc = createMockProc();
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      mockProc.kill = () => {};
      vi.mocked(spawn).mockReturnValue(mockProc);

      const promise = executeGrep('pattern', '.', undefined, '/cwd');

      // Emit data immediately
      await new Promise((resolve) => process.nextTick(resolve));
      mockProc.stdout.emit('data', Buffer.from('match found\n'));
      mockProc.emit('close', 0);

      const result = await promise;

      expect(spawn).toHaveBeenCalledWith(
        'rg',
        expect.arrayContaining(['pattern']),
        expect.any(Object)
      );
      expect(result).toContain('match found');

      vi.useRealTimers();
    });
  });

  describe('executeBash', () => {
    test('should execute bash command', async () => {
      const mockProc = createMockProc();
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      mockProc.kill = () => {};
      vi.mocked(spawn).mockReturnValue(mockProc);

      const promise = executeBash('echo hello', undefined, '/cwd');

      await new Promise((resolve) => process.nextTick(resolve));
      mockProc.stdout.emit('data', Buffer.from('hello\n'));
      mockProc.emit('close', 0);

      const result = await promise;

      expect(spawn).toHaveBeenCalledWith(
        'bash',
        ['-c', 'echo hello'],
        expect.any(Object)
      );
      expect(result).toContain('Exit code: 0');
      expect(result).toContain('hello');
    });

    test('should handle timeout', async () => {
      vi.useFakeTimers();
      const mockProc = createMockProc();
      mockProc.kill = vi.fn();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const promise = executeBash('sleep 10', 100, '/cwd');

      vi.advanceTimersByTime(150);
      mockProc.emit('close', null); // Simulated close after kill

      const result = await promise;

      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
      expect(result).toContain('Timeout after 100ms');

      vi.useRealTimers();
    });
  });

  describe('executeEditFile', () => {
    test('should edit file content', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('hello world');
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await executeEditFile('/file.txt', 'world', 'universe');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/file.txt',
        'hello universe',
        'utf-8'
      );
      expect(result).toContain('Successfully edited');
    });

    test('should fail if string not found', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('hello world');

      const result = await executeEditFile('/file.txt', 'foobar', 'barfoo');

      expect(result).toContain('Error: old_string not found');
    });
  });

  describe('executeFetchUrl', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
      global.AbortSignal = {
        timeout: vi.fn(),
      } as unknown as typeof AbortSignal;
    });

    test('should fetch and return text', async () => {
      const mockResponse = {
        ok: true,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('content'),
      };
      // @ts-expect-error - mock fetch response structure
      global.fetch.mockResolvedValue(mockResponse);

      const result = await executeFetchUrl('https://example.com');

      expect(result).toBe('content');
    });

    test('should strip HTML', async () => {
      const mockResponse = {
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve('<html><body><h1>Hello</h1></body></html>'),
      };
      // @ts-expect-error - mock fetch response structure
      global.fetch.mockResolvedValue(mockResponse);

      const result = await executeFetchUrl('https://example.com');

      expect(result).toBe('Hello');
    });
  });
});
