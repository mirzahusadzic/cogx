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
import { getHomeDir } from '../utils/home-dir.js';

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
  const homeDir = getHomeDir();
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

    // Only append if the source command is not already present
    const sourceCommand = `source "${installPath}"`;
    const fpathCommand = `fpath=(${path.dirname(installPath)} $fpath)`;

    if (shell === 'bash' && !rcContent.includes(sourceCommand)) {
      await fs.promises.appendFile(rcFile, setupLine, 'utf8');
    } else if (shell === 'zsh' && !rcContent.includes(fpathCommand)) {
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
  const homeDir = getHomeDir();
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

  // Remove source line and comment from rc file
  if (rcFile) {
    const rcContent = await fs.promises
      .readFile(rcFile, 'utf8')
      .catch(() => '');
    const lines = rcContent.split('\n').filter((line) => {
      // Remove lines that source the completion script (handles both $HOME and full path)
      if (line.includes('cognition-completion')) return false;
      // Remove the comment line
      if (line.trim() === '# Cognition CLI completion') return false;
      // Remove fpath lines for zsh
      if (
        shell === 'zsh' &&
        line.includes('fpath=') &&
        line.includes('cognition')
      )
        return false;
      if (shell === 'zsh' && line.includes('autoload -Uz compinit'))
        return false;
      return true;
    });
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
  local cur prev cmd_with_colon
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  # Handle colon-separated commands (genesis:docs, audit:transformations, etc.)
  # Bash treats colons as word separators, so we need to reconstruct the full command
  if [[ \${COMP_CWORD} -ge 2 ]] && [[ "\${COMP_WORDS[COMP_CWORD-2]}" =~ ^(genesis|audit|migrate)$ ]] && [[ "\${COMP_WORDS[COMP_CWORD-1]}" == ":" ]]; then
    # We're right after the colon, suggest the subcommand part
    local base_cmd="\${COMP_WORDS[COMP_CWORD-2]}"
    case "\${base_cmd}" in
      genesis)
        COMPREPLY=( $(compgen -W "docs" -- \${cur}) )
        return 0
        ;;
      audit)
        COMPREPLY=( $(compgen -W "transformations docs" -- \${cur}) )
        return 0
        ;;
      migrate)
        COMPREPLY=( $(compgen -W "lance" -- \${cur}) )
        return 0
        ;;
    esac
  fi

  # Reconstruct colon-separated command for completion matching
  if [[ \${COMP_CWORD} -ge 3 ]] && [[ "\${COMP_WORDS[COMP_CWORD-2]}" == ":" ]]; then
    cmd_with_colon="\${COMP_WORDS[COMP_CWORD-3]}:\${COMP_WORDS[COMP_CWORD-1]}"
  else
    cmd_with_colon="\${prev}"
  fi

  # Main commands
  local commands="init i genesis g genesis:docs query q audit:transformations audit:docs wizard w tui ask pr-analyze lattice l audit overlay patterns concepts coherence security workflow proofs blast-radius watch status update guide migrate migrate:lance completion config --help --version"

  # Global flags
  local global_flags="--no-color --no-emoji --format --json --verbose -v --quiet -q --no-input --debug -d --help -h"

  # If completing first word, suggest main commands
  if [ \${COMP_CWORD} -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- \${cur}) )
    return 0
  fi

  # Context-aware completion based on previous word (or reconstructed colon command)
  case "\${cmd_with_colon}" in
    --format)
      COMPREPLY=( $(compgen -W "auto table json plain" -- \${cur}) )
      return 0
      ;;
    --shell)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- \${cur}) )
      return 0
      ;;
    tui)
      # After tui command, suggest subcommands and flags
      COMPREPLY=( $(compgen -W "provider -p --project-root --session-id -f --file -w --workbench --session-tokens --max-thinking-tokens --provider --model --no-show-thinking --no-onboarding --no-auto-response --debug -h --help" -- \${cur}) )
      return 0
      ;;
    --provider)
      # Suggest provider names
      COMPREPLY=( $(compgen -W "claude gemini openai" -- \${cur}) )
      return 0
      ;;
    --model)
      # Suggest model names (provider-specific)
      COMPREPLY=( $(compgen -W "claude-opus-4-5-20251101 claude-sonnet-4-5-20250929 gemini-3-flash-preview gemini-3-pro-preview gpt-oss-20b" -- \${cur}) )
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
    aligned)
      # proofs aligned options
      if [[ "\${COMP_WORDS[1]}" == "proofs" ]]; then
        COMPREPLY=( $(compgen -W "-p --project-root -f --format -l --limit -t --threshold -v --verbose --json table json summary" -- \${cur}) )
        return 0
      fi
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
    migrate)
      COMPREPLY=( $(compgen -W "lance" -- \${cur}) )
      return 0
      ;;
    completion)
      COMPREPLY=( $(compgen -W "install uninstall" -- \${cur}) )
      return 0
      ;;
    config)
      COMPREPLY=( $(compgen -W "list get set path" -- \${cur}) )
      return 0
      ;;
    provider)
      # tui provider subcommand
      if [[ "\${COMP_WORDS[1]}" == "tui" ]]; then
        COMPREPLY=( $(compgen -W "list test set-default config models" -- \${cur}) )
        return 0
      fi
      ;;
    test|set-default)
      # After test or set-default, suggest provider names
      if [[ "\${COMP_WORDS[1]}" == "tui" ]] && [[ "\${COMP_WORDS[2]}" == "provider" ]]; then
        COMPREPLY=( $(compgen -W "claude gemini openai" -- \${cur}) )
        return 0
      fi
      ;;
    models)
      # After models, optionally suggest provider names
      if [[ "\${COMP_WORDS[1]}" == "tui" ]] && [[ "\${COMP_WORDS[2]}" == "provider" ]]; then
        COMPREPLY=( $(compgen -W "claude gemini openai" -- \${cur}) )
        return 0
      fi
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
    genesis:docs)
      # File/directory completion for markdown files and directories
      COMPREPLY=( $(compgen -f -X '!*.md' -- \${cur}) )
      if [ \${#COMPREPLY[@]} -eq 0 ]; then
        # If no .md files found, suggest directories
        COMPREPLY=( $(compgen -d -- \${cur}) )
      fi
      return 0
      ;;
  esac

  # Command-specific flag completion (when typing -- after command)
  local main_cmd="\${COMP_WORDS[1]}"
  if [[ "\${cur}" == -* ]]; then
    case "\${main_cmd}" in
      tui)
        local tui_flags="-p --project-root --session-id -f --file -w --workbench --session-tokens --max-thinking-tokens --provider --model --no-show-thinking --no-onboarding --no-auto-response --debug -h --help"
        COMPREPLY=( $(compgen -W "\${tui_flags}" -- \${cur}) )
        return 0
        ;;
      genesis|g)
        local genesis_flags="-w --workbench -p --project-root -n --dry-run -r --resume --json -h --help"
        COMPREPLY=( $(compgen -W "\${genesis_flags}" -- \${cur}) )
        return 0
        ;;
      init|i)
        local init_flags="-p --project-root -n --dry-run -f --force -h --help"
        COMPREPLY=( $(compgen -W "\${init_flags}" -- \${cur}) )
        return 0
        ;;
      query|q)
        local query_flags="-p --project-root -d --depth --lineage --json -h --help"
        COMPREPLY=( $(compgen -W "\${query_flags}" -- \${cur}) )
        return 0
        ;;
      ask)
        local ask_flags="-p --project-root -w --workbench --top-k --save --verbose --json -h --help"
        COMPREPLY=( $(compgen -W "\${ask_flags}" -- \${cur}) )
        return 0
        ;;
      lattice|l)
        local lattice_flags="-p --project-root -f --format -l --limit -v --verbose --json -h --help"
        COMPREPLY=( $(compgen -W "\${lattice_flags}" -- \${cur}) )
        return 0
        ;;
      blast-radius)
        local br_flags="-p --project-root --max-depth --json -h --help"
        COMPREPLY=( $(compgen -W "\${br_flags}" -- \${cur}) )
        return 0
        ;;
      security)
        local security_flags="-p --project-root -f --format -l --limit -v --verbose --json -h --help"
        COMPREPLY=( $(compgen -W "\${security_flags}" -- \${cur}) )
        return 0
        ;;
      workflow)
        local workflow_flags="-p --project-root -f --format -l --limit -v --verbose --secure --aligned --json -h --help"
        COMPREPLY=( $(compgen -W "\${workflow_flags}" -- \${cur}) )
        return 0
        ;;
      proofs)
        local proofs_flags="-p --project-root -f --format -l --limit -v --verbose --json -h --help"
        COMPREPLY=( $(compgen -W "\${proofs_flags}" -- \${cur}) )
        return 0
        ;;
      pr-analyze)
        local pr_flags="--branch --max-depth --json -h --help"
        COMPREPLY=( $(compgen -W "\${pr_flags}" -- \${cur}) )
        return 0
        ;;
      watch)
        local watch_flags="-p --project-root --debounce -h --help"
        COMPREPLY=( $(compgen -W "\${watch_flags}" -- \${cur}) )
        return 0
        ;;
      status)
        local status_flags="-p --project-root -v --verbose --json -h --help"
        COMPREPLY=( $(compgen -W "\${status_flags}" -- \${cur}) )
        return 0
        ;;
      overlay)
        local overlay_flags="-h --help --json"
        COMPREPLY=( $(compgen -W "\${overlay_flags}" -- \${cur}) )
        return 0
        ;;
      patterns)
        local patterns_flags="-p --project-root --json -h --help"
        COMPREPLY=( $(compgen -W "\${patterns_flags}" -- \${cur}) )
        return 0
        ;;
      concepts)
        local concepts_flags="-p --project-root --json --limit -h --help"
        COMPREPLY=( $(compgen -W "\${concepts_flags}" -- \${cur}) )
        return 0
        ;;
      coherence)
        local coherence_flags="-p --project-root --json -v --verbose -h --help"
        COMPREPLY=( $(compgen -W "\${coherence_flags}" -- \${cur}) )
        return 0
        ;;
      config)
        local config_flags="--json -h --help"
        COMPREPLY=( $(compgen -W "\${config_flags}" -- \${cur}) )
        return 0
        ;;
      completion)
        local completion_flags="--shell -h --help"
        COMPREPLY=( $(compgen -W "\${completion_flags}" -- \${cur}) )
        return 0
        ;;
    esac
  fi

  # Default: suggest global flags
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
    'config:View and manage CLI settings'
  )

  local -a global_opts
  global_opts=(
    '--no-color[Disable colored output]'
    '--no-emoji[Disable emoji output]'
    '--format[Output format]:format:(auto table json plain)'
    '--json[Shorthand for --format json]'
    {-v,--verbose}'[Verbose output]'
    {-q,--quiet}'[Quiet mode]'
    '--no-input[Disable interactive prompts]'
    {-d,--debug}'[Enable debug logging]'
    {-h,--help}'[Show help]'
  )

  _arguments -C \
    $global_opts \
    '1: :->command' \
    '*:: :->args'

  case ${'$'}state in
    command)
      # Handle colon-separated commands like genesis:docs
      if compset -P '*:'; then
        case "${'$'}{IPREFIX%:}" in
          genesis|g)
            local -a genesis_cmds
            genesis_cmds=('docs:Generate documentation')
            _describe 'genesis subcommand' genesis_cmds
            ;;
          audit)
            local -a audit_cmds
            audit_cmds=('transformations:Audit transformations' 'docs:Audit documentation')
            _describe 'audit subcommand' audit_cmds
            ;;
          migrate)
            local -a migrate_cmds
            migrate_cmds=('lance:Migrate to LanceDB')
            _describe 'migrate subcommand' migrate_cmds
            ;;
        esac
      else
        _describe 'command' commands
      fi
      ;;
    args)
      case $words[1] in
        tui)
          _arguments -C \
            {-p,--project-root}'[Project root directory]:directory:_directories' \
            '--session-id[Session ID to resume]:session-id:' \
            {-f,--file}'[Path to session state file]:state-file:_files -g "*.json"' \
            {-w,--workbench}'[Workbench URL]:url:' \
            '--session-tokens[Token threshold]:number:' \
            '--max-thinking-tokens[Max thinking tokens]:number:' \
            '--provider[LLM provider]:provider:(claude gemini openai)' \
            '--model[Model to use]:model:(claude-opus-4-5-20251101 claude-sonnet-4-5-20250929 gemini-3-flash-preview gemini-3-pro-preview gpt-oss-20b)' \
            '--no-show-thinking[Hide thinking blocks in TUI]' \
            '--no-onboarding[Skip onboarding wizard]' \
            '--no-auto-response[Disable automatic response to agent messages]' \
            '--debug[Enable debug logging]' \
            {-h,--help}'[Show help]' \
            '1: :->tui_subcommand' \
            '*:: :->tui_args'

          case $state in
            tui_subcommand)
              local -a tui_subcommands
              tui_subcommands=('provider:Manage LLM providers')
              _describe 'tui subcommand' tui_subcommands
              ;;
            tui_args)
              case $words[1] in
                provider)
                  _arguments \
                    '1:provider-subcommand:(list test set-default config models)' \
                    '2:provider-name:(claude gemini openai)'
                  ;;
              esac
              ;;
          esac
          ;;
        ask)
          _arguments -C \
            {-p,--project-root}'[Project root directory]:directory:_directories' \
            {-w,--workbench}'[Workbench URL]:url:' \
            '--top-k[Number of results]:number:' \
            '--save[Save as markdown]' \
            {-v,--verbose}'[Verbose output]' \
            '--json[Output as JSON]' \
            {-h,--help}'[Show help]'
          ;;
        query|q)
          _arguments -C \
            {-p,--project-root}'[Project root directory]:directory:_directories' \
            {-d,--depth}'[Traversal depth]:number:' \
            '--lineage[Output dependency lineage]' \
            '--json[Output results as JSON]' \
            {-h,--help}'[Show help]'
          ;;
        lattice|l)
          _arguments -C \
            {-p,--project-root}'[Project root directory]:directory:_directories' \
            {-f,--format}'[Output format]:format:(table json summary)' \
            {-l,--limit}'[Maximum results]:number:' \
            {-v,--verbose}'[Detailed processing]' \
            '--json[Shorthand for JSON format]' \
            {-h,--help}'[Show help]'
          ;;
        blast-radius)
          _arguments -C \
            '--max-depth[Maximum traversal depth]:number:' \
            '--json[Output as JSON]' \
            {-h,--help}'[Show help]'
          ;;
        pr-analyze)
          _arguments -C \
            '--branch[Branch to analyze]:branch:' \
            '--max-depth[Maximum blast radius depth]:number:' \
            '--json[Output as JSON]' \
            {-h,--help}'[Show help]'
          ;;
        status)
          _arguments -C \
            {-p,--project-root}'[Project root directory]:directory:_directories' \
            {-v,--verbose}'[Show detailed blast radius info]' \
            '--json[Output as JSON]' \
            {-h,--help}'[Show help]'
          ;;
        overlay)
          _arguments \
            '--json[Output as JSON]' \
            '1:subcommand:(generate list)' \
            '2:type:(structural_patterns security_guidelines lineage_patterns mission_concepts operational_patterns mathematical_proofs strategic_coherence all)'
          ;;
        patterns)
          _arguments \
            '--json[Output as JSON]' \
            '1:subcommand:(find-similar compare analyze inspect list graph)'
          ;;
        concepts)
          _arguments \
            '--json[Output raw JSON]' \
            '--limit[Limit number of concepts to show]:number:' \
            '1:subcommand:(list search by-section inspect top)'
          ;;
        coherence)
          _arguments \
            '--json[Output raw JSON]' \
            {-v,--verbose}'[Show detailed error messages]' \
            '1:subcommand:(report aligned drifted list)'
          ;;
        config)
          _arguments \
            '--json[Output results as JSON]' \
            '1:subcommand:(list get set path)'
          ;;
        security)
          _arguments \
            {-p,--project-root}'[Project root directory]:directory:_directories' \
            {-f,--format}'[Output format]:format:(table json summary)' \
            {-l,--limit}'[Maximum results]:number:' \
            {-v,--verbose}'[Detailed output]' \
            '--json[Output as JSON]' \
            {-h,--help}'[Show help]' \
            '1:subcommand:(mandate attacks coverage-gaps boundaries list cves query coherence blast-radius)'
          ;;
        workflow)
          _arguments \
            {-p,--project-root}'[Project root directory]:directory:_directories' \
            {-f,--format}'[Output format]:format:(table json summary)' \
            {-l,--limit}'[Maximum results]:number:' \
            {-v,--verbose}'[Detailed output]' \
            '--secure[Security-aligned only]' \
            '--aligned[Mission-aligned only]' \
            '--json[Output as JSON]' \
            {-h,--help}'[Show help]' \
            '1:subcommand:(patterns quests depth-rules)'
          ;;
        proofs)
          case \${words[3]} in
            aligned)
              _arguments \
                '-p[Project root directory]:directory:_directories' \
                '--project-root[Project root directory]:directory:_directories' \
                '-f[Output format]:format:(table json summary)' \
                '--format[Output format]:format:(table json summary)' \
                '-l[Maximum results]:limit:' \
                '--limit[Maximum results]:limit:' \
                '-t[Similarity threshold (0.0-1.0)]:threshold:' \
                '--threshold[Similarity threshold (0.0-1.0)]:threshold:' \
                '-v[Verbose output]' \
                '--verbose[Verbose output]' \
                '--json[Output as JSON]'
              ;;
            list)
              _arguments \
                '--type[Filter by type]:type:(theorem lemma axiom proof identity)' \
                '-f[Output format]:format:(table json summary)' \
                '--format[Output format]:format:(table json summary)' \
                '--json[Output as JSON]'
              ;;
            *)
              _arguments \
                {-p,--project-root}'[Project root directory]:directory:_directories' \
                {-f,--format}'[Output format]:format:(table json summary)' \
                {-l,--limit}'[Maximum results]:number:' \
                {-v,--verbose}'[Detailed output]' \
                '--json[Output as JSON]' \
                {-h,--help}'[Show help]' \
                '1:subcommand:(theorems lemmas list aligned)'
              ;;
          esac
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
          _arguments \
            {-p,--project-root}'[Project root directory]:directory:_directories' \
            {-l,--limit}'[Number of transformations]:number:' \
            '1:subcommand:(transformations docs)'
          ;;
        migrate)
          _arguments '1:subcommand:(lance)'
          ;;
        completion)
          _arguments \
            '1:subcommand:(install uninstall)' \
            '--shell[Shell type]:shell:(bash zsh fish)'
          ;;
        config)
          _arguments '1:subcommand:(list get set path)'
          ;;
        genesis|g)
          _arguments \
            {-w,--workbench}'[Workbench URL]:url:' \
            {-p,--project-root}'[Project root directory]:directory:_directories' \
            {-n,--dry-run}'[Preview only]' \
            {-r,--resume}'[Resume run]' \
            '--json[JSON lines output]' \
            {-h,--help}'[Show help]'
          ;;
        genesis:docs)
          _arguments \
            {-p,--project-root}'[Project root directory]:directory:_directories' \
            {-f,--force}'[Force re-ingestion]' \
            '--json[JSON lines output]' \
            '*:markdown-file-or-dir:_files -g "*.md" -g "*(-/)"'
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
complete -c cognition-cli -f -n "__fish_use_subcommand" -a "config" -d "View and manage CLI settings"

