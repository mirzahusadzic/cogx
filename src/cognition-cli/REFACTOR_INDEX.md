# useClaudeAgent Refactoring - Complete Documentation Index

This directory contains a comprehensive plan for refactoring the `useClaudeAgent.ts` hook (1,790 lines) into a modular, testable, and maintainable architecture.

---

## 📋 Quick Links

| Document | Size | Purpose | Audience |
|----------|------|---------|----------|
| **[REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md)** | 6.3K | Executive overview | Leadership, Product |
| **[REFACTOR_QUICK_REFERENCE.md](./REFACTOR_QUICK_REFERENCE.md)** | 7.2K | Quick reference card | Everyone |
| **[REFACTOR_PLAN_useClaudeAgent.md](./REFACTOR_PLAN_useClaudeAgent.md)** | 24K | Detailed technical plan | Engineering |
| **[TESTING_GUIDE_useClaudeAgent.md](./TESTING_GUIDE_useClaudeAgent.md)** | 24K | Testing procedures | QA, Engineering |
| **[REFACTOR_ARCHITECTURE_DIAGRAM.md](./REFACTOR_ARCHITECTURE_DIAGRAM.md)** | 17K | Visual architecture | Engineering, Architects |

**Total Documentation**: 84K (~20,000 words)

---

## 🎯 Problem Statement

The `useClaudeAgent.ts` hook has become the most problematic component in our 50K LOC codebase:

- **1,790 lines** - Largest file by 2.5x
- **10+ responsibilities** - Violates single responsibility principle
- **0% test coverage** - No tests for most critical component
- **Week-long debugging** - Compression/session bugs persist
- **UI blocking** - Re-embedding blocks UI for 10+ seconds
- **Maintenance nightmare** - Changes require understanding entire file

---

## 💡 Solution Overview

**Decompose** the monolith into **15 focused modules** with:

✅ **100% test coverage** (unit, integration, E2E)
✅ **Clear boundaries** (single responsibility per module)
✅ **Background processing** (analysis never blocks UI)
✅ **Comprehensive docs** (architecture + testing guides)
✅ **Rollback ready** (feature flag for safety)

---

## 📖 Reading Guide

### For Leadership / Product Managers
**Start here**: [REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md)
- Problem statement and business impact
- High-level solution overview
- Timeline (5 weeks)
- Risk mitigation
- Success metrics

**Then**: [REFACTOR_QUICK_REFERENCE.md](./REFACTOR_QUICK_REFERENCE.md)
- Quick reference for key concepts
- Module breakdown
- Critical improvements
- FAQs

### For Engineers (Implementation)
**Start here**: [REFACTOR_PLAN_useClaudeAgent.md](./REFACTOR_PLAN_useClaudeAgent.md)
- Detailed architecture design
- Module responsibilities
- Migration strategy (5 phases)
- Code examples
- Known issues analysis

**Then**: [REFACTOR_ARCHITECTURE_DIAGRAM.md](./REFACTOR_ARCHITECTURE_DIAGRAM.md)
- Visual architecture diagrams
- Data flow charts
- Module dependencies
- Before/after comparisons

**Finally**: [TESTING_GUIDE_useClaudeAgent.md](./TESTING_GUIDE_useClaudeAgent.md)
- Test infrastructure setup
- Mock utilities
- Unit test examples
- Integration test patterns
- E2E test scenarios
- Manual testing checklist

### For QA / Test Engineers
**Start here**: [TESTING_GUIDE_useClaudeAgent.md](./TESTING_GUIDE_useClaudeAgent.md)
- Comprehensive testing procedures
- Test coverage goals (>95%)
- Manual testing checklist
- Performance benchmarks

**Then**: [REFACTOR_PLAN_useClaudeAgent.md](./REFACTOR_PLAN_useClaudeAgent.md) (Section: Testing Strategy)
- Test categories and priorities
- Critical test cases
- Bug scenarios

---

## 🏗️ Architecture Overview

### Current (Monolith)
```
useClaudeAgent.ts [1,790 lines]
└─ Everything (10+ responsibilities)
```

### Target (Modular)
```
useClaudeAgent.ts [150 lines] - Orchestrator
├─ sdk/ [450 lines] - SDK integration
├─ analysis/ [350 lines] - Turn analysis + Background queue ⭐
├─ compression/ [300 lines] - Compression orchestration
├─ session/ [350 lines] - Session state management
├─ tokens/ [180 lines] - Token counting
└─ rendering/ [350 lines] - Message/tool rendering
```

**Total**: ~2,300 lines in 15 focused modules

---

## 🎯 Key Improvements

### 1. Background Analysis Queue ⭐
**Problem**: Re-embedding blocks UI for 10+ seconds
**Solution**: Background queue with progress bar
**Impact**: Responsive UI, better UX

### 2. Isolated Token Counter
**Problem**: Reset bug fixed twice, still fragile
**Solution**: Dedicated module with clear semantics
**Impact**: No more reset bugs

### 3. Session State Store
**Problem**: Anchor ID vs SDK UUID confusion
**Solution**: Clear ID mapping, tested thoroughly
**Impact**: No more session state bugs

