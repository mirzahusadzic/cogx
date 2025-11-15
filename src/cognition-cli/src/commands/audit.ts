/**
 * PGC Audit Commands
 *
 * Provides comprehensive auditing capabilities for the Grounded Context Pool (PGC),
 * enabling verification of transformation history, document integrity, and overlay
 * consistency. Audit commands ensure PGC maintains verifiable provenance for all
 * stored knowledge.
 *
 * AUDIT TYPES:
 * 1. **Transformation Audit** (`audit <file>`):
 *    - Shows transformation history for a specific file
 *    - Displays goal, fidelity (φ), verification results
 *    - Traces inputs and outputs for each iteration
 *
 * 2. **Document Integrity Audit** (`audit:docs`):
 *    - Verifies all ingested documents are properly indexed
 *    - Detects orphaned documents (in objects/ but not indexed)
 *    - Lists all indexed documents with metadata
 *
 * DESIGN:
 * The audit system leverages PGC's immutable object storage and transformation
 * logs to provide complete auditability:
 * - Every transformation is logged with cryptographic hashes
 * - Object provenance is traceable via transform_id
 * - Document integrity verified via content hashing
 *
 * VERIFICATION WORKFLOW:
 * 1. Read index entry for file/document
 * 2. Retrieve transformation history from transform log
 * 3. Verify each transformation's inputs/outputs
 * 4. Check for consistency with current state
 *
 * INTEGRATION:
 * - Used in CI/CD to verify PGC integrity before deployment
 * - Supports compliance requirements for verifiable ML/AI systems
 * - Enables debugging of transformation failures
 *
 * @example
 * // Audit transformation history
 * cognition-cli audit src/utils/helpers.ts --limit 5
 * // → Shows last 5 transformations with φ scores
 *
 * @example
 * // Audit document integrity
 * cognition-cli audit:docs
 * // → Verifies all docs, lists ingested documents
 */

import { PGCManager } from '../core/pgc/manager.js';
import { TransformLog } from '../core/pgc/transform-log.js';
import { TransformData } from '../core/types/transform.js';
import { DocsOracle } from '../core/pgc/oracles/docs.js';
import chalk from 'chalk';

/**
 * Options for the audit command
 */
interface AuditOptions {
  /** Root directory of the project containing .open_cognition */
  projectRoot: string;
  /** Maximum number of transformations to display */
  limit: string;
}

/**
 * Audits transformation history for a specific file path
 *
 * Retrieves and displays the transformation history from the PGC index,
 * showing each iteration's goal, fidelity score, verification result,
 * and input/output hashes.
 *
 * @param filePath - Path to file to audit (relative to project root)
 * @param options - Audit command options
 *
 * @example
 * await auditCommand('src/utils/helpers.ts', {
 *   projectRoot: '/path/to/project',
 *   limit: '10'
 * });
 * // → Shows last 10 transformations for helpers.ts
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

/**
 * Displays transformation data in human-readable format
 *
 * Formats and prints transformation metadata including goal, fidelity score,
 * verification status, and input/output hashes.
 *
 * @param data - Transformation data to display
 */
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
 * Audits document integrity using the DocsOracle
 *
 * Verifies that all ingested documents are properly indexed and detects
 * orphaned documents. Displays comprehensive report including document
 * metadata (content hash, object hash, timestamp).
 *
 * VERIFICATION CHECKS:
 * - All documents in index/docs/ have corresponding objects
 * - All document objects have corresponding index entries
 * - Content hashes match stored objects
 * - No orphaned documents in objects/
 *
 * EXIT BEHAVIOR:
 * - Exits with code 0 if all checks pass
 * - Exits with code 1 if integrity issues found
 *
 * @param options - Audit docs command options
 * @param options.projectRoot - Root directory of the project
 *
 * @example
 * await auditDocsCommand({ projectRoot: '/path/to/project' });
 * // → Verifies document integrity, lists all docs
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
