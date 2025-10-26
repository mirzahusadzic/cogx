import { describe, it, expect, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { GenesisDocTransform } from './genesis-doc-transform.js';
import { MarkdownSection } from '../parsers/markdown-parser.js';
import fs from 'fs-extra';
import path from 'path';
import { readFileSync } from 'fs';

// Mock fs-extra to use memfs for PGC storage
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

// Mock fs/promises for reading VISION.md, but use real fs for the actual file
vi.mock('fs/promises', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  const realFs =
    await vi.importActual<typeof import('fs/promises')>('fs/promises');

  type RealFsPromises = typeof realFs;

  return {
    ...memfs.fs.promises,
    // Override readFile to read VISION.md from real filesystem
    readFile: async (filePath: string, encoding?: string) => {
      if (filePath.includes('VISION.md')) {
        return (realFs as RealFsPromises).readFile(
          filePath,
          encoding as BufferEncoding
        );
      }
      return memfs.fs.promises.readFile(filePath, encoding);
    },
    // Override stat to check VISION.md from real filesystem
    stat: async (filePath: string) => {
      if (filePath.includes('VISION.md')) {
        return (realFs as RealFsPromises).stat(filePath);
      }
      return memfs.fs.promises.stat(filePath);
    },
    default: memfs.fs.promises,
  };
});

/**
 * CRITICAL CONTRACT TEST: VISION.md Ingestion
 *
 * This test validates that our own VISION.md can be successfully ingested
 * into PGC using the GenesisDocTransform pipeline.
 *
 * WHY THIS MATTERS:
 * - VISION.md defines our mission, principles, and strategic intent
 * - If we can't ingest our own vision, the architecture is broken
 * - Every PR must pass this test to prove VISION.md is parseable
 * - This creates a self-referential contract: vision validates implementation
 *
 * WHAT THIS VALIDATES:
 * - VISION.md exists and is readable
 * - Markdown parser can handle real-world manifesto content
 * - GenesisDocTransform produces valid DocumentObject
 * - Transform logs capture full provenance
 * - Key sections (Mission, Principles, Strategic Intent) are extracted
 * - Content hashes are deterministic and verifiable
 *
 * PR MERGE REQUIREMENT:
 * If this test fails, VISION.md cannot be ingested → PR MUST NOT MERGE
 */
