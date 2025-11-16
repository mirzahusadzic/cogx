# useClaudeAgent Refactor - Quick Reference

## TL;DR

**Problem**: 1,790-line monolith, no tests, week-long bug hunts
**Solution**: 15 focused modules, 100% tested, background processing
**Timeline**: 5 weeks
**Risk**: Low (incremental, rollback ready)

---

## Module Breakdown

| Module               | Lines | Responsibility         | Key Feature             |
| -------------------- | ----- | ---------------------- | ----------------------- |
| **useClaudeAgent**   | 150   | Orchestration          | Compose sub-hooks       |
| useSDKQuery          | 200   | SDK lifecycle          | Query management        |
| useSDKMessageHandler | 250   | Message processing     | Session ID extraction   |
| useTurnAnalysis      | 200   | Analysis orchestration | Embedding cache         |
| **AnalysisQueue** ⭐ | 150   | Background queue       | Non-blocking processing |
| useCompression       | 200   | Compression workflow   | Lattice persistence     |
| CompressionTrigger   | 100   | Trigger logic          | Threshold detection     |
| useSessionManager    | 200   | Session state          | ID mapping              |
| SessionStateStore    | 150   | State persistence      | File operations         |
| useTokenCount        | 100   | Token tracking         | Reset semantics         |
| TokenCounter         | 80    | Counter logic          | Math.max handling       |
| MessageRenderer      | 200   | Message display        | Color stripping         |
| ToolFormatter        | 150   | Tool display           | Diff generation         |

**Total**: ~2,300 lines (split into 15 modules)

---

## Critical Fixes

### 1. Background Analysis Queue

**Before**: Re-embedding blocks UI for 10+ seconds
**After**: Background queue with progress bar
**Impact**: Responsive UI, better UX

### 2. Token Reset Logic

**Before**: Reset bug fixed twice, still fragile
**After**: Isolated module, fully tested
**Impact**: No more reset bugs

### 3. Session ID Mapping

**Before**: Anchor ID vs SDK UUID confusion
**After**: Clear separation, tested thoroughly
**Impact**: No more session state bugs

### 4. Compression Trigger

**Before**: Flag management brittle
**After**: Dedicated class, clear logic
**Impact**: Easy to test, modify thresholds

---

## Testing Strategy

### Coverage Targets

- **Unit**: 95%+ (all modules)
- **Integration**: All sub-hook interactions
- **E2E**: All critical workflows

### Test Categories

| Type        | Count | Purpose                |
| ----------- | ----- | ---------------------- |
| Unit        | ~50   | Module isolation       |
| Integration | ~15   | Hook interactions      |
| E2E         | ~10   | Real workflows         |
| Manual      | ~20   | Pre-release validation |

### Key Test Scenarios

- Fresh session creation ✓
- Compression at threshold ✓
- Token reset after compression ✓
- Session restoration ✓
- Multiple compressions ✓
- Background re-embedding ✓
- Error handling ✓

---

## Migration Phases

### Week 1: Foundation

✅ Test infrastructure
✅ Token management
✅ Session management

### Week 2: Core

✅ SDK layer
✅ Rendering layer

### Week 3: Complex

✅ Analysis + Background queue
✅ Compression

### Week 4: Integration

✅ Orchestrator
✅ E2E tests

### Week 5: Polish

✅ Bug fixes
✅ Documentation

---

## Code Examples

### Orchestrator Pattern

```typescript
export function useClaudeAgent(options: UseClaudeAgentOptions) {
  const sessionManager = useSessionManager(options);
  const tokenCounter = useTokenCount();
  const analysisQueue = useTurnAnalysis(sessionManager.currentSessionId);
  const compressionTrigger = useCompression(
    tokenCounter.total,
    analysisQueue.analyses
  );

  return {
    messages: sdkQuery.messages,
    sendMessage: sdkQuery.sendMessage,
    tokenCount: tokenCounter.count,
    // ...
  };
}
```

