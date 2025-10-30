# Find Pattern

Search for operational patterns, workflows, and best practices.

## Your Task

1. **Search O₅ operational patterns** for the requested type
2. **Find similar implementations** in O₁ code symbols
3. **Check alignment** with mission concepts (O₄)
4. **Show examples** with coherence scores
5. **Provide implementation guidance**

## Commands to Run

```bash
# 1. Search operational patterns
cognition-cli patterns search "[PATTERN_TYPE]"

# 2. List specific pattern types
cognition-cli workflow patterns
cognition-cli workflow quests
cognition-cli workflow depth-rules

# 3. Find similar code
cognition-cli patterns similar "[PATTERN_NAME]"

# 4. Check alignment
cognition-cli lattice "O5[[PATTERN_TYPE]] ~ O4"

# 5. Get pattern details
cognition-cli lattice "O5[[PATTERN_TYPE]]" --format json
```

## Pattern Types

Available pattern types in O₅:

- `workflow` - Development workflows
- `quest` - Quest structures and objectives
- `sacred_sequence` - Critical ordered operations
- `depth_rule` - Complexity constraints
- `validation` - Validation patterns
- `transformation` - Data transformation patterns

## Output Format

**Pattern Found**: [Pattern Name]
**Type**: [workflow/quest/etc.]
**Alignment**: [X%] with mission

**Description**:
[Pattern description from O₅]

**Code Examples**:
[List 2-3 symbols from O₁ that implement this pattern]

**Coherence Scores**:

- Example 1: [Symbol name] - [Score%]
- Example 2: [Symbol name] - [Score%]

**Implementation Guide**:

1. [Step-by-step guidance]
2. [Key principles to follow]
3. [Common pitfalls to avoid]

**Related Patterns**:
[List related patterns from O₅]

**Mission Alignment**:
[How this pattern supports mission concepts from O₄]