# Global flags
complete -c cognition-cli -l no-color -d "Disable colored output"
complete -c cognition-cli -l no-emoji -d "Disable emoji output"
complete -c cognition-cli -l format -xa "auto table json plain" -d "Output format"
complete -c cognition-cli -l json -d "Shorthand for --format json"
complete -c cognition-cli -s v -l verbose -d "Verbose output"
complete -c cognition-cli -s q -l quiet -d "Quiet mode"
complete -c cognition-cli -l no-input -d "Disable interactive prompts"
complete -c cognition-cli -s d -l debug -d "Enable debug logging"
complete -c cognition-cli -s h -l help -d "Show help"

# Overlay subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from overlay" -a "generate" -d "Generate overlay"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from overlay" -a "list" -d "List overlays"
complete -c cognition-cli -n "__fish_seen_subcommand_from overlay" -l json -d "Output as JSON"

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
complete -c cognition-cli -n "__fish_seen_subcommand_from audit" -s p -l project-root -d "Project root directory" -xa "(__fish_complete_directories)"
complete -c cognition-cli -n "__fish_seen_subcommand_from audit" -s l -l limit -d "Number of transformations"

# Migrate subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from migrate" -a "lance"

# Security subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from security" -a "mandate attacks coverage-gaps boundaries list cves query coherence blast-radius"
complete -c cognition-cli -n "__fish_seen_subcommand_from security" -s p -l project-root -d "Project root directory" -xa "(__fish_complete_directories)"
complete -c cognition-cli -n "__fish_seen_subcommand_from security" -s f -l format -d "Output format" -xa "table json summary"
complete -c cognition-cli -n "__fish_seen_subcommand_from security" -s l -l limit -d "Maximum results"
complete -c cognition-cli -n "__fish_seen_subcommand_from security" -s v -l verbose -d "Detailed output"
complete -c cognition-cli -n "__fish_seen_subcommand_from security" -l json -d "Output as JSON"

