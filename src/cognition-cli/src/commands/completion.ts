/**
 * Tab Completion Support for Cognition CLI
 *
 * Provides shell completion for bash, zsh, and fish using tabtab.
 * Supports completion of:
 * - Commands and aliases
 * - Subcommands
 * - Option flags
 * - Context-aware values (overlay types, formats, etc.)
 *
 * Installation:
 *   cognition-cli completion install --shell bash
 *   cognition-cli completion install --shell zsh
 *   cognition-cli completion install --shell fish
 *
 * Uninstallation:
 *   cognition-cli completion uninstall --shell bash
 *
 * @example
 * // After installation, tab completion works:
 * $ cognition-cli [TAB]
 * ask           genesis       query         wizard
 * audit         init          security      ...
 *
 * $ cognition-cli overlay generate [TAB]
 * structural_patterns    security_guidelines    lineage_patterns
 * mission_concepts       operational_patterns   mathematical_proofs
 */

import { Command } from 'commander';

/**
 * Create the completion command
 *
 * Provides install/uninstall subcommands for shell completion.
 */
export function createCompletionCommand(): Command {
  const completion = new Command('completion').description(
    'Manage shell completion (bash/zsh/fish)'
  );

  completion
    .command('install')
    .description('Install shell completion scripts')
    .option('--shell <shell>', 'Shell type: bash, zsh, or fish', detectShell())
    .action(async (options) => {
      const shell = options.shell || detectShell();

      if (!['bash', 'zsh', 'fish'].includes(shell)) {
        console.error(`Unsupported shell: ${shell}`);
        console.error('Supported shells: bash, zsh, fish');
        process.exit(1);
      }

      try {
        await installCompletion(shell);
        console.log(`✓ Shell completion installed for ${shell}`);
        console.log('\nRestart your shell or run:');

        if (shell === 'bash') {
          console.log('  source ~/.bashrc');
        } else if (shell === 'zsh') {
          console.log('  source ~/.zshrc');
        } else if (shell === 'fish') {
          console.log('  source ~/.config/fish/config.fish');
        }
      } catch (error) {
        console.error(
          'Failed to install completion:',
          (error as Error).message
        );
        process.exit(1);
      }
    });

  completion
    .command('uninstall')
    .description('Uninstall shell completion scripts')
    .option('--shell <shell>', 'Shell type: bash, zsh, or fish', detectShell())
    .action(async (options) => {
      const shell = options.shell || detectShell();

      try {
        await uninstallCompletion(shell);
        console.log(`✓ Shell completion uninstalled for ${shell}`);
      } catch (error) {
        console.error(
          'Failed to uninstall completion:',
          (error as Error).message
        );
        process.exit(1);
      }
    });

  // Hidden command that provides completion data (called by shell)
  completion
    .command('--get-completions', { hidden: true })
    .description('Get completion suggestions (internal use)')
    .action(() => {
      handleCompletion();
    });

  return completion;
}

/**
 * Detect current shell from environment
 */
function detectShell(): string {
  const shell = process.env.SHELL || '';

  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('fish')) return 'fish';

  return 'bash'; // Default fallback
}

/**
 * Install completion for specified shell
 */
async function installCompletion(shell: string): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  const homeDir = os.homedir();
  const completionScript = generateCompletionScript(shell);

  let installPath: string;
  let rcFile: string;

  if (shell === 'bash') {
    installPath = path.join(homeDir, '.cognition-completion.bash');
    rcFile = path.join(homeDir, '.bashrc');
  } else if (shell === 'zsh') {
    installPath = path.join(homeDir, '.cognition-completion.zsh');
    rcFile = path.join(homeDir, '.zshrc');
  } else if (shell === 'fish') {
    const fishDir = path.join(homeDir, '.config', 'fish', 'completions');
    await fs.promises.mkdir(fishDir, { recursive: true });
    installPath = path.join(fishDir, 'cognition-cli.fish');
    rcFile = ''; // Fish loads completions automatically
  } else {
    throw new Error(`Unsupported shell: ${shell}`);
  }

  // Write completion script
  await fs.promises.writeFile(installPath, completionScript, 'utf8');

  // Add source line to rc file (except fish)
  if (rcFile) {
    const sourceLine = `\n# Cognition CLI completion\nsource "${installPath}"\n`;
    const rcContent = await fs.promises
      .readFile(rcFile, 'utf8')
      .catch(() => '');

    if (!rcContent.includes(installPath)) {
      await fs.promises.appendFile(rcFile, sourceLine, 'utf8');
    }
  }
}

/**
 * Uninstall completion for specified shell
 */
