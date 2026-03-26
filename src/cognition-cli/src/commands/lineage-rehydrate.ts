import path from 'path';
import chalk from 'chalk';
import { execa } from 'execa';
import { intro, outro } from '@clack/prompts';
import { PGCManager } from '../core/pgc/manager.js';
import { RehydrationManifest } from '../core/pgc/rehydration-manifest.js';
import { IntentResolver } from '../core/lineage/intent-resolver.js';
import { EGemmaClient } from '../core/lineage/egemma-client.js';
import { WorkbenchClient } from '../core/executors/workbench-client.js';

export const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.md',
]);

export interface RenameEntry {
  oldPath: string;
  newPath: string;
  similarity: number;
}

export interface ParsedDiffLine {
  status: 'A' | 'M' | 'D' | 'R';
  oldPath?: string;
  newPath?: string;
  similarity?: number;
}

export interface BulkRenameGroup {
  pattern: string;
  files: RenameEntry[];
  count: number;
}

interface RehydrateOptions {
  depth?: number;
  since?: string;
  resume?: boolean;
  synthesize?: boolean;
  projectRoot: string;
}

interface CommitInfo {
  hash: string;
  author_name: string;
  author_email: string;
  timestamp: string;
  subject: string;
  body: string;
}

export function parseDiffTreeLine(line: string): ParsedDiffLine | null {
  if (!line.trim()) return null;
  const parts = line.split('\t');
  const statusField = parts[0];

  if (statusField === 'A') {
    return { status: 'A', newPath: parts[1] };
  } else if (statusField === 'M') {
    return { status: 'M', oldPath: parts[1], newPath: parts[1] };
  } else if (statusField === 'D') {
    return { status: 'D', oldPath: parts[1] };
  } else if (statusField.startsWith('R')) {
    const similarity = parseInt(statusField.slice(1), 10);
    return {
      status: 'R',
      similarity,
      oldPath: parts[1],
      newPath: parts[2],
    };
  }
  return null;
}

export function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

