# 03 - Getting Started: Your First PGC

This guide walks you through setting up your first Grounded Context Pool (PGC) and running your first queries. We'll start with the easiest path: the interactive wizard.

## Prerequisites

Before you begin, ensure you have the **eGemma workbench** running. The workbench provides AI-powered embedding and analysis services.

### Setting Up eGemma

1. **Clone the repository:**

   ```bash
   git clone https://github.com/mirzahusadzic/egemma
   cd egemma
   ```

2. **Start the workbench:**

   ```bash
   # Follow setup instructions in the eGemma repository
   # Typically runs on http://localhost:8000
   ```

3. **Verify it's running:**

   ```bash
   curl http://localhost:8000/health
   # Should return: {"status":"healthy"}
   ```

**Default configuration:**

- URL: `http://localhost:8000`
- API Key: `dummy-key` (for local development)

---

## The Easy Path: Using the Wizard

The `wizard` command provides an interactive, guided setup experience. It's the recommended way to get started.

### **`cognition-cli wizard`**

The wizard detects your environment, validates connectivity, and walks you through complete PGC setup.

```bash
# Run in your project directory
cognition-cli wizard

# Or specify a different project root
cognition-cli wizard --project-root /path/to/project
```

### What the Wizard Does

1. **Environment Check** - Detects existing PGC and confirms continuation
2. **Workbench Discovery** - Auto-detects workbench on common ports (8000, 8080, etc.)
3. **Connection Validation** - Verifies workbench is accessible before proceeding
4. **Source Path Selection** - Prompts for the directory to analyze (validates existence)
5. **Documentation Detection** - Finds VISION.md or asks about strategic docs
6. **Overlay Selection** - Choose which analytical overlays to generate
7. **Confirmation** - Shows summary before execution
8. **Execution** - Runs init → genesis → overlays with progress indicators

### Example Session

```bash
$ cognition-cli wizard

🧙 PGC Setup Wizard

This wizard will guide you through setting up a complete Grounded Context Pool (PGC).

⚡ The symmetric machine provides perfect traversal.
🎨 The asymmetric human provides creative projection.
🤝 This is the symbiosis.

◆  Detecting workbench instance...
│  ✓ Found workbench at http://localhost:8000
│
◇  Workbench URL:
│  http://localhost:8000
│
◆  Verifying workbench connection...
│  ✓ Workbench connection verified
│
◇  Workbench API Key:
│  dummy-key
│
◇  Source path to analyze:
│  src
│
◇  Found VISION.md. Ingest documentation?
│  Yes
│
◇  Which overlays would you like to generate?
│  All overlays (recommended)
│
Setup Summary:
  Project Root: /Users/you/project
  Workbench URL: http://localhost:8000
  Source Path: src
  Documentation: ../../VISION.md
  Overlays: all

◇  Proceed with setup?
│  Yes

🚀 Starting PGC construction...

[1/4] Initializing PGC...
✓ PGC initialized

[2/4] Running genesis (building verifiable skeleton)...
✓ Genesis complete

[3/4] Ingesting documentation...
✓ Documentation ingested

[4/4] Generating overlays...
✓ structural_patterns generated
✓ lineage_patterns generated
✓ mission_concepts generated
✓ strategic_coherence generated

✨ PGC setup complete! Your Grounded Context Pool is ready to use.

Next steps:
  • Run queries: cognition-cli query MySymbol
  • Watch for changes: cognition-cli watch
  • Check status: cognition-cli status
  • View guides: cognition-cli guide
```

---

## The Manual Path: Step-by-Step

If you prefer manual control, here's the sequence:

### 1. Initialize the PGC

```bash
cognition-cli init
```

Creates the `.open_cognition` directory with all necessary subdirectories:

- `objects/` - Content-addressable storage
- `transforms/` - Immutable operation log
- `index/` - File path to hash mappings
- `reverse_deps/` - Dependency lookup index
- `overlays/` - Analytical overlay storage

### 2. Build the Knowledge Graph

```bash
# Analyze your source code
cognition-cli genesis src/

# With custom workbench URL
cognition-cli genesis src/ --workbench http://localhost:8001
```

This performs deep structural analysis:

- Discovers all source files
- Parses with AST (TypeScript/JavaScript) or AI (other languages)
- Extracts classes, functions, imports, exports
- Stores everything with cryptographic provenance
- Builds dependency graph

**What you get:**

- Every file's structural fingerprint
- Complete dependency map
- Immutable audit trail
- Content-addressable storage

### 3. Ingest Documentation (Optional but Recommended)

```bash
# Ingest VISION.md (default)
cognition-cli genesis:docs

# Or specify a custom document
cognition-cli genesis:docs /path/to/ARCHITECTURE.md
```

This ingests strategic documentation so you can:

- Extract mission concepts
- Measure code-to-mission alignment
- Generate strategic coherence overlays

### 4. Generate Overlays

Overlays add analytical dimensions to your code graph:

```bash
# Generate structural patterns (architectural roles)
cognition-cli overlay generate structural_patterns .

# Generate lineage patterns (dependency provenance)
cognition-cli overlay generate lineage_patterns .

# Generate mission concepts (requires docs ingestion)
cognition-cli overlay generate mission_concepts .

# Generate strategic coherence (measures alignment)
cognition-cli overlay generate strategic_coherence .
```

**Pro tip:** Use `--force` to regenerate all patterns after major refactoring.

---

## Your First Query

Once your PGC is built, try these queries:

### Basic Symbol Search

```bash
# Find a symbol
cognition-cli query UserManager

# Trace its dependencies (1 level deep)
cognition-cli query UserManager --depth 1

# Get full lineage as JSON
cognition-cli query UserManager --lineage
```

### Pattern Analysis

```bash
# List all structural patterns
cognition-cli patterns list

# Find architecturally similar code
cognition-cli patterns find-similar UserManager

# Inspect a specific symbol
cognition-cli patterns inspect AuthService
```

### Check PGC Status

```bash
# Is the PGC in sync with code?
cognition-cli status
```

---

## What's Next?

Now that your PGC is initialized, explore:

- **[Daily Workflow](../guides/daily-workflow.md)** - Learn the watch → status → update cycle
- **[Querying the Lattice](../guides/querying-the-lattice.md)** - Master lattice algebra queries
- **[Interactive Mode](../guides/interactive-mode.md)** - Use the TUI with Claude integration
- **[Architecture Overview](../architecture/README.md)** - Deep-dive on all systems

## Common Issues

### Workbench Not Running

```bash
Error: connect ECONNREFUSED 127.0.0.1:8000
```

**Solution:** Start the eGemma workbench first (see Prerequisites above).

### Permission Errors

```bash
Error: EACCES: permission denied, mkdir '.open_cognition'
```

**Solution:** Run in a directory where you have write permissions, or use `--project-root` to specify a different location.

### Large Codebase Timeouts

For codebases with 1000+ files, genesis may take 20-60 minutes due to embedding generation and rate limits.

**Solution:** Run during off-hours, or use `watch` + `update` for incremental processing after initial setup.
