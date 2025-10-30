# Chapter 3: Why Overlays?

> **The Axiom Applied**: Different knowledge types require different cognitive operations. Security patterns are not mission concepts. Workflow guidance is not formal proof. Overlays enforce **separation of concerns** at the knowledge level, enabling compositional queries that would be impossible in a flat structure.

**Part**: I — Foundation<br/>
**Topic**: Why Overlays?<br/>
**Prerequisites**: [Chapter 1: Cognitive Architecture](01-cognitive-architecture.md), [Chapter 2: The PGC](02-the-pgc.md)<br/>
**Concepts Introduced**: Separation of concerns, document classification, overlay orthogonality, compositional queries<br/>

---

## Table of Contents

1. [The Problem: Conflated Knowledge](#the-problem-conflated-knowledge)
2. [The Overlay Principle](#the-overlay-principle)
3. [The Seven Layers Explained](#the-seven-layers-explained)
4. [Orthogonality: Why Seven, Not One?](#orthogonality-why-seven-not-one)
5. [Document Classification](#document-classification)
6. [Template Documents](#template-documents)
7. [Compositional Queries](#compositional-queries)
8. [Common Misunderstandings](#common-misunderstandings)

---

## The Problem: Conflated Knowledge

Before overlays, a naive approach would dump everything into one knowledge pool:

```text
knowledge/
  - authenticate.ts structure
  - "User privacy is sacred" (mission)
  - "Always run tests before commit" (workflow)
  - "JWT tokens mitigate session hijacking" (security)
  - "Token expiry guarantees session timeout" (proof)
```

**This is cognitively flat. Everything has equal weight. No structure. No separation.**

### Why This Fails

**1. No Targeted Queries**

You can't ask: "Show me only security patterns" because security is mixed with mission, workflow, and proofs.

You get everything or nothing.

**2. No Compositional Operations**

You can't ask: "Which security patterns align with mission?" because there's no notion of **layers** that can be combined.

Boolean operations like `O₂ ∧ O₄` are impossible.

**3. No Separate Evolution**

Mission evolves (strategic direction changes).
Security is immutable (XSS is always a threat).
Workflow evolves (team adopts new practices).
Proofs are immutable (mathematical facts don't change).

**Mixing these means treating mutable and immutable knowledge the same way.**

**4. No Portability**

Security knowledge should be **reusable** across projects. Express.js has known CVEs. Every project using Express should inherit those CVEs.

But you can't export "just security knowledge" if it's mixed with project-specific mission.

### The Cognitive Mismatch

Different knowledge types require **different cognitive operations**:

| Knowledge Type        | Cognitive Operation   | Example                         |
| --------------------- | --------------------- | ------------------------------- |
| **Structure** (O₁)    | Recognition           | "What symbols exist?"           |
| **Security** (O₂)     | Threat analysis       | "What attacks this?"            |
| **Lineage** (O₃)      | Impact analysis       | "What breaks if I change this?" |
| **Mission** (O₄)      | Alignment scoring     | "Does this serve our purpose?"  |
| **Operational** (O₅)  | Workflow guidance     | "What's the next step?"         |
| **Mathematical** (O₆) | Formal verification   | "Is this provably true?"        |
| **Coherence** (O₇)    | Cross-layer synthesis | "Do these layers align?"        |

**You wouldn't use a hammer for every task. Why use one knowledge structure for every cognitive operation?**

---

## The Overlay Principle

**Principle**: Separate knowledge by **cognitive dimension**, not by physical location or file type.

### What Is an Overlay?

An **overlay** is a knowledge layer that:

1. **Stores one type of knowledge** (security, mission, workflow, etc.)
2. **Supports specific queries** for that knowledge type
3. **Composes with other overlays** via lattice operations
4. **Evolves independently** from other layers

**Analogy**: Like layers in Photoshop. Each layer is independent. You can toggle visibility, apply operations to specific layers, or merge layers.

### The Seven-Layer Stack

```text
O₇ (Coherence)     → Cross-layer alignment (integrative)
O₆ (Mathematical)  → Formal proofs (immutable)
O₅ (Operational)   → Workflow guidance (mutable)
O₄ (Mission)       → Strategic vision (mutable)
O₃ (Lineage)       → Dependency tracking (derived from O₁)
O₂ (Security)      → Threat models (immutable + portable)
O₁ (Structure)     → Code artifacts (foundational)
```

**Layer ordering matters**:

- **O₁ is foundational**: You can't reason about code without knowing its structure
- **O₂ is checked early**: Security violations block operations before expensive coherence checks
- **O₄ is strategic**: Mission alignment happens after structural/security validation
- **O₇ is integrative**: Coherence synthesizes across all layers

### Key Properties

**1. Orthogonality**

Overlays are **independent dimensions**. Changing O₄ (mission) doesn't affect O₂ (security).

**2. Composability**

Overlays combine via **lattice operations**:

```bash
O₂ ∧ O₄   # Security patterns aligned with mission
O₁ - O₂   # Code without security coverage
O₅ | O₆   # Workflow guidance OR formal proofs
```

**3. Queryability**

Each overlay supports **layer-specific queries**:

```bash
# O₂: Security-specific query
cognition-cli lattice "O2[type=mitigation]"

# O₄: Mission-specific query
cognition-cli lattice "O4[category=principle]"

# O₇: Coherence-specific query
cognition-cli coherence report --threshold 0.7
```

**4. Portability**

Overlays can be **exported and imported**:

```bash
# Export security knowledge
cognition-cli export --overlay O2 express-security.cogx

# Import into another project
cognition-cli import express-security.cogx
```

**Use case**: Share security patterns across projects that use the same dependencies.

---

## The Seven Layers Explained

### O₁: Structure — The Foundation

**Purpose**: Recognize what exists in the codebase (AST, symbols, imports, exports)

**Why it's foundational**: You can't reason about code without knowing its structure. All other overlays build on O₁.

**Storage**: `overlays/structural_patterns/manifest.json` (symbol → file mappings)

**Generated from**: Source code (TypeScript/JavaScript AST parsing)

**Queries**:

```bash
# Where is symbol X defined?
cognition-cli lattice "O1[symbol=authenticate]"

# What functions are exported?
cognition-cli lattice "O1[type=function,exported=true]"
```

**Immutability**: Mutable (changes when code changes)

**Portability**: No (project-specific)

---

### O₂: Security — Foundational Constraints

**Purpose**: Identify threats, attack vectors, mitigations, and security boundaries

**Why it's foundational**: Security violations should block operations **before** mission alignment checks. No point aligning with mission if security is compromised.

**Storage**: `overlays/security_guidelines/` (if generated)

**Generated from**:

- `docs/SECURITY.md`, `THREAT_MODEL.md` (user docs)
- `docs/overlays/O2_security/SECURITY_GUIDELINES.md` (template, ingested by wizard)

**Knowledge types**:

1. **Threat models**: Who attacks, what they target, why
2. **Attack vectors**: Specific exploit methods (SQL injection, XSS, etc.)
3. **Mitigations**: Countermeasures (parameterized queries, input validation)
4. **Boundaries**: Trust zones (client vs. server, public vs. private)
5. **Constraints**: Security invariants ("Never store passwords in plaintext")
6. **Vulnerabilities**: Known CVEs in dependencies

**Queries**:

```bash
# All mitigations
cognition-cli lattice "O2[type=mitigation]"

# Security patterns for authentication
cognition-cli lattice "O2 & O1[symbol=authenticate]"
```

**Immutability**: Mostly immutable (XSS is always a threat, but new threats emerge)

**Portability**: **Yes** (export as `.cogx`, import into projects using same dependencies)

**See**: [Chapter 6: O₂ Security](../part-2-seven-layers/06-o2-security.md)

---

### O₃: Lineage — Dependency Tracking

**Purpose**: Track who depends on whom, compute blast radius, analyze call chains

**Why it matters**: Before changing code, you need to know impact. "If I modify function X, what breaks?"

**Storage**: `overlays/lineage_patterns/` + `reverse_deps/` (in PGC)

**Generated from**: Source code (import analysis + AST call graph)

**Knowledge types**:

1. **Call graphs**: Which functions call which
2. **Import graphs**: Which files import which
3. **Blast radius**: Number of files affected by a change
4. **Reverse dependencies**: Who depends on this symbol

**Queries**:

```bash
# What depends on X?
cognition-cli blast-radius src/auth/authenticate.ts

# Call chain to Y
cognition-cli lattice "O3[target=authenticate] -> O3[caller=*]"
```

**Immutability**: Mutable (changes when dependencies change)

**Portability**: No (project-specific)

**See**: [Chapter 7: O₃ Lineage](../part-2-seven-layers/07-o3-lineage.md)

---

### O₄: Mission — Strategic Alignment

**Purpose**: Store vision, goals, principles, and core concepts from strategic documents

**Why it matters**: Alignment measurement. "Does this code serve our mission?" becomes computable.

**Storage**: `overlays/mission_concepts/{document_hash}.yaml` (with 768-dim embeddings)

**Generated from**:

- `VISION.md`, `MISSION.md` (user docs)
- `docs/overlays/O4_mission/PATTERN_LIBRARY.md`, `CODING_PRINCIPLES.md` (templates, ingested by wizard)

**Knowledge types**:

1. **Vision**: Long-term aspirations ("transparent, portable, verifiable AI")
2. **Concepts**: Core ideas ("PGC", "Lattice", "Overlay")
3. **Principles**: Invariant truths ("Immutability is essential")
4. **Goals**: Measurable objectives ("Complete lattice algebra by Q4 2025")

**Queries**:

```bash
# All mission concepts
cognition-cli concepts list

# Coherence: code vs. mission
cognition-cli coherence report
```

**Immutability**: Mutable (mission evolves as strategy changes)

**Portability**: Maybe (can export project-specific mission, but rarely useful across projects)

**See**: [Chapter 8: O₄ Mission](../part-2-seven-layers/08-o4-mission.md)

---

### O₅: Operational — Workflow Guidance

**Purpose**: Store workflow patterns, quest structures, sacred sequences (how to do the work)

**Why it matters**: Operational consistency. "What's the git workflow?" "What's the testing sequence?"

**Storage**: `overlays/operational_patterns/` (if generated)

**Generated from**:

- `docs/WORKFLOW.md`, `CONTRIBUTING.md` (user docs)
- `docs/overlays/O5_operational/OPERATIONAL_LATTICE.md` (template, ingested by wizard)

**Knowledge types**:

1. **Quest structures**: What/Why/Success templates
2. **Sacred sequences**: Invariant steps (F.L.T.B: Format, Lint, Test, Build)
3. **Depth rules**: Depth 0-3 guidance (strategic → tactical)
4. **Workflow patterns**: Git flow, PR process, review checklists

**Queries**:

```bash
# All sacred sequences
cognition-cli lattice "O5[type=sacred_sequence]"

# Depth 0 guidance (strategic)
cognition-cli lattice "O5[depth=0]"
```

**Immutability**: Mutable (workflows evolve as team practices change)

**Portability**: Maybe (can export workflow patterns, useful for teams with shared practices)

**See**: [Chapter 9: O₅ Operational](../part-2-seven-layers/09-o5-operational.md)

---

### O₆: Mathematical — Formal Proofs

**Purpose**: Store theorems, lemmas, axioms, and formal proofs about system properties

**Why it matters**: Formal verification. "Is this property provably true?"

**Storage**: `overlays/mathematical_proofs/` (if generated)

**Generated from**:

- `docs/PROOFS.md`, `THEOREMS.md` (user docs)
- `docs/overlays/O6_mathematical/MATHEMATICAL_PROOFS.md` (template, ingested by wizard)

**Knowledge types**:

1. **Theorems**: Formal statements with proofs
2. **Lemmas**: Supporting propositions
3. **Axioms**: Foundational truths (unprovable but accepted)
4. **Proofs**: Step-by-step derivations

**Queries**:

```bash
# All theorems
cognition-cli lattice "O6[type=theorem]"

# Proofs related to symbol X
cognition-cli lattice "O6 & O1[symbol=authenticate]"
```

**Immutability**: Immutable (mathematical facts don't change)

**Portability**: Maybe (formal properties can be reused if they apply generally)

**See**: [Chapter 10: O₆ Mathematical](../part-2-seven-layers/10-o6-mathematical.md)

---

### O₇: Coherence — Cross-Layer Synthesis

**Purpose**: Measure semantic alignment between overlays (does code align with mission?)

**Why it matters**: Drift detection. "Is code still aligned with mission from 6 months ago?"

**Storage**: `overlays/strategic_coherence/` (coherence scores)

**Generated from**: Embeddings from O₁ (code symbols) + O₄ (mission concepts)

**Knowledge types**:

1. **Coherence scores**: Cosine similarity between symbol and mission embeddings (0-1)
2. **Drift reports**: Symbols with coherence below threshold
3. **Alignment analysis**: Which code serves which mission concepts

**Queries**:

```bash
# Coherence report (all symbols)
cognition-cli coherence report

# Low-coherence symbols
cognition-cli lattice "O7[coherence<0.5]"
```

**Immutability**: Mutable (recomputed when code or mission changes)

**Portability**: No (project-specific alignment scores)

**See**: [Chapter 11: O₇ Coherence](../part-2-seven-layers/11-o7-coherence.md)

---

## Orthogonality: Why Seven, Not One?

**Question**: Why not one "knowledge overlay" that stores everything?

**Answer**: Because different knowledge types require **different cognitive operations** and have **different evolution patterns**.

### Independence Test

Overlays are orthogonal if you can change one without affecting others.

**Test 1**: Change mission (O₄)

- O₁ (Structure): Unchanged (code structure doesn't change)
- O₂ (Security): Unchanged (threats don't change)
- O₃ (Lineage): Unchanged (dependencies don't change)
- O₅ (Operational): Maybe changes (if workflow derives from mission)
- O₆ (Mathematical): Unchanged (proofs don't change)
- O₇ (Coherence): **Changes** (coherence scores recomputed)

**Conclusion**: O₄ is mostly orthogonal, but O₇ depends on it (as designed).

**Test 2**: Change code (O₁)

- O₂ (Security): Maybe changes (if new code introduces vulnerabilities)
- O₃ (Lineage): **Changes** (dependency graph recomputed)
- O₄ (Mission): Unchanged (mission doesn't depend on code)
- O₅ (Operational): Unchanged (workflow doesn't depend on code)
- O₆ (Mathematical): Unchanged (proofs don't depend on code implementation)
- O₇ (Coherence): **Changes** (coherence scores recomputed)

**Conclusion**: O₁ changes trigger recomputation of derived overlays (O₃, O₇) but not strategic/operational/proof layers.

### Evolution Patterns

| Overlay | Evolution Pattern  | Trigger                                 |
| ------- | ------------------ | --------------------------------------- |
| **O₁**  | High frequency     | Code changes (daily)                    |
| **O₂**  | Low frequency      | New threats discovered (monthly/yearly) |
| **O₃**  | High frequency     | Code changes (daily)                    |
| **O₄**  | Low frequency      | Strategic pivots (quarterly/yearly)     |
| **O₅**  | Medium frequency   | Workflow improvements (weekly/monthly)  |
| **O₆**  | Very low frequency | New formal results (rarely)             |
| **O₇**  | High frequency     | Code or mission changes (daily/weekly)  |

**Key insight**: Mixing high-frequency and low-frequency knowledge in one structure forces unnecessary recomputation.

### Compositional Power

Overlays enable queries that would be impossible in a flat structure:

```bash
# "Which security patterns align with mission?"
O₂ -> O₄

# "Which code lacks security coverage?"
O₁ - O₂

# "Which operational patterns support mission principles?"
O₅ -> O₄

# "Which proofs relate to security mitigations?"
O₆ & O₂
```

**This is knowledge algebra. You're computing over dimensions, not searching through flat text.**

---

## Document Classification

How does cognition-cli know which documents go into which overlay?

### The Document Classifier

**Location**: `src/core/analyzers/document-classifier.ts`

**Purpose**: Analyze markdown documents and determine overlay type

**Signals Used**:

**1. Filename Patterns** (high confidence)

```typescript
const filenamePatterns = {
  strategic: ['VISION.md', 'MISSION.md', 'STRATEGY.md'],
  security: ['SECURITY.md', 'THREAT_MODEL.md', 'VULNERABILITIES.md'],
  operational: ['WORKFLOW.md', 'OPERATIONAL_LATTICE.md', 'CONTRIBUTING.md'],
  mathematical: ['PROOFS.md', 'THEOREMS.md', 'LEMMAS.md'],
};
```

**2. Frontmatter Metadata** (highest confidence)

```markdown
---
overlay: O2_security
type: threat_model
---

## Threat: SQL Injection

...
```

**3. Section Structure** (medium confidence)

Looks for section headers:

- Security: "Threat Model", "Attack Vector", "Mitigation"
- Operational: "Quest Structure", "Sacred Sequence", "Workflow"
- Mathematical: "Theorem", "Proof", "Lemma"

**4. Content Patterns** (low confidence)

Keyword density analysis:

- Security: "attack", "threat", "vulnerability", "CVE"
- Operational: "quest", "depth", "workflow", "sequence"
- Mathematical: "theorem", "proof", "lemma", "QED"

### Classification Result

```typescript
{
  type: 'security',           // strategic | operational | mathematical | security
  confidence: 0.95,           // 0-1
  reasoning: [
    "Filename matches SECURITY.md (confidence: 1.0)",
    "Contains 'threat model' sections (confidence: 0.9)"
  ]
}
```

### Fallback Strategy

If classification confidence < 0.7:

1. **Ask user** (interactive mode): "This document looks like security (60% confident). Is that correct?"
2. **Default to O₄ (Mission)** (non-interactive mode): Safest fallback

---

## Template Documents

**Location**: `docs/overlays/`

**Purpose**: Provide default documents for all overlays, making it easy to start

### Available Templates

```text
docs/overlays/
├── O1_structure/STRUCTURAL_PATTERNS.md
├── O2_security/SECURITY_GUIDELINES.md
├── O3_lineage/LINEAGE_PATTERNS.md
├── O4_mission/PATTERN_LIBRARY.md
├── O4_mission/CODING_PRINCIPLES.md
├── O5_operational/OPERATIONAL_LATTICE.md
├── O6_mathematical/MATHEMATICAL_PROOFS.md
└── O7_coherence/STRATEGIC_COHERENCE.md
```

### How Templates Are Used

**Wizard Behavior** (after fix):

1. Run `cognition-cli init`
2. Run `cognition-cli genesis --source src/`
3. Ingest user's mission docs (if provided)
4. **Ingest ALL template docs from `docs/overlays/`** (new!)
5. Generate all requested overlays

**Result**: Even if user has no custom security/math docs, O₂ and O₆ can generate from templates.

### Customizing Templates

Users can:

1. **Edit templates directly**: `docs/overlays/O2_security/SECURITY_GUIDELINES.md`
2. **Create project-specific docs**: `docs/SECURITY.md` (takes precedence)
3. **Mix both**: User doc + template doc (merged into overlay)

**Precedence**: User docs > Template docs (if conflict, user wins)

---

## Compositional Queries

Overlays enable **compositional queries** that combine multiple knowledge dimensions.

### Boolean Operations

**Intersection** (`&` or `∩`):

```bash
cognition-cli lattice "O2 & O4"
# Items in BOTH security and mission overlays
# Example: "JWT validation" appears in both security mitigations and mission principles
```

**Union** (`|` or `∪`):

```bash
cognition-cli lattice "O2 | O4"
# Items in security OR mission overlays
# Example: All security patterns + all mission concepts (combined)
```

**Difference** (`-` or `\`):

```bash
cognition-cli lattice "O1 - O2"
# Items in O₁ but NOT in O₂
# Example: Code symbols with NO security coverage (gap analysis)
```

**Complement** (`~` or `¬`):

```bash
cognition-cli lattice "~O2"
# Everything EXCEPT security patterns
```

### Semantic Operations

**Meet** (`->` or `∧`):

```bash
cognition-cli lattice "O2 -> O4"
# Security items semantically aligned with mission (coherence ≥ 0.7)
# Example: Security patterns that ALSO serve mission principles
```

**Coverage Analysis**:

```bash
cognition-cli coverage --target O2 --baseline O1
# What percentage of O₁ symbols are covered by O₂?
# Example: "68% of code has security patterns"
```

### Real-World Examples

**Example 1: Find unprotected authentication code**

```bash
# Step 1: Find all auth-related symbols
cognition-cli lattice "O1[symbol~=auth]"

# Step 2: Find auth symbols WITHOUT security patterns
cognition-cli lattice "O1[symbol~=auth] - O2"

# Output: authenticate.ts:67 (no security coverage)
```

**Example 2: Verify mission-critical code has formal proofs**

```bash
# Mission-critical symbols
cognition-cli lattice "O4[category=critical] -> O1"

# Check if they have proofs
cognition-cli lattice "(O4[category=critical] -> O1) & O6"

# Gap: Which critical code lacks proofs?
cognition-cli lattice "(O4[category=critical] -> O1) - O6"
```

**Example 3: Drift detection**

```bash
# Find code with low coherence to mission
cognition-cli lattice "O7[coherence<0.5]"

# Cross-reference with security patterns
cognition-cli lattice "O7[coherence<0.5] & O2"

# Output: Low-coherence code that handles security-sensitive operations
# → High priority for review
```

---

## Common Misunderstandings

### Misunderstanding 1: "Overlays are file folders"

**Wrong**: Overlays are not directories. They're **cognitive dimensions**.

**Correct**: Overlays are stored in directories (`overlays/mission_concepts/`), but the concept is **knowledge separation**, not file organization.

**Why it matters**: You don't move files between overlays. You **classify knowledge** into overlays during extraction.

---

### Misunderstanding 2: "I can just merge all overlays into one"

**Wrong**: Merging overlays defeats the purpose.

**Correct**: Overlays are **orthogonal dimensions** that enable compositional queries. Merging them is like merging X, Y, Z axes into one line.

**Why it matters**: Queries like `O₂ ∧ O₄` ("security aligned with mission") are impossible without separation.

---

### Misunderstanding 3: "Overlays slow down queries"

**Wrong**: Overlays **speed up** queries by enabling targeted searches.

**Correct**:

- Query O₂ only: Fast (small dataset)
- Query everything: Slow (large dataset)
- Query O₂ ∧ O₄: Fast (two small datasets, composed)

**Why it matters**: Overlays enable **pruning**. You don't search irrelevant knowledge.

---

### Misunderstanding 4: "Template docs are mandatory"

**Wrong**: Templates are **optional defaults**.

**Correct**:

- No docs → wizard uses templates
- Custom docs → wizard uses yours
- Both → wizard merges (your docs take precedence)

**Why it matters**: You're never locked into templates. They're just a starting point.

---

## Key Takeaways

1. **Overlays enforce separation of concerns** at the knowledge level
2. **Seven dimensions**: Structure, Security, Lineage, Mission, Operational, Mathematical, Coherence
3. **Orthogonality**: Changing one overlay doesn't affect others (mostly)
4. **Compositional queries**: Boolean + semantic operations across layers
5. **Different evolution patterns**: High-frequency (code) vs. low-frequency (mission)
6. **Document classification**: Automatic routing based on filename, frontmatter, content
7. **Template documents**: Default docs in `docs/overlays/` for easy start
8. **Portability**: O₂ (security) can be exported/imported via `.cogx`
9. **Not file folders**: Overlays are cognitive dimensions, not directories
10. **Speed, not slowdown**: Targeted queries on small datasets are faster than searching everything

**Overlays are the architectural foundation that makes cognitive operations computable.**

---

**Previous**: [Chapter 2: The PGC](02-the-pgc.md)<br/>
**Next**: [Chapter 4: Embeddings](04-embeddings.md)
