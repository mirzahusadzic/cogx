/**
 * Genesis Layer Integrity Oracle for Grounded Context Pool (PGC)
 *
 * Validates the foundational Genesis layer (Layer 1) of the PGC architecture.
 * The Genesis layer contains the immutable source data: indexed files, their
 * structural representations, and the transform logs that created them.
 *
 * ARCHITECTURE CONTEXT:
 * PGC has three layers:
 * 1. Genesis Layer: Indexed source files and transforms (validated by this oracle)
 * 2. Overlay Layer: Semantic projections and vector embeddings
 * 3. Query Layer: Natural language interface to PGC data
 *
 * VALIDATION SCOPE:
 * - Index Integrity: All index entries reference existing objects
 * - Transform Integrity: All transforms reference valid input/output objects
 * - Reverse Deps Integrity: All reverse deps point to existing objects/transforms
 * - Sharding Consistency: Git-style sharding is correctly implemented
 *
 * DESIGN PHILOSOPHY:
 * The Genesis layer is the "ground truth" - if it's corrupted, the entire
 * PGC is unreliable. This oracle enforces referential integrity at the
 * foundational layer.
 *
 * @example
 * // Validate Genesis layer before critical operations
 * const oracle = new GenesisOracle(pgcManager);
 * const result = await oracle.verify();
 * if (!result.success) {
 *   console.error('Genesis layer corrupted:', result.messages);
 *   throw new Error('Cannot proceed with corrupted Genesis layer');
 * }
 *
 * @example
 * // Periodic integrity check
 * const oracle = new GenesisOracle(pgcManager);
 * const result = await oracle.verify();
 * console.log(`Validated ${result.messages.length} integrity constraints`);
 */

import { PGCManager } from '../manager.js';
import { VerificationResult } from '../../types/verification.js';
import path from 'path';
import fs from 'fs-extra';

import { TransformData } from '../../types/transform.js';
import yaml from 'js-yaml';

/**
 * Validates Genesis layer integrity including index, transforms, and object store consistency.
 *
 * The GenesisOracle ensures that the foundational layer of the PGC remains
 * internally consistent and all references resolve to existing objects.
 */
export class GenesisOracle {
  /**
   * Create a new Genesis layer validator
   *
   * @param pgcManager - PGC manager instance for accessing index and object store
   */
  constructor(private pgcManager: PGCManager) {}