async function uninstallCompletion(shell: string): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  const homeDir = os.homedir();
  let installPath: string;
  let rcFile: string;

  if (shell === 'bash') {
    installPath = path.join(homeDir, '.cognition-completion.bash');
    rcFile = path.join(homeDir, '.bashrc');
  } else if (shell === 'zsh') {
    installPath = path.join(homeDir, '.cognition-completion.zsh');
    rcFile = path.join(homeDir, '.zshrc');
  } else if (shell === 'fish') {
    installPath = path.join(
      homeDir,
      '.config',
      'fish',
      'completions',
      'cognition-cli.fish'
    );
    rcFile = '';
  } else {
    throw new Error(`Unsupported shell: ${shell}`);
  }

  // Remove completion script
  await fs.promises.unlink(installPath).catch(() => {});

  // Remove source line from rc file
  if (rcFile) {
    const rcContent = await fs.promises
      .readFile(rcFile, 'utf8')
      .catch(() => '');
    const lines = rcContent
      .split('\n')
      .filter((line) => !line.includes(installPath));
    await fs.promises.writeFile(rcFile, lines.join('\n'), 'utf8');
  }
}

/**
 * Generate completion script for specified shell
 */
function generateCompletionScript(shell: string): string {
  if (shell === 'bash') {
    return generateBashCompletion();
  } else if (shell === 'zsh') {
    return generateZshCompletion();
  } else if (shell === 'fish') {
    return generateFishCompletion();
  }

  throw new Error(`Unsupported shell: ${shell}`);
}

/**
 * Generate bash completion script
 */
function generateBashCompletion(): string {
  return `# Cognition CLI bash completion

_cognition_cli_completions() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  # Main commands
  local commands="init i genesis g query q wizard w tui ask lattice l audit overlay patterns concepts coherence security workflow proofs blast-radius watch status update guide migrate completion --help --version"

  # Global flags
  local global_flags="--no-color --no-emoji --format --verbose -v --quiet -q --help -h"

  # If completing first word, suggest main commands
  if [ \${COMP_CWORD} -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- \${cur}) )
    return 0
  fi

  # Context-aware completion based on previous word
  case "\${prev}" in
    --format)
      COMPREPLY=( $(compgen -W "auto table json plain" -- \${cur}) )
      return 0
      ;;
    --shell)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- \${cur}) )
      return 0
      ;;
    overlay)
      COMPREPLY=( $(compgen -W "generate list" -- \${cur}) )
      return 0
      ;;
    generate)
      # Check if we're in overlay context
      if [[ "\${COMP_WORDS[1]}" == "overlay" ]]; then
        COMPREPLY=( $(compgen -W "structural_patterns security_guidelines lineage_patterns mission_concepts operational_patterns mathematical_proofs strategic_coherence all" -- \${cur}) )
        return 0
      fi
      ;;
    security)
      COMPREPLY=( $(compgen -W "mandate attacks coverage-gaps boundaries list cves query coherence" -- \${cur}) )
      return 0
      ;;
    workflow)
      COMPREPLY=( $(compgen -W "patterns quests depth-rules" -- \${cur}) )
      return 0
      ;;
    proofs)
      COMPREPLY=( $(compgen -W "theorems lemmas list aligned" -- \${cur}) )
      return 0
      ;;
    patterns)
      COMPREPLY=( $(compgen -W "find-similar compare analyze inspect" -- \${cur}) )
      return 0
      ;;
    concepts)
      COMPREPLY=( $(compgen -W "list search align" -- \${cur}) )
      return 0
      ;;
    coherence)
      COMPREPLY=( $(compgen -W "check score" -- \${cur}) )
      return 0
      ;;
    completion)
      COMPREPLY=( $(compgen -W "install uninstall" -- \${cur}) )
      return 0
      ;;
    -p|--project-root|-w|--workbench|--path)
      # File/directory completion
      COMPREPLY=( $(compgen -d -- \${cur}) )
      return 0
      ;;
  esac

  # Default: suggest flags
  COMPREPLY=( $(compgen -W "\${global_flags}" -- \${cur}) )
}

complete -F _cognition_cli_completions cognition-cli
`;
}

/**
 * Generate zsh completion script
 */
