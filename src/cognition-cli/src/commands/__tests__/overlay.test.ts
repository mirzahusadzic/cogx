/* eslint-disable @typescript-eslint/no-unused-vars */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { createGenerateCommand } from '../overlay/generate.js';
import { createListCommand } from '../overlay/list.js';

// Mock modules at top level (hoisted by Vitest)
vi.mock('../../core/orchestrators/overlay.js', () => ({
  OverlayOrchestrator: {
    create: vi.fn(),
  },
}));

vi.mock('../../core/overlays/vector-db/lance-store.js', () => ({
  LanceVectorStore: vi.fn(),
}));

vi.mock('../../core/workspace-manager.js', () => ({
  WorkspaceManager: vi.fn(),
}));

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    readJSON: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
  },
}));

vi.mock('undici', () => ({
  getGlobalDispatcher: vi.fn(() => ({
    close: vi.fn(() => Promise.resolve()), // Must return resolved promise
  })),
}));

vi.mock('yaml', () => ({
  parse: vi.fn(),
}));

vi.mock('../../utils/progress-protocol.js', () => ({
  shouldUseJsonProgress: vi.fn((option) => !!option),
  createProgressEmitter: vi.fn(() => ({
    start: vi.fn(),
    update: vi.fn(),
    complete: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('overlay command - generate subcommand', () => {
  let mockOrchestrator: {
    run: ReturnType<typeof vi.fn>;
    shutdown: ReturnType<typeof vi.fn>;
  };
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let exitCode: number | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    chalk.level = 0;
    exitCode = undefined;

    // Mock console methods
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup mock orchestrator
    mockOrchestrator = {
      run: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    // Configure OverlayOrchestrator.create mock
    const { OverlayOrchestrator } =
      await import('../../core/orchestrators/overlay.js');
    vi.mocked(OverlayOrchestrator.create).mockResolvedValue(
      mockOrchestrator as unknown as Awaited<
        ReturnType<typeof OverlayOrchestrator.create>
      >
    );

    // Mock process.exit to CAPTURE code (don't throw - causes hangs in fork pool)
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      exitCode = code as number;
      return undefined as never;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic command structure', () => {
    it('should have correct name and description', () => {
      const command = createGenerateCommand();
      expect(command.name()).toBe('generate');
      expect(command.description()).toContain('Generate overlays');
    });

    it('should have force option', () => {
      const command = createGenerateCommand();
      const options = command.options;
      const forceOption = options.find((opt) => opt.flags.includes('--force'));
      expect(forceOption).toBeDefined();
      expect(forceOption?.short).toBe('-f');
    });

    it('should have skip-gc option', () => {
      const command = createGenerateCommand();
      const options = command.options;
      const skipGcOption = options.find((opt) =>
        opt.flags.includes('--skip-gc')
      );
      expect(skipGcOption).toBeDefined();
    });

    it('should have json option', () => {
      const command = createGenerateCommand();
      const options = command.options;
      const jsonOption = options.find((opt) => opt.flags.includes('--json'));
      expect(jsonOption).toBeDefined();
    });
  });

  describe('single overlay generation', () => {
    it('should generate structural_patterns overlay successfully', async () => {
      const command = createGenerateCommand();
      command.exitOverride();

      await command.parseAsync(['structural_patterns'], { from: 'user' });

      expect(exitCode).toBe(0);
      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        'structural_patterns',
        expect.objectContaining({
          force: false,
          skipGc: false,
          useJson: false,
        })
      );
      expect(mockOrchestrator.shutdown).toHaveBeenCalled();
    });

    it('should generate security_guidelines overlay successfully', async () => {
      const command = createGenerateCommand();
      command.exitOverride();

      await command.parseAsync(['security_guidelines'], { from: 'user' });

      expect(exitCode).toBe(0);
      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        'security_guidelines',
        expect.objectContaining({
          force: false,
          skipGc: false,
        })
      );
    });

    it('should pass force option to orchestrator', async () => {
      const command = createGenerateCommand();
      command.exitOverride();

      await command.parseAsync(['lineage_patterns', '--force'], {
        from: 'user',
      });

      expect(exitCode).toBe(0);
      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        'lineage_patterns',
        expect.objectContaining({
          force: true,
          skipGc: false,
        })
      );
    });

    it('should pass skip-gc option to orchestrator', async () => {
      const command = createGenerateCommand();
      command.exitOverride();

      await command.parseAsync(['mission_concepts', '--skip-gc'], {
        from: 'user',
      });

      expect(exitCode).toBe(0);
      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        'mission_concepts',
        expect.objectContaining({
          force: false,
          skipGc: true,
        })
      );
    });

    it('should support json output mode', async () => {
      const command = createGenerateCommand();
      command.exitOverride();

      await command.parseAsync(['operational_patterns', '--json'], {
        from: 'user',
      });

      expect(exitCode).toBe(0);
      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        'operational_patterns',
        expect.objectContaining({
          useJson: true,
        })
      );
    });
  });

  describe('all overlays generation', () => {
    it('should generate all overlays when type is "all"', async () => {
      const command = createGenerateCommand();
      command.exitOverride();

      await command.parseAsync(['all'], { from: 'user' });

      expect(exitCode).toBe(0);
      // Should call run() for each of the 7 overlay types
      expect(mockOrchestrator.run).toHaveBeenCalledTimes(7);
      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        'structural_patterns',
        expect.objectContaining({})
      );
      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        'security_guidelines',
        expect.objectContaining({})
      );
      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        'lineage_patterns',
        expect.objectContaining({})
      );
      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        'mission_concepts',
        expect.objectContaining({})
      );
      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        'operational_patterns',
        expect.objectContaining({})
      );
      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        'mathematical_proofs',
        expect.objectContaining({})
      );
      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        'strategic_coherence',
        expect.objectContaining({})
      );
    });

    it('should pass options to all overlays when generating all', async () => {
      const command = createGenerateCommand();
      command.exitOverride();

      await command.parseAsync(['all', '--force', '--skip-gc'], {
        from: 'user',
      });

      expect(exitCode).toBe(0);
      expect(mockOrchestrator.run).toHaveBeenCalledTimes(7);
      // Check that all calls received the options
      for (let i = 0; i < 7; i++) {
        expect(mockOrchestrator.run).toHaveBeenNthCalledWith(
          i + 1,
          expect.any(String),
          expect.objectContaining({
            force: true,
            skipGc: true,
          })
        );
      }
    });

    it('should handle error during all overlays generation', async () => {
      mockOrchestrator.run.mockRejectedValueOnce(
        new Error('Orchestrator failed')
      );

      const command = createGenerateCommand();
      command.exitOverride();

      await command.parseAsync(['all'], { from: 'user' });

      expect(exitCode).toBe(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Orchestrator failed')
      );
    });
  });

  describe('error handling', () => {
    it('should reject unsupported overlay type', async () => {
      const command = createGenerateCommand();
      command.exitOverride();

      await command.parseAsync(['invalid_type'], { from: 'user' });

      expect(exitCode).toBe(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Unsupported overlay type')
      );
      expect(mockOrchestrator.run).not.toHaveBeenCalled();
    });

    it('should handle orchestrator run error', async () => {
      mockOrchestrator.run.mockRejectedValueOnce(
        new Error('Generation failed')
      );

      const command = createGenerateCommand();
      command.exitOverride();

      await command.parseAsync(['structural_patterns'], { from: 'user' });

      expect(exitCode).toBe(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Generation failed')
      );
      expect(mockOrchestrator.shutdown).toHaveBeenCalled();
    });

    it('should call shutdown even on error', async () => {
      mockOrchestrator.run.mockRejectedValueOnce(new Error('Test error'));

      const command = createGenerateCommand();
      command.exitOverride();

      await command.parseAsync(['structural_patterns'], { from: 'user' });

      expect(exitCode).toBe(1);
      expect(mockOrchestrator.shutdown).toHaveBeenCalled();
    });
  });

  describe('supported overlay types', () => {
    const supportedTypes = [
      'structural_patterns',
      'security_guidelines',
      'lineage_patterns',
      'mission_concepts',
      'operational_patterns',
      'mathematical_proofs',
      'strategic_coherence',
    ];

    supportedTypes.forEach((type) => {
      it(`should support overlay type: ${type}`, async () => {
        const command = createGenerateCommand();
        command.exitOverride();

        await command.parseAsync([type], { from: 'user' });

        expect(exitCode).toBe(0);
        expect(mockOrchestrator.run).toHaveBeenCalledWith(
          type,
          expect.any(Object)
        );
      });
    });
  });
});

