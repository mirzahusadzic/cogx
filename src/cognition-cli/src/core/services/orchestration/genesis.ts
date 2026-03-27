import { BaseOrchestrator } from '../../orchestrators/base.js';
import { GenericOrchestrator } from '../../orchestrators/generic.js';
import type {
  ProgressCallback,
  OrchestratorConfig,
} from '../../orchestrators/types.js';
import { WorkbenchHealthCheckStep } from '../../orchestrators/steps/workbench-health.js';
import { DiscoveryStep } from '../../orchestrators/steps/discovery.js';
import { StructuralProcessingStep } from '../../orchestrators/steps/structural-processing.js';
import { MaintenanceStep } from '../../orchestrators/steps/maintenance.js';
import type { PGCManager } from '../../pgc/manager.js';
import type { StructuralMiner } from '../../orchestrators/miners/structural.js';
import type { WorkbenchClient } from '../../executors/workbench-client.js';
import type { GenesisOracle } from '../../pgc/oracles/genesis.js';

/**
 * Genesis Orchestrator: Main entry point for structural data extraction and PGC initialization
 *
 * Implements the bottom-up aggregation phase of the Genesis process:
 * 1. Discover and parse source files (native TS/JS in parallel, remote Python sequentially)
 * 2. Extract structural metadata (classes, functions, interfaces, dependencies)
 * 3. Store in Grounded Context Pool (PGC) with content & structural hashing
 * 4. Record transformation lineage in transformLog and reverseDeps
 * 5. Run garbage collection to maintain PGC coherence
 * 6. Verify structural consistency via GenesisOracle
 *
 * DESIGN PATTERNS:
 * - Two-phase processing: Parallel native parsing → Sequential remote parsing
 * - PGC anchoring: All structural data stored as immutable objects via content hashing
 * - Lineage tracking: Every transformation recorded for audit trail and invalidation
 * - Incremental: Skips unchanged files (content hash comparison)
 * - Optimized GC: Preserves hashes referenced by overlays
 *
 * @example
 * const pgc = new PGCManager(projectRoot);
 * const orchestrator = new GenesisService(pgc, miner, workbench, genesisOracle, projectRoot);
 * await orchestrator.run();
 * // → Extracts all TypeScript/JavaScript/Python files from src/
 * // → Stores in .open_cognition/index/, .open_cognition/objects/
 * // → PGC is now ready for overlay generation
 */
export class GenesisService extends BaseOrchestrator {
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
   * Run the Genesis orchestration pipeline.
   *
   * This is the main entry point that orchestrates the entire structural extraction pipeline:
   * 1. Verify workbench (eGemma) is available for semantic analysis
   * 2. Discover all source files (TS/JS/Python/Java/Rust/Go)
   * 3. Parse native files in parallel (TS/JS with tree-sitter)
   * 4. Process files sequentially with structural extraction & storage
   * 5. Aggregate directory-level summaries (bottom-up)
   * 6. Perform garbage collection to maintain PGC coherence
   * 7. Verify structural integrity via GenesisOracle
   *
   * LINEAGE TRACKING:
   * - Stores content hash in object store for each file
   * - Stores structural data hash for extracted metadata
   * - Records transformation ID linking inputs → outputs
   * - Maintains reverse deps for invalidation during updates
   *
   * @param onProgress - Optional callback for reporting progress to the UI
   */
  async run(onProgress?: ProgressCallback): Promise<void> {
    const config: OrchestratorConfig = {
      name: 'Genesis',
      discoverySteps: [
        new WorkbenchHealthCheckStep(),
        new DiscoveryStep(['src']), // Default to src, could be configurable
      ],
      processingSteps: [
        new StructuralProcessingStep({
          parallel: true,
          incremental: false,
        }),
      ],
      verificationSteps: [
        new MaintenanceStep({
          gc: true,
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
  }

  /**
   * Entry point for bottom-up aggregation (legacy support).
   *
   * This is a specialized entry point that allows processing specific source paths
   * while following the full Genesis pipeline.
   *
   * @param sourcePaths - Relative paths to source directories (e.g., ['src', 'lib'])
   * @param onProgress - Optional callback for reporting progress to the UI
   */
  async executeBottomUpAggregation(
    sourcePaths: string[],
    onProgress?: ProgressCallback
  ): Promise<void> {
    const config: OrchestratorConfig = {
      name: 'Genesis (Bottom-Up)',
      discoverySteps: [
        new WorkbenchHealthCheckStep(),
        new DiscoveryStep(sourcePaths),
      ],
      processingSteps: [
        new StructuralProcessingStep({
          parallel: true,
          incremental: false,
        }),
      ],
      verificationSteps: [
        new MaintenanceStep({
          gc: true,
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

    await orchestrator.run(onProgress || this.onProgress);
  }
}
