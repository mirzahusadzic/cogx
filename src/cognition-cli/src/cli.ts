#!/usr/bin/env node

// ============================================================================
// SDK Silencing - MUST be first before any imports
// The @openai/agents SDK uses console.error/warn and the debug package
// which corrupts Ink-based TUI layout. Set all silencing env vars here.
// ============================================================================
process.env.OPENAI_AGENTS_DISABLE_TRACING = '1';
process.env.OPENAI_AGENTS_DONT_LOG_MODEL_DATA = '1';
process.env.OPENAI_AGENTS_DONT_LOG_TOOL_DATA = '1';

// Suppress gRPC and Google SDK logging which can leak to stdout/stderr and mess up the TUI.
// This is especially common when using Vertex AI auth (ALTS warnings, etc.)
process.env.GRPC_VERBOSITY = 'NONE';
process.env.GRPC_TRACE = 'none';
process.env.GOOGLE_SDK_LOG_LEVEL = 'error';
process.env.ALTS_LOG_LEVEL = 'none';
process.env.NODE_NO_WARNINGS = '1';
process.env.SUPPRESS_GCP_NOT_FOUND_ERROR = 'true';

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
 * // Initialize new PGC workspace (auto-detects sources)
 * $ cognition-cli init
 *
 * // Build structural overlay from code (uses detected paths from init)
 * $ cognition-cli genesis
 *
 * // Ingest documentation (uses detected docs from init)
 * $ cognition-cli genesis:docs
 *
 * // Query using lattice algebra
 * $ cognition-cli lattice "O2[attack_vector] ~ O4"
 *
 * // Launch interactive TUI
 * $ cognition-cli tui
 *
 * @example
 * // Security analysis workflow
 * $ cognition-cli init                    # Auto-detect sources
 * $ cognition-cli genesis                 # O₁: Structural (from metadata)
 * $ cognition-cli genesis:docs            # O₄: Mission (from metadata)
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
import { closest } from 'fastest-levenshtein';
// Lazy loading optimization: Commands imported dynamically on-demand
// import { genesisCommand } from './commands/genesis.js';
// import { initCommand } from './commands/init.js';
// import { queryCommand, formatAsHumanReadable, formatAsLineageJSON } from './core/query/query.js';
// import { auditCommand, auditDocsCommand } from './commands/audit.js';
// import { addPatternsCommands } from './commands/patterns.js';
import { bootstrapSecurity } from './core/security/security-bootstrap.js';
import {
  addExamples,
  addEnvVars,
  addLearnMore,
  combineHelpSections,
  addAllEnvVars,
  addGlobalExamples,
  formatGroupedCommands,
  COMMAND_GROUPS,
} from './utils/help-formatter.js';
import {
  initDebugLog,
  debugLog,
  finalizeDebugLog,
  getDebugLogPath,
} from './utils/debug-logger.js';
import { getVerboseState } from './utils/verbose.js';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();

// Enable command suggestions for typos
program.showSuggestionAfterError(true);

// Configure help to use grouped commands like git
program.configureHelp({
  // Hide the default flat command list - we show grouped commands instead
  visibleCommands: () => [],
});

// Git-style usage synopsis showing all global options
const USAGE_SYNOPSIS = `[-v | --version] [-h | --help]
       [--no-color] [--no-emoji] [--format <type>] [--json]
       [-v | --verbose] [-q | --quiet] [--no-input] [-d | --debug]
       <command> [<args>]`;

