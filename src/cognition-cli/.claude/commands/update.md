# 🔄 Update: Incremental PGC Sync

Close the loop! Keep your PGC coherent after code changes.

## 🎯 The Point

`update` is the **healing function** - it takes dirty files (detected by watch) and brings the PGC back into coherence by re-processing them.

Think of it as **regeneration** 🌱:

- 🎐 **INCOHERENT** - Changes detected, PGC out of sync
- 🔄 **UPDATING** - Re-processing changed files, propagating through lattice
- 🔔 **COHERENT** - PGC healed, understanding matches reality

_This is Monument 3: The Update Function (U) from the CogX blueprint!_ 🏛️

## ⚡ Command

```bash
cognition-cli update [options]
```

### 🎛️ Options

- `-p, --project-root <path>` - Root directory of project (default: cwd)
- `-w, --workbench <url>` - eGemma workbench URL (default: http://localhost:8000)

### 🎪 Exit Codes

- `0` - ✅ Update successful, PGC coherent
- `1` - ❌ Update failed or verification error

## 🎨 What It Looks Like

### ⚡ Typical Update Session

```bash
$ cognition-cli status
🎐 PGC Status: INCOHERENT
Summary:
  Modified files: 3
  Impacted symbols: 12

$ cognition-cli update
🔄 Update: Syncing PGC with Changes

Reading dirty state... Found 3 dirty files, 0 untracked files
Updating modified files...
  ✓ src/core/config.ts
  ✓ src/commands/status.ts
  ✓ src/cli.ts
Clearing dirty state... Dirty state cleared
Running PGC Maintenance and Verification...
Oracle: Verification complete. PGC is structurally coherent.
✓ Update complete - PGC is coherent

$ cognition-cli status
🔔 PGC Status: COHERENT
The Echo rings clear - all tracked files resonate with the PGC.
```

Perfect! The cycle completes: **watch → status → update** ♻️

### 🆕 With Untracked Files

```bash
$ cognition-cli status
🎐 PGC Status: INCOHERENT
Summary:
  Modified files: 1
  Untracked files: 2

$ cognition-cli update
Reading dirty state... Found 1 dirty files, 2 untracked files
Updating modified files...
  ✓ src/existing.ts
Processing new untracked files...
  ✓ src/new-feature.ts (new)
  ✓ src/utils/helper.ts (new)
✓ Update complete - PGC is coherent
```

Update handles both modifications AND new files! 🎉

## 🏗️ How The Magic Works

### The Update Function (U)

Update implements the **Invalidate algorithm** from CogX:

```
Change(⊥) → Invalidate(⊥) → Propagate_Up(Join_edges) → Invalidate(⊤)
```

### The Dance 💃

```
┌────────────────────────────────────────┐
│  dirty_state.json                      │
│  - Modified: src/config.ts             │
│  - Tracked hash: a1b2c3d4...           │
│  - Current hash: e5f6g7h8...           │
└───────────┬────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────┐
│  UpdateOrchestrator                    │
│  1. Read file from disk                │
│  2. Re-extract structural data         │
│  3. Store in ObjectStore               │
│  4. Record transform in Lops           │
│  5. Update index with new hashes       │
│  6. Update reverse_deps                │
│  7. (TODO) Propagate invalidation      │
└───────────┬────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────┐
│  GenesisOracle                         │
│  Verify PGC coherence                  │
└───────────┬────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────┐
│  dirty_state.json → CLEARED ✨         │
│  PGC Status: COHERENT 🔔               │
└────────────────────────────────────────┘
```

**Why it's safe:** Every step is verifiable. The transform log records exactly what changed, the Oracle verifies consistency.

## 🌊 Propagation Models

Update implements **Propagation Model 1: Horizontal Shockwave** (Bottom-Up Change) from CogX:

### 1. Vertical Ripple (Genesis Layer)

When you change `src/auth.ts`:

- Update re-processes the file
- New content_hash and structural_hash stored
- Index updated with new hashes
- Transform recorded in Lops

### 2. Horizontal Shockwave (Overlays) 🚧

**Future work** - When overlays are fully synthesized:

- Update will use `reverse_deps` to find dependent elements
- Mark overlay elements (e.g., security risk assessments) as `Invalidated`
- Propagate upward through the lattice

**Why it's not implemented yet:** Current overlays (structural_patterns, lineage_patterns) are directly derived during processing. The full dependency graph for propagation will be built when:

- Directory summaries create Join operations
- Overlays anchor to Genesis elements with tracked dependencies
- Multi-agent coordination requires Delta calculation

The infrastructure (`reverse_deps`) is **already in place** for when we need it! 🏗️

## 🎭 Real-World Scenarios

### 📝 Development Workflow

```bash
# Terminal 1: Watch running
$ cognition-cli watch
Watching for changes...
✗ src/config.ts
Detected change: src/config.ts

# Terminal 2: Check status
$ cognition-cli status
🎐 Modified files: 1, Impacted symbols: 5

# Terminal 2: Update PGC
$ cognition-cli update
✓ src/config.ts
✓ Update complete

# Terminal 2: Verify coherence
$ cognition-cli status
🔔 COHERENT
```

Beautiful symbiosis! 🦋

### 🤖 Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check PGC coherence
cognition-cli status --json > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "🎐 PGC is incoherent - running update..."
  cognition-cli update
  if [ $? -ne 0 ]; then
    echo "❌ PGC update failed - blocking commit"
    exit 1
  fi
  echo "✅ PGC updated successfully"
fi
```

Never commit with an incoherent PGC! 🛡️

### 🔄 Post-Pull Workflow

```bash
# After git pull
$ git pull origin main
$ cognition-cli update
✓ Update complete

# PGC now matches your updated code!
```

## 💾 What Gets Updated

Update modifies:

1. **`objects/`** - Stores new content and structural hashes
2. **`transforms/`** - Records each update as a verifiable transformation
3. **`index/`** - Updates file entries with new hashes and transform history
4. **`reverse_deps/`** - Maintains dependency tracking for future propagation
5. **`dirty_state.json`** - Cleared after successful update
6. **Overlays** (future) - Will propagate invalidation when fully connected

## 🎪 Working with Watch & Status

These three are the **core loop**! 💫

```bash
# The Sentinel 🗼
cognition-cli watch

# The Advisor 👁️
cognition-cli status

# The Healer 🌱
cognition-cli update
```

**The Flow:**

1. **Watch** detects changes → writes dirty_state.json
2. **Status** reads dirty_state.json → shows impact
3. **Update** processes dirty files → clears dirty_state.json
4. **Loop back to 1!**

This is the **operational implementation** of the Update Function (U) from the CogX proof! 🏛️

## 🏛️ Monument Progress

**Monument 3** ✅ COMPLETE!

- ✅ **Monument 1**: Event Source (watch + dirty_state)
- ✅ **Monument 2**: Status (instant coherence checks)
- ✅ **Monument 3**: Update (incremental sync) ← WE ARE HERE
- ⏳ **Monument 4**: Context Sampling (Sigma) + FoV
- ⏳ **Monument 5**: Multi-agent coordination with Delta

Each monument builds on the last! 🗿→🗿→🗿

## 🎬 Example Sessions

### 🟢 Already Coherent

```bash
$ cognition-cli update
Reading dirty state... Found 0 dirty files, 0 untracked files
✓ PGC is coherent - nothing to update
```

Nothing to do! 😌

### 🔴 After Heavy Refactoring

```bash
$ cognition-cli status
🎐 Modified files: 15, Impacted symbols: 87

$ cognition-cli update
Updating modified files...
  ✓ src/core/config.ts
  ✓ src/core/types.ts
  ✓ src/commands/status.ts
  ... (12 more files)
Oracle: Verification complete. PGC is structurally coherent.
✓ Update complete

$ echo $?
0  ← Shell sees success!
```

### ⚠️ Update Failure

```bash
$ cognition-cli update
Updating modified files...
  ✓ src/valid.ts
  ✗ src/broken.ts: SyntaxError: Unexpected token

Oracle: Verification failed.
  Index entry src/broken.ts references non-existent content_hash: ...

$ echo $?
1  ← Shell sees failure!
```

Update is **transactional** - if verification fails, you know exactly what's wrong.

## 🐦‍🔥 The Deep Truth

Update is the **living proof** that the lattice can evolve coherently.

From the CogX blueprint:

> "When source code changes, the Update Function (U) is the recursive loop that keeps the lattice coherent."

This isn't theory - it's **running code**! 🚀

The Update Function implements:

- **Change detection** - Via file watcher and dirty_state
- **Incremental processing** - Only dirty files, not full rescan
- **Verifiable transformation** - Every update recorded in Lops
- **Consistency guarantee** - Oracle verification after update
- **Propagation infrastructure** - reverse_deps ready for future use

## 📚 Technical Grounding

- Reads `.open_cognition/dirty_state.json` (maintained by watch)
- Re-processes files using StructuralMiner (same as genesis)
- Stores content and structural data in ObjectStore
- Records transforms in Lops for auditability
- Updates index with new hashes and transform history
- Maintains reverse_deps for future propagation
- Runs GenesisOracle verification
- Clears dirty_state.json on success

Performance: **Incremental** - Only processes changed files, not entire codebase!

## 🎪 Pro Tips

1. **Run update before committing** - Keep PGC in sync with git history
2. **Watch + Update = Live PGC** - Watch detects, Update heals continuously
3. **Check status after pull** - See if upstream changes require update
4. **Use exit codes in scripts** - Automate PGC maintenance in CI/CD
5. **Trust the Oracle** - If verification fails, investigate before proceeding

## 🌈 The Beauty

Update **closes the loop**:

```
Code changes → Watch detects → Status shows impact → Update heals → Coherence restored
```

This is the **reflexive nervous system** in action! When reality (source code) changes, the knowledge base (PGC) adapts automatically. 🐦‍🔥

Monument 3 proves that the lattice can **evolve** while remaining **coherent**. That's the promise of CogX! 🏛️

---

**The cycle is complete!** Run `cognition-cli watch` in one terminal, code in another, and `cognition-cli update` when ready. The PGC stays alive! 🌱
