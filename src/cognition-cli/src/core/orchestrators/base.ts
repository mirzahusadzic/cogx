import chalk from 'chalk';
import { log, spinner } from '@clack/prompts';
import type { PGCManager } from '../pgc/manager.js';
import type { StructuralMiner } from './miners/structural.js';
import type { WorkbenchClient } from '../executors/workbench-client.js';
import type { GenesisOracle } from '../pgc/oracles/genesis.js';

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
 * Base Orchestrator class providing shared infrastructure and lifecycle utilities.
 */
export abstract class BaseOrchestrator implements IOrchestrator {
  protected s = spinner();
  protected useSpinner = true;
  protected onProgress?: ProgressCallback;

  constructor(
    protected pgc: PGCManager,
    protected miner: StructuralMiner,
    protected workbench: WorkbenchClient,
    protected genesisOracle: GenesisOracle,
    protected projectRoot: string
  ) {}

  /**
   * Abstract run method to be implemented by subclasses
   */
  abstract run(onProgress?: ProgressCallback): Promise<void>;

  /**
   * Sets the progress callback and toggles spinner usage.
   */
  protected setProgressHandler(onProgress?: ProgressCallback): void {
    this.onProgress = onProgress;
    this.useSpinner = !onProgress;
  }

  /**
   * Checks the health of the Workbench client
   */
  protected async checkWorkbenchHealth(): Promise<boolean> {
    try {
      const health = (await this.workbench.health()) as unknown;
      if (typeof health === 'boolean') return health;
      if (health && typeof health === 'object' && 'status' in health) {
        const h = health as { status: string };
        return h.status === 'ok' || h.status === 'ready';
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Standard logging utilities
   */
  protected logInfo(message: string): void {
    if (this.useSpinner) {
      log.info(message);
    }
  }

  protected logStep(message: string): void {
    if (this.useSpinner) {
      log.step(message);
    }
  }

  protected logError(message: string): void {
    if (this.useSpinner) {
      log.error(chalk.red(message));
    }
  }

  protected logSuccess(message: string): void {
    if (this.useSpinner) {
      log.success(chalk.green(message));
    }
  }

  protected logWarn(message: string): void {
    if (this.useSpinner) {
      log.warn(chalk.yellow(message));
    }
  }

  /**
   * Spinner utilities
   */
  protected startSpinner(message: string): void {
    if (this.useSpinner) {
      this.s.start(message);
    }
  }

  protected stopSpinner(message?: string): void {
    if (this.useSpinner) {
      this.s.stop(message);
    }
  }

  protected updateSpinner(message: string): void {
    if (this.useSpinner) {
      this.s.message(message);
    }
  }
}
