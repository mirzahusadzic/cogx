# 🔍 Check PGC Coherence Status

Is your PGC in sync? Find out in < 10ms! 🚀

## 🎯 The Point

`status` is your **instant reality check** - it tells you if the PGC's understanding matches your actual code. No file scanning, no waiting. Just pure, event-driven truth.

Think of it as **listening to an echo** 🔔:

- 🔔 **COHERENT** - One clear bell, perfect resonance, single truth
- 🎐 **INCOHERENT** - Wind chimes, many bells, cacophony of changes

_A salute to Echo and the Semantic Echo Network - where truth propagates like sound waves!_ 🌊

## ⚡ Command

```bash
cognition-cli status [options]
```

### 🎛️ Options

- `--json` - Machine-readable output (for robots 🤖)
- `--verbose` - Show me EVERYTHING (symbol names, the works)

### 🎪 Exit Codes

- `0` - 🟢 Coherent (shell scripts love this)
- `1` - 🔴 Incoherent (time to update!)

## 🎨 What It Looks Like

### 🔔 When Everything's Perfect

```bash
$ cognition-cli status
🔔 PGC Status: COHERENT

The Echo rings clear - all tracked files resonate with the PGC.

Last checked: 2025-10-24T05:56:38.283Z
```

_Chef's kiss_ 👌 - One clear tone, perfect resonance!

### 🎐 When You've Been Coding

```bash
$ cognition-cli status
🎐 PGC Status: INCOHERENT

Summary:
  Modified files: 1
  Impacted symbols: 2

Modified Files:
  ✗ src/cli.ts
    2 symbols, 0 consumers

Next Steps:
  Run cognition-cli update to sync PGC with changes
  Run cognition-cli status --verbose for detailed impact
```

This is saying: _"Hey! You changed `src/cli.ts` and now 2 symbols are out of date!"_

### 🔬 Verbose Mode (For the Curious)

```bash
$ cognition-cli status --verbose
🎐 PGC Status: INCOHERENT

Summary:
  Modified files: 1
  Impacted symbols: 2

Modified Files:
  ✗ src/cli.ts
    Symbols: queryAction, QueryCommandOptions  ← THESE are affected!

Next Steps:
  Run cognition-cli update to sync PGC with changes
```

Now you know **exactly** which symbols need attention.

### 🤖 JSON Mode (For Scripts & Robots)

```bash
$ cognition-cli status --json
{
  "status": "incoherent",
  "summary": {
    "modifiedCount": 1,
    "untrackedCount": 0,
    "totalImpact": 2
  },
  "modified_files": [
    {
      "path": "src/cli.ts",
      "tracked_hash": "a149dbb49be3",
      "current_hash": "ee557e1500c5",
      "change_type": "modified",
      "detected_at": "2025-10-24T05:48:44.081Z",
      "blast_radius": {
        "affectedSymbols": ["queryAction", "QueryCommandOptions"],
        "consumerCount": 0,
        "maxDepth": 0
      }
    }
  ],
  "untracked_files": []
}
```

Perfect for `jq`, CI/CD pipelines, or your custom automation! 🛠️

## 🏗️ How The Magic Works

### The Secret Sauce 🧪

```
┌─────────────────────────────────────┐
│  📝 dirty_state.json                │  ← File watcher writes here
│  (your "what changed" ledger)       │
└──────────┬──────────────────────────┘
           │
           │ read (< 10ms! ⚡)
           ▼
┌─────────────────────────────────────┐
│  🔍 status command                  │
│  - Reads the ledger                 │
│  - Checks PGC index                 │
│  - Calculates impact                │
│  - Paints it pretty                 │
└─────────────────────────────────────┘
```

**Why so fast?** Because the file watcher already did the heavy lifting! Status just reads what's been recorded.

### The Dance 💃

1. **Read** `dirty_state.json` (instant JSON load)
2. **For each dirty file**:
   - Peek at PGC index 📚
   - Extract symbol names 🏷️
   - Count the impact 💥
3. **Paint the output** 🎨 (colors for humans, JSON for machines)
4. **Exit with vibes** 🚪 (0 = ✅, 1 = ❌)

## 🎭 Real-World Scenarios

### 📝 Before You Commit

```bash
# You: *makes brilliant changes*
vim src/core/config.ts

# You: *nervous* "Did I break the PGC?"
cognition-cli status

# Status: "Yep! 1 file dirty, 5 symbols affected"
🎐 PGC Status: INCOHERENT
  Modified files: 1
  Impacted symbols: 5

# You: "Better update before committing!"
cognition-cli update
```

### 🎯 Optimizing Commit Batches

**Use status to reflect on when to commit** - the blast radius tells you if your changes are focused or sprawling:

```bash
# After editing a few files
$ cognition-cli status --verbose
🎐 PGC Status: INCOHERENT
Summary:
  Modified files: 2
  Impacted symbols: 3

Modified Files:
  ✗ src/auth/login.ts
    Symbols: validateCredentials
  ✗ src/auth/session.ts
    Symbols: createSession, destroySession

# Small, focused change → Good commit candidate! ✅
git add src/auth/
git commit -m "feat(auth): add session management"

# Versus...
$ cognition-cli status --verbose
🎐 PGC Status: INCOHERENT
Summary:
  Modified files: 8
  Impacted symbols: 47

# Large blast radius → Maybe split into multiple commits? 🤔
# Or review if this is actually a cohesive architectural change
```

**The insight**: Status isn't just "is PGC synced?" - it's **meta-information about code quality**. Use it to decide:

- **Small impact** (1-5 symbols) → Focused commit, ship it! ✅
- **Medium impact** (6-15 symbols) → Review for cohesion 🔍
- **Large impact** (15+ symbols) → Split commits or architectural review 🏗️

