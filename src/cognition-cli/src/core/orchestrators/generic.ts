import { BaseOrchestrator } from './base.js';
import type {
  OrchestratorConfig,
  PipelineContext,
  ProgressCallback,
  IPipelineStep,
} from './types.js';
import type { PGCManager } from '../pgc/manager.js';
import type { StructuralMiner } from './miners/structural.js';
import type { WorkbenchClient } from '../executors/workbench-client.js';
import type { GenesisOracle } from '../pgc/oracles/genesis.js';
import { systemLog } from '../../utils/debug-logger.js';

/**
 * A generic orchestrator that executes a configurable pipeline of steps.
 *
 * This class implements the common "Discovery -> Processing -> Verification" lifecycle
 * shared by Genesis and Update orchestrators.
 */
export class GenericOrchestrator extends BaseOrchestrator {
  constructor(
    private readonly config: OrchestratorConfig,
    pgc: PGCManager,
    miner: StructuralMiner,
    workbench: WorkbenchClient,
    genesisOracle: GenesisOracle,
    projectRoot: string
  ) {
    super(pgc, miner, workbench, genesisOracle, projectRoot);
  }

  /**
   * Run the orchestrator pipeline.
   *
   * @param onProgress - Optional callback for reporting progress to the UI
   */
  async run(onProgress?: ProgressCallback): Promise<void> {
    systemLog('orchestrator', `Starting orchestrator: ${this.config.name}`);

    const context: PipelineContext = {
      pgc: this.pgc,
      miner: this.miner,
      workbench: this.workbench,
      genesisOracle: this.genesisOracle,
      docsOracle: this.docsOracle,
      projectRoot: this.projectRoot,
      filesToProcess: [],
      processedFiles: [],
      failedFiles: [],
      onProgress,
      log: (message, level) => {
        switch (level) {
          case 'error':
            this.logError(message);
            break;
          case 'warn':
            this.logWarn(message);
            break;
          case 'success':
            this.logSuccess(message);
            break;
          default:
            this.logInfo(message);
        }
      },
    };

    try {
      // 1. Discovery
      for (const step of this.config.discoverySteps) {
        await this.executeStep(step, context);
      }

      // 2. Processing
      for (const step of this.config.processingSteps) {
        await this.executeStep(step, context);
      }

      // 3. Verification/Maintenance
      for (const step of this.config.verificationSteps) {
        await this.executeStep(step, context);
      }

      systemLog(
        'orchestrator',
        `Completed orchestrator: ${this.config.name}. Processed ${context.processedFiles.length} files.`
      );
    } catch (error) {
      systemLog(
        'orchestrator',
        `Orchestrator ${this.config.name} failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        'error'
      );
      throw error;
    }
  }

  private async executeStep(
    step: IPipelineStep,
    context: PipelineContext
  ): Promise<void> {
    systemLog('orchestrator', `Executing step: ${step.name}`);
    const result = await step.execute(context);

    if (!result.success) {
      const errorMessage = `Step ${step.name} failed: ${result.message || 'Unknown error'}`;
      systemLog('orchestrator', errorMessage, undefined, 'error');
      if (result.error) {
        throw result.error;
      }
      throw new Error(errorMessage);
    }
  }
}
