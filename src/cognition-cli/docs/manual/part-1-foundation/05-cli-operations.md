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

1. [Command Lifecycle](#command-lifecycle)
2. [init — Initialize the PGC](#init--initialize-the-pgc)
3. [genesis — Build the Verifiable Skeleton](#genesis--build-the-verifiable-skeleton)
4. [ask — Semantic Q&A](#ask--semantic-qa)
5. [patterns — Pattern Detection](#patterns--pattern-detection)
6. [coherence — Consistency Validation](#coherence--consistency-validation)
7. [blast-radius — Impact Analysis](#blast-radius--impact-analysis)
8. [overlay — Overlay Management](#overlay--overlay-management)

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

**Next Step**: Run `genesis` to populate the PGC.

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

## patterns — Pattern Detection

**Command**: `cognition-cli patterns <pattern-type>`

**Purpose**: Detect structural and semantic patterns in the codebase.

**Prerequisites**: Genesis must have run.

**Pattern Types**:

```bash
cognition-cli patterns security     # Detect security patterns
cognition-cli patterns architecture # Detect architectural patterns
cognition-cli patterns idioms       # Detect language idioms
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
