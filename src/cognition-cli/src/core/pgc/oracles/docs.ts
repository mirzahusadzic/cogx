import { PGCManager } from '../manager.js';
import { VerificationResult } from '../../types/verification.js';
import path from 'path';
import fs from 'fs-extra';

/**
 * DocsOracle
 *
 * Validates document entries in the PGC index/docs/ directory.
 * Ensures referential integrity between document index and object store.
 *
 * VALIDATION CHECKS:
 * 1. Document index entries exist in object store
 * 2. Content hashes match stored objects
 * 3. Transform logs exist for document ingestion
 * 4. Detect orphaned document objects (in store but not indexed)
 *
 * USAGE:
 * ```typescript
 * const oracle = new DocsOracle(pgcManager);
 * const result = await oracle.verify();
 * if (!result.success) {
 *   console.error('Document integrity issues:', result.messages);
 * }
 * ```
 */
export class DocsOracle {
  constructor(private pgcManager: PGCManager) {}

  /**
   * Verify document integrity in PGC
   */
  async verify(): Promise<VerificationResult> {
    const messages: string[] = [];
    let success = true;

    const docsIndexPath = path.join(this.pgcManager.pgcRoot, 'index', 'docs');

    // Check if docs index exists
    if (!(await fs.pathExists(docsIndexPath))) {
      messages.push(
        'No document index found (index/docs/ does not exist). This is normal if no documents have been ingested.'
      );
      return { success: true, messages }; // Not an error, just no docs yet
    }

    // Get all document index files
    const indexFiles = await fs.readdir(docsIndexPath);
    const jsonFiles = indexFiles.filter((f) => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      messages.push(
        'Document index directory exists but contains no entries. Run "genesis:docs <path>" to ingest documents.'
      );
      return { success: true, messages };
    }

    // Validate each document index entry
    for (const file of jsonFiles) {
      const indexPath = path.join(docsIndexPath, file);
      let indexData: {
        filePath: string;
        contentHash: string;
        objectHash: string;
        timestamp: string;
      };

      try {
        indexData = await fs.readJSON(indexPath);
      } catch (error) {
        messages.push(
          `Failed to read document index ${file}: ${(error as Error).message}`
        );
        success = false;
        continue;
      }

      // Check 1: Validate objectHash exists in object store
      if (!(await this.pgcManager.objectStore.exists(indexData.objectHash))) {
        messages.push(
          `Document index ${file} references non-existent objectHash: ${indexData.objectHash} (file: ${indexData.filePath})`
        );
        success = false;
      }

      // Check 2: Validate contentHash matches stored object
      try {
        const objectBuffer = await this.pgcManager.objectStore.retrieve(
          indexData.objectHash
        );
        if (objectBuffer) {
          const docObject = JSON.parse(objectBuffer.toString('utf-8'));
          if (docObject.hash !== indexData.contentHash) {
            messages.push(
              `Document ${file}: Content hash mismatch. Index: ${indexData.contentHash}, Object: ${docObject.hash}`
            );
            success = false;
          }
        }
      } catch (error) {
        messages.push(
          `Failed to verify content hash for ${file}: ${(error as Error).message}`
        );
        success = false;
      }

      // Check 3: Validate transform log exists
      const transformLogsPath = path.join(
        this.pgcManager.pgcRoot,
        'logs',
        'transforms'
      );
      if (await fs.pathExists(transformLogsPath)) {
        const transformLogs = await fs.readdir(transformLogsPath);
        // Find transform log that references this document
        let foundTransform = false;
        for (const logFile of transformLogs) {
          if (logFile.endsWith('.json')) {
            try {
              const logPath = path.join(transformLogsPath, logFile);
              const log = await fs.readJSON(logPath);
              // Check if this log's output matches the document
              if (
                log.outputs &&
                log.outputs.some(
                  (o: { hash: string }) => o.hash === indexData.objectHash
                )
              ) {
                foundTransform = true;
                break;
              }
            } catch {
              // Skip invalid log files
              continue;
            }
          }
        }

        if (!foundTransform) {
          messages.push(
            `Document ${file}: No transform log found for ${indexData.filePath}`
          );
          success = false;
        }
      }
    }

    // Check 4: Detect orphaned document objects
    // (Documents in object store but not in index)
    const orphanedDocs = await this.findOrphanedDocuments();
    if (orphanedDocs.length > 0) {
      messages.push(
        `Found ${orphanedDocs.length} orphaned document object(s) (in store but not indexed):`
      );
      orphanedDocs.forEach((hash) => {
        messages.push(`  - ${hash}`);
      });
      success = false;
    }

    if (success && messages.length === 0) {
      messages.push(
        `✓ Document integrity verified: ${jsonFiles.length} document(s) validated`
      );
    }

    return { success, messages };
  }

