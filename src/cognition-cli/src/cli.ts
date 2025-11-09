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
import { bootstrapSecurity } from './core/security/security-bootstrap.js';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();

program
  .name('cognition-cli')
  .description('A meta-interpreter for verifiable, stateful AI cognition')
  .version('2.1.0 (Cognition CLI - Sigma Release)');

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
    'URL of the egemma workbench (defaults to WORKBENCH_URL env var or http://localhost:8000)'
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
  .option(
    '-f, --force',
    'Force re-ingestion by removing existing entries first'
  )
  .action((pathArg, options) => {
    const defaultPath = path.join(options.projectRoot, '../../VISION.md');
    const targetPath = pathArg || defaultPath;
    genesisDocsCommand(targetPath, options);
  });

program
  .command('migrate:lance')
  .description('Migrate YAML overlay embeddings to LanceDB for fast queries')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '--overlays <overlays>',
    'Comma-separated list of overlays to migrate (default: all)',
    (value) => value.split(',')
  )
  .option('--dry-run', 'Preview migration without making changes')
  .option(
    '--keep-embeddings',
    'Keep embeddings in YAML files (default: strip for disk savings)'
  )
  .action((options) => {
    migrateToLanceCommand(options);
  });

import { overlayCommand } from './commands/overlay.js';
import { blastRadiusCommand } from './commands/blast-radius.js';
import { createWatchCommand } from './commands/watch.js';
import { createStatusCommand } from './commands/status.js';
import { createUpdateCommand } from './commands/update.js';
import { createGuideCommand } from './commands/guide.js';
import { genesisDocsCommand } from './commands/genesis-docs.js';
import { migrateToLanceCommand } from './commands/migrate-to-lance.js';
import { addCoherenceCommands } from './commands/coherence.js';
import { addConceptsCommands } from './commands/concepts.js';
import { wizardCommand } from './commands/wizard.js';
import { latticeCommand } from './commands/lattice.js';
import { showMandate } from './commands/security/mandate.js';
import { askCommand } from './commands/ask.js';
import { tuiCommand } from './commands/tui.js';
// Sugar commands (convenience wrappers around lattice algebra)
import {
  securityAttacksCommand,
  securityCoverageGapsCommand,
  securityBoundariesCommand,
  securityListCommand,
  securityCVEsCommand,
  securityQueryCommand,
} from './commands/sugar/security.js';
import { securityCoherenceCommand } from './commands/sugar/security-coherence.js';
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

program
  .command('tui')
  .description('🖥️  Launch interactive TUI with Claude integration')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option('--session-id <anchor-id>', 'Anchor ID to resume session')
  .option(
    '-f, --file <path>',
    'Path to session state file (e.g., .sigma/tui-1762546919034.state.json)'
  )
  .option(
    '-w, --workbench <url>',
    'URL of the egemma workbench (defaults to WORKBENCH_URL env var or http://localhost:8000)'
  )
  .option(
    '--session-tokens <number>',
    'Token threshold for context compression',
    '120000'
  )
  .option(
    '--max-thinking-tokens <number>',
    'Maximum tokens for extended thinking mode (default: 10000)'
  )
  .option('--debug', 'Enable debug logging for Sigma compression')
  .action((options) => {
    tuiCommand({
      projectRoot: options.projectRoot,
      sessionId: options.sessionId,
      sessionFile: options.file,
      workbenchUrl: options.workbench,
      sessionTokens: parseInt(options.sessionTokens),
      maxThinkingTokens: options.maxThinkingTokens
        ? parseInt(options.maxThinkingTokens)
        : undefined,
      debug: options.debug,
    });
  });

program
  .command('ask <question>')
  .description(
    '🤔 Ask questions about the manual and get AI-synthesized answers'
  )
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '-w, --workbench <url>',
    'URL of the egemma workbench (defaults to WORKBENCH_URL env var or http://localhost:8000)'
  )
  .option('--top-k <number>', 'Number of similar concepts to retrieve', '5')
  .option('--save', 'Save Q&A as markdown document', false)
  .option('--verbose', 'Show detailed processing steps', false)
  .action((question, options) => {
    askCommand(question, {
      ...options,
      topK: parseInt(options.topK),
    });
  });

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

// ========================================
// SUGAR COMMANDS (Convenience Wrappers)
// ========================================

// Security commands
const securityCmd = program
  .command('security')
  .description('Security analysis commands (wraps lattice algebra)');

securityCmd
  .command('mandate')
  .description('📜 Display the Dual-Use Technology Mandate')
  .action(showMandate);

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

// Direct O₂ overlay queries
securityCmd
  .command('list')
  .description('List all security knowledge in O₂ overlay')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option(
    '--type <type>',
    'Filter by type (threat_model|attack_vector|mitigation|boundary|vulnerability)'
  )
  .option('--severity <level>', 'Filter by severity (critical|high|medium|low)')
  .option(
    '-f, --format <format>',
    'Output format: table, json, summary',
    'table'
  )
  .option('-l, --limit <number>', 'Maximum number of results to show', '50')
  .option('-v, --verbose', 'Show detailed error messages', false)
  .action(
    (options: {
      projectRoot: string;
      type?: string;
      severity?: string;
      format?: string;
      limit?: string;
      verbose?: boolean;
    }) => {
      securityListCommand({
        projectRoot: options.projectRoot,
        type: options.type,
        severity: options.severity as
          | 'critical'
          | 'high'
          | 'medium'
          | 'low'
          | undefined,
        format: options.format as 'table' | 'json' | 'summary' | undefined,
        limit: options.limit ? parseInt(options.limit) : undefined,
        verbose: options.verbose,
      });
    }
  );

securityCmd
  .command('cves')
  .description('List CVEs tracked in O₂ overlay')
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
  .action(securityCVEsCommand);

securityCmd
  .command('query <searchTerm>')
  .description('Search security knowledge by text')
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
  .option('-l, --limit <number>', 'Maximum number of results to show', '10')
  .option('-v, --verbose', 'Show detailed error messages', false)
  .action(securityQueryCommand);

securityCmd
  .command('coherence')
  .description('Show security implementation alignment with mission')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .option('-f, --format <format>', 'Output format: table, json', 'table')
  .option('-v, --verbose', 'Show detailed security class breakdown', false)
  .action(securityCoherenceCommand);

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

// Bootstrap security layer (one-time acknowledgment)
await bootstrapSecurity();

program.parse();
