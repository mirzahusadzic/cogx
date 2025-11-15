/**
 * Document Integrity Oracle for Grounded Context Pool (PGC)
 *
 * Validates the integrity of ingested documentation stored in PGC. Ensures
 * that document index entries correctly reference their objects in the store,
 * transform logs exist, and no orphaned data remains.
 *
 * DESIGN PHILOSOPHY:
 * Documentation is the strategic knowledge base. The DocsOracle ensures
 * this knowledge remains consistent, traceable, and free of corruption.
 *
 * VALIDATION LAYERS:
 * - Index Integrity: Document index entries reference existing objects
 * - Content Integrity: Content hashes match stored object hashes
 * - Provenance Integrity: Transform logs exist for all documents
 * - Orphan Detection: No documents exist in store without index entries
 *
 * STORAGE STRUCTURE:
 * ```
 * index/docs/
 *   security-auth.json        # Index entry
 * objects/{shard}/{hash}       # DocumentObject
 * logs/transforms/
 *   {transform-id}.json        # Transform log (genesis_doc)
 * ```
 *
 * @example
 * // Validate document integrity
 * const oracle = new DocsOracle(pgcManager);
 * const result = await oracle.verify();
 * if (!result.success) {
 *   console.error('Document integrity issues:', result.messages);
 *   throw new Error('Cannot proceed with corrupted document store');
 * }
 *
 * @example
 * // List all indexed documents
 * const docs = await oracle.listDocuments();
 * console.log(`Found ${docs.length} indexed documents:`);
 * docs.forEach(doc => {
 *   console.log(`  - ${doc.filePath} (${doc.contentHash.slice(0, 8)}...)`);
 * });
 *
 * @example
 * // Clean up orphaned objects during maintenance
 * const removedCount = await oracle.cleanupOrphanedObjects();
 * console.log(`Removed ${removedCount} orphaned document objects`);
 */

import { PGCManager } from '../manager.js';
import { VerificationResult } from '../../types/verification.js';
import path from 'path';
import fs from 'fs-extra';

/**
 * Validates document entries in the Grounded Context Pool (PGC) index/docs/ directory.
 *
 * Ensures referential integrity between document index and object store,
 * and provides utilities for document management and garbage collection.
 */
export class DocsOracle {
  /**
   * Create a new document integrity validator
   *
   * @param pgcManager - PGC manager instance for accessing index and object store
   */
  constructor(private pgcManager: PGCManager) {}

  /**
   * Verify document integrity in Grounded Context Pool (PGC)
   *
   * VALIDATION CHECKS:
   * 1. Document index entries exist in object store (objectHash valid)
   * 2. Content hashes match between index and stored object
   * 3. Transform logs exist for document ingestion (genesis_doc)
   * 4. No orphaned document objects (in store but not indexed)
   *
   * ALGORITHM:
   * Phase 1 - Index Validation:
   *   - For each index/docs/*.json entry:
   *     - Verify objectHash exists in object store
   *     - Retrieve object and verify contentHash matches
   *     - Find corresponding transform log
   *
   * Phase 2 - Orphan Detection:
   *   - Scan all genesis_doc transform logs
   *   - Build set of indexed document hashes
   *   - Find documents in store but not in index
   *
   * @returns Verification result with detailed diagnostic messages
   *
   * @example
   * // Validate before critical documentation query
   * const oracle = new DocsOracle(pgcManager);
   * const result = await oracle.verify();
   * if (!result.success) {
   *   console.error('Document store corrupted:', result.messages);
   *   process.exit(1);
   * }
   *
   * @example
   * // Periodic integrity check
   * const result = await oracle.verify();
   * console.log(`Document validation: ${result.success ? 'PASS' : 'FAIL'}`);
   * result.messages.forEach(msg => console.log(`  ${msg}`));
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
   * Find document objects in store that are not indexed (orphaned)
   *
   * ALGORITHM:
   * 1. Build set of indexed document hashes from index/docs/*.json
   * 2. Scan transform logs for genesis_doc outputs
   * 3. For each genesis_doc output:
   *    - Check if hash is indexed
   *    - Check if hash still exists in object store
   *    - If not indexed but exists, it's orphaned
   *
   * ORPHAN CAUSES:
   * - Document removed from index but not from store
   * - Failed cleanup during document deletion
   * - Index corruption or manual editing
   *
   * @returns Array of orphaned document object hashes
   *
   * @example
   * // Internal use by verify() method
   * const orphaned = await this.findOrphanedDocuments();
   * if (orphaned.length > 0) {
   *   console.warn(`Found ${orphaned.length} orphaned documents`);
   * }
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
   *
   * Scans index/docs/ directory and returns metadata for all indexed documents.
   * Useful for reporting, debugging, and document discovery.
   *
   * @returns Array of document metadata from index entries
   *
   * @example
   * // List all documentation
   * const docs = await oracle.listDocuments();
   * console.log('Indexed Documents:');
   * docs.forEach(doc => {
   *   console.log(`  ${doc.fileName}: ${doc.filePath}`);
   *   console.log(`    Content: ${doc.contentHash.slice(0, 8)}...`);
   *   console.log(`    Indexed: ${doc.timestamp}`);
   * });
   *
   * @example
   * // Find documents by path pattern
   * const docs = await oracle.listDocuments();
   * const securityDocs = docs.filter(d => d.filePath.includes('security'));
   * console.log(`Found ${securityDocs.length} security documents`);
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
   * Remove stale document index entries (garbage collection)
   *
   * Used by garbage collector to clean up index entries that reference
   * objects that no longer exist in the store.
   *
   * ALGORITHM:
   * 1. For each index/docs/*.json entry:
   *    - Check if objectHash is in staleHashes set
   *    - If stale, delete the index file
   *    - Increment removal counter
   *
   * @param staleHashes - Set of object hashes that no longer exist
   * @returns Number of index entries removed
   *
   * @example
   * // Called by garbage collector
   * const staleHashes = new Set(['abc123...', 'def456...']);
   * const removed = await oracle.removeStaleEntries(staleHashes);
   * console.log(`Removed ${removed} stale document index entries`);
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
   * Clean up orphaned document objects (garbage collection)
   *
   * Removes document objects that exist in the store but have no
   * corresponding index entry. This is the reverse of removeStaleEntries
   * (which removes stale index entries, not objects).
   *
   * ALGORITHM:
   * 1. Call findOrphanedDocuments() to identify orphans
   * 2. For each orphaned hash:
   *    - Delete object from store
   *    - Increment removal counter
   * 3. Return total removed count
   *
   * SAFETY:
   * - Only removes objects identified as orphaned
   * - Does not remove objects with valid index entries
   * - Logs failures but continues processing
   *
   * @returns Number of orphaned objects deleted
   *
   * @example
   * // Periodic cleanup during maintenance
   * const oracle = new DocsOracle(pgcManager);
   * const removed = await oracle.cleanupOrphanedObjects();
   * if (removed > 0) {
   *   console.log(`Cleaned up ${removed} orphaned document objects`);
   * }
   *
   * @example
   * // After detecting orphans during verification
   * const result = await oracle.verify();
   * if (!result.success && result.messages.some(m => m.includes('orphaned'))) {
   *   console.log('Cleaning up orphaned objects...');
   *   await oracle.cleanupOrphanedObjects();
   * }
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
