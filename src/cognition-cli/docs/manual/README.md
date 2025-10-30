# THE LATTICE BOOK

> **A Reference Manual for Cognitive Architecture with Verifiable Overlays**

Version: 1.0 (In Progress)
Status: Living Document
Last Updated: October 30, 2025

---

## The Axiom: Knowledge is a Lattice

**This is not an analogy. This is not a metaphor. This is a formal mathematical truth.**

Every question you ask—"What depends on X?", "Where is Y used?", "What changed between versions?"—is a **lattice operation**. Knowledge, in its most fundamental form, has the structure of a **mathematical lattice**: a partially ordered set where any two elements have both a unique greatest lower bound (Meet, ∧) and a unique least upper bound (Join, ∨).

The Persistent Grounded Context (PGC) is not "like" a lattice. **It IS a lattice**—the first executable implementation of this formal truth.

---

## About This Book

THE LATTICE BOOK is the complete reference manual for building, querying, and reasoning about cognitive architectures using the Open Cognition system. This is not just documentation—it's **executable knowledge** that can be ingested into the very system it describes.

**Why "The Lattice Book"?**

- **Lattice**: Not metaphor—mathematical structure with provable properties
- **Open**: Transparent, inspectable, portable cognition
- **Living**: Grows with the codebase, not written after the fact
- **Executable**: The book itself becomes a .cogx artifact

**Core Insight**: When you query "O2 ∧ O4" (security Meet mission), you're not searching—you're computing the greatest lower bound in a knowledge lattice. This is why compositional queries work. This is why overlays compose. This is why the algebra is complete.

**Scope**: This book covers the complete implementation from foundational axioms through advanced query algebra, portability formats (.cogx), and the computational Proof of Work (cPOW) loop.

---

## Target Audience

- **Implementers**: Building cognitive architectures
- **Researchers**: Understanding overlay-based knowledge systems
- **AI Engineers**: Integrating with LLM workflows
- **Security Analysts**: Auditing cognitive systems
- **Future You**: When context is lost and complexity is overwhelming

**Prerequisites**: Basic understanding of TypeScript, embeddings, and graph theory helps but isn't required.

---

## Book Structure

### Part I: Foundation (~100 pages)

**Chapter 1: Cognitive Architecture**
`part-1-foundation/01-cognitive-architecture.md`
What is cognitive architecture? Why do we need structured knowledge beyond "context window"?

**Chapter 2: The PGC (Persistent Grounded Context)**
`part-1-foundation/02-the-pgc.md`
The foundational data structure: `.open_cognition/` directory, versioning, provenance.

**Chapter 3: Why Overlays?**
`part-1-foundation/03-why-overlays.md`
Separation of concerns: Strategic vs Operational vs Security knowledge.

**Chapter 4: Embeddings as Semantic Substrate**
`part-1-foundation/04-embeddings.md`
768-dimensional vectors, eGemma, cosine similarity, semantic search.

---

### Part II: The Seven Layers (~200 pages)

**Chapter 5: O₁ Structure — Code Artifacts**
`part-2-seven-layers/05-o1-structure.md`
AST extraction, symbols, functions, classes, modules. The foundation of all overlays.

**Chapter 6: O₂ Security — Foundational Constraints**
`part-2-seven-layers/06-o2-security.md`
Threat models, attack vectors, mitigations, boundaries. Why O₂ is foundational (checked before mission alignment).

**Chapter 7: O₃ Lineage — Dependency Tracking**
`part-2-seven-layers/07-o3-lineage.md`
Call chains, blast radius, dependency graphs. Understanding impact zones.

**Chapter 8: O₄ Mission — Strategic Alignment**
`part-2-seven-layers/08-o4-mission.md`
Vision, concepts, principles, goals. What the system is FOR.

**Chapter 9: O₅ Operational — Workflow Guidance**
`part-2-seven-layers/09-o5-operational.md`
Quest structures, sacred sequences, depth rules. HOW to work, not WHAT to build.

**Chapter 10: O₆ Mathematical — Formal Properties**
`part-2-seven-layers/10-o6-mathematical.md`
Theorems, proofs, lemmas, axioms. Formal verification of cognitive properties.

**Chapter 11: O₇ Coherence — Cross-Layer Synthesis**
`part-2-seven-layers/11-o7-coherence.md`
Meet operation across layers. Alignment scoring. Drift detection.

---

### Part III: The Algebra (~80 pages)

**Chapter 12: Boolean Operations on Knowledge**
`part-3-algebra/12-boolean-operations.md`
Meet (∧), Union (∪), Intersection (∩), Difference (\), Complement (¬). Pure functions on overlay items.

**Chapter 13: Query Syntax and Parser**
`part-3-algebra/13-query-syntax.md`
ASCII-only operators: `+`, `-`, `&`, `|`, `~`, `->`. Lexer, parser, AST evaluation.

**Chapter 14: Set Operations and Symbol Algebra**
`part-3-algebra/14-set-operations.md`
`select()`, `exclude()`, `getSymbolSet()`. Coverage gap analysis.

---

### Part IV: Portability (~100 pages)

**Chapter 15: The .cogx Format**
`part-4-portability/15-cogx-format.md`
Portable overlay packaging. Export/import with provenance.

