# Testing Guide: useClaudeAgent Refactor

## Overview

This guide provides detailed instructions for testing the `useClaudeAgent` refactor. Each module requires unit tests, integration tests, and E2E tests to ensure correctness.

---

## Test Infrastructure Setup

### Prerequisites

```bash
npm install --save-dev \
  vitest \
  @testing-library/react \
  @testing-library/react-hooks \
  @testing-library/user-event \
  msw \
  memfs
```

### Directory Structure

```
src/tui/hooks/__tests__/
├── setup.ts                          # Global test setup
├── utils/
│   ├── mockSDK.ts                    # Mock SDK query/messages
│   ├── mockEmbedder.ts               # Mock embedding service
│   ├── mockFileSystem.ts             # Mock fs for session state
│   ├── testHelpers.ts                # Shared test utilities
│   └── fixtures.ts                   # Sample data
├── unit/
│   ├── tokens/
│   │   ├── useTokenCount.test.ts
│   │   └── TokenCounter.test.ts
│   ├── session/
│   │   ├── SessionStateStore.test.ts
│   │   └── useSessionManager.test.ts
│   ├── sdk/
│   │   ├── useSDKQuery.test.ts
│   │   └── useSDKMessageHandler.test.ts
│   ├── analysis/
│   │   ├── AnalysisQueue.test.ts
│   │   └── useTurnAnalysis.test.ts
│   ├── compression/
│   │   ├── CompressionTrigger.test.ts
│   │   └── useCompression.test.ts
│   └── rendering/
│       ├── MessageRenderer.test.ts
│       └── ToolFormatter.test.ts
├── integration/
│   ├── sdk-token-integration.test.ts
│   ├── analysis-compression-integration.test.ts
│   └── session-restoration-integration.test.ts
└── e2e/
    ├── compression-workflow.test.ts
    ├── session-lifecycle.test.ts
    └── re-embedding.test.ts
```

---

## Test Utilities

### 1. Mock SDK (utils/mockSDK.ts)

```typescript
import type { Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk';

export function createMockQuery(options: {
  messages?: SDKMessage[];
  shouldError?: boolean;
  errorMessage?: string;
}): Query {
  const messages = options.messages || [];
  let index = 0;

  return {
    async *[Symbol.asyncIterator]() {
      for (const message of messages) {
        yield message;
        index++;
      }

      if (options.shouldError) {
        throw new Error(options.errorMessage || 'SDK Error');
      }
    },
    interrupt: vi.fn(),
  } as unknown as Query;
}

export function createAssistantMessage(
  content: string,
  sessionId = 'test-session-uuid'
): SDKMessage {
  return {
    type: 'assistant',
    session_id: sessionId,
    message: {
      content: [{ type: 'text', text: content }],
    },
  };
}

export function createStreamEvent(
  text: string,
  usage?: { input_tokens: number; output_tokens: number }
): SDKMessage {
  return {
    type: 'stream_event',
    session_id: 'test-session-uuid',
    event: {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text },
      usage,
    },
  };
}

export function createMessageDelta(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}): SDKMessage {
  return {
    type: 'stream_event',
    session_id: 'test-session-uuid',
    event: {
      type: 'message_delta',
      usage,
    },
  };
}

export function createToolUseMessage(
  toolName: string,
  input: Record<string, unknown>
): SDKMessage {
  return {
    type: 'assistant',
    session_id: 'test-session-uuid',
    message: {
      content: [{ type: 'tool_use', name: toolName, input }],
    },
  };
}
```

### 2. Mock Embedder (utils/mockEmbedder.ts)

