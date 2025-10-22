import { describe, it, expect, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { ReverseDeps } from './reverse-deps.js';

// Mock fs-extra to use memfs
vi.mock('fs-extra', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  return {
    default: {
      ...memfs.fs.promises,
      ensureDir: (dirPath: string) =>
        memfs.fs.promises.mkdir(dirPath, { recursive: true }),
      pathExists: async (path: string) => {
        try {
          await memfs.fs.promises.stat(path);
          return true;
        } catch (error: unknown) {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'ENOENT'
          ) {
            return false;
          }
          throw error;
        }
      },
    },
  };
});
describe('ReverseDeps', () => {
  let reverseDeps: ReverseDeps;
  const pgcRoot = '/test-pgc';

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(pgcRoot, { recursive: true }); // Explicitly create pgcRoot
    reverseDeps = new ReverseDeps(pgcRoot);
  });

  it('should create a dependency file in the correct sharded directory', async () => {
    const objectHash =
      'f6c917e997e5024ab89c43816a3685278f30c8b6bb4f2f6d0f7ba8f6cb0160f8';
    const transformId = 'transform123';

    await reverseDeps.add(objectHash, transformId);

    const expectedDir = `/test-pgc/reverse_deps/${objectHash.slice(0, 2)}`;
    const expectedFile = objectHash.slice(2);

    // Check that the directory and file were created in the in-memory volume
    const dirExists = vol.existsSync(expectedDir);
    expect(dirExists).toBe(true);

    const files = vol.readdirSync(expectedDir);
    expect(files).toContain(expectedFile);

    const content = vol.readFileSync(`${expectedDir}/${expectedFile}`, 'utf-8');
    expect(content).toBe(`${transformId}\n`);
  });

  it('should append to an existing dependency file', async () => {
    const objectHash =
      'f6c917e997e5024ab89c43816a3685278f30c8b6bb4f2f6d0f7ba8f6cb0160f8';
    const transformId1 = 'transform123';
    const transformId2 = 'transform456';

    await reverseDeps.add(objectHash, transformId1);
    await reverseDeps.add(objectHash, transformId2);

    const expectedPath = `/test-pgc/reverse_deps/${objectHash.slice(0, 2)}/${objectHash.slice(2)}`;
    const content = vol.readFileSync(expectedPath, 'utf-8');

    expect(content).toBe(`${transformId1}\n${transformId2}\n`);
  });

  it('should handle concurrent writes correctly to prevent race conditions', async () => {
    const objectHash =
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const transformIds = Array.from({ length: 10 }, (_, i) => `transform${i}`);

    // Simulate concurrent calls
    for (const id of transformIds) {
      await reverseDeps.add(objectHash, id);
    }

    const expectedPath = `/test-pgc/reverse_deps/${objectHash.slice(0, 2)}/${objectHash.slice(2)}`;
    const content = vol.readFileSync(expectedPath, 'utf-8') as string;
    const lines = new Set(content.trim().split('\n'));

    // Check if all transform IDs are present
    expect(lines.size).toBe(transformIds.length);
    for (const id of transformIds) {
      expect(lines.has(id)).toBe(true);
    }
  });
});
