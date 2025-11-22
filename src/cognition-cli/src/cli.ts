#!/usr/bin/env node

/**
 * Cognition CLI - Main Entry Point
 *
 * A meta-interpreter for verifiable, stateful AI cognition built on the
 * Grounded Context Pool (PGC) architecture. Provides commands for:
 * - Initializing and building PGC workspaces
 * - Ingesting code and documentation with full provenance
 * - Querying across semantic overlays using lattice algebra
 * - Real-time file watching and incremental updates
 * - Interactive TUI with Claude integration
 * - Security validation and coherence analysis
 *
 * DESIGN:
 * The CLI uses Commander.js for command registration and routing.
 * Commands are organized into categories:
 * 1. Core: init, genesis, query, watch, update
 * 2. Overlays: overlay, patterns, concepts, coherence
 * 3. Algebra: lattice (boolean operations across overlays)
 * 4. Sugar: security, workflow, proofs (convenience wrappers)
 * 5. Interactive: tui, ask (LLM-powered interfaces)
 * 6. Audit: audit:transformations, audit:docs (transparency)
 *
 * ARCHITECTURE:
 * - All commands operate on a PGC workspace (.open_cognition directory)
 * - Commands follow a functional style: parse options → execute → format output
 * - Security is bootstrapped on startup (one-time mandate acknowledgment)
 * - Workbench URL can be overridden via --workbench flag or WORKBENCH_URL env var
 *
 * @example
 * // Initialize new PGC workspace
 * $ cognition-cli init
 *
 * // Build structural overlay from code
 * $ cognition-cli genesis src/
 *
 * // Ingest documentation into mission overlay
 * $ cognition-cli genesis:docs VISION.md
 *
 * // Query using lattice algebra
 * $ cognition-cli lattice "O2[attack_vector] ~ O4"
 *
 * // Launch interactive TUI
 * $ cognition-cli tui
 *
 * @example
 * // Security analysis workflow
 * $ cognition-cli genesis src/           # O₁: Structural
 * $ cognition-cli genesis:docs VISION.md # O₄: Mission
 * $ cognition-cli security attacks        # Find policy violations
 * $ cognition-cli security coverage-gaps  # Find uncovered symbols
 *
 * @example
 * // Watch mode for incremental updates
 * $ cognition-cli watch
 * # Edit files... changes detected and PGC updated automatically
 * $ cognition-cli status  # Check dirty state
 * $ cognition-cli update  # Apply pending changes
 */

import { Command } from 'commander';
import path from 'path';
// Lazy loading optimization: Commands imported dynamically on-demand
// import { genesisCommand } from './commands/genesis.js';
// import { initCommand } from './commands/init.js';
// import { queryCommand, formatAsHumanReadable, formatAsLineageJSON } from './core/query/query.js';
// import { auditCommand, auditDocsCommand } from './commands/audit.js';
// import { addPatternsCommands } from './commands/patterns.js';
import { bootstrapSecurity } from './core/security/security-bootstrap.js';
import { loadLLMConfig } from './llm/llm-config.js';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();

// Global accessibility and output options
program
  .name('cognition-cli')
  .description('A meta-interpreter for verifiable, stateful AI cognition')
  .version('2.4.1 (Production Excellence)')
  .option(
    '--no-color',
    'Disable colored output (also respects NO_COLOR env var)'
  )
  .option(
    '--no-emoji',
    'Disable emoji in output (for terminals without Unicode support)'
  )
  .option('--format <type>', 'Output format: auto, table, json, plain', 'auto')
  .option('-v, --verbose', 'Verbose output (show detailed information)', false)
  .option('-q, --quiet', 'Quiet mode (errors only)', false)
  .hook('preAction', (thisCommand) => {
    // Store global options in environment for access by formatters
    const opts = thisCommand.optsWithGlobals();
    process.env.COGNITION_NO_COLOR = opts.color === false ? '1' : '0';
    process.env.COGNITION_NO_EMOJI = opts.emoji === false ? '1' : '0';
    process.env.COGNITION_FORMAT = opts.format || 'auto';
    process.env.COGNITION_VERBOSE = opts.verbose ? '1' : '0';
    process.env.COGNITION_QUIET = opts.quiet ? '1' : '0';
  });

program
  .command('init')
  .alias('i')
  .description('Initialize a new Grounded Context Pool (PGC) (alias: i)')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (options) => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand(options);
  });