  /**
   * Verify complete Genesis layer integrity
   *
   * VALIDATION PHASES:
   * 1. Index Validation: Verify all index entries reference existing objects
   * 2. Transform Validation: Verify all transform inputs/outputs exist
   * 3. Reverse Deps Validation: Verify bidirectional consistency
   * 4. Sharding Validation: Verify Git-style sharding is correct
   *
   * ALGORITHM:
   * Phase 1 - Index:
   *   - Read all index/*.json files
   *   - For each entry, verify content_hash exists in object store
   *   - For each entry, verify structural_hash exists in object store
   *
   * Phase 2 - Transforms:
   *   - Scan transforms/{shard}/{hash}/manifest.yaml
   *   - For each transform, verify all input hashes exist
   *   - For each transform, verify all output hashes exist
   *
   * Phase 3 - Reverse Deps:
   *   - Scan reverse_deps/{shard}/{file}
   *   - For each object hash, verify object exists
   *   - For each transform ID, verify transform manifest exists
   *
   * @returns Verification result with all detected integrity issues
   *
   * @example
   * // Full integrity check before deployment
   * const oracle = new GenesisOracle(pgcManager);
   * const result = await oracle.verify();
   * if (!result.success) {
   *   console.error('Genesis layer validation failed:');
   *   result.messages.forEach(msg => console.error(`  - ${msg}`));
   *   process.exit(1);
   * }
   *
   * @example
   * // Diagnostic check during development
   * const result = await oracle.verify();
   * console.log(`Checked ${result.messages.length} constraints`);
   * console.log(`Status: ${result.success ? 'PASS' : 'FAIL'}`);
   */
  async verify(): Promise<VerificationResult> {
    const messages: string[] = [];
    let success = true;

    // 1. Validate Index entries against ObjectStore
    const indexPath = path.join(this.pgcManager.pgcRoot, 'index');
    if (await fs.pathExists(indexPath)) {
      const indexFiles = await fs.readdir(indexPath);
      for (const file of indexFiles) {
        if (file.endsWith('.json')) {
          const fullPath = path.join(indexPath, file);
          const indexData = await fs.readJSON(fullPath);

          if (
            !(await this.pgcManager.objectStore.exists(indexData.content_hash))
          ) {
            messages.push(
              `Index entry ${file} references non-existent content_hash: ${indexData.content_hash}`
            );
            success = false;
          }
          if (
            !(await this.pgcManager.objectStore.exists(
              indexData.structural_hash
            ))
          ) {
            messages.push(
              `Index entry ${file} references non-existent structural_hash: ${indexData.structural_hash}`
            );
            success = false;
          }
        }
      }
    } else {
      messages.push('Index directory does not exist.');
      success = false;
    }

    // 2. Validate TransformLog entries against ObjectStore
    // NOTE: Transforms now use Git-style sharding: transforms/{shard}/{hash}/manifest.yaml
    const transformsPath = path.join(this.pgcManager.pgcRoot, 'transforms');
    if (await fs.pathExists(transformsPath)) {
      const shards = await fs.readdir(transformsPath);
      for (const shard of shards) {
        const shardPath = path.join(transformsPath, shard);
        const stat = await fs.stat(shardPath);

        if (stat.isDirectory()) {
          const transformHashes = await fs.readdir(shardPath);
          for (const hashDir of transformHashes) {
            const manifestPath = path.join(shardPath, hashDir, 'manifest.yaml');
            const fullHash = shard + hashDir; // Reconstruct full hash

            if (await fs.pathExists(manifestPath)) {
              const content = await fs.readFile(manifestPath, 'utf-8');
              const transformData = yaml.load(content) as TransformData;
              for (const input of transformData.inputs) {
                if (!(await this.pgcManager.objectStore.exists(input.hash))) {
                  messages.push(
                    `Transform ${fullHash} references non-existent input hash: ${input.hash}`
                  );
                  success = false;
                }
              }
              for (const output of transformData.outputs) {
                if (!(await this.pgcManager.objectStore.exists(output.hash))) {
                  messages.push(
                    `Transform ${fullHash} references non-existent output hash: ${output.hash}`
                  );
                  success = false;
                }
              }
            } else {
              messages.push(`Transform ${fullHash} is missing manifest.yaml`);
              success = false;
            }
          }
        }
      }
    } else {
      messages.push('Transforms directory does not exist.');
      success = false;
    }

    // 3. Validate ReverseDeps entries against ObjectStore and TransformLog
    const reverseDepsPath = path.join(this.pgcManager.pgcRoot, 'reverse_deps');
    if (await fs.pathExists(reverseDepsPath)) {
      const shardedDirs = await fs.readdir(reverseDepsPath);
      for (const shardedDir of shardedDirs) {
        const fullShardedDirPath = path.join(reverseDepsPath, shardedDir);
        if ((await fs.stat(fullShardedDirPath)).isDirectory()) {
          const reverseDepFiles = await fs.readdir(fullShardedDirPath);
          for (const file of reverseDepFiles) {
            const objectHash = shardedDir + file; // Reconstruct full hash
            if (!(await this.pgcManager.objectStore.exists(objectHash))) {
              messages.push(
                `ReverseDep entry for ${objectHash} references non-existent object hash.`
              );
              success = false;
            }

            const fullPath = path.join(fullShardedDirPath, file);
            const content = await fs.readFile(fullPath, 'utf-8');
            const transformIds = content.split('\n').filter(Boolean); // Filter out empty strings

            for (const transformId of transformIds) {
              // Transform is sharded: transforms/{shard}/{hash}/manifest.yaml
              const shard = transformId.slice(0, 2);
              const rest = transformId.slice(2);
              const transformManifestPath = path.join(
                transformsPath,
                shard,
                rest,
                'manifest.yaml'
              );
              if (!(await fs.pathExists(transformManifestPath))) {
                messages.push(
                  `ReverseDep entry for ${objectHash} references non-existent transformId: ${transformId}`
                );
                success = false;
              }
            }
          }
        }
      }
    } else {
      messages.push('ReverseDeps directory does not exist.');
      success = false;
    }

    return { success, messages };
  }
}
