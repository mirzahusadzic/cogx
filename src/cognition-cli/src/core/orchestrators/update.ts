import { BaseOrchestrator } from './base.js';
import { GenericOrchestrator } from './generic.js';
import type { ProgressCallback, OrchestratorConfig } from './types.js';
import { WorkbenchHealthCheckStep } from './steps/workbench-health.js';
import {
  DirtyStateDiscoveryStep,
  ClearDirtyStateStep,
} from './steps/dirty-state.js';
import { StructuralProcessingStep } from './steps/structural-processing.js';
import { MaintenanceStep } from './steps/maintenance.js';
import type { PGCManager } from '../pgc/manager.js';
import type { StructuralMiner } from './miners/structural.js';
import type { WorkbenchClient } from '../executors/workbench-client.js';
import type { GenesisOracle } from '../pgc/oracles/genesis.js';
import { CoherenceDriftDetector } from '../overlays/coherence-drift.js';

/**
 * Update Orchestrator: Implements surgical invalidation for incremental PGC updates
 *
 * Handles dynamic updates to the PGC when source code changes (Monument 4):
 *
 * ALGORITHM:
 * Invalidate(⊥) → Propagate_Up(Join_edges) → Invalidate(⊤) → Invalidate_Overlays
 *
 * This enables:
 * 1. Detect dirty files (from dirty_state.json written by file watcher)
 * 2. Re-process changed/new files (same as Genesis but incremental)
 * 3. Propagate invalidation upward through reverse_deps (surgical cascade)
 * 4. Invalidate dependent overlays (structural_patterns, lineage_patterns)
 * 5. Invalidate cross-file dependencies (O₂ layer coherence)
 * 6. Verify PGC structural integrity via GenesisOracle
 *
 * SURGICAL INVALIDATION:
 * - Only invalidates transforms that consumed changed structural hash
 * - Preserves unchanged transformations (enables incremental CI/CD)
 * - Cross-file propagation: If file A imports B and B changes, invalidate A's lineage
 * - Overlay invalidation: Deletes individual overlay entries, not entire manifests
 *
 * DESIGN PATTERNS:
 * - Delta-driven: Only processes changed files
 * - Hash-based change detection: Skips files with unchanged content
 * - Lineage-aware: Uses transformLog and reverseDeps for surgical invalidation
 * - Lazy verification: Only verifies if files were actually processed
 *
 * @example
 * const orchestrator = new UpdateOrchestrator(pgc, miner, workbench, oracle, '.');
 * await orchestrator.run();
 * // → Reads dirty_state.json written by file watcher
 * // → Re-processes changed files, processes new files
 * // → Invalidates dependent overlay entries
 * // → Verifies PGC coherence
 * // → Clears dirty_state
 *
 * MONUMENT 4.9: Cross-file invalidation
 * When file A changes and file B imports A, B's lineage_patterns become stale.
 * This orchestrator detects and invalidates B's O₂ patterns automatically.
 *
 * @see GenesisOrchestrator - Used for initial structural extraction
 * @see DirtyStateManager - Reads dirty_state.json from file watcher
 * @see reverseDeps - Used for surgical invalidation propagation
 */
export class UpdateOrchestrator extends BaseOrchestrator {
  constructor(
    pgc: PGCManager,
    miner: StructuralMiner,
    workbench: WorkbenchClient,
    genesisOracle: GenesisOracle,
    projectRoot: string
  ) {
    super(pgc, miner, workbench, genesisOracle, projectRoot);
  }

  /**
   * Run the Update orchestration pipeline.
   *
   * Main entry point for handling dynamic code changes. Workflow:
   * 1. Read dirty state from file watcher (contains changed + new files)
   * 2. Check workbench health for semantic analysis capability
   * 3. Process dirty files (modified, already in PGC)
   *    - Re-extract structural data
   *    - Record new transformation
   *    - Propagate invalidation if structure changed
   * 4. Process untracked files (new files not in PGC)
   *    - Same extraction + storage as dirty files
   *    - No propagation needed (nothing depended on new files)
   * 5. Clear dirty state after successful processing
   * 6. Verify PGC coherence (only if files were processed)
   *
   * CHANGE DETECTION:
   * - Content hash comparison to detect actual changes (prevents false positives)
   * - If content hash matches, skip processing (file didn't actually change)
   * - Lazy PGC verification (skip if no files processed)
   *
   * @param onProgress - Optional callback for reporting progress to the UI
   */
  async run(onProgress?: ProgressCallback): Promise<void> {
    const driftDetector = new CoherenceDriftDetector(this.pgc.pgcRoot);
    const beforeScore = await driftDetector.snapshot();

    const config: OrchestratorConfig = {
      name: 'Update',
      discoverySteps: [
        new WorkbenchHealthCheckStep(),
        new DirtyStateDiscoveryStep(),
      ],
      processingSteps: [
        new StructuralProcessingStep({
          parallel: false, // Incremental updates are usually small, parallel parsing is overhead
          incremental: true,
        }),
      ],
      verificationSteps: [
        new ClearDirtyStateStep(),
        new MaintenanceStep({
          gc: false, // Don't run full GC on incremental update for performance
          verify: true,
        }),
      ],
    };

    const orchestrator = new GenericOrchestrator(
      config,
      this.pgc,
      this.miner,
      this.workbench,
      this.genesisOracle,
      this.projectRoot
    );

    await orchestrator.run(onProgress);

    if (beforeScore !== null) {
      const delta = await driftDetector.computeDelta(beforeScore);
      if (Math.abs(delta.drift) > 0.01) {
        const direction =
          delta.drift < 0 ? '⚠️  Coherence drift' : '✅ Coherence improved';
        const arrow = `${delta.before.toFixed(3)} → ${delta.after.toFixed(3)}`;
        const sign = delta.drift >= 0 ? '+' : '';
        console.log(
          `${direction}: ${arrow} (${sign}${delta.drift.toFixed(3)})`
        );
      }
    }
  }
}
