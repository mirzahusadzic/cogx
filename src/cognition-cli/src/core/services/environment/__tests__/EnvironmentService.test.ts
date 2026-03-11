import { describe, it, expect, beforeEach } from 'vitest';
import { EnvironmentService } from '../EnvironmentService.js';
import * as path from 'path';

describe('EnvironmentService', () => {
  let service: EnvironmentService;

  beforeEach(() => {
    // Reset singleton for tests
    (EnvironmentService as unknown as { instance: undefined }).instance =
      undefined;
    service = EnvironmentService.getInstance();
  });

  it('should return the singleton instance', () => {
    const instance2 = EnvironmentService.getInstance();
    expect(service).toBe(instance2);
  });

  it('should get current working directory', () => {
    expect(service.getCwd()).toBe(process.cwd());
  });

  it('should get environment variables', () => {
    process.env.TEST_VAR = 'test_value';
    expect(service.getEnv('TEST_VAR')).toBe('test_value');
    delete process.env.TEST_VAR;
  });

  it('should detect OS', () => {
    const originalPlatform = process.platform;

    // Test for Windows
    Object.defineProperty(process, 'platform', { value: 'win32' });
    expect(service.isWindows()).toBe(true);
    expect(service.isMac()).toBe(false);

    // Test for Mac
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    expect(service.isMac()).toBe(true);
    expect(service.isWindows()).toBe(false);

    // Restore
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should detect shell type', () => {
    const originalShell = process.env.SHELL;
    process.env.SHELL = '/usr/bin/zsh';
    expect(service.getShellType()).toBe('zsh');

    process.env.SHELL = '/bin/bash';
    expect(service.getShellType()).toBe('bash');

    // Restore
    process.env.SHELL = originalShell;
  });

  it('should resolve sigma and pgc directories', () => {
    const repoRoot = service.getRepoRoot();
    expect(service.resolveSigmaDir()).toBe(path.join(repoRoot, '.sigma'));
    // pgcDir might be the same or a parent, but should contain .open_cognition
    expect(service.resolvePgcDir()).toContain('.open_cognition');
  });

  it('should resolve sigma directory with bus name', () => {
    process.env.IPC_SIGMA_BUS = 'global';
    const homeDir = service.getHomeDir();
    expect(service.resolveSigmaDir()).toBe(
      path.join(homeDir, '.cognition', 'sigma-global')
    );
    delete process.env.IPC_SIGMA_BUS;
  });

  it('should find project root by walking up', () => {
    const cwd = service.getCwd();
    // Assuming we are in a project that has .open_cognition at root
    const root = service.findProjectRoot();
    expect(root).not.toBeNull();
    if (root) {
      expect(cwd).toContain(root);
    }
  });

  it('should detect CI environment', () => {
    process.env.CI = 'true';
    expect(service.isCI()).toBe(true);
    process.env.CI = 'false';
    expect(service.isCI()).toBe(false);
    delete process.env.CI;
  });

  it('should check if interactive', () => {
    const originalNoInput = process.env.COGNITION_NO_INPUT;
    const originalCI = process.env.CI;

    process.env.COGNITION_NO_INPUT = '1';
    expect(service.isInteractive()).toBe(false);

    process.env.COGNITION_NO_INPUT = '0';
    process.env.CI = 'true';
    expect(service.isInteractive()).toBe(false);

    // Restore
    process.env.COGNITION_NO_INPUT = originalNoInput;
    process.env.CI = originalCI;
  });

  it('should get terminal width', () => {
    expect(typeof service.getTerminalWidth()).toBe('number');
  });

  it('should resolve absolute and relative paths', () => {
    const cwd = service.getCwd();
    const relative = 'some/path';
    const absolute = '/some/absolute/path';

    expect(service.resolvePath(absolute)).toBe(absolute);
    expect(service.resolvePath(relative)).toBe(path.resolve(cwd, relative));
  });
});