### Background Queue

```typescript
class AnalysisQueue {
  async add(turn: ConversationTurn) {
    this.queue.push(turn);
    this.processQueue(); // Non-blocking!
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

### Token Reset

```typescript
export function useTokenCount() {
  const [count, setCount] = useState({ input: 0, output: 0, total: 0 });
  const justReset = useRef(false);

  const reset = () => {
    setCount({ input: 0, output: 0, total: 0 });
    justReset.current = true; // Bypass Math.max on next update
  };

  const update = (newCount: TokenCount) => {
    setCount((prev) => {
      if (justReset.current) {
        justReset.current = false;
        return newCount; // Accept any value
      }
      return newCount.total > prev.total ? newCount : prev; // Math.max
    });
  };

  return { count, reset, update };
}
```

---

## Risk Mitigation

### Rollback Ready

```typescript
const USE_LEGACY = process.env.USE_LEGACY_HOOK === 'true';
export const useClaudeAgent = USE_LEGACY
  ? useClaudeAgentLegacy
  : useClaudeAgentRefactored;
```

### Incremental Migration

- Extract one module at a time
- Test thoroughly before moving on
- Can pause/resume at any phase

### Comprehensive Testing

- Unit tests for all modules
- Integration tests for interactions
- E2E tests for workflows
- Manual checklist for validation

---

## Success Criteria

### Must Have

✅ 95%+ test coverage
✅ All modules < 250 lines
✅ Zero token reset bugs
✅ Background queue working
✅ All E2E tests passing

### Nice to Have

✅ <100 lines per function
✅ <10 cyclomatic complexity
✅ Performance benchmarks met
✅ CI/CD integrated

---

## Documents

| Document                                                                          | Purpose                 | Audience            |
| --------------------------------------------------------------------------------- | ----------------------- | ------------------- |
| **[REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md)**                                  | Executive summary       | Leadership, Product |
| **[REFACTOR_PLAN_useClaudeAgent.md](./REFACTOR_PLAN_useClaudeAgent.md)**          | Detailed technical plan | Engineering         |
| **[TESTING_GUIDE_useClaudeAgent.md](../testing/TESTING_GUIDE_useClaudeAgent.md)** | Testing procedures      | QA, Engineering     |
| **This file**                                                                     | Quick reference         | Everyone            |

---

## Commands

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific module tests
npm test -- tokens/useTokenCount.test.ts

# Run E2E tests only
npm test -- e2e/

# Watch mode (development)
npm test -- --watch

# CI mode
npm test -- --run --coverage
```

---

## Key Decisions

### Why Split into 15 Modules?

- Each module < 250 lines (readable in one session)
- Single responsibility per module
- Independent testing
- Clear boundaries

### Why Background Queue?

- Prevents UI blocking (critical UX issue)
- Progress feedback to user
- Can be paused/resumed
- Error isolation

### Why 5 Weeks?

- Week 1-2: Low-risk foundation (35% complete)
- Week 3: High-risk complex logic (65% complete)
- Week 4: Integration + E2E (90% complete)
- Week 5: Polish + validation (100% complete)

### Why Not Rewrite from Scratch?

- Too risky (lose working features)
- Hard to test against moving target
- Incremental migration is safer
- Can rollback at any point

---

## FAQs

**Q: Can we do it faster?**
A: Not safely. Testing is 60% of the work.

**Q: What if we find critical bugs?**
A: Rollback mechanism + legacy hook stays intact

**Q: How do we know it works?**
A: 75+ tests + manual checklist + E2E scenarios

**Q: What's the biggest risk?**
A: Compression workflow (most complex). Mitigated with extensive E2E tests.

**Q: Can we pause mid-migration?**
A: Yes. Each phase is independently deliverable.

---

**Last Updated**: 2025-11-08
**Status**: Ready for Review
**Next Step**: Team approval → Day 1 kickoff