```typescript
import type { EmbeddingService } from '../../../core/services/embedding';

export function createMockEmbedder(
  options: {
    embeddings?: Map<string, number[]>;
    shouldError?: boolean;
  } = {}
): EmbeddingService {
  const embeddings = options.embeddings || new Map();

  // Generate deterministic embeddings based on content hash
  const generateEmbedding = (text: string): number[] => {
    if (embeddings.has(text)) {
      return embeddings.get(text)!;
    }

    // Simple hash-based deterministic embedding (768 dimensions)
    const hash = text
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(768)
      .fill(0)
      .map((_, i) => (hash + i) / 1000);
  };

  return {
    embed: vi.fn(async (text: string) => {
      if (options.shouldError) {
        throw new Error('Embedding service error');
      }
      return generateEmbedding(text);
    }),
  } as unknown as EmbeddingService;
}
```

### 3. Mock File System (utils/mockFileSystem.ts)

```typescript
import { vol } from 'memfs';
import fs from 'fs';

export function setupMockFS() {
  // Use memfs for in-memory file system
  vol.reset();

  // Create .sigma directory
  vol.mkdirSync('/.sigma', { recursive: true });

  return {
    vol,
    readJSON: (path: string) =>
      JSON.parse(vol.readFileSync(path, 'utf-8') as string),
    writeJSON: (path: string, data: unknown) => {
      vol.writeFileSync(path, JSON.stringify(data, null, 2));
    },
    cleanup: () => vol.reset(),
  };
}
```

### 4. Test Helpers (utils/testHelpers.ts)

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';

export async function waitForAnalysis(
  result: { current: { analysisQueue: { isProcessing: boolean } } },
  timeout = 5000
) {
  await waitFor(
    () => {
      expect(result.current.analysisQueue.isProcessing).toBe(false);
    },
    { timeout }
  );
}

export async function triggerCompression(
  result: { current: any },
  tokenCount = 120001
) {
  act(() => {
    result.current.updateTokenCount({
      input: 60000,
      output: tokenCount - 60000,
      total: tokenCount,
    });
  });

  // Wait for compression to complete
  await waitFor(() => {
    expect(result.current.conversationLattice).not.toBeNull();
  });
}

export function createTurnAnalyses(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    turn_id: `turn-${i}`,
    content: `Turn ${i} content`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    timestamp: Date.now() + i * 1000,
    embedding: Array(768).fill(i / 100),
    novelty: Math.random(),
    importance_score: Math.floor(Math.random() * 10) + 1,
    is_paradigm_shift: Math.random() > 0.8,
    is_routine: Math.random() > 0.7,
    overlay_scores: {
      O1_structural: Math.random() * 10,
      O2_security: Math.random() * 10,
      O3_lineage: Math.random() * 10,
      O4_mission: Math.random() * 10,
      O5_operational: Math.random() * 10,
      O6_mathematical: Math.random() * 10,
      O7_strategic: Math.random() * 10,
    },
    references: [],
    semantic_tags: [`tag-${i}`],
  }));
}
```

---

## Unit Tests

### Token Management

#### useTokenCount.test.ts

```typescript
import { renderHook, act } from '@testing-library/react';
import { useTokenCount } from '../../tokens/useTokenCount';

