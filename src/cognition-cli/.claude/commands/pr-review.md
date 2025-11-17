# PR Review - Comprehensive Impact Analysis

When the user asks for PR review or impact analysis, use the PGC pr-analyze command which combines all overlays: O₁ (Structure) + O₂ (Security) + O₃ (Blast Radius) + O₄ (Mission) + O₇ (Coherence).

## Analysis Steps

**IMPORTANT**: Use the `cognition-cli pr-analyze` command which automatically analyzes across all overlays.

### Step 1: Check Git Status (Optional Context)

Optionally check what changed:

```bash
git status
git diff --stat main
```

### Step 2: Run PR Analysis

Run the comprehensive PR analysis:

```bash
cognition-cli pr-analyze --json
```

For specific branch:

```bash
cognition-cli pr-analyze --branch feature/your-branch --json
```

This command outputs:

- `structural_changes`: Modified/added/removed symbols from O₁
- `security_threats`: Applicable vulnerabilities from O₂
- `blast_radius`: Dependency impact from O₃
- `mission_alignment`: Related concepts from O₄
- `coherence_impact`: Alignment changes from O₇
- `risk_score`: Combined 0-100 risk assessment
- `recommendation`: APPROVE / APPROVE_WITH_CONDITIONS / REQUEST_CHANGES

### Step 3: Parse and Enhance Output

Take the JSON and expand into comprehensive PR review.

## Report Structure

```text
## 📦 PR Review: <branch-name from JSON>

### Overview
- Files changed: <count from structural_changes>
- Symbols modified: <count>
- Risk score: <risk_score>/100
- Recommendation: <recommendation>

---

## Structural Changes (O₁)

**From structural_changes field**:

### Modified Symbols: <count>
[List modified symbols]:
- `<symbol>` in `<file>`
  - Role: <architecturalRole>
  - Change type: <change-type>

### Added Symbols: <count>
[List new symbols]

### Removed Symbols: <count>
[List removed symbols]

**Architectural Impact**: <assess based on roles and counts>
- ✅ Clean refactor
- ⚠️ Concerns: <list any red flags>
- ❌ Critical issues: <list breaking changes>

---

## Security Analysis (O₂)

**From security_threats field**:

**Applicable Threats**: <count>
**Severity Breakdown**:
- Critical: <count>
- High: <count>
- Medium: <count>
- Low: <count>

### Key Threats:
[For each threat]:
- **<securityType>**: <cveId if present> (severity: <severity>, similarity: <similarity>%)
  - Description: <description>
  - Affected: <affected symbols/files>
  - Mitigation: <mitigation>

**Status**:
- ✅ No security concerns
- ⚠️ Review recommended: <concerns>
- ❌ CRITICAL: <blockers>

---

## Blast Radius (O₃)

**From blast_radius field**:

**Direct Consumers Affected**: <count>
**Total Impact**: <transitive_impact> symbols
**Max Dependency Depth**: <max_depth>

### Critical Paths Affected:
[For each critical_path]:
- <path[0]> → <path[1]> → ... → <path[n]>
  - Reason: <reason>
  - Impact: <explain>

**Testing Requirements**:
Based on consumers, test:
[List critical consumers that need testing]

---

## Mission Alignment (O₄)

**From mission_alignment field**:

**Related Concepts**: <count>
**Alignment Confidence**: <confidence>%

### Key Concepts Addressed:
[For each concept]:
- **<concept-name>**: <description>
  - Relevance: <similarity>%
  - Alignment: <how PR addresses this>

**Status**:
- ✅ Strongly aligned with mission
- ⚠️ Partially aligned: <gaps>
- ❌ Misaligned: <concerns>

---

## Coherence Impact (O₇)

**From coherence_impact field**:

**Symbols Improving**: <count>
**Symbols Degrading**: <count>
**Net Coherence Change**: <net_change>%

**Analysis**:
[Parse coherence changes]:
- ✅ Improves overall alignment
- → Neutral impact
- ⚠️ Creates drift: <concerns>
- ❌ Significant drift: <blockers>

---

## Overall Assessment

### Risk Score: <risk_score>/100

**Risk Breakdown**:
- Structural complexity: <level>
- Security exposure: <level>
- Blast radius: <level>
- Mission drift: <level>

### Merge Decision

<recommendation from JSON>

**Reasoning**: <explain based on risk factors>

**Conditions** (if APPROVE_WITH_CONDITIONS):
1. <condition from JSON>
2. <condition from JSON>

**Blockers** (if REQUEST_CHANGES):
1. <blocker from JSON>
2. <blocker from JSON>

---

## Testing Requirements

### Based on Blast Radius (O₃):
[List symbols from critical paths]:
- Test `<consumer>`: <why based on role>
- Test `<another-consumer>`: <why>

### Based on Security (O₂):
[For each security threat]:
- [ ] Test <vulnerability-type>: <specific test case>

### Integration Tests:
[Based on critical paths]:
- [ ] End-to-end path: <path description>

---

## Recommendations

[Use recommendations array from JSON]:
1. <recommendation[0]>
2. <recommendation[1]>
3. <recommendation[2]>

### Before Merging:
- [ ] Run full test suite
- [ ] Security review if risk score > 70
- [ ] Update documentation for new symbols
- [ ] Verify blast radius testing complete

### Post-Merge Actions:
- Monitor: <metrics from blast radius>
- Update: <docs to refresh>
- Communicate: <teams affected by blast radius>

---

## Executive Summary

| Metric | Value | Severity |
|--------|-------|----------|
| **Files Changed** | <count> | <level> |
| **Symbols Modified** | <count> | <level> |
| **Security Threats** | <count> | <level> |
| **Blast Radius** | <transitive_impact> | <level> |
| **Risk Score** | <risk_score>/100 | <level> |
| **Recommendation** | <recommendation> | <level> |

**Key Points**:
- <Most critical finding>
- <Second most important>
- <Third priority>
```

