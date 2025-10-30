#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { genesisCommand } from './commands/genesis.js';
import { initCommand } from './commands/init.js';
import {
  queryCommand,
  formatAsHumanReadable,
  formatAsLineageJSON,
} from './core/query/query.js';
import { auditCommand, auditDocsCommand } from './commands/audit.js';
import { addPatternsCommands } from './commands/patterns.js';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();

program
  .name('cognition-cli')
  .description('A meta-interpreter for verifiable, stateful AI cognition')
  .version('1.7.2 (Cognition CLI)');

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
  .command('audit:docs')
  .description('Audit document integrity in PGC (index/docs validation)')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project being audited',
    process.cwd()
  )
  .action(auditDocsCommand);

program
  .command('genesis:docs [path]')
  .description(
    'Ingest markdown documentation into PGC with full provenance (defaults to VISION.md)'
  )
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .action((pathArg, options) => {
    const defaultPath = path.join(options.projectRoot, '../../VISION.md');
    const targetPath = pathArg || defaultPath;
    genesisDocsCommand(targetPath, options);
  });

import { overlayCommand } from './commands/overlay.js';
import { blastRadiusCommand } from './commands/blast-radius.js';
import { createWatchCommand } from './commands/watch.js';
import { createStatusCommand } from './commands/status.js';
import { createUpdateCommand } from './commands/update.js';
import { createGuideCommand } from './commands/guide.js';
import { genesisDocsCommand } from './commands/genesis-docs.js';
import { addCoherenceCommands } from './commands/coherence.js';
import { addConceptsCommands } from './commands/concepts.js';
import { wizardCommand } from './commands/wizard.js';
import { latticeCommand, showOverlaysCommand } from './commands/lattice.js';
// Sugar commands (convenience wrappers around lattice algebra)
import {
  securityAttacksCommand,
  securityCoverageGapsCommand,
  securityBoundariesCommand,
} from './commands/sugar/security.js';
import {
  workflowPatternsCommand,
  workflowQuestsCommand,
  workflowDepthRulesCommand,
} from './commands/sugar/workflow.js';
import {
  proofsTheoremsCommand,
  proofsLemmasCommand,
  proofsListCommand,
  proofsAlignedCommand,
} from './commands/sugar/proofs.js';

program
  .command('wizard')
  .description('🧙 Interactive wizard to set up a complete PGC from scratch')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .action(wizardCommand);

program.addCommand(overlayCommand);
program.addCommand(blastRadiusCommand);
program.addCommand(createWatchCommand());
program.addCommand(createStatusCommand());
program.addCommand(createUpdateCommand());
program.addCommand(createGuideCommand());
addPatternsCommands(program);
addCoherenceCommands(program);
addConceptsCommands(program);

// Lattice algebra commands
program
  .command('lattice <query>')
  .description(
    'Execute boolean algebra operations across overlays (e.g., "O1 - O2", "O2[critical] ~ O4")'
  )
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '-f, --format <format>',
    'Output format: table, json, summary',
    'table'
  )
  .option('-l, --limit <number>', 'Maximum number of results to show', '50')
  .option('-v, --verbose', 'Show detailed error messages', false)
  .action(latticeCommand);

program
  .command('overlays')
  .description('Show available overlays and their data status')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .action(showOverlaysCommand);

// ========================================
// SUGAR COMMANDS (Convenience Wrappers)
// ========================================

// Security commands
const securityCmd = program
  .command('security')
  .description('Security analysis commands (wraps lattice algebra)');

securityCmd
  .command('attacks')
  .description('Show attack vectors that conflict with mission principles')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '-f, --format <format>',
    'Output format: table, json, summary',
    'table'
  )
  .option('-l, --limit <number>', 'Maximum number of results to show', '50')
  .option('-v, --verbose', 'Show detailed error messages', false)
  .action(securityAttacksCommand);

securityCmd
  .command('coverage-gaps')
  .description('Show code symbols without security coverage')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '-f, --format <format>',
    'Output format: table, json, summary',
    'table'
  )
  .option('-l, --limit <number>', 'Maximum number of results to show', '50')
  .option('-v, --verbose', 'Show detailed error messages', false)
  .action(securityCoverageGapsCommand);

securityCmd
  .command('boundaries')
  .description('Show security boundaries and constraints')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '-f, --format <format>',
    'Output format: table, json, summary',
    'table'
  )
  .option('-l, --limit <number>', 'Maximum number of results to show', '50')
  .option('-v, --verbose', 'Show detailed error messages', false)
  .action(securityBoundariesCommand);

// Workflow commands
const workflowCmd = program
  .command('workflow')
  .description('Operational workflow analysis commands');

workflowCmd
  .command('patterns')
  .description('Show workflow patterns')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '-f, --format <format>',
    'Output format: table, json, summary',
    'table'
  )
  .option('-l, --limit <number>', 'Maximum number of results to show', '50')
  .option('-v, --verbose', 'Show detailed error messages', false)
  .option('--secure', 'Show workflows aligned with security boundaries', false)
  .option('--aligned', 'Show workflows aligned with mission', false)
  .action(workflowPatternsCommand);

workflowCmd
  .command('quests')
  .description('Show quest structures')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '-f, --format <format>',
    'Output format: table, json, summary',
    'table'
  )
  .option('-l, --limit <number>', 'Maximum number of results to show', '50')
  .option('-v, --verbose', 'Show detailed error messages', false)
  .action(workflowQuestsCommand);

workflowCmd
  .command('depth-rules')
  .description('Show depth rules')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '-f, --format <format>',
    'Output format: table, json, summary',
    'table'
  )
  .option('-l, --limit <number>', 'Maximum number of results to show', '50')
  .option('-v, --verbose', 'Show detailed error messages', false)
  .action(workflowDepthRulesCommand);

// Proofs commands
const proofsCmd = program
  .command('proofs')
  .description('Mathematical proofs and theorems analysis');

proofsCmd
  .command('theorems')
  .description('Show all theorems')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '-f, --format <format>',
    'Output format: table, json, summary',
    'table'
  )
  .option('-l, --limit <number>', 'Maximum number of results to show', '50')
  .option('-v, --verbose', 'Show detailed error messages', false)
  .action(proofsTheoremsCommand);

proofsCmd
  .command('lemmas')
  .description('Show all lemmas')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '-f, --format <format>',
    'Output format: table, json, summary',
    'table'
  )
  .option('-l, --limit <number>', 'Maximum number of results to show', '50')
  .option('-v, --verbose', 'Show detailed error messages', false)
  .action(proofsLemmasCommand);

proofsCmd
  .command('list')
  .description('Show all mathematical statements')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '-f, --format <format>',
    'Output format: table, json, summary',
    'table'
  )
  .option('-l, --limit <number>', 'Maximum number of results to show', '50')
  .option('-v, --verbose', 'Show detailed error messages', false)
  .option(
    '--type <type>',
    'Filter by type: theorem, lemma, axiom, proof, identity'
  )
  .action(proofsListCommand);

proofsCmd
  .command('aligned')
  .description('Show proofs aligned with mission principles')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '-f, --format <format>',
    'Output format: table, json, summary',
    'table'
  )
  .option('-l, --limit <number>', 'Maximum number of results to show', '50')
  .option('-v, --verbose', 'Show detailed error messages', false)
  .action(proofsAlignedCommand);

program.parse();
