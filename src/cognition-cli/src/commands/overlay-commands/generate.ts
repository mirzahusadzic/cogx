import { Command } from 'commander';
import { OverlayOrchestrator } from '../../orchestrators/overlay-orchestrator.js';

const generateCommand = new Command('generate')
  .description(
    'Generate a specific type of overlay (e.g., structural_patterns).'
  )
  .argument('<type>', 'The type of overlay to generate')
  .option('-p, --project-root <path>', 'The root of the project.', '.')
  .action(async (type, options) => {
    if (type !== 'structural_patterns') {
      console.error(`Unsupported overlay type: ${type}`);
      process.exit(1);
    }

    console.log('[Overlay] Starting generation of structural patterns...');

    const orchestrator = await OverlayOrchestrator.create(options.projectRoot);
    await orchestrator.run();

    console.log('[Overlay] Generation complete.');
  });

export { generateCommand };