program
  .command('genesis [sourcePath]')
  .alias('g')
  .description('Builds the verifiable skeleton of a codebase (alias: g)')
  .option(
    '-w, --workbench <url>',
    'URL of the egemma workbench (defaults to WORKBENCH_URL env var or http://localhost:8000)'
  )
  .option(
    '-p, --project-root <path>',
    'Root directory of the project being analyzed',
    process.cwd()
  )
  .action(async (sourcePath, options) => {
    const { genesisCommand } = await import('./commands/genesis.js');
    await genesisCommand({
      ...options,
      source: sourcePath || options.source || 'src',
    });
  });

/**
 * Options for the query command
 *
 * Controls query behavior and output formatting
 */
interface QueryCommandOptions {
  /** Root directory of the project being queried */
  projectRoot: string;
  /** Depth of dependency traversal (string to support CLI parsing) */
  depth: string;
  /** Output dependency lineage in JSON format instead of human-readable */
  lineage: boolean;
  /** Test property to trigger Monument 4.7 overlay invalidation */
  testOverlayInvalidation?: boolean;
}

/**
 * Execute query command and format output (with lazy loading)
 *
 * Queries the PGC for information and formats the response based on
 * the --lineage flag. By default, outputs human-readable text.
 * With --lineage, outputs structured JSON with dependency chains.
 *
 * @param question - Natural language query to execute
 * @param options - Query options including output format
 *
 * @example
 * // Human-readable output (default)
 * await queryAction("What does handleAuth do?", {
 *   projectRoot: '/path/to/project',
 *   depth: '0',
 *   lineage: false
 * });
 *
 * @example
 * // JSON lineage output
 * await queryAction("What does handleAuth do?", {
 *   projectRoot: '/path/to/project',
 *   depth: '2',
 *   lineage: true
 * });
 */
async function queryAction(question: string, options: QueryCommandOptions) {
  const { queryCommand, formatAsHumanReadable, formatAsLineageJSON } =
    await import('./core/query/query.js');

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
  .alias('q')
  .description('Query the codebase for information (alias: q)')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project being queried',
    process.cwd()
  )
  .option('-d, --depth <level>', 'Depth of dependency traversal', '0')
  .option('--lineage', 'Output the dependency lineage in JSON format')
  .option('--json', 'Output results as JSON for scripting')
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
  .action(async (filePath, options) => {
    const { auditCommand } = await import('./commands/audit.js');
    await auditCommand(filePath, options);
  });

program
  .command('audit:docs')
  .description('Audit document integrity in PGC (index/docs validation)')
  .option(
    '-p, --project-root <path>',
    'Root directory of the project being audited',
    process.cwd()
  )
  .action(async (options) => {
    const { auditDocsCommand } = await import('./commands/audit.js');
    await auditDocsCommand(options);
  });

