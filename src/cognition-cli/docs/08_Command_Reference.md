# 08 - Command Reference: Quick Lookup

Complete alphabetical reference of all cognition-cli commands.

## Alphabetical Index

- [ask](#ask) - Ask AI questions about the manual
- [audit:docs](#audit-docs) - Audit document integrity
- [audit:transformations](#audit-transformations) - Audit file transformation history
- [blast-radius](#blast-radius) - Show impact graph for symbol changes
- [coherence](#coherence) - Strategic coherence analysis
- [concepts](#concepts) - Query mission concepts
- [genesis](#genesis) - Build verifiable skeleton
- [genesis:docs](#genesis-docs) - Ingest markdown documentation
- [guide](#guide) - Show command guides
- [init](#init) - Initialize PGC
- [lattice](#lattice) - Boolean algebra across overlays
- [overlay](#overlay) - Manage analytical overlays
- [patterns](#patterns) - Query structural patterns
- [proofs](#proofs) - Mathematical proofs analysis
- [query](#query) - Symbol lookup and dependency traversal
- [security](#security) - Security analysis
- [status](#status) - Check PGC coherence
- [tui](#tui) - Launch interactive TUI
- [update](#update) - Incremental PGC sync
- [watch](#watch) - Monitor file changes
- [wizard](#wizard) - Interactive setup wizard
- [workflow](#workflow) - Operational workflow analysis

---

## ask

Ask AI-synthesized questions about The Lattice Book manual.

```bash
cognition-cli ask "<question>" [options]
```

**Options:**

- `--top-k <number>` - Number of similar concepts to retrieve (default: 5)
- `--save` - Save Q&A as markdown document
- `--verbose` - Show detailed processing steps

**See:** [Interactive Mode](./06_Interactive_Mode.md#ai-powered-help-the-ask-command)

---

## audit-docs

Audit document integrity in PGC (index/docs validation).

```bash
cognition-cli audit:docs [options]
```

**See:** [Overlays & Analysis](./07_Overlays_And_Analysis.md#auditing-commands)

---

## audit-transformations

Audit transformation history of a specific file.

```bash
cognition-cli audit:transformations <filePath> [options]
```

**Options:**

- `-l, --limit <number>` - Number of transformations to show (default: 5)

**See:** [Overlays & Analysis](./07_Overlays_And_Analysis.md#auditing-commands)

---

## blast-radius

Analyze complete impact graph when a symbol changes.

```bash
cognition-cli blast-radius <symbol> [options]
```

**Options:**

- `--max-depth <N>` - Maximum traversal depth (default: 3)
- `--json` - Output raw JSON

**See:** [Overlays & Analysis](./07_Overlays_And_Analysis.md#blast-radius-analysis)

---

## coherence

Strategic coherence analysis commands.

### Subcommands

```bash
cognition-cli coherence report           # Overall metrics dashboard
cognition-cli coherence aligned          # Show aligned symbols
cognition-cli coherence drifted          # Show drifted symbols
cognition-cli coherence for-symbol <sym> # Symbol-specific alignment
cognition-cli coherence compare <s1> <s2> # Compare two symbols
```

**See:** [Overlays & Analysis](./07_Overlays_And_Analysis.md#o7-strategic-coherence-commands)

---

## concepts

Query mission concepts from strategic documentation.

```bash
cognition-cli concepts [subcommand] [options]
```

Use `concepts --help` for available subcommands.

**See:** [Overlays & Analysis](./07_Overlays_And_Analysis.md#o4-mission-concepts-commands)

---

## genesis

Build the verifiable skeleton of your codebase.

```bash
cognition-cli genesis [sourcePath] [options]
```

**Options:**

- `-w, --workbench <url>` - eGemma workbench URL (default: `http://localhost:8000`)

**See:** [Getting Started](./03_Getting_Started.md#2-build-the-knowledge-graph)

---

## genesis-docs

Ingest markdown documentation into PGC with full provenance.

```bash
cognition-cli genesis:docs [path] [options]
```

Defaults to `VISION.md` if no path specified.

**See:** [Getting Started](./03_Getting_Started.md#3-ingest-documentation-optional-but-recommended)

---

## guide

Show colorful, candid guides for cognition-cli commands.

```bash
cognition-cli guide [topic]
```

Available topics: watch, status, update

**See:** [Daily Workflow](./04_Daily_Workflow.md#getting-help)

---

## init

Initialize a new Grounded Context Pool (PGC).

```bash
cognition-cli init [options]
```

Creates `.open_cognition` directory structure.

**See:** [Getting Started](./03_Getting_Started.md#1-initialize-the-pgc)

---

## lattice

Execute Boolean algebra operations across overlays.

```bash
cognition-cli lattice "<query>" [options]
```

**Query Examples:**

- `"O1 AND O2"` - Intersection
- `"O1 - O2"` - Difference
- `"O1 ~ O4"` - Similarity
- `"O2[critical]"` - Filtered

**Options:**

- `-f, --format <format>` - Output format: table, json, summary (default: table)
- `-l, --limit <number>` - Maximum results (default: 50)

**See:** [Querying the Lattice](./05_Querying_The_Lattice.md#lattice-queries-the-core-power)

---

## overlay

Manage and generate analytical overlays.

```bash
cognition-cli overlay generate <type> [sourcePath] [options]
```

**Types:** structural_patterns, lineage_patterns, mission_concepts, strategic_coherence

**Options:**

- `-f, --force` - Force regeneration
- `--skip-gc` - Skip garbage collection

**See:** [Overlays & Analysis](./07_Overlays_And_Analysis.md#generating-overlays)

---

## patterns

Query structural patterns with multiple subcommands.

### Subcommands

```bash
cognition-cli patterns list [options]           # List all patterns
cognition-cli patterns analyze [options]         # Architectural distribution
cognition-cli patterns inspect <symbol>          # Symbol details
cognition-cli patterns graph <symbol>            # Dependency tree
cognition-cli patterns find-similar <symbol>     # Similarity search
cognition-cli patterns compare <s1> <s2>        # Compare two symbols
```

**See:** [Querying the Lattice](./05_Querying_The_Lattice.md#pattern-queries-architectural-analysis)

---

## proofs

Mathematical proofs and theorems analysis (O₆).

```bash
cognition-cli proofs [subcommand] [options]
```

Use `proofs --help` for subcommands.

**See:** [Overlays & Analysis](./07_Overlays_And_Analysis.md#o6-mathematical-proofs)

---

## query

Symbol lookup and dependency traversal.

```bash
cognition-cli query <symbol> [options]
```

**Options:**

- `-d, --depth <level>` - Traversal depth (default: 0)
- `--lineage` - Output lineage as JSON

**See:** [Querying the Lattice](./05_Querying_The_Lattice.md#basic-queries-symbol-lookup)

---

## security

Security analysis commands (O₂).

```bash
cognition-cli security [subcommand] [options]
```

Wraps lattice algebra for security-focused queries.

**See:** [Overlays & Analysis](./07_Overlays_And_Analysis.md#o2-security-analysis)

---

## status

Check PGC coherence state (< 10ms).

```bash
cognition-cli status [options]
```

**Options:**

- `--json` - JSON output
- `--verbose` - Show detailed symbol names

**Exit Codes:**

- 0 = Coherent
- 1 = Incoherent

**See:** [Daily Workflow](./04_Daily_Workflow.md#monument-2-the-reality-check-status)

---

## tui

Launch interactive Terminal User Interface with Claude.

```bash
cognition-cli tui [options]
```

**Options:**

- `--session-id <uuid>` - Attach to existing session
- `--session-tokens <number>` - Compression threshold (default: 120000)
- `--debug` - Enable Sigma compression logging

**See:** [Interactive Mode](./06_Interactive_Mode.md#the-tui-visual-pgc-exploration)

---

## update

Incremental PGC sync based on dirty_state.json.

```bash
cognition-cli update [options]
```

**Options:**

- `-w, --workbench <url>` - eGemma workbench URL

**See:** [Daily Workflow](./04_Daily_Workflow.md#monument-3-the-healing-function-update)

---

## watch

Monitor files for changes and maintain dirty state.

```bash
cognition-cli watch [options]
```

**Options:**

- `--untracked` - Watch for new untracked files
- `--debounce <ms>` - Debounce delay (default: 300)
- `--verbose` - Show detailed change events

**See:** [Daily Workflow](./04_Daily_Workflow.md#monument-1-the-sentinel-watch)

---

## wizard

Interactive wizard for complete PGC setup.

```bash
cognition-cli wizard [options]
```

Guides through: init → genesis → docs → overlays

**See:** [Getting Started](./03_Getting_Started.md#the-easy-path-using-the-wizard)

---

## workflow

Operational workflow analysis commands (O₅).

```bash
cognition-cli workflow [subcommand] [options]
```

Use `workflow --help` for subcommands.

**See:** [Overlays & Analysis](./07_Overlays_And_Analysis.md#o5-operational-workflows)

---

## Common Options

These options are available on most commands:

- `-p, --project-root <path>` - Root directory of the project
- `-h, --help` - Display help for command
- `--json` - Output as JSON (where applicable)
- `--verbose` - Verbose output

---

## Getting Help

For detailed help on any command:

```bash
cognition-cli <command> --help
cognition-cli guide <topic>
```

For comprehensive guides, see the documentation index.