// Global accessibility and output options
program
  .name('cognition-cli')
  .usage(USAGE_SYNOPSIS)
  .description('A meta-interpreter for verifiable, stateful AI cognition')
  .version('2.6.9')
  .addHelpText('after', formatGroupedCommands(COMMAND_GROUPS))
  .addHelpText('after', addAllEnvVars())
  .addHelpText('after', addGlobalExamples())
  .option(
    '--no-color',
    'Disable colored output (also respects NO_COLOR env var)'
  )
  .option(
    '--no-emoji',
    'Disable emoji in output (for terminals without Unicode support)'
  )
  .option('--format <type>', 'Output format: auto, table, json, plain', 'auto')
  .option('--json', 'Shorthand for --format json')
  .option('-v, --verbose', 'Verbose output (show detailed information)', false)
  .option('-q, --quiet', 'Quiet mode (errors only)', false)
  .option('--no-input', 'Disable all interactive prompts (for CI/CD pipelines)')
  .option(
    '-d, --debug',
    'Enable debug logging to file (writes to .open_cognition/debug-*.log)'
  )
  .hook('preAction', (thisCommand) => {
    // Store global options in environment for access by formatters
    const opts = thisCommand.optsWithGlobals();
    process.env.COGNITION_NO_COLOR = opts.color === false ? '1' : '0';
    process.env.COGNITION_NO_EMOJI = opts.emoji === false ? '1' : '0';
    // --json flag overrides --format
    process.env.COGNITION_FORMAT =
      opts.json || process.env.COGNITION_FORMAT === 'json'
        ? 'json'
        : opts.format || 'auto';
    process.env.COGNITION_VERBOSE = opts.verbose ? '1' : '0';
    process.env.COGNITION_QUIET = opts.quiet ? '1' : '0';
    process.env.COGNITION_NO_INPUT = opts.input === false ? '1' : '0';
    process.env.COGNITION_DEBUG = opts.debug ? '1' : '0';

    // Initialize debug logging if --debug flag is set
    if (opts.debug) {
      const projectRoot = opts.projectRoot || process.cwd();
      initDebugLog(projectRoot);
      debugLog('Command started', {
        command: thisCommand.name(),
        args: thisCommand.args,
        options: opts,
      });
    }
  });

program
  .command('init')
  .alias('i')
  .description(
    'Initialize PGC with auto-detection of source directories (alias: i)'
  )
  .option('-p, --project-root <path>', 'Project path', process.cwd())
  .option(
    '-n, --dry-run',
    'Preview what would be created without making changes'
  )
  .option('-f, --force', 'Skip confirmation prompts (for scripts)')
  .addHelpText(
    'after',
    combineHelpSections(
      addExamples([
        {
          cmd: 'cognition init',
          desc: 'Auto-detect sources and initialize',
        },
        {
          cmd: 'cognition init --dry-run',
          desc: 'Preview detected paths without creating files',
        },
        {
          cmd: 'cognition init --force',
          desc: 'Non-interactive mode (CI/CD)',
        },
      ]),
      addLearnMore([
        'https://mirzahusadzic.github.io/cogx/manual/part-1-foundation/02-the-pgc.html#initialization-and-lifecycle',
      ])
    )
  )
  .action(async (options) => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand({
      path: options.projectRoot,
      dryRun: options.dryRun,
      force: options.force,
    });
  });