# Workflow subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from workflow" -a "patterns quests depth-rules"
complete -c cognition-cli -n "__fish_seen_subcommand_from workflow" -s p -l project-root -d "Project root directory" -xa "(__fish_complete_directories)"
complete -c cognition-cli -n "__fish_seen_subcommand_from workflow" -s f -l format -d "Output format" -xa "table json summary"
complete -c cognition-cli -n "__fish_seen_subcommand_from workflow" -s l -l limit -d "Maximum results"
complete -c cognition-cli -n "__fish_seen_subcommand_from workflow" -s v -l verbose -d "Detailed output"
complete -c cognition-cli -n "__fish_seen_subcommand_from workflow" -l secure -d "Security-aligned only"
complete -c cognition-cli -n "__fish_seen_subcommand_from workflow" -l aligned -d "Mission-aligned only"
complete -c cognition-cli -n "__fish_seen_subcommand_from workflow" -l json -d "Output as JSON"

# Patterns subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from patterns" -a "find-similar compare analyze inspect list graph"
complete -c cognition-cli -n "__fish_seen_subcommand_from patterns" -l json -d "Output as JSON"

# Concepts subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from concepts" -a "list search by-section inspect top"
complete -c cognition-cli -n "__fish_seen_subcommand_from concepts" -l json -d "Output raw JSON"

