/**
 * Transform Log Manager
 *
 * Manages the transformation log storing provenance and verification data
 * for all PGC transforms. Each transform creates an immutable audit record
 * containing inputs, outputs, fidelity, and verification results.
 *
 * DESIGN:
 * Uses Git-style sharding to handle large numbers of transforms efficiently.
 * Transform IDs are SHA-256 hashes - first 2 hex chars become the shard directory.
 * Each transform has a manifest.yaml file containing full metadata.
 *
 * ARCHITECTURE:
 * - Storage: .open_cognition/transforms/{shard}/{rest}/manifest.yaml
 * - Sharding: First 2 hex chars (00-ff) → 256 possible shards
 * - Format: YAML for human readability and easy inspection
 * - Immutability: Transforms are write-once (never modified)
 *
 * PROVENANCE TRACKING:
 * Each transform log contains:
 * - transform_id: Unique identifier (SHA-256 hash)
 * - type: Transform type (genesis, genesis_doc, update, etc.)
 * - timestamp: ISO 8601 timestamp
 * - method: Extraction/parsing method used
 * - inputs: Source files and parameters
 * - outputs: Generated artifacts (hashes, types, paths)
 * - fidelity (φ): Quality metric (0.0-1.0)
 * - verification_result: Validation status
 * - provenance: Tool versions, content hashes
 *
 * DESIGN RATIONALE:
 * - Sharding prevents filesystem bottlenecks (max ~65K files per directory)
 * - YAML chosen over JSON for readability in manual audits
 * - Immutability ensures audit trail integrity
 * - Content-addressed IDs enable deduplication and verification
 *
 * @example
 * // Record a new transform
 * const log = new TransformLog(pgcRoot);
 * const transformId = await log.record({
 *   type: 'genesis_doc',
 *   timestamp: new Date().toISOString(),
 *   method: 'markdown-ast-parse',
 *   inputs: { source_file: 'VISION.md' },
 *   outputs: [{ hash: 'abc123...', type: 'markdown_document' }]
 * });
 *
 * @example
 * // Retrieve transform data
 * const data = await log.getTransformData('abc123...');
 * console.log(`Method: ${data.method}`);
 * console.log(`Fidelity: ${data.phi}`);
 *
 * @example
 * // List all transforms
 * const ids = await log.getAllTransformIds();
 * console.log(`${ids.length} transforms recorded`);
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import crypto from 'node:crypto';
import { TransformData } from '../types/transform.js';

export class TransformLog {
  private transformsPath: string;

  constructor(private pgcRoot: string) {
    this.transformsPath = path.join(this.pgcRoot, 'transforms');
  }

  /**
   * Get sharded path for a transform hash
   *
   * Computes the Git-style sharded directory path for a transform ID.
   * Sharding distributes transforms across 256 directories (00-ff)
   * to prevent filesystem performance degradation.
   *
   * @param hash - Transform ID (SHA-256 hash)
   * @returns Path to transform directory (without manifest.yaml)
   * @private
   *
   * @example
   * // hash = "abc123def456..."
   * // returns: "/path/to/.open_cognition/transforms/ab/c123def456..."
   */
  private getTransformPath(hash: string): string {
    const shard = hash.slice(0, 2);
    const rest = hash.slice(2);
    return path.join(this.transformsPath, shard, rest);
  }

  /**
   * Get transform data by hash
   *
   * Retrieves and parses the manifest.yaml for a transform.
   * Returns null if transform doesn't exist.
   *
   * @param hash - Transform ID (SHA-256 hash)
   * @returns Transform data or null if not found
   *
   * @example
   * const data = await log.getTransformData('abc123...');
   * if (data) {
   *   console.log(`Transform: ${data.type}`);
   *   console.log(`Fidelity: ${data.phi}`);
   * }
   */
  async getTransformData(hash: string): Promise<TransformData | null> {
    const transformPath = this.getTransformPath(hash);
    const manifestPath = path.join(transformPath, 'manifest.yaml');

    if (await fs.pathExists(manifestPath)) {
      const content = await fs.readFile(manifestPath, 'utf-8');
      return yaml.load(content) as TransformData;
    }
    return null;
  }

  /**
   * Set transform data by hash
   *
   * Stores transform metadata in sharded directory structure.
   * Creates shard directory if needed. Overwrites existing data
   * (though transforms should be immutable in practice).
   *
   * @param hash - Transform ID (SHA-256 hash)
   * @param data - Transform metadata to store
   *
   * @example
   * await log.set('abc123...', {
   *   type: 'genesis_doc',
   *   timestamp: new Date().toISOString(),
   *   method: 'markdown-ast-parse',
   *   inputs: { source_file: 'VISION.md' },
   *   outputs: [{ hash: 'def456...', type: 'markdown_document' }],
   *   phi: 1.0,
   *   verification_result: { status: 'Success' }
   * });
   */
  async set(hash: string, data: TransformData): Promise<void> {
    const transformPath = this.getTransformPath(hash);
    await fs.ensureDir(transformPath);
    const manifestPath = path.join(transformPath, 'manifest.yaml');
    const yamlData = yaml.dump(data);
    await fs.writeFile(manifestPath, yamlData);
  }

  /**
   * Record a new transform
   *
   * Creates a new transform log entry. Computes transform ID from
   * content hash. Sets placeholder values for phi (1.0) and
   * verification_result (Success) - in production, these would
   * come from oracles/validators.
   *
   * @param data - Transform metadata (without phi/verification)
   * @returns Transform ID (SHA-256 hash)
   *
   * @example
   * const transformId = await log.record({
   *   type: 'genesis_doc',
   *   timestamp: new Date().toISOString(),
   *   method: 'markdown-ast-parse',
   *   inputs: { source_file: 'VISION.md' },
   *   outputs: [{ hash: 'abc123...', type: 'markdown_document' }]
   * });
   * console.log(`Transform recorded: ${transformId}`);
   */
  async record(
    data: Omit<TransformData, 'phi' | 'verification_result'>
  ): Promise<string> {
    // This is a simplified record method. In a real scenario, you'd have Oracles
    // to determine phi and verification_result.
    const transformData: TransformData = {
      ...data,
      phi: 1.0, // Placeholder
      verification_result: { status: 'Success' }, // Placeholder
    };

    const content = JSON.stringify(transformData);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    await this.set(hash, transformData);
    return hash;
  }

  /**
   * Check if transform exists
   *
   * @param hash - Transform ID to check
   * @returns true if transform exists, false otherwise
   *
   * @example
   * if (await log.exists('abc123...')) {
   *   console.log('Transform found');
   * }
   */
  async exists(hash: string): Promise<boolean> {
    const transformPath = this.getTransformPath(hash);
    return fs.pathExists(transformPath);
  }

  /**
   * Delete a transform
   *
   * Removes transform directory and manifest. Use with caution -
   * transforms should be immutable for audit trail integrity.
   *
   * @param hash - Transform ID to delete
   *
   * @example
   * // Only for cleanup/testing
   * await log.delete('abc123...');
   */
  async delete(hash: string): Promise<void> {
    const transformPath = this.getTransformPath(hash);
    await fs.remove(transformPath);
  }

  /**
   * Get all transform IDs by scanning sharded directories
   *
   * Scans all shard directories (00-ff) and reconstructs full
   * transform IDs. Useful for audits and bulk operations.
   *
   * ALGORITHM:
   * 1. List shard directories (00-ff)
   * 2. For each shard, list transform directories
   * 3. Reconstruct full ID: shard + rest
   * 4. Return array of all IDs
   *
   * @returns Array of all transform IDs
   *
   * @example
   * const ids = await log.getAllTransformIds();
   * console.log(`${ids.length} transforms in PGC`);
   * for (const id of ids) {
   *   const data = await log.getTransformData(id);
   *   console.log(`${id.slice(0, 8)}: ${data.type}`);
   * }
   */
  async getAllTransformIds(): Promise<string[]> {
    if (!(await fs.pathExists(this.transformsPath))) {
      return [];
    }

    const transformIds: string[] = [];
    const shards = await fs.readdir(this.transformsPath);

    // Scan each shard directory (00-ff)
    for (const shard of shards) {
      const shardPath = path.join(this.transformsPath, shard);
      const stat = await fs.stat(shardPath);

      if (stat.isDirectory()) {
        const entries = await fs.readdir(shardPath);
        // Reconstruct full hash: shard + entry
        for (const entry of entries) {
          transformIds.push(shard + entry);
        }
      }
    }

    return transformIds;
  }

  /**
   * Remove empty shard directories for cleanup
   *
   * Scans all 256 possible shard directories (00-ff) and removes
   * any that are empty. Useful after bulk deletions to keep
   * filesystem clean.
   *
   * @example
   * // After deleting transforms
   * await log.removeEmptyShards();
   */
  async removeEmptyShards(): Promise<void> {
    if (!(await fs.pathExists(this.transformsPath))) {
      return;
    }

    for (let i = 0; i < 256; i++) {
      const shard = i.toString(16).padStart(2, '0'); // '00', '01', ..., 'ff'
      const shardPath = path.join(this.transformsPath, shard);

      if (await fs.pathExists(shardPath)) {
        const entries = await fs.readdir(shardPath);
        if (entries.length === 0) {
          await fs.remove(shardPath);
        }
      }
    }
  }
}
