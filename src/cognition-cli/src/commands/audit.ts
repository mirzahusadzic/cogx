import { PGCManager } from '../core/pgc-manager.js';
import { TransformLog } from '../core/transform-log.js';
import { TransformData } from '../types/transform.js';

interface AuditOptions {
  projectRoot: string;
  limit: string;
}

export async function auditCommand(filePath: string, options: AuditOptions) {
  const pgc = new PGCManager(options.projectRoot);
  const transformLog = new TransformLog(pgc.pgcRoot);
  const limit = parseInt(options.limit, 10);

  const indexData = await pgc.index.get(filePath);

  if (!indexData) {
    console.log(`No index data found for file: ${filePath}`);
    return;
  }

  const history = indexData.history || [];
  if (history.length === 0) {
    console.log(`No transformation history found for file: ${filePath}`);
    return;
  }

  const recentHistory = history.slice(-limit);

  console.log(
    `Auditing last ${recentHistory.length} transformations for: ${filePath}`
  );

  for (let i = 0; i < recentHistory.length; i++) {
    const transformHash = recentHistory[i];
    const transformData = await transformLog.getTransformData(transformHash);

    if (transformData) {
      console.log(`
--- Iteration ${i + 1} (Transform: ${transformHash}) ---`);
      displayTransformData(transformData);
    } else {
      console.log(`
--- Iteration ${i + 1} (Transform: ${transformHash}) ---`);
      console.log(`  Could not retrieve transform data.`);
    }
  }
}

function displayTransformData(data: TransformData) {
  console.log(`  Goal: ${data.goal}`);
  console.log(`  Fidelity (Phi): ${data.phi}`);
  console.log(`  Verification Result: ${data.verification_result.status}`);
  console.log(`  Inputs:`);
  for (const input of data.inputs) {
    console.log(`    - ${input.path} (${input.hash})`);
  }
  console.log(`  Outputs:`);
  for (const output of data.outputs) {
    console.log(`    - ${output.path} (${output.hash})`);
  }
}
