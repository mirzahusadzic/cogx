import path from 'path';
import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  type MockInstance,
} from 'vitest';
import { vol } from 'memfs';
import { statusCommand } from '../status';

let mockPgcRoot: string | null = '/test-project';

// Mock workspace manager to return a fixed project root
vi.mock('../../core/workspace-manager.js', () => {
  return {
    WorkspaceManager: class {
      resolvePgcRoot() {
        return mockPgcRoot;
      }
    },
  };
});

vi.mock('fs-extra', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  const promises = memfs.fs.promises;

  return {
    default: {
      ...promises,
      pathExists: async (p: string) => {
        try {
          await promises.access(p);
          return true;
        } catch {
          return false;
        }
      },
      ensureDir: (p: string) => promises.mkdir(p, { recursive: true }),
      remove: (p: string) => promises.rm(p, { recursive: true, force: true }),
      writeFile: (p: string, data: string) => promises.writeFile(p, data),
      readFile: (p: string, encoding: string) => promises.readFile(p, encoding),
      writeJSON: (p: string, data: unknown) =>
        promises.writeFile(p, JSON.stringify(data, null, 2)),
      readJSON: async (p: string) => {
        const content = await promises.readFile(p, 'utf-8');
        return JSON.parse(content as string);
      },
    },
  };
});

describe('statusCommand', () => {
  const projectRoot = '/test-project';
  const pgcRoot = path.join(projectRoot, '.open_cognition');
  const dirtyStatePath = path.join(pgcRoot, 'dirty_state.json');

  let exitSpy: MockInstance<[code?: number | undefined], never>;

  beforeEach(() => {
    vol.reset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as (
        code?: number | undefined
      ) => never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should report coherent state when no files are dirty', async () => {
    const dirtyState = {
      last_updated: new Date().toISOString(),
      dirty_files: [],
      untracked_files: [],
    };

    vol.fromJSON({
      [dirtyStatePath]: JSON.stringify(dirtyState),
    });

    await statusCommand({});

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('PGC Status: COHERENT')
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should report incoherent state when files are dirty', async () => {
    const dirtyState = {
      last_updated: new Date().toISOString(),
      dirty_files: [
        {
          path: 'src/app.ts',
          tracked_hash: 'old-hash',
          current_hash: 'new-hash',
          change_type: 'modified',
          detected_at: new Date().toISOString(),
        },
      ],
      untracked_files: [],
    };

    vol.fromJSON({
      [dirtyStatePath]: JSON.stringify(dirtyState),
    });

    await statusCommand({});

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('PGC Status: INCOHERENT')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Modified files: 1')
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should output JSON when --json flag is provided', async () => {
    const dirtyState = {
      last_updated: new Date().toISOString(),
      dirty_files: [],
      untracked_files: [],
    };

    vol.fromJSON({
      [dirtyStatePath]: JSON.stringify(dirtyState),
    });

    await statusCommand({ json: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const lastCall = logCalls[logCalls.length - 1][0] as string;
    const parsed = JSON.parse(lastCall);
    expect(parsed.status).toBe('coherent');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle missing workspace', async () => {
    mockPgcRoot = null;

    await statusCommand({});

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No .open_cognition workspace found')
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    mockPgcRoot = '/test-project';
  });
});
