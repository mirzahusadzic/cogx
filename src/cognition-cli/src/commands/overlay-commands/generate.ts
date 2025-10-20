import { Command } from 'commander';
import { OverlayOrchestrator } from '../../orchestrators/overlay-orchestrator.js';

const generateCommand = new Command('generate')
  .description(
    'Generate a specific type of overlay (structural_patterns or lineage_patterns).'
  )
  .argument('<type>', 'The type of overlay to generate')
  .option('-p, --project-root <path>', 'The root of the project.', '.')
  .action(async (type, options) => {
    if (type !== 'structural_patterns' && type !== 'lineage_patterns') {
      console.error(`Unsupported overlay type: ${type}`);
      console.error('Supported types: structural_patterns, lineage_patterns');
      process.exit(1);
    }

    console.log(`[Overlay] Starting generation of ${type}...`);

    const orchestrator = await OverlayOrchestrator.create(options.projectRoot);
    await orchestrator.run(type as 'structural_patterns' | 'lineage_patterns');

    console.log('[Overlay] Generation complete.');
  });

export { generateCommand };
