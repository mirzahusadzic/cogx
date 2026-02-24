import * as fs from 'fs/promises';
import * as path from 'path';
import { Session } from '@google/adk';
import { systemLog } from '../../utils/debug-logger.js';

export const TASK_LOG_EVICTION_THRESHOLD = 20;

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

/**
 * Common logic for rolling prune across providers (ADK Session based).
 */
export async function performRollingPrune({
  taskId,
  sessionId,
  projectRoot,
  session,
  threshold = TASK_LOG_EVICTION_THRESHOLD,
}: {
  taskId: string;
  sessionId: string;
  projectRoot: string;
  session: Session;
  threshold?: number;
}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = (session as any).events;
    if (!events || events.length === 0) return;

    const tag = `<!-- sigma-task: ${taskId} -->`;

    // Find all events that have this task tag in their parts
    const taggedEventIndices: number[] = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const parts = event.content?.parts || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasTag = parts.some((p: any) => {
        if (p.text?.includes(tag)) return true;
        if (p.functionResponse?.response) {
          return JSON.stringify(p.functionResponse.response).includes(tag);
        }
        return false;
      });
      if (hasTag) {
        taggedEventIndices.push(i);
      }
    }

    if (taggedEventIndices.length <= threshold) return;

    // We need to prune oldest events to reach the threshold
    const toPruneCount = taggedEventIndices.length - threshold;
    const indicesToPrune = taggedEventIndices.slice(0, toPruneCount);

    const evictedLogs: string[] = [];
    const newEvents = [...events];

    for (const idx of indicesToPrune) {
      const event = newEvents[idx];
      evictedLogs.push(JSON.stringify(event, null, 2));

      const toolTombstone = `[Tool output for task ${taskId} evicted (Rolling Prune) to keep context small. Use 'grep' on .sigma/archives/${sessionId}/${taskId}.log if previous logs are needed.]`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newParts = event.content?.parts?.map((p: any) => {
        if (p.functionResponse) {
          return {
            ...p,
            functionResponse: {
              name: p.functionResponse.name,
              response: {
                result: toolTombstone,
              },
            },
          };
        }
        if (p.text?.includes(tag)) {
          return { text: toolTombstone };
        }
        return p;
      });

      newEvents[idx] = {
        ...event,
        content: {
          ...event.content,
          parts: newParts,
        },
      };
    }

    // Archive the pruned logs before deleting them from memory
    await archiveTaskLogs({
      projectRoot,
      sessionId,
      taskId,
      evictedLogs,
    });

    // Update session history in memory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session as any).events = newEvents;

    systemLog(
      'sigma',
      `Rolling prune: Evicted ${toPruneCount} oldest tool logs for task ${taskId} (threshold: ${threshold}).`
    );
  } catch (err) {
    systemLog(
      'sigma',
      `Failed rolling prune for task ${taskId}`,
      { error: err instanceof Error ? err.message : String(err) },
      'error'
    );
  }
}
