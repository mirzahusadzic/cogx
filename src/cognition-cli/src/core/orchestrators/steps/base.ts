import { systemLog } from '../../../utils/debug-logger.js';
import type { IPipelineStep, PipelineContext, StepResult } from '../types.js';

/**
 * Base class for pipeline steps to reduce boilerplate.
 */
export abstract class BaseStep implements IPipelineStep {
  abstract name: string;
  abstract execute(context: PipelineContext): Promise<StepResult>;

  protected log(message: string) {
    systemLog('orchestrator', `[${this.name}] ${message}`);
  }

  protected success(message?: string): StepResult {
    return { success: true, message };
  }

  protected failure(message: string, error?: Error): StepResult {
    return { success: false, message, error };
  }
}