**The cascading benefits** 🌊:

```
Smaller commits (via status optimization)
    ↓
Faster Update(U) function (less work to sync)
    ↓
Lower Delta calculation (smaller context disturbance)
    ↓
Safer multi-agent coordination (less chance of Delta_crit!)
```

When you optimize commits using `status`, you're not just keeping PGC clean - you're **optimizing the entire multi-agent system**! Every small, focused commit makes Update faster and reduces the chance of triggering Delta_crit when multiple agents work simultaneously. 🤝

### 🤖 CI/CD Pipeline

```bash
#!/bin/bash
# .github/workflows/check-pgc.yml

cognition-cli status --json > /tmp/pgc-status.json
if [ $? -ne 0 ]; then
  echo "🔴 PGC out of sync! Someone forgot to run 'update'"
  exit 1
else
  echo "🟢 PGC is coherent - ship it!"
fi
```

Exit codes make automation _chef's kiss_ 👌

### 🔬 Impact Analysis

```bash
# What symbols are affected by my changes?
cognition-cli status --verbose | grep "Symbols:"

# Get structured data
cognition-cli status --json | jq '.modified_files[].blast_radius.affectedSymbols'
```

## 💥 Blast Radius (Impact Metrics)

For each dirty file, status shows:

- 🎯 **affectedSymbols**: Which symbols changed
- 👥 **consumerCount**: How many files use them (coming soon!)
- 📏 **maxDepth**: How deep the impact spreads (coming soon!)

### 🚀 Future: Full Blast Radius

Once Monument 3 & 4 are built:

```typescript
blast_radius: {
  affectedSymbols: ["Config", "ToolRegistry"],
  consumerCount: 15,        // 15 files depend on these!
  maxDepth: 4,              // Impact spreads 4 levels deep
  criticalPaths: [          // Danger zones!
    "Config → ToolRegistry → BaseTool → EditTool"
  ]
}
```

You'll see the **ripple effect** of every change! 🌊

## 🎪 Working with Watch

These two are best friends! 👯

```bash
# Terminal 1: The Sentinel 🗼
cognition-cli watch

# Terminal 2: The Coder 💻
vim src/foo.ts

# Terminal 1: "Change detected! 🚨"
✗ src/foo.ts
Detected change: src/foo.ts

# Terminal 2: "What's the damage?"
cognition-cli status
✗ PGC Status: INCOHERENT
  Modified files: 1
  Impacted symbols: 3
```

Watch **maintains** the state, status **reads** it. Beautiful symbiosis! 🦋

## 🏛️ Monument Progress

**Monument 2** ✅ COMPLETE!

- ✅ **Monument 1**: Event Source (watch + dirty_state)
- ✅ **Monument 2**: Status (instant coherence checks) ← WE ARE HERE
- ⏳ **Monument 3**: Update (incremental sync)
- ⏳ **Monument 4**: Context Sampling (Sigma) + FoV
- ⏳ **Monument 5**: Multi-agent coordination

Each monument builds on the last, elegantly! 🗿→🗿→🗿

## 🎬 Example Sessions

### 🟢 Clean Slate

```bash
$ cognition-cli status
✓ PGC Status: COHERENT

All tracked files are in sync with the PGC.

$ echo $?
0  ← Shell sees success!
```

### 🔴 After Hacking

```bash
$ vim src/core/config.ts  # *furious typing*
$ cognition-cli status
✗ PGC Status: INCOHERENT

Summary:
  Modified files: 1
  Impacted symbols: 5

Modified Files:
  ✗ src/core/config.ts
    5 symbols, 0 consumers

Next Steps:
  Run cognition-cli update to sync PGC with changes

$ echo $?
1  ← Shell sees "not ok!"
```

### 🤖 Robot Talk (JSON)

```bash
# What's the status?
$ cognition-cli status --json | jq -r '.status'
incoherent

# How many files?
$ cognition-cli status --json | jq -r '.summary.modifiedCount'
1

# Which files?
$ cognition-cli status --json | jq -r '.modified_files[].path'
src/core/config.ts

# Impact?
$ cognition-cli status --json | jq -r '.modified_files[].blast_radius.affectedSymbols[]'
queryAction
QueryCommandOptions
```

## 🐦‍🔥 The Deep Truth

Status doesn't scan files. It **trusts the event stream**.

This is the **no-present paradigm** in action:

- **Past**: dirty_state.json (what changed)
- **Future**: what needs updating

Status is the **interface** between them - it shows you the delta! ⚡

## 📚 Technical Grounding

- Reads `.open_cognition/dirty_state.json` (maintained by watch)
- Symbol extraction from PGC index (`IndexData.structuralData`)
- Exit codes: `0` = coherent, `1` = incoherent
- Performance: **< 10ms** (just JSON read + index lookup)
- Zero file scanning, zero hashing - pure state reading
- Foundation for incremental update workflows

## 🎪 Pro Tips

1. **Run before committing** - Know what's dirty!
2. **Use `--json` in scripts** - Exit codes + structured data = automation heaven
3. **Use `--verbose` when debugging** - See symbol names to understand impact
4. **Pair with watch** - Live status updates as you code
5. **Grep the output** - `cognition-cli status | grep "Impacted symbols"` for quick checks

## 🌈 The Beauty

This command is **< 50 lines of actual logic**. Why?

Because the **architecture** does the work:

- Watch maintains truth
- Status reads truth
- Update synchronizes truth

Each monument has **one job**. That's elegance! 🎨

---

**Ready to update?** Run `cognition-cli update` to sync the PGC! 🚀
