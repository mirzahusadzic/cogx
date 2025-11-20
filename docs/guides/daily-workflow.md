# 04 - Daily Workflow: The Living PGC

Once your PGC is initialized, you'll use these commands daily to keep it synchronized with your codebase. This implements the **event-driven architecture** from Monuments 1-3: a reflexive nervous system that detects changes and heals automatically.

## The Core Loop

```
watch → dirty_state.json → status → update → coherence restored ♻️
```

This cycle keeps your PGC in sync with code changes without requiring full re-genesis.

---

## Monument 1: The Sentinel (`watch`)

### **`cognition-cli watch`**

Monitors your source files for changes in real-time and maintains a dirty state ledger.

**When to use:** Run this in a separate terminal during active development. It continuously watches your codebase and tracks which files have changed.

```bash
# Start watching in current directory
cognition-cli watch

# Watch with verbose output showing hashes
cognition-cli watch --verbose

# Also detect new untracked files
cognition-cli watch --untracked

# Adjust debounce for rapid file changes
cognition-cli watch --debounce 500
```

### Options

- `--untracked` - Also watch for new untracked files (default: false)
- `--debounce <ms>` - Debounce delay in milliseconds (default: 300)
- `--verbose` - Show detailed change events including file hashes

### What It Does

- Uses `chokidar` for cross-platform file watching
- Computes file hashes to detect actual content changes (not just timestamps)
- Maintains `.open_cognition/dirty_state.json` with changed files
- Emits real-time notifications when changes are detected
- Automatically ignores `node_modules`, `.git`, `dist`, `build`, etc.

### The dirty_state.json Format

```json
{
  "last_updated": "2025-10-24T06:30:08.883Z",
  "dirty_files": [
    {
      "path": "src/config.ts",
      "tracked_hash": "a1b2c3d4...",
      "current_hash": "e5f6g7h8...",
      "detected_at": "2025-10-24T06:29:44.081Z",
      "change_type": "modified"
    }
  ],
  "untracked_files": []
}
```

### Example Output

```bash
$ cognition-cli watch

👁️  Watching for changes...

✗ src/core/config.ts
Detected change: src/core/config.ts

✗ src/commands/status.ts
Detected change: src/commands/status.ts

Press Ctrl+C to stop watching.
```

---

## Monument 2: The Reality Check (`status`)

### **`cognition-cli status`**

Instantly checks if your PGC is coherent by reading the dirty state. Your **< 10ms** reality check.

**When to use:** Run before committing, after pulling changes, or anytime you want to know if the PGC matches your code.

```bash
# Check coherence status
cognition-cli status

# Get detailed output with symbol names
cognition-cli status --verbose

# Machine-readable output for scripts
cognition-cli status --json

# Use in shell scripts
if cognition-cli status; then
  echo "PGC is coherent!"
else
  echo "PGC needs updating"
fi
```

### Options

- `--json` - Output as JSON for scripting
- `--verbose` - Show detailed symbol names affected

### Exit Codes

- `0` - 🔔 Coherent (PGC matches code)
- `1` - 🎐 Incoherent (changes detected)

### Example Outputs

**When coherent** 🔔:

```bash
$ cognition-cli status
🔔 PGC Status: COHERENT

The Echo rings clear - all tracked files resonate with the PGC.

Last checked: 2025-10-24T06:30:08.883Z
```

**When incoherent** 🎐:

```bash
$ cognition-cli status
🎐 PGC Status: INCOHERENT

Summary:
  Modified files: 3
  Impacted symbols: 12

Modified Files:
  ✗ src/core/config.ts
    5 symbols, 0 consumers
  ✗ src/commands/status.ts
    4 symbols, 0 consumers
  ✗ src/cli.ts
    3 symbols, 0 consumers

Next Steps:
  Run cognition-cli update to sync PGC with changes
  Run cognition-cli status --verbose for detailed impact
```

### Using Status for Commit Optimization

Status tells you the **blast radius** of your changes. Use it to decide:

- **Small impact** (1-5 symbols) → Focused commit, ship it! ✅
- **Medium impact** (6-15 symbols) → Review for cohesion 🔍
- **Large impact** (15+ symbols) → Split commits or architectural review 🏗️

Smaller commits lead to faster `update` operations and reduce conflicts in multi-agent scenarios!

---

## Monument 3: The Healing Function (`update`)

### **`cognition-cli update`**

Incrementally syncs the PGC with your code changes. Only processes files marked dirty by the watcher.

**When to use:** Run after making changes to bring the PGC back into coherence. Much faster than re-running `genesis`.

```bash
# Update PGC with all dirty files
cognition-cli update

# Update with custom workbench
cognition-cli update --workbench http://localhost:8001
```

### Options

- `-p, --project-root <path>` - Root directory (default: current directory)
- `-w, --workbench <url>` - eGemma workbench URL (default: `http://localhost:8000`)

### Exit Codes