## Grounding Requirements

**MUST USE PGC COMMAND**:

1. ✅ Run `cognition-cli pr-analyze --json`
2. ✅ Parse the JSON output
3. ✅ Use ONLY data from command output
4. ✅ Expand into comprehensive review format
5. ❌ Do NOT read source files
6. ❌ Do NOT invent issues not in JSON
7. ❌ Do NOT provide generic code review

**If command fails**:

- Check: `cognition-cli status`
- Tell user to run `cognition-cli wizard` if PGC not initialized
- Ensure git is clean or has changes to analyze

## Example Usage

User: "Please review my PR"

**Step 1**: Run command

```bash
cognition-cli pr-analyze --json
```

**Step 2**: Parse JSON output

```json
{
  "branch": "feature/auth-refactor",
  "structural_changes": {
    "modified": [...],
    "added": [...],
    "removed": [...]
  },
  "security_threats": {
    "count": 2,
    "threats": [...]
  },
  "blast_radius": {
    "direct_consumers": 5,
    "transitive_impact": 23,
    "critical_paths": [...]
  },
  "mission_alignment": {
    "concepts": [...],
    "confidence": 0.85
  },
  "coherence_impact": {
    "improving": 3,
    "degrading": 1,
    "net_change": 0.02
  },
  "risk_score": 45,
  "recommendation": "APPROVE_WITH_CONDITIONS",
  "conditions": [...]
}
```

**Step 3**: Format into comprehensive review

User: "Should I merge this?"

**Answer based on recommendation field**:

- `APPROVE`: "Yes, safe to merge" + explain why
- `APPROVE_WITH_CONDITIONS`: "Yes, but first..." + list conditions
- `REQUEST_CHANGES`: "No, blockers found" + list blockers

## What Makes a Good Review

✅ **DO**:

- Use all data from JSON
- Explain risk score components
- Provide clear merge decision
- List actionable conditions/blockers
- Prioritize by severity + impact

❌ **DON'T**:

- Add info not in JSON
- Read source files
- Invent concerns
- Provide generic advice
- Override recommendation without clear reasoning

The goal is to take PGC multi-overlay analysis and present it as a professional PR review.

## CI/CD Integration Example

```bash
# In GitHub Actions
RISK=$(cognition-cli pr-analyze --json | jq -r '.risk_score')
RECOMMENDATION=$(cognition-cli pr-analyze --json | jq -r '.recommendation')

if [ "$RISK" -gt 70 ]; then
  echo "❌ Risk score too high: $RISK"
  exit 1
fi

if [ "$RECOMMENDATION" = "REQUEST_CHANGES" ]; then
  echo "⚠️ PR analysis recommends changes"
  exit 1
fi
```
