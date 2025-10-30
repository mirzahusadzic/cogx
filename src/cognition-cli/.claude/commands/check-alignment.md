# Check Alignment

Check alignment of code/concept with mission principles.

## Your Task

1. **Search mission concepts** (O₄) for the requested concept
2. **Find aligned symbols** from O₁ via O₇ coherence
3. **Show alignment scores** and trends
4. **Identify gaps** where concept isn't well-represented
5. **Suggest improvements** for better alignment

## Commands to Run

```bash
# 1. Search mission concepts
cognition-cli concepts search "[CONCEPT]"

# 2. Find symbols aligned with this concept
cognition-cli lattice "O1 ~ O4[[CONCEPT]]"

# 3. Check coherence scores
cognition-cli coherence list | grep -i "[CONCEPT]"

# 4. Overall alignment report
cognition-cli coherence report

# 5. Find similar concepts
cognition-cli concepts search "[RELATED_TERM]"
```

## Alignment Analysis

**Mission Concept**: [Concept Name]
**Found in**: [VISION.md section/page]

**Definition**:
[Concept definition from O₄]

**Aligned Code Symbols** (≥70%):

1. [Symbol] - [Score%] - [File path]
2. [Symbol] - [Score%] - [File path]
3. [Symbol] - [Score%] - [File path]

**Partially Aligned** (50-70%):
[List symbols that partially embody this concept]

**Gaps** (<50%):
[Areas where this concept is under-represented]

**Alignment Trends**:

- Strong alignment in: [Areas]
- Weak alignment in: [Areas]
- Missing entirely in: [Areas]

## Recommendations

**To Improve Alignment**:

1. [Specific actionable steps]
2. [Code patterns to adopt]
3. [Documentation to add]

**Related Mission Concepts**:
[List related concepts from O₄ that provide context]

**Security Considerations**:
[If concept relates to security boundaries from O₂]

**Workflow Integration**:
[How to integrate this concept into O₅ workflows]
