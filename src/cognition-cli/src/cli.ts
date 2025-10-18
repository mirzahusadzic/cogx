#!/usr/bin/env node
import { Command } from 'commander';
import { genesisCommand } from './commands/genesis.js';
import { initCommand } from './commands/init.js';
import { queryCommand } from './commands/query.js';
import { auditCommand } from './commands/audit.js';
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
  .command('genesis')
  .description('Builds the verifiable skeleton of a codebase')
  .option('-s, --source <path>', 'Path to the source code to analyze', 'src')
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
  .action(genesisCommand);

program
  .command('query <question>')
  .description('Query the codebase for information')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project being queried',
    process.cwd()
  )
  .option('-d, --depth <level>', 'Depth of dependency traversal', '0')
  .action(queryCommand);

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

program.parse();
