import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Common archiving logic for evicted logs.
 */
export async function archiveTaskLogs({
  projectRoot,
  sessionId,
  taskId,
  evictedLogs,
  result_summary,
}: {
  projectRoot: string;
  sessionId: string;
  taskId: string;
  evictedLogs: string[];
  result_summary?: string;
}) {
  if (!process.env.DEBUG_ARCHIVE || evictedLogs.length === 0) return;

  const archiveDir = path.join(projectRoot, '.sigma', 'archives', sessionId);
  await fs.mkdir(archiveDir, { recursive: true });
  const archivePath = path.join(archiveDir, `${taskId}.log`);

  const summaryHeader = result_summary ? `\nSUMMARY: ${result_summary}\n` : '';

  await fs.appendFile(
    archivePath,
    `\n--- ARCHIVED AT ${new Date().toISOString()} ---${summaryHeader}\n` +
      evictedLogs.join('\n---\n')
  );
}
