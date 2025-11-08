# useClaudeAgent.ts Refactoring Plan

## Executive Summary

The `useClaudeAgent.ts` hook (~1,790 lines) has become the most complex component in the 50K LOC codebase. It suffers from:

1. **Massive responsibility overload** - handles 10+ distinct concerns
2. **Brittle state management** - compression/session bugs persist for weeks
3. **Poor UX** - re-embedding after compression blocks the UI
4. **Test coverage gap** - no tests for the most critical component
5. **Debugging nightmare** - interleaved concerns make issues hard to trace

**Goal**: Decompose into testable, maintainable modules with clear boundaries and comprehensive test coverage.

---

## Current State Analysis

### File Metrics
- **Lines**: 1,790 (largest file in codebase by 2.5x)
- **Responsibilities**: 10+ distinct concerns
- **Test coverage**: 0% (no tests exist)
- **Bug history**: Compression/session management issues ongoing for ~1 week

### Current Responsibilities (Anti-Pattern)

The hook currently does **everything**:

1. ✅ **SDK Integration** - Query lifecycle, message streaming
2. ✅ **Turn Analysis** - Embedding generation, novelty calculation
3. ✅ **Compression** - Trigger detection, lattice creation
4. ✅ **Session Management** - State files, SDK session tracking
5. ✅ **Token Counting** - Reset logic, accumulation
6. ✅ **Context Injection** - Recap, real-time lattice search
7. ✅ **Overlay Population** - Project alignment, flushing
8. ✅ **LanceDB Operations** - Reconstruction, re-embedding
9. ✅ **Message Rendering** - Tool display, diff formatting
10. ✅ **Error Handling** - Auth errors, compression failures
11. ✅ **Debug Logging** - File logs, console output

### Known Issues

1. **Token count reset bug** - Fixed twice, still fragile
2. **Re-embedding blocks UI** - Post-compression operation is synchronous
3. **Session state races** - SDK session ID vs anchor ID confusion
4. **Compression flag management** - Reset timing is brittle
5. **Message analysis ordering** - Dependencies between isThinking, message index, analyzing flag

---

## Target Architecture

### High-Level Structure

```
src/tui/hooks/
├── useClaudeAgent.ts          [150 lines]  - Orchestrator only
├── sdk/
│   ├── useSDKQuery.ts         [200 lines]  - SDK query lifecycle
│   ├── useSDKMessageHandler.ts [250 lines] - Message processing
│   └── types.ts
├── analysis/
│   ├── useTurnAnalysis.ts     [200 lines]  - Turn analysis orchestration
│   ├── AnalysisQueue.ts       [150 lines]  - Background queue
│   └── types.ts
├── compression/
│   ├── useCompression.ts      [200 lines]  - Compression orchestration
│   ├── CompressionTrigger.ts  [100 lines]  - Trigger logic
│   └── types.ts
├── session/
│   ├── useSessionManager.ts   [200 lines]  - Session state
│   ├── SessionStateStore.ts   [150 lines]  - State persistence
│   └── types.ts
├── tokens/
│   ├── useTokenCount.ts       [100 lines]  - Token tracking
│   └── TokenCounter.ts        [80 lines]   - Reset logic
└── rendering/
    ├── MessageRenderer.ts     [200 lines]  - Message display
    └── ToolFormatter.ts       [150 lines]  - Tool display
```

**Total**: ~2,300 lines (split into 15 focused modules)

### Module Responsibilities

#### 1. useClaudeAgent.ts (Orchestrator) [150 lines]
**Single Responsibility**: Compose sub-hooks and expose unified API

```typescript
export function useClaudeAgent(options: UseClaudeAgentOptions) {
  // Initialize sub-systems
  const sessionManager = useSessionManager(options);
  const tokenCounter = useTokenCount();
  const analysisQueue = useTurnAnalysis(sessionManager.currentSessionId);
  const compressionTrigger = useCompression(tokenCounter.total, analysisQueue.analyses);
  const sdkQuery = useSDKQuery(sessionManager, compressionTrigger);

  // Wire up event handlers
  useEffect(() => {
    if (compressionTrigger.shouldCompress) {
      handleCompression();
    }
  }, [compressionTrigger.shouldCompress]);

  // Expose clean API
  return {
    messages: sdkQuery.messages,
    sendMessage: sdkQuery.sendMessage,
    interrupt: sdkQuery.interrupt,
    isThinking: sdkQuery.isThinking,
    error: sdkQuery.error,
    tokenCount: tokenCounter,
    // ... other exports
  };
}
```