describe('useTokenCount', () => {
  it('initializes with zero count', () => {
    const { result } = renderHook(() => useTokenCount());

    expect(result.current.count).toEqual({
      input: 0,
      output: 0,
      total: 0,
    });
  });

  it('updates count correctly', () => {
    const { result } = renderHook(() => useTokenCount());

    act(() => {
      result.current.update({ input: 1000, output: 500, total: 1500 });
    });

    expect(result.current.count.total).toBe(1500);
  });

  it('uses Math.max for subsequent updates (prevents drops)', () => {
    const { result } = renderHook(() => useTokenCount());

    // First update
    act(() => {
      result.current.update({ input: 1000, output: 500, total: 1500 });
    });

    // Try to update with lower value - should be ignored
    act(() => {
      result.current.update({ input: 500, output: 200, total: 700 });
    });

    expect(result.current.count.total).toBe(1500); // Stayed at higher value
  });

  it('resets to zero', () => {
    const { result } = renderHook(() => useTokenCount());

    // Set to some value
    act(() => {
      result.current.update({ input: 1000, output: 500, total: 1500 });
    });

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.count.total).toBe(0);
  });

  it('accepts any value immediately after reset (does not use Math.max)', () => {
    const { result } = renderHook(() => useTokenCount());

    // Set high value
    act(() => {
      result.current.update({ input: 60000, output: 60000, total: 120000 });
    });

    // Reset
    act(() => {
      result.current.reset();
    });

    // Update with low value - should accept it
    act(() => {
      result.current.update({ input: 100, output: 50, total: 150 });
    });

    expect(result.current.count.total).toBe(150); // Accepted low value!
  });

  it('handles multiple resets in sequence', () => {
    const { result } = renderHook(() => useTokenCount());

    // Reset 1
    act(() => {
      result.current.reset();
      result.current.update({ input: 100, output: 50, total: 150 });
    });
    expect(result.current.count.total).toBe(150);

    // Reset 2
    act(() => {
      result.current.reset();
      result.current.update({ input: 200, output: 100, total: 300 });
    });
    expect(result.current.count.total).toBe(300);
  });
});
```

### Session Management

#### SessionStateStore.test.ts

```typescript
import { SessionStateStore } from '../../session/SessionStateStore';
import { setupMockFS } from '../utils/mockFileSystem';

describe('SessionStateStore', () => {
  let mockFS: ReturnType<typeof setupMockFS>;
  let store: SessionStateStore;

  beforeEach(() => {
    mockFS = setupMockFS();
    store = new SessionStateStore('/.sigma');
  });

  afterEach(() => {
    mockFS.cleanup();
  });

  it('creates initial state', () => {
    const state = store.create('my-session', 'sdk-uuid-1234');

    expect(state.anchor_id).toBe('my-session');
    expect(state.current_session).toBe('sdk-uuid-1234');
    expect(state.compression_history).toHaveLength(1);
    expect(state.compression_history[0].reason).toBe('initial');
  });

  it('saves state to disk', () => {
    const state = store.create('my-session', 'sdk-uuid-1234');
    store.save(state);

    const loaded = mockFS.readJSON('/.sigma/my-session.state.json');
    expect(loaded.anchor_id).toBe('my-session');
  });

  it('loads state from disk', () => {
    const state = store.create('my-session', 'sdk-uuid-1234');
    store.save(state);

    const loaded = store.load('my-session');
    expect(loaded?.anchor_id).toBe('my-session');
    expect(loaded?.current_session).toBe('sdk-uuid-1234');
  });

  it('updates session on compression', () => {
    const state = store.create('my-session', 'sdk-uuid-1234');
    store.save(state);

    const updated = store.updateSession(
      'my-session',
      'sdk-uuid-5678',
      'compression',
      120000
    );

    expect(updated.current_session).toBe('sdk-uuid-5678');
    expect(updated.compression_history).toHaveLength(2);
    expect(updated.compression_history[1].reason).toBe('compression');
    expect(updated.compression_history[1].tokens).toBe(120000);
  });

  it('returns null for missing state', () => {
    const loaded = store.load('nonexistent');
    expect(loaded).toBeNull();
  });

  it('migrates old state format', () => {
    // Write old format
    const oldState = {
      sessionId: 'old-session',
      timestamp: '2024-01-01T00:00:00.000Z',
      newSessionId: 'new-session',
      compression: { triggered_at_tokens: 100000 },
    };
    mockFS.writeJSON('/.sigma/old-session.state.json', oldState);

    // Migrate
    const migrated = store.migrate('old-session');

    expect(migrated).not.toBeNull();
    expect(migrated?.anchor_id).toBe('old-session');
    expect(migrated?.compression_history).toHaveLength(2);
  });
});
```

### Compression

#### CompressionTrigger.test.ts

```typescript
import { CompressionTrigger } from '../../compression/CompressionTrigger';

