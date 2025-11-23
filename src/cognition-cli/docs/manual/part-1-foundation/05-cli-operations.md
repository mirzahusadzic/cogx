---
type: operational
overlay: O5_Operational
status: complete
---

# Chapter 5: CLI Operations — Building and Querying the Lattice

> **"Before you can query knowledge, you must construct the lattice."**

This chapter documents the core CLI commands that build, populate, and query the knowledge lattice. These operations transform source code into a queryable cognitive architecture.

---

## Table of Contents

### Core Setup & Initialization

1. [Command Lifecycle](#command-lifecycle)
2. [init — Initialize the PGC](#init--initialize-the-pgc)
3. [wizard — Interactive Setup](#wizard--interactive-setup)
4. [genesis — Build the Verifiable Skeleton](#genesis--build-the-verifiable-skeleton)
5. [genesis docs — Document Ingestion](#genesis-docs--document-ingestion)

### Query & Analysis

6. [query — Codebase Queries](#query--codebase-queries)
7. [ask — Semantic Q&A](#ask--semantic-qa)
8. [lattice — Boolean Algebra](#lattice--boolean-algebra)
9. [patterns — Pattern Detection](#patterns--pattern-detection)
10. [concepts — Mission Concepts](#concepts--mission-concepts)
11. [coherence — Consistency Validation](#coherence--consistency-validation)
12. [blast-radius — Impact Analysis](#blast-radius--impact-analysis)

### Maintenance & Monitoring

13. [watch — File Monitoring](#watch--file-monitoring)
14. [status — Coherence State](#status--coherence-state)
15. [update — Incremental Sync](#update--incremental-sync)
16. [migrate-to-lance — Database Migration](#migrate-to-lance--database-migration)

### Interactive & Tools

17. [tui — Interactive Terminal](#tui--interactive-terminal)
18. [guide — Contextual Help](#guide--contextual-help)
19. [overlay — Overlay Management](#overlay--overlay-management)

### Sugar Commands (Convenience Wrappers)

20. [security — Security Analysis](#security--security-analysis)
21. [workflow — Operational Patterns](#workflow--operational-patterns)
22. [proofs — Mathematical Proofs](#proofs--mathematical-proofs)

---

## Command Lifecycle

**O5-DEPENDENCIES: Command Workflow**

```
┌─────────────────────────────────────────────────────────────┐
│                    LATTICE CONSTRUCTION                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │    cognition-cli init  │
                  │  (Initialize PGC)      │
                  └────────────────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │  cognition-cli genesis │
                  │  (Build Skeleton)      │
                  └────────────────────────┘
                              │
                              ▼
        ┌────────────────────────────────────────────┐
        │      cognition-cli overlay generate        │
        │      (Semantic Enrichment)                 │
        │  [mission | security | lineage | ...]      │
        └────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LATTICE OPERATIONS                       │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
    ┌──────────┐      ┌────────────┐      ┌──────────────┐
    │   ask    │      │  patterns  │      │  coherence   │
    │ (Query)  │      │ (Analyze)  │      │  (Validate)  │
    └──────────┘      └────────────┘      └──────────────┘
          │                   │                   │
          └───────────────────┴───────────────────┘
                              │
                              ▼
                   ┌─────────────────┐
                   │  blast-radius   │
                   │ (Impact)        │
                   └─────────────────┘
```

**Key Principle**: You cannot query what doesn't exist. Genesis is the mandatory first step after initialization.

---

## init — Initialize the PGC

**Command**: `cognition-cli init`

**Purpose**: Creates the `.open_cognition/` directory structure (PGC) and initializes metadata.

**What It Does**:

- Creates PGC directory structure
- Initializes `metadata.json` with project configuration
- Sets up vector database (Lance)
- Configures overlay storage directories
- Establishes provenance tracking

**Output**:

```
.open_cognition/
├── metadata.json          # Project metadata
├── overlays/              # Overlay storage
│   ├── o1_structure/
│   ├── o2_security/
│   └── ...
├── patterns.lancedb/      # Vector embeddings
└── checkpoint.json        # Processing state
```

**When to Use**: Once per project, at the beginning.

**Prerequisites**: None

**Next Step**: Run `wizard` for interactive setup or `genesis` to populate the PGC.

---

## wizard — Interactive Setup

**Command**: `cognition-cli wizard`

**Purpose**: Interactive wizard for complete PGC setup from scratch. **Recommended for first-time users.**

**What It Does**:

This command guides you through the entire setup process:

1. **PGC Detection**: Checks for existing `.open_cognition/` directory
2. **Workbench Verification**: Validates eGemma workbench is running
3. **API Configuration**: Optionally configures API keys for embeddings
4. **Source Selection**: Prompts for source code directory
5. **Documentation Ingestion**: Ingests strategic documents (VISION.md, etc.)
6. **Overlay Generation**: Selectively generates overlays (O₁-O₇)

### Interactive Flow

```bash
$ cognition-cli wizard

🧙 Cognition CLI Setup Wizard
━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Detected existing PGC at .open_cognition/

? Do you want to:
  › Update existing PGC
    Create fresh PGC (will backup existing)

✓ Workbench running at http://localhost:8000

? Source code directory to analyze:
  › src/

? Ingest documentation? (Y/n) › Yes

? Which overlays to generate?
  ✓ O₁ Structure (required)
  ✓ O₂ Security
  ✓ O₃ Lineage
  ✓ O₄ Mission
  ✓ O₅ Operational
  ✓ O₆ Mathematical
  ✓ O₇ Coherence

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Starting setup...

[1/5] Initializing PGC...
✓ PGC initialized

[2/5] Running genesis on src/...
⠋ Processing files... [34/156]
✓ Genesis complete (156 files, 1,073 patterns)

[3/5] Ingesting documentation...
✓ Ingested 12 documents

[4/5] Generating overlays...
⠋ Generating O₂ Security overlay...
✓ All overlays generated

[5/5] Validating setup...
✓ Setup complete!

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next steps:
  cognition-cli status          # Check PGC coherence
  cognition-cli lattice "O1"    # Query structural patterns
  cognition-cli ask "..."       # Ask questions about docs
```

### Command Options

```bash
cognition-cli wizard [options]

# Options:
#   -p, --project-root <path>   Root directory (default: current directory)
```

### When to Use

- **First-time setup**: Initial PGC initialization
- **Onboarding new projects**: Quick setup for new codebases
- **Recovery**: Rebuilding corrupted PGC
- **Overlay regeneration**: Selectively regenerate specific overlays

### Advantages over Manual Setup

**Manual**:

```bash
cognition-cli init
cognition-cli genesis src/
cognition-cli genesis:docs VISION.md
cognition-cli overlay generate structural_patterns
cognition-cli overlay generate security_guidelines
# ... repeat for all 7 overlays
```

**Wizard** (interactive, handles all above):

```bash
cognition-cli wizard
```

### Troubleshooting

**Error: "No workbench detected"**

```bash
# Start eGemma workbench first:
docker compose up -d

# Or set custom URL:
export WORKBENCH_URL=http://your-workbench:8000
cognition-cli wizard
```

**Error: "Permission denied"**

```bash
# Ensure write permissions in project directory:
chmod -R u+w .
```

---

## genesis — Build the Verifiable Skeleton

**Command**: `cognition-cli genesis <path>`

**Purpose**: Extracts structural patterns (O₁) and builds the foundational knowledge representation.

### O4-MISSION: Why Genesis Exists

**Genesis is the foundational initialization process** that transforms source code into a queryable knowledge lattice. It creates the "verifiable skeleton" — a trustworthy, auditable representation of your codebase's architecture.

Without genesis, the knowledge lattice is empty. All downstream operations (ask, patterns, coherence, blast-radius) depend on genesis having run successfully.

### What Genesis Does

**O6-TEMPORAL: Phase I of Multi-Phase Architecture**

Genesis is **Phase I: Bottom-Up Structural Mining**

1. **Structural Extraction** (`StructuralMiner`)
   - Parses source files using AST analysis
   - Extracts functions, classes, interfaces, types
   - Captures import/export relationships
   - Records structural signatures

2. **Semantic Embedding** (`LineagePatternsManager`)
   - Generates 768-dimensional vectors for code elements
   - Embeds docstrings, purpose statements, function signatures
   - Creates "semantic shadows" for similarity search
   - Stores embeddings in Lance vector database

3. **Bottom-Up Aggregation** (`GenesisOrchestrator`)
   - Processes files incrementally with checkpointing
   - Builds dependency graphs
   - Populates O1 (Structure) overlay
   - Establishes foundation for overlay joins

4. **Verifiable Output**
   - Complete AST representation in overlays
   - Vector embeddings for semantic search
   - Provenance metadata for each extracted element
   - Checkpoint for incremental re-runs

### Command Options

```bash
cognition-cli genesis src/
```

**Parameters**:

- `<path>`: Path to source code directory to analyze (positional argument)
- `--workbench <url>`: eGemma workbench URL (default: `http://localhost:8000`)

**Note**: After genesis, generate overlays with `cognition-cli overlay generate <type>` or use `cognition-cli wizard` for interactive setup.

**Prerequisites**:

- PGC initialized via `cognition-cli init`
- eGemma workbench running (for embeddings)

### Technical Architecture

**Key Components** (from `src/commands/genesis.ts`):

```typescript
// Three-layer pipeline
StructuralMiner    // Layer 1: AST extraction
  ↓
LineagePatterns    // Layer 2: Semantic embedding
  ↓
VectorStore        // Layer 3: Similarity search index
```

**Processing Flow**:

1. **Validation**: Ensures PGC is initialized
2. **Connection**: Validates eGemma workbench availability
3. **Mining**: Extracts structural patterns from source files
4. **Embedding**: Generates semantic vectors
5. **Persistence**: Writes to overlays and vector DB
6. **Checkpointing**: Saves state for resumption

### Incremental Processing

Genesis supports **checkpoint-based resumption** via `GenesisOracle`:

```typescript
// Checkpoint structure
interface GenesisCheckpoint {
  processedFiles: string[];
  lastProcessedPath: string;
  timestamp: number;
  totalFiles: number;
}
```

**Benefits**:

- Resume after interruption
- Skip already-processed files
- Handle large codebases incrementally
- Verify processing completeness

### What Gets Created

**Overlays Populated**:

- **O1 (Structure)**: Complete structural representation
  - Functions, classes, interfaces, types
  - Import/export relationships
  - AST signatures

**Vector Database**:

- `patterns.lancedb/`: 768-dimensional embeddings
  - Semantic shadows (docstrings, purpose)
  - Structural bodies (signatures, types)
  - Similarity search index

**Output Size** (reference: cognition-cli, 32K LOC):

- Overlays: ~4.1MB
- Vector DB: ~36MB
- Total: ~40MB

### O7-CROSS-CUTTING: Architectural Principles

**Verifiable AI**
Genesis creates **auditable representations**. Every extracted element includes:

- Source file location
- Extraction method (AST vs regex)
- Fidelity score (confidence)
- Provenance timestamp

**Lattice Algebra**
Genesis populates the **base lattice**. All overlay operations (join, meet, union) require this foundation.

```
Query ∨ O1 ∨ O4 = Result
       ↑
   Genesis creates O1
```

**Incremental Processing**
Genesis implements **checkpoint-based resumption** for large codebases:

- Process 1000 files
- Crash or interrupt
- Resume from checkpoint
- No duplicate work

**Three-Layer Pipeline**
Genesis uses a **structured transformation pipeline**:

```
Source Code → [AST Parse] → Structural Data
           ↓
Structural Data → [Embedding] → Semantic Vectors
           ↓
Semantic Vectors → [Index] → Searchable Knowledge
```

### Example: Genesis Run

```bash
$ cognition-cli genesis src/

Genesis: Building the Verifiable Skeleton
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⠋ Validating PGC initialization...
✓ PGC validated

⠋ Initializing PGC and workbench connection...
✓ Connected to eGemma workbench

Phase I: Structural Mining (Bottom-Up)
⠋ Processing files... [1/156]
⠋ Extracting AST... [src/cli.ts]
⠋ Generating embeddings...
⠋ Writing to overlays...

✓ Genesis complete - Verifiable skeleton constructed

Summary:
  Files processed: 156
  Functions extracted: 847
  Classes extracted: 92
  Interfaces extracted: 134
  Embeddings generated: 1,073
  Time: 2m 34s
```

### When to Re-run Genesis

**Scenarios requiring re-run**:

1. **Significant code changes**
   - New files added
   - Major refactoring
   - Structural changes (new classes, functions)

2. **PGC corruption**
   - Manual deletion of overlay data
   - Vector database corruption

3. **Upgrade to new CLI version**
   - New extraction capabilities
   - Enhanced AST parsing

**Check status**:

```bash
cognition-cli status
# Output: PGC Status: stale (43 files changed since genesis)
```

**To refresh**: Use `cognition-cli update` for incremental changes, or re-run genesis for full rebuild.

### Troubleshooting

**Error: "PGC not initialized"**

```
Solution: Run `cognition-cli init` first
```

**Error: "eGemma workbench not running"**

```
Solution: Start workbench with `docker compose up -d`
Or set WORKBENCH_URL environment variable
```

**Error: "Out of memory during embedding"**

```
Solution: Process in batches or increase Node.js heap
NODE_OPTIONS=--max-old-space-size=8192 cognition-cli genesis src/
```

---

## genesis docs — Document Ingestion

**Command**: `cognition-cli genesis:docs [path]`

**Purpose**: Ingest markdown documentation into the PGC with full provenance tracking.

### What It Does

This command processes markdown files into the mission concepts overlay (O₄):

1. **Content Hashing**: Deduplicates documents using SHA256 hashes
2. **Frontmatter Parsing**: Extracts metadata from YAML frontmatter
3. **Embedding Generation**: Creates 768-dimensional semantic vectors
4. **Overlay Storage**: Stores in `.open_cognition/overlays/o4_mission/`
5. **Index Updates**: Maintains document index for integrity auditing

### Usage

```bash
# Ingest single file (defaults to VISION.md)
cognition-cli genesis:docs

# Ingest specific file
cognition-cli genesis:docs docs/ARCHITECTURE.md

# Ingest directory (recursive)
cognition-cli genesis:docs docs/

# Force re-ingestion (removes existing entries first)
cognition-cli genesis:docs docs/ --force
```

### Command Options

```bash
cognition-cli genesis:docs [path] [options]

# Options:
#   -p, --project-root <path>   Root directory (default: current directory)
#   -f, --force                 Force re-ingestion (removes existing entries)
```

### What Gets Created

**For each document**:

```yaml
# .open_cognition/overlays/o4_mission/concepts/vision-strategic-alignment.yaml
type: mission_concept
content: |
  # Strategic Alignment

  Our mission is to create verifiable AI-human symbiosis...
metadata:
  source: docs/VISION.md
  hash: a7f3b9c...
  ingested_at: '2025-11-15T10:30:45Z'
  weight: 0.85
embedding:
  vector: [0.123, -0.456, ...] # 768-dimensional
  model: egemma-v1
```

### Incremental Processing

The command automatically skips already-ingested documents:

```bash
$ cognition-cli genesis:docs docs/

⠋ Scanning for markdown files...
Found 15 files

⠋ Processing documents...
  ✓ docs/VISION.md (already ingested, skipping)
  ⠋ docs/SECURITY.md (ingesting...)
  ✓ docs/ARCHITECTURE.md (already ingested, skipping)

✓ Ingested 1 new document, skipped 14 existing
```

### Force Re-ingestion

Use `--force` to remove and re-ingest:

```bash
$ cognition-cli genesis:docs docs/ --force

⚠️  Force mode: removing existing entries...
Deleted 15 overlay entries
Deleted 15 LanceDB embeddings

⠋ Re-ingesting documents...
✓ Ingested 15 documents
```

### When to Use

- **Initial setup**: Ingest strategic documents (VISION, MISSION, etc.)
- **Documentation updates**: Re-ingest after major doc changes
- **Mission drift recovery**: Refresh mission concepts after refactoring

### Integration with Overlays

Documents ingested via `genesis:docs` populate:

- **O₄ (Mission)**: Strategic concepts, vision, principles
- **Ask command**: Enables semantic Q&A about documentation
- **Coherence**: Enables alignment scoring between code and mission

---

## query — Codebase Queries

**Command**: `cognition-cli query <question>`

**Purpose**: Query the codebase structure for information (functions, classes, dependencies).

### Difference from `ask`

- **query**: Structural/dependency queries (uses O₁, O₃)
- **ask**: Semantic Q&A about documentation (uses O₄, embeddings)

### Usage

```bash
# Find function definition
cognition-cli query "where is parseConfig defined"

# Find dependencies
cognition-cli query "what does UserService depend on" --lineage

# Find usage
cognition-cli query "where is SecurityValidator used"
```

### Command Options

```bash
cognition-cli query <question> [options]

# Options:
#   -p, --project-root <path>   Root directory (default: current directory)
#   -d, --depth <level>         Depth of dependency traversal (default: 0)
#   --lineage                   Output dependency lineage as JSON
```

### Example

```bash
$ cognition-cli query "what does MissionValidator depend on" --lineage

{
  "symbol": "MissionValidator",
  "filePath": "src/core/mission/validator.ts",
  "dependencies": [
    {
      "symbol": "WorkbenchClient",
      "filePath": "src/core/executors/workbench-client.ts",
      "type": "import"
    },
    {
      "symbol": "MissionConceptsManager",
      "filePath": "src/core/overlays/mission-concepts/manager.ts",
      "type": "import"
    }
  ]
}
```

---

## ask — Semantic Q&A

**Command**: `cognition-cli ask "<question>" [--verbose]`

**Purpose**: Query the knowledge lattice using semantic search across all overlays.

**Prerequisites**: Genesis must have run successfully.

### How It Works

**Four-Phase Query Pipeline**:

1. **Intent Deconstruction**
   - Classify query type (definition_lookup, implementation_details, architectural_overview, etc.)
   - Extract entities (concepts, function names, patterns)
   - Determine scope (conceptual, technical, architectural)
   - Refine query for semantic search

2. **Multi-Overlay Search**
   - Query vector database for semantic matches
   - Search across all populated overlays (O1-O7)
   - Compute cosine similarity scores
   - Rank results by relevance

3. **Answer Synthesis**
   - Pass top matches to LLM (via eGemma)
   - Generate coherent answer from multiple sources
   - Cite sources with similarity scores

4. **Source Attribution**
   - List top 5-10 matches
   - Show overlay provenance (which overlay provided each match)
   - Display similarity percentages

### Example Usage

```bash
$ cognition-cli ask "what is a genesis process" --verbose

🤔 Question: what is a genesis process

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [1/4] Deconstructing query intent...
      Intent: definition_lookup
      Entities: genesis process, purpose
      Scope: conceptual
      Refined: "definition and purpose of genesis process"

  [2/4] Searching across all overlays via lattice algebra...
      Found 5 relevant concepts across overlays
      1. [66.0%] [O4] src/commands/genesis.ts...
      2. [57.7%] [O1] Orchestrates the Genesis process...
      3. [57.2%] [O1] interface:GenesisOptions...

  [3/4] Synthesizing answer from concepts...

Answer:

The Genesis process is the foundational initialization process that builds
the "verifiable skeleton" by extracting structural patterns from source code.
It performs bottom-up aggregation to populate the knowledge lattice, creating
the foundation for all downstream queries.

Sources:
  1. [66.0% match] O4 — docs/manual/part-1-foundation/05-cli-operations.md
  2. [57.7% match] O1 — src/commands/genesis.ts (function:genesisCommand)
  3. [57.2% match] O1 — interface:GenesisOptions

⏱  Completed in 3.2 seconds
```

### Query Types

The system detects different query intents:

- **definition_lookup**: "What is X?"
- **implementation_details**: "How does X work?"
- **architectural_overview**: "How is X structured?"
- **usage_examples**: "How do I use X?"
- **debugging**: "Why is X failing?"
- **comparison**: "What's the difference between X and Y?"

### Overlay Coverage

Results show which overlays contributed:

```
Coverage by Overlay:
  O1 (Structure): 12 matches
  O4 (Mission): 3 matches
  O2 (Security): 1 match
  O5 (Operational): 2 matches
```

**Insight**: If results are weak or missing expected overlays:

- Run `cognition-cli overlay generate --overlay=<name>` to populate
- Check that genesis completed successfully
- Verify embeddings were generated

---

## lattice — Boolean Algebra

**Command**: `cognition-cli lattice <query>`

**Purpose**: Execute boolean algebra operations across overlays using lattice algebra. **This is the core query interface** for compositional analysis.

**Prerequisites**: At least one overlay must be generated.

### Why Lattice Algebra?

Traditional searches find individual items. Lattice algebra finds **relationships** between overlays:

- **Coverage gaps**: What code lacks security documentation?
- **Alignment**: Which security threats align with mission principles?
- **Projection**: Which operational patterns ensure security?

### Operators

#### Set Operations (Exact ID Matching)

```bash
+, |, OR       # Union (combine items from both overlays)
&, AND         # Intersection (items in both overlays)
-, \           # Difference (items in A but not B)
```

#### Semantic Operations (Embedding Similarity)

```bash
~, MEET        # Meet (find aligned items via embeddings)
->, TO         # Project (find B items similar to A items)
```

#### Filters

```bash
O2[type]                    # Filter by type field
O2[severity=critical]       # Filter by metadata value
O2[severity=critical,high]  # Multiple values (OR logic)
```

### Usage Examples

#### Coverage Gaps

Find code symbols without security documentation:

```bash
$ cognition-cli lattice "O1 - O2"

Code Symbols NOT Covered by Security:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function:processPayment (src/payments.ts)
  Risk: Payment processing without documented security constraints

function:handleUserInput (src/input.ts)
  Risk: Input handling without validation guidelines

class:AdminController (src/admin.ts)
  Risk: Admin functionality without access control docs

Total: 23 uncovered symbols
```

#### Security Alignment

Find attacks that align with mission principles (to prioritize defense):

```bash
$ cognition-cli lattice "O2[attack_vector] ~ O4[principle]"

Attack Vectors Aligned with Mission Principles:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

mission_drift_poisoning (87.3% aligned with "verifiable_alignment")
  Principle: Verifiable mission alignment
  Attack: Gradual mission drift via malicious context

prompt_injection (82.1% aligned with "transparency")
  Principle: Transparent AI behavior
  Attack: Hidden instructions in user input

Total: 12 high-alignment attacks
```

#### Operational Security

Find workflows that ensure security boundaries:

```bash
$ cognition-cli lattice "O5[workflow] -> O2[boundary]"

Workflows Projecting to Security Boundaries:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

workflow:pre_commit_validation → boundary:input_sanitization (0.91)
workflow:code_review_process → boundary:access_control (0.88)
workflow:deployment_checklist → boundary:data_encryption (0.85)

Total: 7 workflow-boundary projections
```

#### Complex Queries

Combine operators with parentheses:

```bash
# Critical security issues in mission-aligned code
cognition-cli lattice "(O2[severity=critical] ~ O4) & O1"

# Workflows that don't align with security OR mission
cognition-cli lattice "O5 - (O5 ~ O2 | O5 ~ O4)"

# Mathematical proofs about security-critical code
cognition-cli lattice "(O6[theorem] ~ O2) & (O1 - O3)"
```

### Command Options

```bash
cognition-cli lattice <query> [options]

# Options:
#   -p, --project-root <path>   Root directory (default: current directory)
#   -f, --format <format>       Output format: table, json, summary (default: table)
#   -l, --limit <number>        Maximum results to show (default: 50)
#   -v, --verbose               Show detailed error messages
```

### Output Formats

**Table** (default):

```bash
$ cognition-cli lattice "O1 - O2" --format table

Symbol                     | File                      | Risk Level
---------------------------|---------------------------|------------
processPayment             | src/payments.ts:45        | High
handleUserInput            | src/input.ts:12           | Medium
```

**JSON**:

```bash
$ cognition-cli lattice "O2 ~ O4" --format json

{
  "query": "O2 ~ O4",
  "results": [
    {
      "left_item": { "type": "attack_vector", "content": "..." },
      "right_item": { "type": "principle", "content": "..." },
      "similarity": 0.873
    }
  ]
}
```

**Summary**:

```bash
$ cognition-cli lattice "O1 - O2" --format summary

Query: O1 - O2
Results: 23 items
Coverage: 23/156 symbols (14.7%) lack security docs
Recommendation: Document high-risk symbols first
```

### Advanced: Meet Operation Deep-Dive

The Meet operation (`~`) is the most powerful:

```bash
# How it works:
# 1. Compute embeddings for all items in O2
# 2. Compute embeddings for all items in O4
# 3. Calculate cosine similarity between all pairs
# 4. Return pairs with similarity > 0.7 (default threshold)
# 5. Sort by descending similarity
```

**Why this matters**:

Traditional search finds exact matches. Meet finds **conceptual alignment**:

```
O2 item: "SQL injection via user input fields"
O4 item: "Transparency in data handling"

Meet score: 0.82  ← High alignment!
Insight: SQL injection violates transparency principle
```

### Troubleshooting

**Error: "No overlay O5 found"**

```bash
# Generate the missing overlay:
cognition-cli overlay generate operational_patterns
```

**Error: "Parse error: unexpected token"**

```bash
# Check query syntax:
# - Use quotes for queries with spaces: "O1 - O2"
# - Escape shell special characters
# - Valid operators: +, -, &, |, ~, ->
```

**Empty Results**

```bash
# Check overlay population:
cognition-cli overlay list

# Verify embeddings exist (for ~ and -> operators):
# LanceDB must be initialized for semantic operations
```

### Links to Deeper Dives

- **[Chapter 12: Boolean Operations](../part-3-algebra/12-boolean-operations.md)** — Formal algebra specification
- **[Chapter 13: Query Syntax](../part-3-algebra/13-query-syntax.md)** — Parser implementation
- **[Chapter 14: Set Operations](../part-3-algebra/14-set-operations.md)** — Symbol algebra

---

## patterns — Pattern Detection

**Command**: `cognition-cli patterns <subcommand>`

**Purpose**: Manage and query structural and lineage patterns in the codebase.

**Prerequisites**: Genesis must have run.

### Subcommands

#### find-similar

Find patterns similar to a given symbol using embedding similarity.

```bash
cognition-cli patterns find-similar <symbol> [options]

# Options:
#   -k, --top-k <number>   Number of similar patterns (default: 10)
#   --type <type>          Type: 'structural' or 'lineage' (default: structural)
#   --json                 Output raw JSON
```

**Example**:

```bash
$ cognition-cli patterns find-similar "SecurityValidator" --top-k 5

🔍 Structural patterns similar to SecurityValidator:

1. MissionValidator [validator]
   📁 src/core/mission/validator.ts
   ████████████████ 87.3%
   Validates mission alignment and drift detection

2. IntegrityValidator [validator]
   📁 src/core/security/integrity.ts
   ██████████████ 82.1%
   Validates data integrity and checksums

...
```

#### analyze

Analyze architectural patterns across the codebase, grouped by role.

```bash
cognition-cli patterns analyze [options]

# Options:
#   --type <type>    Type: 'structural' or 'lineage' (default: structural)
#   --verbose        Show detailed information including file paths
```

**Example**:

```bash
$ cognition-cli patterns analyze

📊 Architectural Pattern Distribution:

validator: 12 patterns
  - SecurityValidator, MissionValidator, IntegrityValidator...

service: 34 patterns
  - WorkbenchClient, PGCManager, OverlayManager...

util: 18 patterns
  - hashContent, formatTimestamp, parseFrontmatter...
```

#### list

List all patterns, optionally filtered by role.

```bash
cognition-cli patterns list [options]

# Options:
#   --role <role>    Filter by architectural role
#   --type <type>    Type: 'structural' or 'lineage' (default: structural)
#   --json           Output raw JSON
```

#### inspect

Deep-dive into a specific symbol with full details.

```bash
cognition-cli patterns inspect <symbol> [options]

# Options:
#   --type <type>    Type: 'structural' or 'lineage' (default: structural)
```

#### graph

Visualize dependency graph for a symbol.

```bash
cognition-cli patterns graph <symbol> [options]

# Options:
#   --max-depth <number>  Maximum depth to traverse
#   --json                Output as JSON instead of ASCII tree
```

#### compare

Compare similarity between two symbols.

```bash
cognition-cli patterns compare <symbol1> <symbol2>
```

---

## concepts — Mission Concepts

**Command**: `cognition-cli concepts <subcommand>`

**Purpose**: Query mission concepts from strategic documents ingested via `genesis:docs`.

**Prerequisites**: Run `genesis:docs` to ingest documentation first.

### Subcommands

#### list

List all mission concepts sorted by weight (importance).

```bash
cognition-cli concepts list [options]

# Options:
#   -p, --project-root <path>   Root directory
#   --json                      Output as JSON
#   --limit <number>            Number of results (default: all)
```

**Example**:

```bash
$ cognition-cli concepts list --limit 10

Mission Concepts (by weight):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Verifiable AI Alignment (weight: 0.92)
   Section: Vision
   Occurrences: 15

2. Cognitive Proof of Work (weight: 0.89)
   Section: Core Concepts
   Occurrences: 12

3. Lattice Knowledge Structure (weight: 0.87)
   Section: Architecture
   Occurrences: 18

...
```

#### top

Show top N concepts (default: 20).

```bash
cognition-cli concepts top [count]
```

#### search

Find concepts by keyword.

```bash
cognition-cli concepts search <keyword> [options]

# Options:
#   --json    Output as JSON
```

**Example**:

```bash
$ cognition-cli concepts search "security"

Concepts matching "security":
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Security Boundary Enforcement (weight: 0.84)
  "Enforce strict boundaries between overlays..."

Mission Drift Security (weight: 0.81)
  "Detect and prevent mission drift attacks..."

Total: 5 matches
```

#### by-section

Filter concepts by document section.

```bash
cognition-cli concepts by-section <section> [options]

# Common sections: Vision, Mission, Principles, Architecture, Security
```

#### inspect

Detailed information about a specific concept.

```bash
cognition-cli concepts inspect <text> [options]
```

**Example**:

```bash
$ cognition-cli concepts inspect "Verifiable AI"

Concept: Verifiable AI Alignment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Content:
  Our core mission is to create verifiable AI-human symbiosis
  through mathematically grounded cognitive architectures...

Metadata:
  Source: VISION.md
  Section: Strategic Intent
  Weight: 0.92
  Occurrences: 15

Embedding: ✓ Available (768-dimensional)

Related Concepts (by similarity):
  1. Cognitive Proof of Work (0.87)
  2. Mission Integrity (0.84)
  3. Transparent AI Behavior (0.82)
```

### Use Cases

**Mission Alignment Audit**:

```bash
# Find all mission concepts
cognition-cli concepts list

# Check if security principles are captured
cognition-cli concepts search "security"

# Find concepts in specific sections
cognition-cli concepts by-section "Principles"
```

**Integration with Coherence**:

Concepts from `concepts` command feed into coherence scoring:

```bash
# 1. Ingest mission documents
cognition-cli genesis:docs VISION.md

# 2. Query concepts
cognition-cli concepts top 20

# 3. Check code alignment
cognition-cli coherence aligned
```

---

## coherence — Consistency Validation

**Command**: `cognition-cli coherence`

**Purpose**: Validate consistency across overlays using meet (∧) operations.

**What It Checks**:

- O2 ∧ O4: Security constraints aligned with mission?
- O1 ∧ O3: Structure consistent with lineage?
- O5 ∧ O7: Operational patterns coherent across layers?

**Output**:

```
Coherence Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ O2 ∧ O4: 94% alignment (security supports mission)
⚠ O1 ∧ O3: 78% alignment (orphaned functions detected)
✓ O5 ∧ O7: 96% alignment (workflows consistent)

Issues Found: 3
  1. Function `processPayment` has no lineage tracking
  2. Security boundary `sanitizeInput` not documented in O2
  3. Operational pattern `retry-loop` missing from O5
```

---

## blast-radius — Impact Analysis

**Command**: `cognition-cli blast-radius <symbol>`

**Purpose**: Compute the impact radius of changing a function/class using lineage overlay (O3).

**Example**:

```bash
$ cognition-cli blast-radius "parseConfig"

Blast Radius Analysis: parseConfig
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Direct Dependents (Depth 1): 12 functions
  → initializeApp (src/app.ts:45)
  → loadSettings (src/config.ts:23)
  → validateEnvironment (src/env.ts:89)
  ...

Transitive Dependents (Depth 2): 47 functions
Transitive Dependents (Depth 3): 156 functions

Total Impact: 215 functions across 43 files

Risk Assessment: 🔴 HIGH
  - Core initialization function
  - Wide dependency graph
  - Recommend thorough testing
```

---

## watch — File Monitoring

**Command**: `cognition-cli watch`

**Purpose**: Monitor file changes and maintain PGC coherence state in real-time.

### What It Does

Watches source files for changes and maintains `dirty_state.json`:

1. **File Change Detection**: Monitors modifications, additions, deletions
2. **Hash Tracking**: Records SHA256 hashes for each file
3. **Dirty State**: Maintains list of changed files since last genesis/update
4. **Debouncing**: Groups rapid changes (default: 300ms)

### Usage

```bash
# Watch tracked files only
cognition-cli watch

# Also watch for new untracked files
cognition-cli watch --untracked

# Custom debounce delay
cognition-cli watch --debounce 1000

# Verbose output (show all events)
cognition-cli watch --verbose
```

### Command Options

```bash
cognition-cli watch [options]

# Options:
#   --untracked           Also watch for new untracked files
#   --debounce <ms>       Debounce delay in milliseconds (default: 300)
#   --verbose             Show detailed change events
```

### Example Output

```bash
$ cognition-cli watch --verbose

🔍 Watching for file changes...
Press Ctrl+C to stop

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[10:34:12] ✎ MODIFIED: src/core/mission/validator.ts
           Hash: a7f3b9c... → d4e8f2a...

[10:34:15] + ADDED: src/utils/helpers.ts
           Hash: b8c9d3e...

[10:34:20] - DELETED: src/deprecated/old-logic.ts

Dirty state updated: 3 files changed
```

### Integration with status and update

**Typical workflow**:

```bash
# Terminal 1: Watch for changes
cognition-cli watch

# Terminal 2: Make code changes...
vim src/core/mission/validator.ts

# Terminal 2: Check coherence
cognition-cli status
# Output: Incoherent (3 files modified)

# Terminal 2: Sync PGC
cognition-cli update

# Terminal 2: Verify
cognition-cli status
# Output: Coherent ✓
```

### Graceful Shutdown

Press `Ctrl+C` to stop watching. The tool handles `SIGINT` and `SIGTERM` gracefully.

---

## status — Coherence State

**Command**: `cognition-cli status`

**Purpose**: Check PGC coherence state (< 10ms!) by reading `dirty_state.json`.

### What It Checks

- **Modified files**: Files changed since last genesis/update
- **Untracked files**: New files not in PGC
- **Blast radius**: Impacted symbols (if `--verbose`)
- **Exit code**: 0 (coherent) or 1 (incoherent)

### Usage

```bash
# Quick check
cognition-cli status

# Detailed output with blast radius
cognition-cli status --verbose

# JSON output (for scripts/CI)
cognition-cli status --json
```

### Command Options

```bash
cognition-cli status [options]

# Options:
#   --json       Output as JSON
#   --verbose    Show detailed blast radius information
```

### Example Output

**Coherent**:

```bash
$ cognition-cli status

PGC Status: ✓ Coherent

No changes detected since last sync.
```

**Incoherent**:

```bash
$ cognition-cli status

PGC Status: ⚠️ Incoherent

Modified files: 3
  - src/core/mission/validator.ts
  - src/utils/helpers.ts
  - src/api/routes.ts

Untracked files: 1
  - src/new-feature.ts

Recommendation: Run `cognition-cli update` to restore coherence
```

**Verbose mode**:

```bash
$ cognition-cli status --verbose

PGC Status: ⚠️ Incoherent

Modified files: 3

Blast Radius Analysis:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/core/mission/validator.ts (23 symbols impacted)
  → MissionValidator class
  → validateAlignment function
  → 21 other symbols

src/utils/helpers.ts (8 symbols impacted)
  → hashContent function
  → formatTimestamp function
  → 6 other symbols

Total impacted: 31 symbols across 12 files
```

### CI/CD Integration

Use exit codes in scripts:

```bash
#!/bin/bash
# Check coherence before deploy

cognition-cli status
if [ $? -ne 0 ]; then
  echo "PGC is incoherent! Run update before deploying."
  exit 1
fi

echo "PGC coherent, proceeding with deploy..."
```

**JSON mode**:

```bash
$ cognition-cli status --json

{
  "coherent": false,
  "modified": ["src/core/mission/validator.ts", "src/utils/helpers.ts"],
  "untracked": ["src/new-feature.ts"],
  "impactedSymbols": 31
}
```

---

## update — Incremental Sync

**Command**: `cognition-cli update`

**Purpose**: Incrementally sync PGC with file changes (Monument 3 feature).

### What It Does

Reads `dirty_state.json` and updates only changed files:

1. **Read Dirty State**: Gets list of modified/added/deleted files
2. **Incremental Processing**: Re-processes only changed files
3. **Overlay Updates**: Updates affected overlays (O₁, O₃, O₇)
4. **Coherence Restoration**: Clears dirty state when complete

### Usage

```bash
# Update PGC based on dirty_state.json
cognition-cli update

# Specify custom project root
cognition-cli update --project-root /path/to/project

# Custom workbench URL
cognition-cli update --workbench http://localhost:9000
```

### Command Options

```bash
cognition-cli update [options]

# Options:
#   -p, --project-root <path>   Root directory (default: current directory)
#   -w, --workbench <url>       eGemma workbench URL
```

### Example

```bash
$ cognition-cli status
PGC Status: ⚠️ Incoherent (3 files modified)

$ cognition-cli update

Incremental PGC Update
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reading dirty state...
  Modified: 3 files
  Added: 1 file
  Deleted: 0 files

[1/4] Re-processing modified files...
⠋ src/core/mission/validator.ts
⠋ src/utils/helpers.ts
⠋ src/api/routes.ts
✓ Processed 3 files

[2/4] Updating overlays...
⠋ O₁ Structure
⠋ O₃ Lineage
✓ Overlays updated

[3/4] Regenerating coherence scores...
✓ O₇ Coherence updated

[4/4] Clearing dirty state...
✓ PGC coherent

Summary:
  Files processed: 4
  Symbols updated: 31
  Time: 12.3s (vs 2m 34s for full genesis)

$ cognition-cli status
PGC Status: ✓ Coherent
```

### vs. Full Genesis

| Command   | Use Case                      | Speed          | Coverage           |
| --------- | ----------------------------- | -------------- | ------------------ |
| `genesis` | Initial setup, major refactor | Slow (minutes) | Full codebase      |
| `update`  | Incremental changes           | Fast (seconds) | Changed files only |

**When to use update**:

- Daily development workflow
- After merging PRs
- Before commits (pre-commit hook)
- Continuous integration

**When to use genesis**:

- Initial PGC setup
- Major refactoring (100+ files changed)
- After upgrading CLI version
- PGC corruption recovery

---

## overlay — Overlay Management

**Command**: `cognition-cli overlay <subcommand>`

**Subcommands**:

### generate

```bash
cognition-cli overlay generate --overlay=<name>
```

**Purpose**: Generate semantic overlays using LLM analysis (Phase II).

**Available Overlays**:

- `mission` (O4): Strategic alignment, vision, goals
- `security` (O2): Threat models, attack vectors
- `lineage` (O3): Dependency graphs, call chains
- `operational` (O5): Workflow patterns, quest structures
- `mathematical` (O6): Formal properties, theorems
- `coherence` (O7): Cross-layer synthesis

**What It Does**:

- Reads structural data from O1 (created by genesis)
- Sends to eGemma for LLM analysis
- Extracts overlay-specific knowledge
- Generates semantic embeddings
- Stores in overlay directory

**Example**:

```bash
$ cognition-cli overlay generate --overlay=mission

Generating O4 (Mission) Overlay
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⠋ Analyzing strategic alignment...
⠋ Extracting vision statements...
⠋ Identifying key concepts...
⠋ Generating embeddings...

✓ Mission overlay generated

Summary:
  Concepts extracted: 47
  Vision statements: 12
  Strategic goals: 8
  Embeddings: 67
```

### list

```bash
cognition-cli overlay list
```

**Output**:

```
Populated Overlays:
  ✓ O1 (Structure)      - 1,073 items, 36MB
  ✓ O2 (Security)       - 234 items, 8MB
  ✗ O3 (Lineage)        - Not generated
  ✓ O4 (Mission)        - 67 items, 2MB
  ✗ O5 (Operational)    - Not generated
  ✗ O6 (Mathematical)   - Not generated
  ✗ O7 (Coherence)      - Not generated
```

### status

```bash
cognition-cli overlay status --overlay=mission
```

**Output**:

```
O4 (Mission) Status:
  Items: 67
  Last updated: 2025-10-31 19:34:22
  Fidelity: 0.94
  Coverage: 78% of codebase
```

---

## migrate-to-lance — Database Migration

**Command**: `cognition-cli migrate-to-lance`

**Purpose**: Migrate YAML overlay embeddings to LanceDB for fast semantic queries.

### Why Migrate?

**Before migration**: Embeddings stored in YAML files (large, slow queries)
**After migration**: Embeddings in LanceDB (fast vector search) + slim YAML (metadata only)

**Benefits**:

- **10-100x faster** semantic queries
- **50-70% disk space savings** (embeddings removed from YAML)
- **Scalability**: Handle 100K+ vectors efficiently

### Usage

```bash
# Migrate all overlays (recommended)
cognition-cli migrate-to-lance

# Dry run (preview changes)
cognition-cli migrate-to-lance --dry-run

# Migrate specific overlays
cognition-cli migrate-to-lance --overlays mission_concepts,security_guidelines

# Keep embeddings in YAML (not recommended, for backup)
cognition-cli migrate-to-lance --keep-embeddings
```

### Command Options

```bash
cognition-cli migrate-to-lance [options]

# Options:
#   -p, --project-root <path>         Root directory
#   --overlays <overlays>             Comma-separated overlay list
#   --dry-run                         Preview without making changes
#   --keep-embeddings                 Keep embeddings in YAML (not recommended)
```

### What Gets Migrated

1. **Overlay embeddings**: mission_concepts, security_guidelines, operational_patterns, mathematical_proofs
2. **Mission integrity versions**: Full version history
3. **Sigma lattice files**: Conversation overlays (O1-O7)

### Example

```bash
$ cognition-cli migrate-to-lance

LanceDB Migration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/5] Migrating mission_concepts...
  ✓ Migrated 67 embeddings to LanceDB
  ✓ Created YAML v2 format (embeddings stripped)
  Disk savings: 8.2 MB → 1.3 MB (84% reduction)

[2/5] Migrating security_guidelines...
  ✓ Migrated 234 embeddings
  Disk savings: 32.1 MB → 4.7 MB (85% reduction)

[3/5] Migrating operational_patterns...
  ✓ Migrated 156 embeddings
  Disk savings: 21.4 MB → 3.2 MB (85% reduction)

[4/5] Migrating mathematical_proofs...
  ✓ Migrated 89 embeddings
  Disk savings: 12.3 MB → 1.8 MB (85% reduction)

[5/5] Compacting LanceDB...
  ✓ Removed 47 orphaned vectors
  ✓ Compacted database

Summary:
  Total embeddings migrated: 546
  Disk space saved: 60.8 MB (85% reduction)
  LanceDB size: 42.3 MB

Migration complete! Semantic queries now use LanceDB.
```

### Rollback

If migration causes issues, restore from backup:

```bash
# Backups created at:
.open_cognition/overlays/o4_mission/concepts.backup/
```

---

## tui — Interactive Terminal

**Command**: `cognition-cli tui`

**Purpose**: Launch interactive terminal UI with LLM integration (Claude or Gemini) for conversational analysis.

### What It Provides

- **Multi-Provider Support**: Choose between Claude (Anthropic) or Gemini (Google) LLM providers
- **Interactive Chat**: Converse with AI about your codebase with tool execution
- **Lattice Visualization**: Real-time overlay counts and statistics (O1-O7)
- **Session Persistence**: Resume previous conversations with full context
- **Σ (Sigma) Integration**: Infinite context via dual-lattice compression
- **Extended Thinking**: Configurable thinking tokens for complex reasoning
- **Tool Execution**: File operations, code analysis, and more with confirmation dialogs

### Usage

```bash
# Start new session with default provider (Gemini)
cognition-cli tui

# Start with Claude provider (using API key)
ANTHROPIC_API_KEY=sk-ant-... cognition-cli tui --provider claude

# Start with Claude provider (using OAuth)
cognition-cli tui --provider claude

# Start with specific model
cognition-cli tui --provider claude --model claude-sonnet-4-5

# Resume existing session
cognition-cli tui --session-id <anchor-id>

# Resume from state file
cognition-cli tui --file .sigma/tui-1762546919034.state.json

# Extended thinking mode (complex reasoning)
cognition-cli tui --max-thinking-tokens 20000

# Hide thinking blocks
cognition-cli tui --no-show-thinking

# Debug mode (show compression details)
cognition-cli tui --debug
```

### Command Options

```bash
cognition-cli tui [options]

# Options:
#   -p, --project-root <path>           Root directory
#   --session-id <anchor-id>            Resume session by ID
#   -f, --file <path>                   Resume from .sigma state file
#   -w, --workbench <url>               eGemma workbench URL
#   --session-tokens <number>           Compression threshold (default: 120000)
#   --max-thinking-tokens <number>      Extended thinking limit (default: 10000)
#   --provider <name>                   LLM provider: claude or gemini (default: gemini)
#   --model <name>                      Model to use (provider-specific)
#   --debug                             Enable debug logging
#   --no-show-thinking                  Hide thinking blocks in TUI
```

### Example Session

```bash
$ cognition-cli tui

╔══════════════════════════════════════════════════════════════╗
║  Cognition Σ (Sigma) - Interactive TUI                       ║
║  Dual-Lattice Architecture with Infinite Context             ║
╚══════════════════════════════════════════════════════════════╝

Lattice Status:
  O₁ Structure: 1,073 items
  O₂ Security: 234 items
  O₃ Lineage: 847 items
  O₄ Mission: 67 items
  O₅ Operational: 156 items
  O₆ Mathematical: 89 items
  O₇ Coherence: 1,073 scores

Session: tui-1762546919034
Tokens: 0 / 120,000

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You: Explain the coherence calculation

Claude: The coherence calculation uses a dual-lattice architecture...
[Extended response with source citations from O₇ overlay]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You: /quit

Session saved to .sigma/tui-1762546919034.state.json
Resume with: cognition-cli tui --file .sigma/tui-1762546919034.state.json
```

### Features

**Session Management**:

- Automatic checkpointing every 5 turns
- Resume from any previous session
- Compression at 150K tokens (importance-based)
- Session forwarding for continuity

**Lattice Visualization**:

- Live overlay statistics
- Token usage tracking
- Coherence metrics

**Commands** (within TUI):

- `/quit` - Exit and save session
- `/status` - Show lattice status
- `/clear` - Clear screen

### Provider Management

The TUI supports multiple LLM providers with dedicated management commands:

```bash
# List available providers
cognition-cli tui provider list

# Set default provider
cognition-cli tui provider set-default claude
cognition-cli tui provider set-default gemini

# Test provider availability
cognition-cli tui provider test claude
cognition-cli tui provider test gemini

# Show current configuration
cognition-cli tui provider config

# List available models
cognition-cli tui provider models
cognition-cli tui provider models claude
cognition-cli tui provider models gemini
```

**Supported Providers:**

- **Claude (Anthropic)**: Authentication via API key or OAuth
  - Auth methods: `ANTHROPIC_API_KEY` environment variable OR OAuth (Claude Agent SDK)
  - Models: claude-sonnet-4-5, claude-3-5-sonnet, claude-opus-4, claude-3-7-sonnet
  - Features: Extended thinking blocks, tool execution, streaming responses

- **Gemini (Google)**: Requires `GEMINI_API_KEY` environment variable
  - Models: gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash
  - Features: BIDI streaming, continuous multi-turn conversations, tool execution

**Provider Configuration:**

The default provider can be set via:

1. Command flag: `--provider claude`
2. Provider command: `tui provider set-default claude`
3. Interactive selection during TUI startup (if both configured)

---

## guide — Contextual Help

**Command**: `cognition-cli guide [topic]`

**Purpose**: Show colorful, contextual guides for CLI commands and workflows.

### Available Guides

```bash
cognition-cli guide                    # Show guide index
cognition-cli guide watch              # File monitoring workflow
cognition-cli guide status             # PGC coherence checking
cognition-cli guide explore-architecture  # Codebase exploration
cognition-cli guide analyze-symbol        # Symbol deep-dive
cognition-cli guide trace-dependency      # Dependency chains
cognition-cli guide analyze-impact        # Blast radius analysis
```

### Example

```bash
$ cognition-cli guide watch

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Guide: File Change Monitoring
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The watch command keeps your PGC in sync with file changes.

Usage:

  cognition-cli watch [--untracked] [--verbose]

What it does:

  1. Monitors source files for changes
  2. Updates dirty_state.json automatically
  3. Records file hashes for change detection

Integration:

  # Terminal 1: Watch for changes
  cognition-cli watch

  # Terminal 2: Check coherence
  cognition-cli status

  # Terminal 2: Sync PGC
  cognition-cli update

Pro tip: Run watch in tmux/screen for persistent monitoring!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next: cognition-cli guide status
```

### Custom Guides

Create project-specific guides in `.claude/commands/guide-*.md`.

---

## security — Security Analysis

**Command**: `cognition-cli security <subcommand>`

**Purpose**: Convenience commands for security analysis (wraps lattice algebra).

### Subcommands

```bash
cognition-cli security attacks           # O2[attack_vector] ~ O4[principle]
cognition-cli security coverage-gaps      # O1 - O2
cognition-cli security boundaries         # O2[boundary] | O2[constraint]
cognition-cli security list [--type]      # Direct O2 overlay listing
cognition-cli security cves               # List tracked CVEs
cognition-cli security query <term>       # Search security knowledge
```

### Examples

**Find attack vectors aligned with mission principles**:

```bash
$ cognition-cli security attacks

Attack Vectors vs Mission Principles:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

mission_drift_poisoning (87.3% aligned with "verifiable_alignment")
  Attack: Gradual mission drift via malicious context
  Defense Priority: CRITICAL

prompt_injection (82.1% aligned with "transparency")
  Attack: Hidden instructions in user input
  Defense Priority: HIGH

Total: 12 attack vectors analyzed
```

**Find security coverage gaps**:

```bash
$ cognition-cli security coverage-gaps

Code Symbols Without Security Documentation:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function:processPayment (src/payments.ts:45)
  Risk: HIGH - Payment processing undocumented

function:handleAdminAction (src/admin.ts:78)
  Risk: CRITICAL - Admin functionality undocumented

Total: 23 uncovered symbols
Recommendation: Document high-risk symbols first
```

---

## workflow — Operational Patterns

**Command**: `cognition-cli workflow <subcommand>`

**Purpose**: Query operational patterns and quest structures.

### Subcommands

```bash
cognition-cli workflow patterns [--secure] [--aligned]
cognition-cli workflow quests
cognition-cli workflow depth-rules
```

### Examples

```bash
$ cognition-cli workflow patterns --secure

Workflow Patterns Aligned with Security:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

pre_commit_validation (0.91 alignment)
  Ensures security checks before commits

code_review_process (0.88 alignment)
  Enforces security review gates

deployment_checklist (0.85 alignment)
  Validates security boundaries

Total: 7 secure workflow patterns
```

---

## proofs — Mathematical Proofs

**Command**: `cognition-cli proofs <subcommand>`

**Purpose**: Query mathematical proofs and theorems from O₆ overlay.

### Subcommands

```bash
cognition-cli proofs theorems
cognition-cli proofs lemmas
cognition-cli proofs list [--type <type>]
cognition-cli proofs aligned    # Proofs aligned with mission
```

### Examples

```bash
$ cognition-cli proofs theorems

Mathematical Theorems:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lattice Completeness Theorem
  Statement: Every overlay operation has a unique result
  Proof: See O6_Mathematical/theorems/lattice-completeness.yaml

Coherence Convergence Theorem
  Statement: Coherence scores converge with more embeddings
  Proof: See O6_Mathematical/theorems/coherence-convergence.yaml

Total: 12 theorems
```

---

## Command Dependencies

**Visual Summary**:

```
init
 └─> genesis (required before all others)
      ├─> ask (queries genesis output)
      ├─> patterns (analyzes genesis output)
      ├─> coherence (validates genesis output)
      ├─> blast-radius (uses genesis output)
      └─> overlay generate (enriches genesis output)
           └─> ask (queries enriched overlays)
```

---

## Performance Considerations

**Genesis Runtime** (estimates):

| Codebase Size | Files | Functions | Runtime | Storage |
| ------------- | ----- | --------- | ------- | ------- |
| Small         | 50    | 200       | 30s     | 5MB     |
| Medium        | 500   | 2,000     | 5m      | 50MB    |
| Large         | 5,000 | 20,000    | 50m     | 500MB   |

**Optimization Tips**:

1. **Use checkpointing**: Genesis auto-resumes after interruption
2. **Increase heap**: For large codebases, set `NODE_OPTIONS=--max-old-space-size=8192`
3. **Selective source**: Only run genesis on relevant directories (`--source src/app/`)
4. **Parallel overlay generation**: Generate overlays in parallel after genesis

---

## Next Steps

After understanding CLI operations, you're ready to dive into:

1. **[Chapter 12: Boolean Operations](../part-3-algebra/12-boolean-operations.md)** — Learn query algebra for compositional queries
2. **[Chapter 8: O₄ Mission](../part-2-seven-layers/08-o4-mission.md)** — Understand how mission overlay works
3. **[Chapter 5: O₁ Structure](../part-2-seven-layers/05-o1-structure.md)** — Deep dive into structural extraction

---

**Key Takeaway**: The CLI is not just a tool interface — it's the **construction and query interface for the knowledge lattice**. Each command is a lattice operation: genesis builds the foundation, overlay generate enriches dimensions, and ask/patterns/coherence compute joins across those dimensions.
