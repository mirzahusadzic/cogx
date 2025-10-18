import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { vol } from 'memfs'; // Keep this import for vol.reset() in beforeEach/afterEach

// Mock proper-lockfile
vi.mock('proper-lockfile', () => ({
  default: {
    lock: vi.fn(async () => vi.fn(async () => {})),
  },
}));

import { GenesisOrchestrator } from './genesis-orchestrator.js';
import { PGCManager } from '../core/pgc-manager.js';
import { StructuralMiner } from '../miners/structural-miner.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import type { StructuralData } from '../types/structural.js';
import { StructuralOracle } from '../core/oracles/structural-oracle.js';

// Mock fs-extra to use memfs's vol
vi.mock('fs-extra', async () => {
  const actualMemfs = await vi.importActual<typeof import('memfs')>('memfs');
  const actualVol = actualMemfs.vol;

  return {
    default: {
      // Explicitly define each function used
      ensureDir: (dirPath: string) =>
        actualVol.promises.mkdir(dirPath, { recursive: true }),
      pathExists: (filePath: string) =>
        Promise.resolve(actualVol.existsSync(filePath)),
      writeFile: (filePath: string, content: string | Buffer) =>
        actualVol.promises.writeFile(filePath, content),
      readFile: (filePath: string, encoding?: string) =>
        actualVol.promises.readFile(filePath, encoding),
      readdir: (dirPath: string, options?: object) =>
        actualVol.promises.readdir(dirPath, options),
      stat: (filePath: string) => actualVol.promises.stat(filePath),
      lstat: (filePath: string) => actualVol.promises.lstat(filePath),
      remove: (path: string) =>
        actualVol.promises.rm(path, { recursive: true, force: true }),
      readJSON: (filePath: string) =>
        actualVol.promises
          .readFile(filePath, 'utf-8')
          .then((content) => JSON.parse(content.toString())),
      writeJSON: (
        filePath: string,
        data: object,
        options?: { spaces?: number }
      ) =>
        actualVol.promises.writeFile(
          filePath,
          JSON.stringify(data, null, options?.spaces || 0)
        ),
    },
  };
});

describe('GenesisOrchestrator idempotency', () => {
  let pgcManager: PGCManager;
  let structuralMiner: StructuralMiner;
  let workbenchClient: WorkbenchClient;
  let orchestrator: GenesisOrchestrator;
  const projectRoot = '/test-project';

  beforeEach(async () => {
    vol.reset();
    vol.mkdirSync(projectRoot, { recursive: true }); // Explicitly create projectRoot
    vol.fromJSON({
      [path.join(projectRoot, 'src', '.gitkeep')]: '',
      [path.join(projectRoot, '.open_cognition', '.gitkeep')]: '',
    });

    // Mock StructuralMiner
    structuralMiner = {
      extractStructure: vi.fn(async (file) => {
        return {
          extraction_method: 'ast_native',
          fidelity: 1.0,
          language: file.language,
          docstring: '',
          imports: [],
          classes: [],
          functions: [],
          exports: [],
          declarations: [],
          dependencies: [],
          source_file: {
            path: file.path,
            relativePath: file.relativePath,
            name: file.name,
            language: file.language,
            content: file.content,
          },
        } as StructuralData;
      }),
    } as unknown as StructuralMiner;

    // Mock WorkbenchClient
    workbenchClient = {
      health: vi.fn(async () => ({ status: 'ok' })),
      getBaseUrl: vi.fn(() => 'http://localhost:8000'),
    } as unknown as WorkbenchClient;

    pgcManager = new PGCManager(projectRoot);
    // Mock StructuralOracle to always return success
    const structuralOracleInstance = {
      verify: vi.fn(async () => ({ success: true, messages: [] })),
    } as unknown as StructuralOracle;

    orchestrator = new GenesisOrchestrator(
      pgcManager,
      structuralMiner,
      workbenchClient,
      structuralOracleInstance, // Pass the mocked structuralOracle instance
      projectRoot
    );
  });

  afterEach(async () => {
    vol.reset();
  });

  it('should produce the same .open_cognition state on subsequent runs for the same input', async () => {
    const sourceFilePath = path.join(projectRoot, 'src', 'test-file.ts');
    const sourceFileContent = 'const a = 1; export { a };';
    await fs.writeFile(sourceFilePath, sourceFileContent);

    // First run
    await orchestrator.executeBottomUpAggregation('src');

    const firstRunOpenCognitionState = await getOpenCognitionState(projectRoot);

    // Second run
    await orchestrator.executeBottomUpAggregation('src');

    const secondRunOpenCognitionState =
      await getOpenCognitionState(projectRoot);

    // Compare the states
    expect(secondRunOpenCognitionState).toEqual(firstRunOpenCognitionState);
  });
});

async function getOpenCognitionState(
  projectRoot: string
): Promise<Record<string, string>> {
  const openCognitionPath = path.join(projectRoot, '.open_cognition');
  const state: Record<string, string> = {};

  if (!(await fs.pathExists(openCognitionPath))) {
    return state;
  }

  // Use vol.readdirSync and vol.readFileSync for memfs
  const files = vol.readdirSync(openCognitionPath, {
    recursive: true,
  }) as string[];

  for (const file of files) {
    const fullPath = path.join(openCognitionPath, file);
    // Check if it's a file before reading
    if (vol.statSync(fullPath).isFile()) {
      const content = vol.readFileSync(fullPath, 'utf-8') as string;
      state[file] = content;
    }
  }
  return state;
}
