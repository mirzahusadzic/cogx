# Lattice Algebra Guide

## Overview

The Lattice Algebra system provides a powerful query language for analyzing relationships across 7 cognitive overlays (O₁-O₇). Think of it as SQL for your codebase's semantic structure.

## The 7 Overlays

### O₁: Structural Patterns

**What**: Code symbol embeddings (functions, classes, interfaces, etc.)
**Used for**: Finding similar code structures, analyzing API patterns
**Example**: `O1[function]` - All function symbols

### O₂: Security Guidelines

**What**: Security threats, attack vectors, mitigations, constraints
**Used for**: Security analysis, threat modeling, compliance checking
**Example**: `O2[attack_vector]` - All known attack vectors

### O₃: Lineage Patterns

**What**: Dependency relationship embeddings (imports, calls, etc.)
**Used for**: Impact analysis, dependency tracking, refactoring safety
**Example**: `O3[import]` - All import relationships

### O₄: Mission Concepts

**What**: Mission document concept embeddings (from VISION.md, etc.)
**Used for**: Alignment checking, concept validation, drift detection
**Example**: `O4[principle]` - Core mission principles

### O₅: Operational Patterns

**What**: Workflow patterns, quest structures, sacred sequences, depth rules
**Used for**: Process validation, workflow discovery, best practices
**Example**: `O5[workflow]` - Documented workflow patterns

### O₆: Mathematical Proofs

**What**: Theorems, lemmas, axioms, proofs, identities
**Used for**: Formal verification, correctness proofs, mathematical reasoning
**Example**: `O6[theorem]` - All proven theorems

### O₇: Strategic Coherence

**What**: Semantic alignment between mission concepts and code symbols
**Used for**: Drift detection, alignment metrics, quality assessment
**Example**: `O7` - All coherence scores

## Query Syntax

### Basic Overlay Reference

```bash
# Get all items from overlay
cognition-cli lattice "O1"

# Filter by tag
cognition-cli lattice "O1[function]"

# Filter by metadata
cognition-cli lattice "O2[severity=critical]"
```

### Set Operations (Exact Matching)

#### Union (+, |)

Combine items from multiple overlays.

```bash
# All symbols from O1 OR O2
cognition-cli lattice "O1 + O2"

# Alternative syntax
cognition-cli lattice "O1 | O2"
```

**Use cases**:

- Combine security guidelines from multiple sources
- Merge pattern collections
- Create comprehensive views

#### Intersection (&, AND)

Find items present in BOTH overlays.

```bash
# Symbols that exist in both O1 AND O2
cognition-cli lattice "O1 & O2"

# SQL-style
cognition-cli lattice "O1 AND O2"
```

**Use cases**:

- Find documented AND implemented features
- Locate tested AND security-reviewed code
- Identify patterns with proofs

#### Difference (-, \)

Items in first overlay but NOT in second.

```bash
# Symbols without security coverage
cognition-cli lattice "O1 - O2"

# Alternative syntax
cognition-cli lattice "O1 \ O2"
```

**Use cases**:

- **Coverage gaps**: Code without security review
- **Missing tests**: Functions without test coverage
- **Undocumented code**: Symbols without mission alignment

### Semantic Operations (Vector Similarity)

#### Meet (~, MEET)

Find semantically aligned items via embedding similarity.

```bash
# Security threats aligned with mission principles
cognition-cli lattice "O2 ~ O4"

# Explicit keyword
cognition-cli lattice "O2 MEET O4"
```

**Use cases**:

- **Alignment checking**: Do security measures align with mission?
- **Concept validation**: Are workflows aligned with patterns?
- **Drift detection**: Which code drifted from principles?

#### Project (->, TO)

Query-guided semantic projection (future).

```bash
# Project workflows onto security domain
cognition-cli lattice "O5 -> O2"

# Keyword syntax
cognition-cli lattice "O5 TO O2"
```

### Complex Queries

#### Parentheses for Precedence

```bash
# Find symbols in O1 but not in (O2 or O3)
cognition-cli lattice "O1 - (O2 | O3)"

# Security items aligned with mission, excluding vulnerabilities
cognition-cli lattice "(O2 ~ O4) - O2[vulnerability]"
```

#### Tag Filters in Complex Expressions

```bash
# Critical attacks aligned with mission principles
cognition-cli lattice "O2[attack_vector,severity=critical] ~ O4[principle]"

# Functions without security coverage
cognition-cli lattice "O1[function] - O2"

# Workflows aligned with security
cognition-cli lattice "O5[workflow] ~ O2[mitigation]"
```

## Real-World Query Examples

### Security Analysis

#### Find Coverage Gaps

```bash
# Which symbols lack security coverage?
cognition-cli lattice "O1 - O2"
```

#### Critical Attack Vectors

```bash
# Critical attacks that conflict with mission
cognition-cli lattice "O2[attack_vector,severity=critical] ~ O4[principle]"
```

#### Security Boundaries

```bash
# All security boundaries and constraints
cognition-cli lattice "O2[boundary] | O2[constraint]"
```

### Alignment Checking

#### Mission-Aligned Code

```bash
# Code symbols aligned with mission (≥70%)
cognition-cli coherence aligned
# Or via lattice:
cognition-cli lattice "O7[aligned]"
```

#### Drifted Symbols

```bash
# Symbols that drifted from mission
cognition-cli coherence drifted
# Or via lattice:
cognition-cli lattice "O7[drifted]"
```

#### Workflow Alignment

```bash
# Workflows aligned with mission
cognition-cli lattice "O5[workflow] ~ O4"
```

