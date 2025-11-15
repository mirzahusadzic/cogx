# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) documenting the major architectural decisions in the Cognition CLI and CogX system.

## Purpose

ADRs capture the **"why"** behind key architectural choices, including:

- Context and requirements that led to the decision
- Alternatives that were considered
- Trade-offs and consequences
- Evidence from code, documentation, and commit history

These records serve as:

- **Historical documentation** - Understand past decisions
- **Onboarding material** - Help new contributors understand the architecture
- **Decision validation** - Revisit choices as requirements evolve
- **Pattern library** - Learn from architectural trade-offs

## ADR Index

### Infrastructure & Storage

- **[ADR-001: LanceDB Vector Storage](./ADR-001-lancedb-vector-storage.md)**
  - _Why LanceDB for vector embeddings instead of Pinecone, Weaviate, Qdrant, or Chroma_
  - Serverless, offline-first, portable `.lancedb` files with sub-millisecond local queries

- **[ADR-004: Content-Addressable Storage with SHA-256](./ADR-004-content-addressable-storage.md)**
  - _Why SHA-256 hashing and Git-style object storage for the PGC_
  - Cryptographic integrity, automatic deduplication, tamper detection, immutable provenance

- **[ADR-010: Workbench API Integration](./ADR-010-workbench-integration.md)**
  - _Why optional external API instead of all-local inference_
  - Accessibility (no GPU required), consistent embeddings, user autonomy, local deployment option

### Core Architecture

- **[ADR-002: Seven-Overlay Architecture (O₁-O₇)](./ADR-002-seven-overlay-architecture.md)**
  - _Why exactly 7 overlays instead of 5, 10, or a flat structure_
  - Minimal orthogonal set for complete code understanding: Structure, Security, Lineage, Mission, Operational, Mathematical, Coherence

- **[ADR-003: Shadow Embeddings (Dual Embedding System)](./ADR-003-shadow-embeddings.md)**
  - _Why dual embeddings (structural + semantic) for each code symbol_
  - Monument 4.7: Pattern matching via structural embeddings, mission alignment via semantic shadows

### User Interface & Experience

- **[ADR-005: React-Based TUI with Ink](./ADR-005-react-based-tui.md)**
  - _Why React/Ink instead of blessed, blessed-contrib, or raw terminal libraries_
  - Familiar React patterns, component composability, flexbox layout, hook-based state management

- **[ADR-006: Compression Strategy (120K Token Threshold)](./ADR-006-compression-strategy.md)**
  - _Why 120K tokens and importance-weighted compression_
  - Proactive buffer before hard limits, paradigm shifts preserved 100%, routine turns compressed 90%, 30-50x compression ratio

- **[ADR-008: Session Continuity (LanceDB-Based Conversation Memory)](./ADR-008-session-continuity.md)**
  - _Why LanceDB for session storage and anchor ID indirection_
  - Infinite context via semantic recovery, stable user interface, cross-session queries, audit trail

### Workflow & Collaboration

- **[ADR-009: Quest-Based Workflow Tracking (Block 2: Lops)](./ADR-009-quest-system.md)**
  - _Why quest-based operations logging instead of GitHub Issues or Git alone_
  - Cryptographic Proof of Work (cPOW), Agentic Quality Scores (AQS), wisdom extraction, Oracle-Scribe collaboration rhythm

### Legal & Philosophy

- **[ADR-007: AGPLv3 License (Copyleft)](./ADR-007-agplv3-license.md)**
  - _Why AGPLv3 instead of MIT, Apache, GPL, or custom licenses_
  - Self-defending open ecosystem, SaaS source disclosure, network effects favor commons, national security through transparency

## Reading Guide

### For New Contributors

Start with these ADRs to understand the foundational architecture:

1. [ADR-002: Seven-Overlay Architecture](./ADR-002-seven-overlay-architecture.md) - Core cognitive dimensions
2. [ADR-004: Content-Addressable Storage](./ADR-004-content-addressable-storage.md) - Data integrity foundation
3. [ADR-007: AGPLv3 License](./ADR-007-agplv3-license.md) - Legal and philosophical grounding

### For Understanding Sigma (Infinite Context)

Follow this sequence:

1. [ADR-001: LanceDB Vector Storage](./ADR-001-lancedb-vector-storage.md) - Conversation turn storage
2. [ADR-006: Compression Strategy](./ADR-006-compression-strategy.md) - When and how compression happens
3. [ADR-008: Session Continuity](./ADR-008-session-continuity.md) - How sessions survive compression
4. [ADR-005: React-Based TUI](./ADR-005-react-based-tui.md) - User interface for infinite context

### For Vector Embeddings & Semantic Search

Read in this order:

