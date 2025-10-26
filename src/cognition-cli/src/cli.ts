#!/usr/bin/env node
import { Command } from 'commander';
import { genesisCommand } from './commands/genesis.js';
import { initCommand } from './commands/init.js';
import {
  queryCommand,
  formatAsHumanReadable,
  formatAsLineageJSON,
} from './core/query/query.js';
import { auditCommand } from './commands/audit.js';
import { addPatternsCommands } from './commands/patterns.js';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();

program
  .name('cognition-cli')
  .description('A meta-interpreter for verifiable, stateful AI cognition')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new Grounded Context Pool (PGC)')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(initCommand);

program
  .command('genesis [sourcePath]')
  .description('Builds the verifiable skeleton of a codebase')
  .option(
    '-w, --workbench <url>',
    'URL of the egemma workbench',
    'http://localhost:8000'
  )
  .option(
    '-p, --project-root <path>',
    'Root directory of the project being analyzed',
    process.cwd()
  )
  .action((sourcePath, options) => {
    genesisCommand({
      ...options,
      source: sourcePath || options.source || 'src',
    });
  });

interface QueryCommandOptions {
  projectRoot: string;
  depth: string;
  lineage: boolean;
  // Test property to trigger Monument 4.7 overlay invalidation
  testOverlayInvalidation?: boolean;
}

async function queryAction(question: string, options: QueryCommandOptions) {
  const queryResult = await queryCommand(question, options);
  if (options.lineage) {
    const jsonOutput = formatAsLineageJSON(queryResult);
    console.log(jsonOutput);
  } else {
    const humanReadableOutput = formatAsHumanReadable(queryResult);
    console.log(humanReadableOutput);
  }
}

program
  .command('query <question>')
  .description('Query the codebase for information')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project being queried',
    process.cwd()
  )
  .option('-d, --depth <level>', 'Depth of dependency traversal', '0')
  .option('--lineage', 'Output the dependency lineage in JSON format')
  .action(queryAction);

program
  .command('audit:transformations <filePath>')
  .description('Audit the transformation history of a file')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project being audited',
    process.cwd()
  )
  .option('-l, --limit <number>', 'Number of transformations to show', '5')
  .action(auditCommand);

program
  .command('genesis:docs <path>')
  .description('Ingest markdown documentation into PGC with full provenance')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .action((pathArg, options) => {
    genesisDocsCommand(pathArg, options);
  });

import { overlayCommand } from './commands/overlay.js';
import { blastRadiusCommand } from './commands/blast-radius.js';
import { createWatchCommand } from './commands/watch.js';
import { createStatusCommand } from './commands/status.js';
import { createUpdateCommand } from './commands/update.js';
import { createGuideCommand } from './commands/guide.js';
import { genesisDocsCommand } from './commands/genesis-docs.js';

program.addCommand(overlayCommand);
program.addCommand(blastRadiusCommand);
program.addCommand(createWatchCommand());
program.addCommand(createStatusCommand());
program.addCommand(createUpdateCommand());
program.addCommand(createGuideCommand());
addPatternsCommands(program);

program.parse();
