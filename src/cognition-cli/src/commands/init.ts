import fs from 'fs-extra';
import path from 'path';
import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';

export async function initCommand(options: { path: string }) {
  intro(chalk.bold('Initializing Grounded Context Pool'));

  const s = spinner();
  s.start('Creating PGC directory structure');

  const pgcRoot = path.join(options.path, '.open_cognition');

  try {
    // Create the four pillars
    await fs.ensureDir(path.join(pgcRoot, 'objects'));
    await fs.ensureDir(path.join(pgcRoot, 'transforms'));
    await fs.ensureDir(path.join(pgcRoot, 'index'));
    await fs.ensureDir(path.join(pgcRoot, 'reverse_deps'));
    await fs.ensureDir(path.join(pgcRoot, 'overlays'));

    // Create system metadata
    const metadata = {
      version: '0.1.0',
      initialized_at: new Date().toISOString(),
      status: 'empty',
    };
    await fs.writeJSON(path.join(pgcRoot, 'metadata.json'), metadata, {
      spaces: 2,
    });

    // Create .gitignore for PGC
    await fs.writeFile(
      path.join(pgcRoot, '.gitignore'),
      '# Ignore large object store\nobjects/\n# Keep structure\n!.gitkeep\n'
    );

    s.stop('PGC initialized successfully');

    outro(
      chalk.green(
        `✓ Created ${chalk.bold('.open_cognition/')} at ${options.path}`
      )
    );
  } catch (error) {
    s.stop('Initialization failed');
    throw error;
  }
}
