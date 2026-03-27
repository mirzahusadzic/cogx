import path from 'path';
import { TransformLog } from '../../pgc/transform-log.js';
import { TransformDAG } from '../../pgc/transform-dag.js';
import { ObjectStore } from '../../pgc/object-store.js';
import { Index } from '../../pgc/index.js';
import { ReverseDeps } from '../../pgc/reverse-deps.js';

export interface ProvenanceChain {
  rootHash: string;
  links: ProvenanceLink[];
  verified: boolean;
}

export interface ProvenanceLink {
  transformId: string;
  transformType: string;
  method: string;
  timestamp: string;
  phi: number;
  inputHashes: string[];
  outputHashes: string[];
  inputPaths: string[];
  outputPaths: string[];
}

export interface ChainVerification {
  success: boolean;
  totalLinks: number;
  verifiedObjects: number;
  missingObjects: string[];
  messages: string[];
}

export interface FileHistory {
  filePath: string;
  transforms: Array<{
    transformId: string;
    timestamp: string;
    type: string;
    method: string;
    phi: number;
    reasoning?: {
      intent?: string;
      confidence?: number;
    };
  }>;
}

export interface ImpactAnalysis {
  targetPath: string;
  /** Number of files that import/depend on targetPath (direct + transitive) */
  consumerCount: number;
  /** Longest transitive dependency chain depth */
  maxDepth: number;
  directConsumers: string[];
  allConsumers: string[];
}

/** Remove common source/module file extensions for path comparison */
function stripExtension(p: string): string {
  return p.replace(/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, '');
}

export class ProvenanceService {
  constructor(
    private transformLog: TransformLog,
    private transformDAG: TransformDAG,
    private objectStore: ObjectStore,
    private index: Index,
    private reverseDeps: ReverseDeps
  ) {}

  /**
   * Trace forward: starting from a content hash, find the transforms that
   * consumed it and what they produced. Returns an ordered BFS chain.
   */
  async traceForward(inputHash: string): Promise<ProvenanceChain> {
    const visitedTransforms = new Set<string>();
    const visitedHashes = new Set<string>([inputHash]);
    const links: ProvenanceLink[] = [];

    const queue: string[] = [inputHash];

    while (queue.length > 0) {
      const hash = queue.shift()!;
      const transformIds = await this.reverseDeps.getTransformIds(hash);

      for (const transformId of transformIds) {
        if (visitedTransforms.has(transformId)) continue;
        visitedTransforms.add(transformId);

        const transform =
          await this.transformLog.getTransformation(transformId);
        if (!transform) continue;

        const isInput = transform.inputs.some((i) => i.hash === hash);
        if (!isInput) continue;

        links.push({
          transformId,
          transformType: transform.type ?? 'unknown',
          method: transform.method ?? 'unknown',
          timestamp: transform.timestamp ?? '',
          phi: transform.phi,
          inputHashes: transform.inputs.map((i) => i.hash),
          outputHashes: transform.outputs.map((o) => o.hash),
          inputPaths: transform.inputs.map((i) => i.path ?? '').filter(Boolean),
          outputPaths: transform.outputs
            .map((o) => o.path ?? '')
            .filter(Boolean),
        });

        for (const output of transform.outputs) {
          if (!visitedHashes.has(output.hash)) {
            visitedHashes.add(output.hash);
            queue.push(output.hash);
          }
        }
      }
    }

    return { rootHash: inputHash, links, verified: false };
  }

  /**
   * Trace backward: from an output hash, find what produced it and what
   * its inputs were. Returns the chain from source to this hash.
   */
  async traceBackward(outputHash: string): Promise<ProvenanceChain> {
    const visitedTransforms = new Set<string>();
    const links: ProvenanceLink[] = [];

    const traverse = async (hash: string): Promise<void> => {
      const producerId = await this.transformDAG.getProducerTransformId(hash);
      if (!producerId || visitedTransforms.has(producerId)) return;
      visitedTransforms.add(producerId);

      const transform = await this.transformLog.getTransformation(producerId);
      if (!transform) return;

      links.unshift({
        transformId: producerId,
        transformType: transform.type ?? 'unknown',
        method: transform.method ?? 'unknown',
        timestamp: transform.timestamp ?? '',
        phi: transform.phi,
        inputHashes: transform.inputs.map((i) => i.hash),
        outputHashes: transform.outputs.map((o) => o.hash),
        inputPaths: transform.inputs.map((i) => i.path ?? '').filter(Boolean),
        outputPaths: transform.outputs.map((o) => o.path ?? '').filter(Boolean),
      });

      for (const input of transform.inputs) {
        await traverse(input.hash);
      }
    };

    await traverse(outputHash);
    return { rootHash: outputHash, links, verified: false };
  }