# Coherence subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from coherence" -a "report aligned drifted list"
complete -c cognition-cli -n "__fish_seen_subcommand_from coherence" -l json -d "Output raw JSON"

# Proofs subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from proofs" -a "theorems lemmas list aligned"
complete -c cognition-cli -n "__fish_seen_subcommand_from proofs" -s p -l project-root -d "Project root directory" -xa "(__fish_complete_directories)"
complete -c cognition-cli -n "__fish_seen_subcommand_from proofs" -s f -l format -d "Output format" -xa "table json summary"
complete -c cognition-cli -n "__fish_seen_subcommand_from proofs" -s l -l limit -d "Maximum results"
complete -c cognition-cli -n "__fish_seen_subcommand_from proofs" -s v -l verbose -d "Detailed output"
complete -c cognition-cli -n "__fish_seen_subcommand_from proofs" -l json -d "Output as JSON"

# Proofs aligned options
complete -c cognition-cli -n "__fish_seen_subcommand_from proofs; and __fish_seen_subcommand_from aligned" -s t -l threshold -d "Semantic similarity threshold (0.0-1.0)"

# Proofs list options
complete -c cognition-cli -n "__fish_seen_subcommand_from proofs; and __fish_seen_subcommand_from list" -l type -d "Filter by type" -xa "theorem lemma axiom proof identity"

