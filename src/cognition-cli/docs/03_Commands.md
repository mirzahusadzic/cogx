# 03 - Commands: Interacting with the Cognition CLI

The `cognition-cli` provides a powerful suite of commands for building, managing, and exploring your project's Grounded Context Pool (PGC). The commands are designed to be used in a logical workflow, moving from foundational setup to deep architectural analysis.

To see a list of all available commands, simply run `cognition-cli --help`.

## Quick Reference

```bash
# Setup
cognition-cli init                              # Initialize PGC
cognition-cli genesis src/                      # Build knowledge graph

# Live System (Monument 1-3: Event-Driven Coherence)
cognition-cli watch                             # Monitor file changes in real-time
cognition-cli status                            # Check PGC coherence (< 10ms)
cognition-cli update                            # Sync PGC with changes
cognition-cli guide [topic]                     # Show command guides

# Overlays
cognition-cli overlay generate structural_patterns .  # Generate structural overlay
cognition-cli overlay generate lineage_patterns .     # Generate lineage overlay

# Pattern Analysis
cognition-cli patterns list                     # List all structural patterns
cognition-cli patterns analyze                  # Show architecture distribution
cognition-cli patterns inspect MyClass          # Inspect symbol details
cognition-cli patterns graph MyClass            # Visualize dependency tree
cognition-cli patterns find-similar MyClass     # Find similar code
cognition-cli patterns compare Class1 Class2    # Compare two symbols

# Impact Analysis
cognition-cli blast-radius MySymbol             # Show impact of changing symbol

# Queries
cognition-cli query MySymbol --depth 2          # Traverse dependencies
cognition-cli query MySymbol --lineage          # Get lineage JSON

# Auditing
cognition-cli audit:transformations src/file.ts # Audit file history
```

---

## 1. Foundational Commands (The Genesis Workflow)

These are the primary commands for creating and populating your project's "digital brain."

### **`cognition-cli init`**

Initializes the PGC in your project, creating the `.open_cognition` directory and all of its necessary sub-directories (`objects`, `transforms`, `index`, etc.).

- **When to Use It:** Run this command once when you first introduce `cognition-cli` to a project. It's the foundational step that prepares the ground for all future knowledge generation.

```bash
# Initialize in the current directory
cognition-cli init

# Initialize in a specific project directory
cognition-cli init --projectRoot /path/to/your/project
```

### **`cognition-cli genesis [sourcePath]`**

Populates the PGC by performing a deep structural analysis of your codebase. It discovers source files, parses them to extract structural data (classes, functions, imports), and stores the results in the PGC's content-addressable storage.

