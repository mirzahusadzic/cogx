import chalk from 'chalk';
import { execa } from 'execa';
import { intro, outro } from '@clack/prompts';
import { PGCManager } from '../core/pgc/manager.js';
import { IntentResolver } from '../core/lineage/intent-resolver.js';
import { EGemmaClient } from '../core/lineage/egemma-client.js';
import { WorkbenchClient } from '../core/executors/workbench-client.js';
import { RehydrateService } from '../core/services/lineage/rehydrate.js';

interface RehydrateOptions {
  depth?: number;
  since?: string;
  resume?: boolean;
  synthesize?: boolean;
  projectRoot: string;
}

export async function lineageRehydrateCommand(
  options: RehydrateOptions
): Promise<void> {
  const {
    projectRoot,
    depth,
    since,
    resume = false,
    synthesize = false,
  } = options;

  intro(chalk.bold('🔁 Rehydrating PGC from git history...'));

  // Verify this is a git repo
  try {
    await execa('git', ['rev-parse', '--git-dir'], { cwd: projectRoot });
  } catch {
    console.error(
      chalk.red(
        'Error: Not a git repository. Please run from within a git project.'
      )
    );
    process.exit(1);
  }

  const pgc = new PGCManager(projectRoot);

  let intentResolver: IntentResolver | undefined;
  if (synthesize) {
    const workbench = new WorkbenchClient(
      process.env.WORKBENCH_URL || 'http://localhost:8000'
    );
    const egemma = new EGemmaClient(workbench);
    intentResolver = new IntentResolver(pgc.intentAdapter, egemma, true);
  }

  const service = new RehydrateService(pgc);

  const result = await service.rehydrate({
    depth,
    since,
    resume,
    intentResolver,
    onCommitProcessed: (commit) => {
      console.log(
        chalk.gray(
          `  ✓ ${commit.hash.slice(0, 8)} ${commit.subject.slice(0, 60)}`
        )
      );
    },
  });

  if (result.recordedCount === 0 && result.skippedCount === 0) {
    console.log(chalk.yellow('No commits to process.'));
  } else {
    console.log(
      chalk.green(
        `\n✓ Rehydration complete: ${result.recordedCount} transforms recorded, ${result.skippedCount} commits skipped (already covered)`
      )
    );
  }

  outro(chalk.bold('Rehydration complete.'));
}
