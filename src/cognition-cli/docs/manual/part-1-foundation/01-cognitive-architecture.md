---
type: architectural
overlay: O4_Mission
---

# Chapter 1: Cognitive Architecture

> **The Axiom**: Knowledge is a lattice. Not an analogy. Not a metaphor. A formal mathematical truth. Every question you ask—"What depends on X?", "Where is Y used?", "What changed between versions?"—is a lattice operation. The Grounded Context Pool (PGC) is the first executable implementation of this axiom.

**Part**: I — Foundation<br/>
**Topic**: Cognitive Architecture<br/>
**Prerequisites**: None (start here)<br/>
**Concepts Introduced**: PGC, Overlays, Lattice Structure, Embeddings, Stateful Knowledge<br/>

---

## Table of Contents

1. [The Problem: Context Windows Are Not Memory](#the-problem-context-windows-are-not-memory)
2. [What Is Cognitive Architecture?](#what-is-cognitive-architecture)
3. [The Lattice Foundation](#the-lattice-foundation)
4. [The Seven Cognitive Dimensions](#the-seven-cognitive-dimensions)
5. [Storage and Semantic Substrates](#storage-and-semantic-substrates)
6. [Why Not Just RAG?](#why-not-just-rag)
7. [The Human-AI Symbiosis](#the-human-ai-symbiosis)
8. [When You Need Cognitive Architecture](#when-you-need-cognitive-architecture)

---

## The Problem: Context Windows Are Not Memory

Modern LLMs boast impressive context windows—200K tokens, even millions. The naive conclusion is obvious: just dump everything into the context window and let the model figure it out.

**This is batch processing, not cognitive architecture.**

### The Batch Processing Pattern

Consider the typical workflow:

1. User asks a question about the codebase
2. System reads all relevant files (or as many as fit)
3. Concatenate everything into a prompt
4. Send to LLM
5. Parse response
6. Discard everything
7. Repeat from step 1 for next question

**This is stateless**. Every query starts from zero. No learning, no accumulation, no structure.

### Five Critical Limitations

**1. No Provenance**

When the LLM says "The `authenticate` function handles JWT validation," where did this knowledge come from? Which file? Which line? When was it extracted? Which commit?

Without provenance, you can't verify claims. You can't detect when knowledge becomes stale. You can't track what changed.

**2. No Structure**

Everything in the context window has equal weight. A TODO comment has the same status as a security invariant. A casual remark in a README has the same importance as an architectural principle in VISION.md.

This is cognitively flat. No hierarchy, no categorization, no separation of concerns.

**3. No Persistence**

Query 1: "What security patterns exist?"
Query 2: "Which functions implement those patterns?"

These queries should build on each other. But in batch processing, Query 2 has no memory of Query 1. The LLM re-extracts security patterns from scratch, possibly returning different results due to temperature randomness.

**4. No Composition**

You can't ask compositional queries like "Which security patterns align with mission principles?" because there's no notion of **layers of knowledge** that can be combined.

You get everything or nothing. No boolean algebra. No set operations. No Meet operation across dimensions.

**5. No Verification**

Did the LLM hallucinate that security pattern? Or is it grounded in actual code?

Without verification, you're trusting the model's generalization. Sometimes that's fine. For critical infrastructure decisions, it's not.

### The Fundamental Divide

| Aspect           | Context Window (Batch) | Cognitive Architecture (Stateful) |
| ---------------- | ---------------------- | --------------------------------- |
| **State**        | Stateless per query    | Stateful across sessions          |
| **Knowledge**    | Re-extracted each time | Extracted once, queried many      |
| **Composition**  | Concatenation          | Lattice algebra (Meet, Join)      |
| **Provenance**   | None                   | Content hash + timestamp          |
| **Structure**    | Flat text              | 7 orthogonal overlays             |
| **Verification** | LLM output             | Grounded in AST + embeddings      |
| **Cost**         | High (re-extraction)   | Low (query cached knowledge)      |

**Key insight**: You wouldn't rebuild database indexes on every query. Why re-extract knowledge on every LLM invocation?

---

## What Is Cognitive Architecture?

Cognitive architecture is infrastructure for **persistent, structured, verifiable knowledge** about a codebase.

### Core Principles

**1. Persistence**

Knowledge is extracted once and queried many times. Like a database, not like a batch script.

When you run `cognition-cli genesis src/`, the system:

- Parses every TypeScript/JavaScript file
- Extracts symbols, functions, classes, imports, exports
- Computes content hashes (SHA-256) for integrity
- Stores structural data (O₁) in the PGC (`.open_cognition/`)

Then you generate overlays with `cognition-cli overlay generate <type>` or use the interactive wizard with `cognition-cli wizard`.

Future queries read from the PGC. No re-parsing unless files change.

**2. Structure**

Knowledge is separated into **orthogonal dimensions** (overlays):

- **O₁ (Structure)**: What exists? (symbols, AST)
- **O₂ (Security)**: What threatens? (attack vectors, mitigations)
- **O₃ (Lineage)**: What depends on what? (call graphs, blast radius)
- **O₄ (Mission)**: Why does this exist? (vision, principles, goals)
- **O₅ (Operational)**: How to do the work? (workflows, sacred sequences)
- **O₆ (Mathematical)**: What is provably true? (theorems, proofs)
- **O₇ (Coherence)**: How do these align? (cross-layer semantic scoring)

Each overlay is **independently queryable**. You can ask "Show me all security mitigations" without loading mission concepts.

**3. Provenance**

Every knowledge item traces back to source:

```typescript
{
  "type": "security_mitigation",
  "title": "JWT Token Validation",
  "source_file": "docs/SECURITY.md",
  "line_start": 45,
  "line_end": 52,
  "extracted_at": "2025-10-30T12:34:56Z",
  "commit_hash": "abc123def456",
  "content_hash": "9d3b60b34729d224f626fcb8b51129951b217b03f7090e0adbaea3942b6b2afb"
}
```

You can verify: "Did this really come from SECURITY.md:45-52? Was it extracted from commit abc123?"

**4. Composability**

Overlays combine via **lattice operations**:

```bash
# Boolean intersection
cognition-cli lattice "O2 & O4"
# "Security patterns that are ALSO mission concepts"

# Semantic Meet
cognition-cli lattice "O2 -> O4"
# "Security patterns semantically aligned with mission (coherence ≥ 0.7)"

# Set difference
cognition-cli lattice "O1 - O2"
# "Symbols with NO security patterns"
```

This is knowledge algebra, not text search.

**5. Verifiability**

Every extraction is grounded in verifiable data:

- **O₁**: Grounded in AST nodes (parsed, not guessed)
- **O₂**: Grounded in security documents + code patterns
- **O₃**: Grounded in dependency graphs (who imports whom)
- **O₄**: Grounded in mission documents + embeddings
- **O₅**: Grounded in workflow documentation
- **O₆**: Grounded in formal proof documents
- **O₇**: Grounded in coherence scores (cosine similarity of embeddings)

No floating claims. If it's in the PGC, it's traceable.

---

## The Lattice Foundation

**Axiom**: Knowledge is not a pile. Knowledge is not a graph. **Knowledge is a lattice**.

### What Is a Lattice?

A **lattice** is a partially ordered set where any two elements have:

1. **Meet (∧)**: Greatest lower bound (intersection)
2. **Join (∨)**: Least upper bound (union)
3. **Partial order (≤)**: Specificity relation

**This is not metaphor. This is formal mathematics.**

### Why Does This Matter?

Because lattice operations have **provable properties**:

```text
Idempotence:    A ∧ A = A
Commutativity:  A ∧ B = B ∧ A
Associativity:  (A ∧ B) ∧ C = A ∧ (B ∧ C)
Absorption:     A ∧ (A ∨ B) = A
Distributivity: A ∧ (B ∨ C) = (A ∧ B) ∨ (A ∧ C)
```

These properties enable:

**1. Compositional Queries**

Combine overlays in any order:

```bash
(O1 & O2) & O4  =  O1 & (O2 & O4)  =  O2 & O1 & O4
```

Order doesn't matter (commutativity + associativity).

**2. Incremental Computation**

Cache intermediate results:

```bash
temp = O2 & O4      # Cache this
result1 = O1 & temp
result2 = O3 & temp # Reuse cached O2 & O4
```

Idempotence guarantees consistency.

**3. Query Optimization**

Rewrite queries for performance:

```bash
# Original query
(O1 | O2) & (O1 | O3)

# Optimized (distributive law)
O1 | (O2 & O3)
```

Fewer operations, same result.

### The Seven-Layer Lattice

In Open Cognition, overlays form a **sublattice** where:

- **O₁** is the base (everything starts with structure)
- **O₂, O₃** are foundational (security, dependencies)
- **O₄** is strategic (mission)
- **O₅, O₆** are tactical (operations, proofs)
- **O₇** is integrative (coherence across all layers)

**Partial order**: O₂ ⊆ O₁ (security patterns are a subset of structural patterns)

See [Chapter 12: Boolean Operations](../part-3-algebra/12-boolean-operations.md) for complete formal treatment.

---

## The Seven Cognitive Dimensions

Open Cognition uses **seven overlays**—seven orthogonal knowledge dimensions.

### Overview Table

| Layer  | Name         | Purpose                    | Example Query                      |
| ------ | ------------ | -------------------------- | ---------------------------------- |
| **O₁** | Structure    | Code artifacts (AST)       | "What symbols exist?"              |
| **O₂** | Security     | Threat models, mitigations | "Which functions handle auth?"     |
| **O₃** | Lineage      | Dependency tracking        | "What depends on X?"               |
| **O₄** | Mission      | Strategic concepts         | "What implements privacy?"         |
| **O₅** | Operational  | Workflow guidance          | "What is the git workflow?"        |
| **O₆** | Mathematical | Formal proofs              | "What theorems hold?"              |
| **O₇** | Coherence    | Cross-layer alignment      | "Does auth.ts align with mission?" |

### Why Seven?

Not arbitrary. Each layer represents a **distinct cognitive operation**:

**O₁: Recognition** (what exists?)

"Before you can reason about code, you must recognize its structure."

- Symbols: functions, classes, interfaces, types
- Imports: what this file depends on
- Exports: what this file provides
- AST metadata: line numbers, signatures, docstrings

**O₂: Protection** (what threatens?)

"Before you can trust code, you must know its vulnerabilities."

- Threat models: who attacks, why, how
- Attack vectors: specific exploit techniques (CWE, CVE)
- Mitigations: defenses and countermeasures
- Constraints: security invariants that must hold

**O₃: Causation** (what causes what?)

"Before you can change code, you must know its impact."

- Call graphs: which functions call which
- Dependency graphs: which files import which
- Blast radius: how many files affected by a change
- Reverse dependencies: who depends on this symbol

**O₄: Purpose** (why does this exist?)

"Before you can align code with mission, you must know the mission."

- Vision: long-term aspirations
- Concepts: core ideas (e.g., "PGC", "Lattice")
- Principles: invariant truths (e.g., "Immutability is essential")
- Goals: measurable objectives

**O₅: Process** (how to do the work?)

"Before you can work effectively, you must know the workflow."

- Quest structures: What/Why/Success templates
- Sacred sequences: F.L.T.B (Format, Lint, Test, Build)
- Depth rules: Depth 0-3 (strategic → tactical)
- Workflow patterns: git flow, PR process, review checklists

**O₆: Proof** (what is provably true?)

"Before you can trust a claim, you must verify it."

- Theorems: formal statements with proofs
- Lemmas: supporting results
- Axioms: foundational truths
- Proofs: step-by-step verification

**O₇: Integration** (how do these align?)

"Before you can declare coherence, you must measure it."

- Coherence scores: semantic similarity between layers
- Drift detection: when coherence falls below threshold
- Alignment reports: which code aligns with mission
- Gap analysis: what's missing from overlays

### Orthogonality Example

Consider the same code from seven perspectives:

```typescript
// src/auth/authenticate.ts
export async function authenticate(
  user: string,
  password: string
): Promise<Token> {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const valid = await db.validateCredentials(user, hash);
  if (!valid) throw new AuthError('Invalid credentials');
  return jwt.sign({ user }, SECRET_KEY, { expiresIn: '1h' });
}
```

**O₁ (Structure)**: Function `authenticate(user: string, password: string): Promise<Token>` at line 2, exported, async function signature

**O₂ (Security)**: Implements "Password Hashing" mitigation (bcrypt), "Token Expiry" mitigation (1h), vulnerable to timing attacks (missing constant-time comparison)

**O₃ (Lineage)**: Imports `bcrypt`, `jwt`, `db`; called by `loginHandler`, `registerHandler`, `refreshHandler`; calls `bcrypt.hash`, `db.validateCredentials`, `jwt.sign`

**O₄ (Mission)**: Implements "Privacy-first authentication" concept (hashed passwords), aligns with "Minimize data collection" principle (no PII in tokens)

**O₅ (Operational)**: Follows "Async-first" workflow pattern, uses "Error-first" conventions

**O₆ (Mathematical)**: Proof: Token expiry guarantees session timeout within 1 hour (assuming clock sync)

**O₇ (Coherence)**: Coherence score: 0.87 (high alignment with mission), flagged for timing attack vulnerability

**Same code, seven distinct perspectives. This is orthogonality.**

---

## Storage and Semantic Substrates

Cognitive architecture requires two substrates:

### 1. Storage Substrate: The PGC

The **Grounded Context Pool (PGC)** is the physical storage layer—a versioned, local-first knowledge repository at `.open_cognition/`.

**Key components**:

- **objects/**: Content-addressable file storage (Git-style, SHA-256)
- **transforms/**: Transform manifests (what was done to which files)
- **index/**: Structural metadata (symbols, imports, exports per file)
- **reverse_deps/**: Dependency graphs (who depends on whom)
- **overlays/**: O₁-O₇ storage directories
- **patterns.lancedb/**: Vector database for embeddings

**Properties**:

- **Local-first**: No cloud dependency
- **Content-addressable**: Deduplication + integrity (hash-based)
- **Versioned**: Every extraction has commit hash + timestamp
- **Inspectable**: JSON, YAML (human-readable)
- **Git-friendly**: Selective commits via `.gitignore`

See [Chapter 2: The PGC](02-the-pgc.md) for complete specification.

### 2. Semantic Substrate: Embeddings

How do we measure "alignment" between code and mission? **Embeddings**—768-dimensional semantic vectors.

**How it works**:

```typescript
// Every symbol gets embedded
const functionEmbed = await embed('authenticate(user, password)');
// → [0.234, -0.891, 0.445, ..., 0.123]  (768 dimensions)

// Every mission concept gets embedded
const missionEmbed = await embed('User privacy is sacred');
// → [0.198, -0.834, 0.502, ..., 0.089]  (768 dimensions)

// Alignment = cosine similarity
const coherence = cosineSimilarity(functionEmbed, missionEmbed);
// → 0.87 (high alignment)
```

**Why embeddings?**

1. **Language-agnostic**: Works across 100+ languages (EmbeddingGemma-300M)
2. **Semantic**: Captures meaning, not keywords ("JWT" and "token validation" are semantically close)
3. **Fast**: Vector similarity is O(768) multiply-add operations (~10ms)
4. **Composable**: Can average, interpolate, combine embeddings
5. **Grounded**: Deterministic (same input → same embedding)

**Default model**: Google EmbeddingGemma-300M (300M params, 768 dims, Apache 2.0 license)

**User control**: You choose the workbench and models via `WORKBENCH_URL` env variable.

See [Chapter 4: Embeddings](04-embeddings.md) for implementation details.

---

## Why Not Just RAG?

Retrieval-Augmented Generation (RAG) is useful for document Q&A. **It is not cognitive architecture.**

### Comparison

| Feature          | RAG               | Open Cognition                        |
| ---------------- | ----------------- | ------------------------------------- |
| **Structure**    | Flat chunks       | 7 orthogonal overlays                 |
| **Persistence**  | Vector DB         | PGC + embeddings + metadata           |
| **Provenance**   | Optional          | Built-in (content hash + timestamp)   |
| **Algebra**      | Keyword search    | Lattice operations (Meet, Join, etc.) |
| **Verification** | LLM-generated     | Grounded in AST + embeddings          |
| **Composition**  | Concatenation     | Boolean algebra on overlays           |
| **State**        | Stateless         | Stateful across sessions              |
| **Queries**      | "Find docs about" | "O₂ ∧ O₄" (computable)                |

### When RAG Is Sufficient

Use RAG if:

- One-off queries ("What does this README say?")
- No compositional queries needed
- No drift detection required
- Hallucination is acceptable
- No need for multi-layer knowledge

### When You Need Cognitive Architecture

Use Open Cognition if:

- Multi-layered knowledge (security + mission + lineage)
- Compositional queries ("O₂ ∧ O₄", "O₁ - O₂")
- Drift detection over time
- Verifiable, auditable knowledge
- Building AI agents that operate on code
- Need to answer "Does this align with our mission?" (computable)

**Key distinction**: RAG retrieves documents. Cognitive architecture computes knowledge.

---

## The Human-AI Symbiosis

Cognitive architecture is **not about replacing developers**. It's about **amplifying cognitive bandwidth**.

### The Symmetric Machine

The machine provides:

- **Perfect recall**: Never forgets what was extracted
- **Zero drift**: Embeddings are deterministic
- **Instant operations**: Lattice queries in milliseconds
- **Tireless computation**: Can process millions of symbols

### The Asymmetric Human

The human provides:

- **Creative projection**: "What if we tried...?"
- **Ethical judgment**: Defining mission, values, principles
- **Strategic prioritization**: What matters? What's noise?
- **Novel pattern recognition**: Seeing connections machines miss

### The Symbiosis Loop

```text
1. Human defines MISSION (O₄)
   ↓
2. Machine measures COHERENCE (O₇)
   ↓
3. Human reviews DRIFT REPORT
   ↓
4. Human decides:
   - Fix code to align with mission?
   - Update mission to reflect reality?
   - Accept divergence as intentional?
   ↓
5. Machine provides PATTERNS (O₅) and PROOFS (O₆) to support implementation
   ↓
6. Human implements with confidence
   ↓
7. LOOP: Machine re-measures coherence
```

**The machine never decides. The human always decides.**

The machine says: "This function has coherence 0.42 to mission principle 'Privacy-first design'."

The human decides: "That's low. Let me investigate. Oh, it's logging PII. Fix it."

---

## When You Need Cognitive Architecture

### You DON'T Need It If

- **Small codebase** (< 10K LOC): Context window is sufficient
- **Single developer**: No coordination problem
- **No strategic mission**: "Just build stuff"
- **Rapid prototyping**: Cognitive overhead not worth it
- **No drift detection**: Don't care if code drifts from original intent

**Just use the LLM directly. Seriously. This is fine.**

### You DO Need It If

- **Large codebase** (> 50K LOC): Context window overflow
- **Multiple developers**: Need shared understanding of mission/patterns
- **Explicit mission**: Have VISION.md, want code to align
- **Long-term maintenance**: Need to detect drift over months/years
- **Compositional queries**: "Which security patterns align with mission?"
- **Verifiable knowledge**: Can't trust LLM hallucinations
- **AI agents**: Building tools that operate autonomously on code

**Cognitive architecture is infrastructure for complexity at scale.**

### The Transition Point

You know you need cognitive architecture when you start asking:

- "Did we already discuss this security pattern?"
- "Which principles apply to this new feature?"
- "Is this code still aligned with our mission from 6 months ago?"
- "What's the blast radius of changing this function?"
- "Can I query all security mitigations across the codebase?"

**If these questions matter, you need cognitive architecture.**

---

## Key Takeaways

1. **Context windows ≠ memory**: Batch processing vs. stateful knowledge
2. **Knowledge is a lattice**: Formal mathematics, provable properties
3. **Seven orthogonal dimensions**: Structure, Security, Lineage, Mission, Operational, Mathematical, Coherence
4. **Two substrates**: PGC (storage) + embeddings (semantic)
5. **Not RAG**: Knowledge computation, not document retrieval
6. **Human-AI symbiosis**: Machine measures, human decides
7. **Provenance required**: Every fact traces to source (content hash + timestamp)
8. **Composability enabled**: Boolean algebra on overlays (Meet, Join, etc.)
9. **Use when complexity scales**: Multi-developer, multi-layer, long-term projects
10. **Grounded, not hallucinated**: AST + embeddings, not LLM imagination

**Cognitive architecture is infrastructure for thinking about code at scale.**

---

**Next**: [Chapter 2: The PGC (Grounded Context Pool)](02-the-pgc.md)
