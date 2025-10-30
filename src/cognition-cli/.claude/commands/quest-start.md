# Quest Start

Initialize a new development quest with baseline context.

## Your Task

1. **Capture quest objective** from the user's description
2. **Check baseline coherence** to establish starting point
3. **Identify relevant patterns** from O₅ (operational patterns)
4. **Check security requirements** from O₂ if applicable
5. **Find similar implementations** from O₁ for reference
6. **Create quest tracking** structure

## Commands to Run

```bash
# 1. Check current coherence baseline
cognition-cli coherence report

# 2. Check overlay status
cognition-cli overlays

# 3. Search for relevant operational patterns
cognition-cli patterns search "[QUEST_TOPIC]"

# 4. Find similar code patterns
cognition-cli lattice "O1[function]" --limit 20

# 5. Check security boundaries if needed
cognition-cli security boundaries
```

## Output Format

Provide a quest briefing:

**Quest**: [Quest Name]
**Objective**: [Clear objective from user]

**Baseline Context**:

- Coherence: [Current lattice coherence %]
- Aligned symbols: [Count and %]
- Drifted symbols: [Count and %]

**Relevant Patterns**:
[List 3-5 relevant patterns from O₅]

**Similar Implementations**:
[List 2-3 similar code symbols from O₁]

**Security Requirements**:
[If applicable, list relevant boundaries/constraints from O₂]

**Recommended Approach**:
[Based on patterns and mission alignment]

**Success Criteria**:

- Maintain or improve coherence score
- Follow identified patterns
- No new security gaps
- Pass all tests

---

Ready to begin quest? Confirm understanding and approach before proceeding.
