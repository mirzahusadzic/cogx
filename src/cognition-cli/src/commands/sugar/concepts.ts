/**
 * Mission Concepts Query Commands
 *
 * Provides comprehensive commands for exploring and analyzing strategic concepts
 * extracted from documentation in the Grounded Context Pool (PGC). Mission concepts
 * represent the strategic foundation of the codebase, enabling mission-code alignment
 * analysis through overlay O7 (strategic_coherence).
 *
 * MISSION CONCEPTS:
 * Concepts are extracted from strategic documentation (VISION.md, etc.) with:
 * - Text: The actual concept text
 * - Section: Document section (Vision, Mission, Principles, etc.)
 * - Weight: Importance score (0-1) based on occurrences and position
 * - Occurrences: Number of times concept appears in document
 * - Embedding: 768-dimensional semantic vector
 *
 * COMMANDS:
 * - `concepts list`: List all mission concepts with weights
 * - `concepts top [N]`: Show top N concepts by weight
 * - `concepts search <keyword>`: Find concepts matching keyword
 * - `concepts by-section <section>`: Filter by section
 * - `concepts inspect <text>`: Detailed concept information
 *
 * WEIGHT CALCULATION:
 * Concept weight is calculated based on:
 * - Position in document (earlier = higher weight)
 * - Section importance (Vision > Mission > Principles)
 * - Number of occurrences (more = higher weight)
 * - TF-IDF scoring across all documents
 *
 * INTEGRATION WITH O7:
 * Mission concepts from O4 are compared with code patterns from O1-O6 to
 * generate the strategic coherence overlay (O7), which identifies:
 * - Concepts well-represented in code
 * - Concepts lacking implementation
 * - Code patterns misaligned with mission
 *
 * @example
 * // Show top mission concepts
 * cognition-cli concepts top 20
 * // → Lists top 20 concepts by weight with progress bars
 *
 * @example
 * // Search for security-related concepts
 * cognition-cli concepts search security
 * // → Shows all concepts containing "security"
 *
 * @example
 * // Inspect specific concept
 * cognition-cli concepts inspect "transparent verifiability"
 * // → Shows weight, section, occurrences, embedding
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { MissionConceptsManager } from '../../core/overlays/mission-concepts/manager.js';
import { resolvePgcRoot, displayItemList } from './utils.js';

/**
 * Adds mission concept query commands to the CLI program
 *
 * Registers all concept-related subcommands under the `concepts` command group.
 * Each subcommand operates on mission concepts stored in the O4 overlay.
 *
 * @param program - Commander program instance to add commands to
 */
