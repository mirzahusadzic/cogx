# 03 - Commands: Interacting with the Cognition CLI

The `cognition-cli` provides a powerful suite of commands for building, managing, and exploring your project's Grounded Context Pool (PGC). The commands are designed to be used in a logical workflow, moving from foundational setup to deep architectural analysis.

To see a list of all available commands, simply run `cognition-cli --help`.

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

### **`cognition-cli genesis`**

Populates the PGC by performing a deep structural analysis of your codebase. It discovers source files, parses them to extract structural data (classes, functions, imports), and stores the results in the PGC's content-addressable storage.

- **When to Use It:** This is the main "heavy-lifting" command. Run it after `init` to build the initial knowledge graph. You can re-run it later to update the PGC with new files and changes.

```bash
# Run genesis on the 'src' directory of your project
cognition-cli genesis src/
```

---

## 2. Analytical Commands (Exploring the Knowledge)

Once the PGC is populated, these commands allow you to explore, analyze, and gain insights from the structured knowledge.

### **`cognition-cli overlay generate`**

Generates specialized analytical layers, or "overlays," on top of the foundational PGC. These overlays enrich the knowledge graph with semantic and relational insights.

- **When to Use It:** After running `genesis`, use this command to build the higher-level understanding required for advanced queries. Generating the `structural_patterns` and `lineage_patterns` overlays is essential for enabling the powerful `patterns` commands.

```bash
# Generate the structural patterns required for similarity search
cognition-cli overlay generate structural_patterns

# (Future) Generate the lineage patterns for dependency analysis
cognition-cli overlay generate lineage_patterns
```

### **`cognition-cli patterns`** (and its subcommands)

A suite of powerful tools for querying the `structural_patterns` overlay, allowing you to reason about your code's architecture.

- **When to Use It:** Use these commands when you want to understand architectural roles, find structurally similar code, or compare the dependency profiles of different components. It's your primary tool for architectural discovery.

#### `patterns find-similar <symbol>`

Finds code that is architecturally similar to a given symbol based on vector embeddings of their structure.

````bash
cognition-cli patterns find-similar UserManager --top-k 5```

#### `patterns compare <symbol1> <symbol2>`
Compares the dependency lineages of two symbols, showing what they share and what is unique to each.
```bash
cognition-cli patterns compare UserManager OrderManager
````

#### `patterns analyze`

Provides a high-level overview of the architectural roles (e.g., 'component', 'service') found in your codebase.

```bash
cognition-cli patterns analyze
```

### **`cognition-cli query`**

A direct and powerful tool for traversing the raw dependency graph of the PGC.

- **When to Use It:** When you need to trace the specific, hard-coded dependency chain for a given symbol, step-by-step. It's more granular than `patterns compare` and excellent for deep-dive debugging.

```bash
# Find the first-level dependencies of 'handleRequest'
cognition-cli query handleRequest --depth 1

# Trace the full dependency lineage of 'handleRequest'
cognition-cli query handleRequest --lineage
```

---

## 3. Auditing Commands (Verifying the Truth)

These commands allow you to inspect the integrity and history of the PGC itself, reinforcing the system's core promise of verifiability.

### **`cognition-cli audit:transformations`**

Audits the transformation history of a specific file, allowing you to see exactly how its knowledge was created and evolved in the PGC.

- **When to Use It:** When you need to debug the system itself or want to have absolute, cryptographic proof of a file's provenance. It's the ultimate tool for answering the question, "How does the system know what it knows?"

```bash
# Audit the last 5 transformations for a specific file
cognition-cli audit:transformations src/core/pgc/manager.ts --limit 5
```
