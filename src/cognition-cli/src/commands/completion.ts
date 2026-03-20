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
import { cliCommands, globalFlags } from './completion-metadata.js';
import { BashCompletionGenerator } from '../core/utils/bash-completion.js';
import { ZshCompletionGenerator } from '../core/utils/zsh-completion.js';
import { FishCompletionGenerator } from '../core/utils/fish-completion.js';
import { environmentService } from '../core/services/environment/EnvironmentService.js';

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
  const homeDir = environmentService.getHomeDir();
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
  const homeDir = environmentService.getHomeDir();
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
  const generator = new BashCompletionGenerator(cliCommands, globalFlags);
  return generator.generate();
}

/**
 * Generate zsh completion script
 */
function generateZshCompletion(): string {
  const generator = new ZshCompletionGenerator(cliCommands, globalFlags);
  return generator.generate();
}

/**
 * Generate fish completion script
 */
function generateFishCompletion(): string {
  const generator = new FishCompletionGenerator(cliCommands, globalFlags);
  return generator.generate();
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
