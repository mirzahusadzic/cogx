# Command Reference

Complete reference for all `cognition-cli` commands. Use these commands in Claude Code or your terminal.

---

## Core Commands

### `cognition-cli init`

Initialize a new Grounded Context Pool (PGC) in your project.

```bash
cognition-cli init [options]
```

**Options:**

- `-p, --project-root <path>` - Project root directory (default: `.`)
- `--force` - Force re-initialization (removes existing PGC)

**What it creates:**

- `.open_cognition/` directory with:
  - `objects/` - Content-addressable object storage
  - `logs/` - Transformation audit trail
  - `index/` - Fast lookup indices
  - `overlays/` - Analytical overlay data

**Example:**

```bash
# Initialize in current directory
cognition-cli init

# Initialize in specific project
cognition-cli init -p ~/projects/my-app
```

---

### `cognition-cli genesis`

Build the verifiable skeleton of your codebase by extracting structural patterns.

```bash
cognition-cli genesis [options] [sourcePath]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `-s, --source <path>` - Source directory to analyze (default: `src`)
- `--force` - Force regeneration (ignore cache)
- `--watch` - Watch mode (continuous updates)

**What it does:**

1. Parses TypeScript/JavaScript files
2. Extracts structural patterns (classes, functions, types)
3. Computes cryptographic hashes for provenance
4. Stores in content-addressable format

**Example:**

```bash
# Analyze src/ directory
cognition-cli genesis

# Analyze specific directory
cognition-cli genesis src/core

# Watch for changes
cognition-cli genesis --watch
```

---

### `cognition-cli genesis:docs`

Ingest markdown documentation into PGC with full provenance tracking.

```bash
cognition-cli genesis:docs [options] [path]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--recursive, -r` - Recursively ingest all markdown files
- `--force` - Force re-ingestion (bypass validation)

**What it does:**

1. Parses markdown files (with hierarchical AST)
2. Validates structure and extracts metadata
3. Runs security validation (optional: Gemini LLM + semantic drift)
4. Stores with cryptographic hash
5. Tracks version history for drift detection

**Example:**

```bash
# Ingest VISION.md (default)
cognition-cli genesis:docs

# Ingest specific file
cognition-cli genesis:docs docs/ARCHITECTURE.md

# Ingest entire docs/ directory
cognition-cli genesis:docs docs/ --recursive
```

---

### `cognition-cli query`

Query the codebase using natural language (powered by PGC metadata).

```bash
cognition-cli query [options] <question>
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--format <type>` - Output format: `text` or `json` (default: `text`)

**Example:**

```bash
# Ask about architecture
cognition-cli query "What are the main components?"

# Find implementations
cognition-cli query "Which files implement pattern matching?"

# JSON output
cognition-cli query "List all managers" --format json
```

---

### `cognition-cli status`

Check PGC coherence state and dirty file tracking.

```bash
cognition-cli status [options]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--json` - Output as JSON

**What it shows:**

- Dirty files (modified since last genesis)
- PGC coherence state
- Pending updates

**Example:**

```bash
cognition-cli status
```

---

### `cognition-cli update`

Incremental PGC sync based on dirty state (Monument 3).

```bash
cognition-cli update [options]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--force` - Force full re-sync

**What it does:**

- Reads `dirty_state.json`
- Incrementally updates only changed files
- Maintains coherence without full rebuild

**Example:**

```bash
cognition-cli update
```

---

### `cognition-cli watch`

Watch files for changes and maintain PGC coherence in real-time.

```bash
cognition-cli watch [options]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)

**What it does:**

- Monitors source files for changes
- Auto-updates PGC on file save
- Tracks dirty state continuously

**Example:**

```bash
# Start watch mode
cognition-cli watch

# Use with Claude Code while developing
```

---

## Audit Commands

### `cognition-cli audit:transformations`

Audit the transformation history of a specific file.

```bash
cognition-cli audit:transformations [options] <filePath>
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--json` - Output as JSON

**What it shows:**

- All transformations applied to the file
- Cryptographic hashes for each version
- Provenance chain

**Example:**

```bash
cognition-cli audit:transformations src/core/manager.ts
```

---

### `cognition-cli audit:docs`

Audit document integrity in PGC (validates index consistency).

```bash
cognition-cli audit:docs [options]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)

**What it validates:**

- Document index integrity
- Hash consistency
- Missing or orphaned documents

**Example:**

```bash
cognition-cli audit:docs
```

---

## Overlay Commands

### `cognition-cli overlay generate`

Generate analytical overlays (O₁-O₄ layers).

```bash
cognition-cli overlay generate [options] <type> [sourcePath]
```

**Overlay Types:**

- `structural_patterns` - O₁: Extract structural patterns from code
- `lineage_patterns` - O₂: Mine dependency relationships
- `mission_concepts` - O₃: Extract concepts from strategic docs
- `strategic_coherence` - O₄: Compute code-mission alignment

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--force` - Force regeneration (ignore cache)

**Examples:**

