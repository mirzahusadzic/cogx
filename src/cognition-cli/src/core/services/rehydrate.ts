import path from 'node:path';
import { PGCManager } from '../pgc/manager.js';
import { execa } from 'execa';
import { IntentResolver } from '../lineage/intent-resolver.js';
import { RehydrationManifest } from '../pgc/rehydration-manifest.js';
import { GLOBAL_SUPPORTED_EXTENSIONS } from '../../config.js';

export interface RehydrateResult {
  recordedCount: number;
  skippedCount: number;
}

export interface RehydrateOptions {
  depth?: number;
  since?: string;
  resume?: boolean;
  intentResolver?: IntentResolver;
  onCommitProcessed?: (commit: CommitInfo) => void;
}

export interface CommitInfo {
  hash: string;
  author_name: string;
  author_email: string;
  timestamp: string;
  subject: string;
  body: string;
}

export interface ParsedDiffLine {
  status: 'A' | 'M' | 'D' | 'R';
  oldPath?: string;
  newPath?: string;
  similarity?: number;
}

export interface RenameEntry {
  oldPath: string;
  newPath: string;
  similarity: number;
}

export interface BulkRenameGroup {
  pattern: string;
  files: RenameEntry[];
  count: number;
}

export const SUPPORTED_EXTENSIONS = new Set<string>(
  GLOBAL_SUPPORTED_EXTENSIONS
);

export class RehydrateService {
  private readonly manifest: RehydrationManifest;

  constructor(private readonly pgc: PGCManager) {
    this.manifest = new RehydrationManifest(this.pgc.pgcRoot);
  }

  /**
   * Scans Git history and records missing transforms in the PGC.
   * Ensures that compacted transforms are not re-recorded.
   */
  async rehydrate(options: RehydrateOptions = {}): Promise<RehydrateResult> {
    const transformLog = this.pgc.transformLog;
    const { depth, since, resume = false, intentResolver } = options;

    // 1. Build a cache of commits already covered by PGC
    const coveredCommits = new Set<string>();
    const allTransforms = await transformLog.getAllTransformIds();
    for (const id of allTransforms) {
      try {
        const tx = await transformLog.getTransformation(id);
        const git = tx?.git as Record<string, unknown> | undefined;
        if (git?.commit_hash) {
          coveredCommits.add(git.commit_hash as string);
        }
        // Check for explicitly recorded compacted commits
        if (git?.compacted_commits) {
          for (const c of git.compacted_commits as string[]) {
            coveredCommits.add(c);
          }
        }
      } catch {
        // skip missing manifests
      }
    }

    // 2. Read manifest for --resume
    let lastCommit: string | null = null;
    if (resume) {
      const existing = await this.manifest.read();
      lastCommit = existing?.last_rehydrated_commit ?? null;
    }

    // 3. Build git log command
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

    let commits: CommitInfo[] = [];
    try {
      const { stdout: logOutput } = await execa('git', gitArgs, {
        cwd: this.pgc.projectRoot,
      });

      commits = logOutput
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
    } catch {
      return { recordedCount: 0, skippedCount: 0 };
    }

    if (commits.length === 0) {
      return { recordedCount: 0, skippedCount: 0 };
    }

    let recordedCount = 0;
    let skippedCount = 0;

    // 4. Get current branch name for manifest
    let branch = 'unknown';
    try {
      const { stdout: branchOut } = await execa(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd: this.pgc.projectRoot }
      );
      branch = branchOut.trim();
    } catch {
      // ignore
    }

