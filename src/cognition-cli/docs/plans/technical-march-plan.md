# Technical March Plan: Autobiographical Memory & Grounded Coherence

This plan outlines the 5-phase roadmap to give `cognition-cli` an "Autobiographical Memory" by recording the intent and reasoning behind every file change, integrating with Git lineage, and improving coherence scoring.

## Structure

The plan has been split into modular documents for better flexibility during implementation:

1. [00-Overview](./march-2026/00-overview.md) - Goals, Architectural Pillars, and Core Concepts.
2. [01-Phase 1: Foundation](./march-2026/01-phase-1-foundation.md) - Content-Addressable Transforms & Reasoning Spine.
3. [02-Phase 2: Recording](./march-2026/02-phase-2-recording.md) - Lineage Adapter & Real-time Intent Recording.
4. [03-Phase 2.5: Rehydration](./march-2026/03-phase-2-5-rehydration.md) - Git History Rehydration & Provenance Traces.
5. [04-Phase 3: Querying](./march-2026/04-phase-3-querying.md) - The Provenance Engine & Semantic Query Layer.
6. [05-Phase 4: Living Loop](./march-2026/05-phase-4-living-loop.md) - Background Watchers & Agent Locking.
7. [06-Phase 5: Grounded Coherence](./march-2026/06-phase-5-grounded-coherence.md) - Three-Way Meet: Structure x Mission x Intent.
8. [07-Implementation Inventory](./march-2026/07-implementation-inventory.md) - Order of Operations & Expected LOC.
9. [08-Phase 6: Compaction](./march-2026/08-phase-6-compaction.md) - Long-term Performance & Log Compaction.

## Core Architectural Pillars

- **Content-Addressability**: Every transform is identified by its hash (ground truth).
- **Reasoning Enrichment**: Intent is added as a non-essential but critical enrichment field.
- **Git Symbiosis**: We don't replace Git; we hydrate it with the "Why" that Git lacks.
- **Three-Way Coherence**: Scoring is based on the alignment of Structure (AST), Mission (Tasks), and Intent (Transforms).