```bash
# Generate structural patterns (O₁)
cognition-cli overlay generate structural_patterns

# Generate lineage patterns (O₂)
cognition-cli overlay generate lineage_patterns

# Generate mission concepts (O₃) from VISION.md
cognition-cli overlay generate mission_concepts

# Generate strategic coherence (O₄)
cognition-cli overlay generate strategic_coherence

# Force regeneration
cognition-cli overlay generate strategic_coherence --force
```

---

### `cognition-cli overlay list`

List all available overlays and their generation status.

```bash
cognition-cli overlay list [options]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)

**Example:**

```bash
cognition-cli overlay list
```

---

## Pattern Commands

### `cognition-cli patterns list`

List all extracted structural patterns.

```bash
cognition-cli patterns list [options]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--role <type>` - Filter by architectural role (e.g., `manager`, `service`, `utility`)
- `--json` - Output as JSON

**Example:**

```bash
# List all patterns
cognition-cli patterns list

# Filter by role
cognition-cli patterns list --role manager
```

---

### `cognition-cli patterns inspect`

Show comprehensive information about a specific symbol.

```bash
cognition-cli patterns inspect <symbol>
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)

**What it shows:**

- Symbol signature
- File location
- Architectural role
- Dependencies
- Structural hash

**Example:**

```bash
cognition-cli patterns inspect StructuralPatternsManager
```

---

### `cognition-cli patterns analyze`

Analyze architectural patterns across the entire codebase.

```bash
cognition-cli patterns analyze [options]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--type <overlay>` - Analyze structural or lineage patterns (default: `structural`)
- `--verbose` - Show detailed file paths

**What it shows:**

- Pattern distribution by role
- Most common architectural patterns
- Statistics

**Example:**

```bash
# Analyze structural patterns
cognition-cli patterns analyze

# Analyze lineage patterns
cognition-cli patterns analyze --type lineage
```

---

### `cognition-cli patterns find-similar`

Find symbols with similar patterns to a given symbol.

```bash
cognition-cli patterns find-similar [options] <symbol>
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--limit <n>` - Max results to return (default: 10)

**Example:**

```bash
cognition-cli patterns find-similar PGCManager --limit 5
```

---

### `cognition-cli patterns graph`

Visualize dependency graph for a symbol.

```bash
cognition-cli patterns graph [options] <symbol>
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--depth <n>` - Traversal depth (default: 2)

**Example:**

```bash
cognition-cli patterns graph OverlayOrchestrator --depth 3
```

---

### `cognition-cli patterns compare`

Compare the patterns of two symbols side-by-side.

```bash
cognition-cli patterns compare [options] <symbol1> <symbol2>
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)

**Example:**

```bash
cognition-cli patterns compare PGCManager ObjectStore
```

---

## Mission Concepts Commands (O₃)

### `cognition-cli concepts list`

List all extracted mission concepts from strategic documents.

```bash
cognition-cli concepts list [options]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--json` - Output as JSON

**What it shows:**

- Concept text
- Source section (Vision, Mission, Principles, etc.)
- Document source
- Extraction pattern used

**Example:**

```bash
cognition-cli concepts list
```

---

### `cognition-cli concepts top`

Show top mission concepts by weight/importance.

```bash
cognition-cli concepts top [options] [count]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--count <n>` - Number of concepts to show (default: 20)

**Example:**

```bash
# Show top 20 concepts
cognition-cli concepts top

# Show top 10
cognition-cli concepts top 10
```

---

### `cognition-cli concepts search`

Find concepts matching a keyword or phrase.

```bash
cognition-cli concepts search [options] <keyword>
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)

**Example:**

```bash
cognition-cli concepts search "verifiable"
cognition-cli concepts search "AI-human symbiosis"
```

---

### `cognition-cli concepts by-section`

Filter concepts by document section.

```bash
cognition-cli concepts by-section [options] <section>
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)

**Common sections:**

- `Vision`
- `Mission`
- `Principles`
- `The Path Forward`
- `Why This Matters`

**Example:**

```bash
cognition-cli concepts by-section Vision
cognition-cli concepts by-section "The Path Forward"
```

---

### `cognition-cli concepts inspect`

Show detailed information about a specific concept.

```bash
cognition-cli concepts inspect [options] <text>
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)

**What it shows:**

- Full concept text
- Source section and document
- Extraction pattern
- Embedding vector (if available)
- Section hash (provenance)

**Example:**

```bash
cognition-cli concepts inspect "Augment human consciousness"
```

---

## Strategic Coherence Commands (O₄)

### `cognition-cli coherence report`

Show overall strategic coherence metrics dashboard.

```bash
cognition-cli coherence report [options]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--json` - Output as JSON

**What it shows:**

- Average coherence score across all symbols
- Number of aligned symbols (score ≥ 70%)
- Number of drifted symbols (score < 70%)
- Mission documents analyzed
- Total concepts and symbols

**Example:**

```bash
cognition-cli coherence report
```

---

### `cognition-cli coherence aligned`

Show symbols highly aligned with mission (score ≥ threshold).

