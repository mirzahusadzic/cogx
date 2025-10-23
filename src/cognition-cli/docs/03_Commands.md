# 03 - Commands: Interacting with the Cognition CLI

The `cognition-cli` provides a powerful suite of commands for building, managing, and exploring your project's Grounded Context Pool (PGC). The commands are designed to be used in a logical workflow, moving from foundational setup to deep architectural analysis.

To see a list of all available commands, simply run `cognition-cli --help`.

## Quick Reference

```bash
# Setup
cognition-cli init                              # Initialize PGC
cognition-cli genesis src/                      # Build knowledge graph

# Overlays
cognition-cli overlay generate structural_patterns  # Generate structural overlay
cognition-cli overlay generate lineage_patterns     # Generate lineage overlay

# Pattern Analysis
cognition-cli patterns find-similar MyClass     # Find similar code
cognition-cli patterns compare Class1 Class2    # Compare two symbols
cognition-cli patterns analyze                  # Show architecture distribution

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

## 2. Analytical Commands (Exploring the Knowledge)

Once the PGC is populated, these commands allow you to explore, analyze, and gain insights from the structured knowledge.

### **`cognition-cli overlay generate <type>`**

Generates specialized analytical layers, or "overlays," on top of the foundational PGC. These overlays enrich the knowledge graph with semantic and relational insights.

- **When to Use It:** After running `genesis`, use this command to build the higher-level understanding required for advanced queries. Generating the `structural_patterns` and `lineage_patterns` overlays is essential for enabling the powerful `patterns` commands.
- **Supported Types:**
  - `structural_patterns` - Extracts structural signatures and architectural roles
  - `lineage_patterns` - Builds dependency lineage graphs through time-traveling PGC archaeology
- **Options:**
  - `-p, --project-root <path>` - The root of the project (default: current directory)
  - `-f, --force` - Force regeneration of all patterns, even if they already exist
  - `--skip-gc` - Skip garbage collection (recommended when switching branches or regenerating after deletion)

```bash
# Generate the structural patterns required for similarity search
cognition-cli overlay generate structural_patterns

# Generate the lineage patterns for dependency analysis
cognition-cli overlay generate lineage_patterns

# Force regeneration of all patterns (useful after major code changes)
cognition-cli overlay generate structural_patterns --force

# Skip GC when regenerating after branch switch or deletion
cognition-cli overlay generate lineage_patterns --skip-gc
```

**Note on `--skip-gc`:** When you switch git branches or delete/regenerate overlays, the garbage collector may delete object hashes that overlays still reference. Use `--skip-gc` to prevent this until a more intelligent GC is implemented.

### **`cognition-cli patterns`** (and its subcommands)

A suite of powerful tools for querying the `structural_patterns` overlay, allowing you to reason about your code's architecture.

- **When to Use It:** Use these commands when you want to understand architectural roles, find structurally similar code, or compare the dependency profiles of different components. It's your primary tool for architectural discovery.

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

#### `patterns analyze`

Provides a high-level overview of the architectural roles (e.g., 'component', 'service', 'controller', 'data_access') found in your codebase, showing distribution statistics.

**Options:**

- `--type <type>` - Type of patterns to analyze: 'structural' or 'lineage' (default: structural)

```bash
# Analyze structural patterns
cognition-cli patterns analyze

# Analyze lineage patterns
cognition-cli patterns analyze --type lineage
```

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
