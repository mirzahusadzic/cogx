import { systemDiagnosticsService } from '../../../core/services/diagnostics/SystemDiagnosticsService.js';
import type { IPipelineStep, PipelineContext, StepResult } from '../types.js';

/**
 * Base class for pipeline steps to reduce boilerplate.
 */
export abstract class BaseStep implements IPipelineStep {
  abstract name: string;
  abstract execute(context: PipelineContext): Promise<StepResult>;

  protected log(
    message: string,
    context?: PipelineContext,
    level: 'info' | 'warn' | 'error' | 'success' = 'info'
  ) {
    systemDiagnosticsService.systemLog(
      'orchestrator',
      `[${this.name}] ${message}`
    );

    if (context?.log) {
      context.log(message, level);
    }
  }

  protected success(message?: string): StepResult {
    return { success: true, message };
  }

  protected failure(message: string, error?: Error): StepResult {
    return { success: false, message, error };
  }
}
