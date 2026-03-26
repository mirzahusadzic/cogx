import fs from 'fs-extra';
import path from 'path';
import { Transformation } from '../types/transform.js';

/**
 * TransformDAG — Git-style sharded directed acyclic graph of transforms.
 *
 * STORAGE LAYOUT:
 *   .open_cognition/transform_dag/edges/<shard>/<rest>        — forward edges (children)
 *   .open_cognition/transform_dag/rev_edges/<shard>/<rest>    — backward edges (parents)
 *   .open_cognition/transform_dag/output_index/<shard>/<rest> — producer index (hash → transformId)
 */
export class TransformDAG {
  constructor(private pgcRoot: string) {}

  /**
   * Called when a new transform is recorded. Does two things:
   * 1. For each OUTPUT hash of the transform → write transformId to output_index
   *    (this transform produced this hash).
   * 2. For each INPUT hash of the transform → look up output_index to find the
   *    producer, then add a forward edge producerId → transformId and a backward
   *    edge transformId → producerId.
   */
  async link(transformId: string, transform: Transformation): Promise<void> {
    // Step 1: register each output as produced by this transform
    for (const output of transform.outputs) {
      const outputIndexPath = this.getOutputIndexPath(output.hash);
      await fs.ensureDir(path.dirname(outputIndexPath));
      await fs.writeFile(outputIndexPath, transformId + '\n');
    }

    // Step 2: wire DAG edges through input → producer lookups
    for (const input of transform.inputs) {
      const producerId = await this.getProducerTransformId(input.hash);
      if (producerId && producerId !== transformId) {
        await this.appendLine(this.getEdgePath(producerId), transformId);
        await this.appendLine(this.getRevEdgePath(transformId), producerId);
      }
    }
  }

  /**
   * Forward traversal with cycle protection (O(V+E)).
   * Cycles are expected (reversions, cherry-picks). Traversal terminates on revisit.
   */
  async getDownstream(
    transformId: string,
    visited: Set<string> = new Set()
  ): Promise<string[]> {
    if (visited.has(transformId)) return [];
    visited.add(transformId);

    const children = await this.getDirectChildren(transformId);
    const result: string[] = [...children];

    for (const child of children) {
      result.push(...(await this.getDownstream(child, visited)));
    }
    return result;
  }

  /**
   * Backward traversal with cycle protection.
   * Cycles are expected (reversions, cherry-picks). Traversal terminates on revisit.
   */
  async getUpstream(
    transformId: string,
    visited: Set<string> = new Set()
  ): Promise<string[]> {
    if (visited.has(transformId)) return [];
    visited.add(transformId);

    const parents = await this.getDirectParents(transformId);
    const result: string[] = [...parents];

    for (const parent of parents) {
      result.push(...(await this.getUpstream(parent, visited)));
    }
    return result;
  }

  /** Get direct children only */
  async getDirectChildren(transformId: string): Promise<string[]> {
    return this.readLines(this.getEdgePath(transformId));
  }

  /** Get direct parents only */
  async getDirectParents(transformId: string): Promise<string[]> {
    return this.readLines(this.getRevEdgePath(transformId));
  }

  /**
   * Try to get the producer transform for a given output/content hash.
   * Returns null if not indexed.
   */
  async getProducerTransformId(hash: string): Promise<string | null> {
    const indexPath = this.getOutputIndexPath(hash);
    if (!(await fs.pathExists(indexPath))) return null;
    const lines = await this.readLines(indexPath);
    return lines.length > 0 ? lines[0] : null;
  }

  private getEdgePath(transformId: string): string {
    const shard = transformId.slice(0, 2);
    const rest = transformId.slice(2);
    return path.join(this.pgcRoot, 'transform_dag', 'edges', shard, rest);
  }

  private getRevEdgePath(transformId: string): string {
    const shard = transformId.slice(0, 2);
    const rest = transformId.slice(2);
    return path.join(this.pgcRoot, 'transform_dag', 'rev_edges', shard, rest);
  }

  private getOutputIndexPath(hash: string): string {
    const shard = hash.slice(0, 2);
    const rest = hash.slice(2);
    return path.join(
      this.pgcRoot,
      'transform_dag',
      'output_index',
      shard,
      rest
    );
  }

  /** Idempotent line append — skips write if the value is already present */
  private async appendLine(filePath: string, value: string): Promise<void> {
    await fs.ensureDir(path.dirname(filePath));
    const existing = new Set<string>();
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf-8');
      for (const line of content.split('\n')) {
        const t = line.trim();
        if (t) existing.add(t);
      }
    }
    if (!existing.has(value)) {
      existing.add(value);
      await fs.writeFile(filePath, Array.from(existing).join('\n') + '\n');
    }
  }

  /** Returns [] if the file does not exist */
  private async readLines(filePath: string): Promise<string[]> {
    if (!(await fs.pathExists(filePath))) return [];
    const content = await fs.readFile(filePath, 'utf-8');
    return content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }
}