  /**
   * Find document objects in store that are not indexed
   */
  private async findOrphanedDocuments(): Promise<string[]> {
    const orphaned: string[] = [];

    // Get all indexed document hashes
    const docsIndexPath = path.join(this.pgcManager.pgcRoot, 'index', 'docs');
    const indexedHashes = new Set<string>();

    if (await fs.pathExists(docsIndexPath)) {
      const indexFiles = await fs.readdir(docsIndexPath);
      for (const file of indexFiles) {
        if (file.endsWith('.json')) {
          try {
            const indexData = await fs.readJSON(path.join(docsIndexPath, file));
            indexedHashes.add(indexData.objectHash);
          } catch {
            // Skip invalid index files
            continue;
          }
        }
      }
    }

    // Scan transform logs for genesis_doc transforms
    const transformLogsPath = path.join(
      this.pgcManager.pgcRoot,
      'logs',
      'transforms'
    );

    if (await fs.pathExists(transformLogsPath)) {
      const transformLogs = await fs.readdir(transformLogsPath);
      for (const logFile of transformLogs) {
        if (logFile.endsWith('.json')) {
          try {
            const logPath = path.join(transformLogsPath, logFile);
            const log = await fs.readJSON(logPath);

            // Check if this is a genesis_doc transform
            if (log.type === 'genesis_doc' && log.outputs) {
              for (const output of log.outputs) {
                if (output.type === 'markdown_document') {
                  // Check if this output is NOT indexed BUT still exists in store (orphaned)
                  if (
                    !indexedHashes.has(output.hash) &&
                    (await this.pgcManager.objectStore.exists(output.hash))
                  ) {
                    orphaned.push(output.hash);
                  }
                }
              }
            }
          } catch {
            // Skip invalid log files
            continue;
          }
        }
      }
    }

    return orphaned;
  }

  /**
   * List all documents in the index
   */
  async listDocuments(): Promise<
    Array<{
      fileName: string;
      filePath: string;
      contentHash: string;
      objectHash: string;
      timestamp: string;
    }>
  > {
    const docs: Array<{
      fileName: string;
      filePath: string;
      contentHash: string;
      objectHash: string;
      timestamp: string;
    }> = [];

    const docsIndexPath = path.join(this.pgcManager.pgcRoot, 'index', 'docs');

    if (!(await fs.pathExists(docsIndexPath))) {
      return docs;
    }

    const indexFiles = await fs.readdir(docsIndexPath);
    const jsonFiles = indexFiles.filter((f) => f.endsWith('.json'));

    for (const file of jsonFiles) {
      try {
        const indexData = await fs.readJSON(path.join(docsIndexPath, file));
        docs.push({
          fileName: file,
          ...indexData,
        });
      } catch {
        // Skip invalid files
        continue;
      }
    }

    return docs;
  }

  /**
   * Remove stale document index entries (for garbage collection)
   */
  async removeStaleEntries(staleHashes: Set<string>): Promise<number> {
    let removedCount = 0;
    const docsIndexPath = path.join(this.pgcManager.pgcRoot, 'index', 'docs');

    if (!(await fs.pathExists(docsIndexPath))) {
      return removedCount;
    }

    const indexFiles = await fs.readdir(docsIndexPath);
    const jsonFiles = indexFiles.filter((f) => f.endsWith('.json'));

    for (const file of jsonFiles) {
      try {
        const indexPath = path.join(docsIndexPath, file);
        const indexData = await fs.readJSON(indexPath);

        // Remove if object hash is stale
        if (staleHashes.has(indexData.objectHash)) {
          await fs.remove(indexPath);
          removedCount++;
        }
      } catch {
        // Skip invalid files
        continue;
      }
    }

    return removedCount;
  }

  /**
   * Clean up orphaned document objects (in object store but not indexed)
   * This is the reverse of removeStaleEntries - it removes orphaned objects, not index entries
   */
  async cleanupOrphanedObjects(): Promise<number> {
    const orphanedHashes = await this.findOrphanedDocuments();
    let removedCount = 0;

    for (const hash of orphanedHashes) {
      try {
        await this.pgcManager.objectStore.delete(hash);
        removedCount++;
      } catch (error) {
        // Log but continue - object might have been deleted already
        if (process.env.DEBUG) {
          console.warn(
            `[DocsOracle] Failed to delete orphaned object ${hash}:`,
            error
          );
        }
      }
    }

    return removedCount;
  }
}