export function detectBulkRename(
  renames: RenameEntry[]
): BulkRenameGroup | null {
  if (renames.length < 5) return null;

  // Group renames by (dirname(old), dirname(new))
  const groups = new Map<string, RenameEntry[]>();
  for (const rename of renames) {
    const oldDir = path.dirname(rename.oldPath);
    const newDir = path.dirname(rename.newPath);
    const key = `${oldDir}\x00${newDir}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(rename);
  }

  // Find any group that reaches the threshold of 5
  for (const [key, files] of groups.entries()) {
    if (files.length >= 5) {
      const [oldDir, newDir] = key.split('\x00');
      return {
        pattern: `${oldDir}/* → ${newDir}/*`,
        files,
        count: files.length,
      };
    }
  }

  return null;
}

export function classifyCommitSize(
  fileCount: number,
  lineCount: number
): 'micro' | 'small' | 'medium' | 'large' {
  if (fileCount < 5 && lineCount < 100) return 'micro';
  if (fileCount < 15 && lineCount < 1000) return 'small';
  if (fileCount < 30 && lineCount < 5000) return 'medium';
  return 'large';
}

async function getContentHash(
  pgc: PGCManager,
  commit: string,
  filePath: string,
  isOld = false
): Promise<string> {
  const ref = isOld ? `${commit}^:${filePath}` : `${commit}:${filePath}`;
  try {
    const { stdout } = await execa('git', ['show', ref], {
      cwd: pgc.projectRoot,
    });
    return await pgc.objectStore.store(stdout);
  } catch {
    return '0'.repeat(64);
  }
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
  const pgcRoot = path.join(projectRoot, '.open_cognition');
  const manifest = new RehydrationManifest(pgcRoot);

  let intentResolver: IntentResolver | null = null;
  if (synthesize) {
    const workbench = new WorkbenchClient(
      process.env.WORKBENCH_URL || 'http://localhost:8000'
    );
    const egemma = new EGemmaClient(workbench);
    intentResolver = new IntentResolver(pgc.intentAdapter, egemma, true);
  }

  // 1. Read manifest for --resume
  let lastCommit: string | null = null;
  if (resume) {
    const existing = await manifest.read();
    lastCommit = existing?.last_rehydrated_commit ?? null;
    if (lastCommit) {
      console.log(
        chalk.gray(`Resuming from commit: ${lastCommit.slice(0, 8)}`)
      );
    } else {
      console.log(
        chalk.gray(
          'No prior rehydration manifest found — starting full rehydration.'
        )
      );
    }
  }

  // 2. Build git log command
  const gitArgs = [
    'log',
    '--reverse',
    '--format=%H%x00%an%x00%ae%x00%aI%x00%s%x00%b%x01',
  ];

  if (since) {
    gitArgs.push(`--since=${since}`);
  } else if (depth) {
    gitArgs.push(`-n`, String(depth));
  }

  if (lastCommit) {
    gitArgs.push(`${lastCommit}..HEAD`);
  }

  const { stdout: logOutput } = await execa('git', gitArgs, {
    cwd: projectRoot,
  });

  // Parse commits (records delimited by \x01)
  const commits: CommitInfo[] = logOutput
    .split('\x01')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((record) => {
      const parts = record.split('\x00');
      return {
        hash: parts[0]?.trim() ?? '',
        author_name: parts[1]?.trim() ?? '',
        author_email: parts[2]?.trim() ?? '',
        timestamp: parts[3]?.trim() ?? '',
        subject: parts[4]?.trim() ?? '',
        body: parts[5]?.trim() ?? '',
      };
    })
    .filter((c) => c.hash.length === 40);

  if (commits.length === 0) {
    console.log(chalk.yellow('No commits to process.'));
    outro(chalk.bold('Rehydration complete.'));
    return;
  }

  console.log(chalk.gray(`Processing ${commits.length} commits...`));

  // Get current branch name
  let branch = 'unknown';
  try {
    const { stdout: branchOut } = await execa(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: projectRoot }
    );
    branch = branchOut.trim();
  } catch {
    // ignore — branch stays 'unknown'
  }

  let totalTransforms = 0;
  let totalFileChanges = 0;

  // 3. Process each commit in causal (oldest-first) order
  for (let commitIdx = 0; commitIdx < commits.length; commitIdx++) {
    const commit = commits[commitIdx];

    let diffOutput = '';
    try {
      const { stdout } = await execa(
        'git',
        [
          'diff-tree',
          '--no-commit-id',
          '-r',
          '-M',
          '--name-status',
          commit.hash,
        ],
        { cwd: projectRoot }
      );
      diffOutput = stdout;
    } catch {
      continue;
    }

    const lines = diffOutput.split('\n').filter(Boolean);

    // Collect renames for bulk detection
    const renames: RenameEntry[] = [];
    const parsedEntries: ParsedDiffLine[] = [];

    for (const line of lines) {
      const parsed = parseDiffTreeLine(line);
      if (!parsed) continue;
      parsedEntries.push(parsed);
      if (parsed.status === 'R' && parsed.oldPath && parsed.newPath) {
        renames.push({
          oldPath: parsed.oldPath,
          newPath: parsed.newPath,
          similarity: parsed.similarity ?? 100,
        });
      }
    }

    // Detect bulk renames and skip individual processing for those files
    const bulkGroup = detectBulkRename(renames);
    const bulkOldPaths = new Set(bulkGroup?.files.map((r) => r.oldPath) ?? []);

    // 3d. Process individual file changes
    for (const parsed of parsedEntries) {
      const checkPath = parsed.newPath ?? parsed.oldPath;
      if (!checkPath || !isSupportedFile(checkPath)) continue;

      // Skip renames that belong to the bulk group
      if (
        parsed.status === 'R' &&
        parsed.oldPath &&
        bulkOldPaths.has(parsed.oldPath)
      ) {
        continue;
      }

      let inputs: Array<{ path: string; hash: string }> = [];
      let outputs: Array<{ path: string; hash: string }> = [];

      if (parsed.status === 'A' && parsed.newPath) {
        const newHash = await getContentHash(
          pgc,
          commit.hash,
          parsed.newPath,
          false
        );
        outputs = [{ path: parsed.newPath, hash: newHash }];
      } else if (parsed.status === 'M' && parsed.newPath) {
        const oldHash = await getContentHash(
          pgc,
          commit.hash,
          parsed.newPath,
          true
        );
        const newHash = await getContentHash(
          pgc,
          commit.hash,
          parsed.newPath,
          false
        );
        inputs = [{ path: parsed.newPath, hash: oldHash }];
        outputs = [{ path: parsed.newPath, hash: newHash }];
      } else if (parsed.status === 'D' && parsed.oldPath) {
        const oldHash = await getContentHash(
          pgc,
          commit.hash,
          parsed.oldPath,
          true
        );
        inputs = [{ path: parsed.oldPath, hash: oldHash }];
      } else if (parsed.status === 'R' && parsed.oldPath && parsed.newPath) {
        const oldHash = await getContentHash(
          pgc,
          commit.hash,
          parsed.oldPath,
          true
        );
        const newHash = await getContentHash(
          pgc,
          commit.hash,
          parsed.newPath,
          false
        );
        inputs = [{ path: parsed.oldPath, hash: oldHash }];
        outputs = [{ path: parsed.newPath, hash: newHash }];
      } else {
        continue;
      }

      // Optionally synthesize intent
      let intent = commit.subject;
      let decision: string | undefined = commit.body || undefined;
      let confidence = 0.5;
      if (intentResolver) {
        try {
          const resolved = await intentResolver.resolve(
            checkPath,
            commit.subject || null,
            null,
            {
              commit_hash: commit.hash,
              author: commit.author_name,
              message: commit.subject,
              timestamp: commit.timestamp,
            }
          );
          intent = resolved.intent;
          decision = resolved.decision;
          confidence = resolved.confidence;
        } catch {
          // Fall back to commit subject
        }
      }

      const transformData = {
        type: 'rehydrated',
        goal: {
          objective: 'Rehydrated from git history',
          criteria: ['Git commit verified'],
          phimin: 0.6,
        },
        timestamp: commit.timestamp,
        method: 'git_rehydration',
        inputs,
        outputs,
        git: {
          commit_hash: commit.hash,
          author: commit.author_name,
          message: commit.subject + (commit.body ? '\n' + commit.body : ''),
          timestamp: commit.timestamp,
        },
        reasoning: {
          intent,
          decision,
          confidence,
        },
        source: {
          type: 'developer' as const,
          identifier: commit.author_name,
        },
      };

      const transformId = await pgc.transformLog.record(transformData);

      // Wire up reverse deps for inputs and outputs
      for (const art of [...inputs, ...outputs]) {
        if (art.hash && art.hash !== '0'.repeat(64)) {
          await pgc.reverseDeps.add(art.hash, transformId);
        }
      }

      // Link in the transform DAG
      await pgc.transformDAG.link(transformId, {
        ...transformData,
        phi: 1.0,
        verification_result: { success: true, messages: [] },
      });

      totalTransforms++;
      totalFileChanges++;
    }

    // 3e. Record a single bulk rename transform if detected
    if (bulkGroup) {
      const supportedBulkFiles = bulkGroup.files.filter(
        (r) => isSupportedFile(r.oldPath) || isSupportedFile(r.newPath)
      );

      if (supportedBulkFiles.length > 0) {
        const bulkInputs = await Promise.all(
          supportedBulkFiles
            .filter((r) => isSupportedFile(r.oldPath))
            .map(async (r) => ({
              path: r.oldPath,
              hash: await getContentHash(pgc, commit.hash, r.oldPath, true),
            }))
        );
        const bulkOutputs = await Promise.all(
          supportedBulkFiles
            .filter((r) => isSupportedFile(r.newPath))
            .map(async (r) => ({
              path: r.newPath,
              hash: await getContentHash(pgc, commit.hash, r.newPath, false),
            }))
        );

        const bulkTransformData = {
          type: 'rehydrated',
          goal: {
            objective: 'Rehydrated from git history',
            criteria: ['Git commit verified'],
            phimin: 0.6,
          },
          timestamp: commit.timestamp,
          method: 'git_rehydration',
          inputs: bulkInputs,
          outputs: bulkOutputs,
          git: {
            commit_hash: commit.hash,
            author: commit.author_name,
            message: `Bulk rename: ${bulkGroup.pattern}`,
            timestamp: commit.timestamp,
          },
          reasoning: {
            intent: `Bulk rename: ${bulkGroup.pattern}`,
            decision: commit.subject || undefined,
            confidence: 0.5,
          },
          source: {
            type: 'developer' as const,
            identifier: commit.author_name,
          },
        };

        const bulkTransformId =
          await pgc.transformLog.record(bulkTransformData);

        for (const art of [...bulkInputs, ...bulkOutputs]) {
          if (art.hash && art.hash !== '0'.repeat(64)) {
            await pgc.reverseDeps.add(art.hash, bulkTransformId);
          }
        }

        await pgc.transformDAG.link(bulkTransformId, {
          ...bulkTransformData,
          phi: 1.0,
          verification_result: { success: true, messages: [] },
        });

        totalTransforms++;
      }
    }

    // 3f. Update manifest incrementally
    await manifest.write({
      last_rehydrated_commit: commit.hash,
      total_commits_processed: commitIdx + 1,
      total_transforms_recorded: totalTransforms,
      rehydrated_at: new Date().toISOString(),
      branch,
      depth: depth ?? null,
      since: since ?? null,
    });

    console.log(
      chalk.gray(
        `  ✓ ${commit.hash.slice(0, 8)} ${commit.subject.slice(0, 60)}`
      )
    );
  }

  // 4. Final manifest update with complete counts
  await manifest.write({
    last_rehydrated_commit: commits[commits.length - 1]?.hash ?? null,
    total_commits_processed: commits.length,
    total_transforms_recorded: totalTransforms,
    rehydrated_at: new Date().toISOString(),
    branch,
    depth: depth ?? null,
    since: since ?? null,
  });

  // 5. Report
  console.log(
    chalk.green(
      `\n✓ Rehydrated ${commits.length} commits, ${totalFileChanges} file changes, ${totalTransforms} transforms recorded`
    )
  );

  outro(chalk.bold('Rehydration complete.'));
}