describe('CompressionTrigger', () => {
  let trigger: CompressionTrigger;

  beforeEach(() => {
    trigger = new CompressionTrigger({ sessionTokens: 120000 });
  });

  it('triggers at token threshold with minimum turns', () => {
    const should = trigger.shouldTrigger(120001, 5);
    expect(should).toBe(true);
  });

  it('does not trigger below token threshold', () => {
    const should = trigger.shouldTrigger(119999, 10);
    expect(should).toBe(false);
  });

  it('does not trigger below minimum turns', () => {
    const should = trigger.shouldTrigger(120001, 4);
    expect(should).toBe(false);
  });

  it('does not trigger twice', () => {
    trigger.shouldTrigger(120001, 5); // First trigger
    const secondTrigger = trigger.shouldTrigger(130000, 10);
    expect(secondTrigger).toBe(false);
  });

  it('resets and allows second trigger', () => {
    trigger.shouldTrigger(120001, 5); // First trigger
    trigger.reset(); // Reset
    const secondTrigger = trigger.shouldTrigger(120001, 5);
    expect(secondTrigger).toBe(true);
  });

  it('uses custom token threshold', () => {
    const customTrigger = new CompressionTrigger({ sessionTokens: 50000 });
    const should = customTrigger.shouldTrigger(50001, 5);
    expect(should).toBe(true);
  });
});
```

### Analysis Queue

#### AnalysisQueue.test.ts

```typescript
import { AnalysisQueue } from '../../analysis/AnalysisQueue';
import { createMockEmbedder } from '../utils/mockEmbedder';
import { waitFor } from '@testing-library/react';

