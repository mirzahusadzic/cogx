import { describe, it, expect, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { ReverseDeps } from './reverse-deps.js';

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
    },
  };
});

describe('ReverseDeps', () => {
  let reverseDeps: ReverseDeps;
  const pgcRoot = '/test-pgc';

  beforeEach(() => {
    vol.reset();
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
    expect(content).toBe(`${transformId}
`);
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

    expect(content).toBe(`${transformId1}
${transformId2}
`);
  });
});