describe('overlay command - list subcommand', () => {
  let mockWorkspaceManager: {
    resolvePgcRoot: ReturnType<typeof vi.fn>;
  };
  let mockVectorStore: {
    initialize: ReturnType<typeof vi.fn>;
    getAllVectors: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let exitCode: number | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    chalk.level = 0;
    exitCode = undefined;

    // Mock console methods
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock process.exit to capture code (don't throw - causes hangs in fork pool)
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      exitCode = code as number;
      return undefined as never;
    });

    // Create mock instances
    mockWorkspaceManager = {
      resolvePgcRoot: vi.fn().mockReturnValue('/test/project'),
    };

    mockVectorStore = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getAllVectors: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const { WorkspaceManager } =
      await import('../../core/workspace-manager.js');
    vi.mocked(WorkspaceManager).mockImplementation(
      () => mockWorkspaceManager as unknown as typeof WorkspaceManager.prototype
    );

    const { LanceVectorStore } =
      await import('../../core/overlays/vector-db/lance-store.js');
    vi.mocked(LanceVectorStore).mockImplementation(
      () => mockVectorStore as unknown as typeof LanceVectorStore.prototype
    );

    const fs = (await import('fs-extra')).default;
    vi.mocked(fs.pathExists).mockResolvedValue(false);
    vi.mocked(fs.readJSON).mockResolvedValue({});
    vi.mocked(fs.readFile).mockResolvedValue('');
    vi.mocked(fs.readdir).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic command structure', () => {
    it('should have correct name and description', () => {
      const command = createListCommand();
      expect(command.name()).toBe('list');
      expect(command.description()).toContain('List available overlay');
      expect(command.description()).toContain('status');
    });

    it('should not require any arguments', () => {
      const command = createListCommand();
      const args = command.args;
      expect(args).toHaveLength(0);
    });
  });

  describe('workspace validation', () => {
    it('should exit if no .open_cognition workspace found', async () => {
      mockWorkspaceManager.resolvePgcRoot.mockReturnValue(null);

      const command = createListCommand();
      command.exitOverride();

      await command.parseAsync([], { from: 'user' });

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('No .open_cognition workspace found')
      );
    });

    it('should proceed if workspace exists', async () => {
      mockWorkspaceManager.resolvePgcRoot.mockReturnValue('/test/project');

      const command = createListCommand();
      await command.parseAsync([], { from: 'user' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Available Overlay Types')
      );
      expect(mockVectorStore.close).toHaveBeenCalled();
    });
  });

  describe('overlay status detection', () => {
    it('should show "not generated" for missing overlays', async () => {
      const fs = (await import('fs-extra')).default;
      vi.mocked(fs.pathExists).mockResolvedValue(false);

      const command = createListCommand();
      await command.parseAsync([], { from: 'user' });

      const logCalls = mockConsoleLog.mock.calls
        .map((call: unknown[]) => call[0])
        .join('\n');
      expect(logCalls).toContain('not generated');
    });

    it('should detect structural_patterns from manifest and vectors', async () => {
      const fs = (await import('fs-extra')).default;

      vi.mocked(fs.pathExists).mockImplementation(((path: string) => {
        if (path.includes('structural_patterns/manifest.json')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      }) as unknown as typeof fs.pathExists);

      vi.mocked(fs.readJSON).mockResolvedValue({
        pattern1: {},
        pattern2: {},
        pattern3: {},
        pattern4: {},
        pattern5: {},
        pattern6: {},
        pattern7: {},
        pattern8: {},
        pattern9: {},
        pattern10: {},
      });

      mockVectorStore.getAllVectors.mockResolvedValue(
        Array(10).fill({ id: 'test' })
      );

      const command = createListCommand();
      await command.parseAsync([], { from: 'user' });

      const logCalls = mockConsoleLog.mock.calls
        .map((call: unknown[]) => call[0])
        .join('\n');
      expect(logCalls).toContain('10 patterns');
    });

    it('should detect security_guidelines from YAML files', async () => {
      const fs = (await import('fs-extra')).default;

      vi.mocked(fs.pathExists).mockImplementation(((path: string) => {
        if (path.includes('security_guidelines')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      }) as unknown as typeof fs.pathExists);

      vi.mocked(fs.readdir).mockResolvedValue([
        'security1.yaml',
        'security2.yaml',
        'security3.yaml',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const command = createListCommand();
      await command.parseAsync([], { from: 'user' });

      const logCalls = mockConsoleLog.mock.calls
        .map((call: unknown[]) => call[0])
        .join('\n');
      expect(logCalls).toContain('3 security document(s)');
    });

    it('should detect strategic_coherence from coherence.yaml', async () => {
      const fs = (await import('fs-extra')).default;
      const yaml = await import('yaml');

      vi.mocked(fs.pathExists).mockImplementation(((path: string) => {
        if (path.includes('strategic_coherence/coherence.yaml')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      }) as unknown as typeof fs.pathExists);

      vi.mocked(fs.readFile).mockResolvedValue(
        'test: data' as unknown as Buffer
      );

      vi.mocked(yaml.parse).mockReturnValue({
        symbol_coherence: Array(100).fill({}),
        overall_metrics: {
          aligned_symbols_count: 85,
          drifted_symbols_count: 15,
        },
      });

      const command = createListCommand();
      await command.parseAsync([], { from: 'user' });

      const logCalls = mockConsoleLog.mock.calls
        .map((call: unknown[]) => call[0])
        .join('\n');
      expect(logCalls).toContain('100 symbols analyzed');
      expect(logCalls).toContain('85 aligned');
      expect(logCalls).toContain('15 drifted');
    });

    it('should show mismatch warning for structural_patterns', async () => {
      const fs = (await import('fs-extra')).default;

      vi.mocked(fs.pathExists).mockImplementation(((path: string) => {
        if (path.includes('structural_patterns/manifest.json')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      }) as unknown as typeof fs.pathExists);

      vi.mocked(fs.readJSON).mockResolvedValue({
        p1: {},
        p2: {},
        p3: {},
        p4: {},
        p5: {},
        p6: {},
        p7: {},
        p8: {},
        p9: {},
        p10: {},
      });

      mockVectorStore.getAllVectors.mockResolvedValue(
        Array(5).fill({ id: 'test' })
      );

      const command = createListCommand();
      await command.parseAsync([], { from: 'user' });

      const logCalls = mockConsoleLog.mock.calls
        .map((call: unknown[]) => call[0])
        .join('\n');
      expect(logCalls).toContain('manifest: 10');
      expect(logCalls).toContain('embeddings: 5');
    });
  });

  describe('all overlay types', () => {
    it('should list all 7 overlay types', async () => {
      const command = createListCommand();
      await command.parseAsync([], { from: 'user' });

      const logCalls = mockConsoleLog.mock.calls
        .map((call) => call[0])
        .join('\n');

      expect(logCalls).toContain('structural_patterns');
      expect(logCalls).toContain('security_guidelines');
      expect(logCalls).toContain('lineage_patterns');
      expect(logCalls).toContain('mission_concepts');
      expect(logCalls).toContain('operational_patterns');
      expect(logCalls).toContain('mathematical_proofs');
      expect(logCalls).toContain('strategic_coherence');
    });

    it('should include overlay descriptions', async () => {
      const command = createListCommand();
      await command.parseAsync([], { from: 'user' });

      const logCalls = mockConsoleLog.mock.calls
        .map((call) => call[0])
        .join('\n');

      expect(logCalls).toContain('O₁:');
      expect(logCalls).toContain('O₂:');
      expect(logCalls).toContain('O₃:');
      expect(logCalls).toContain('O₄:');
      expect(logCalls).toContain('O₅:');
      expect(logCalls).toContain('O₆:');
      expect(logCalls).toContain('O₇:');
    });

    it('should show usage examples', async () => {
      const command = createListCommand();
      await command.parseAsync([], { from: 'user' });

      const logCalls = mockConsoleLog.mock.calls
        .map((call) => call[0])
        .join('\n');

      expect(logCalls).toContain('cognition-cli overlay generate');
      expect(logCalls).toContain('Usage');
    });
  });

  describe('error handling', () => {
    it('should handle vector store initialization error gracefully', async () => {
      mockVectorStore.initialize.mockRejectedValue(
        new Error('Vector store error')
      );

      const command = createListCommand();
      await command.parseAsync([], { from: 'user' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Available Overlay Types')
      );
    });

    it('should handle manifest read error gracefully', async () => {
      const fs = (await import('fs-extra')).default;

      vi.mocked(fs.pathExists).mockImplementation((async (path: string) => {
        if (
          path.includes('structural_patterns') &&
          path.includes('manifest.json')
        ) {
          return true;
        }
        return false;
      }) as unknown as typeof fs.pathExists);

      vi.mocked(fs.readJSON).mockRejectedValue(new Error('Invalid JSON'));

      const command = createListCommand();
      await command.parseAsync([], { from: 'user' });

      const logCalls = mockConsoleLog.mock.calls
        .map((call: unknown[]) => call[0])
        .join('\n');
      expect(logCalls).toContain('error reading manifest');
    });

    it('should handle coherence.yaml parse error gracefully', async () => {
      const fs = (await import('fs-extra')).default;
      const yaml = await import('yaml');

      vi.mocked(fs.pathExists).mockImplementation(((path: string) => {
        if (path.includes('coherence.yaml')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      }) as unknown as typeof fs.pathExists);

      vi.mocked(fs.readFile).mockResolvedValue(
        'invalid: yaml: content:' as unknown as Buffer
      );
      vi.mocked(yaml.parse).mockImplementation(() => {
        throw new Error('Invalid YAML');
      });

      const command = createListCommand();
      await command.parseAsync([], { from: 'user' });

      const logCalls = mockConsoleLog.mock.calls
        .map((call: unknown[]) => call[0])
        .join('\n');
      expect(logCalls).toContain('error reading overlay');
    });

    it('should close vector store even on error', async () => {
      mockVectorStore.getAllVectors.mockRejectedValue(
        new Error('Vector error')
      );

      const command = createListCommand();
      await command.parseAsync([], { from: 'user' });

      expect(mockVectorStore.close).toHaveBeenCalled();
    });
  });
});
