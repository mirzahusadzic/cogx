# Technical March Plan: Making cognition-cli a Living System

**Date:** 2025-03-25
**Author:** Deep technical audit of cognition-cli internals
**Goal:** Complete the Update Function U and continuous lineage — give the system autobiographical memory

---

## Current State of the Four Pillars

| Pillar                             | File                                  | Status     | Gap                                          |
| ---------------------------------- | ------------------------------------- | ---------- | -------------------------------------------- |
| **objects/** (Immutable Memory)    | `core/pgc/object-store.ts` (264 LOC)  | ✅ Solid   | No compression, no GC                        |
| **index/** (Conscious Mind)        | `core/pgc/index.ts` (570 LOC)         | ✅ Solid   | No DB indexing, file-per-entry               |
| **transforms/** (Auditable Past)   | `core/pgc/transform-log.ts` (297 LOC) | ⚠️ Partial | No reasoning field, deletable, phi hardcoded |
| **reverse_deps/** (Nervous System) | `core/pgc/reverse-deps.ts` (304 LOC)  | ✅ Solid   | O(1) confirmed, git-style sharding           |

### What Works Today

```
File Change → chokidar detects → SHA-256 compare → dirty_state.json → manual `update` command
  → DirtyStateDiscoveryStep → StructuralProcessingStep (incremental: true)
    → re-extract AST → new structural_hash → store in objects/
    → record transform (goal, inputs, outputs, method, fidelity)
    → add to reverse_deps (content_hash → transform_id, structural_hash → transform_id)
    → propagateInvalidation(oldStructuralHash) → recursive cascade via reverse_deps
    → invalidate overlays → ClearDirtyState → MaintenanceStep (verify: true)
```

**Key files:**

- `core/orchestrators/update.ts` (128 LOC) — the Update orchestrator
- `core/orchestrators/steps/structural-processing.ts` — incremental processing + propagateInvalidation
- `core/watcher/file-watcher.ts` (438 LOC) — chokidar + SHA-256 detection
- `core/watcher/dirty-state.ts` (252 LOC) — dirty_state.json manager

### What's Missing

1. **No reasoning/intent capture** — `Transformation` has `goal.objective` (WHAT) but no WHY field
2. **No git integration** — watcher is VCS-agnostic, no commit linking
3. **Transforms are deletable** — `propagateInvalidation` calls `transformLog.delete()` during cache invalidation
4. **No transform→transform DAG** — can trace object→transform, but not transform→transform provenance
5. **phi is hardcoded to 1.0** — Oracle verification is synthetic
6. **blast radius incomplete** — `consumerCount: 0` and `maxDepth: 0` are TODOs in status.ts
7. **No `verify-provenance` command** — chain integrity validation doesn't exist
8. **Watch → Update is manual** — user must run `cognition-cli update` after changes detected

---

## The March: 6 Phases

This roadmap evolves the system from a manual update loop to a living, self-aware observer.

1. **[Phase 1: Foundation](./01-phase-1-foundation.md)** — Reasoning spines and content-addressable transforms.
2. **[Phase 2: Recording](./02-phase-2-recording.md)** — Capturing intent and linking file changes to reasons.
3. **[Phase 2.5: Rehydration](./03-phase-2-5-rehydration.md)** — Bridging the gap with Git history.
4. **[Phase 3: Querying](./04-phase-3-querying.md)** — Semantic provenance and the "Why" engine.
5. **[Phase 4: Living Loop](./05-phase-4-living-loop.md)** — Real-time synchronization and agent locking.
6. **[Phase 5: Grounded Coherence](./06-phase-5-grounded-coherence.md)** — Higher-order validation (Structure x Mission x Intent).

_Maintenance & Optimization: [Phase 6: Compaction](./08-phase-6-compaction.md)_
