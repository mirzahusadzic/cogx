import {
  CommandMetadata,
  FlagMetadata,
} from '../core/utils/completion-base.js';

/**
 * Global flags available for all commands.
 */
export const globalFlags: FlagMetadata[] = [
  { name: '--no-color', description: 'Disable colored output' },
  { name: '--no-emoji', description: 'Disable emoji output' },
  {
    name: '--format',
    description: 'Output format',
    values: ['auto', 'table', 'json', 'plain'],
  },
  { name: '--json', description: 'Shorthand for --format json' },
  { name: '--verbose', short: '-v', description: 'Verbose output' },
  { name: '--quiet', short: '-q', description: 'Quiet mode' },
  { name: '--no-input', description: 'Disable interactive prompts' },
  { name: '--debug', short: '-d', description: 'Enable debug logging' },
  { name: '--help', short: '-h', description: 'Show help' },
];

/**
 * CLI commands and their metadata for completion.
 */
export const cliCommands: CommandMetadata[] = [
  {
    name: 'init',
    aliases: ['i'],
    description: 'Initialize a new PGC',
    flags: [
      {
        name: '--project-root',
        short: '-p',
        description: 'Project root directory',
        type: 'directory',
      },
      { name: '--dry-run', short: '-n', description: 'Preview creation' },
      { name: '--force', short: '-f', description: 'Skip prompts' },
    ],
  },
  {
    name: 'genesis',
    aliases: ['g'],
    description: 'Build verifiable skeleton',
    flags: [
      {
        name: '--project-root',
        short: '-p',
        description: 'Project root directory',
        type: 'directory',
      },
      { name: '--workbench', short: '-w', description: 'eGemma workbench URL' },
      { name: '--dry-run', short: '-n', description: 'Preview processing' },
      { name: '--resume', short: '-r', description: 'Resume processing' },
      { name: '--json', description: 'Output progress as JSON' },
    ],
    subcommands: [
      {
        name: 'docs',
        description: 'Generate documentation from genesis',
      },
    ],
  },
  {
    name: 'query',
    aliases: ['q'],
    description: 'Query the codebase for information',
    flags: [
      {
        name: '--project-root',
        short: '-p',
        description: 'Project root directory',
        type: 'directory',
      },
      {
        name: '--depth',
        short: '-d',
        description: 'Depth of dependency traversal',
      },
      {
        name: '--format',
        short: '-f',
        description: 'Output format',
        values: ['human', 'json', 'lineage', 'markdown'],
      },
      { name: '--lineage', description: 'Output dependency lineage as JSON' },
      { name: '--json', description: 'Output results as JSON' },
    ],
  },
  {
    name: 'audit',
    description: 'Audit operations',
    subcommands: [
      {
        name: 'transformations',
        description: 'Audit transformation history',
      },
      {
        name: 'docs',
        description: 'Audit documentation',
      },
    ],
  },
  {
    name: 'wizard',
    aliases: ['w'],
    description: 'Interactive setup wizard',
  },
  {
    name: 'tui',
    description: 'Launch interactive TUI',
    flags: [
      {
        name: '--project-root',
        short: '-p',
        description: 'Project root directory',
        type: 'directory',
      },
      { name: '--session-id', description: 'Session ID to resume' },
      {
        name: '--file',
        short: '-f',
        description: 'Path to session state file',
        type: 'file',
      },
      { name: '--workbench', short: '-w', description: 'Workbench URL' },
      {
        name: '--session-tokens',
        description: 'Token threshold',
        type: 'number',
      },
      {
        name: '--max-thinking-tokens',
        description: 'Max thinking tokens',
        type: 'number',
      },
      {
        name: '--provider',
        description: 'LLM provider',
        values: ['claude', 'gemini', 'openai', 'minimax'],
      },
      {
        name: '--model',
        description: 'Model to use',
        values: [
          'claude-opus-4-5-20251101',
          'claude-sonnet-4-5-20250929',
          'gemini-3-flash-preview',
          'gemini-3.1-pro-preview',
          'gemini-3.1-flash-lite-preview',
          'gemini-3.1-pro-preview-customtools',
          'gpt-oss-20b',
          'MiniMax-M2.5',
          'MiniMax-M2.5-highspeed',
          'MiniMax-M2.1',
          'MiniMax-M2.1-highspeed',
          'MiniMax-M2',
        ],
      },
      {
        name: '--no-show-thinking',
        description: 'Hide thinking blocks in TUI',
      },
      {
        name: '--ctx-tools',
        description: 'Number of tool logs to keep in context (rolling buffer)',
        type: 'number',
      },
      {
        name: '--solo',
        description:
          'Enable solo mode (disables IPC and PGC tools to save tokens)',
      },
      { name: '--no-onboarding', description: 'Skip onboarding wizard' },
      {
        name: '--no-auto-response',
        description: 'Disable automatic AI response on tool completion',
      },
    ],
    subcommands: [
      {
        name: 'provider',
        description: 'Manage LLM providers',
        subcommands: [
          { name: 'list', description: 'List available providers' },
          { name: 'set-default', description: 'Set default provider' },
          { name: 'test', description: 'Test provider availability' },
          { name: 'config', description: 'Show current configuration' },
          { name: 'models', description: 'List available models' },
        ],
      },
    ],
  },
  { name: 'ask', description: 'Ask questions about docs' },
  {
    name: 'pr-analyze',
    description: 'Comprehensive PR impact analysis (O1+O2+O3+O4+O7)',
    flags: [
      { name: '--branch', description: 'Branch to analyze' },
      { name: '--max-depth', description: 'Maximum blast radius depth' },
      { name: '--json', description: 'Output as JSON' },
    ],
  },
  {
    name: 'lattice',
    aliases: ['l'],
    description: 'Boolean algebra operations',
  },
  {
    name: 'overlay',
    description: 'Overlay operations',
    subcommands: [
      {
        name: 'generate',
        description: 'Generate an overlay',
        values: [
          'structural_patterns',
          'security_guidelines',
          'lineage_patterns',
          'mission_concepts',
          'operational_patterns',
          'mathematical_proofs',
          'strategic_coherence',
          'all',
        ],
      },
      { name: 'list', description: 'List available overlays' },
    ],
  },
  {
    name: 'patterns',
    description: 'Manage and query structural patterns',
    subcommands: [
      {
        name: 'analyze',
        description: 'Analyze architectural patterns across the codebase',
        flags: [
          {
            name: '--type',
            description: "Pattern type ('structural' or 'lineage')",
            values: ['structural', 'lineage'],
          },
          {
            name: '--verbose',
            short: '-v',
            description: 'Show detailed information including file paths',
          },
          { name: '--json', description: 'Output as JSON' },
        ],
        subcommands: [
          {
            name: 'roles',
            description: 'List all architectural roles',
            flags: [{ name: '--json', description: 'Output as JSON' }],
          },
          {
            name: 'role',
            description: 'Detailed analysis of a specific architectural role',
            flags: [
              {
                name: '--type',
                description: "Pattern type ('structural' or 'lineage')",
                values: ['structural', 'lineage'],
              },
              { name: '--json', description: 'Output as JSON' },
            ],
          },
          {
            name: 'duplicates',
            description: 'Analyze architectural duplicates across the codebase',
            flags: [
              {
                name: '--threshold',
                description: 'Similarity threshold (0-1)',
                type: 'string' as const,
              },
              {
                name: '--top-k',
                description: 'Top K similar symbols to check',
                type: 'string' as const,
              },
              { name: '--json', description: 'Output as JSON' },
            ],
          },
        ],
      },
      {
        name: 'compact',
        description: 'Compact pattern tables to reclaim storage space',
        flags: [
          {
            name: '--type',
            description:
              "Pattern type to compact ('structural', 'lineage', or 'all')",
            values: ['structural', 'lineage', 'all'],
          },
        ],
      },
      {
        name: 'find-similar',
        description: 'Find architecturally similar symbols',
        flags: [
          {
            name: '--top-k',
            short: '-k',
            description: 'Number of similar patterns to return',
            type: 'string' as const,
          },
          {
            name: '--type',
            description: "Pattern type ('structural' or 'lineage')",
            values: ['structural', 'lineage'],
          },
          { name: '--json', description: 'Output raw JSON' },
        ],
      },
      {
        name: 'list',
        description: 'List all patterns, optionally filtered by role',
        flags: [
          {
            name: '--role',
            description: 'Filter by architectural role',
            type: 'string' as const,
          },
          {
            name: '--type',
            description: "Pattern type ('structural' or 'lineage')",
            values: ['structural', 'lineage'],
          },
          {
            name: '--limit',
            short: '-l',
            description: 'Maximum number of results to show',
            type: 'string' as const,
          },
          { name: '--json', description: 'Output as JSON' },
        ],
      },
      {
        name: 'inspect',
        description: 'Show comprehensive information about a symbol',
        flags: [{ name: '--json', description: 'Output as JSON' }],
      },
      {
        name: 'duplicates',
        description: 'Analyze architectural duplicates across the codebase',
        flags: [
          {
            name: '--threshold',
            description: 'Similarity threshold (0-1)',
            type: 'string' as const,
          },
          {
            name: '--top-k',
            description: 'Top K similar symbols to check',
            type: 'string' as const,
          },
          { name: '--json', description: 'Output as JSON' },
        ],
      },
      {
        name: 'analyze-duplicates',
        description: 'Analyze architectural duplicates (alias for duplicates)',
        flags: [
          {
            name: '--threshold',
            description: 'Similarity threshold (0-1)',
            type: 'string' as const,
          },
          {
            name: '--top-k',
            description: 'Top K similar symbols to check',
            type: 'string' as const,
          },
          { name: '--json', description: 'Output as JSON' },
        ],
      },
      {
        name: 'graph',
        description: 'Visualize dependency graph for a symbol',
        flags: [
          {
            name: '--json',
            description: 'Output as JSON instead of ASCII tree',
          },
          {
            name: '--max-depth',
            description: 'Maximum depth to traverse',
            type: 'string' as const,
          },
        ],
      },
      {
        name: 'compare',
        description: 'Compare two symbols structurally',
        flags: [{ name: '--json', description: 'Output as JSON' }],
      },
    ],
  },
  {
    name: 'concepts',
    description: 'Concept operations',
    subcommands: [
      {
        name: 'list',
        description: 'List concepts',
        flags: [
          {
            name: '--project-root',
            description: 'The root of the project.',
            short: '-p',
          },
          {
            name: '--format',
            description: 'Output format: table, json, summary',
            short: '-f',
          },
          {
            name: '--limit',
            description: 'Maximum number of results',
            short: '-l',
          },
          {
            name: '--verbose',
            description: 'Show detailed error messages',
            short: '-v',
          },
          { name: '--json', description: 'Output results as JSON' },
        ],
      },
      {
        name: 'top',
        description: 'Show top concepts',
        flags: [
          {
            name: '--project-root',
            description: 'The root of the project.',
            short: '-p',
          },
          {
            name: '--limit',
            description: 'Maximum number of results',
            short: '-l',
          },
          {
            name: '--verbose',
            description: 'Show detailed error messages',
            short: '-v',
          },
          { name: '--json', description: 'Output results as JSON' },
        ],
      },
      {
        name: 'search',
        description: 'Search concepts',
        flags: [
          {
            name: '--project-root',
            description: 'The root of the project.',
            short: '-p',
          },
          { name: '--query', description: 'Search query', short: '-q' },
          {
            name: '--limit',
            description: 'Maximum number of results',
            short: '-l',
          },
          {
            name: '--verbose',
            description: 'Show detailed error messages',
            short: '-v',
          },
          { name: '--json', description: 'Output results as JSON' },
        ],
      },
      {
        name: 'by-section',
        description: 'List concepts by section',
        flags: [
          {
            name: '--project-root',
            description: 'The root of the project.',
            short: '-p',
          },
          { name: '--section', description: 'Section name', short: '-s' },
          {
            name: '--limit',
            description: 'Maximum number of results',
            short: '-l',
          },
          {
            name: '--verbose',
            description: 'Show detailed error messages',
            short: '-v',
          },
          { name: '--json', description: 'Output results as JSON' },
        ],
      },
      {
        name: 'inspect',
        description: 'Inspect a specific concept',
        flags: [
          {
            name: '--project-root',
            description: 'The root of the project.',
            short: '-p',
          },
          { name: '--concept', description: 'Concept name', short: '-c' },
          {
            name: '--verbose',
            description: 'Show detailed error messages',
            short: '-v',
          },
          { name: '--json', description: 'Output results as JSON' },
        ],
      },
    ],
  },
  {
    name: 'coherence',
    description: 'Coherence checking',
    subcommands: [
      {
        name: 'report',
        description: 'Show overall strategic coherence metrics',
        flags: [
          {
            name: '--project-root',
            description: 'The root of the project.',
            short: '-p',
          },
          { name: '--json', description: 'Output raw JSON' },
          {
            name: '--verbose',
            description: 'Show detailed error messages',
            short: '-v',
          },
          {
            name: '--history',
            description:
              'Show intent-grounded coherence metrics and reclassified symbols',
          },
        ],
      },
      {
        name: 'aligned',
        description: 'Show symbols aligned with mission',
        flags: [
          {
            name: '--project-root',
            description: 'The root of the project.',
            short: '-p',
          },
          { name: '--min-score', description: 'Minimum coherence score' },
          {
            name: '--format',
            description: 'Output format: table, json, summary',
            short: '-f',
          },
          {
            name: '--limit',
            description: 'Maximum number of results',
            short: '-l',
          },
          {
            name: '--verbose',
            description: 'Show detailed error messages',
            short: '-v',
          },
          { name: '--json', description: 'Output results as JSON' },
        ],
      },
      {
        name: 'drifted',
        description: 'Show symbols drifted from mission',
        flags: [
          {
            name: '--project-root',
            description: 'The root of the project.',
            short: '-p',
          },
          { name: '--max-score', description: 'Maximum coherence score' },
          {
            name: '--format',
            description: 'Output format: table, json, summary',
            short: '-f',
          },
          {
            name: '--limit',
            description: 'Maximum number of results',
            short: '-l',
          },
          {
            name: '--verbose',
            description: 'Show detailed error messages',
            short: '-v',
          },
          { name: '--json', description: 'Output results as JSON' },
        ],
      },
      {
        name: 'list',
        description: 'Show all symbols with coherence scores',
        flags: [
          {
            name: '--project-root',
            description: 'The root of the project.',
            short: '-p',
          },
          {
            name: '--format',
            description: 'Output format: table, json, summary',
            short: '-f',
          },
          {
            name: '--limit',
            description: 'Maximum number of results',
            short: '-l',
          },
          {
            name: '--verbose',
            description: 'Show detailed error messages',
            short: '-v',
          },
          { name: '--json', description: 'Output results as JSON' },
        ],
      },
    ],
  },
  {
    name: 'security',
    description: 'Security analysis',
    subcommands: [
      { name: 'mandate', description: 'Security mandate' },
      { name: 'attacks', description: 'Attack vectors' },
      { name: 'coverage-gaps', description: 'Coverage gaps' },
      { name: 'boundaries', description: 'Trust boundaries' },
      { name: 'list', description: 'List security findings' },
      { name: 'cves', description: 'CVE analysis' },
      { name: 'query', description: 'Query security data' },
      { name: 'coherence', description: 'Security coherence' },
      { name: 'blast-radius', description: 'Security blast radius' },
    ],
  },
  {
    name: 'workflow',
    description: 'Workflow analysis',
    subcommands: [
      { name: 'patterns', description: 'Workflow patterns' },
      { name: 'quests', description: 'Active quests' },
      { name: 'depth-rules', description: 'Depth control rules' },
    ],
  },
  {
    name: 'proofs',
    description: 'Proof analysis',
    subcommands: [
      { name: 'theorems', description: 'Theorems' },
      { name: 'lemmas', description: 'Lemmas' },
      { name: 'list', description: 'List proofs' },
      { name: 'aligned', description: 'Alignment proofs' },
    ],
  },
  { name: 'blast-radius', description: 'Impact analysis' },
  {
    name: 'watch',
    description: 'Watch for changes and maintain PGC coherence state',
    flags: [
      { name: '--untracked', description: 'Watch for new untracked files' },
      { name: '--debounce', description: 'Debounce delay (ms)' },
      { name: '--auto-update', description: 'Auto-trigger update on change' },
      { name: '--auto-update-debounce', description: 'Auto-update delay (ms)' },
      {
        name: '--workbench',
        short: '-w',
        description: 'eGemma workbench URL',
      },
      { name: '--verbose', short: '-v', description: 'Show detailed changes' },
    ],
  },
  {
    name: 'status',
    description: 'Check PGC coherence state',
    flags: [
      { name: '--json', description: 'Output as JSON' },
      {
        name: '--verbose',
        short: '-v',
        description: 'Show detailed blast radius info',
      },
    ],
  },
  {
    name: 'update',
    description: 'Incremental PGC sync from dirty state',
    flags: [
      {
        name: '--project-root',
        short: '-p',
        description: 'Project root directory',
        type: 'directory',
      },
      {
        name: '--workbench',
        short: '-w',
        description: 'eGemma workbench URL',
      },
      {
        name: '--dry-run',
        short: '-n',
        description: 'Preview pending changes',
      },
    ],
  },
  { name: 'guide', description: 'Documentation browser' },
  {
    name: 'migrate',
    description: 'Migration commands',
    subcommands: [{ name: 'lance', description: 'Migrate to LanceDB' }],
  },
  {
    name: 'completion',
    description: 'Manage shell completion',
    subcommands: [
      {
        name: 'install',
        description: 'Install shell completion scripts',
        flags: [
          {
            name: '--shell',
            description: 'Shell type: bash, zsh, or fish',
            values: ['bash', 'zsh', 'fish'],
          },
        ],
      },
      {
        name: 'uninstall',
        description: 'Uninstall shell completion scripts',
        flags: [
          {
            name: '--shell',
            description: 'Shell type: bash, zsh, or fish',
            values: ['bash', 'zsh', 'fish'],
          },
        ],
      },
    ],
  },
  {
    name: 'lineage',
    description: 'Track and manage code transformation lineage',
    subcommands: [
      {
        name: 'record',
        description: 'Record file changes from a specific commit or range',
        flags: [
          { name: '--commit', description: 'Git commit hash or range' },
          { name: '--synthesize', description: 'Synthesize intent via eGemma' },
          { name: '--update', description: 'Trigger incremental update' },
          {
            name: '--project-root',
            short: '-p',
            description: 'Project root directory',
            type: 'directory',
          },
        ],
      },
      {
        name: 'hooks:install',
        description: 'Install git hooks to automatically record lineage',
        flags: [
          {
            name: '--project-root',
            short: '-p',
            description: 'Project root directory',
            type: 'directory',
          },
        ],
      },
      {
        name: 'intent',
        description: 'Declare an intent for a future code transformation',
        flags: [
          {
            name: '--file',
            description: 'Path to the file being modified',
            type: 'file',
          },
          { name: '--intent', description: 'Reasoning for the change' },
          { name: '--decision', description: 'What choice was made' },
          { name: '--alternatives', description: 'Alternatives considered' },
          {
            name: '--source',
            description: 'Identifier for the source',
            values: ['ai_agent', 'tui', 'claude-code'],
          },
          { name: '--session', description: 'Link to conversation session' },
          {
            name: '--confidence',
            description: 'Confidence in the reasoning (0.0-1.0)',
          },
          {
            name: '--project-root',
            short: '-p',
            description: 'Project root directory',
            type: 'directory',
          },
        ],
      },
      {
        name: 'enrich',
        description: 'Enrich low-confidence transforms via eGemma synthesis',
        flags: [
          { name: '--since', description: 'Scan transforms since git ref' },
          { name: '--dry-run', description: 'Show what would be enriched' },
          {
            name: '--project-root',
            short: '-p',
            description: 'Project root directory',
            type: 'directory',
          },
        ],
      },
      {
        name: 'rehydrate',
        description: 'Reconstruct PGC lineage from git commit history',
        flags: [
          {
            name: '--depth',
            short: '-n',
            description: 'Process only the last N commits',
          },
          {
            name: '--since',
            description: 'Process commits after this date or git ref',
          },
          { name: '--resume', description: 'Skip already-processed commits' },
          {
            name: '--synthesize',
            description: 'Enrich transforms via eGemma synthesis',
          },
          {
            name: '--project-root',
            short: '-p',
            description: 'Project root directory',
            type: 'directory',
          },
        ],
      },
    ],
  },
  { name: 'config', description: 'View and manage CLI settings' },
  {
    name: 'lock',
    description: 'Manage agent write locks for the PGC',
    subcommands: [
      {
        name: 'acquire',
        description: 'Acquire a write lock',
        flags: [
          {
            name: '--source',
            description: 'Lock holder identifier (e.g. claude-code)',
          },
          {
            name: '--timeout',
            description: 'Auto-expire timeout in seconds',
          },
          { name: '--session', description: 'Session identifier' },
          {
            name: '--project-root',
            short: '-p',
            description: 'Project root directory',
            type: 'directory',
          },
        ],
      },
      {
        name: 'release',
        description: 'Release an active write lock',
        flags: [
          {
            name: '--project-root',
            short: '-p',
            description: 'Project root directory',
            type: 'directory',
          },
        ],
      },
      {
        name: 'status',
        description: 'Show current lock status',
        flags: [
          {
            name: '--project-root',
            short: '-p',
            description: 'Project root directory',
            type: 'directory',
          },
        ],
      },
    ],
  },
  {
    name: 'transforms',
    description: 'Manage PGC transform log (compaction, GC)',
    subcommands: [
      {
        name: 'compact',
        description:
          'Compact the PGC transform log (purge invalidated, squash intermediates)',
        flags: [
          {
            name: '--before',
            description:
              'Only compact transforms older than this ISO date (e.g. 2025-01-01)',
          },
          {
            name: '--dry-run',
            description: 'Show what would be done without making changes',
          },
          {
            name: '--min-age',
            description:
              'Minimum age in days for a transform to be eligible (default 90)',
          },
        ],
      },
    ],
  },
];
