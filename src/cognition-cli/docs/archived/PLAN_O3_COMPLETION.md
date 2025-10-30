# Plan: Complete Mission Concepts Pipeline (O₃)

## Current Status

✅ **Working:**

- Mission concepts extraction and embedding generation
- Strategic coherence computation (manager level only)
- Genesis docs ingestion

❌ **Missing:**

- CLI for strategic coherence generation
- Query commands for mission concepts and coherence
- Integration with existing commands
- Docs oracle and GC support

---

## Implementation Plan

### Phase 1: Strategic Coherence CLI Generation

**Goal:** Enable `cognition-cli overlay generate strategic_coherence`

**Tasks:**

1. Update `overlay/generate.ts` to accept `strategic_coherence` type
2. Add strategic coherence generation to `OverlayOrchestrator.run()`
3. Implement progress logging (similar to mission concepts)
4. Add manifest tracking for strategic coherence
5. Update `overlay list` to show coherence status

**Files to modify:**

- `src/commands/overlay/generate.ts` (add type validation)
- `src/core/orchestrators/overlay.ts` (add coherence generation)
- `src/commands/overlay/list.ts` (add coherence display)

---

### Phase 2: Mission Concepts Query Commands

**Goal:** Create `concepts` command suite (mirror of `patterns`)

**New commands:**

1. `concepts list` - List all extracted concepts with weights
2. `concepts inspect <text>` - Show detailed concept info (section, weight, occurrences, embedding dims)
3. `concepts top [N]` - Show top N mission concepts (default: 50)
4. `concepts from-doc <hash>` - Show concepts from specific document
5. `concepts search <keyword>` - Find concepts matching keyword
6. `concepts by-section <section>` - Filter concepts by section (Vision, Mission, etc.)

**Files to create:**

- `src/commands/concepts.ts` (new command suite)

**Register in:**

- `src/cli.ts`

---

### Phase 3: Strategic Coherence Query Commands

**Goal:** Create `coherence` command suite

**New commands:**

1. `coherence report` - Show overall metrics (aligned/drifted symbols, avg coherence)
2. `coherence aligned [--min-score 0.7]` - Show symbols aligned with mission
3. `coherence drifted [--max-score 0.5]` - Show symbols that drifted from mission
4. `coherence for-symbol <symbol>` - Show mission alignment for specific symbol
5. `coherence for-concept <text>` - Show which symbols implement a concept
6. `coherence compare <symbol1> <symbol2>` - Compare mission alignment of two symbols

**Files to create:**

- `src/commands/coherence.ts` (new command suite)

**Register in:**

- `src/cli.ts`

---

### Phase 4: Docs Oracle & GC Integration

**Goal:** Validate and cleanup document entries

**Tasks:**

1. Create `DocsOracle` class (mirror of `GenesisOracle`)
   - Validate `index/docs/` entries exist in objects
   - Validate content hashes match
   - Check transform logs exist
   - Detect orphaned document objects

2. Extend GC to support docs cleanup
   - Add `garbageCollectDocs()` to genesis orchestrator
   - Delete stale `index/docs/` entries
   - Invalidate mission concepts overlays for deleted docs
   - Invalidate strategic coherence when mission docs change

**Files to create:**

- `src/core/pgc/oracles/docs.ts` (new DocsOracle)

**Files to modify:**

- `src/core/orchestrators/genesis.ts` (add docs GC)
- `src/commands/audit.ts` (add docs oracle option)

---

### Phase 5: Integration with Existing Commands

**Goal:** Make mission concepts and coherence first-class citizens

**Tasks:**

1. **blast-radius**: Show if affected symbols are mission-aligned
   - Add `--show-coherence` flag
   - Display alignment scores in impact graph

2. **update**: Invalidate overlays when strategic docs change
   - Detect changes to VISION.md, MISSION.md, etc.
   - Regenerate mission concepts for changed docs
   - Invalidate strategic coherence overlay
   - Show "Strategic drift detected" warnings

3. **watch**: Track strategic document changes
   - Add strategic docs to watch list
   - Mark PGC dirty when VISION.md changes
   - Log mission concept invalidations

**Files to modify:**

- `src/commands/blast-radius.ts`
- `src/core/orchestrators/update.ts`
- `src/commands/watch.ts`

---

### Phase 6: Documentation & Guides

**Goal:** Help users understand O₃ workflow

**Guides to create:**

1. `.claude/commands/mission-concepts.md` - How to extract and query mission concepts
2. `.claude/commands/strategic-coherence.md` - How to measure code-mission alignment
3. `.claude/commands/o3-workflow.md` - Full O₃ pipeline walkthrough

**Content:**

- What are mission concepts?
- How to ingest strategic documents
- How to generate overlays
- Query examples
- Interpreting alignment scores
- Handling drift

**Files to create:**

- `.claude/commands/mission-concepts.md`
- `.claude/commands/strategic-coherence.md`
- `.claude/commands/o3-workflow.md`

**Update:**

- `src/commands/guide.ts` (add to guide index)

---

## Priority Order

**P0 - Core Functionality (implement first):**

1. Phase 1: Strategic coherence CLI generation ⭐
2. Phase 3: Strategic coherence query commands ⭐

**P1 - Usability:** 3. Phase 2: Mission concepts query commands 4. Phase 4: Docs oracle & GC

**P2 - Polish:** 5. Phase 5: Integration with existing commands 6. Phase 6: Documentation & guides

---

## Success Criteria

✅ Users can run: `cognition-cli overlay generate strategic_coherence`
✅ Users can query: `cognition-cli coherence aligned`
✅ Users can query: `cognition-cli concepts top 20`
✅ DocsOracle validates document integrity
✅ GC cleans up stale docs and invalidates dependent overlays
✅ Guides explain full O₃ workflow

---

## Estimated Scope

- **Strategic coherence CLI**: ~2-3 hours
- **Coherence query commands**: ~3-4 hours
- **Concepts query commands**: ~2-3 hours
- **Docs oracle & GC**: ~2-3 hours
- **Integration**: ~2-3 hours
- **Documentation**: ~1-2 hours

**Total**: ~12-18 hours of focused implementation

---

## Notes

Generated: 2025-10-26
Context: Post-mission concepts implementation
Blocked by: None (all dependencies implemented)
Ready to start: Phase 1 (Strategic coherence CLI)