program
  .command('genesis:docs [paths...]')
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
  .action(async (pathsArg, options) => {
    const { genesisDocsCommand } = await import('./commands/genesis-docs.js');
    const defaultPath = path.join(options.projectRoot, '../../VISION.md');
    const targetPaths =
      pathsArg && pathsArg.length > 0 ? pathsArg : [defaultPath];
    await genesisDocsCommand(targetPaths, options);
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
  .action(async (options) => {
    const { migrateToLanceCommand } = await import(
      './commands/migrate-to-lance.js'
    );
    await migrateToLanceCommand(options);
  });

// Lazy loading optimization: Commands imported dynamically on-demand
// import { overlayCommand } from './commands/overlay.js';
// import { blastRadiusCommand } from './commands/blast-radius.js';
// import { createWatchCommand } from './commands/watch.js';
// import { createStatusCommand } from './commands/status.js';
// import { createUpdateCommand } from './commands/update.js';
// import { createGuideCommand } from './commands/guide.js';
// import { genesisDocsCommand } from './commands/genesis-docs.js';
// import { migrateToLanceCommand } from './commands/migrate-to-lance.js';
// import { addCoherenceCommands } from './commands/coherence.js';
// import { addConceptsCommands } from './commands/concepts.js';
// import { wizardCommand } from './commands/wizard.js';
// import { latticeCommand } from './commands/lattice.js';
// import { showMandate } from './commands/security/mandate.js';
// import { askCommand } from './commands/ask.js';
// import { tuiCommand } from './commands/tui.js';
// Lazy loading optimization: Sugar commands imported dynamically on-demand
// import { securityAttacksCommand, securityCoverageGapsCommand, securityBoundariesCommand, securityListCommand, securityCVEsCommand, securityQueryCommand } from './commands/sugar/security.js';
// import { securityCoherenceCommand } from './commands/sugar/security-coherence.js';
// import { workflowPatternsCommand, workflowQuestsCommand, workflowDepthRulesCommand } from './commands/sugar/workflow.js';
// import { proofsTheoremsCommand, proofsLemmasCommand, proofsListCommand, proofsAlignedCommand } from './commands/sugar/proofs.js';

program
  .command('wizard')
  .alias('w')
  .description(
    '🧙 Interactive wizard to set up a complete PGC from scratch (alias: w)'
  )
  .option(
    '-p, --project-root <path>',
    'Root directory of the project',
    process.cwd()
  )
  .action(async (options) => {
    const { wizardCommand } = await import('./commands/wizard.js');
    await wizardCommand(options);
  });

// Create TUI command with provider subcommand
const tuiCmd = program
  .command('tui')
  .description('🖥️  Launch interactive TUI with LLM integration')
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
  .option(
    '--provider <name>',
    `LLM provider to use (default: ${loadLLMConfig().defaultProvider})`,
    loadLLMConfig().defaultProvider
  )
  .option('--model <name>', 'Model to use (provider-specific)')
  .option('--debug', 'Enable debug logging for Sigma compression')
  .option('--no-show-thinking', 'Hide thinking blocks in TUI')
  .action(async (options) => {
    const { tuiCommand } = await import('./commands/tui.js');
    await tuiCommand({
      projectRoot: options.projectRoot,
      sessionId: options.sessionId,
      sessionFile: options.file,
      workbenchUrl: options.workbench,
      sessionTokens: parseInt(options.sessionTokens),
      maxThinkingTokens: options.maxThinkingTokens
        ? parseInt(options.maxThinkingTokens)
        : undefined,
      debug: options.debug,
      provider: options.provider,
      model: options.model,
      displayThinking: options.showThinking !== false,
    });
  });

// Add provider subcommand to tui
const { createProviderCommand } = await import('./commands/provider.js');
tuiCmd.addCommand(createProviderCommand());

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
  .action(async (question, options) => {
    const { askCommand } = await import('./commands/ask.js');
    await askCommand(question, {
      ...options,
      topK: parseInt(options.topK),
    });
  });

// NOTE: Complex command groups (overlay, patterns, etc.) loaded eagerly for now
// TODO: Refactor to lazy-load these commands in a future optimization pass
const { overlayCommand } = await import('./commands/overlay.js');
const { blastRadiusCommand } = await import('./commands/blast-radius.js');
const { createWatchCommand } = await import('./commands/watch.js');
const { createStatusCommand } = await import('./commands/status.js');
const { createUpdateCommand } = await import('./commands/update.js');
const { createGuideCommand } = await import('./commands/guide.js');
const { createCompletionCommand } = await import('./commands/completion.js');
const { addPatternsCommands } = await import('./commands/patterns.js');
const { addCoherenceCommands } = await import('./commands/coherence.js');
const { addConceptsCommands } = await import('./commands/concepts.js');

program.addCommand(overlayCommand);
program.addCommand(blastRadiusCommand);
program.addCommand(createWatchCommand());
program.addCommand(createStatusCommand());
program.addCommand(createUpdateCommand());
program.addCommand(createGuideCommand());
program.addCommand(createCompletionCommand());
addPatternsCommands(program);
addCoherenceCommands(program);
addConceptsCommands(program);

// PR Impact Analysis (cross-overlay superb workflow)
program
  .command('pr-analyze')
  .description(
    '📊 Comprehensive PR impact analysis across all overlays (O1+O2+O3+O4+O7)'
  )
  .option('--branch <name>', 'Branch to analyze (default: current changes)')
  .option('--max-depth <N>', 'Maximum blast radius depth', '3')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { analyzePRImpact } = await import('./commands/pr-analyze.js');
    const { PGCManager } = await import('./core/pgc/manager.js');
    await analyzePRImpact(options, PGCManager);
  });

