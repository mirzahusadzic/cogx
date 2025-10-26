import { MarkdownParser } from '../parsers/markdown-parser.js';
import { ObjectStore } from '../pgc/object-store.js';
import {
  DocumentObject,
  TransformResult,
  TransformLog,
} from '../pgc/document-object.js';
import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { basename } from 'path';
import fs from 'fs-extra';
import path from 'path';

/**
 * Genesis transform for documentation
 * Ingests markdown files into PGC with full provenance tracking
 */
export class GenesisDocTransform {
  private parser: MarkdownParser;
  private objectStore: ObjectStore;

  constructor(private pgcRoot: string) {
    this.parser = new MarkdownParser();
    this.objectStore = new ObjectStore(pgcRoot);
  }

  /**
   * Execute genesis transform on a markdown file
   */
  async execute(filePath: string): Promise<TransformResult> {
    // 1. Validate file exists and is markdown
    await this.validateMarkdownFile(filePath);

    // 2. Parse markdown into AST
    const ast = await this.parser.parse(filePath);

    // 3. Read raw content
    const content = await readFile(filePath, 'utf-8');

    // 4. Compute document hash
    const hash = this.computeHash(content);

    // 5. Create document object
    const docObject: DocumentObject = {
      type: 'markdown_document',
      hash,
      filePath,
      content,
      ast,
      metadata: {
        title: ast.metadata.title,
        author: ast.metadata.author,
        created: ast.metadata.date,
        modified: new Date().toISOString(),
      },
    };

    // 6. Store in objects/
    const objectHash = await this.storeDocumentObject(docObject);

    // 7. Create transform ID
    const transformId = this.generateTransformId(filePath, hash);

    // 8. Create and store transform log
    const transformLog = this.createTransformLog(
      transformId,
      filePath,
      hash,
      objectHash
    );
    await this.storeTransformLog(transformLog);

    // 9. Update index mapping (file path → hash)
    await this.updateIndex(filePath, hash);

    return {
      transformId,
      outputHash: hash,
      fidelity: 1.0, // Parsing is deterministic
      verified: true,
    };
  }

  /**
   * Validate markdown file
   */
  private async validateMarkdownFile(filePath: string): Promise<void> {
    const stats = await stat(filePath);

    if (!stats.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }

    if (!filePath.endsWith('.md')) {
      throw new Error(`Not a markdown file: ${filePath}`);
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (stats.size > maxSize) {
      throw new Error(
        `File too large: ${stats.size} bytes (max ${maxSize} bytes)`
      );
    }
  }

  /**
   * Compute SHA-256 hash
   */
  private computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate transform ID
   */
  private generateTransformId(filePath: string, hash: string): string {
    const timestamp = new Date().toISOString();
    const data = `genesis_doc:${filePath}:${hash}:${timestamp}`;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Store document object in objects/
   * Note: The object is stored by its JSON hash, which differs from doc.hash (content hash)
   */
  private async storeDocumentObject(doc: DocumentObject): Promise<string> {
    const content = JSON.stringify(doc, null, 2);
    const objectHash = await this.objectStore.store(content);
    return objectHash;
  }

  /**
   * Create transform log entry
   */
  private createTransformLog(
    transformId: string,
    filePath: string,
    contentHash: string,
    objectHash: string
  ): TransformLog {
    return {
      transform_id: transformId,
      type: 'genesis_doc',
      timestamp: new Date().toISOString(),
      method: 'markdown-ast-parse',
      inputs: {
        source_file: filePath,
      },
      outputs: [
        {
          hash: objectHash,
          type: 'markdown_document',
          semantic_path: filePath,
        },
      ],
      fidelity: 1.0,
      verified: true,
      provenance: {
        parser: 'remark@15.0.0',
        content_hash: contentHash,
      },
    };
  }

  /**
   * Store transform log
   */
  private async storeTransformLog(log: TransformLog): Promise<void> {
    const logsDir = path.join(this.pgcRoot, 'logs', 'transforms');
    await fs.ensureDir(logsDir);

    const logPath = path.join(logsDir, `${log.transform_id}.json`);
    await fs.writeFile(logPath, JSON.stringify(log, null, 2));
  }

  /**
   * Update index mapping (file path → hash)
   */
  private async updateIndex(filePath: string, hash: string): Promise<void> {
    const indexDir = path.join(this.pgcRoot, 'index', 'docs');
    await fs.ensureDir(indexDir);

    const fileName = basename(filePath);
    const indexPath = path.join(indexDir, `${fileName}.json`);

    const indexEntry = {
      filePath,
      hash,
      timestamp: new Date().toISOString(),
    };

    await fs.writeFile(indexPath, JSON.stringify(indexEntry, null, 2));
  }
}