**Benefits**:
- Each sub-hook is independently testable
- Clear data flow between modules
- Easy to add/remove features
- Debugging is straightforward (isolate problematic module)

#### 2. SDK Layer (sdk/)

##### useSDKQuery.ts [200 lines]
- Manages SDK query lifecycle (start, stream, complete)
- Handles resume logic
- Orchestrates context injection
- **Tested**: Query creation, resume logic, error handling

##### useSDKMessageHandler.ts [250 lines]
- Processes SDK messages by type
- Updates message state
- Extracts session IDs
- **Tested**: All message types, session ID extraction, token updates

#### 3. Analysis Layer (analysis/)

##### useTurnAnalysis.ts [200 lines]
- Orchestrates turn analysis
- Manages analysis queue
- Handles embedding caching
- **Tested**: Analysis triggering, deduplication, embedding reuse

##### AnalysisQueue.ts [150 lines]
**KEY IMPROVEMENT**: Background processing queue

```typescript
class AnalysisQueue {
  private queue: TurnAnalysis[] = [];
  private processing = false;

  async add(turn: ConversationTurn) {
    this.queue.push(turn);
    this.processQueue(); // Non-blocking
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const turn = this.queue.shift()!;
      await this.analyzeTurn(turn);
      this.onProgress?.(this.queue.length); // Update UI
    }

    this.processing = false;
  }
}
```

**Benefits**:
- Analysis never blocks the UI
- Progress bar for re-embedding
- Can be paused/resumed
- **Tested**: Queue ordering, concurrency, error recovery

#### 4. Compression Layer (compression/)

##### useCompression.ts [200 lines]
- Orchestrates compression workflow
- Manages compression flag
- Handles lattice storage
- Triggers session switch
- **Tested**: Trigger logic, flag reset, lattice persistence

##### CompressionTrigger.ts [100 lines]
**Isolated trigger logic**:

```typescript
class CompressionTrigger {
  shouldTrigger(tokenCount: number, turnCount: number, alreadyTriggered: boolean): boolean {
    const TOKEN_THRESHOLD = this.options.sessionTokens || 120000;
    const MIN_TURNS = 5;

    return (
      tokenCount > TOKEN_THRESHOLD &&
      !alreadyTriggered &&
      turnCount >= MIN_TURNS
    );
  }

  reset() {
    this.alreadyTriggered = false;
  }
}
```

**Benefits**:
- Testable in isolation
- Clear logic for when compression happens
- Easy to modify thresholds
- **Tested**: All threshold combinations, edge cases

#### 5. Session Layer (session/)

##### useSessionManager.ts [200 lines]
- Manages session state lifecycle
- Handles SDK session ID updates
- Coordinates anchor ID vs SDK UUID
- **Tested**: State transitions, ID mapping, persistence

##### SessionStateStore.ts [150 lines]
**Extracted from session-state.ts**:

```typescript
class SessionStateStore {
  load(anchorId: string): SessionState | null
  save(state: SessionState): void
  updateSession(anchorId: string, sdkSessionId: string, reason: string): void
  updateStats(anchorId: string, stats: Stats): void
}
```

**Benefits**:
- Clear separation of state persistence
- Easier to mock for testing
- Can swap implementations (e.g., SQLite)
- **Tested**: Load, save, update operations, error handling

#### 6. Token Layer (tokens/)

##### useTokenCount.ts [100 lines]
**Isolated token counting**:

