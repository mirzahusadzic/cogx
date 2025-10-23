import workerpool from 'workerpool';
import { PGCManager } from '../../pgc/manager.js';
import { LanceVectorStore } from '../vector-db/lance-store.js';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import { StructuralPatternMetadataSchema } from '../../types/structural.js';
import { PatternJobPacket } from './types.js';

console.log('[Worker] Script loaded - workerpool style');

async function processJob(job: PatternJobPacket) {
  try {
    const { symbolName, filePath, projectRoot, pgcRoot, force } = job;

    console.log(`[Worker] Starting job for: ${symbolName}`);

    // Test basic functionality first
    console.log(`[Worker:${symbolName}] Step 1: Creating instances...`);
    const pgc = new PGCManager(projectRoot);
    new LanceVectorStore(pgcRoot);
    new WorkbenchClient('http://localhost:8000');

    console.log(`[Worker:${symbolName}] Step 2: Checking existing pattern...`);
    console.log(`[Worker:${symbolName}] Awaiting pgc.overlays.exists...`);
    const overlayExists = await pgc.overlays.exists(
      'lineage_patterns',
      `${filePath}#${symbolName}`
    );
    console.log(
      `[Worker:${symbolName}] pgc.overlays.exists returned: ${overlayExists}`
    );

    if (!force && overlayExists) {
      console.log(`[Worker] Skipping existing pattern for ${symbolName}.`);
      return {
        status: 'skipped',
        message: `Pattern for ${symbolName} already exists.`,
        symbolName,
        filePath,
      };
    }

    console.log(
      `[Worker:${symbolName}] Step 3: Getting structural metadata...`
    );
    console.log(`[Worker:${symbolName}] Awaiting pgc.overlays.get...`);
    const structuralPatternMeta = await pgc.overlays.get(
      'structural_patterns',
      `${filePath}#${symbolName}`,
      StructuralPatternMetadataSchema
    );
    console.log(
      `[Worker:${symbolName}] pgc.overlays.get returned: ${!!structuralPatternMeta}`
    );

    if (!structuralPatternMeta) {
      console.log(
        `[Worker] Skipping ${symbolName} - no structural pattern found (likely a type/interface)`
      );
      return {
        status: 'skipped',
        message: `No structural pattern for ${symbolName} (likely type/interface)`,
        symbolName,
        filePath,
      };
    }

    // For now, just return success without the complex lineage generation
    console.log(`[Worker:${symbolName}] Successfully processed (simplified)`);

    return {
      status: 'success',
      message: `Successfully processed ${symbolName} (simplified)`,
      symbolName,
      filePath,
    };
  } catch (error: unknown) {
    console.error(`[Worker] UNHANDLED ERROR in processJob:`, error);
    return {
      status: 'error',
      message: `Error: ${(error as Error).message}`,
      symbolName: job.symbolName,
      filePath: job.filePath,
    };
  }
}

// CRITICAL: This is how workerpool expects functions to be registered
workerpool.worker({
  processJob,
});
