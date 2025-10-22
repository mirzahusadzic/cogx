import { PGCManager } from '../../pgc/manager.js';
import { LanceVectorStore } from '../vector-db/lance-store.js';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import { StructuralPatternMetadataSchema } from '../../types/structural.js';
import { PatternJobPacket } from './types.js';

console.log('[Worker] Script loaded - workerpool style');

// Remove all worker_threads code and just export the function
export async function processJob(job: PatternJobPacket) {
  const { symbolName, filePath, projectRoot, pgcRoot, force } = job;

  console.log(`[Worker] Starting job for: ${symbolName}`);

  try {
    // Test basic functionality first
    console.log(`[Worker:${symbolName}] Step 1: Creating instances...`);
    const pgc = new PGCManager(projectRoot);
    new LanceVectorStore(pgcRoot);
    new WorkbenchClient('http://localhost:8000');

    console.log(`[Worker:${symbolName}] Step 2: Checking existing pattern...`);
    const overlayKey = `${filePath}#${symbolName}`;

    if (!force && (await pgc.overlays.exists('lineage_patterns', overlayKey))) {
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
    const structuralPatternMeta = await pgc.overlays.get(
      'structural_patterns',
      `${filePath}#${symbolName}`,
      StructuralPatternMetadataSchema
    );

    if (!structuralPatternMeta) {
      throw new Error(`Structural metadata not found for ${symbolName}.`);
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
    console.error(`[Worker] Error processing ${symbolName}:`, error);
    return {
      status: 'error',
      message: `Error: ${(error as Error).message}`,
      symbolName,
      filePath,
    };
  }
}

// Optional: Export multiple functions if needed
export const worker = {
  processJob,
};
