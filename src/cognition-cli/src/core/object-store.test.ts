import { describe, it, expect, beforeEach } from 'vitest';
import { vol } from 'memfs';
import crypto from 'node:crypto';
import { ObjectStore } from './object-store.js';

// Mock the fs-extra module to use memfs
vi.mock('fs-extra', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  const promises = memfs.fs.promises;

  // fs-extra's pathExists is essentially an async version of fs.exists
  const pathExists = async (path: string) => {
    try {
      await promises.access(path);
      return true;
    } catch {
      return false;
    }
  };

  return {
    default: {
      // Spread the original promise-based functions from memfs
      ...promises,
      // Add the fs-extra specific ones we use
      pathExists: pathExists,
      ensureDir: (path: string) => promises.mkdir(path, { recursive: true }),
      remove: (path: string) =>
        promises.rm(path, { recursive: true, force: true }),
    },
  };
});

describe('ObjectStore', () => {
  let objectStore: ObjectStore;
  const pgcRoot = '/test-pgc';

  beforeEach(() => {
    vol.reset(); // Clear the in-memory filesystem before each test
    objectStore = new ObjectStore(pgcRoot);
  });

  it('should store content and return the correct hash', async () => {
    const content = 'Hello, CogX!';
    const hash = await objectStore.store(content);

    const expectedHash = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
    expect(hash).toBe(expectedHash);
  });

  it('should create the correct file in the sharded directory', async () => {
    const content = 'Hello, CogX!';
    const hash = await objectStore.store(content);

    const fileExists = await objectStore.exists(hash);
    const storedContent = await objectStore.retrieve(hash);

    expect(fileExists).toBe(true);
    expect(storedContent.toString()).toBe(content);

    // Directly check the volume to be sure, using the *actual* hash
    const dirToCheck = `/test-pgc/objects/${hash.slice(0, 2)}`;
    const files = vol.readdirSync(dirToCheck, { recursive: true });
    expect(files).toContain(hash.slice(2));
  });

  it('should not write the file if it already exists (deduplication)', async () => {
    const content = 'Duplicate content';
    const hash = await objectStore.store(content);

    const hash2 = await objectStore.store(content);
    expect(hash2).toBe(hash);
  });
});
