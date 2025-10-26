import { describe, it, expect, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { GenesisDocTransform } from './genesis-doc-transform.js';
import fs from 'fs-extra';
import path from 'path';

// Mock fs-extra to use memfs
vi.mock('fs-extra', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  const promises = memfs.fs.promises;

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
      ...promises,
      pathExists,
      ensureDir: (path: string) => promises.mkdir(path, { recursive: true }),
      remove: (path: string) =>
        promises.rm(path, { recursive: true, force: true }),
      writeFile: promises.writeFile,
      readFile: promises.readFile,
      stat: promises.stat,
    },
  };
});

// Mock fs/promises
vi.mock('fs/promises', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

describe('GenesisDocTransform', () => {
  const pgcRoot = '/test-pgc';
  let transform: GenesisDocTransform;

  beforeEach(() => {
    vol.reset();
    // Setup PGC directory structure
    vol.fromJSON({
      [`${pgcRoot}/objects/.gitkeep`]: '',
      [`${pgcRoot}/logs/.gitkeep`]: '',
      [`${pgcRoot}/index/.gitkeep`]: '',
    });
    transform = new GenesisDocTransform(pgcRoot);
  });

  describe('execute', () => {
    it('should ingest markdown file into PGC', async () => {
      const content = `# Test Document

This is a test document.

## Section 1

Content for section 1.
`;

      vol.fromJSON({
        '/test.md': content,
      });

      const result = await transform.execute('/test.md');

      expect(result.transformId).toBeTruthy();
      expect(result.outputHash).toBeTruthy();
      expect(result.outputHash.length).toBe(64); // SHA-256 hex
      expect(result.fidelity).toBe(1.0);
      expect(result.verified).toBe(true);
    });

    it('should store document object in objects/', async () => {
      const content = `# Test

Content here.
`;

      vol.fromJSON({
        '/test.md': content,
      });

      const result = await transform.execute('/test.md');

      // The outputHash is the content hash
      // The object is stored by its JSON hash
      // We can find it through the transform log

      const logPath = path.join(
        pgcRoot,
        'logs',
        'transforms',
        `${result.transformId}.json`
      );
      const logContent = await fs.readFile(logPath, 'utf-8');
      const log = JSON.parse(logContent);
      const objectHash = log.outputs[0].hash;

      // Check that object was stored
      const objectPath = path.join(
        pgcRoot,
        'objects',
        objectHash.slice(0, 2),
        objectHash.slice(2)
      );

      const exists = await fs.pathExists(objectPath);
      expect(exists).toBe(true);

      // Read and verify object
      const storedContent = await fs.readFile(objectPath, 'utf-8');
      const docObject = JSON.parse(storedContent);

      expect(docObject.type).toBe('markdown_document');
      expect(docObject.hash).toBe(result.outputHash); // Content hash
      expect(docObject.content).toBe(content);
      expect(docObject.ast).toBeTruthy();
    });

    it('should create transform log entry', async () => {
      const content = `# Test Doc

Content.
`;

      vol.fromJSON({
        '/test.md': content,
      });

      const result = await transform.execute('/test.md');

      // Check transform log exists
      const logPath = path.join(
        pgcRoot,
        'logs',
        'transforms',
        `${result.transformId}.json`
      );

      const exists = await fs.pathExists(logPath);
      expect(exists).toBe(true);

      // Read and verify log
      const logContent = await fs.readFile(logPath, 'utf-8');
      const log = JSON.parse(logContent);

      expect(log.transform_id).toBe(result.transformId);
      expect(log.type).toBe('genesis_doc');
      expect(log.method).toBe('markdown-ast-parse');
      expect(log.inputs.source_file).toBe('test.md'); // Relative path (portable)
      expect(log.outputs[0].hash).toBeTruthy(); // Object hash
      expect(log.outputs[0].type).toBe('markdown_document');
      expect(log.fidelity).toBe(1.0);
      expect(log.verified).toBe(true);
      expect(log.provenance.content_hash).toBe(result.outputHash); // Content hash
    });

    it('should update index with file path mapping', async () => {
      const content = `# Index Test

Content.
`;

      vol.fromJSON({
        '/docs/README.md': content,
      });

      const result = await transform.execute('/docs/README.md');

      // Check index entry exists
      const indexPath = path.join(pgcRoot, 'index', 'docs', 'README.md.json');

      const exists = await fs.pathExists(indexPath);
      expect(exists).toBe(true);

      // Read and verify index
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexContent);

      expect(index.filePath).toBe('docs/README.md'); // Relative path (portable)
      expect(index.contentHash).toBe(result.outputHash); // Content hash
      expect(index.objectHash).toBeTruthy(); // Object hash
      expect(index.timestamp).toBeTruthy();
    });

    it('should reject non-markdown files', async () => {
      vol.fromJSON({
        '/test.txt': 'Not markdown',
      });

      await expect(transform.execute('/test.txt')).rejects.toThrow(
        'Not a markdown file'
      );
    });

    it('should reject files that are too large', async () => {
      // Create a large file (> 10MB)
      const largeContent = 'x'.repeat(11 * 1024 * 1024);

      vol.fromJSON({
        '/large.md': largeContent,
      });

      await expect(transform.execute('/large.md')).rejects.toThrow(
        'File too large'
      );
    });

    it('should compute consistent hashes', async () => {
      const content = `# Consistent

Same content = same hash.
`;

      vol.fromJSON({
        '/test1.md': content,
        '/test2.md': content,
      });

      const result1 = await transform.execute('/test1.md');

      // Reset for second execution
      vol.fromJSON({
        [`${pgcRoot}/objects/.gitkeep`]: '',
        [`${pgcRoot}/logs/.gitkeep`]: '',
        [`${pgcRoot}/index/.gitkeep`]: '',
        '/test1.md': content,
        '/test2.md': content,
      });

      const result2 = await transform.execute('/test2.md');

      expect(result1.outputHash).toBe(result2.outputHash);
    });

    it('should handle complex markdown with sections', async () => {
      const content = `# Main Title

Introduction paragraph.

## Section A

### Subsection A1

Content A1.

### Subsection A2

Content A2.

## Section B

Content B.
`;

      vol.fromJSON({
        '/complex.md': content,
      });

      const result = await transform.execute('/complex.md');

      // Get object hash from transform log
      const logPath = path.join(
        pgcRoot,
        'logs',
        'transforms',
        `${result.transformId}.json`
      );
      const logContent = await fs.readFile(logPath, 'utf-8');
      const log = JSON.parse(logContent);
      const objectHash = log.outputs[0].hash;

      // Read stored object and verify structure
      const objectPath = path.join(
        pgcRoot,
        'objects',
        objectHash.slice(0, 2),
        objectHash.slice(2)
      );

      const storedContent = await fs.readFile(objectPath, 'utf-8');
      const docObject = JSON.parse(storedContent);

      expect(docObject.ast.sections.length).toBe(1); // H1 at top
      expect(docObject.ast.sections[0].heading).toBe('Main Title');
      expect(docObject.ast.sections[0].children.length).toBe(2); // Section A, B

      const sectionA = docObject.ast.sections[0].children[0];
      expect(sectionA.heading).toBe('Section A');
      expect(sectionA.children.length).toBe(2); // Subsection A1, A2
    });
  });
});
