#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { genesisCommand } from './commands/genesis.js';

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
  .description('Build the foundational knowledge base from source')
  .option('-s, --source <path>', 'Source directory', './')
  .option(
    '-w, --workbench <url>',
    'egemma workbench URL',
    'http://localhost:8000'
  )
  .action(genesisCommand);

program.parse();