```bash
cognition-cli coherence aligned [options]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--min-score <score>` - Minimum coherence score (default: 0.7)
- `--json` - Output as JSON

**What it shows:**

- Symbol name and file path
- Overall coherence score
- Top mission concept alignments

**Example:**

```bash
# Show symbols with ≥70% coherence
cognition-cli coherence aligned

# Custom threshold
cognition-cli coherence aligned --min-score 0.5
```

---

### `cognition-cli coherence drifted`

Show symbols that have drifted from mission (score < threshold).

```bash
cognition-cli coherence drifted [options]
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--max-score <score>` - Maximum coherence score (default: 0.7)
- `--json` - Output as JSON

**What it shows:**

- Symbol name and file path
- Overall coherence score
- Best mission concept alignments (even if low)

**Example:**

```bash
# Show symbols with <70% coherence
cognition-cli coherence drifted

# Show all symbols
cognition-cli coherence drifted --max-score 1.0
```

---

### `cognition-cli coherence for-symbol`

Show detailed mission alignment for a specific symbol.

```bash
cognition-cli coherence for-symbol [options] <symbolName>
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--json` - Output as JSON

**What it shows:**

- Symbol location and hash
- Overall coherence score
- Top 5 mission concept alignments with scores
- Section sources for each concept

**Example:**

```bash
cognition-cli coherence for-symbol StrategicCoherenceManager
```

---

### `cognition-cli coherence compare`

Compare mission alignment of two symbols side-by-side.

```bash
cognition-cli coherence compare [options] <symbol1> <symbol2>
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--json` - Output as JSON

**What it shows:**

- Both symbols' coherence scores
- Top alignments for each
- Which symbol is more aligned with mission
- Alignment difference

**Example:**

```bash
cognition-cli coherence compare PatternManager StructuralPatternMetadata
```

---

## Impact Analysis

### `cognition-cli blast-radius`

Show the complete impact graph when a symbol changes.

```bash
cognition-cli blast-radius [options] <symbol>
```

**Options:**

- `-p, --project-root <path>` - Project root (default: `.`)
- `--depth <n>` - Traversal depth (default: 3)
- `--format <type>` - Output format: `text`, `json`, or `mermaid` (default: `text`)

**What it shows:**

- Direct dependents (files that import this symbol)
- Transitive dependents (cascade effect)
- Impact score (number of affected files)

**Example:**

```bash
# Show impact of changing PGCManager
cognition-cli blast-radius PGCManager

# Deep traversal
cognition-cli blast-radius ObjectStore --depth 5

# Mermaid diagram
cognition-cli blast-radius OverlayOrchestrator --format mermaid
```

---

## Utility Commands

### `cognition-cli guide`

Show colorful, interactive guides for cognition-cli commands.

```bash
cognition-cli guide [topic]
```

**Available topics:**

- `init` - Getting started guide
- `genesis` - Understanding structural extraction
- `query` - Querying your codebase
- `overlays` - Working with analytical overlays
- `watch` - Real-time PGC maintenance

**Example:**

```bash
# List all guides
cognition-cli guide

# Show specific guide
cognition-cli guide overlays
```

---

## Command Categories Quick Reference

### Setup & Initialization

- `init` - Initialize PGC
- `genesis` - Extract structural patterns
- `genesis:docs` - Ingest documentation

### Real-Time Monitoring

- `watch` - Watch mode (auto-update)
- `status` - Check PGC state
- `update` - Incremental sync

### Querying & Analysis

- `query` - Natural language queries
- `patterns list|inspect|analyze|graph|compare` - Pattern analysis
- `blast-radius` - Impact analysis

### Mission Alignment (O₃/O₄)

- `concepts list|top|search|by-section|inspect` - Mission concepts
- `coherence report|aligned|drifted|for-symbol|compare` - Strategic coherence

### Advanced

- `overlay generate|list` - Generate analytical overlays
- `audit:transformations|docs` - Audit provenance
- `guide` - Interactive help

---

## Tips

**1. Start with these commands:**

```bash
cognition-cli init
cognition-cli genesis
cognition-cli overlay generate structural_patterns
cognition-cli patterns analyze
```

**2. Real-time development:**

```bash
# Terminal 1: Watch mode
cognition-cli watch

# Terminal 2: Use Claude Code with PGC queries
```

**3. Mission alignment workflow:**

```bash
# 1. Ingest strategic docs
cognition-cli genesis:docs VISION.md

# 2. Extract mission concepts
cognition-cli overlay generate mission_concepts

# 3. Compute coherence
cognition-cli overlay generate strategic_coherence

# 4. Check alignment
cognition-cli coherence report
cognition-cli coherence drifted
```

**4. Pre-commit checks:**

```bash
# Check what changed
cognition-cli status

# Update PGC
cognition-cli update

# Check coherence of modified code
cognition-cli patterns analyze
cognition-cli coherence report
```

---

**See also:**

- [Quick Start Guide](./quick-start.md)
- [Real-World Workflows](./workflows.md)
- [Integration Patterns](./integration-patterns.md)
