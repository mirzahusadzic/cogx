import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';

interface HooksInstallOptions {
  projectRoot: string;
}

/**
 * Installs git hooks to automatically record lineage in the PGC on commit.
 *
 * This command creates an executable .git/hooks/post-commit script that calls
 * `cognition-cli lineage record --commit HEAD --synthesize`.
 *
 * @param options - Options including project root
 */
export async function hooksInstallCommand(options: HooksInstallOptions) {
  const { projectRoot } = options;
  const gitHooksDir = path.join(projectRoot, '.git', 'hooks');

  try {
    if (!(await fs.pathExists(gitHooksDir))) {
      console.error(
        chalk.red(
          'Error: .git/hooks directory not found. Not a git repository?'
        )
      );
      process.exit(1);
    }

    const postCommitHookPath = path.join(gitHooksDir, 'post-commit');

    const hookContent = `#!/bin/sh
# Cognition CLI: Automatically record transformation lineage on commit
cognition-cli lineage record --commit HEAD --synthesize --update
`;

    // Check if hook already exists
    if (await fs.pathExists(postCommitHookPath)) {
      const existingContent = await fs.readFile(postCommitHookPath, 'utf8');
      if (existingContent.includes('cognition-cli lineage record')) {
        console.log(chalk.yellow('✓ Git post-commit hook already installed.'));
        return;
      }

      // Append to existing hook if not already present
      console.log(chalk.cyan('Appending to existing post-commit hook...'));
      await fs.appendFile(postCommitHookPath, `\n${hookContent}`);
    } else {
      // Create new hook
      console.log(chalk.cyan('Creating new post-commit hook...'));
      await fs.writeFile(postCommitHookPath, hookContent, { mode: 0o755 });
    }

    console.log(chalk.bold.green('\n✓ Git hooks installed successfully!'));
    console.log(
      chalk.gray(
        'Lineage will be recorded automatically after every commit. 🦴'
      )
    );
  } catch (error) {
    console.error(
      chalk.red(
        `Error installing hooks: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}
