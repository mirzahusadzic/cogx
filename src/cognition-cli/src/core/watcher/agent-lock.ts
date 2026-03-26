import path from 'path';
import fs from 'fs-extra';

export interface LockState {
  acquired_at: string;
  source: string;
  timeout_seconds: number;
  expires_at: string;
  session_id?: string;
}

export class AgentLockManager {
  private lockPath: string;

  constructor(pgcRoot: string) {
    this.lockPath = path.join(pgcRoot, '.agent_lock');
  }

  async acquire(
    source: string,
    timeoutSeconds = 30,
    sessionId?: string
  ): Promise<void> {
    const existing = await this.readState();
    if (existing !== null) {
      const expired = Date.now() > Date.parse(existing.expires_at);
      if (!expired) {
        throw new Error('Lock already held by: ' + existing.source);
      }
    }

    const acquiredAt = new Date();
    const expiresAt = new Date(acquiredAt.getTime() + timeoutSeconds * 1000);

    const state: LockState = {
      acquired_at: acquiredAt.toISOString(),
      source,
      timeout_seconds: timeoutSeconds,
      expires_at: expiresAt.toISOString(),
      ...(sessionId !== undefined ? { session_id: sessionId } : {}),
    };

    await fs.outputJson(this.lockPath, state, { spaces: 2 });
  }

  async release(): Promise<void> {
    if (await fs.pathExists(this.lockPath)) {
      await fs.remove(this.lockPath);
    }
  }

  async isLocked(): Promise<boolean> {
    if (!(await fs.pathExists(this.lockPath))) {
      return false;
    }
    const state = await this.readState();
    if (state === null) return false;
    if (Date.now() > Date.parse(state.expires_at)) {
      await fs.remove(this.lockPath);
      return false;
    }
    return true;
  }

  async readState(): Promise<LockState | null> {
    if (!(await fs.pathExists(this.lockPath))) {
      return null;
    }
    try {
      return (await fs.readJson(this.lockPath)) as LockState;
    } catch {
      return null;
    }
  }
}
