import { PGCManager } from '../core/pgc/manager.js';
import { TransformLog } from '../core/pgc/transform-log.js';
import { TransformData } from '../core/types/transform.js';
import { DocsOracle } from '../core/pgc/oracles/docs.js';
import chalk from 'chalk';

/**
 * Represents options for the audit command.
 */
interface AuditOptions {
  projectRoot: string;
  limit: string;
}

/**
 * Audits transformation history for a specific file path.
 */
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

/**
 * Audits document integrity using the DocsOracle.
 */
export async function auditDocsCommand(options: {
  projectRoot: string;
}): Promise<void> {
  const pgc = new PGCManager(options.projectRoot);
  const oracle = new DocsOracle(pgc);

  console.log('');
  console.log(chalk.bold.cyan('📋 Document Integrity Audit'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log('');

  // Run verification
  const result = await oracle.verify();

  // Display results
  if (result.success) {
    console.log(chalk.green('✓ Document integrity check passed'));
    console.log('');
    if (result.messages.length > 0) {
      result.messages.forEach((msg) => {
        console.log(chalk.dim(`  ${msg}`));
      });
    }
  } else {
    console.log(chalk.red('✗ Document integrity issues found'));
    console.log('');
    result.messages.forEach((msg) => {
      if (msg.includes('✓')) {
        console.log(chalk.green(`  ${msg}`));
      } else if (msg.includes('orphaned') || msg.includes('Found')) {
        console.log(chalk.yellow(`  ${msg}`));
      } else {
        console.log(chalk.red(`  ${msg}`));
      }
    });
  }

  console.log('');

  // List all documents
  const docs = await oracle.listDocuments();
  if (docs.length > 0) {
    console.log(chalk.bold.white(`📚 Indexed Documents (${docs.length}):`));
    console.log('');
    docs.forEach((doc) => {
      console.log(
        chalk.white(`  ${chalk.cyan(doc.fileName)} → ${doc.filePath}`)
      );
      console.log(chalk.dim(`    Content: ${doc.contentHash.slice(0, 12)}...`));
      console.log(chalk.dim(`    Object:  ${doc.objectHash.slice(0, 12)}...`));
      console.log(
        chalk.dim(`    Ingested: ${new Date(doc.timestamp).toLocaleString()}`)
      );
      console.log('');
    });
  }

  console.log(chalk.dim('  Use "genesis:docs <path>" to ingest documents.'));
  console.log('');

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}