### Pattern Discovery

#### Find Similar Patterns

```bash
# Functions similar to specific pattern
cognition-cli patterns similar "UserAuth" --overlay structural_patterns

# Workflows similar to quest structure
cognition-cli lattice "O5[quest] ~ O1"
```

#### Proven Patterns

```bash
# Theorems aligned with mission
cognition-cli lattice "O6[theorem] ~ O4"

# All mathematical proofs
cognition-cli proofs list
```

### Impact Analysis

#### Blast Radius

```bash
# What depends on this symbol?
cognition-cli blast-radius src/core/auth.ts:authenticateUser

# Combine with security
cognition-cli lattice "O3[depends_on:authenticateUser] & O2"
```

#### Dependency Analysis

```bash
# All imports for a module
cognition-cli lattice "O3[import,source=src/core/auth.ts]"
```

## Output Formats

### Table Format (Default)

```bash
cognition-cli lattice "O1 - O2" --format table
```

Shows human-readable table with symbols, files, and scores.

### JSON Format

```bash
cognition-cli lattice "O1 - O2" --format json
```

Machine-readable JSON for scripting.

### Summary Format

```bash
cognition-cli lattice "O1 - O2" --format summary
```

Concise list of symbols only.

## Sugar Commands

Convenience wrappers for common queries.

### Security Commands

```bash
# Translates to: O2[attack_vector] ~ O4[principle]
cognition-cli security attacks

# Translates to: O1 - O2
cognition-cli security coverage-gaps

# Translates to: O2[boundary] | O2[constraint]
cognition-cli security boundaries
```

### Workflow Commands

```bash
# Show workflow patterns
cognition-cli workflow patterns

# Show secure workflows only
cognition-cli workflow patterns --secure

# Show mission-aligned workflows
cognition-cli workflow patterns --aligned
```

### Proofs Commands

```bash
# All theorems
cognition-cli proofs theorems

# All lemmas
cognition-cli proofs lemmas

# Proofs aligned with mission
cognition-cli proofs aligned
```

### Coherence Commands

```bash
# Full coherence report
cognition-cli coherence report

# High-aligned symbols (≥70%)
cognition-cli coherence aligned

# Drifted symbols (bottom quartile)
cognition-cli coherence drifted

# All symbols with scores
cognition-cli coherence list
```

## Quest-Oriented Workflows

### Starting a Quest

1. **Check baseline coherence**

   ```bash
   cognition-cli coherence report
   ```

2. **Identify relevant patterns**

   ```bash
   cognition-cli workflow patterns
   cognition-cli patterns search "authentication"
   ```

3. **Check security requirements**

   ```bash
   cognition-cli security boundaries
   ```

### During Development

1. **Check alignment frequently**

   ```bash
   cognition-cli coherence aligned --min-score 0.6
   ```

2. **Analyze impact**

   ```bash
   cognition-cli blast-radius src/my-file.ts:myFunction
   ```

3. **Find similar implementations**

   ```bash
   cognition-cli patterns similar "MyComponent"
   ```

### Before Committing

1. **Verify no drift introduced**

   ```bash
   cognition-cli coherence report
   # Compare with baseline
   ```

2. **Check security coverage**

   ```bash
   cognition-cli security coverage-gaps
   ```

3. **Validate against patterns**

   ```bash
   cognition-cli lattice "O5[workflow] ~ O1[new_code]"
   ```

## Best Practices

### 1. Start Simple

Begin with single overlay queries before complex expressions:

```bash
# Start here
cognition-cli lattice "O1"

# Then filter
cognition-cli lattice "O1[function]"

# Then combine
cognition-cli lattice "O1[function] - O2"
```

### 2. Use Sugar Commands First

They're optimized for common use cases:

```bash
# Instead of: cognition-cli lattice "O1 - O2"
cognition-cli security coverage-gaps
```

### 3. Check Alignment Regularly

Make it part of your workflow:

```bash
# Before starting work
cognition-cli coherence report

# After changes
cognition-cli coherence report
# Compare scores
```

### 4. Combine with Git Hooks

Automate coherence checks:

```bash
# .git/hooks/pre-commit
cognition-cli coherence report --json > /tmp/coherence-before.json
# Run tests, make changes
cognition-cli coherence report --json > /tmp/coherence-after.json
# Compare and fail if drift increased
```

### 5. Use Watch Mode for Live Feedback

```bash
cognition-cli watch
```

Automatically updates overlays as you code.

## Performance Tips

1. **Use --limit** for large result sets

   ```bash
   cognition-cli lattice "O1" --limit 100
   ```

2. **Use tag filters** to narrow scope

   ```bash
   # Instead of: O1
   # Use: O1[function]
   ```

3. **Cache results** for repeated queries

   ```bash
   cognition-cli lattice "O1 - O2" --format json > coverage-gaps.json
   ```

## Troubleshooting

### No Results

- Check if overlays are generated: `cognition-cli overlays`
- Verify query syntax: Check for typos in operators
- Try broader query: Remove tag filters temporarily

### Query Too Slow

- Add tag filters to reduce scope
- Use --limit to cap results
- Check overlay status: `cognition-cli status`

### Unexpected Results

- Verify overlay freshness: `cognition-cli status`
- Check similarity threshold (for ~ operator)
- Use --verbose for detailed error messages

## Next Steps

- 📖 Read [Overlay Architecture](./overlays/README.md)
- 🎯 Learn [Quest Workflows](./manual/part-2-seven-layers/09-o5-operational.md)
- 📊 Check [Testing Guide](./06_Testing_and_Deployment.md)
