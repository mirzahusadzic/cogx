import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { vol } from 'memfs';

import { GenesisOrchestrator } from './genesis-orchestrator.js';
import { PGCManager } from '../core/pgc-manager.js';
import { StructuralMiner } from '../miners/structural-miner.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import type { StructuralData } from '../types/structural.js';

// Mock fs-extra to use memfs
vi.mock('fs-extra', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  const promises = memfs.fs.promises;
  return {
    default: {
      ...promises,
      ensureDir: (path: string) => promises.mkdir(path, { recursive: true }),
      ensureFile: promises.writeFile, // Simplified for this test
      pathExists: async (path: string) => {
        try {
          await promises.stat(path);
          return true;
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'ENOENT'
          ) {
            return false;
          }
          throw error;
        }
      },
      writeJSON: (
        path: string,
        object: object,
        options?: { spaces?: number }
      ) =>
        promises.writeFile(
          path,
          JSON.stringify(object, null, options?.spaces || 0)
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
    await fs.ensureDir(path.join(projectRoot, 'src'));

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
    workbenchClient = {} as WorkbenchClient;

    pgcManager = new PGCManager(projectRoot);
    orchestrator = new GenesisOrchestrator(
      pgcManager,
      structuralMiner,
      workbenchClient,
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