**Chapter 16: Dependency Security Inheritance**
`part-4-portability/16-dependency-inheritance.md`
`express.cogx → O₂`. Inheriting security knowledge from dependencies.

**Chapter 17: Ecosystem Seeding**
`part-4-portability/17-ecosystem-seeding.md`
Building reusable overlays for common libraries (React, TypeScript, Node.js).

---

### Part V: The cPOW Loop (~120 pages)

**Chapter 18: Operational Flow**
`part-5-cpow-loop/18-operational-flow.md`
Oracle → Scribe → AQS → Receipt. The complete computational Proof of Work cycle.

**Chapter 19: Quest Structures**
`part-5-cpow-loop/19-quest-structures.md`
What/Why/Success. Depth tracking (Depth 0-3). Sacred sequences (F.L.T.B: Format, Lint, Test, Build).

**Chapter 20: Validation Oracles**
`part-5-cpow-loop/20-validation-oracles.md`
eGemma personas. Coherence validators. Mission validators. Security validators.

---

## Reading Paths

### For Implementers (Full Path)

Read sequentially from Part I through Part V.

### For Query Users (Fast Path)

1. Chapter 2: The PGC (understand storage)
2. Chapter 3: Why Overlays? (understand separation)
3. Part II: Skim overlay descriptions
4. Part III: Deep dive on query algebra ⭐

### For Security Analysts (Security Focus)

1. Chapter 2: The PGC
2. Chapter 6: O₂ Security
3. Chapter 16: Dependency Security Inheritance
4. Chapter 12-14: Query algebra (for auditing)

### For Researchers (Theory Focus)

1. Chapter 1: Cognitive Architecture
2. Chapter 3: Why Overlays?
3. Chapter 4: Embeddings
4. Chapter 11: O₇ Coherence
5. Chapter 12: Boolean Operations

---

## Status Legend

- ✅ **Complete** - Chapter fully written and reviewed
- 🚧 **In Progress** - Currently being written
- 📋 **Planned** - Outlined but not started
- 🔄 **Needs Migration** - Exists in `docs/architecture/`, needs formatting

---

## Chapter Status

### Part I: Foundation

- 📋 Chapter 1: Cognitive Architecture
- 📋 Chapter 2: The PGC
- 🔄 Chapter 3: Why Overlays? (migrate from MULTI_OVERLAY_ARCHITECTURE.md)
- 📋 Chapter 4: Embeddings

### Part II: The Seven Layers

- 📋 Chapter 5: O₁ Structure
- ✅ Chapter 6: O₂ Security (COMPLETE - 1,200 lines)
- 📋 Chapter 7: O₃ Lineage
- ✅ Chapter 8: O₄ Mission (COMPLETE - 1,300 lines)
- ✅ Chapter 9: O₅ Operational (COMPLETE - 1,100 lines)
- ✅ Chapter 10: O₆ Mathematical (COMPLETE - 1,100 lines)
- 📋 Chapter 11: O₇ Coherence

### Part III: The Algebra ⭐

- ✅ Chapter 12: Boolean Operations (COMPLETE - 1,400 lines)
- 📋 Chapter 13: Query Syntax
- 📋 Chapter 14: Set Operations

### Part IV: Portability

- 📋 Chapter 15: .cogx Format
- 📋 Chapter 16: Dependency Security Inheritance
- 📋 Chapter 17: Ecosystem Seeding

### Part V: cPOW Loop

- 🔄 Chapter 18: Operational Flow (migrate from CPOW_OPERATIONAL_LOOP.md)
- 📋 Chapter 19: Quest Structures
- 📋 Chapter 20: Validation Oracles

---

## Contributing

This book grows **with** the codebase, not after. When you implement a feature:

1. **Write the chapter** (or update existing)
2. **Include examples** (real code, real queries)
3. **Document design decisions** (why not what)
4. **Update this index**

**Format Guidelines**:

- Use code blocks with syntax highlighting
- Include visual diagrams (ASCII art is fine)
- Real examples from the codebase
- "Why" over "what" (code shows what, docs explain why)

---

## Meta: The Book as Overlay

Eventually, THE LATTICE BOOK itself becomes a `.cogx` artifact:

```bash
# Ingest the book into PGC
cognition-cli genesis:docs docs/manual/

# Query the book
cognition-cli lattice "O5 -> O2"
# "Which operational patterns ensure security?"
# Returns: Excerpts from Chapter 9 aligned with Chapter 6

# Export the book as cognitive artifact
cognition-cli export lattice-book.cogx
```

**The manual documents itself using the system it describes.**

---

## License

[To be determined - likely MIT or Apache 2.0]

---

## Acknowledgments

Built with:

- Echo (cognitive analysis partner)
- Claude Code (implementation partner)
- eGemma (embedding infrastructure)
- The artist's workflow: "Block in shapes, then refine"

---

**Next Chapter**: [Chapter 12: Boolean Operations on Knowledge](part-3-algebra/12-boolean-operations.md) 🚧

**Start Reading**: [Chapter 1: Cognitive Architecture](part-1-foundation/01-cognitive-architecture.md) 📋