describe('AnalysisQueue', () => {
  it('processes turns in order', async () => {
    const embedder = createMockEmbedder();
    const queue = new AnalysisQueue(embedder);
    const processed: string[] = [];

    queue.onComplete = (analysis) => {
      processed.push(analysis.turn_id);
    };

    // Add 3 turns
    await queue.add({
      id: 'turn-1',
      role: 'user',
      content: 'First',
      timestamp: 1,
    });
    await queue.add({
      id: 'turn-2',
      role: 'assistant',
      content: 'Second',
      timestamp: 2,
    });
    await queue.add({
      id: 'turn-3',
      role: 'user',
      content: 'Third',
      timestamp: 3,
    });

    // Wait for processing
    await waitFor(() => {
      expect(processed).toHaveLength(3);
    });

    // Should be in order
    expect(processed).toEqual(['turn-1', 'turn-2', 'turn-3']);
  });

  it('does not block on analysis', async () => {
    const embedder = createMockEmbedder();
    const queue = new AnalysisQueue(embedder);

    // Add turn (should return immediately)
    const start = Date.now();
    await queue.add({
      id: 'turn-1',
      role: 'user',
      content: 'Test',
      timestamp: 1,
    });
    const elapsed = Date.now() - start;

    // Should be very fast (< 10ms)
    expect(elapsed).toBeLessThan(10);
  });

  it('reports progress', async () => {
    const embedder = createMockEmbedder();
    const queue = new AnalysisQueue(embedder);
    const progressUpdates: number[] = [];

    queue.onProgress = (remaining) => {
      progressUpdates.push(remaining);
    };

    // Add 5 turns
    for (let i = 0; i < 5; i++) {
      await queue.add({
        id: `turn-${i}`,
        role: 'user',
        content: `Turn ${i}`,
        timestamp: i,
      });
    }

    // Wait for completion
    await waitFor(() => {
      expect(queue.isProcessing).toBe(false);
    });

    // Should have progress updates: [4, 3, 2, 1, 0]
    expect(progressUpdates).toEqual([4, 3, 2, 1, 0]);
  });

  it('handles analysis errors gracefully', async () => {
    const embedder = createMockEmbedder({ shouldError: true });
    const queue = new AnalysisQueue(embedder);
    const errors: Error[] = [];

    queue.onError = (error) => {
      errors.push(error);
    };

    // Add turn that will fail
    await queue.add({
      id: 'turn-1',
      role: 'user',
      content: 'Test',
      timestamp: 1,
    });

    // Wait for processing
    await waitFor(() => {
      expect(queue.isProcessing).toBe(false);
    });

    // Should have error
    expect(errors).toHaveLength(1);
  });

  it('prevents duplicate analysis', async () => {
    const embedder = createMockEmbedder();
    const queue = new AnalysisQueue(embedder);
    const processed: string[] = [];

    queue.onComplete = (analysis) => {
      processed.push(analysis.turn_id);
    };

    // Add same turn twice
    await queue.add({
      id: 'turn-1',
      role: 'user',
      content: 'Test',
      timestamp: 1,
    });
    await queue.add({
      id: 'turn-1',
      role: 'user',
      content: 'Test',
      timestamp: 1,
    });

    // Wait for processing
    await waitFor(() => {
      expect(queue.isProcessing).toBe(false);
    });

    // Should only process once
    expect(processed).toEqual(['turn-1']);
  });
});
```

---

## Integration Tests

### SDK + Token Integration

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useClaudeAgent } from '../../useClaudeAgent';
import { createMessageDelta } from '../utils/mockSDK';

describe('SDK + Token Integration', () => {
  it('updates token count from SDK messages', async () => {
    const { result } = renderHook(() => useClaudeAgent({ cwd: '/test' }));

    // Simulate SDK message with token usage
    act(() => {
      result.current.processSDKMessage(
        createMessageDelta({ input_tokens: 1000, output_tokens: 500 })
      );
    });

    expect(result.current.tokenCount.total).toBe(1500);
  });

  it('resets token count on compression', async () => {
    const { result } = renderHook(() => useClaudeAgent({ cwd: '/test' }));

    // Build up token count
    act(() => {
      result.current.processSDKMessage(
        createMessageDelta({ input_tokens: 60000, output_tokens: 60001 })
      );
    });

    expect(result.current.tokenCount.total).toBe(120001);

    // Wait for compression
    await waitFor(() => {
      expect(result.current.tokenCount.total).toBe(0);
    });
  });
});
```

---

## E2E Tests

### Compression Workflow

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useClaudeAgent } from '../../useClaudeAgent';
import { setupMockFS } from '../utils/mockFileSystem';
import { createTurnAnalyses } from '../utils/testHelpers';