export function addConceptsCommands(program: Command) {
  const conceptsCommand = program
    .command('concepts')
    .description(
      'Commands for querying mission concepts from strategic documents.'
    );

  /**
   * concepts list
   * List all mission concepts with their weights and sections
   */
  conceptsCommand
    .command('list')
    .description('List all extracted mission concepts')
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option('--json', 'Output raw JSON')
    .option('--limit <number>', 'Limit number of concepts to show', '100')
    .action(async (options, command) => {
      const pgcRoot = resolvePgcRoot(options.projectRoot);
      const manager = new MissionConceptsManager(pgcRoot);
      const limit = parseInt(options.limit || '100');

      const allOpts = command.optsWithGlobals();
      const useJson = allOpts.json || options.json;

      const allItems = await manager.getAllItems();

      if (allItems.length === 0) {
        if (!useJson) {
          console.error(
            chalk.red(
              '\n✗ No mission concepts found. Run "cognition-cli overlay generate mission_concepts" first.\n'
            )
          );
        }
        process.exit(1);
      }

      // Sort by weight descending
      allItems.sort(
        (a, b) => (b.metadata.weight || 0) - (a.metadata.weight || 0)
      );

      displayItemList(allItems, 'mission concepts', {
        ...options,
        format: useJson ? 'json' : options.format,
        limit,
        scoreField: 'weight',
      });
    });

  /**
   * concepts top [N]
   * Show top N mission concepts by weight
   */
  conceptsCommand
    .command('top [count]')
    .description('Show top mission concepts by weight (default: 20)')
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option('--json', 'Output raw JSON')
    .action(async (count, options, command) => {
      const pgcRoot = resolvePgcRoot(options.projectRoot);
      const manager = new MissionConceptsManager(pgcRoot);
      const topN = parseInt(count || '20');

      const allOpts = command.optsWithGlobals();
      const useJson = allOpts.json || options.json;

      const topConcepts = await manager.getTopConcepts(topN);

      if (topConcepts.length === 0) {
        if (!useJson) {
          console.error(
            chalk.red(
              '\n✗ No mission concepts found. Run "cognition-cli overlay generate mission_concepts" first.\n'
            )
          );
        }
        process.exit(1);
      }

      // Convert to OverlayItems for displayItemList
      const items = topConcepts.map((c, i) => ({
        id: `top-${i + 1}`,
        embedding: [],
        metadata: {
          ...c,
          type: 'concept',
        },
      }));

      displayItemList(items, 'top mission concepts', {
        ...options,
        format: useJson ? 'json' : options.format,
        limit: topN,
        scoreField: 'weight',
      });
    });

  /**
   * concepts search <keyword>
   * Find concepts matching a keyword
   */
  conceptsCommand
    .command('search <keyword>')
    .description('Find concepts matching a keyword')
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option('--json', 'Output raw JSON')
    .action(async (keyword, options, command) => {
      const pgcRoot = resolvePgcRoot(options.projectRoot);
      const manager = new MissionConceptsManager(pgcRoot);

      const allOpts = command.optsWithGlobals();
      const useJson = allOpts.json || options.json;

      const allItems = await manager.getAllItems();

      // Search for keyword (case-insensitive)
      const keywordLower = keyword.toLowerCase();
      const matches = allItems.filter((item) =>
        item.metadata.text.toLowerCase().includes(keywordLower)
      );

      // Sort by weight descending
      matches.sort(
        (a, b) => (b.metadata.weight || 0) - (a.metadata.weight || 0)
      );

      displayItemList(matches, `concepts matching "${keyword}"`, {
        ...options,
        format: useJson ? 'json' : options.format,
        scoreField: 'weight',
      });
    });

  /**
   * concepts by-section <section>
   * Filter concepts by section (Vision, Mission, Principles, etc.)
   */
  conceptsCommand
    .command('by-section <section>')
    .description(
      'Filter concepts by section (Vision, Mission, Principles, etc.)'
    )
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option('--json', 'Output raw JSON')
    .action(async (section, options, command) => {
      const pgcRoot = resolvePgcRoot(options.projectRoot);
      const manager = new MissionConceptsManager(pgcRoot);

      const allOpts = command.optsWithGlobals();
      const useJson = allOpts.json || options.json;

      const allItems = await manager.getAllItems();

      // Filter by section (case-insensitive)
      const sectionLower = section.toLowerCase();
      const matches = allItems.filter((item) =>
        item.metadata.section.toLowerCase().includes(sectionLower)
      );

      // Sort by weight descending
      matches.sort(
        (a, b) => (b.metadata.weight || 0) - (a.metadata.weight || 0)
      );

      displayItemList(matches, `concepts from "${section}"`, {
        ...options,
        format: useJson ? 'json' : options.format,
        scoreField: 'weight',
      });
    });

  /**
   * concepts inspect <text>
   * Show detailed information about a specific concept
   */
  conceptsCommand
    .command('inspect <text>')
    .description('Show detailed information about a specific concept')
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option('--json', 'Output raw JSON')
    .action(async (text, options, command) => {
      const pgcRoot = resolvePgcRoot(options.projectRoot);
      const manager = new MissionConceptsManager(pgcRoot);

      const allOpts = command.optsWithGlobals();
      const useJson = allOpts.json || options.json;

      const allItems = await manager.getAllItems();

      // Search for exact or partial matches
      const foundItem =
        allItems.find((item) => item.metadata.text === text) ||
        allItems.find((item) =>
          item.metadata.text.toLowerCase().includes(text.toLowerCase())
        );

      if (!foundItem) {
        if (!useJson) {
          console.error(chalk.red(`\n✗ Concept not found: "${text}"\n`));
        }
        process.exit(1);
      }

      if (useJson) {
        console.log(JSON.stringify(foundItem, null, 2));
        return;
      }

      // Re-use displayItemList for a single item (it works well for this)
      displayItemList([foundItem], 'concept details', {
        ...options,
        format: 'table',
        scoreField: 'weight',
      });

      // Add a bit more detail since it's "inspect"
      console.log(chalk.bold.white('  Additional Details:'));
      console.log(
        chalk.white(
          `    Document Hash: ${chalk.dim(foundItem.metadata.documentHash)}`
        )
      );
      console.log(
        chalk.white(
          `    Section Hash: ${chalk.dim(foundItem.metadata.sectionHash)}`
        )
      );
      if (foundItem.embedding && foundItem.embedding.length > 0) {
        console.log(
          chalk.green(
            `    ✓ Embedding: ${foundItem.embedding.length} dimensions`
          )
        );
      }
      console.log('');
    });
}