# TUI options
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -s p -l project-root -d "Project root directory" -xa "(__fish_complete_directories)"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -l session-id -d "Session ID to resume"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -s f -l file -d "Path to session state file" -xa "(ls *.json 2>/dev/null)"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -s w -l workbench -d "Workbench URL"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -l session-tokens -d "Token threshold"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -l max-thinking-tokens -d "Max thinking tokens"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -l provider -d "LLM provider" -xa "claude gemini openai"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -l model -d "Model to use" -xa "claude-opus-4-5-20251101 claude-sonnet-4-5-20250929 gemini-3-flash-preview gemini-3-pro-preview gpt-oss-20b"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -l no-show-thinking -d "Hide thinking blocks"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -l no-onboarding -d "Skip onboarding wizard"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -l no-auto-response -d "Disable auto-response"
complete -c cognition-cli -n "__fish_seen_subcommand_from tui" -l debug -d "Enable debug logging"

# TUI subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from tui" -a "provider" -d "Manage LLM providers"

# TUI provider subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from tui; and __fish_seen_subcommand_from provider" -a "list" -d "List available providers"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from tui; and __fish_seen_subcommand_from provider" -a "test" -d "Test provider availability"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from tui; and __fish_seen_subcommand_from provider" -a "set-default" -d "Set default provider"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from tui; and __fish_seen_subcommand_from provider" -a "config" -d "Show configuration"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from tui; and __fish_seen_subcommand_from provider" -a "models" -d "List models"

