/**
 * Transform Compactor
 *
 * Garbage-collects the transform log by purging invalidated transforms and
 * squashing intermediate transforms in a chain down to a single summary record.
 *
 * DESIGN:
 * Transforms accumulate over time and most intermediate steps are no longer
 * useful once the chain has progressed. Compaction reduces storage and
 * improves scan performance without losing provenance fidelity — the
 * summary transform captures the concatenated intent narrative so audit
 * history is preserved at a higher level of abstraction.
 *
 * SAFETY RULES:
 * - ai_agent transforms are never touched (they carry human-authored intent)
 * - Transforms younger than minAgeDays (default 90) are skipped
 * - First and last transform per file chain are preserved as endpoints
 * - dry-run mode computes the plan without writing any changes
 *
 * @example
 * const compactor = new TransformCompactor(new TransformLog(pgcRoot));
 * const plan = await compactor.scan({ minAgeDays: 90 });
 * const result = await compactor.compact(plan, { dryRun: false });
 * console.log(`Purged ${result.purged}, squashed ${result.squashed}`);
 */

import { TransformLog } from '../pgc/transform-log.js';
import { Transformation } from '../types/transform.js';

/** Compaction plan produced by scan(). Describes what would be done. */
export interface CompactionPlan {
  /** Transform IDs that are already invalidated — will be purged */
  toInvalidated: string[];
  /** Transform IDs that are intermediate (squashable middle of a chain) */
  toIntermediate: string[];
  /** Transform IDs preserved as chain endpoints (first + last per file) */
  endpointsPreserved: string[];
  /** Number of transforms skipped because source.type === 'ai_agent' */
  skippedAiAgent: number;
  /** Number of transforms skipped because they are too recent */
  skippedTooRecent: number;
  /** Groups of intermediate transforms keyed by input file path, ordered by timestamp */
  squashGroups: Map<string, string[]>;
}

/** Result of executing a compaction plan. */
export interface CompactionResult {
  /** Number of invalidated transforms purged */
  purged: number;
  /** Number of intermediate transforms purged (squashed) */
  squashed: number;
  /** Number of squash-summary transforms written */
  summariesGenerated: number;
  /** Number of ai_agent transforms skipped */
  skippedAiAgent: number;
  /** Number of too-recent transforms skipped */
  skippedTooRecent: number;
  /** Number of endpoint transforms preserved */
  endpointsPreserved: number;
  /** Whether this was a dry-run (no changes written) */
  dryRun: boolean;
}

/**
 * TransformCompactor scans and compacts the PGC transform log.
 *
 * Two-phase API:
 * 1. `scan()` — analyse the log and produce a CompactionPlan
 * 2. `compact()` — execute the plan (or simulate with dryRun)
 */
export class TransformCompactor {
  constructor(private readonly transformLog: TransformLog) {}

  /**
   * Scan the transform log and produce a compaction plan.
   *
   * Respects safety rules: ai_agent transforms and recent transforms
   * are never included in the plan. First and last transforms in each
   * per-file group are preserved as endpoints.
   *
   * @param opts.before   Only consider transforms older than this date
   * @param opts.minAgeDays  Minimum age in days (default 90)
   * @returns CompactionPlan describing what would be done
   */
  async scan(opts: {
    before?: Date;
    minAgeDays?: number;
  }): Promise<CompactionPlan> {
    const minAgeDays = opts.minAgeDays ?? 90;
    const cutoffMs = Date.now() - minAgeDays * 24 * 60 * 60 * 1000;

    const plan: CompactionPlan = {
      toInvalidated: [],
      toIntermediate: [],
      endpointsPreserved: [],
      skippedAiAgent: 0,
      skippedTooRecent: 0,
      squashGroups: new Map(),
    };

    const ids = await this.transformLog.getAllTransformIds();

    // Accumulate candidates grouped by first-input file path
    // Map<filePath, Array<{ id, timestamp }>>
    const fileGroups = new Map<string, Array<{ id: string; ts: number }>>();

    for (const id of ids) {
      const tx = await this.transformLog.getTransformation(id);
      if (!tx) continue;

      // Skip ai_agent transforms
      if (tx.source?.type === 'ai_agent') {
        plan.skippedAiAgent++;
        continue;
      }

      // Parse timestamp
      const ts = tx.timestamp ? Date.parse(tx.timestamp) : 0;

      // Skip transforms that are too recent
      if (ts > cutoffMs) {
        plan.skippedTooRecent++;
        continue;
      }

      // Skip transforms newer than the `before` date
      if (opts.before !== undefined && ts >= opts.before.getTime()) {
        plan.skippedTooRecent++;
        continue;
      }

      // Invalidated transforms go straight to the purge list
      if (await this.transformLog.isInvalidated(id)) {
        plan.toInvalidated.push(id);
        continue;
      }

      // Otherwise, candidate for squashing — group by first input path
      const filePath = tx.inputs[0]?.path ?? '__no_input__';
      if (!fileGroups.has(filePath)) {
        fileGroups.set(filePath, []);
      }
      fileGroups.get(filePath)!.push({ id, ts });
    }

    // Determine endpoints vs intermediates within each group
    for (const [filePath, entries] of fileGroups) {
      // Sort ascending by timestamp so first/last are chronological endpoints
      entries.sort((a, b) => a.ts - b.ts);

      if (entries.length <= 2) {
        // All are endpoints — nothing to squash
        for (const e of entries) {
          plan.endpointsPreserved.push(e.id);
        }
        continue;
      }

      // Preserve first and last
      plan.endpointsPreserved.push(entries[0].id);
      plan.endpointsPreserved.push(entries[entries.length - 1].id);

      // Middle entries are intermediate
      const intermediates = entries.slice(1, -1).map((e) => e.id);
      for (const id of intermediates) {
        plan.toIntermediate.push(id);
      }
      plan.squashGroups.set(filePath, intermediates);
    }

    return plan;
  }