describe('CRITICAL: VISION.md Ingestion Contract', () => {
  const pgcRoot = '/test-pgc';
  let transform: GenesisDocTransform;
  // __dirname in source is at: src/cognition-cli/src/core/transforms/
  // VISION.md is at: ../../../../../VISION.md (go up 5 levels to cogx root)
  const visionPath = path.resolve(__dirname, '../../../../../VISION.md');

  beforeEach(() => {
    vol.reset();
    // Setup PGC directory structure in memfs
    vol.fromJSON({
      [`${pgcRoot}/objects/.gitkeep`]: '',
      [`${pgcRoot}/logs/.gitkeep`]: '',
      [`${pgcRoot}/index/.gitkeep`]: '',
    });
    transform = new GenesisDocTransform(pgcRoot);
  });

  it('VISION.md must exist in repository root', () => {
    // Validate VISION.md exists at expected path
    const visionExists = readFileSync(visionPath, 'utf-8');
    expect(visionExists).toBeTruthy();
    expect(visionExists.length).toBeGreaterThan(0);
  });

  it('VISION.md must be successfully ingested into PGC', async () => {
    const result = await transform.execute(visionPath);

    // Validate transform completed successfully
    expect(result.transformId).toBeTruthy();
    expect(result.outputHash).toBeTruthy();
    expect(result.outputHash.length).toBe(64); // SHA-256 hex
    expect(result.fidelity).toBe(1.0); // Deterministic parsing
    expect(result.verified).toBe(true);
  });

  it('VISION.md DocumentObject must be stored in objects/', async () => {
    const result = await transform.execute(visionPath);

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

    // Verify DocumentObject is stored
    const objectPath = path.join(
      pgcRoot,
      'objects',
      objectHash.slice(0, 2),
      objectHash.slice(2)
    );

    const exists = await fs.pathExists(objectPath);
    expect(exists).toBe(true);

    // Read and validate DocumentObject structure
    const storedContent = await fs.readFile(objectPath, 'utf-8');
    const docObject = JSON.parse(storedContent);

    expect(docObject.type).toBe('markdown_document');
    expect(docObject.hash).toBe(result.outputHash); // Content hash
    expect(docObject.filePath).toContain('VISION.md');
    expect(docObject.ast).toBeTruthy();
    expect(docObject.ast.sections).toBeTruthy();
  });

  it('VISION.md must contain required mission-critical sections', async () => {
    const result = await transform.execute(visionPath);

    // Get DocumentObject
    const logPath = path.join(
      pgcRoot,
      'logs',
      'transforms',
      `${result.transformId}.json`
    );
    const logContent = await fs.readFile(logPath, 'utf-8');
    const log = JSON.parse(logContent);
    const objectHash = log.outputs[0].hash;

    const objectPath = path.join(
      pgcRoot,
      'objects',
      objectHash.slice(0, 2),
      objectHash.slice(2)
    );

    const storedContent = await fs.readFile(objectPath, 'utf-8');
    const docObject = JSON.parse(storedContent);

    // Extract all section headings (recursive)
    const allHeadings: string[] = [];
    function collectHeadings(sections: MarkdownSection[]) {
      for (const section of sections) {
        allHeadings.push(section.heading.toLowerCase());
        if (section.children && section.children.length > 0) {
          collectHeadings(section.children);
        }
      }
    }
    collectHeadings(docObject.ast.sections);

    // CRITICAL: These sections MUST exist in VISION.md
    const requiredSections = [
      'mission',
      'principles',
      'strategic intent',
      'agplv3',
    ];

    for (const required of requiredSections) {
      const found = allHeadings.some((heading) => heading.includes(required));
      expect(found).toBe(true);
      if (!found) {
        throw new Error(
          `CRITICAL: VISION.md missing required section: "${required}". ` +
            `Found sections: ${allHeadings.join(', ')}`
        );
      }
    }
  });

  it('VISION.md transform log must include full provenance', async () => {
    const result = await transform.execute(visionPath);

    const logPath = path.join(
      pgcRoot,
      'logs',
      'transforms',
      `${result.transformId}.json`
    );
    const logContent = await fs.readFile(logPath, 'utf-8');
    const log = JSON.parse(logContent);

    // Validate provenance chain
    expect(log.transform_id).toBe(result.transformId);
    expect(log.type).toBe('genesis_doc');
    expect(log.method).toBe('markdown-ast-parse');
    expect(log.inputs.source_file).toContain('VISION.md');
    expect(log.fidelity).toBe(1.0);
    expect(log.verified).toBe(true);

    // Validate provenance includes both hashes
    expect(log.provenance.parser).toBe('remark@15.0.0');
    expect(log.provenance.content_hash).toBe(result.outputHash);
    expect(log.outputs[0].hash).toBeTruthy(); // Object hash
  });

  it('VISION.md content hash must be deterministic', async () => {
    // Run transform twice
    const result1 = await transform.execute(visionPath);

    // Reset and run again
    vol.reset();
    vol.fromJSON({
      [`${pgcRoot}/objects/.gitkeep`]: '',
      [`${pgcRoot}/logs/.gitkeep`]: '',
      [`${pgcRoot}/index/.gitkeep`]: '',
    });
    transform = new GenesisDocTransform(pgcRoot);

    const result2 = await transform.execute(visionPath);

    // Content hash MUST be identical (deterministic)
    expect(result1.outputHash).toBe(result2.outputHash);
  });

  it('VISION.md structural hashes must be computed for all sections', async () => {
    const result = await transform.execute(visionPath);

    // Get DocumentObject
    const logPath = path.join(
      pgcRoot,
      'logs',
      'transforms',
      `${result.transformId}.json`
    );
    const logContent = await fs.readFile(logPath, 'utf-8');
    const log = JSON.parse(logContent);
    const objectHash = log.outputs[0].hash;

    const objectPath = path.join(
      pgcRoot,
      'objects',
      objectHash.slice(0, 2),
      objectHash.slice(2)
    );

    const storedContent = await fs.readFile(objectPath, 'utf-8');
    const docObject = JSON.parse(storedContent);

    // Validate all sections have structural hashes
    function validateStructuralHashes(sections: MarkdownSection[]) {
      for (const section of sections) {
        expect(section.structuralHash).toBeTruthy();
        expect(section.structuralHash.length).toBe(64); // SHA-256 hex

        if (section.children && section.children.length > 0) {
          validateStructuralHashes(section.children);
        }
      }
    }

    validateStructuralHashes(docObject.ast.sections);
  });
});
