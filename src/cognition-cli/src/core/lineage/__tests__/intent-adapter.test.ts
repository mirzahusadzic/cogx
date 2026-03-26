import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import os from 'node:os';
import { IntentAdapter } from '../intent-adapter.js';

describe('IntentAdapter', () => {
  let tempDir: string;
  let adapter: IntentAdapter;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      `sigma-intent-test-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(tempDir);
    adapter = new IntentAdapter(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should record and retrieve an intent', async () => {
    const record = {
      file_path: 'src/auth.ts',
      intent: 'Adding token validation',
      source: {
        type: 'ai_agent' as const,
        identifier: 'tui',
      },
      confidence: 0.95,
    };

    await adapter.recordIntent(record);
    const pending = await adapter.getPendingIntents('src/auth.ts');

    expect(pending).toHaveLength(1);
    expect(pending[0].intent).toBe('Adding token validation');
    expect(pending[0].file_path).toBe('src/auth.ts');
  });

  it('should clear an intent after consumption', async () => {
    const record = {
      file_path: 'src/auth.ts',
      intent: 'Adding token validation',
      source: {
        type: 'ai_agent' as const,
        identifier: 'tui',
      },
      confidence: 0.95,
    };

    await adapter.recordIntent(record);
    await adapter.clearIntent('src/auth.ts');

    const pending = await adapter.getPendingIntents('src/auth.ts');
    expect(pending).toHaveLength(0);
  });

  it('should expire stale intents after 1 hour', async () => {
    const staleTime = new Date(Date.now() - 61 * 60 * 1000).toISOString();
    const record = {
      file_path: 'src/stale.ts',
      intent: 'Old intent',
      source: {
        type: 'ai_agent' as const,
        identifier: 'tui',
      },
      confidence: 0.9,
      timestamp: staleTime,
    };

    await adapter.recordIntent(record);
    const pending = await adapter.getPendingIntents('src/stale.ts');

    expect(pending).toHaveLength(0);

    // Verify it was actually removed from disk
    const hash = (
      adapter as unknown as { getPathHash: (path: string) => string }
    ).getPathHash('src/stale.ts');
    const intentPath = path.join(tempDir, 'pending_intents', `${hash}.json`);
    expect(await fs.pathExists(intentPath)).toBe(false);
  });
});
