import { Command } from 'commander';
import { getGlobalDispatcher } from 'undici';
import { OverlayOrchestrator } from '../../core/orchestrators/overlay.js';

const generateCommand = new Command('generate')
  .description(
    'Generate a specific type of overlay (structural_patterns or lineage_patterns).'
  )
  .argument('<type>', 'The type of overlay to generate')
  .argument('[sourcePath]', 'Source path to analyze (default: from metadata or ".")', '.')
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
    if (type !== 'structural_patterns' && type !== 'lineage_patterns') {
      console.error(`Unsupported overlay type: ${type}`);
      console.error('Supported types: structural_patterns, lineage_patterns');
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

    try {
      await orchestrator.run(
        type as 'structural_patterns' | 'lineage_patterns',
        { force: options.force, skipGc: options.skipGc, sourcePath }
      );
    } finally {
      await shutdown();
    }

    console.log('[Overlay] Generation complete.');

    // Force exit after successful completion to prevent hanging
    // (embedding service or worker pool may keep event loop alive)
    process.exit(0);
  });

export { generateCommand };
