# Architecture Decision Records for cognition-cli

## Context

I need you to analyze the cognition-cli TypeScript codebase and create Architecture Decision Records (ADRs) that document major architectural decisions and their rationale.

About the Project:

    CLI tool for analyzing codebases with a seven-overlay architecture (O1-O7)
    Uses LanceDB for vector storage, embeddings for semantic search
    PGC (Project Grounded Context) with content-addressable storage
    Sigma TUI with compression and conversation continuity
    Strong focus on security, transparency, and mission alignment
    AGPLv3 licensed

Your Task

Create 8-10 ADRs documenting the "why" behind key architectural decisions. Each ADR should be evidence-based (cite code, docs, or commit messages where possible).
Target Decisions to Document

1. Vector Database Choice (LanceDB)

Question: Why LanceDB instead of Pinecone, Weaviate, Qdrant, or Chroma? Evidence to find:

    Look in src/core/overlays/vector-db/
    Check for comments about offline-first, embeddings-on-disk
    Look for performance comparisons or requirements

2. Seven-Overlay Architecture

Question: Why exactly 7 overlays (O1-O7)? Why not 5 or 10? Evidence to find:

    docs/overlays/README.md
    VISION.md or mission documents
    Overlay manager implementations in src/core/overlays/

3. Shadow Architecture (Body + Shadow Embeddings)

Question: Why dual embedding system? Evidence to find:

    src/core/overlays/*/patterns.ts - look for "shadow" or "body"
    Documentation in docs/architecture/
    Comments about semantic vs structural signatures

4. Content-Addressable Storage (SHA-256)

Question: Why content-addressable with hashing? Why SHA-256? Evidence to find:

    src/core/pgc/object-store.ts
    Security documentation
    Comments about integrity, tampering

5. React-Based TUI (Ink)

Question: Why React/Ink instead of blessed, blessed-contrib, or raw terminal? Evidence to find:

    src/tui/ components
    package.json dependencies
    Look for state management patterns

6. Compression Strategy (120K threshold)

Question: Why 120K token threshold? Why turn-based analysis? Evidence to find:

    src/tui/hooks/compression/
    src/sigma/compressor.ts
    Recent fixes for compression race conditions

7. AGPLv3 License

Question: Why AGPLv3 instead of MIT, Apache, or GPL? Evidence to find:

    LICENSE file
    VISION.md or mission documents
    Comments about transparency, national security

8. Session Continuity Approach

Question: Why LanceDB-based session storage? Why compression recaps? Evidence to find:

    src/sigma/ session management
    src/tui/hooks/session/
    Documentation about memory architecture

9. Quest System Design

Question: Why quest-based workflow tracking? Evidence to find:

    src/core/quest/
    Documentation about quest operations
    Transform tracking

10. Workbench API Integration

Question: Why optional external API instead of all-local? Evidence to find:

    src/core/executors/workbench/
    Environment variable handling
    Comments about network isolation

ADR Template

For each decision, create a file: `docs/architecture/decisions/ADR-{NNN}-{kebab-case-title}.md`

Use this structure:

## ADR-{NNN}: {Title}

**Date**: `{YYYY-MM-DD - infer from git history or use "circa 2024"}`
**Status**: Accepted
**Deciders**: `{Look for contributors in git log if possible, or say "Core team"}`

## Context

- What was the problem or requirement that led to this decision?
- What constraints existed? (performance, security, usability, etc.)
- What was the state of the art at the time?

## Decision

[Describe what was decided - be specific]

## Alternatives Considered

### Option 1: [Alternative name]

- **Pros**: ...
- **Cons**: ...
- **Why rejected**: ...

### Option 2: [Alternative name]

- **Pros**: ...
- **Cons**: ...
- **Why rejected**: ...

{Add more alternatives as relevant}

## Rationale

{Why did we choose this option over alternatives?}
{What were the key factors?}
{What trade-offs did we accept?}

## Consequences

### Positive

- {Benefit 1}
- {Benefit 2}

### Negative

- {Cost/limitation 1}
- {Cost/limitation 2}

### Neutral

- {Impact 1}
- {Impact 2}

## Evidence

{Link to code, docs, or commits that support this ADR}

- Code: `src/path/to/file.ts:123`
- Docs: `docs/architecture/FILE.md`
- Commits: `{git commit hash}` - {message}

## Notes

{Any additional context, future considerations, or related decisions}

Requirements

    Be evidence-based: Cite actual code, docs, or infer from implementation patterns
    Consider alternatives: Don't just document what was chosen, explain what wasn't chosen
    Be honest about trade-offs: Document both benefits and costs
    Include code references: Point to specific files/functions that implement the decision
    Infer dates: Use git history or say "circa 2024" if unclear
    Be concise: 1-2 pages max per ADR

Deliverable

Create 8-10 ADR files in docs/architecture/decisions/:

    ADR-001-lancedb-vector-storage.md
    ADR-002-seven-overlay-architecture.md
    ADR-003-shadow-embeddings.md
    ADR-004-content-addressable-storage.md
    ADR-005-react-based-tui.md
    ADR-006-compression-strategy.md
    ADR-007-agplv3-license.md
    ADR-008-session-continuity.md
    ADR-009-quest-system.md
    ADR-010-workbench-integration.md

Also create an index: docs/architecture/decisions/README.md listing all ADRs with one-line summaries.
Success Criteria

    Each ADR documents a lasting architectural decision (not tactical code choices)
    Evidence from code/docs cited where possible
    Alternatives are considered, not just the chosen option
    Trade-offs are honestly documented
