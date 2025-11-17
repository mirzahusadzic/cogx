# PR Review

Perform comprehensive PR impact analysis across all 7 overlays (O₁+O₂+O₃+O₄+O₇).

## Your Task

1. **Analyze structural changes** - What code changed? (O₁)
2. **Check security threats** - Any new attack vectors? (O₂)
3. **Calculate blast radius** - What depends on these changes? (O₃)
4. **Verify mission alignment** - Does it serve the mission? (O₄)
5. **Assess coherence impact** - Will this improve or hurt alignment? (O₇)
6. **Make merge recommendation** - Should this PR be merged?

## Commands to Run

```bash
# Full PR impact analysis (recommended)
cognition-cli pr-analyze

# Analyze specific branch
cognition-cli pr-analyze --branch feature/auth-refactor

# Get JSON output for CI/CD
cognition-cli pr-analyze --json

# Check current git status
git status
git diff --stat main
```

## PR Impact Analysis

**Branch**: [branch-name]
**Files Changed**: [count]
**Risk Score**: [0-100]

### 📦 Structural Changes (O₁)

**Symbols Modified**:
[List classes/functions changed]

**Symbols Added**:
[List new classes/functions]

**Symbols Removed**:
[List deleted classes/functions]

**Architectural Impact**:

- ✅ Clean refactor / No major structural changes
- ⚠️ [Describe architectural concerns]
- ❌ [Critical structural issues]

### 🔒 Security Threats (O₂)

**Applicable Threats**: [count]

[List security threats from O₂ that apply]

**Severity Breakdown**:

- Critical: [count]
- High: [count]
- Medium: [count]
- Low: [count]

**Security Status**:

- ✅ No security concerns identified
- ⚠️ [Security considerations to address]
- ❌ [CRITICAL: Security vulnerabilities found]

### 🎯 Blast Radius (O₃)

**Direct Consumers**: [count]
**Transitive Impact**: [total symbols affected]
**Max Dependency Depth**: [depth]

**Critical Paths**:
[List high-impact dependency chains]

**Testing Requirements**:
[List files/modules that need testing based on blast radius]

### 🎨 Mission Alignment (O₄)

**Related Concepts**: [count]
**Alignment Confidence**: [X%]

**Mission Concepts Addressed**:
[List mission concepts from O₄ related to these changes]

**Alignment Assessment**:

- ✅ Strongly aligned with mission
- ⚠️ Partially aligned: [explain]
- ❌ Not aligned: [explain why]

### 📊 Coherence Impact (O₇)

**Symbols Improving**: [count]
**Symbols Degrading**: [count]
**Net Coherence Change**: [+X% / -X%]

**Coherence Analysis**:

- ✅ Improves overall alignment
- → Neutral impact
- ⚠️ [Describe drift concerns]
- ❌ Creates significant drift

## Overall Assessment

**Risk Score**: [0-100] (0=safe, 100=dangerous)

**Risk Factors**:

- Structural complexity: [Low/Medium/High]
- Security exposure: [Low/Medium/High]
- Blast radius: [Small/Medium/Large]
- Mission drift risk: [Low/Medium/High]

**Should Merge?**

- ✅ **YES** - Safe to merge
  - Reason: [Why it's safe]
  - Conditions: [Any requirements before merge]

- ⚠️ **YES (with conditions)**
  - Requirements before merge:
    1. [Action item]
    2. [Action item]

- ❌ **NO** - Do not merge
  - Blockers:
    1. [Critical issue]
    2. [Critical issue]
  - Required changes: [What needs to be fixed]

## Recommendations

### Before Merging

1. [ ] Run full test suite
2. [ ] Security review if score > 50
3. [ ] Update documentation for new features
4. [ ] Verify blast radius testing complete
5. [ ] Check mission alignment satisfactory
6. [ ] Review coherence impact

### Required Tests

**Based on Blast Radius**:
[List specific test scenarios based on O₃ consumers]

**Based on Security**:
[List security tests based on O₂ threats]

### Post-Merge Actions

1. Monitor: [Specific metrics to watch]
2. Update: [Documentation to refresh]
3. Communicate: [Teams to notify based on blast radius]

## CI/CD Integration

```bash
# Add to your CI pipeline
cognition-cli pr-analyze --json | jq '.risk_score'

# Fail build if risk score > threshold
RISK=$(cognition-cli pr-analyze --json | jq -r '.risk_score')
if [ "$RISK" -gt 70 ]; then
  echo "❌ Risk score too high: $RISK"
  exit 1
fi
```

## Related Commands

- `/analyze-impact` - Analyze specific symbol impact
- `/security-check` - Deep security analysis
- `/check-alignment` - Verify mission alignment
- `/quest-verify` - Full verification workflow

---

**PRO TIP**: Run this before requesting PR review to catch issues early!