# TUI provider names for test, set-default, and models subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from tui; and __fish_seen_subcommand_from provider; and __fish_seen_subcommand_from test set-default models" -a "claude" -d "Anthropic Claude"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from tui; and __fish_seen_subcommand_from provider; and __fish_seen_subcommand_from test set-default models" -a "gemini" -d "Google Gemini"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from tui; and __fish_seen_subcommand_from provider; and __fish_seen_subcommand_from test set-default models" -a "openai" -d "OpenAI / OpenAI-compatible"

# Ask options
complete -c cognition-cli -n "__fish_seen_subcommand_from ask" -s p -l project-root -d "Project root directory" -xa "(__fish_complete_directories)"
complete -c cognition-cli -n "__fish_seen_subcommand_from ask" -s w -l workbench -d "Workbench URL"
complete -c cognition-cli -n "__fish_seen_subcommand_from ask" -l top-k -d "Number of results"
complete -c cognition-cli -n "__fish_seen_subcommand_from ask" -l save -d "Save as markdown"
complete -c cognition-cli -n "__fish_seen_subcommand_from ask" -s v -l verbose -d "Verbose output"
complete -c cognition-cli -n "__fish_seen_subcommand_from ask" -l json -d "Output as JSON"

# Query options
complete -c cognition-cli -n "__fish_seen_subcommand_from query" -s p -l project-root -d "Project root directory" -xa "(__fish_complete_directories)"
complete -c cognition-cli -n "__fish_seen_subcommand_from query" -s d -l depth -d "Traversal depth"
complete -c cognition-cli -n "__fish_seen_subcommand_from query" -l lineage -d "Output dependency lineage"
complete -c cognition-cli -n "__fish_seen_subcommand_from query" -l json -d "Output as JSON"

