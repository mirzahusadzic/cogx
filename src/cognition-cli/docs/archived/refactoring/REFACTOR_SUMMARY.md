# useClaudeAgent.ts Refactoring - Executive Summary

## Problem Statement

The `useClaudeAgent.ts` hook (~1,790 lines) has become the most complex and problematic component in our 50K LOC codebase:

- **10+ responsibilities** crammed into one file
- **No test coverage** for the most critical component
- **Week-long debugging cycles** for compression/session bugs
- **Poor UX** - re-embedding blocks the UI after compression
- **Maintenance nightmare** - changes require understanding 1,800 lines

## Solution Overview

**Decompose** the monolith into **15 focused modules** (~150-250 lines each) with:

✅ **100% test coverage** - unit, integration, and E2E tests
✅ **Clear boundaries** - each module has single responsibility  
✅ **Background processing** - analysis never blocks UI
✅ **Comprehensive docs** - architecture + testing guides

## Key Benefits

### For Development

- **10x faster debugging** - isolate issues to single module
- **Safe refactoring** - tests catch regressions immediately
- **Easy onboarding** - each module is understandable in isolation
- **Parallel development** - teams can work on different modules

### For Users

- **Reliable compression** - tested extensively, no more reset bugs
- **Responsive UI** - background queue prevents blocking
- **Data integrity** - session state fully tested
- **Better error messages** - clear failure modes

### For Testing

- **Fast tests** - unit tests run in <1 second
- **Comprehensive coverage** - >95% code coverage
- **Real scenarios** - E2E tests match actual workflows
- **CI integration** - automated testing on every commit

## Architecture

### Before (Monolith)

```
useClaudeAgent.ts [1,790 lines]
├─ SDK integration
├─ Turn analysis
├─ Compression
├─ Session management
├─ Token counting
├─ Context injection
├─ Overlay population
├─ LanceDB operations
├─ Message rendering
└─ Error handling
```

### After (Modular)

```
useClaudeAgent.ts [150 lines] - Orchestrator
├─ sdk/
│  ├─ useSDKQuery.ts [200 lines]
│  └─ useSDKMessageHandler.ts [250 lines]
├─ analysis/
│  ├─ useTurnAnalysis.ts [200 lines]
│  └─ AnalysisQueue.ts [150 lines] ⭐ NEW
├─ compression/
│  ├─ useCompression.ts [200 lines]
│  └─ CompressionTrigger.ts [100 lines]
├─ session/
│  ├─ useSessionManager.ts [200 lines]
│  └─ SessionStateStore.ts [150 lines]
├─ tokens/
│  ├─ useTokenCount.ts [100 lines]
│  └─ TokenCounter.ts [80 lines]
└─ rendering/
   ├─ MessageRenderer.ts [200 lines]
   └─ ToolFormatter.ts [150 lines]
```

## Critical Improvements

### 1. Background Analysis Queue ⭐

**Problem**: Re-embedding after compression blocks UI for 10+ seconds

**Solution**: Background queue with progress indicator

```typescript
class AnalysisQueue {
  async add(turn: ConversationTurn) {
    this.queue.push(turn);
    this.processQueue(); // Non-blocking!
  }
}
```

**Impact**: UI remains responsive, progress visible to user

### 2. Isolated Token Counter

**Problem**: Token reset bug fixed twice, still fragile

**Solution**: Dedicated module with clear reset semantics

```typescript
const reset = () => {
  setCount({ input: 0, output: 0, total: 0 });
  justReset.current = true; // Bypass Math.max once
};
```

**Impact**: Reset logic testable in isolation, no more bugs

### 3. Session State Store

**Problem**: Session ID confusion (anchor vs SDK UUID)

**Solution**: Dedicated store with clear ID mapping

```typescript
class SessionStateStore {
  updateSession(anchorId: string, sdkUuid: string, reason: string);
  load(anchorId: string): SessionState | null;
}
```

**Impact**: Clear semantics, tested thoroughly

### 4. Compression Trigger

**Problem**: Compression flag management is brittle

**Solution**: Dedicated trigger with clear logic

```typescript
class CompressionTrigger {
  shouldTrigger(tokens: number, turns: number): boolean;
  reset(): void;
}
```

**Impact**: Trigger logic testable, easy to modify thresholds

## Test Coverage

### Unit Tests (95%+ coverage)

- All modules tested in isolation
- Edge cases covered
- Fast execution (<1s)

### Integration Tests

- SDK ↔ Token updates
- Analysis ↔ Compression
- Session ↔ SDK query
- All interactions tested

### E2E Tests

- Fresh session creation
- Compression workflow
- Session restoration
- Multiple compressions
- Re-embedding background
- Error scenarios

## Timeline

| Week | Focus           | Deliverable                    |
| ---- | --------------- | ------------------------------ |
| 1    | Infrastructure  | Token + Session modules tested |
| 2    | Core Extraction | SDK + Rendering modules tested |
| 3    | Complex Logic   | Analysis + Compression tested  |
| 4    | Integration     | Orchestrator + E2E tests       |
| 5    | Polish          | Documentation + Bug fixes      |

**Total**: 5 weeks for complete refactor with comprehensive tests

## Risk Mitigation

### Rollback Mechanism

```typescript
const USE_LEGACY = process.env.USE_LEGACY_HOOK === 'true';
export const useClaudeAgent = USE_LEGACY
  ? useClaudeAgentLegacy
  : useClaudeAgentRefactored;
```

Can rollback instantly if critical bugs found.

### Incremental Migration

- Each module extracted and tested independently
- Old code remains until replacement verified
- Can pause/resume at any point

### Comprehensive Testing

- Every change tested before deployment
- E2E tests match real-world scenarios
- Manual testing checklist for final validation

## Success Metrics

### Code Quality

✅ Lines per file < 250  
✅ Cyclomatic complexity < 10  
✅ Test coverage > 95%  
✅ Zero eslint violations

### Performance

✅ Turn analysis < 200ms  
✅ Compression < 5 seconds  
✅ Session load < 2 seconds  
✅ UI never blocks

### Reliability

✅ Zero token reset bugs  
✅ Zero data loss  
✅ 100% compression success rate  
✅ Clear error messages

## Next Steps

1. ✅ **Review plan** - Get team feedback
2. ✅ **Approve timeline** - Confirm 5-week allocation
3. **Day 1 kickoff** - Set up test infrastructure
4. **Weekly demos** - Show progress, get feedback
5. **Final validation** - Manual testing checklist

## Documents

- **[REFACTOR_PLAN_useClaudeAgent.md](./REFACTOR_PLAN_useClaudeAgent.md)** - Detailed technical plan
- **[TESTING_GUIDE_useClaudeAgent.md](../testing/TESTING_GUIDE_useClaudeAgent.md)** - Comprehensive testing guide

---

**Status**: Ready for Implementation  
**Owner**: Development Team  
**Timeline**: 5 weeks  
**Priority**: High (addresses critical pain points)
