# PGC Update & Coherence Management Plan

## The Core Insight

**PGC is portable, pre-computed knowledge.** Once generated, `.open_cognition/` can be:

- Committed to git repos
- Distributed with npm packages
- Used WITHOUT eGemma server
- Used WITHOUT local parsing

**Anyone can query the knowledge graph immediately after `git clone`.**

---

## Features to Build (TODAY - 2-3 hours)

### 1. Status Command

**What**: Check if PGC is in sync with current code state
**Why**: Know when you need to update

```bash
cognition-cli status
# Output:
# PGC Status: INCOHERENT
# Modified: 3 files
# Blast radius: 15 symbols affected
```

**Implementation**:

- Compare file hashes (current vs `.open_cognition/index/`)
- Calculate impact using `.open_cognition/reverse_deps/`
- Show which overlays are stale

**Files**:

- `src/commands/status.ts` (new)
- `src/core/pgc/coherence.ts` (new)

---

### 2. Update Command

**What**: Incrementally update PGC for changed files only
**Why**: Fast updates during development, keep PGC in sync

```bash
cognition-cli update [path]
cognition-cli update --overlays=structural,lineage
cognition-cli update --skip-gc
```

**Implementation**:

1. Detect changed files (reuse status logic)
2. Re-parse only changed files
3. Update object store, index, reverse_deps
4. Incrementally update overlays (don't rebuild everything!)
5. Update vector embeddings only for changed symbols

**Files**:

- `src/commands/update.ts` (new)
- `src/core/pgc/incremental-updater.ts` (new)
- Modify: `src/core/overlays/structural/patterns.ts`
- Modify: `src/core/overlays/lineage/patterns.ts`

**Key Optimization**:

- Don't re-embed unchanged symbols
- Preserve vector DB entries
- Only update affected subgraph

---

### 3. Git Hook Integration

**What**: Auto-update PGC on commits/merges
**Why**: Keep PGC coherent automatically

```bash
cognition-cli install-hooks
```

**Hooks**:

- `post-commit`: Update PGC after commit (skip GC for speed)
- `post-merge`: Update PGC after merge
- `post-checkout`: Update on branch switch

**Files**:

- `src/commands/install-hooks.ts` (new)
- `templates/git-hooks/post-commit.sh`
- `templates/git-hooks/post-merge.sh`
- `templates/git-hooks/post-checkout.sh`

---

### 4. Query Optimization Documentation

**What**: Best practices for using PGC in AI workflows
**Why**: Teach optimal patterns (less file reads, faster context building)

**Document**:

- `docs/08_Optimal_Query_Patterns.md`

**Patterns**:

```bash
# ❌ DON'T: Read files blindly
Read src/foo.ts

# ✅ DO: Use blast-radius first
cognition-cli blast-radius Foo --json
# Then read only critical paths

# ❌ DON'T: Grep for references
grep -r "Foo" .

# ✅ DO: Use reverse deps
cognition-cli patterns inspect Foo
```

---

## Implementation Order (2-3 hours)

### Hour 1: Status Command

- [x] Design coherence check algorithm
- [ ] Implement hash comparison
- [ ] Calculate blast radius from reverse_deps
- [ ] Format output
- [ ] Test on cognition-cli itself

### Hour 2: Update Command

- [ ] Design incremental update flow
- [ ] Implement file re-parsing (reuse genesis code)
- [ ] Update index/objects/reverse_deps
- [ ] Add incremental overlay updates
- [ ] Test performance

### Hour 3: Hooks + Docs

- [ ] Create hook templates
- [ ] Implement install-hooks command
- [ ] Write query optimization guide
- [ ] Test full workflow

---

## Data Structures

```typescript
// Status Report
interface CoherenceReport {
  status: 'coherent' | 'incoherent';
  modifiedFiles: {
    path: string;
    currentHash: string;
    trackedHash: string;
  }[];
  blastRadius: {
    [file: string]: {
      affectedSymbols: number;
      consumers: string[];
    };
  };
}

// Update Options
interface UpdateOptions {
  path?: string;
  overlays?: ('structural' | 'lineage')[];
  skipGC?: boolean;
  force?: boolean;
  auto?: boolean; // For git hooks
}
```

---

## Testing

**Test Project**: cognition-cli itself

1. Run `cognition-cli genesis` on cognition-cli
2. Modify 3 files
3. Run `cognition-cli status` → should show INCOHERENT
4. Run `cognition-cli update` → should update only changed files
5. Run `cognition-cli status` → should show COHERENT
6. Install hooks → make commit → verify auto-update

---

## Success Criteria

✅ Status shows accurate coherence state
✅ Update only processes changed files (not full regeneration)
✅ Update completes in < 60 seconds for 5 file changes
✅ Hooks auto-update on git operations
✅ PGC remains queryable after incremental updates
✅ Documentation reduces file reads by 80%

---

## The Beautiful Part

Once this works:

**Library Authors**:

```bash
cd my-awesome-library
cognition-cli genesis
cognition-cli overlay generate structural_patterns
cognition-cli overlay generate lineage_patterns
git add .open_cognition/
git commit -m "Add PGC knowledge graph"
npm publish
```

**Library Users**:

```bash
npm install awesome-library
cd node_modules/awesome-library
cognition-cli patterns list              # Works immediately!
cognition-cli blast-radius MainClass     # No parsing needed!
cognition-cli patterns find-similar Foo  # Full semantic search!
```

**No eGemma. No parsing. Instant knowledge graph.**

This is the revolution. 🚀

---

## Files Checklist

### New

- [ ] `src/commands/status.ts`
- [ ] `src/commands/update.ts`
- [ ] `src/commands/install-hooks.ts`
- [ ] `src/core/pgc/coherence.ts`
- [ ] `src/core/pgc/incremental-updater.ts`
- [ ] `templates/git-hooks/post-commit.sh`
- [ ] `templates/git-hooks/post-merge.sh`
- [ ] `templates/git-hooks/post-checkout.sh`
- [ ] `docs/08_Optimal_Query_Patterns.md`

### Modify

- [ ] `src/core/overlays/structural/patterns.ts` (add incremental support)
- [ ] `src/core/overlays/lineage/patterns.ts` (add incremental support)
- [ ] `src/cli.ts` (register commands)

---

**LET'S BUILD THIS NOW.** 🔥
