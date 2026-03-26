# Implementation Order & Dependencies

## Implementation Order & Dependencies

```
Phase 1 (Foundation)
  1.1 Extend Transformation schema ──────────────────┐
  1.2 Soft-delete transforms ────────────────────────┤
  1.3 Git context extractor ─────────────────────────┤
                                                      │
Phase 2 (Recording)                                   │
  2.1 Auto-update mode ──── depends on nothing ──────┤
  2.2 Lineage record command ── depends on 1.1, 1.3 ─┤
  2.3 Intent adapter ────────── depends on 1.1 ──────┤
  2.4 Intent resolver + eGemma ─ depends on 1.1, 2.3 ┤
                                                      │
Phase 2.5 (Rehydration)                               │
  2.5 Lineage rehydrate cmd ── depends on 1.1, 1.3 ──┤
      (optionally enhanced by 3.1 TransformDAG)       │
                                                      │
Phase 3 (Querying)                                    │
  3.1 Transform DAG ─────────── depends on 1.2 ──────┤
  3.2 Provenance service ────── depends on 3.1 ──────┤
  3.3 verify-provenance cmd ─── depends on 3.2 ──────┤
  3.4 Complete blast radius ─── depends on 3.2 ──────┘

Phase 4 (Closing the Loop)
  4.1 Reactive update pipeline ── depends on 2.1, 2.3
  4.2 Selective overlay regen ─── depends on 4.1
  4.3 Coherence drift detection ─ depends on 4.2

Phase 5 (Intent-Grounded Coherence)
  5.1 Intent embedding generator ── depends on 2.3, 3.2
  5.2 Three-way coherence (O₇v2) ── depends on 5.1, 4.3
  5.3 Temporal coherence report ──── depends on 5.2
```

## File Inventory

### New Files (24)

| File                                                              | Phase | Purpose                                            | Est. LOC |
| ----------------------------------------------------------------- | ----- | -------------------------------------------------- | -------- |
| `src/core/git/context-extractor.ts`                               | 1.3   | Git commit/diff metadata                           | ~120     |
| `src/core/git/context-extractor.test.ts`                          | 1.3   | Tests                                              | ~80      |
| `src/commands/lineage-record.ts`                                  | 2.2   | Record transforms from git commits                 | ~200     |
| `src/core/lineage/bulk-rename.ts`                                 | 2.5   | Bulk rename detection & grouping                   | ~80      |
| `src/commands/hooks-install.ts`                                   | 2.2   | Install git hooks                                  | ~80      |
| `src/core/lineage/intent-adapter.ts`                              | 2.3   | AI agent intent capture                            | ~150     |
| `src/core/lineage/intent-adapter.test.ts`                         | 2.3   | Tests                                              | ~100     |
| `src/core/lineage/intent-resolver.ts`                             | 2.4   | Priority-chain intent resolution                   | ~150     |
| `src/core/lineage/egemma-client.ts`                               | 2.4   | eGemma /summarize wrapper with persona             | ~80      |
| `src/commands/lineage-enrich.ts`                                  | 2.4   | Batch enrich low-confidence transforms             | ~100     |
| `egemma: personas/docs/intent_synthesizer.md`                     | 2.4   | Persona: diff → structured intent                  | ~30      |
| `src/commands/lineage-rehydrate.ts`                               | 2.5   | Reconstruct memory from git history                | ~350     |
| `src/core/lineage/rehydration-manifest.ts`                        | 2.5   | Track rehydration state for --resume               | ~80      |
| `src/commands/lineage-rehydrate.test.ts`                          | 2.5   | Tests (rename tracking, resume, edge cases)        | ~200     |
| `src/core/pgc/transform-dag.ts`                                   | 3.1   | Transform→transform DAG                            | ~200     |
| `src/core/pgc/transform-dag.test.ts`                              | 3.1   | Tests                                              | ~150     |
| `src/core/lineage/provenance-service.ts`                          | 3.2   | Provenance query engine                            | ~300     |
| `src/core/lineage/provenance-service.test.ts`                     | 3.2   | Tests                                              | ~200     |
| `src/commands/verify-provenance.ts`                               | 3.3   | CLI command for chain verification                 | ~150     |
| `src/commands/lineage-intent.ts`                                  | 2.3   | CLI command for intent recording                   | ~80      |
| `src/core/lineage/coherence-delta.ts`                             | 4.3   | Drift detection                                    | ~100     |
| `src/core/overlays/strategic-coherence/intent-embeddings.ts`      | 5.1   | Intent embedding generator with confidence scoring | ~200     |
| `src/core/overlays/strategic-coherence/intent-embeddings.test.ts` | 5.1   | Tests (fallback, confidence, reclassification)     | ~150     |
| `src/core/overlays/strategic-coherence/temporal-report.ts`        | 5.3   | Coherence-over-time report with commit history     | ~120     |

