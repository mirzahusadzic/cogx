import { Command } from 'commander';
import { getGlobalDispatcher } from 'undici';
import chalk from 'chalk';
import { OverlayOrchestrator } from '../../core/orchestrators/overlay.js';

const generateCommand = new Command('generate')
  .description(
    'Generate a specific type of overlay (structural_patterns, lineage_patterns, mission_concepts, or strategic_coherence).'
  )
  .argument('<type>', 'The type of overlay to generate')
  .argument(
    '[sourcePath]',
    'Source path to analyze (default: from metadata or ".")',
    '.'
  )
  .option('-p, --project-root <path>', 'The root of the project.', '.')
  .option(
    '-f, --force',
    'Force regeneration of all patterns, even if they already exist',
    false
  )
  .option(
    '--skip-gc',
    'Skip garbage collection (recommended when switching branches or regenerating after deletion)',
    false
  )
  .action(async (type, sourcePath, options) => {
    if (
      type !== 'structural_patterns' &&
      type !== 'lineage_patterns' &&
      type !== 'mission_concepts' &&
      type !== 'strategic_coherence'
    ) {
      console.error(`Unsupported overlay type: ${type}`);
      console.error(
        'Supported types: structural_patterns, lineage_patterns, mission_concepts, strategic_coherence'
      );
      process.exit(1);
    }

    console.log(`[Overlay] Starting generation of ${type}...`);

    const orchestrator = await OverlayOrchestrator.create(options.projectRoot);

    let isShuttingDown = false;
    const shutdown = async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log('[Shutdown] Closing orchestrator...');
      await orchestrator.shutdown();
      console.log('[Shutdown] Closing global dispatcher...');
      await getGlobalDispatcher().close();
      console.log('[Shutdown] Complete.');
    };

    process.on('SIGINT', async () => {
      console.log('\n[Overlay] SIGINT received. Shutting down gracefully...');
      await shutdown();
      process.exit(1);
    });

    let exitCode = 0;
    let errorOccurred: Error | null = null;

    try {
      await orchestrator.run(
        type as
          | 'structural_patterns'
          | 'lineage_patterns'
          | 'mission_concepts'
          | 'strategic_coherence',
        { force: options.force, skipGc: options.skipGc, sourcePath }
      );
      console.log('[Overlay] Generation complete.');
    } catch (error) {
      errorOccurred = error instanceof Error ? error : new Error(String(error));
      exitCode = 1;
    } finally {
      await shutdown();
    }

    // Print error after shutdown completes
    if (errorOccurred) {
      console.error(chalk.red(`\n[Overlay] Error: ${errorOccurred.message}`));
    }

    // Force exit to prevent hanging (embedding service or worker pool may keep event loop alive)
    process.exit(exitCode);
  });

export { generateCommand };
