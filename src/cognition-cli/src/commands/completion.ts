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
        const result = await installCompletion(shell);
        console.log(`✓ Shell completion installed for ${shell}`);
        console.log('\nRestart your shell or run:');

        if (shell === 'bash') {
          console.log('  source ~/.bashrc');
        } else if (shell === 'zsh') {
          if (result?.isOhMyZsh) {
            console.log('  exec zsh');
            console.log('\nNote: Installed to oh-my-zsh completions directory');
          } else {
            console.log('  source ~/.zshrc');
          }
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
async function installCompletion(
  shell: string
): Promise<{ isOhMyZsh?: boolean }> {
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  const homeDir = os.homedir();
  const completionScript = generateCompletionScript(shell);

  let installPath: string;
  let rcFile: string;
  let isOhMyZsh = false;

  if (shell === 'bash') {
    installPath = path.join(homeDir, '.cognition-completion.bash');
    rcFile = path.join(homeDir, '.bashrc');
  } else if (shell === 'zsh') {
    // Check if oh-my-zsh is installed
    const ohmyzshPath = path.join(homeDir, '.oh-my-zsh');
    const ohmyzshExists = await fs.promises
      .access(ohmyzshPath)
      .then(() => true)
      .catch(() => false);

    if (ohmyzshExists) {
      // Install to oh-my-zsh completions directory
      const completionsDir = path.join(ohmyzshPath, 'completions');
      await fs.promises.mkdir(completionsDir, { recursive: true });
      installPath = path.join(completionsDir, '_cognition-cli');
      rcFile = ''; // oh-my-zsh handles loading automatically
      isOhMyZsh = true;
    } else {
      // Install to standard zsh completions directory
      const zshCompletionsDir = path.join(homeDir, '.zsh', 'completions');
      await fs.promises.mkdir(zshCompletionsDir, { recursive: true });
      installPath = path.join(zshCompletionsDir, '_cognition-cli');
      rcFile = path.join(homeDir, '.zshrc');
    }
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

  // Add fpath and compinit for zsh (non-oh-my-zsh), or source line for bash
  if (rcFile) {
    const rcContent = await fs.promises
      .readFile(rcFile, 'utf8')
      .catch(() => '');

    let setupLine: string;
    if (shell === 'zsh') {
      // For zsh without oh-my-zsh, add to fpath and trigger compinit
      const completionsDir = path.dirname(installPath);
      setupLine = `\n# Cognition CLI completion\nfpath=(${completionsDir} $fpath)\nautoload -Uz compinit && compinit\n`;
    } else {
      // For bash, source the completion script
      setupLine = `\n# Cognition CLI completion\nsource "${installPath}"\n`;
    }

    if (
      !rcContent.includes(installPath) &&
      !rcContent.includes('Cognition CLI completion')
    ) {
      await fs.promises.appendFile(rcFile, setupLine, 'utf8');
    }
  }

  return { isOhMyZsh };
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
    // Check if oh-my-zsh is installed
    const ohmyzshPath = path.join(homeDir, '.oh-my-zsh');
    const ohmyzshExists = await fs.promises
      .access(ohmyzshPath)
      .then(() => true)
      .catch(() => false);

    if (ohmyzshExists) {
      installPath = path.join(ohmyzshPath, 'completions', '_cognition-cli');
      rcFile = ''; // oh-my-zsh handles loading automatically
    } else {
      installPath = path.join(homeDir, '.zsh', 'completions', '_cognition-cli');
      rcFile = path.join(homeDir, '.zshrc');
    }
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
  local commands="init i genesis g genesis:docs query q audit:transformations audit:docs wizard w tui ask pr-analyze lattice l audit overlay patterns concepts coherence security workflow proofs blast-radius watch status update guide migrate migrate:lance completion --help --version"

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
    tui)
      # After tui command, suggest flags
      COMPREPLY=( $(compgen -W "-p --project-root --session-id -f --file -w --workbench --session-tokens --max-thinking-tokens --debug -h --help" -- \${cur}) )
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
      COMPREPLY=( $(compgen -W "mandate attacks coverage-gaps boundaries list cves query coherence blast-radius" -- \${cur}) )
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
      COMPREPLY=( $(compgen -W "find-similar compare analyze inspect list graph" -- \${cur}) )
      return 0
      ;;
    concepts)
      COMPREPLY=( $(compgen -W "list search by-section inspect top" -- \${cur}) )
      return 0
      ;;
    coherence)
      COMPREPLY=( $(compgen -W "report aligned drifted list" -- \${cur}) )
      return 0
      ;;
    audit)
      COMPREPLY=( $(compgen -W "transformations docs" -- \${cur}) )
      return 0
      ;;
    genesis)
      # Suggest genesis:docs subcommand
      if [[ "\${cur}" == *":"* ]]; then
        COMPREPLY=( $(compgen -W "docs" -- \${cur#*:}) )
      fi
      return 0
      ;;
    migrate)
      COMPREPLY=( $(compgen -W "lance" -- \${cur}) )
      return 0
      ;;
    completion)
      COMPREPLY=( $(compgen -W "install uninstall" -- \${cur}) )
      return 0
      ;;
    -p|--project-root|-w|--workbench|--path)
      # Directory completion
      COMPREPLY=( $(compgen -d -- \${cur}) )
      return 0
      ;;
    -f|--file)
      # File completion for .json files
      COMPREPLY=( $(compgen -f -X '!*.json' -- \${cur}) )
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
    'genesis:docs:Generate documentation from genesis'
    'g:Alias for genesis'
    'query:Query the codebase (alias: q)'
    'q:Alias for query'
    'audit:transformations:Audit transformation history'
    'audit:docs:Audit documentation'
    'wizard:Interactive setup wizard (alias: w)'
    'w:Alias for wizard'
    'tui:Launch interactive TUI'
    'ask:Ask questions about docs'
    'pr-analyze:Comprehensive PR impact analysis (O1+O2+O3+O4+O7)'
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
    'migrate:lance:Migrate to LanceDB'
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
        tui)
          _arguments \
            {-p,--project-root}'[Project root directory]:directory:_directories' \
            '--session-id[Session ID to resume]:session-id:' \
            {-f,--file}'[Path to session state file]:state-file:_files -g "*.json"' \
            {-w,--workbench}'[Workbench URL]:url:' \
            '--session-tokens[Token threshold]:number:' \
            '--max-thinking-tokens[Max thinking tokens]:number:' \
            '--debug[Enable debug logging]' \
            {-h,--help}'[Show help]'
          ;;
        overlay)
          _arguments \
            '1:subcommand:(generate list)' \
            '2:type:(structural_patterns security_guidelines lineage_patterns mission_concepts operational_patterns mathematical_proofs strategic_coherence all)'
          ;;
        security)
          _arguments '1:subcommand:(mandate attacks coverage-gaps boundaries list cves query coherence blast-radius)'
          ;;
        workflow)
          _arguments '1:subcommand:(patterns quests depth-rules)'
          ;;
        proofs)
          _arguments '1:subcommand:(theorems lemmas list aligned)'
          ;;
        patterns)
          _arguments '1:subcommand:(find-similar compare analyze inspect list graph)'
          ;;
        concepts)
          _arguments '1:subcommand:(list search by-section inspect top)'
          ;;
        coherence)
          _arguments '1:subcommand:(report aligned drifted list)'
          ;;
        audit)
          _arguments '1:subcommand:(transformations docs)'
          ;;
        migrate)
          _arguments '1:subcommand:(lance)'
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
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "genesis:docs" -d "Generate documentation"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "g" -d "Alias for genesis"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "query" -d "Query codebase (alias: q)"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "q" -d "Alias for query"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "audit:transformations" -d "Audit transformations"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "audit:docs" -d "Audit documentation"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "wizard" -d "Setup wizard (alias: w)"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "w" -d "Alias for wizard"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "tui" -d "Launch TUI"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "ask" -d "Ask questions"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "pr-analyze" -d "PR impact analysis (O1+O2+O3+O4+O7)"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "lattice" -d "Boolean algebra (alias: l)"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "l" -d "Alias for lattice"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "overlay" -d "Overlay operations"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "audit" -d "Audit operations"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "security" -d "Security analysis"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "workflow" -d "Workflow analysis"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "proofs" -d "Proof analysis"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "migrate" -d "Migration operations"
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "migrate:lance" -d "Migrate to LanceDB"
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

# Audit subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from audit" -a "transformations docs"

# Migrate subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from migrate" -a "lance"

# Security subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from security" -a "mandate attacks coverage-gaps boundaries list cves query coherence blast-radius"

# Workflow subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from workflow" -a "patterns quests depth-rules"

# Patterns subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from patterns" -a "find-similar compare analyze inspect list graph"

# Concepts subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from concepts" -a "list search by-section inspect top"

# Coherence subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from coherence" -a "report aligned drifted list"

# Proofs subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from proofs" -a "theorems lemmas list aligned"

# TUI options
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -s p -l project-root -d "Project root directory" -xa "(__fish_complete_directories)"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -l session-id -d "Session ID to resume"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -s f -l file -d "Path to session state file" -xa "(ls *.json 2>/dev/null)"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -s w -l workbench -d "Workbench URL"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -l session-tokens -d "Token threshold"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -l max-thinking-tokens -d "Max thinking tokens"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -l debug -d "Enable debug logging"

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