# Status options
complete -c cognition-cli -n "__fish_seen_subcommand_from status" -s p -l project-root -d "Project root directory" -xa "(__fish_complete_directories)"
complete -c cognition-cli -n "__fish_seen_subcommand_from status" -s v -l verbose -d "Show detailed blast radius info"
complete -c cognition-cli -n "__fish_seen_subcommand_from status" -l json -d "Output as JSON"

# Lattice options
complete -c cognition-cli -n "__fish_seen_subcommand_from lattice" -s p -l project-root -d "Project root directory" -xa "(__fish_complete_directories)"
complete -c cognition-cli -n "__fish_seen_subcommand_from lattice" -s f -l format -d "Output format" -xa "table json summary"
complete -c cognition-cli -n "__fish_seen_subcommand_from lattice" -s l -l limit -d "Maximum results"
complete -c cognition-cli -n "__fish_seen_subcommand_from lattice" -s v -l verbose -d "Detailed processing"
complete -c cognition-cli -n "__fish_seen_subcommand_from lattice" -l json -d "Shorthand for JSON format"

# PR Impact options
complete -c cognition-cli -n "__fish_seen_subcommand_from pr-analyze" -l branch -d "Branch to analyze"
complete -c cognition-cli -n "__fish_seen_subcommand_from pr-analyze" -l max-depth -d "Maximum blast radius depth"
complete -c cognition-cli -n "__fish_seen_subcommand_from pr-analyze" -l json -d "Output as JSON"

# genesis:docs options
complete -c cognition-cli -n "__fish_seen_subcommand_from genesis:docs" -s p -l project-root -d "Project root directory" -xa "(__fish_complete_directories)"
complete -c cognition-cli -n "__fish_seen_subcommand_from genesis:docs" -s f -l force -d "Force re-ingestion"
complete -c cognition-cli -n "__fish_seen_subcommand_from genesis:docs" -l json -d "JSON lines output"
complete -c cognition-cli -n "__fish_seen_subcommand_from genesis:docs" -xa "(ls *.md 2>/dev/null)" -d "Markdown file"
complete -c cognition-cli -n "__fish_seen_subcommand_from genesis:docs" -xa "(__fish_complete_directories)" -d "Directory"

# Completion subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from completion" -a "install uninstall"
complete -c cognition-cli -f -n "__fish_seen_subcommand_from completion; and __fish_seen_subcommand_from install uninstall" -l shell -xa "bash zsh fish"

# Config subcommands
complete -c cognition-cli -f -n "__fish_seen_subcommand_from config" -a "list get set path"
complete -c cognition-cli -n "__fish_seen_subcommand_from config" -l json -d "Output results as JSON"
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
