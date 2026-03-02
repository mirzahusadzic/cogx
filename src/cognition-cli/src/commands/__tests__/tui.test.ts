/**
 * Tests for TUI command
 *
 * Tests the terminal user interface command initialization and configuration.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

// Mock dependencies
vi.mock('../../core/workspace-manager.js');
vi.mock('../../tui/index.js');
vi.mock('../../utils/workbench-detect.js');
vi.mock('../../llm/core/llm-config.js');
vi.mock('../../llm/index.js');

describe('tuiCommand', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default mocks
    const { WorkspaceManager } =
      await import('../../core/workspace-manager.js');
    vi.mocked(WorkspaceManager).mockImplementation(
      () =>
        ({
          resolvePgcRoot: vi.fn().mockReturnValue('/mock/pgc/root'),
        }) as any
    );

    const { checkWorkbenchHealthDetailed, autoConfigureOpenAIFromWorkbench } =
      await import('../../utils/workbench-detect.js');
    vi.mocked(checkWorkbenchHealthDetailed).mockResolvedValue({
      reachable: true,
      embeddingReady: true,
      summarizationReady: true,
      models: [],
    } as any);
    vi.mocked(autoConfigureOpenAIFromWorkbench).mockResolvedValue({
      configured: false,
    } as any);

    const { loadLLMConfig } = await import('../../llm/core/llm-config.js');
    vi.mocked(loadLLMConfig).mockReturnValue({
      defaultProvider: 'claude',
      providers: {
        claude: { defaultModel: 'claude-3-5-sonnet' },
        gemini: { defaultModel: 'gemini-3.1-pro-preview' },
      },
    } as any);

    const { registry, initializeProviders } =
      await import('../../llm/index.js');
    vi.mocked(initializeProviders).mockResolvedValue(undefined);
    vi.mocked(registry.has).mockReturnValue(true);
    vi.mocked(registry.supportsAgent).mockReturnValue(true);
    vi.mocked(registry.list).mockReturnValue(['claude', 'gemini']);
  }, 30000);

  it('should export tuiCommand function', async () => {
    const { tuiCommand } = await import('../tui.js');
    expect(tuiCommand).toBeDefined();
    expect(typeof tuiCommand).toBe('function');
  });

  it('should launch TUI with default options', async () => {
    const { tuiCommand } = await import('../tui.js');
    const { startTUI } = await import('../../tui/index.js');

    // Mock fs.existsSync for workspace checks
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['manifest.json'] as any);

    await tuiCommand({ projectRoot: '/test' });

    expect(startTUI).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: '/mock/pgc/root',
        provider: 'claude',
        model: 'claude-3-5-sonnet',
      })
    );
  });

  it('should handle missing workspace and trigger onboarding if not opted out', async () => {
    const { tuiCommand } = await import('../tui.js');
    const { startTUI } = await import('../../tui/index.js');

    // Mock fs.existsSync to return false for genesis/docs
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await tuiCommand({ projectRoot: '/test' });

    expect(startTUI).toHaveBeenCalledWith(
      expect.objectContaining({
        onboardingMode: true,
      })
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Starting onboarding wizard')
    );

    consoleLogSpy.mockRestore();
  });

  it('should skip onboarding if --no-onboarding is provided', async () => {
    const { tuiCommand } = await import('../tui.js');
    const { startTUI } = await import('../../tui/index.js');

    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    await tuiCommand({ projectRoot: '/test', noOnboarding: true });

    expect(startTUI).toHaveBeenCalledWith(
      expect.objectContaining({
        onboardingMode: false,
      })
    );
  });

  it('should exit if both --session-id and --session-file are provided', async () => {
    const { tuiCommand } = await import('../tui.js');

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit');
    }) as any);

    await expect(
      tuiCommand({
        projectRoot: '/test',
        sessionId: 'test-session',
        sessionFile: 'test-session.state.json',
      })
    ).rejects.toThrow('exit');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot specify both --session-id and --file')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should resolve session ID from session file', async () => {
    const { tuiCommand } = await import('../tui.js');
    const { startTUI } = await import('../../tui/index.js');

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['manifest.json'] as any);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ provider: 'gemini', model: 'gemini-3-flash-preview' })
    );

    await tuiCommand({
      projectRoot: '/test',
      sessionFile: '.sigma/tui-123456.state.json',
    });

    expect(startTUI).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'tui-123456',
        provider: 'gemini',
        model: 'gemini-3-flash-preview',
      })
    );
  });
});