- `0` - Update successful, PGC coherent
- `1` - Update failed or verification error

### What It Does

- Reads `dirty_state.json` to find changed files
- Re-extracts structural data for each dirty file
- Updates `objects/`, `transforms/`, `index/`, and `reverse_deps/`
- Runs Oracle verification to ensure consistency
- Clears `dirty_state.json` on success

### Performance Characteristics

- **Incremental** - Only processes changed files, not entire codebase
- **Optimized** - Skips Oracle verification if no files were actually processed
- **Hash-based** - Detects when dirty_state has false positives (e.g., after `git checkout`)
- **Verifiable** - Every update recorded in transform log for auditability

### Example Session

```bash
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
```

### The Update Function (U)

Implements the Invalidate algorithm from CogX:

```
Change(⊥) → Invalidate(⊥) → Propagate_Up(Join_edges) → Invalidate(⊤)
```

Currently implemented:

- ✅ Re-process dirty files (Genesis Layer update)
- ✅ Store new content/structural hashes
- ✅ Record transforms in Lops
- ✅ Update reverse_deps for future propagation

Future work (when overlays are fully synthesized):

- ⏳ Propagate invalidation upward through reverse_deps
- ⏳ Invalidate dependent overlay elements
- ⏳ Calculate Delta for multi-agent coordination

---

## The Complete Workflow

These commands form a complete feedback loop:

```bash
# Terminal 1: The Sentinel 🗼
cognition-cli watch

# Terminal 2: The Developer 💻
vim src/core/config.ts

# Terminal 1 shows:
# ✗ src/core/config.ts
# Detected change: src/core/config.ts

# Terminal 2: Check impact
cognition-cli status
# 🎐 Modified files: 1, Impacted symbols: 5

# Terminal 2: Heal the PGC
cognition-cli update
# ✓ Update complete - PGC is coherent

# Terminal 2: Verify
cognition-cli status
# 🔔 COHERENT
```

This is the **operational implementation** of event-driven architecture from CogX. The PGC now has a reflexive nervous system - it detects changes and heals automatically! 🧠

---

## Integration with Git

### Pre-Commit Hook

Ensure PGC is coherent before committing:

```bash
# .git/hooks/pre-commit
#!/bin/bash
if ! cognition-cli status --json > /dev/null 2>&1; then
  echo "PGC is incoherent. Run 'cognition-cli update' before committing."
  exit 1
fi
```

### Post-Merge Hook

Sync PGC after pulling changes:

```bash
# .git/hooks/post-merge
#!/bin/bash
cognition-cli update
```

---

## Advanced Usage

### Getting Help

View detailed, candid guides for each command:

```bash
# List all available guides
cognition-cli guide

# Show the watch guide
cognition-cli guide watch

# Show the status guide
cognition-cli guide status

# Show the update guide
cognition-cli guide update
```

The guides include:

- 🎯 The Point - What it does and why it matters
- ⚡ Command reference with all options
- 🎨 Example outputs showing real usage
- 🏗️ How the magic works (architecture)
- 🎭 Real-world scenarios and workflows

### Automation

Use status in CI/CD:

```bash
# Fail CI if PGC is out of sync
cognition-cli status || exit 1

# Or update automatically
if ! cognition-cli status; then
  cognition-cli update
fi
```

---

## Performance Tips

1. **Keep watch running** - Minimal overhead, instant dirty state tracking
2. **Check status before big refactors** - Know the blast radius upfront
3. **Update frequently** - Small, incremental updates are faster than big ones
4. **Use --verbose sparingly** - Only when you need detailed symbol information
5. **Monitor dirty_state.json** - If it grows large, run update sooner

---

## Troubleshooting

### Watch Not Detecting Changes

**Problem:** Files changed but watch doesn't detect them.

**Solutions:**

- Ensure you're editing files inside the watched directory
- Check if files are in `.gitignore` patterns
- Increase `--debounce` if changes are too rapid
- Restart watch if it seems stuck

### Status Shows False Positives

**Problem:** Status shows dirty files but they haven't actually changed.

**Solutions:**

- Run `update` - it will detect unchanged content via hashing
- Check if `git checkout` changed mtimes without changing content
- Delete `.open_cognition/dirty_state.json` and restart watch

### Update Takes Too Long

**Problem:** Update processing is slower than expected.

**Solutions:**

- Check workbench connectivity (`curl http://localhost:8000/health`)
- Reduce number of dirty files by committing more frequently
- Use `--skip-gc` if switching branches frequently
- Monitor eGemma workbench logs for rate limiting

---

## What's Next?

Now that you understand the daily workflow, learn about:

- **[Querying the Lattice](./querying-the-lattice.md)** - Boolean algebra across overlays
- **[Interactive Mode](./interactive-mode.md)** - TUI with Claude integration
- **[Seven Overlays](../architecture/overlays/README.md)** - Deep analytical capabilities
