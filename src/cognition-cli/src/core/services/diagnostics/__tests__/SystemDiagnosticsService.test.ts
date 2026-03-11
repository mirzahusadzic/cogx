import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SystemDiagnosticsService } from '../SystemDiagnosticsService.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('SystemDiagnosticsService', () => {
  let service: SystemDiagnosticsService;

  beforeEach(() => {
    // Reset singleton
    (SystemDiagnosticsService as unknown as { instance: undefined }).instance =
      undefined;
    service = SystemDiagnosticsService.getInstance();
  });

  it('should be a singleton', () => {
    const instance2 = SystemDiagnosticsService.getInstance();
    expect(service).toBe(instance2);
  });

  it('should initialize debug log', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-test-'));
    service.initDebugLog(tmpDir);

    expect(service.isDebugEnabled()).toBe(true);
    const logPath = service.getDebugLogPath();
    expect(logPath).not.toBeNull();
    if (logPath) {
      expect(fs.existsSync(logPath)).toBe(true);
      const content = fs.readFileSync(logPath, 'utf8');
      expect(content).toContain('Cognition CLI Debug Log');
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should log messages and emit events', () => {
    const logSpy = vi.fn();
    service.getLogEmitter().on('log', logSpy);

    service.debugLog('test message', { foo: 'bar' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'debug',
        message: 'test message',
        data: { foo: 'bar' },
      })
    );
  });

  it('should suppress and restore noise', () => {
    const logSpy = vi.spyOn(console, 'log');

    service.suppressNoise();
    console.log('google-cloud noise message');
    expect(logSpy).not.toHaveBeenCalled();

    service.restoreNoise();
    console.log('normal message');
    expect(logSpy).toHaveBeenCalledWith('normal message');

    logSpy.mockRestore();
  });

  it('should format diagnostic errors', () => {
    const error = new Error('Something went wrong');
    error.name = 'TestError';

    const formatted = service.formatDiagnosticError(error);
    expect(formatted).toContain('[TestError] Something went wrong');
  });

  it('should emit progress events', () => {
    const logSpy = vi.spyOn(console, 'log');

    service.emitProgress({
      type: 'start',
      task: 'test-task',
      message: 'Starting...',
    });

    expect(logSpy).toHaveBeenCalled();
    const lastCall = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(lastCall);
    expect(parsed.type).toBe('start');
    expect(parsed.task).toBe('test-task');
    expect(parsed.timestamp).toBeDefined();

    logSpy.mockRestore();
  });
});
