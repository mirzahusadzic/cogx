import { BaseOrchestrator } from './base.js';
import { GenericOrchestrator } from './generic.js';
import type { ProgressCallback, OrchestratorConfig } from './types.js';
import { WorkbenchHealthCheckStep } from './steps/workbench-health.js';
import { DiscoveryStep } from './steps/discovery.js';
import { StructuralProcessingStep } from './steps/structural-processing.js';
import { MaintenanceStep } from './steps/maintenance.js';
import type { PGCManager } from '../pgc/manager.js';
import type { StructuralMiner } from './miners/structural.js';
import type { WorkbenchClient } from '../executors/workbench-client.js';
import type { GenesisOracle } from '../pgc/oracles/genesis.js';

/**
 * Orchestrator responsible for the initial PGC generation (Genesis).
 *
 * Performs a full scan of the project, extracts structural metadata from all supported files,
 * and builds the initial Project Knowledge Store.
 */
export class GenesisOrchestrator extends BaseOrchestrator {
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