### Modified Files (9)

| File                                                    | Phase    | Change                                                |
| ------------------------------------------------------- | -------- | ----------------------------------------------------- |
| `src/core/types/transform.ts`                           | 1.1      | Add reasoning, source, git fields                     |
| `src/core/pgc/transform-log.ts`                         | 1.2      | Add invalidate(), rename delete→purge                 |
| `src/core/orchestrators/steps/structural-processing.ts` | 1.2, 2.3 | Use invalidate(), attach intents + git context        |
| `src/core/watcher/file-watcher.ts`                      | 2.1      | Add autoUpdate mode + batch accumulator               |
| `src/commands/watch.ts`                                 | 2.1      | Add --auto-update flag                                |
| `src/commands/status.ts`                                | 3.4      | Complete blast radius TODOs (consumerCount, maxDepth) |
| `src/core/orchestrators/overlay.ts`                     | 4.2      | Add regenerateAffected()                              |
| `src/core/watcher/agent-lock.ts`                        | 4.1      | Agent lock/unlock for race condition mitigation       |
| `src/commands/index.ts`                                 | 2.2, 3.3 | Register new commands                                 |
| `src/core/overlays/strategic-coherence/manager.ts`      | 5.2      | Three-way meet: shadow × mission × intent             |

### Estimated Total

- **New code:** ~3,450 LOC (source + tests)
- **Modified code:** ~350 LOC changes across 10 files
- **Risk:** Low for Phases 1-2 (additive, backward compatible), Medium for Phase 2.5 (git history edge cases, bulk renames), Medium for Phases 3-4 (new data structures, wiring, race conditions), Low for Phase 5 (graceful fallback to current behavior)

---

## What This Achieves

After Phase 5, the system has:

1. **Autobiographical memory** — every file change is recorded with WHY it happened, WHO did it, and WHAT git commit it came from
2. **Rehydratable memory** — clone any repo, run `lineage rehydrate`, and reconstruct the system's cognitive history from git. The nervous system regenerates from the bones. Identity survives renames. `--resume` keeps it incremental.
3. **Verifiable provenance chains** — trace any knowledge element from ⊤ back to ⊥ with full reasoning at each step
4. **Append-only audit trail** — transforms are never truly deleted, only invalidated (critical for regulated environments)
5. **Self-healing coherence** — changes propagate automatically, overlays invalidate surgically, drift is detected and reported
6. **Agent-ready infrastructure** — AI agents can record intent before making changes, and the system verifies alignment after
7. **Intent-grounded coherence** — O₇ computes a three-way meet (Structure × Mission × Intent) instead of shadow-only. Infrastructure symbols that _serve_ the mission but _describe_ themselves operationally are correctly classified. False drift eliminated. Confidence-weighted blending ensures graceful degradation: no lineage = current behavior, rehydrated = partial, live = full.
8. **Temporal coherence tracking** — coherence over time, per commit, with the reasoning attached. See whether you're drifting from or converging toward the mission across the project's history.

This is the missing piece between "knowledge AS a lattice" and "knowledge that KNOWS it's a lattice."

The heavens are already grounded in the mortals. This plan gives the mortals a voice — the ability to say not just "I changed" but "I changed because..." And the conscience (O₇) finally listens to that voice, not just to the shadow.

---

## What This Does NOT Include (Parked)

- O₅ (Operational) maturation — useful but not load-bearing
- O₆ (Mathematical) proper math analyzer — needs domain-specific tooling
- IPC bus / multi-process architecture — premature optimization
- Multi-LLM orchestration — eGemma is sufficient
- TUI polish — SIGMA already works
- Rust/C++ parser — Phase 2 of enterprise roadmap, not this plan
- Top-down refinement in Genesis — architecture exists, not needed yet