```typescript
export function useTokenCount() {
  const [count, setCount] = useState({ input: 0, output: 0, total: 0 });
  const justReset = useRef(false);

  const reset = useCallback(() => {
    setCount({ input: 0, output: 0, total: 0 });
    justReset.current = true;
  }, []);

  const update = useCallback((newCount: TokenCount) => {
    setCount(prev => {
      // Only use Math.max if NOT just reset
      if (justReset.current) {
        justReset.current = false;
        return newCount;
      }
      return newCount.total > prev.total ? newCount : prev;
    });
  }, []);

  return { count, reset, update };
}
```

**Benefits**:
- Reset logic is isolated and testable
- Clear semantics for when to use Math.max
- **Tested**: Reset behavior, Math.max logic, edge cases

#### 7. Rendering Layer (rendering/)

##### MessageRenderer.ts [200 lines]
- Formats messages by type
- Applies colors
- Handles streaming updates
- **Tested**: All message types, color stripping, streaming

##### ToolFormatter.ts [150 lines]
- Formats tool calls
- Generates diffs for Edit tool
- Formats TodoWrite display
- **Tested**: All tool types, diff generation, edge cases

---

## Migration Strategy

### Phase 1: Setup & Infrastructure (Week 1)

#### Day 1: Project Setup
- [ ] Create new directory structure
- [ ] Set up test framework (Vitest + React Testing Library)
- [ ] Create shared test utilities
- [ ] Document testing patterns

**Deliverable**: Working test infrastructure with sample tests

#### Day 2-3: Extract Token Management
- [ ] Create `tokens/useTokenCount.ts`
- [ ] Create `tokens/TokenCounter.ts`
- [ ] Write comprehensive tests (100% coverage)
- [ ] Replace in `useClaudeAgent.ts`
- [ ] Verify token count behavior in TUI

**Tests**:
```typescript
describe('useTokenCount', () => {
  it('resets to zero when reset() called')
  it('uses Math.max when not just reset')
  it('accepts any value immediately after reset')
  it('handles multiple resets in sequence')
  it('handles concurrent updates')
});
```

**Deliverable**: Token management fully extracted and tested

#### Day 4-5: Extract Session Management
- [ ] Create `session/SessionStateStore.ts`
- [ ] Create `session/useSessionManager.ts`
- [ ] Write comprehensive tests
- [ ] Replace in `useClaudeAgent.ts`
- [ ] Verify session persistence

**Tests**:
```typescript
describe('SessionStateStore', () => {
  it('creates initial state correctly')
  it('updates SDK session on compression')
  it('tracks compression history')
  it('migrates old state files')
  it('handles missing files gracefully')
});

describe('useSessionManager', () => {
  it('loads existing session on mount')
  it('creates new session if none exists')
  it('updates anchor state when SDK session changes')
  it('resets resume ID after compression')
});
```

**Deliverable**: Session management fully extracted and tested

### Phase 2: Core Extraction (Week 2)

#### Day 6-8: Extract SDK Layer
- [ ] Create `sdk/useSDKQuery.ts`
- [ ] Create `sdk/useSDKMessageHandler.ts`
- [ ] Create `sdk/types.ts`
- [ ] Write comprehensive tests
- [ ] Replace in `useClaudeAgent.ts`
- [ ] Verify query lifecycle

**Tests**:
```typescript
describe('useSDKQuery', () => {
  it('creates query with correct options')
  it('resumes from session ID')
  it('injects recap on first query after compression')
  it('injects real-time context on subsequent queries')
  it('handles query errors')
  it('interrupts query on demand')
});

describe('useSDKMessageHandler', () => {
  it('processes assistant messages')
  it('processes stream events')
  it('updates token count from message_delta')
  it('extracts session ID from all message types')
  it('updates resume session ID')
  it('handles tool calls')
});
```

**Deliverable**: SDK layer fully extracted and tested

#### Day 9-10: Extract Rendering Layer
- [ ] Create `rendering/MessageRenderer.ts`
- [ ] Create `rendering/ToolFormatter.ts`
- [ ] Write comprehensive tests
- [ ] Replace in SDK message handler
- [ ] Verify message display

**Tests**:
```typescript
describe('MessageRenderer', () => {
  it('strips ANSI codes from SDK output')
  it('formats user messages')
  it('formats assistant messages')
  it('formats system messages')
  it('handles streaming updates')
});

describe('ToolFormatter', () => {
  it('formats Edit tool with diff')
  it('formats TodoWrite with status icons')
  it('formats recall tool with query')
  it('formats other tools generically')
});
```

