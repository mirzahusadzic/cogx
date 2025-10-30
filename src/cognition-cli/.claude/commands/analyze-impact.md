# Analyze Impact

Analyze the blast radius and impact of changes to a file or symbol.

## Your Task

1. **Calculate blast radius** - what depends on this?
2. **Find similar patterns** - are there related implementations?
3. **Check security implications** - does this touch security boundaries?
4. **Identify affected workflows** - which O₅ patterns use this?
5. **Assess coherence impact** - will this affect alignment?

## Commands to Run

```bash
# 1. Blast radius analysis
cognition-cli blast-radius [FILE_PATH]:[SYMBOL_NAME]

# 2. Find similar code patterns
cognition-cli patterns similar "[SYMBOL_NAME]"

# 3. Check if symbol has security coverage
cognition-cli lattice "O2" | grep -i "[SYMBOL_NAME]"

# 4. Find related workflows
cognition-cli lattice "O5[workflow]" --format summary

# 5. Check current alignment
cognition-cli coherence list | grep -i "[SYMBOL_NAME]"
```

## Impact Analysis

**Direct Dependencies**:
[List files/symbols that directly depend on this]

**Transitive Dependencies**:
[Estimate number of indirectly affected files]

**Similar Patterns**:
[List similar implementations that might need parallel changes]

**Security Implications**:

- ✅ No security boundaries affected
- ⚠️ [List any security considerations]
- ❌ [Critical security concerns]

**Workflow Impact**:
[List O₅ workflows that reference this pattern]

**Coherence Risk**:

- Low: Well-isolated change
- Medium: Affects [X] symbols
- High: Core pattern modification

## Recommendations

**Before Changing**:

1. [Pre-change checklist items]
2. Consider alternatives: [Suggestions]
3. Plan tests for: [Affected areas]

**During Change**:

1. Update in parallel: [Similar patterns]
2. Maintain interfaces: [Public APIs]
3. Document rationale: [Why this change]

**After Change**:

1. Run: `cognition-cli quest-verify`
2. Test: [Specific test scenarios]
3. Update: [Related documentation]

**Estimated Effort**: [Small/Medium/Large]
**Risk Level**: [Low/Medium/High]
