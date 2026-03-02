import type { PGCManager } from '../pgc/manager.js';
import type { StructuralMiner } from './miners/structural.js';
import type { WorkbenchClient } from '../executors/workbench-client.js';
import type { GenesisOracle } from '../pgc/oracles/genesis.js';
import type { DocsOracle } from '../pgc/oracles/docs.js';
import type { SourceFile } from '../types/structural.js';

/**
 * Progress callback type for reporting progress to callers (e.g., TUI)
 */
export type ProgressCallback = (
  current: number,
  total: number,
  message: string,
  file?: string
) => void;

/**
 * Interface for all Sigma Orchestrators
 */
export interface IOrchestrator {
  run(onProgress?: ProgressCallback): Promise<void>;
}

/**
 * Context shared between pipeline steps
 */
export interface PipelineContext {
  pgc: PGCManager;
  miner: StructuralMiner;
  workbench: WorkbenchClient;
  genesisOracle: GenesisOracle;
  docsOracle: DocsOracle;
  projectRoot: string;
  filesToProcess: string[];
  processedFiles: string[];
  failedFiles: string[];
  onProgress?: ProgressCallback;

  // Pipeline-specific state
  isWorkbenchHealthy?: boolean;
  sourceFiles?: SourceFile[];

  /**
   * Log a message to the UI (e.g., CLI console or TUI log view).
   */
  log?: (
    message: string,
    level?: 'info' | 'warn' | 'error' | 'success'
  ) => void;

  [key: string]: unknown;
}

/**
 * Result of a pipeline step
 */
export interface StepResult {
  success: boolean;
  message?: string;
  error?: Error;
}

/**
 * Base interface for a pipeline step
 */
export interface IPipelineStep {
  name: string;
  execute(context: PipelineContext): Promise<StepResult>;
}

/**
 * Configuration for the GenericOrchestrator
 */
export interface OrchestratorConfig {
  name: string;
  discoverySteps: IPipelineStep[];
  processingSteps: IPipelineStep[];
  verificationSteps: IPipelineStep[];
}
