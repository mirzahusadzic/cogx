import { execa } from 'execa';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'node:crypto';
import chalk from 'chalk';
import { PGCManager } from '../core/pgc/manager.js';
import { extractGitContext } from '../core/git/context-extractor.js';
import { DirtyStateManager } from '../core/watcher/dirty-state.js';
import { IntentResolver } from '../core/lineage/intent-resolver.js';
import { EGemmaClient } from '../core/lineage/egemma-client.js';
import { WorkbenchClient } from '../core/executors/workbench-client.js';

interface LineageRecordOptions {
  commit: string;
  synthesize?: boolean;
  update?: boolean;
  projectRoot: string;
}

/**
 * Records file changes from a specific git commit or range into the PGC lineage.
 *
 * This command bridges the gap between git history and PGC transformations by
 * recording a transformation for every meaningful file change in a commit.
 *
 * @param options - Recording options including commit ref and project root
 */
export async function lineageRecordCommand(options: LineageRecordOptions) {
  const { projectRoot, commit, synthesize } = options;
  const pgc = new PGCManager(projectRoot);
  const pgcRoot = path.join(projectRoot, '.open_cognition');
  const dirtyState = new DirtyStateManager(pgcRoot);

  const workbench = new WorkbenchClient(
    process.env.WORKBENCH_URL || 'http://localhost:8000'
  );
  const egemma = new EGemmaClient(workbench);
  const intentResolver = new IntentResolver(
    pgc.intentAdapter,
    egemma,
    synthesize
  );

  try {
    console.log(chalk.bold(`📜 Recording lineage for commit: ${commit}`));

    // 1. Get changed files using git diff-tree or git diff
    let changedFiles: string[] = [];
    if (commit.includes('..')) {
      const { stdout } = await execa('git', ['diff', '--name-only', commit], {
        cwd: projectRoot,
      });
      changedFiles = stdout.split('\n').filter(Boolean);
    } else {
      const { stdout } = await execa(
        'git',
        ['diff-tree', '--no-commit-id', '-r', '--name-only', commit],
        { cwd: projectRoot }
      );
      changedFiles = stdout.split('\n').filter(Boolean);
    }

    if (changedFiles.length === 0) {
      console.log(
        chalk.yellow('No changes found for the specified commit/range.')
      );
      return;
    }

    console.log(chalk.gray(`Found ${changedFiles.length} changed files.`));

    for (const relativePath of changedFiles) {
      const filePath = path.join(projectRoot, relativePath);

      if (
        !(await fs.pathExists(filePath)) ||
        (await fs.stat(filePath)).isDirectory()
      ) {
        continue;
      }

      // a. Read new content and compute hash
      const content = await fs.readFile(filePath);
      const newHash = crypto.createHash('sha256').update(content).digest('hex');

      // b. Check if PGC already has this hash (skip if unchanged from PGC perspective)
      const indexEntry = await pgc.index.get(relativePath);
      if (indexEntry && indexEntry.content_hash === newHash) {
        console.log(
          chalk.gray(`- ${relativePath}: Already up to date in PGC. Skipping.`)
        );
        continue;
      }

      const oldHash = indexEntry ? indexEntry.content_hash : '0'.repeat(64);

      // c. Extract git context
      const gitContext = await extractGitContext(filePath, projectRoot);

      // d. Get diff for synthesis if needed
      let diff: string | null = null;
      if (synthesize && gitContext?.commit_hash) {
        try {
          // We want the diff of that commit for that file.
          const { stdout: diffStdout } = await execa(
            'git',
            ['show', gitContext.commit_hash, '--', relativePath],
            { cwd: projectRoot }
          );
          diff = diffStdout;
        } catch {
          // Fallback to git diff if git show fails
        }
      }

      // e. Resolve intent
      const resolved = await intentResolver.resolve(
        relativePath,
        gitContext?.message || null,
        diff,
        gitContext
      );

      // f. Record transform
      const transformId = await pgc.recordTransform({
        goal: {
          objective: 'Record file change from git history',
          criteria: ['File hash matches commit state'],
          phimin: 0.1,
        },
        timestamp: new Date().toISOString(),
        method: 'git-lineage-record',
        inputs: [{ path: relativePath, hash: oldHash }],
        outputs: [{ path: relativePath, hash: newHash }],
        git: gitContext || undefined,
        reasoning: {
          intent: resolved.intent,
          decision: resolved.decision,
          alternatives: resolved.alternatives,
          confidence: resolved.confidence,
        },
        source: resolved.source || {
          type: 'automated',
          identifier: 'lineage-record',
        },
      });

      // g. Update dirty state
      await dirtyState.addDirty({
        path: relativePath,
        tracked_hash: oldHash,
        current_hash: newHash,
        detected_at: new Date().toISOString(),
        change_type: 'modified',
      });

      console.log(
        chalk.green(
          `✓ Recorded ${relativePath} (transform: ${transformId.slice(0, 8)}, confidence: ${resolved.confidence.toFixed(2)})`
        )
      );
    }

    // 4. Optionally trigger update
    if (options.update) {
      console.log(chalk.bold('\n🚀 Triggering incremental update...'));
      const { runUpdate } = await import('./update.js');
      await runUpdate({
        projectRoot,
        workbench: process.env.WORKBENCH_URL || 'http://localhost:8000',
      });
    }
  } catch (error) {
    console.error(
      chalk.red(
        `Error recording lineage: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}