  /**
   * Execute a compaction plan produced by scan().
   *
   * Purges invalidated transforms and squashes intermediate chains into
   * summary transforms. Pass `dryRun: true` to simulate without writes.
   *
   * @param plan    The plan produced by scan()
   * @param opts.dryRun  If true, compute counts but make no changes (default false)
   * @returns CompactionResult with counts of what was done (or would be done)
   */
  async compact(
    plan: CompactionPlan,
    opts: { dryRun?: boolean }
  ): Promise<CompactionResult> {
    const dryRun = opts.dryRun ?? false;
    const result: CompactionResult = {
      purged: 0,
      squashed: 0,
      summariesGenerated: 0,
      skippedAiAgent: plan.skippedAiAgent,
      skippedTooRecent: plan.skippedTooRecent,
      endpointsPreserved: plan.endpointsPreserved.length,
      dryRun,
    };

    // Phase 1: Purge invalidated transforms
    for (const id of plan.toInvalidated) {
      if (!dryRun) {
        await this.transformLog.purge(id);
        result.purged++;
      }
    }

    // Phase 2: Squash intermediate groups
    for (const [, intermediateIds] of plan.squashGroups) {
      if (intermediateIds.length === 0) continue;

      // Load all intermediate transforms
      const transforms: Transformation[] = [];
      for (const id of intermediateIds) {
        const tx = await this.transformLog.getTransformation(id);
        if (tx) transforms.push(tx);
      }

      if (transforms.length === 0) continue;

      if (!dryRun) {
        // Concatenate intent narratives
        const intents = transforms
          .map((tx) => tx.reasoning?.intent)
          .filter((s): s is string => typeof s === 'string' && s.length > 0);
        const concatenatedIntent =
          intents.length > 0
            ? intents.join(' | ')
            : 'squashed intermediate transforms';

        // Build summary transform from first inputs[0] → last outputs[0]
        const firstTx = transforms[0];
        const lastTx = transforms[transforms.length - 1];
        const summaryInput = firstTx.inputs[0] ?? {
          path: '__no_input__',
          hash: '',
        };
        const summaryOutput = lastTx.outputs[0] ?? summaryInput;

        const summaryData: Omit<Transformation, 'phi' | 'verification_result'> =
          {
            type: 'squash_summary',
            timestamp: new Date().toISOString(),
            method: 'compaction',
            inputs: [summaryInput],
            outputs: [summaryOutput],
            reasoning: {
              intent: concatenatedIntent,
              confidence: 0.5,
            },
            source: {
              type: 'system',
              identifier: 'transform-compactor',
            },
            goal: firstTx.goal,
          };

        await this.transformLog.record(summaryData);
        for (const id of intermediateIds) {
          await this.transformLog.purge(id);
        }

        result.summariesGenerated++;
        result.squashed += intermediateIds.length;
      }
    }

    return result;
  }
}