1. [ADR-010: Workbench Integration](./ADR-010-workbench-integration.md) - How embeddings are generated
2. [ADR-001: LanceDB Vector Storage](./ADR-001-lancedb-vector-storage.md) - How vectors are stored
3. [ADR-003: Shadow Embeddings](./ADR-003-shadow-embeddings.md) - Why dual embeddings per symbol

### For Mission Alignment & Quality

These ADRs explain verifiable AI-human symbiosis:

1. [ADR-002: Seven-Overlay Architecture](./ADR-002-seven-overlay-architecture.md) - Separation of cognitive dimensions
2. [ADR-003: Shadow Embeddings](./ADR-003-shadow-embeddings.md) - Structural vs. semantic alignment
3. [ADR-009: Quest System](./ADR-009-quest-system.md) - Quality measurement and cPOW generation

## ADR Template

New ADRs should follow this structure:

```markdown
# ADR-NNN: {Title}

**Date**: {YYYY-MM-DD or circa YYYY}
**Status**: Accepted | Proposed | Deprecated | Superseded
**Deciders**: {Author or "Core team"}

## Context

{Problem statement, requirements, constraints}

## Decision

{What was decided}

## Alternatives Considered

### Option 1: {Name}

- **Pros**: ...
- **Cons**: ...
- **Why rejected**: ...

## Rationale

{Why this decision over alternatives}

## Consequences

### Positive

- {Benefit}

### Negative

- {Cost/limitation}

### Neutral

- {Impact}

## Evidence

- Code: {file:line references}
- Docs: {documentation references}
- Commits: {git commit hashes}

## Notes

{Additional context, future considerations}
```

## Relationship Map

```
ADR-001 (LanceDB)
  ├─ Used by ADR-003 (Shadow Embeddings)
  ├─ Used by ADR-006 (Compression)
  ├─ Used by ADR-008 (Session Continuity)
  └─ Feeds from ADR-010 (Workbench embeddings)

ADR-002 (Seven Overlays)
  ├─ Defines structure for ADR-003 (Shadow Embeddings - O₁ dual purpose)
  ├─ Informs ADR-009 (Quest System - O₅ operational patterns)
  └─ Aligned with ADR-007 (AGPLv3 - open overlay ecosystem)

ADR-004 (Content-Addressable)
  ├─ Enables ADR-007 (AGPLv3 - cryptographic truth)
  ├─ Supports ADR-008 (Session Continuity - hash-based state)
  └─ Powers ADR-009 (Quest System - cPOW generation)

ADR-005 (React TUI)
  ├─ Visualizes ADR-006 (Compression progress)
  ├─ Manages ADR-008 (Session transitions)
  └─ Could show ADR-009 (Quest workflows)

ADR-006 (Compression)
  ├─ Uses ADR-001 (LanceDB for turn storage)
  ├─ Triggers ADR-008 (Session boundaries)
  └─ Feeds from ADR-010 (Workbench for embeddings)

ADR-007 (AGPLv3)
  ├─ Legal foundation for ADR-002 (Open overlay ecosystem)
  ├─ Aligns with ADR-004 (Transparency through content addressing)
  └─ Supports ADR-009 (Quest transparency)

ADR-008 (Session Continuity)
  ├─ Uses ADR-001 (LanceDB conversation store)
  ├─ Enabled by ADR-006 (Compression recaps)
  └─ Feeds from ADR-010 (Workbench for semantic search)

ADR-009 (Quest System)
  ├─ Stores patterns in ADR-002 (O₅ overlay)
  ├─ Uses ADR-004 (Content-addressable for cPOW)
  └─ Aligned with ADR-007 (Open transparency)

ADR-010 (Workbench)
  ├─ Generates embeddings for ADR-001 (LanceDB storage)
  ├─ Powers ADR-003 (Dual embedding generation)
  ├─ Enables ADR-006 (Importance scoring via embeddings)
  └─ Supports ADR-008 (Semantic search across sessions)
```

## Document History

| Date       | Change                                                                | Author             |
| ---------- | --------------------------------------------------------------------- | ------------------ |
| 2025-11-15 | Initial creation of 10 ADRs documenting major architectural decisions | Claude (via agent) |

## Contributing

When making significant architectural changes:

1. **Document the decision** - Create new ADR or update existing one
2. **Link related ADRs** - Update relationship map
3. **Cite evidence** - Code references, documentation, commits
4. **Be honest** - Document trade-offs, not just benefits

ADRs are living documents. As architecture evolves, ADRs should be:

- **Superseded** (when replaced by better approach)
- **Deprecated** (when no longer applicable)
- **Updated** (when new evidence emerges)

## References

- **VISION.md** - Mission and strategic intent
- **README.md** - Project overview and quick start
- **docs/architecture/** - Detailed architecture documentation
- **docs/overlays/** - Seven-overlay system documentation
- **SIGMA_CONTEXT_ARCHITECTURE.md** - Infinite context architecture

---

_These ADRs document the architectural decisions that make verifiable AI-human symbiosis possible._