describe('Compression Workflow (E2E)', () => {
  let mockFS: ReturnType<typeof setupMockFS>;

  beforeEach(() => {
    mockFS = setupMockFS();
  });

  afterEach(() => {
    mockFS.cleanup();
  });

  it('full compression workflow', async () => {
    const { result } = renderHook(() =>
      useClaudeAgent({ cwd: '/', sessionId: 'test-session' })
    );

    // 1. Add turns to reach minimum
    const analyses = createTurnAnalyses(10);
    act(() => {
      result.current.turnAnalyses = analyses;
    });

    // 2. Trigger compression by exceeding token threshold
    act(() => {
      result.current.updateTokenCount({
        input: 60000,
        output: 60001,
        total: 120001,
      });
    });

    // 3. Wait for compression to complete
    await waitFor(() => {
      expect(result.current.conversationLattice).not.toBeNull();
    });

    // 4. Verify token count reset
    expect(result.current.tokenCount.total).toBe(0);

    // 5. Verify lattice saved to disk
    const latticeFile = mockFS.vol.existsSync(
      '/.sigma/test-session.lattice.json'
    );
    expect(latticeFile).toBe(true);

    // 6. Verify recap generated
    const recapFile = mockFS.vol.existsSync('/.sigma/test-session.recap.txt');
    expect(recapFile).toBe(true);

    // 7. Verify session state updated
    const state = mockFS.readJSON('/.sigma/test-session.state.json');
    expect(state.compression_history).toHaveLength(2); // initial + compression

    // 8. Verify resume ID cleared
    expect(result.current.resumeSessionId).toBeUndefined();

    // 9. Verify compression flag set
    expect(result.current.compressionTriggered).toBe(true);

    // 10. Simulate new SDK session starting
    act(() => {
      result.current.processSDKMessage({
        type: 'assistant',
        session_id: 'new-sdk-uuid',
        message: { content: [] },
      });
    });

    // 11. Verify compression flag reset
    expect(result.current.compressionTriggered).toBe(false);

    // 12. Verify can compress again
    act(() => {
      result.current.updateTokenCount({
        input: 60000,
        output: 60001,
        total: 120001,
      });
    });

    await waitFor(() => {
      expect(
        result.current.conversationLattice?.metadata.compressed_turn_count
      ).toBeGreaterThan(0);
    });
  });
});
```

---

## Manual Testing Checklist

### Pre-Release Testing

- [ ] **Fresh session**
  - [ ] Start TUI with `--session-id test-1`
  - [ ] Send 5 messages
  - [ ] Verify analysis completes
  - [ ] Check `.sigma/test-1.state.json` exists

- [ ] **Compression trigger**
  - [ ] Continue session to >120K tokens
  - [ ] Verify compression notification appears
  - [ ] Verify token count resets to 0
  - [ ] Check `.sigma/test-1.lattice.json` exists
  - [ ] Check `.sigma/test-1.recap.txt` exists

- [ ] **Resume compressed session**
  - [ ] Restart TUI with `--session-id test-1`
  - [ ] Verify lattice loads
  - [ ] Send new message
  - [ ] Verify recap injected on first query
  - [ ] Verify real-time context on subsequent queries

- [ ] **Multiple compressions**
  - [ ] Continue to >120K tokens again
  - [ ] Verify second compression works
  - [ ] Check compression history has 3 entries

- [ ] **Re-embedding (if triggered)**
  - [ ] Load old session that needs re-embedding
  - [ ] Verify UI remains responsive
  - [ ] Verify progress indicator shows
  - [ ] Verify completes in background

- [ ] **Error scenarios**
  - [ ] Start without WORKBENCH_API_KEY
  - [ ] Verify warning message
  - [ ] Verify TUI continues to work
  - [ ] Test with expired OAuth token
  - [ ] Verify auth error message

---

## Performance Benchmarks

### Targets

- **Turn analysis**: < 200ms per turn
- **Compression**: < 5 seconds for 100 turns
- **Session load**: < 2 seconds
- **Re-embedding**: Does not block UI

### Profiling

```typescript
// Add to tests
it('analyzes turn within 200ms', async () => {
  const start = performance.now();
  await analyzeTurn(turn, context, embedder);
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(200);
});
```

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Test useClaudeAgent

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Coverage Requirements

- **Unit tests**: > 95% coverage
- **Integration tests**: All sub-hook interactions
- **E2E tests**: All critical workflows

### Measuring Coverage

```bash
npm test -- --coverage

# Generate HTML report
npm test -- --coverage --reporter=html

# Open in browser
open coverage/index.html
```

---

## Debugging Failed Tests

### Common Issues

1. **Timing issues** - Use `waitFor` instead of timeouts
2. **State not updating** - Wrap in `act()`
3. **File system** - Use `memfs` for isolation
4. **Async iterations** - Mock SDK properly

### Debug Tips

```typescript
// Add debug output
it('test', () => {
  console.log(JSON.stringify(result.current, null, 2));
});

// Use fit() to run single test
fit('focused test', () => { ... });

// Increase timeout for slow tests
it('slow test', async () => { ... }, 10000); // 10s timeout
```

---

**Document Version**: 1.0
**Date**: 2025-11-08
**Status**: Ready for Implementation