function generateZshCompletion(): string {
  return `#compdef cognition-cli

# Cognition CLI zsh completion

_cognition_cli() {
  local -a commands
  commands=(
    'init:Initialize a new PGC (alias: i)'
    'i:Alias for init'
    'genesis:Build verifiable skeleton (alias: g)'
    'g:Alias for genesis'
    'query:Query the codebase (alias: q)'
    'q:Alias for query'
    'wizard:Interactive setup wizard (alias: w)'
    'w:Alias for wizard'
    'tui:Launch interactive TUI'
    'ask:Ask questions about docs'
    'lattice:Boolean algebra operations (alias: l)'
    'l:Alias for lattice'
    'overlay:Overlay operations'
    'patterns:Pattern analysis'
    'concepts:Concept operations'
    'coherence:Coherence checking'
    'security:Security analysis'
    'workflow:Workflow analysis'
    'proofs:Proof analysis'
    'blast-radius:Impact analysis'
    'watch:Watch for changes'
    'status:Check status'
    'update:Update PGC'
    'guide:Documentation browser'
    'migrate:Migration commands'
    'completion:Manage shell completion'
  )

  local -a global_opts
  global_opts=(
    '--no-color[Disable colored output]'
    '--no-emoji[Disable emoji output]'
    '--format[Output format]:format:(auto table json plain)'
    {-v,--verbose}'[Verbose output]'
    {-q,--quiet}'[Quiet mode]'
    {-h,--help}'[Show help]'
  )

  _arguments -C \
    $global_opts \
    '1: :->command' \
    '*:: :->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        overlay)
          _arguments \
            '1:subcommand:(generate list)' \
            '2:type:(structural_patterns security_guidelines lineage_patterns mission_concepts operational_patterns mathematical_proofs strategic_coherence all)'
          ;;
        security)
          _arguments '1:subcommand:(mandate attacks coverage-gaps boundaries list cves query coherence)'
          ;;
        workflow)
          _arguments '1:subcommand:(patterns quests depth-rules)'
          ;;
        proofs)
          _arguments '1:subcommand:(theorems lemmas list aligned)'
          ;;
        patterns)
          _arguments '1:subcommand:(find-similar compare analyze inspect)'
          ;;
        concepts)
          _arguments '1:subcommand:(list search align)'
          ;;
        coherence)
          _arguments '1:subcommand:(check score)'
          ;;
        completion)
          _arguments \
            '1:subcommand:(install uninstall)' \
            '--shell[Shell type]:shell:(bash zsh fish)'
          ;;
      esac
      ;;
  esac
}

_cognition_cli "$@"
`;
}

/**
 * Generate fish completion script
 */
function generateFishCompletion(): string {
  return `# Cognition CLI fish completion

# Main commands
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "init" -d "Initialize PGC (alias: i)"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "i" -d "Alias for init"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "genesis" -d "Build skeleton (alias: g)"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "g" -d "Alias for genesis"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "query" -d "Query codebase (alias: q)"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "q" -d "Alias for query"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "wizard" -d "Setup wizard (alias: w)"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "w" -d "Alias for wizard"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "tui" -d "Launch TUI"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "ask" -d "Ask questions"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "lattice" -d "Boolean algebra (alias: l)"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "l" -d "Alias for lattice"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "overlay" -d "Overlay operations"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "security" -d "Security analysis"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "workflow" -d "Workflow analysis"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "proofs" -d "Proof analysis"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "completion" -d "Shell completion"

# Global flags
complete -c cognition-cli -l no-color -d "Disable colored output"
complete -c cognition-cli -l no-emoji -d "Disable emoji output"
complete -c cognition-cli -l format -xa "auto table json plain" -d "Output format"
complete -c cognition-cli -s v -l verbose -d "Verbose output"
complete -c cognition-cli -s q -l quiet -d "Quiet mode"
complete -c cognition-cli -s h -l help -d "Show help"

# Overlay subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from overlay" -a "generate" -d "Generate overlay"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from overlay" -a "list" -d "List overlays"

# Overlay types
complete -c cognition-cli -f -n "__fish_seen_subcommand_from generate; and __fish_seen_subcommand_from overlay" -a "structural_patterns" -d "Structural patterns (O1)"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from generate; and __fish_seen_subcommand_from overlay" -a "security_guidelines" -d "Security guidelines (O2)"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from generate; and __fish_seen_subcommand_from overlay" -a "lineage_patterns" -d "Lineage patterns (O3)"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from generate; and __fish_seen_subcommand_from overlay" -a "mission_concepts" -d "Mission concepts (O4)"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from generate; and __fish_seen_subcommand_from overlay" -a "operational_patterns" -d "Operational patterns (O5)"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from generate; and __fish_seen_subcommand_from overlay" -a "mathematical_proofs" -d "Mathematical proofs (O6)"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from generate; and __fish_seen_subcommand_from overlay" -a "strategic_coherence" -d "Strategic coherence (O7)"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from generate; and __fish_seen_subcommand_from overlay" -a "all" -d "All overlays"

# Security subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from security" -a "mandate attacks coverage-gaps boundaries list cves query coherence"

# Workflow subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from workflow" -a "patterns quests depth-rules"

# Proofs subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from proofs" -a "theorems lemmas list aligned"

# Completion subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from completion" -a "install uninstall"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from completion; and __fish_seen_subcommand_from install uninstall" -l shell -xa "bash zsh fish"
`;
}

/**
 * Handle completion request from shell (internal)
 */
function handleCompletion(): void {
  // This would be called by the shell to get completion suggestions
  // For now, we rely on the static completion scripts
  // A dynamic implementation could query the actual command structure
  process.exit(0);
}