### 4. Compression Trigger
**Problem**: Flag management brittle
**Solution**: Dedicated class with clear logic
**Impact**: Easy to test, modify thresholds

---

## 📅 Timeline

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Infrastructure | Token + Session modules tested |
| 2 | Core Extraction | SDK + Rendering modules tested |
| 3 | Complex Logic | Analysis + Compression tested |
| 4 | Integration | Orchestrator + E2E tests |
| 5 | Polish | Documentation + Bug fixes |

**Total**: 5 weeks

---

## ✅ Success Metrics

### Code Quality
- Lines per file < 250 ✅
- Cyclomatic complexity < 10 ✅
- Test coverage > 95% ✅
- Zero eslint violations ✅

### Performance
- Turn analysis < 200ms ✅
- Compression < 5 seconds ✅
- Session load < 2 seconds ✅
- UI never blocks ✅

### Reliability
- Zero token reset bugs ✅
- Zero data loss ✅
- 100% compression success ✅
- Clear error messages ✅

---

## 🔒 Risk Mitigation

### Rollback Mechanism
```typescript
const USE_LEGACY = process.env.USE_LEGACY_HOOK === 'true';
export const useClaudeAgent = USE_LEGACY
  ? useClaudeAgentLegacy
  : useClaudeAgentRefactored;
```

### Incremental Migration
- Each module extracted independently
- Tests before moving forward
- Can pause/resume at any phase

### Comprehensive Testing
- 50+ unit tests
- 15 integration tests
- 10 E2E tests
- Manual testing checklist

---

## 📝 Document Summaries

### REFACTOR_SUMMARY.md
**Executive Summary** - For leadership and product managers
- Problem statement with business impact
- Solution overview with benefits
- Architecture comparison (before/after)
- Key improvements (background queue, token counter, etc.)
- Test coverage summary
- Timeline and risk mitigation
- Success metrics

### REFACTOR_QUICK_REFERENCE.md
**Quick Reference Card** - For everyone
- TL;DR summary
- Module breakdown table
- Critical fixes summary
- Testing strategy overview
- Migration phases
- Code examples
- FAQs

### REFACTOR_PLAN_useClaudeAgent.md
**Detailed Technical Plan** - For engineering team
- Current state analysis (responsibilities, issues, metrics)
- Target architecture (15 modules, 2,300 lines)
- Module responsibilities (detailed specs for each)
- Migration strategy (5 phases, day-by-day)
- Testing strategy (unit, integration, E2E)
- Risk mitigation
- Success metrics

### TESTING_GUIDE_useClaudeAgent.md
**Comprehensive Testing Guide** - For QA and engineering
- Test infrastructure setup
- Test utilities (mocks, fixtures, helpers)
- Unit test examples (all modules)
- Integration test patterns
- E2E test scenarios
- Manual testing checklist
- Performance benchmarks
- CI/CD integration

### REFACTOR_ARCHITECTURE_DIAGRAM.md
**Visual Architecture** - For architects and engineers
- Current state diagram (monolith)
- Target state diagram (modular)
- Data flow charts (compression workflow)
- Testing pyramid
- Module dependencies graph
- Critical path analysis (bug fix)
- Background queue flow
- File structure tree
- Success metrics dashboard

---

## 🚀 Next Steps

1. **Review** - Team reviews all documents
2. **Approve** - Confirm 5-week timeline
3. **Kickoff** - Day 1: Set up test infrastructure
4. **Execute** - Follow migration plan week by week
5. **Validate** - Manual testing checklist before release

---

## 📊 Test Coverage

### Unit Tests (50+)
- Token reset logic
- Session state operations
- Compression triggers
- Analysis queue ordering
- Message rendering
- Tool formatting
- SDK message parsing

### Integration Tests (15)
- SDK ↔ Token updates
- Analysis ↔ Compression
- Session ↔ SDK query
- All hook interactions

### E2E Tests (10)
- Fresh session creation
- Compression workflow
- Session restoration
- Multiple compressions
- Re-embedding background
- Error scenarios

---

## 💬 FAQs

**Q: Can we do it faster?**
A: Not safely. Testing is 60% of the work.

**Q: What if we find critical bugs?**
A: Rollback mechanism + legacy hook stays intact.

**Q: How do we know it works?**
A: 75+ tests + manual checklist + E2E scenarios.

**Q: What's the biggest risk?**
A: Compression workflow (most complex). Mitigated with extensive E2E tests.

**Q: Can we pause mid-migration?**
A: Yes. Each phase is independently deliverable.

---

## 📞 Contact

For questions or clarifications:
- Technical: See [REFACTOR_PLAN_useClaudeAgent.md](./REFACTOR_PLAN_useClaudeAgent.md)
- Testing: See [TESTING_GUIDE_useClaudeAgent.md](./TESTING_GUIDE_useClaudeAgent.md)
- Architecture: See [REFACTOR_ARCHITECTURE_DIAGRAM.md](./REFACTOR_ARCHITECTURE_DIAGRAM.md)

---

**Status**: Ready for Implementation
**Last Updated**: 2025-11-08
**Version**: 1.0
