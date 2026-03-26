# Phase 4: The Living Loop (Week 8-9)

**Goal:** Close the loop — changes propagate automatically, reasoning is preserved, the system heals itself.

## 4.1 Reactive Update Pipeline

Connect watch → update → overlay invalidation → regeneration as a continuous loop:

```
File watcher (chokidar)
  → dirty_state.json (debounce 300ms)
  → batch accumulator (5s window)
  → UpdateOrchestrator.run() [auto]
    → StructuralProcessingStep (incremental)
      → attach pending intents (from IntentAdapter)
      → attach git context (from GitContextExtractor)
      → record enriched transform
      → propagateInvalidation (recursive)
      → TransformDAG.link() [new]
    → overlay invalidation
    → selective overlay regeneration (only affected symbols)
  → emit 'coherent' event
```

**Key design decision:** Overlay regeneration is still manual (expensive, needs eGemma). The reactive loop handles structural updates + lineage recording. Overlays are regenerated on-demand or via explicit command.

**Race Condition Mitigation:**

When an AI agent writes files while the watcher is active, there's a risk of the watcher
triggering an update cycle _mid-write_ (agent writes file A, watcher fires, agent is still
writing file B — update sees inconsistent state).

Solution: Agent lock protocol.

```typescript
interface WatcherOptions {
  // ... existing
  agentLockFile?: string; // Path to lock file (e.g., .open_cognition/.agent_lock)
}

// Watcher checks lock before processing dirty state:
if (await this.isAgentLocked()) {
  // Agent is actively writing — defer processing
  // Re-queue dirty files for next debounce cycle
  return;
}
```

The agent (or skill) sets/clears the lock:

```bash
# Before a batch of changes:
cognition-cli lock acquire --source claude-code --timeout 30

# Agent writes files...

# After all writes complete:
cognition-cli lock release
```

Skills can wrap this automatically. The lock auto-expires after `--timeout` seconds as
a safety net against orphaned locks (agent crash, network disconnect).

## 4.2 Selective Overlay Regeneration

**File:** `src/core/orchestrators/overlay.ts`

Add ability to regenerate only affected symbols:

```typescript
async regenerateAffected(
  overlayType: string,
  affectedSymbols: string[], // From propagateInvalidation
): Promise<void> {
  // Only re-embed the changed symbols
  // Skip manifest entries where source hash is unchanged
  // This is already partially implemented (manifest check) but not wired to
  // the update pipeline's invalidation output
}
```

**Integration:** Wire `propagateInvalidation`'s output (list of invalidated paths) into `regenerateAffected`.

## 4.3 Coherence Drift Detection

When the reactive loop runs, compute delta:

```typescript
interface CoherenceDelta {
  before: number; // lattice_coherence before update
  after: number; // lattice_coherence after update
  drift: number; // after - before
  drifted_symbols: string[]; // symbols whose coherence dropped
  aligned_symbols: string[]; // symbols whose coherence improved
}
```

Emit as event. Skills can consume this to warn developers:

```
⚠️ Coherence drift detected: 0.74 → 0.71 (-0.03)
   src/auth/AuthService.ts: 0.82 → 0.68 (drifted from "security" mission concept)
   Consider: Does this change align with the project mission?
```

---
