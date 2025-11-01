import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';
import { MissionConceptsManager } from '../core/overlays/mission-concepts/manager.js';
import { MissionConcept } from '../core/analyzers/concept-extractor.js';
import { WorkspaceManager } from '../core/workspace-manager.js';

/**
 * Helper to resolve PGC root with walk-up
 */
function resolvePgcRoot(startPath: string): string {
  const workspaceManager = new WorkspaceManager();
  const projectRoot = workspaceManager.resolvePgcRoot(startPath);

  if (!projectRoot) {
    console.error(
      chalk.red(
        '\n✗ No .open_cognition workspace found. Run "cognition-cli init" to create one.\n'
      )
    );
    process.exit(1);
  }

  return path.join(projectRoot, '.open_cognition');
}

/**
 * Adds mission concept query commands to the CLI program.
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
    .action(async (options) => {
      const pgcRoot = resolvePgcRoot(options.projectRoot);
      const manager = new MissionConceptsManager(pgcRoot);
      const limit = parseInt(options.limit);

      // Get all document hashes
      const docHashes = await manager.list();

      if (docHashes.length === 0) {
        console.error(
          chalk.red(
            '\n✗ No mission concepts found. Run "cognition-cli overlay generate mission_concepts" first.\n'
          )
        );
        process.exit(1);
      }

      // Collect all concepts from all documents
      const allConcepts: Array<MissionConcept & { documentHash: string }> = [];

      for (const docHash of docHashes) {
        const overlay = await manager.retrieve(docHash);
        if (overlay) {
          overlay.extracted_concepts.forEach((concept) => {
            allConcepts.push({
              ...concept,
              documentHash: docHash,
            });
          });
        }
      }

      // Sort by weight descending
      allConcepts.sort((a, b) => b.weight - a.weight);

      // Limit results
      const concepts = allConcepts.slice(0, limit);

      if (options.json) {
        console.log(JSON.stringify(concepts, null, 2));
        return;
      }

      console.log('');
      console.log(
        chalk.bold.cyan(
          `📚 Mission Concepts (showing ${concepts.length} of ${allConcepts.length})`
        )
      );
      console.log(chalk.gray('━'.repeat(80)));
      console.log('');

      concepts.forEach((concept, i) => {
        const weightBar = '█'.repeat(Math.round(concept.weight * 30));
        const weightPercent = (concept.weight * 100).toFixed(1);

        console.log(
          `${chalk.dim((i + 1).toString().padStart(4))}. ${chalk.cyan(weightBar)} ${chalk.white(weightPercent + '%')}`
        );
        console.log(
          chalk.white(
            `      ${chalk.bold(concept.text.slice(0, 120))}${concept.text.length > 120 ? '...' : ''}`
          )
        );
        console.log(
          chalk.dim(
            `      Section: ${concept.section} | Occurrences: ${concept.occurrences} | Embedding: ${concept.embedding ? '✓' : '✗'}`
          )
        );
        console.log('');
      });

      if (allConcepts.length > limit) {
        console.log(
          chalk.dim(
            `  Showing ${limit} of ${allConcepts.length} concepts. Use --limit to see more.`
          )
        );
        console.log('');
      }

      console.log(
        chalk.dim(
          '  Use "concepts inspect <text>" to see detailed concept info.'
        )
      );
      console.log('');
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
    .action(async (count, options) => {
      const pgcRoot = resolvePgcRoot(options.projectRoot);
      const manager = new MissionConceptsManager(pgcRoot);
      const topN = parseInt(count || '20');

      const topConcepts = await manager.getTopConcepts(topN);

      if (topConcepts.length === 0) {
        console.error(
          chalk.red(
            '\n✗ No mission concepts found. Run "cognition-cli overlay generate mission_concepts" first.\n'
          )
        );
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(topConcepts, null, 2));
        return;
      }

      console.log('');
      console.log(
        chalk.bold.cyan(`🏆 Top ${topConcepts.length} Mission Concepts`)
      );
      console.log(chalk.gray('━'.repeat(80)));
      console.log('');

      topConcepts.forEach((concept, i) => {
        const weightBar = '█'.repeat(Math.round(concept.weight * 30));
        const weightPercent = (concept.weight * 100).toFixed(1);

        console.log(
          `${chalk.white((i + 1).toString().padStart(3))}. ${chalk.green(weightBar)} ${chalk.white(weightPercent + '%')}`
        );
        console.log(chalk.white(`     ${chalk.bold(concept.text)}`));
        console.log(
          chalk.dim(
            `     Section: ${concept.section} | Occurrences: ${concept.occurrences}`
          )
        );
        console.log('');
      });

      console.log(
        chalk.dim('  Use "concepts inspect <text>" for detailed analysis.')
      );
      console.log('');
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
    .action(async (keyword, options) => {
      const pgcRoot = resolvePgcRoot(options.projectRoot);
      const manager = new MissionConceptsManager(pgcRoot);

      // Get all document hashes
      const docHashes = await manager.list();

      if (docHashes.length === 0) {
        console.error(
          chalk.red(
            '\n✗ No mission concepts found. Run "cognition-cli overlay generate mission_concepts" first.\n'
          )
        );
        process.exit(1);
      }

      // Collect all concepts from all documents
      const allConcepts: MissionConcept[] = [];

      for (const docHash of docHashes) {
        const overlay = await manager.retrieve(docHash);
        if (overlay) {
          allConcepts.push(...overlay.extracted_concepts);
        }
      }

      // Search for keyword (case-insensitive)
      const keywordLower = keyword.toLowerCase();
      const matches = allConcepts.filter((concept) =>
        concept.text.toLowerCase().includes(keywordLower)
      );

      // Sort by weight descending
      matches.sort((a, b) => b.weight - a.weight);

      if (options.json) {
        console.log(JSON.stringify(matches, null, 2));
        return;
      }

      if (matches.length === 0) {
        console.log('');
        console.log(chalk.yellow(`⚠ No concepts found matching "${keyword}"`));
        console.log('');
        console.log(
          chalk.dim(
            '  Try different keywords or use "concepts list" to see all.'
          )
        );
        console.log('');
        return;
      }

      console.log('');
      console.log(
        chalk.bold.cyan(
          `🔍 Concepts Matching "${keyword}" (${matches.length} found)`
        )
      );
      console.log(chalk.gray('━'.repeat(80)));
      console.log('');

      matches.forEach((concept, i) => {
        const weightBar = '█'.repeat(Math.round(concept.weight * 30));
        const weightPercent = (concept.weight * 100).toFixed(1);

        // Highlight the keyword in the text
        const regex = new RegExp(`(${keyword})`, 'gi');
        const highlightedText = concept.text.replace(
          regex,
          chalk.yellow.bold('$1')
        );

        console.log(
          `${chalk.dim((i + 1).toString().padStart(3))}. ${chalk.cyan(weightBar)} ${chalk.white(weightPercent + '%')}`
        );
        console.log(chalk.white(`     ${highlightedText}`));
        console.log(
          chalk.dim(
            `     Section: ${concept.section} | Occurrences: ${concept.occurrences}`
          )
        );
        console.log('');
      });

      console.log(
        chalk.dim('  Use "concepts inspect <text>" for detailed analysis.')
      );
      console.log('');
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
    .action(async (section, options) => {
      const pgcRoot = resolvePgcRoot(options.projectRoot);
      const manager = new MissionConceptsManager(pgcRoot);

      // Get all document hashes
      const docHashes = await manager.list();

      if (docHashes.length === 0) {
        console.error(
          chalk.red(
            '\n✗ No mission concepts found. Run "cognition-cli overlay generate mission_concepts" first.\n'
          )
        );
        process.exit(1);
      }

      // Collect all concepts from all documents
      const allConcepts: MissionConcept[] = [];

      for (const docHash of docHashes) {
        const overlay = await manager.retrieve(docHash);
        if (overlay) {
          allConcepts.push(...overlay.extracted_concepts);
        }
      }

      // Filter by section (case-insensitive)
      const sectionLower = section.toLowerCase();
      const matches = allConcepts.filter((concept) =>
        concept.section.toLowerCase().includes(sectionLower)
      );

      // Sort by weight descending
      matches.sort((a, b) => b.weight - a.weight);

      if (options.json) {
        console.log(JSON.stringify(matches, null, 2));
        return;
      }

      if (matches.length === 0) {
        console.log('');
        console.log(
          chalk.yellow(`⚠ No concepts found in section "${section}"`)
        );
        console.log('');
        console.log(
          chalk.dim(
            '  Common sections: Vision, Mission, Principles, Strategic Intent'
          )
        );
        console.log('');
        return;
      }

      console.log('');
      console.log(
        chalk.bold.cyan(
          `📖 Concepts from "${section}" (${matches.length} found)`
        )
      );
      console.log(chalk.gray('━'.repeat(80)));
      console.log('');

      matches.forEach((concept, i) => {
        const weightBar = '█'.repeat(Math.round(concept.weight * 30));
        const weightPercent = (concept.weight * 100).toFixed(1);

        console.log(
          `${chalk.dim((i + 1).toString().padStart(3))}. ${chalk.cyan(weightBar)} ${chalk.white(weightPercent + '%')}`
        );
        console.log(chalk.white(`     ${chalk.bold(concept.text)}`));
        console.log(
          chalk.dim(
            `     Section: ${concept.section} | Occurrences: ${concept.occurrences}`
          )
        );
        console.log('');
      });

      console.log(
        chalk.dim('  Use "concepts inspect <text>" for detailed analysis.')
      );
      console.log('');
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
    .action(async (text, options) => {
      const pgcRoot = resolvePgcRoot(options.projectRoot);
      const manager = new MissionConceptsManager(pgcRoot);

      // Get all document hashes
      const docHashes = await manager.list();

      if (docHashes.length === 0) {
        console.error(
          chalk.red(
            '\n✗ No mission concepts found. Run "cognition-cli overlay generate mission_concepts" first.\n'
          )
        );
        process.exit(1);
      }

      // Search for exact or partial matches
      let foundConcept: MissionConcept | null = null;
      let documentPath: string | null = null;

      for (const docHash of docHashes) {
        const overlay = await manager.retrieve(docHash);
        if (overlay) {
          // Try exact match first
          const exactMatch = overlay.extracted_concepts.find(
            (c) => c.text === text
          );
          if (exactMatch) {
            foundConcept = exactMatch;
            documentPath = overlay.document_path;
            break;
          }

          // Try partial match (case-insensitive)
          const partialMatch = overlay.extracted_concepts.find((c) =>
            c.text.toLowerCase().includes(text.toLowerCase())
          );
          if (partialMatch) {
            foundConcept = partialMatch;
            documentPath = overlay.document_path;
            break;
          }
        }
      }

      if (!foundConcept) {
        console.error(chalk.red(`\n✗ Concept not found: "${text}"\n`));
        console.log(
          chalk.dim(
            '  Use "concepts search <keyword>" to find similar concepts.'
          )
        );
        console.log('');
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(foundConcept, null, 2));
        return;
      }

      // Display detailed concept information
      console.log('');
      console.log(
        chalk.bold.cyan(`🔬 Mission Concept: ${chalk.white(foundConcept.text)}`)
      );
      console.log(chalk.gray('━'.repeat(80)));
      console.log('');

      const weightBar = '█'.repeat(Math.round(foundConcept.weight * 40));
      const weightPercent = (foundConcept.weight * 100).toFixed(1);

      console.log(chalk.bold.white('  Importance:'));
      console.log(
        `    ${chalk.green(weightBar)} ${chalk.white(weightPercent + '%')}`
      );
      console.log('');

      console.log(chalk.bold.white('  Source:'));
      console.log(
        chalk.white(`    Document: ${chalk.dim(documentPath || 'unknown')}`)
      );
      console.log(
        chalk.white(`    Section: ${chalk.cyan(foundConcept.section)}`)
      );
      console.log(
        chalk.white(
          `    Section hash: ${chalk.dim(foundConcept.sectionHash.slice(0, 16))}...`
        )
      );
      console.log('');

      console.log(chalk.bold.white('  Occurrences:'));
      console.log(
        chalk.white(
          `    Appears ${chalk.cyan(foundConcept.occurrences)} time(s) in document`
        )
      );
      console.log('');

      console.log(chalk.bold.white('  Embedding:'));
      if (foundConcept.embedding) {
        console.log(
          chalk.green(
            `    ✓ 768-dimensional vector (${foundConcept.embedding.length} dims)`
          )
        );
        console.log(
          chalk.dim(
            `    First 5 dims: [${foundConcept.embedding
              .slice(0, 5)
              .map((v) => v.toFixed(3))
              .join(', ')}...]`
          )
        );
      } else {
        console.log(chalk.red('    ✗ No embedding generated'));
      }
      console.log('');

      console.log(chalk.dim('  Related commands:'));
      console.log(
        chalk.dim(
          `    concepts by-section ${foundConcept.section}  # More from this section`
        )
      );
      console.log(
        chalk.dim(
          `    concepts search "${foundConcept.text.split(' ').slice(0, 2).join(' ')}"      # Similar concepts`
        )
      );
      console.log('');
    });
}
