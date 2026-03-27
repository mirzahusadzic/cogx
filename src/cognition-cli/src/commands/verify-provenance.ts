import { Command } from 'commander';
import chalk from 'chalk';
import { intro, outro } from '@clack/prompts';
import { resolvePgcRoot } from './sugar/utils.js';
import { ProvenanceService } from '../core/services/lineage/provenance.js';
import { TransformLog } from '../core/pgc/transform-log.js';
import { TransformDAG } from '../core/pgc/transform-dag.js';
import { ObjectStore } from '../core/pgc/object-store.js';
import { Index } from '../core/pgc/index.js';
import { ReverseDeps } from '../core/pgc/reverse-deps.js';

export function createVerifyProvenanceCommand(): Command {
  return new Command('verify-provenance')
    .description('Verify the provenance chain for a file')
    .argument('<file>', 'File path to verify (relative to project root)')
    .option('--json', 'Output as JSON')
    .action(async (filePath: string, options: { json?: boolean }) => {
      const pgcRoot = resolvePgcRoot(process.cwd());

      if (!options.json) {
        intro(chalk.bold('Provenance Verification'));
      }

      const index = new Index(pgcRoot);
      const provenanceService = new ProvenanceService(
        new TransformLog(pgcRoot),
        new TransformDAG(pgcRoot),
        new ObjectStore(pgcRoot),
        index,
        new ReverseDeps(pgcRoot)
      );

      const indexData = await index.get(filePath);
      if (!indexData) {
        console.error(chalk.red(`✗ File not indexed: ${filePath}`));
        console.error(
          chalk.dim('  Run `cognition-cli genesis` to index the project first.')
        );
        process.exit(1);
      }

      const contentHash = indexData.content_hash;

      const chain = await provenanceService.traceForward(contentHash);
      const verification = await provenanceService.verifyChain(chain);

      if (options.json) {
        const totalObjects = chain.links.reduce(
          (sum, l) => sum + l.inputHashes.length + l.outputHashes.length,
          0
        );
        console.log(
          JSON.stringify(
            {
              filePath,
              contentHash,
              chain,
              verification: { ...verification, totalObjects },
            },
            null,
            2
          )
        );
        return;
      }

      // ── Human-readable output ────────────────────────────────────────────
      const statusIcon = verification.success
        ? chalk.green('✅')
        : chalk.red('❌');
      const statusText = verification.success
        ? chalk.green.bold('VERIFIED')
        : chalk.red.bold('BROKEN');

      console.log(`\n${statusIcon} Provenance Chain: ${statusText}`);
      console.log(chalk.bold(`\n${filePath}`));
      console.log(`  content_hash: ${chalk.cyan(contentHash.slice(0, 16))}...`);

      if (chain.links.length === 0) {
        console.log(chalk.dim('  (no recorded transforms yet)'));
      } else {
        for (const link of chain.links) {
          const phi = link.phi.toFixed(2);
          console.log(
            chalk.dim(
              `  ↓ Transform: "${link.transformType}" (${link.method}, φ=${phi})`
            )
          );
          for (const outputHash of link.outputHashes) {
            console.log(
              chalk.dim(`    ↓ output_hash: ${outputHash.slice(0, 16)}...`)
            );
          }
        }
      }

      const totalObjects = chain.links.reduce(
        (sum, l) => sum + l.inputHashes.length + l.outputHashes.length,
        0
      );
      const objectsIcon =
        verification.missingObjects.length === 0
          ? chalk.green('✅')
          : chalk.red('❌');
      const objectsLabel =
        verification.missingObjects.length === 0 ? 'present' : 'incomplete';

      console.log(
        `\nChain depth: ${chalk.cyan(String(chain.links.length))} transforms`
      );
      console.log(
        `All objects: ${objectsIcon} ${objectsLabel} (${verification.verifiedObjects}/${totalObjects})`
      );

      if (verification.missingObjects.length > 0) {
        console.log(chalk.red('\nMissing objects:'));
        for (const h of verification.missingObjects) {
          console.log(chalk.red(`  ${h.slice(0, 16)}...`));
        }
      }

      if (verification.messages.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        for (const msg of verification.messages) {
          console.log(chalk.yellow(`  ${msg}`));
        }
      }

      outro(
        verification.success
          ? chalk.green('Provenance chain verified')
          : chalk.red('Provenance chain has integrity issues')
      );
    });
}
