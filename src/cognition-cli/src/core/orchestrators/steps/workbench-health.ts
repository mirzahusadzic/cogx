import { BaseStep } from './base.js';
import type { PipelineContext, StepResult } from '../types.js';

/**
 * Step to check if the workbench (eGemma) is reachable.
 */
export class WorkbenchHealthCheckStep extends BaseStep {
  name = 'WorkbenchHealthCheck';

  async execute(context: PipelineContext): Promise<StepResult> {
    const baseUrl = context.workbench.getBaseUrl();
    this.log(`Checking workbench health at ${baseUrl}`);

    let isHealthy = false;
    try {
      await context.workbench.health();
      isHealthy = true;
    } catch {
      isHealthy = false;
    }

    context.isWorkbenchHealthy = isHealthy;

    if (!isHealthy) {
      this.log(
        `Workbench (eGemma) is not reachable at ${baseUrl}. Structural mining will be limited.`
      );
    } else {
      this.log('Workbench is healthy.');
    }

    return this.success();
  }
}