**Deliverable**: Rendering layer fully extracted and tested

### Phase 3: Analysis & Compression (Week 3)

#### Day 11-13: Extract Analysis Layer
**CRITICAL**: Implement background queue here

- [ ] Create `analysis/AnalysisQueue.ts`
- [ ] Create `analysis/useTurnAnalysis.ts`
- [ ] Write comprehensive tests
- [ ] Replace in `useClaudeAgent.ts`
- [ ] Verify analysis non-blocking

**Tests**:
```typescript
describe('AnalysisQueue', () => {
  it('processes turns in order')
  it('does not block on analysis')
  it('reports progress')
  it('handles analysis errors')
  it('prevents duplicate analysis')
  it('caches embeddings for reuse')
  it('can be paused and resumed')
});

describe('useTurnAnalysis', () => {
  it('analyzes new user messages')
  it('waits for assistant to finish before analyzing')
  it('does not re-analyze existing turns')
  it('reuses cached embeddings')
  it('populates conversation overlays')
  it('flushes overlays periodically')
});
```

**Deliverable**: Analysis layer with background queue, tested

#### Day 14-15: Extract Compression Layer
- [ ] Create `compression/CompressionTrigger.ts`
- [ ] Create `compression/useCompression.ts`
- [ ] Write comprehensive tests
- [ ] Replace in `useClaudeAgent.ts`
- [ ] Verify compression workflow

**Tests**:
```typescript
describe('CompressionTrigger', () => {
  it('triggers at token threshold')
  it('requires minimum turns')
  it('does not trigger twice')
  it('resets when new session starts')
});

describe('useCompression', () => {
  it('triggers compression at threshold')
  it('saves lattice to disk')
  it('flushes conversation overlays')
  it('generates recap')
  it('resets token count')
  it('clears resume session ID')
  it('resets compression flag on new session')
  it('updates anchor state')
  it('shows user notifications')
});
```

**Deliverable**: Compression layer fully extracted and tested

### Phase 4: Integration & Testing (Week 4)

#### Day 16-17: Orchestrator Refactor
- [ ] Rewrite `useClaudeAgent.ts` as orchestrator
- [ ] Wire up all sub-hooks
- [ ] Write integration tests
- [ ] Verify all features work end-to-end

**Tests**:
```typescript
describe('useClaudeAgent (integration)', () => {
  it('sends message and receives response')
  it('analyzes turns in background')
  it('triggers compression at threshold')
  it('resumes from compressed session')
  it('handles authentication errors')
  it('interrupts query')
});
```

**Deliverable**: Orchestrator complete and tested

#### Day 18-20: End-to-End Testing
**CRITICAL**: Test real compression scenarios

Test scenarios:
1. **Fresh session** - Start TUI, send messages, verify analysis
2. **Compression trigger** - Reach token threshold, verify compression
3. **Resume compressed** - Restart TUI, verify lattice restoration
4. **Multiple compressions** - Compress multiple times in one session
5. **Re-embedding** - Verify background queue doesn't block UI
6. **Session switch** - Verify SDK session ID tracking
7. **Token reset** - Verify token count resets correctly

**Tests**:
```typescript
describe('Compression Workflow (E2E)', () => {
  it('compresses at 120K tokens with 5+ turns')
  it('resets token count after compression')
  it('starts fresh SDK session with recap')
  it('saves lattice with embeddings to LanceDB')
  it('updates anchor state with new SDK session')
  it('resets compression flag when new session starts')
  it('does not re-analyze compressed turns')
});

describe('Session Restoration (E2E)', () => {
  it('loads lattice from disk')
  it('restores embeddings from LanceDB')
  it('rebuilds turn analyses from lattice')
  it('continues analysis for new turns')
  it('does not re-embed existing turns')
});
```

**Deliverable**: Full E2E test coverage

### Phase 5: Polish & Documentation (Week 5)

#### Day 21-22: Bug Fixes & Edge Cases
- [ ] Fix any issues found during E2E testing
- [ ] Add missing error handling
- [ ] Improve logging and debugging
- [ ] Performance profiling

