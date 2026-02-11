/**
 * Help Formatter Utilities
 *
 * Provides enhanced help output with examples and "next steps" guidance.
 * Follows clig.dev best practices for CLI documentation.
 *
 * @example
 * import { addExamples, addNextSteps } from './utils/help-formatter.js';
 *
 * program.command('genesis')
 *   .description('Build code knowledge graph')
 *   .addHelpText('after', addExamples([
 *     { cmd: 'cognition genesis src/', desc: 'Analyze src/ directory' },
 *     { cmd: 'cognition genesis --workbench http://localhost:8001 src/', desc: 'Custom workbench' },
 *   ]));
 */

import chalk from 'chalk';
import { useColor } from './terminal-capabilities.js';

/**
 * Example command entry
 */
export interface CommandExample {
  /** The command to run */
  cmd: string;
  /** Description of what the command does */
  desc: string;
}

/**
 * Format examples for help output
 *
 * Creates a formatted examples section for --help output.
 *
 * @param examples - Array of example commands with descriptions
 * @returns Formatted string for addHelpText('after', ...)
 *
 * @example
 * command.addHelpText('after', addExamples([
 *   { cmd: 'cognition init', desc: 'Initialize in current directory' },
 *   { cmd: 'cognition init -p /path/to/project', desc: 'Initialize in specific directory' },
 * ]));
 */