program
  .command('genesis [sourcePaths...]')
  .alias('g')
  .description(
    'Build code knowledge graph (reads paths from metadata.json if omitted) (alias: g)'
  )
  .option(
    '-w, --workbench <url>',
    'URL of the egemma workbench (defaults to WORKBENCH_URL env var or http://localhost:8000)'
  )
  .option(
    '-p, --project-root <path>',
    'Root directory of the project being analyzed',
    process.cwd()
  )
  .option('-n, --dry-run', 'Preview files without processing')
  .option(
    '-r, --resume',
    'Resume from interrupted genesis (skips already-processed files)'
  )
  .option('--json', 'Output progress as JSON lines (for TUI/programmatic use)')
  .addHelpText(
    'after',
    combineHelpSections(
      addExamples([
        {
          cmd: 'cognition genesis',
          desc: 'Use paths from init (metadata.json)',
        },
        { cmd: 'cognition genesis src/', desc: 'Analyze specific directory' },
        {
          cmd: 'cognition g src/ lib/',
          desc: 'Multiple directories (space-separated)',
        },
        {
          cmd: 'cognition genesis --dry-run',
          desc: 'Preview files that would be analyzed',
        },
        {
          cmd: 'cognition genesis --resume',
          desc: 'Resume interrupted genesis',
        },
      ]),
      addEnvVars([
        {
          name: 'WORKBENCH_URL',
          desc: 'Default workbench URL (http://localhost:8000)',
        },
      ]),
      addLearnMore([
        'https://mirzahusadzic.github.io/cogx/manual/part-1-foundation/05-cli-operations.html',
      ])
    )
  )
  .action(async (sourcePaths: string[], options) => {
    const { genesisCommand } = await import('./commands/genesis.js');
    const fs = await import('fs-extra');
    const pathModule = await import('path');

    // Determine effective source paths
    let effectivePaths: string[] = sourcePaths;

    // Try to read source paths from metadata if not provided
    if (!effectivePaths || effectivePaths.length === 0) {
      const metadataPath = pathModule.default.join(
        options.projectRoot,
        '.open_cognition',
        'metadata.json'
      );
      try {
        const metadata = await fs.default.readJSON(metadataPath);
        if (metadata.sources?.code?.length > 0) {
          effectivePaths = metadata.sources.code;
          console.log(
            `Using source paths from metadata: ${effectivePaths.join(', ')}`
          );
        }
      } catch {
        // Metadata not found or invalid, fall back to default
      }
    }

    // Default to 'src' if no paths found
    if (!effectivePaths || effectivePaths.length === 0) {
      effectivePaths = ['src'];
    }

    // Process all source paths in a single genesis run
    // (prevents GC from removing files from previous paths)
    await genesisCommand({
      ...options,
      sources: effectivePaths,
      verbose: getVerboseState(options),
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
  /** Output results as JSON for scripting */
  json?: boolean;
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
async function queryAction(
  question: string,
  options: QueryCommandOptions,
  command: Command
) {
  const { queryCommand, formatAsHumanReadable, formatAsLineageJSON } =
    await import('./core/query/query.js');

  const allOpts = command.optsWithGlobals();
  const useJson = allOpts.json || options.json;

  const queryResult = await queryCommand(question, options);

  if (useJson || options.lineage) {
    // If specifically asking for lineage, use that format, otherwise standard JSON
    if (options.lineage) {
      console.log(formatAsLineageJSON(queryResult));
    } else {
      console.log(JSON.stringify(queryResult, null, 2));
    }
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
  .addHelpText(
    'after',
    combineHelpSections(
      addExamples([
        {
          cmd: 'cognition query "What does handleAuth do?"',
          desc: 'Ask about a function',
        },
        {
          cmd: 'cognition q "How does the config system work?"',
          desc: 'Short alias for quick queries',
        },
        {
          cmd: 'cognition query --depth 2 "What are the security boundaries?"',
          desc: 'Include 2 levels of dependencies',
        },
        {
          cmd: 'cognition query --lineage "Find all managers"',
          desc: 'Output as JSON with lineage',
        },
      ]),
      addLearnMore([
        'https://mirzahusadzic.github.io/cogx/manual/part-3-algebra/13-query-syntax.html',
      ])
    )
  )
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
    'Ingest documentation (reads paths from metadata.json, falls back to VISION.md)'
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
  .option('--json', 'Output progress as JSON lines (for TUI/programmatic use)')
  .action(async (pathsArg, options) => {
    const { genesisDocsCommand } = await import('./commands/genesis-docs.js');
    const fs = await import('fs-extra');

    let targetPaths: string[] = pathsArg && pathsArg.length > 0 ? pathsArg : [];

    // Try to read doc paths from metadata if not provided
    if (targetPaths.length === 0) {
      const metadataPath = path.join(
        options.projectRoot,
        '.open_cognition',
        'metadata.json'
      );
      try {
        const metadata = await fs.default.readJSON(metadataPath);
        if (metadata.sources?.docs?.length > 0) {
          targetPaths = metadata.sources.docs.map((p: string) =>
            path.join(options.projectRoot, p)
          );
          console.log(
            `Using doc paths from metadata: ${metadata.sources.docs.join(', ')}`
          );
        }
      } catch {
        // Metadata not found or invalid
      }
    }

    // Fall back to default VISION.md
    if (targetPaths.length === 0) {
      targetPaths = [path.join(options.projectRoot, '../../VISION.md')];
    }

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
    const { migrateToLanceCommand } =
      await import('./commands/migrate-to-lance.js');
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
    'Path to session state file (e.g., .sigma/tui-opus45-1762546919034.state.json)'
  )
  .option(
    '-w, --workbench <url>',
    'URL of the egemma workbench (defaults to WORKBENCH_URL env var or http://localhost:8000)'
  )
  .option(
    '--session-tokens <number>',
    'Token threshold for context compression (default: 200000)'
  )
  .option(
    '--max-thinking-tokens <number>',
    'Maximum tokens for extended thinking mode (default: 32000)'
  )
  .option('--provider <name>', 'LLM provider to use (claude, gemini)')
  .option('--model <name>', 'Model to use (provider-specific)')
  .option(
    '--solo',
    'Enable solo mode (disables IPC and PGC tools to save tokens)'
  )
  .option(
    '--ctx-tools <number>',
    'Number of tool logs to keep in context per task before eviction',
    (val) => parseInt(val, 10),
    20
  )
  .option('--no-show-thinking', 'Hide thinking blocks in TUI')
  .option(
    '--no-onboarding',
    'Skip onboarding wizard even if workspace is incomplete'
  )
  .option(
    '--no-auto-response',
    'Disable automatic response to agent messages (require user input)'
  )
  .addHelpText(
    'after',
    combineHelpSections(
      addExamples([
        { cmd: 'cognition-cli tui', desc: 'Launch TUI with default provider' },
        {
          cmd: 'cognition-cli tui --provider claude',
          desc: 'Use Claude as LLM provider',
        },
        {
          cmd: 'cognition-cli tui --provider gemini --model gemini-3-pro-preview',
          desc: 'Use Gemini with a specific model',
        },
        {
          cmd: 'cognition-cli tui --session-id tui-opus45-1764773826220',
          desc: 'Resume a previous session by anchor ID',
        },
        {
          cmd: 'cognition-cli tui -f .sigma/tui-opus45-1764773826220.state.json',
          desc: 'Load session from state file',
        },
      ]),
      addEnvVars([
        { name: 'ANTHROPIC_API_KEY', desc: 'API key for Claude provider' },
        { name: 'GEMINI_API_KEY', desc: 'API key for Gemini provider' },
      ]),
      addLearnMore([
        'https://mirzahusadzic.github.io/cogx/manual/part-1-foundation/05-cli-operations.html#tui-%E2%80%94-interactive-terminal',
      ])
    )
  )
  .action(async (options, command) => {
    const { tuiCommand } = await import('./commands/tui.js');
    await tuiCommand({
      projectRoot: options.projectRoot,
      sessionId: options.sessionId,
      sessionFile: options.file,
      workbenchUrl: options.workbench,
      sessionTokens: options.sessionTokens
        ? parseInt(options.sessionTokens)
        : undefined,
      maxThinkingTokens: options.maxThinkingTokens
        ? parseInt(options.maxThinkingTokens)
        : undefined,
      debug:
        command.optsWithGlobals().debug || process.env.COGNITION_DEBUG === '1',
      provider: options.provider,
      model: options.model,
      solo: options.solo,
      displayThinking: options.showThinking !== false,
      noOnboarding: options.onboarding === false, // --no-onboarding flag
      autoResponse: options.autoResponse !== false, // --no-auto-response flag
      ctxTools: options.ctxTools,
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
  .option('--save', 'Save Q&A as markdown document')
  .option('-v, --verbose', 'Show detailed processing steps')
  .option('--json', 'Output machine-readable JSON (for agent-to-agent queries)')
  .action(async (question, options, command) => {
    const { askCommand } = await import('./commands/ask.js');
    const allOpts = command.optsWithGlobals();
    const result = await askCommand(question, {
      ...options,
      topK: parseInt(options.topK),
      json: allOpts.json || options.json, // Check both global and local
      verbose: getVerboseState(options),
    });

    // If result returned (json mode), output to console
    if (result) {
      console.log(JSON.stringify(result, null, 2));
    }
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
const { createConfigCommand } = await import('./commands/config.js');
program.addCommand(createConfigCommand());
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
  .action(async (options, command) => {
    const { analyzePRImpact } = await import('./commands/pr-analyze.js');
    const { PGCManager } = await import('./core/pgc/manager.js');
    const allOpts = command.optsWithGlobals();
    await analyzePRImpact(
      { ...options, json: allOpts.json || options.json },
      PGCManager
    );
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
  .option('-v, --verbose', 'Show detailed processing steps')
  .option('--json', 'Output results as JSON (shorthand for --format json)')
  .action(async (query, options, command) => {
    const { latticeCommand } = await import('./commands/lattice.js');
    const allOpts = command.optsWithGlobals();
    await latticeCommand(query, {
      ...options,
      json: allOpts.json || options.json,
      verbose: getVerboseState(options),
    });
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
  .option('--json', 'Output results as JSON')
  .action(async (options, command) => {
    const { securityAttacksCommand } =
      await import('./commands/sugar/security.js');
    const allOpts = command.optsWithGlobals();
    await securityAttacksCommand({
      ...options,
      json: allOpts.json || options.json,
      verbose: getVerboseState(options),
    });
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
  .option('--json', 'Output results as JSON')
  .action(async (options, command) => {
    const { securityCoverageGapsCommand } =
      await import('./commands/sugar/security.js');
    const allOpts = command.optsWithGlobals();
    await securityCoverageGapsCommand({
      ...options,
      json: allOpts.json || options.json,
      verbose: getVerboseState(options),
    });
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
  .option('--json', 'Output results as JSON')
  .action(async (options, command) => {
    const { securityBoundariesCommand } =
      await import('./commands/sugar/security.js');
    const allOpts = command.optsWithGlobals();
    await securityBoundariesCommand({
      ...options,
      json: allOpts.json || options.json,
      verbose: getVerboseState(options),
    });
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
  .option('--json', 'Output results as JSON')
  .action(
    async (
      options: {
        projectRoot: string;
        type?: string;
        severity?: string;
        format?: string;
        limit?: string;
        verbose?: boolean;
        json?: boolean;
      },
      command
    ) => {
      const { securityListCommand } =
        await import('./commands/sugar/security.js');
      const allOpts = command.optsWithGlobals();
      await securityListCommand({
        projectRoot: options.projectRoot,
        type: options.type,
        severity: options.severity as
          | 'critical'
          | 'high'
          | 'medium'
          | 'low'
          | undefined,
        format:
          allOpts.json || options.json
            ? 'json'
            : (options.format as 'table' | 'json' | 'summary' | undefined),
        limit: options.limit ? parseInt(options.limit) : undefined,
        verbose: getVerboseState(options),
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
  .option('--json', 'Output results as JSON')
  .action(async (options, command) => {
    const { securityCVEsCommand } =
      await import('./commands/sugar/security.js');
    const allOpts = command.optsWithGlobals();
    await securityCVEsCommand({
      ...options,
      format: allOpts.json || options.json ? 'json' : options.format,
      verbose: getVerboseState(options),
    });
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
  .option('--json', 'Output results as JSON')
  .action(async (searchTerm, options, command) => {
    const { securityQueryCommand } =
      await import('./commands/sugar/security.js');
    const allOpts = command.optsWithGlobals();
    await securityQueryCommand(searchTerm, {
      ...options,
      format: allOpts.json || options.json ? 'json' : options.format,
      verbose: getVerboseState(options),
    });
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
  .option('--json', 'Output results as JSON')
  .action(async (options, command) => {
    const { securityCoherenceCommand } =
      await import('./commands/sugar/security-coherence.js');
    const allOpts = command.optsWithGlobals();
    await securityCoherenceCommand({
      ...options,
      format: allOpts.json || options.json ? 'json' : options.format,
      verbose: getVerboseState(options),
    });
  });

securityCmd
  .command('blast-radius <target>')
  .description(
    'Show cascading security impact when a file/symbol is compromised (O2 × O3)'
  )
  .option('--max-depth <N>', 'Maximum traversal depth', '3')
  .option('--json', 'Output as JSON')
  .action(async (target, options, command) => {
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
    const { analyzeSecurityBlastRadius } =
      await import('./commands/security-blast-radius.js');

    const allOpts = command.optsWithGlobals();
    await analyzeSecurityBlastRadius(
      target,
      {
        ...options,
        json: allOpts.json || options.json,
        verbose: getVerboseState(options),
      },
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
  .option('--json', 'Output results as JSON')
  .action(async (options, command) => {
    const { workflowPatternsCommand } =
      await import('./commands/sugar/workflow.js');
    const allOpts = command.optsWithGlobals();
    await workflowPatternsCommand({
      ...options,
      format: allOpts.json || options.json ? 'json' : options.format,
      verbose: getVerboseState(options),
    });
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
  .option('--json', 'Output results as JSON')
  .action(async (options, command) => {
    const { workflowQuestsCommand } =
      await import('./commands/sugar/workflow.js');
    const allOpts = command.optsWithGlobals();
    await workflowQuestsCommand({
      ...options,
      format: allOpts.json || options.json ? 'json' : options.format,
      verbose: getVerboseState(options),
    });
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
  .option('--json', 'Output results as JSON')
  .action(async (options, command) => {
    const { workflowDepthRulesCommand } =
      await import('./commands/sugar/workflow.js');
    const allOpts = command.optsWithGlobals();
    await workflowDepthRulesCommand({
      ...options,
      format: allOpts.json || options.json ? 'json' : options.format,
      verbose: getVerboseState(options),
    });
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
  .option('--json', 'Output results as JSON')
  .action(async (options, command) => {
    const { proofsTheoremsCommand } =
      await import('./commands/sugar/proofs.js');
    const allOpts = command.optsWithGlobals();
    await proofsTheoremsCommand({
      ...options,
      format: allOpts.json || options.json ? 'json' : options.format,
      verbose: getVerboseState(options),
    });
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
  .option('--json', 'Output results as JSON')
  .action(async (options, command) => {
    const { proofsLemmasCommand } = await import('./commands/sugar/proofs.js');
    const allOpts = command.optsWithGlobals();
    await proofsLemmasCommand({
      ...options,
      format: allOpts.json || options.json ? 'json' : options.format,
      verbose: getVerboseState(options),
    });
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
  .option('--json', 'Output results as JSON')
  .action(async (options, command) => {
    const { proofsListCommand } = await import('./commands/sugar/proofs.js');
    const allOpts = command.optsWithGlobals();
    await proofsListCommand({
      ...options,
      format: allOpts.json || options.json ? 'json' : options.format,
      verbose: getVerboseState(options),
    });
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
  .option(
    '-t, --threshold <number>',
    'Semantic similarity threshold (0.0-1.0, default: 0.5)',
    '0.5'
  )
  .option('-v, --verbose', 'Show detailed error messages', false)
  .option('--json', 'Output results as JSON')
  .action(async (options, command) => {
    const { proofsAlignedCommand } = await import('./commands/sugar/proofs.js');
    const allOpts = command.optsWithGlobals();
    await proofsAlignedCommand({
      ...options,
      threshold: parseFloat(options.threshold),
      format: allOpts.json || options.json ? 'json' : options.format,
      verbose: getVerboseState(options),
    });
  });

// Bootstrap security layer (one-time acknowledgment)
await bootstrapSecurity();

// Global error handler for uncaught exceptions
import { CognitionError, getExitCode } from './utils/errors.js';
import { formatError, formatGenericError } from './utils/error-formatter.js';

process.on('uncaughtException', (error) => {
  const verbose = getVerboseState({});
  const debugPath = getDebugLogPath();

  if (error instanceof CognitionError) {
    debugLog('CognitionError', { code: error.code, message: error.message });
    finalizeDebugLog(false, getExitCode(error));
    console.error(formatError(error, verbose));
    if (debugPath) {
      console.error(`\nDebug log: ${debugPath}`);
    }
    process.exit(getExitCode(error));
  }

  // Unknown error - show stack and ask for bug report
  debugLog('Uncaught exception', { message: String(error) });
  finalizeDebugLog(false, 1);
  console.error(formatGenericError(error, verbose));
  if (debugPath) {
    console.error(`\nDebug log: ${debugPath}`);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const verbose = getVerboseState({});
  const debugPath = getDebugLogPath();

  if (reason instanceof CognitionError) {
    debugLog('CognitionError (rejection)', {
      code: reason.code,
      message: reason.message,
    });
    finalizeDebugLog(false, getExitCode(reason));
    console.error(formatError(reason, verbose));
    if (debugPath) {
      console.error(`\nDebug log: ${debugPath}`);
    }
    process.exit(getExitCode(reason));
  }

  // Unknown rejection
  debugLog('Unhandled rejection', { reason: String(reason) });
  finalizeDebugLog(false, 1);
  console.error(formatGenericError(reason, verbose));
  if (debugPath) {
    console.error(`\nDebug log: ${debugPath}`);
  }
  process.exit(1);
});

// Handle SIGINT (Ctrl-C) with proper exit code
process.on('SIGINT', () => {
  debugLog('SIGINT received');
  finalizeDebugLog(false, 130);
  const debugPath = getDebugLogPath();
  console.error('\nInterrupted');
  if (debugPath) {
    console.error(`Debug log: ${debugPath}`);
  }
  process.exit(130);
});

// All available commands for suggestion matching
const ALL_COMMANDS = [
  'init',
  'i',
  'genesis',
  'g',
  'genesis:docs',
  'query',
  'q',
  'audit:transformations',
  'audit:docs',
  'wizard',
  'w',
  'tui',
  'ask',
  'pr-analyze',
  'lattice',
  'l',
  'overlay',
  'patterns',
  'concepts',
  'coherence',
  'security',
  'workflow',
  'proofs',
  'blast-radius',
  'watch',
  'status',
  'update',
  'guide',
  'migrate',
  'migrate:lance',
  'completion',
  'config',
];

// Handle unknown commands with suggestions
program.on('command:*', (operands) => {
  const unknownCommand = operands[0];
  const suggestion = closest(unknownCommand, ALL_COMMANDS);

  console.error(`error: unknown command '${unknownCommand}'`);
  if (suggestion) {
    console.error(`\nDid you mean '${suggestion}'?`);
  }
  console.error(`\nRun 'cognition-cli --help' for available commands.`);
  process.exit(1);
});

program.parse();