// Lattice algebra commands
program
  .command('lattice <query>')
  .alias('l')
  .description(
    'Execute boolean algebra operations across overlays (alias: l)\n' +
      'Examples: "O1 - O2", "O2[critical] ~ O4"'
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
  .option('--json', 'Output results as JSON (shorthand for --format json)')
  .action(async (query, options) => {
    const { latticeCommand } = await import('./commands/lattice.js');
    await latticeCommand(query, options);
  });

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
  .action(async () => {
    const { showMandate } = await import('./commands/security/mandate.js');
    await showMandate();
  });

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
  .action(async (options) => {
    const { securityAttacksCommand } = await import(
      './commands/sugar/security.js'
    );
    await securityAttacksCommand(options);
  });

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
  .action(async (options) => {
    const { securityCoverageGapsCommand } = await import(
      './commands/sugar/security.js'
    );
    await securityCoverageGapsCommand(options);
  });

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
  .action(async (options) => {
    const { securityBoundariesCommand } = await import(
      './commands/sugar/security.js'
    );
    await securityBoundariesCommand(options);
  });

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
    async (options: {
      projectRoot: string;
      type?: string;
      severity?: string;
      format?: string;
      limit?: string;
      verbose?: boolean;
    }) => {
      const { securityListCommand } = await import(
        './commands/sugar/security.js'
      );
      await securityListCommand({
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
  .action(async (options) => {
    const { securityCVEsCommand } = await import(
      './commands/sugar/security.js'
    );
    await securityCVEsCommand(options);
  });

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
  .action(async (searchTerm, options) => {
    const { securityQueryCommand } = await import(
      './commands/sugar/security.js'
    );
    await securityQueryCommand(searchTerm, options);
  });

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
  .action(async (options) => {
    const { securityCoherenceCommand } = await import(
      './commands/sugar/security-coherence.js'
    );
    await securityCoherenceCommand(options);
  });

securityCmd
  .command('blast-radius <target>')
  .description(
    'Show cascading security impact when a file/symbol is compromised (O2 × O3)'
  )
  .option('--max-depth <N>', 'Maximum traversal depth', '3')
  .option('--json', 'Output as JSON')
  .action(async (target, options) => {
    const PGCManager = (await import('./core/pgc/manager.js')).PGCManager;
    const GraphTraversal = (await import('./core/graph/traversal.js'))
      .GraphTraversal;
    const SecurityGuidelinesManager = (
      await import('./core/overlays/security-guidelines/manager.js')
    ).SecurityGuidelinesManager;
    const StructuralPatternsManager = (
      await import('./core/overlays/structural-patterns/manager.js')
    ).StructuralPatternsManager;

    // Import the command implementation
    const { analyzeSecurityBlastRadius } = await import(
      './commands/security-blast-radius.js'
    );

    await analyzeSecurityBlastRadius(
      target,
      options,
      PGCManager,
      GraphTraversal,
      SecurityGuidelinesManager,
      StructuralPatternsManager
    );
  });

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
  .action(async (options) => {
    const { workflowPatternsCommand } = await import(
      './commands/sugar/workflow.js'
    );
    await workflowPatternsCommand(options);
  });

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
  .action(async (options) => {
    const { workflowQuestsCommand } = await import(
      './commands/sugar/workflow.js'
    );
    await workflowQuestsCommand(options);
  });

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
  .action(async (options) => {
    const { workflowDepthRulesCommand } = await import(
      './commands/sugar/workflow.js'
    );
    await workflowDepthRulesCommand(options);
  });

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
  .action(async (options) => {
    const { proofsTheoremsCommand } = await import(
      './commands/sugar/proofs.js'
    );
    await proofsTheoremsCommand(options);
  });

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
  .action(async (options) => {
    const { proofsLemmasCommand } = await import('./commands/sugar/proofs.js');
    await proofsLemmasCommand(options);
  });

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
  .action(async (options) => {
    const { proofsListCommand } = await import('./commands/sugar/proofs.js');
    await proofsListCommand(options);
  });

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
  .action(async (options) => {
    const { proofsAlignedCommand } = await import('./commands/sugar/proofs.js');
    await proofsAlignedCommand(options);
  });

// Bootstrap security layer (one-time acknowledgment)
await bootstrapSecurity();

// Global error handler for uncaught exceptions
import { CognitionError } from './utils/errors.js';
import { formatError, formatGenericError } from './utils/error-formatter.js';

process.on('uncaughtException', (error) => {
  const verbose = process.env.COGNITION_VERBOSE === '1';

  if (error instanceof CognitionError) {
    console.error(formatError(error, verbose));
    process.exit(1);
  }

  // Unknown error - show stack and ask for bug report
  console.error(formatGenericError(error, verbose));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const verbose = process.env.COGNITION_VERBOSE === '1';

  if (reason instanceof CognitionError) {
    console.error(formatError(reason, verbose));
    process.exit(1);
  }

  // Unknown rejection
  console.error(formatGenericError(reason, verbose));
  process.exit(1);
});

program.parse();