export function addExamples(examples: CommandExample[]): string {
  const c = useColor()
    ? chalk
    : { cyan: (s: string) => s, dim: (s: string) => s };

  const lines: string[] = ['', c.cyan('Examples:')];

  for (const example of examples) {
    lines.push(`  ${c.dim('#')} ${example.desc}`);
    lines.push(`  $ ${example.cmd}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format next steps for help output
 *
 * Creates a "Next Steps" section suggesting follow-up commands.
 *
 * @param steps - Array of suggested next commands
 * @returns Formatted string for addHelpText('after', ...)
 *
 * @example
 * command.addHelpText('after', addNextSteps([
 *   'cognition genesis:docs VISION.md',
 *   'cognition overlay generate',
 *   'cognition status',
 * ]));
 */
export function addNextSteps(steps: string[]): string {
  const c = useColor()
    ? chalk
    : { cyan: (s: string) => s, dim: (s: string) => s };

  const lines: string[] = ['', c.cyan('Next Steps:')];

  for (const step of steps) {
    lines.push(`  $ ${step}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format environment variables for help output
 *
 * Documents environment variables that affect command behavior.
 *
 * @param envVars - Array of environment variable descriptions
 * @returns Formatted string for addHelpText('after', ...)
 *
 * @example
 * command.addHelpText('after', addEnvVars([
 *   { name: 'WORKBENCH_URL', desc: 'Default workbench URL' },
 *   { name: 'COGNITION_VERBOSE', desc: 'Enable verbose output (1)' },
 * ]));
 */
export function addEnvVars(
  envVars: Array<{ name: string; desc: string }>
): string {
  const c = useColor()
    ? chalk
    : { cyan: (s: string) => s, dim: (s: string) => s };

  const lines: string[] = ['', c.cyan('Environment Variables:')];

  for (const env of envVars) {
    lines.push(`  ${env.name}`);
    lines.push(`      ${c.dim(env.desc)}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format a "Learn More" section with documentation links
 *
 * @param links - Array of documentation URLs
 * @returns Formatted string for addHelpText('after', ...)
 */
export function addLearnMore(links: string[]): string {
  const c = useColor()
    ? chalk
    : { cyan: (s: string) => s, dim: (s: string) => s };

  const lines: string[] = ['', c.cyan('Learn More:')];

  for (const link of links) {
    lines.push(`  ${c.dim(link)}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Combine multiple help sections
 *
 * @param sections - Array of formatted help sections
 * @returns Combined string for addHelpText('after', ...)
 */
export function combineHelpSections(...sections: string[]): string {
  return sections.join('');
}

/**
 * All environment variables supported by cognition-cli
 *
 * Organized by category for documentation purposes.
 */
export const ALL_ENV_VARS = {
  apiKeys: [
    {
      name: 'ANTHROPIC_API_KEY',
      desc: 'API key for Claude provider',
    },
    {
      name: 'GEMINI_API_KEY',
      desc: 'API key for Gemini provider',
    },
  ],
  llm: [
    {
      name: 'COGNITION_LLM_PROVIDER',
      desc: 'Default LLM provider (claude|gemini)',
    },
    {
      name: 'COGNITION_CLAUDE_MODEL',
      desc: 'Default Claude model (e.g., claude-opus-4-5-20251101)',
    },
    {
      name: 'COGNITION_GEMINI_MODEL',
      desc: 'Default Gemini model (e.g., gemini-3-flash-preview)',
    },
  ],
  workbench: [
    {
      name: 'WORKBENCH_URL',
      desc: 'Default eGemma workbench URL (http://localhost:8000)',
    },
  ],
  output: [
    {
      name: 'COGNITION_NO_COLOR',
      desc: 'Disable colored output (1 to disable)',
    },
    {
      name: 'COGNITION_NO_EMOJI',
      desc: 'Disable emoji output (1 to disable)',
    },
    {
      name: 'COGNITION_FORMAT',
      desc: 'Output format (auto|json|plain|table)',
    },
    {
      name: 'COGNITION_VERBOSE',
      desc: 'Enable verbose output (1 to enable)',
    },
    {
      name: 'COGNITION_QUIET',
      desc: 'Quiet mode, errors only (1 to enable)',
    },
    {
      name: 'COGNITION_NO_INPUT',
      desc: 'Disable interactive prompts (1 to disable)',
    },
    {
      name: 'COGNITION_DEBUG',
      desc: 'Enable debug file logging (1 to enable)',
    },
  ],
  standard: [
    {
      name: 'NO_COLOR',
      desc: 'Standard no-color flag (https://no-color.org/)',
    },
    {
      name: 'CI',
      desc: 'CI environment detection (disables colors/prompts)',
    },
  ],
  ipc: [
    {
      name: 'IPC_SIGMA_BUS',
      desc: 'Named bus for multi-agent mesh (e.g., "team", "global"). Without this, each project is isolated.',
    },
  ],
};

/**
 * Command group definition for grouped help output
 */
export interface CommandGroup {
  /** Group title (e.g., "start a working area") */
  title: string;
  /** Commands in this group */
  commands: Array<{
    /** Command name (e.g., "init") */
    name: string;
    /** Short description */
    desc: string;
  }>;
}

/**
 * Format commands into git-style grouped help
 *
 * Creates output like:
 *   start a working area:
 *      init       Initialize a new Grounded Context Pool
 *      wizard     Interactive setup wizard
 *
 * @param groups - Array of command groups
 * @returns Formatted string for help output
 */
export function formatGroupedCommands(groups: CommandGroup[]): string {
  const c = useColor()
    ? chalk
    : { cyan: (s: string) => s, dim: (s: string) => s, bold: (s: string) => s };

  const lines: string[] = [];

  // Find the longest command name for alignment
  let maxCmdLen = 0;
  for (const group of groups) {
    for (const cmd of group.commands) {
      if (cmd.name.length > maxCmdLen) maxCmdLen = cmd.name.length;
    }
  }

  for (const group of groups) {
    lines.push('');
    lines.push(c.cyan(group.title + ':'));
    for (const cmd of group.commands) {
      const padding = ' '.repeat(maxCmdLen - cmd.name.length + 3);
      lines.push(`   ${cmd.name}${padding}${c.dim(cmd.desc)}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Cognition CLI command groups for grouped help output
 */
export const COMMAND_GROUPS: CommandGroup[] = [
  {
    title: 'start a workspace',
    commands: [
      { name: 'init', desc: 'Initialize a new Grounded Context Pool (PGC)' },
      { name: 'wizard', desc: 'Interactive wizard to set up complete PGC' },
      { name: 'config', desc: 'View and manage CLI settings' },
    ],
  },
  {
    title: 'build knowledge graph',
    commands: [
      { name: 'genesis', desc: 'Build verifiable skeleton from source code' },
      { name: 'genesis:docs', desc: 'Ingest markdown documentation into PGC' },
      { name: 'migrate:lance', desc: 'Migrate embeddings to LanceDB' },
    ],
  },
  {
    title: 'query and explore',
    commands: [
      { name: 'query', desc: 'Query codebase for information' },
      { name: 'ask', desc: 'Ask questions about the manual (AI-powered)' },
      { name: 'lattice', desc: 'Execute boolean algebra across overlays' },
      { name: 'blast-radius', desc: 'Show impact graph when symbol changes' },
    ],
  },
  {
    title: 'analyze overlays',
    commands: [
      { name: 'overlay', desc: 'Manage and generate analytical overlays' },
      { name: 'patterns', desc: 'Query structural patterns (O1)' },
      { name: 'coherence', desc: 'Query strategic coherence (O4×O1)' },
      { name: 'concepts', desc: 'Query mission concepts (O4)' },
      { name: 'pr-analyze', desc: 'Comprehensive PR impact analysis' },
    ],
  },
  {
    title: 'maintain workspace',
    commands: [
      { name: 'status', desc: 'Check PGC coherence state' },
      { name: 'update', desc: 'Incremental PGC sync from dirty state' },
      { name: 'watch', desc: 'Watch files and maintain coherence' },
    ],
  },
  {
    title: 'interactive interfaces',
    commands: [
      { name: 'tui', desc: 'Launch interactive TUI with LLM integration' },
      { name: 'guide', desc: 'Show colorful guides for commands' },
    ],
  },
  {
    title: 'audit and security',
    commands: [
      {
        name: 'audit:transformations',
        desc: 'Audit file transformation history',
      },
      { name: 'audit:docs', desc: 'Audit document integrity in PGC' },
      { name: 'security', desc: 'Security analysis commands' },
    ],
  },
  {
    title: 'advanced analysis',
    commands: [
      { name: 'workflow', desc: 'Operational workflow analysis' },
      { name: 'proofs', desc: 'Mathematical proofs and theorems' },
    ],
  },
  {
    title: 'shell integration',
    commands: [
      { name: 'completion', desc: 'Manage shell completion (bash/zsh/fish)' },
    ],
  },
];

/**
 * Format all environment variables for help output
 *
 * Creates a comprehensive environment variables section grouped by category.
 *
 * @returns Formatted string for addHelpText('after', ...)
 */
export function addAllEnvVars(): string {
  const c = useColor()
    ? chalk
    : { cyan: (s: string) => s, dim: (s: string) => s, bold: (s: string) => s };

  const lines: string[] = ['', c.cyan('Environment Variables:')];

  const categories: Array<{
    title: string;
    vars: Array<{ name: string; desc: string }>;
  }> = [
    { title: 'API Keys', vars: ALL_ENV_VARS.apiKeys },
    { title: 'LLM Configuration', vars: ALL_ENV_VARS.llm },
    { title: 'Workbench', vars: ALL_ENV_VARS.workbench },
    { title: 'Output Control', vars: ALL_ENV_VARS.output },
    { title: 'Standard', vars: ALL_ENV_VARS.standard },
    { title: 'Multi-Agent IPC', vars: ALL_ENV_VARS.ipc },
  ];

  for (const category of categories) {
    lines.push('');
    lines.push(`  ${c.bold(category.title)}`);
    for (const env of category.vars) {
      lines.push(`    ${env.name}`);
      lines.push(`        ${c.dim(env.desc)}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Global examples shown in main help output
 *
 * Shows common workflows to help users get started quickly.
 *
 * @returns Formatted string for addHelpText('after', ...)
 */
export function addGlobalExamples(): string {
  const c = useColor()
    ? chalk
    : { cyan: (s: string) => s, dim: (s: string) => s };

  const lines: string[] = ['', c.cyan('Examples:')];

  const examples = [
    { cmd: 'cognition init', desc: 'Start a new workspace' },
    { cmd: 'cognition wizard', desc: 'Guided setup (genesis + overlays)' },
    { cmd: 'cognition query "auth"', desc: 'Search the codebase' },
    { cmd: 'cognition ask "how does X work?"', desc: 'AI-powered Q&A' },
    { cmd: 'cognition tui', desc: 'Launch interactive interface' },
  ];

  for (const example of examples) {
    lines.push(`  $ ${example.cmd}`);
    lines.push(`      ${c.dim(example.desc)}`);
  }

  lines.push('');
  lines.push(
    `See ${c.cyan("'cognition <command> --help'")} for command-specific help.`
  );
  lines.push('');
  return lines.join('\n');
}