  /**
   * Verify chain integrity: check that all objects and transforms exist.
   */
  async verifyChain(chain: ProvenanceChain): Promise<ChainVerification> {
    const missingObjects: string[] = [];
    const messages: string[] = [];
    let verifiedObjects = 0;

    for (const link of chain.links) {
      const transformExists = await this.transformLog.exists(link.transformId);
      if (!transformExists) {
        messages.push(
          `Transform not found: ${link.transformId.slice(0, 16)}...`
        );
      }

      const allHashes = [...link.inputHashes, ...link.outputHashes];
      for (const hash of allHashes) {
        if (await this.objectStore.exists(hash)) {
          verifiedObjects++;
        } else {
          missingObjects.push(hash);
        }
      }
    }

    return {
      success: missingObjects.length === 0 && messages.length === 0,
      totalLinks: chain.links.length,
      verifiedObjects,
      missingObjects,
      messages,
    };
  }

  /** Get all transforms for a file in temporal order */
  async getFileHistory(filePath: string): Promise<FileHistory> {
    const indexData = await this.index.get(filePath);
    if (!indexData) {
      return { filePath, transforms: [] };
    }

    const transformEntries: FileHistory['transforms'] = [];

    for (const transformId of indexData.history) {
      const transform = await this.transformLog.getTransformation(transformId);
      if (!transform) continue;
      transformEntries.push({
        transformId,
        timestamp: transform.timestamp ?? '',
        type: transform.type ?? 'unknown',
        method: transform.method ?? 'unknown',
        phi: transform.phi,
        reasoning: transform.reasoning
          ? {
              intent: transform.reasoning.intent,
              confidence: transform.reasoning.confidence,
            }
          : undefined,
      });
    }

    transformEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return { filePath, transforms: transformEntries };
  }

  /**
   * Analyze blast radius for a file path using the Index's structural
   * dependency graph.  Works immediately — does NOT require TransformDAG
   * to be populated.
   *
   * Builds a reverse-dependency map by scanning all indexed files and
   * resolving their relative imports against the target path.
   */
  async analyzeImpact(
    filePath: string,
    maxDepth: number = 10
  ): Promise<ImpactAnalysis> {
    const allData = await this.index.getAllData();

    // reverse-dep map: normalized path → files that import it
    const revDeps = new Map<string, Set<string>>();

    for (const entry of allData) {
      const structural = entry.structuralData;
      if (!structural) continue;

      const imports = structural.imports ?? [];
      const deps = structural.dependencies ?? [];
      const allImports = [...new Set([...imports, ...deps])];

      const entryDir = path.dirname(entry.path);

      for (const imp of allImports) {
        if (!imp.startsWith('.')) continue; // skip package names

        const resolved = path.normalize(path.join(entryDir, imp));
        const normalized = stripExtension(resolved);

        if (!revDeps.has(normalized)) {
          revDeps.set(normalized, new Set());
        }
        revDeps.get(normalized)!.add(entry.path);
      }
    }

    const normalizedTarget = stripExtension(path.normalize(filePath));

    const directConsumers: string[] = [];
    const allConsumers = new Set<string>();
    let currentMaxDepth = 0;

    // BFS over the reverse-dep graph
    const queue: Array<{ current: string; depth: number }> = [
      { current: normalizedTarget, depth: 0 },
    ];
    const visited = new Set<string>([normalizedTarget]);

    while (queue.length > 0) {
      const { current, depth } = queue.shift()!;
      const consumers = revDeps.get(current) ?? new Set<string>();

      for (const consumer of consumers) {
        if (depth === 0) directConsumers.push(consumer);

        if (!allConsumers.has(consumer)) {
          allConsumers.add(consumer);
          currentMaxDepth = Math.max(currentMaxDepth, depth + 1);

          const normalizedConsumer = stripExtension(path.normalize(consumer));
          if (!visited.has(normalizedConsumer) && depth + 1 < maxDepth) {
            visited.add(normalizedConsumer);
            queue.push({ current: normalizedConsumer, depth: depth + 1 });
          }
        }
      }
    }

    return {
      targetPath: filePath,
      consumerCount: allConsumers.size,
      maxDepth: currentMaxDepth,
      directConsumers,
      allConsumers: Array.from(allConsumers),
    };
  }
}