#### Day 23-25: Documentation
- [ ] Document each module's API
- [ ] Create architecture diagrams
- [ ] Write testing guide
- [ ] Update main README

**Deliverables**:
- `docs/architecture/useClaudeAgent.md` - Architecture overview
- `docs/testing/useClaudeAgent.md` - Testing guide
- Inline JSDoc comments for all public APIs

---

## Testing Strategy

### Test Coverage Goals

- **Unit tests**: 100% coverage for all modules
- **Integration tests**: All sub-hook interactions
- **E2E tests**: All critical user workflows
- **Snapshot tests**: Message rendering

### Test Infrastructure

#### Utilities
```typescript
// test/utils/mockSDK.ts
export function createMockQuery(options: Partial<QueryOptions> = {}) {
  // Returns mock Query with async iterator
}

// test/utils/mockEmbedder.ts
export function createMockEmbedder() {
  // Returns mock EmbeddingService
}

// test/utils/testSession.ts
export function createTestSession(anchorId = 'test-session') {
  // Creates temp .sigma directory with state files
}
```

#### Fixtures
```typescript
// test/fixtures/messages.ts
export const sampleUserMessage: ClaudeMessage = { ... };
export const sampleAssistantMessage: ClaudeMessage = { ... };
export const sampleSDKMessages: SDKMessage[] = [ ... ];
```

### Critical Test Cases

#### 1. Compression & Token Reset
**Most buggy area - needs exhaustive testing**

```typescript
describe('Compression + Token Reset (Critical)', () => {
  it('resets token count BEFORE async compression logic', async () => {
    const { result } = renderHook(() => useClaudeAgent(options));

    // Simulate reaching threshold
    act(() => {
      result.current.tokenCount = { input: 60000, output: 60001, total: 120001 };
    });

    // Should reset immediately
    expect(result.current.tokenCount.total).toBe(0);

    // Even if compression async logic is still running
    await waitFor(() => {
      expect(result.current.tokenCount.total).toBe(0);
    });
  });

  it('allows token count to go up from 0 after reset', async () => {
    const { result } = renderHook(() => useClaudeAgent(options));

    // Trigger compression and reset
    act(() => triggerCompression(result));
    expect(result.current.tokenCount.total).toBe(0);

    // Next message should accept any token value (not use Math.max)
    act(() => {
      result.current.processSDKMessage(createMessageDelta({ input: 1000, output: 500 }));
    });

    expect(result.current.tokenCount.total).toBe(1500);
  });

  it('resets compression flag when new SDK session starts', async () => {
    const { result } = renderHook(() => useClaudeAgent(options));

    // Trigger compression
    act(() => triggerCompression(result));

    // Compression flag should be true
    expect(result.current.compressionTriggered).toBe(true);

    // Simulate new SDK session ID arriving
    act(() => {
      result.current.processSDKMessage(createSessionMessage('new-sdk-uuid'));
    });

    // Flag should reset
    expect(result.current.compressionTriggered).toBe(false);
  });
});
```

#### 2. Session State Management
```typescript
describe('Session State (Critical)', () => {
  it('uses anchor ID for file operations, SDK UUID for resume', () => {
    const anchorId = 'my-session';
    const sdkUuid = 'uuid-1234-5678';

    const { result } = renderHook(() => useClaudeAgent({ sessionId: anchorId }));

    // Should create state file with anchor ID
    const stateFile = path.join('.sigma', `${anchorId}.state.json`);
    expect(fs.existsSync(stateFile)).toBe(true);

    // When SDK provides UUID, should use it for resume
    act(() => {
      result.current.processSDKMessage(createSessionMessage(sdkUuid));
    });

    expect(result.current.resumeSessionId).toBe(sdkUuid);
  });
});
```

