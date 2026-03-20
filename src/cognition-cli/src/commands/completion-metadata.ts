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
  },
  {
    name: 'genesis',
    aliases: ['g'],
    description: 'Build verifiable skeleton',
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
    description: 'Query the codebase',
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
  },
  { name: 'ask', description: 'Ask questions about docs' },
  {
    name: 'pr-analyze',
    description: 'Comprehensive PR impact analysis (O1+O2+O3+O4+O7)',
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
    description: 'Pattern analysis',
    subcommands: [
      {
        name: 'analyze',
        description: 'Analyze patterns',
        subcommands: [
          { name: 'duplicates', description: 'Analyze duplicate patterns' },
        ],
      },
    ],
  },
  { name: 'concepts', description: 'Concept operations' },
  { name: 'coherence', description: 'Coherence checking' },
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
  { name: 'watch', description: 'Watch for changes' },
  { name: 'status', description: 'Check status' },
  { name: 'update', description: 'Update PGC' },
  { name: 'guide', description: 'Documentation browser' },
  {
    name: 'migrate',
    description: 'Migration commands',
    subcommands: [{ name: 'lance', description: 'Migrate to LanceDB' }],
  },
  {
    name: 'completion',
    description: 'Manage shell completion',
    flags: [
      {
        name: '--shell',
        description: 'Shell type',
        values: ['bash', 'zsh', 'fish'],
      },
    ],
  },
  { name: 'config', description: 'View and manage CLI settings' },
];
