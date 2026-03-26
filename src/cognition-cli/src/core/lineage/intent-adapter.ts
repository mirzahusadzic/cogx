import path from 'node:path';
import fs from 'fs-extra';
import crypto from 'node:crypto';

export interface IntentRecord {
  file_path: string; // Relative to project root
  intent: string;
  decision?: string;
  alternatives?: string[];
  source: {
    type: 'ai_agent' | 'developer' | 'automated' | 'system';
    identifier: string;
    session_id?: string;
  };
  confidence: number;
  timestamp?: string; // ISO 8601
}

export class IntentAdapter {
  private pendingDir: string;
  private readonly STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

  constructor(private pgcRoot: string) {
    this.pendingDir = path.join(pgcRoot, 'pending_intents');
  }

  /**
   * Records a pending intent for a file.
   * Keyed by the hash of the relative file path.
   */
  async recordIntent(record: IntentRecord): Promise<string> {
    await fs.ensureDir(this.pendingDir);

    const intentWithTimestamp = {
      ...record,
      timestamp: record.timestamp || new Date().toISOString(),
    };

    const hash = this.getPathHash(record.file_path);
    const intentPath = path.join(this.pendingDir, `${hash}.json`);

    await fs.writeJson(intentPath, intentWithTimestamp, { spaces: 2 });
    return hash;
  }

  /**
   * Retrieves all pending intents for a specific file.
   * Filters out stale intents (> 1 hour).
   */
  async getPendingIntents(relativePath: string): Promise<IntentRecord[]> {
    const hash = this.getPathHash(relativePath);
    const intentPath = path.join(this.pendingDir, `${hash}.json`);

    if (!(await fs.pathExists(intentPath))) {
      return [];
    }

    try {
      const record = (await fs.readJson(intentPath)) as IntentRecord;

      // Check for expiration
      if (record.timestamp) {
        const timestamp = new Date(record.timestamp).getTime();
        const now = Date.now();
        if (now - timestamp > this.STALE_THRESHOLD_MS) {
          await this.clearIntent(relativePath);
          return [];
        }
      }

      return [record];
    } catch {
      // Corrupt file
      await fs.remove(intentPath);
      return [];
    }
  }

  /**
   * Clears a pending intent for a file (consumed).
   */
  async clearIntent(relativePath: string): Promise<void> {
    const hash = this.getPathHash(relativePath);
    const intentPath = path.join(this.pendingDir, `${hash}.json`);
    await fs.remove(intentPath);
  }

  private getPathHash(relativePath: string): string {
    return crypto.createHash('sha256').update(relativePath).digest('hex');
  }
}