#### 3. Re-Embedding (Background Queue)
```typescript
describe('Re-Embedding After Compression (Critical)', () => {
  it('does not block UI during re-embedding', async () => {
    const { result } = renderHook(() => useClaudeAgent(options));

    // Load compressed session (needs re-embedding)
    act(() => {
      loadCompressedSession(result, 'compressed-session');
    });

    // Should not block - can still interact
    expect(result.current.isThinking).toBe(false);

    // Background queue should be running
    expect(result.current.analysisQueue.isProcessing).toBe(true);

    // Should show progress
    expect(result.current.analysisQueue.progress).toEqual({
      current: 0,
      total: 50,
    });

    // Wait for completion
    await waitFor(() => {
      expect(result.current.analysisQueue.isProcessing).toBe(false);
    });
  });
});
```

---

## Risk Mitigation

### High-Risk Areas

1. **Compression workflow** - Most complex, most buggy
   - **Mitigation**: Extensive E2E tests, manual testing checklist

2. **Session state persistence** - Data loss risk
   - **Mitigation**: Backup mechanism, migration tests

3. **Token count reset** - Tricky edge cases
   - **Mitigation**: Property-based testing for all edge cases

4. **Background queue** - Concurrency bugs
   - **Mitigation**: Stress tests with many turns

### Rollback Plan

If critical bugs are found:

1. Keep old `useClaudeAgent.ts` as `useClaudeAgent.legacy.ts`
2. Add feature flag to switch between implementations
3. Can rollback with single line change

```typescript
// Rollback mechanism
const USE_LEGACY = process.env.USE_LEGACY_HOOK === 'true';

export const useClaudeAgent = USE_LEGACY
  ? useClaudeAgentLegacy
  : useClaudeAgentRefactored;
```

---

## Success Metrics

### Code Quality
- [ ] Lines per file < 250
- [ ] Cyclomatic complexity < 10 per function
- [ ] Test coverage > 95%
- [ ] No eslint violations

### Performance
- [ ] Turn analysis does not block UI (< 16ms on main thread)
- [ ] Compression triggers within 1 second of threshold
- [ ] Session restoration < 2 seconds

### Reliability
- [ ] Zero token count reset bugs in production
- [ ] Zero data loss from session state
- [ ] Compression workflow succeeds 100% of time

### Developer Experience
- [ ] New features can be added without touching orchestrator
- [ ] Bugs can be isolated to single module
- [ ] All modules have clear documentation

---

## Timeline Summary

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Infrastructure & Foundation | Token + Session modules tested |
| 2 | Core Extraction | SDK + Rendering modules tested |
| 3 | Complex Logic | Analysis + Compression tested |
| 4 | Integration | Orchestrator + E2E tests |
| 5 | Polish | Documentation + Bug fixes |

**Total**: ~5 weeks for complete refactor with comprehensive tests

---

## Next Steps

1. **Review this plan** - Get feedback, adjust priorities
2. **Approve migration** - Confirm we can allocate 5 weeks
3. **Day 1 kickoff** - Set up test infrastructure
4. **Daily standups** - Track progress, identify blockers
5. **Weekly demos** - Show working features, get feedback

---

## Appendix: Testing Checklist

### Unit Test Checklist
- [ ] Token counter reset logic
- [ ] Token counter Math.max logic
- [ ] Session state creation
- [ ] Session state updates
- [ ] Session state migration
- [ ] Compression trigger conditions
- [ ] Compression flag reset
- [ ] Analysis queue ordering
- [ ] Analysis deduplication
- [ ] Embedding cache
- [ ] SDK message parsing (all types)
- [ ] Message rendering (all types)
- [ ] Tool formatting (all tools)

### Integration Test Checklist
- [ ] Token counter + Compression trigger
- [ ] Session manager + SDK query
- [ ] Analysis queue + Overlay population
- [ ] Compression + Session switch
- [ ] SDK messages + Token updates
- [ ] Message handler + Renderer

### E2E Test Checklist
- [ ] Fresh session creation
- [ ] Send message → Analyze → Display
- [ ] Reach threshold → Compress → Switch session
- [ ] Restart → Load lattice → Resume
- [ ] Multiple compressions in one session
- [ ] Authentication error handling
- [ ] Query interruption

---

**Document Version**: 1.0
**Date**: 2025-11-08
**Author**: Refactoring Plan for useClaudeAgent.ts
**Status**: Draft - Pending Review
