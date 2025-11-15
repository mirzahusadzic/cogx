/**
 * Overlay Generation Command
 *
 * Generates specific analytical overlays (O₁-O₇) in the Grounded Context Pool (PGC).
 * Each overlay type extracts and embeds different aspects of the codebase and
 * documentation, enabling semantic queries and cross-overlay analysis.
 *
 * OVERLAY SYSTEM (O₁-O₇):
 * - O₁ structural_patterns: Code symbols (functions, classes, interfaces)
 * - O₂ security_guidelines: Security threats, boundaries, mitigations
 * - O₃ lineage_patterns: Dependency relationships (imports, calls)
 * - O₄ mission_concepts: Mission document concepts (VISION.md, etc.)
 * - O₅ operational_patterns: Workflow patterns, quest structures
 * - O₆ mathematical_proofs: Theorems, lemmas, axioms, identities
 * - O₇ strategic_coherence: Code-to-mission alignment scores
 *
 * DESIGN RATIONALE:
 * 1. Separation of Concerns: Each overlay captures one aspect
 * 2. Composability: Overlays can be combined via lattice algebra
 * 3. Incremental Updates: Regenerate only changed overlays
 * 4. Version Control: Overlays track lineage and timestamps
 *
 * GENERATION PROCESS:
 * 1. Extract: Parse source code/docs to identify items
 * 2. Embed: Generate vector embeddings via embedding service
 * 3. Store: Save to LanceDB vector store and YAML manifests
 * 4. Index: Update metadata for fast retrieval
 *
 * OPTIONS:
 * - --force: Regenerate all patterns, even if they exist
 * - --skip-gc: Skip garbage collection (useful after deletions)
 *
 * @example
 * // Generate structural patterns (O₁)
 * $ cognition-cli overlay generate structural_patterns
 * // Extracts all code symbols and creates embeddings
 *
 * @example
 * // Regenerate security guidelines (O₂) with force
 * $ cognition-cli overlay generate security_guidelines --force
 * // Forces complete regeneration, overwriting existing data
 *
 * @example
 * // Generate strategic coherence (O₇) without garbage collection
 * $ cognition-cli overlay generate strategic_coherence --skip-gc
 * // Useful when switching branches to preserve old embeddings
 */

import { Command } from 'commander';
import { getGlobalDispatcher } from 'undici';
import chalk from 'chalk';
import { OverlayOrchestrator } from '../../core/orchestrators/overlay.js';

/**
 * Command for generating specific types of analytical overlays
 *
 * Delegates to OverlayOrchestrator which handles the extraction,
 * embedding, and storage pipeline for each overlay type.
 */
const generateCommand = new Command('generate')
  .description(
    'Generate a specific type of overlay (all 7 overlay types supported).'
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
    const supportedTypes = [
      'structural_patterns',
      'security_guidelines',
      'lineage_patterns',
      'mission_concepts',
      'operational_patterns',
      'mathematical_proofs',
      'strategic_coherence',
    ];

    if (!supportedTypes.includes(type)) {
      console.error(`Unsupported overlay type: ${type}`);
      console.error(`Supported types: ${supportedTypes.join(', ')}`);
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
          | 'security_guidelines'
          | 'lineage_patterns'
          | 'mission_concepts'
          | 'operational_patterns'
          | 'mathematical_proofs'
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