- **When to Use It:** This is the main "heavy-lifting" command. Run it after `init` to build the initial knowledge graph. You can re-run it later to update the PGC with new files and changes.
- **Options:**
  - `-p, --project-root <path>` - Root directory of the project being analyzed (default: current directory)
  - `-w, --workbench <url>` - URL of the eGemma workbench (default: <http://localhost:8000>)

```bash
# Run genesis on the 'src' directory of your project
cognition-cli genesis src/

# Specify custom project root and workbench URL
cognition-cli genesis src/ --project-root /path/to/project --workbench http://localhost:8001
```

---

## 2. Live System Commands (Event-Driven Coherence)

**Monument 1-3: The Reflexive Nervous System**

These commands implement the event-driven architecture from the CogX blueprint, allowing the PGC to detect changes and maintain coherence automatically. Together, they form a living feedback loop:

```
watch → dirty_state.json → status → update → coherence restored ♻️
```

### **`cognition-cli watch`**

Monitors your source files for changes in real-time and maintains a dirty state ledger. This is **Monument 1: Event Source** - the foundation for incremental updates and multi-agent coordination.

- **When to Use It:** Run this in a separate terminal during active development. It continuously watches your codebase and tracks which files have changed, enabling instant status checks without file scanning.
- **What It Does:**
  - Uses `chokidar` for cross-platform file watching
  - Computes file hashes to detect actual content changes (not just mtime)
  - Maintains `.open_cognition/dirty_state.json` with changed files
  - Emits real-time notifications when changes are detected
- **Options:**
  - `--untracked` - Also watch for new untracked files (default: false)
  - `--debounce <ms>` - Debounce delay in milliseconds (default: 300)
  - `--verbose` - Show detailed change events including file hashes

```bash
# Start watching in the current directory
cognition-cli watch

# Watch with verbose output showing hashes
cognition-cli watch --verbose

# Watch and also detect new untracked files
cognition-cli watch --untracked

# Adjust debounce for rapid file changes
cognition-cli watch --debounce 500
```

**Key Features:**
- **Hash-based detection** - Only detects real content changes, not timestamp updates
- **Debounced updates** - Handles rapid consecutive changes gracefully
- **Ignored patterns** - Automatically skips `node_modules`, `.git`, `dist`, `build`, etc.
- **Graceful shutdown** - Press `Ctrl+C` to stop cleanly

**The dirty_state.json format:**
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

### **`cognition-cli status`**

Instantly checks if your PGC is coherent by reading the dirty state. This is **Monument 2: Status** - your < 10ms reality check.

- **When to Use It:** Run before committing, after pulling changes, or anytime you want to know if the PGC matches your code. It's your instant coherence check without waiting for file scans.
- **What It Does:**
  - Reads `.open_cognition/dirty_state.json` (no file scanning!)
  - Calculates blast radius for each dirty file
  - Shows which symbols are affected by changes
  - Returns exit code for CI/CD automation
- **Options:**
  - `--json` - Output as JSON for scripting
  - `--verbose` - Show detailed symbol names affected
- **Exit Codes:**
  - `0` - 🔔 Coherent (PGC matches code)
  - `1` - 🎐 Incoherent (changes detected)

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

**Example outputs:**

When **coherent** 🔔:
```bash
$ cognition-cli status
🔔 PGC Status: COHERENT

The Echo rings clear - all tracked files resonate with the PGC.

Last checked: 2025-10-24T06:30:08.883Z
```

When **incoherent** 🎐:
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

**Why use status for commit optimization:**

Status tells you the **blast radius** of your changes. Use it to decide:
- **Small impact** (1-5 symbols) → Focused commit, ship it! ✅
- **Medium impact** (6-15 symbols) → Review for cohesion 🔍
- **Large impact** (15+ symbols) → Split commits or architectural review 🏗️

Smaller commits lead to faster `update` operations and reduce the chance of conflicts in multi-agent scenarios!

### **`cognition-cli update`**

Incrementally syncs the PGC with your code changes. This is **Monument 3: Update Function (U)** - the healing function that closes the loop.

- **When to Use It:** Run this after making changes to bring the PGC back into coherence. It only processes the files marked dirty by the watcher, making it much faster than re-running `genesis`.
- **What It Does:**
  - Reads `dirty_state.json` to find changed files
  - Re-extracts structural data for each dirty file
  - Updates `objects/`, `transforms/`, `index/`, and `reverse_deps/`
  - Runs Oracle verification to ensure consistency
  - Clears `dirty_state.json` on success
- **Options:**
  - `-p, --project-root <path>` - Root directory (default: current directory)
  - `-w, --workbench <url>` - eGemma workbench URL (default: http://localhost:8000)
- **Exit Codes:**
  - `0` - Update successful, PGC coherent
  - `1` - Update failed or verification error

```bash
# Update PGC with all dirty files
cognition-cli update

# Update with custom workbench
cognition-cli update --workbench http://localhost:8001

# Typical workflow
cognition-cli status    # See what changed
cognition-cli update    # Sync changes
cognition-cli status    # Verify coherence
```

**Performance characteristics:**
- **Incremental** - Only processes changed files, not entire codebase
- **Optimized** - Skips Oracle verification if no files were actually processed
- **Hash-based** - Detects when dirty_state has false positives (e.g., after `git checkout`)
- **Verifiable** - Every update recorded in transform log for auditability

**Example session:**
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

**The Update Function (U) implements the Invalidate algorithm from CogX:**
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

### **`cognition-cli guide [topic]`**

Shows colorful, candid guides for cognition-cli commands - the living documentation baked into the tool itself.

- **When to Use It:** Anytime you need a refresher on how a command works or want to understand the architecture behind it. The guides are more conversational and example-rich than standard help text.
- **What It Does:**
  - Renders markdown guides from `.claude/commands/` directory
  - Shows available guides if no topic specified
  - Includes real examples, architectural explanations, and pro tips
- **Available Guides:**
  - `watch` - File system monitoring and dirty state management
  - `status` - Instant coherence checks and commit optimization
  - `update` - Incremental PGC sync and the Update Function
  - More guides coming for other commands!

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
- 🎪 Pro tips for effective use

**Why guides are special:**

The guides **ship with the tool** and are version-controlled with the code. They're not just documentation - they're part of the system itself, explaining the living architecture from the inside!

### **The Complete Workflow**

These four commands form a complete feedback loop for maintaining PGC coherence:

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

This is the **operational implementation** of the event-driven architecture from CogX. The PGC now has a reflexive nervous system - it detects changes and heals automatically! 🧠

---

## 3. Analytical Commands (Exploring the Knowledge)

Once the PGC is populated, these commands allow you to explore, analyze, and gain insights from the structured knowledge.

### **`cognition-cli overlay generate <type> [sourcePath]`**

Generates specialized analytical layers, or "overlays," on top of the foundational PGC. These overlays enrich the knowledge graph with semantic and relational insights.

- **When to Use It:** After running `genesis`, use this command to build the higher-level understanding required for advanced queries. Generating the `structural_patterns` and `lineage_patterns` overlays is essential for enabling the powerful `patterns` commands.
- **Arguments:**
  - `<type>` - Type of overlay: `structural_patterns` or `lineage_patterns`
  - `[sourcePath]` - Optional source path to analyze (default: `.` - current directory)
- **Supported Types:**
  - `structural_patterns` - Extracts structural signatures and architectural roles
  - `lineage_patterns` - Builds dependency lineage graphs through time-traveling PGC archaeology
- **Options:**
  - `-p, --project-root <path>` - The root of the project (default: current directory)
  - `-f, --force` - Force regeneration of all patterns, even if they already exist
  - `--skip-gc` - Skip garbage collection (recommended when switching branches or regenerating after deletion)

```bash
# Generate structural patterns for current directory
cognition-cli overlay generate structural_patterns .

# Generate patterns for src/ directory (if using src/ structure)
cognition-cli overlay generate structural_patterns src

# Generate patterns for lib/ directory
cognition-cli overlay generate structural_patterns lib

# Generate the lineage patterns for dependency analysis
cognition-cli overlay generate lineage_patterns .

# Force regeneration of all patterns (useful after major code changes)
cognition-cli overlay generate structural_patterns . --force

# Skip GC when regenerating after branch switch or deletion
cognition-cli overlay generate lineage_patterns . --skip-gc
```

**Note on `--skip-gc`:** When you switch git branches or delete/regenerate overlays, the garbage collector may delete object hashes that overlays still reference. Use `--skip-gc` to prevent this until a more intelligent GC is implemented.

### **`cognition-cli patterns`** (and its subcommands)

A suite of powerful tools for querying the `structural_patterns` overlay, allowing you to reason about your code's architecture.

- **When to Use It:** Use these commands when you want to understand architectural roles, find structurally similar code, or compare the dependency profiles of different components. It's your primary tool for architectural discovery.

#### `patterns list`

Lists all symbols found in the structural patterns overlay, showing their architectural roles and locations.

**Options:**

- `--role <role>` - Filter by architectural role (e.g., 'component', 'service', 'type', 'utility')
- `--json` - Output raw JSON instead of formatted text

```bash
# List all structural patterns
cognition-cli patterns list

# List only components
cognition-cli patterns list --role component

# Get raw JSON output
cognition-cli patterns list --json
```

#### `patterns analyze`

Provides a high-level overview of the architectural roles (e.g., 'component', 'service', 'controller', 'utility', 'type') found in your codebase, showing distribution statistics.

**Options:**

- `--type <type>` - Type of patterns to analyze: 'structural' or 'lineage' (default: structural)
- `--verbose` - Show detailed breakdown including all symbols per role

```bash
# Analyze structural patterns
cognition-cli patterns analyze

# Analyze with verbose output
cognition-cli patterns analyze --verbose

# Analyze lineage patterns
cognition-cli patterns analyze --type lineage
```

#### `patterns inspect <symbol>`

Inspects a specific symbol, showing its location, architectural role, dependencies, consumers, and structural signature.

**Options:**

- `--json` - Output raw JSON instead of formatted text

```bash
# Inspect a symbol
cognition-cli patterns inspect PGCManager

# Get detailed JSON output
cognition-cli patterns inspect UserService --json
```

#### `patterns graph <symbol>`

Visualizes the dependency tree for a symbol, showing both upstream dependencies and downstream consumers.

**Options:**

- `--direction <dir>` - Graph direction: 'up' (dependencies), 'down' (consumers), or 'both' (default: both)
- `--max-depth <N>` - Maximum depth to traverse (default: 3)

```bash
# Show full dependency tree
cognition-cli patterns graph PGCManager

# Show only consumers (downstream)
cognition-cli patterns graph UserService --direction down

# Limit traversal depth
cognition-cli patterns graph OrderManager --max-depth 2
```

#### `patterns find-similar <symbol>`

Finds code that is architecturally similar to a given symbol based on vector embeddings of their structure.

**Options:**

- `-k, --top-k <number>` - Number of similar patterns to return (default: 10)
- `--type <type>` - Type of patterns to find: 'structural' or 'lineage' (default: structural)
- `--json` - Output raw JSON instead of formatted text

```bash
# Find 5 structurally similar symbols to UserManager
cognition-cli patterns find-similar UserManager --top-k 5

# Find similar lineage patterns
cognition-cli patterns find-similar UserService --type lineage

# Get raw JSON output
cognition-cli patterns find-similar OrderManager --json
```

#### `patterns compare <symbol1> <symbol2>`

Compares the structural signatures and dependencies of two symbols, showing their similarity score.

**Options:**

- `--type <type>` - Type of patterns to compare: 'structural' or 'lineage' (default: structural)

```bash
# Compare structural patterns
cognition-cli patterns compare UserManager OrderManager

# Compare lineage patterns
cognition-cli patterns compare UserService OrderService --type lineage
```

### **`cognition-cli blast-radius <symbol>`**

Analyzes the complete impact graph when a symbol changes, showing all affected components, critical paths, and architectural risks.

- **When to Use It:** Before making changes to a component, use this to understand the ripple effects. It's essential for impact analysis, refactoring planning, and identifying architectural coupling.
- **Options:**
  - `--max-depth <N>` - Maximum traversal depth (default: 3)
  - `--json` - Output raw JSON for programmatic use
  - `-p, --project-root <path>` - Root directory of the project (default: current directory)

```bash
# Analyze impact of changing PGCManager
cognition-cli blast-radius PGCManager

# Get JSON output for CI/CD integration
cognition-cli blast-radius UserService --json

# Limit depth for large dependency trees
cognition-cli blast-radius OrderManager --max-depth 2
```

**What it shows:**

- Total symbols impacted by changes
- Direct consumers and their roles
- Critical dependency paths
- Maximum consumer depth (blast radius)
- Risk assessment (low/medium/high/critical)

### **`cognition-cli query <question>`**

A direct and powerful tool for traversing the raw dependency graph of the PGC. Searches for symbols and traces their dependency lineage through the knowledge graph.

- **When to Use It:** When you need to trace the specific, hard-coded dependency chain for a given symbol, step-by-step. It's more granular than `patterns compare` and excellent for deep-dive debugging.
- **Options:**
  - `-p, --project-root <path>` - Root directory of the project being queried (default: current directory)
  - `-d, --depth <level>` - Depth of dependency traversal (default: 0)
  - `--lineage` - Output the dependency lineage in JSON format

```bash
# Search for 'handleRequest' symbol
cognition-cli query handleRequest

# Find the first-level dependencies of 'handleRequest'
cognition-cli query handleRequest --depth 1

# Trace dependencies up to 3 levels deep
cognition-cli query handleRequest --depth 3

# Output full dependency lineage as JSON
cognition-cli query handleRequest --lineage
```

---

## 3. Auditing Commands (Verifying the Truth)

These commands allow you to inspect the integrity and history of the PGC itself, reinforcing the system's core promise of verifiability.

### **`cognition-cli audit:transformations <filePath>`**

Audits the transformation history of a specific file, allowing you to see exactly how its knowledge was created and evolved in the PGC. Shows transformation IDs, methods, timestamps, and verification status.

- **When to Use It:** When you need to debug the system itself or want to have absolute, cryptographic proof of a file's provenance. It's the ultimate tool for answering the question, "How does the system know what it knows?"
- **Options:**
  - `-p, --project-root <path>` - Root directory of the project being audited (default: current directory)
  - `-l, --limit <number>` - Number of transformations to show (default: 5)

```bash
# Audit the last 5 transformations for a specific file
cognition-cli audit:transformations src/core/pgc/manager.ts

# Show the last 10 transformations
cognition-cli audit:transformations src/core/pgc/manager.ts --limit 10

# Audit a file in a different project
cognition-cli audit:transformations src/app.ts --project-root /path/to/project
```

---

## Recent Improvements & Known Issues

### Recent Bug Fixes (Latest Release)

1. **Lineage Symbol Resolution** - Fixed bug where lineage worker was picking wrong symbol in files with multiple exports (e.g., showing `parseNativeAST` instead of `GenesisJobResult`). The worker now correctly searches for the target symbol instead of taking the first symbol of any type.

2. **Garbage Collection Overlay-Awareness** - Fixed critical bug where GC was deleting object hashes still referenced by overlays when source files were removed. GC now checks all overlay manifests before deletion, preserving hashes needed by `structural_patterns` and `lineage_patterns`.

### Current Limitations

- **Garbage Collection:** The `--skip-gc` flag is a temporary workaround. Future versions will implement smarter GC that fully understands overlay dependencies.
- **Rate Limiting:** Embedding generation respects eGemma rate limits (5 embed calls per 10 seconds, 2 summarize calls per 60 seconds). Large codebases may take significant time to process.
- **Language Support:** Native parsing only supports TypeScript/JavaScript. Other languages require eGemma workbench running.

### Performance Tips

1. Use `--force` sparingly - it regenerates all patterns, which is expensive
2. When switching branches frequently, consider using `--skip-gc`
3. For large codebases, run overlay generation during off-hours
4. Monitor eGemma workbench logs for rate limit errors
