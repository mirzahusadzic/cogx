# Quest Verify

Verify quest progress and check for alignment drift.

## Your Task

1. **Check current coherence** and compare with baseline
2. **Identify any drift** in symbol alignment
3. **Check blast radius** of changes
4. **Verify security coverage** maintained or improved
5. **Validate against patterns** from O₅

## Commands to Run

```bash
# 1. Current coherence report
cognition-cli coherence report

# 2. Check for newly drifted symbols
cognition-cli coherence drifted --limit 10

# 3. Check alignment of modified code
cognition-cli coherence aligned --min-score 0.6

# 4. Security coverage check
cognition-cli security coverage-gaps --limit 20

# 5. Check status
cognition-cli status
```

## Analysis

Compare metrics with quest baseline:

**Coherence Delta**:

- Baseline: [Baseline %]
- Current: [Current %]
- Change: [+/- %] ← Should be ≥0

**Symbol Alignment**:

- New aligned symbols: [Count]
- New drifted symbols: [Count] ← Should be 0
- Net change: [+/- count]

**Security Coverage**:

- New gaps: [Count] ← Should be 0
- Closed gaps: [Count]

**Pattern Compliance**:
[Check if changes follow O₅ patterns]

## Verdict

✅ **PASS** - Ready to commit

- Coherence maintained or improved
- No new drift introduced
- Security coverage maintained
- Follows established patterns

⚠️ **WARNING** - Review recommended

- [List specific concerns]
- [Suggest fixes]

❌ **FAIL** - Do not commit

- [Critical issues found]
- [Required fixes before proceeding]

---

[Provide specific recommendations for any issues found]