    // 5. Process commits in reverse (oldest first)
    for (let commitIdx = 0; commitIdx < commits.length; commitIdx++) {
      const commit = commits[commitIdx];
      if (coveredCommits.has(commit.hash)) {
        skippedCount++;
        continue;
      }

      // Process commit diffs
      const diffOutput = await this.getCommitDiff(commit.hash);
      const lines = diffOutput.split('\n').filter(Boolean);
      const renames: RenameEntry[] = [];
      const parsedEntries: ParsedDiffLine[] = [];

      for (const line of lines) {
        const parsed = this.parseDiffTreeLine(line);
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

      const bulkGroup = this.detectBulkRename(renames);
      const bulkOldPaths = new Set(
        bulkGroup?.files.map((r) => r.oldPath) ?? []
      );

      for (const parsed of parsedEntries) {
        const checkPath = parsed.newPath ?? parsed.oldPath;
        if (!checkPath || !this.isSupportedFile(checkPath)) continue;

        if (
          parsed.status === 'R' &&
          parsed.oldPath &&
          bulkOldPaths.has(parsed.oldPath)
        ) {
          continue;
        }

        const { inputs, outputs } = await this.getTransformIO(
          commit.hash,
          parsed
        );
        if (inputs.length === 0 && outputs.length === 0) continue;

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
            // fallback
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

        await this.pgc.recordTransform(transformData);
        recordedCount++;
      }

      // Handle bulk renames
      if (bulkGroup) {
        const supportedBulkFiles = bulkGroup.files.filter(
          (r) =>
            this.isSupportedFile(r.oldPath) || this.isSupportedFile(r.newPath)
        );

        if (supportedBulkFiles.length > 0) {
          const bulkInputs = await Promise.all(
            supportedBulkFiles
              .filter((r) => this.isSupportedFile(r.oldPath))
              .map(async (r) => ({
                path: r.oldPath,
                hash: await this.getContentHash(commit.hash, r.oldPath, true),
              }))
          );
          const bulkOutputs = await Promise.all(
            supportedBulkFiles
              .filter((r) => this.isSupportedFile(r.newPath))
              .map(async (r) => ({
                path: r.newPath,
                hash: await this.getContentHash(commit.hash, r.newPath, false),
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

          await this.pgc.recordTransform(bulkTransformData);
          recordedCount++;
        }
      }

      // Update manifest incrementally
      await this.manifest.write({
        last_rehydrated_commit: commit.hash,
        total_commits_processed: commitIdx + 1,
        total_transforms_recorded: recordedCount,
        rehydrated_at: new Date().toISOString(),
        branch,
        depth: depth ?? null,
        since: since ?? null,
      });

      if (options.onCommitProcessed) {
        options.onCommitProcessed(commit);
      }
    }

    return { recordedCount, skippedCount };
  }

  private async getCommitDiff(hash: string): Promise<string> {
    try {
      const { stdout } = await execa(
        'git',
        ['diff-tree', '--no-commit-id', '-r', '-M', '--name-status', hash],
        { cwd: this.pgc.projectRoot }
      );
      return stdout;
    } catch {
      return '';
    }
  }

  private parseDiffTreeLine(line: string): ParsedDiffLine | null {
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

  private isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
  }

  private detectBulkRename(renames: RenameEntry[]): BulkRenameGroup | null {
    if (renames.length < 5) return null;

    const groups = new Map<string, RenameEntry[]>();
    for (const rename of renames) {
      const oldDir = path.dirname(rename.oldPath);
      const newDir = path.dirname(rename.newPath);
      const key = `${oldDir}\x00${newDir}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(rename);
    }

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

  private async getTransformIO(
    commit: string,
    parsed: ParsedDiffLine
  ): Promise<{
    inputs: Array<{ path: string; hash: string }>;
    outputs: Array<{ path: string; hash: string }>;
  }> {
    let inputs: Array<{ path: string; hash: string }> = [];
    let outputs: Array<{ path: string; hash: string }> = [];

    if (parsed.status === 'A' && parsed.newPath) {
      const newHash = await this.getContentHash(commit, parsed.newPath, false);
      outputs = [{ path: parsed.newPath, hash: newHash }];
    } else if (parsed.status === 'M' && parsed.newPath) {
      const oldHash = await this.getContentHash(commit, parsed.newPath, true);
      const newHash = await this.getContentHash(commit, parsed.newPath, false);
      inputs = [{ path: parsed.newPath, hash: oldHash }];
      outputs = [{ path: parsed.newPath, hash: newHash }];
    } else if (parsed.status === 'D' && parsed.oldPath) {
      const oldHash = await this.getContentHash(commit, parsed.oldPath, true);
      inputs = [{ path: parsed.oldPath, hash: oldHash }];
    } else if (parsed.status === 'R' && parsed.oldPath && parsed.newPath) {
      const oldHash = await this.getContentHash(commit, parsed.oldPath, true);
      const newHash = await this.getContentHash(commit, parsed.newPath, false);
      inputs = [{ path: parsed.oldPath, hash: oldHash }];
      outputs = [{ path: parsed.newPath, hash: newHash }];
    }

    return { inputs, outputs };
  }

  private async getContentHash(
    commit: string,
    filePath: string,
    isOld = false
  ): Promise<string> {
    const ref = isOld ? `${commit}^:${filePath}` : `${commit}:${filePath}`;
    try {
      const { stdout } = await execa('git', ['show', ref], {
        cwd: this.pgc.projectRoot,
      });
      return await this.pgc.objectStore.store(stdout);
    } catch {
      return '0'.repeat(64);
    }
  }
}
