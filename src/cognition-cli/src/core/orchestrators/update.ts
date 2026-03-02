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

/**
 * Orchestrator responsible for incremental PGC updates.
 *
 * Uses the DirtyStateManager to identify changed or untracked files and performs
 * surgical updates to the Project Knowledge Store, including invalidation propagation.
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
   * @param onProgress - Optional callback for reporting progress to the UI
   */
  async run(onProgress?: ProgressCallback): Promise<void> {
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
  }
}
