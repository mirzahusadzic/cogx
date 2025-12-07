# Command Reference

Complete reference for all `cognition-cli` commands. Use these commands in Claude Code or your terminal.

---

## Core Commands

### `cognition-cli init`

Initialize a new Grounded Context Pool (PGC) in your project with auto-detection.

```bash
cognition-cli init [options]
```

**Options:**

- `-p, --project-root <path>` - Project path (default: current directory)
- `-n, --dry-run` - Preview what would be created without making changes
- `-f, --force` - Skip confirmation prompts (for scripts/CI)

**What it does:**

- **Auto-detects source directories**: Scans for code directories (src/, lib/, Python packages)
- **Auto-detects documentation**: Finds README.md, VISION.md, docs/, etc.
- **Interactive selection**: Allows confirming or editing detected paths
- **Stores configuration**: Saves selected paths in `metadata.json` for use by genesis and overlay commands

**What it creates:**

- `.open_cognition/` directory with:
  - `objects/` - Content-addressable object storage
  - `transforms/` - Intermediate processing state
  - `index/` - Fast lookup indices
  - `reverse_deps/` - Reverse dependency maps
  - `overlays/` - Analytical overlay data
  - `metadata.json` - Project metadata with detected source/doc paths
  - `.gitignore` - Excludes large objects/ from version control

**Example:**

```bash
# Initialize in current directory (auto-detects sources)
cognition-cli init

# Preview what would be created
cognition-cli init --dry-run

# Force mode (skip prompts, for CI/scripts)
cognition-cli init --force

# Initialize in specific project
cognition-cli init -p ~/projects/my-app
```

---

### `cognition-cli wizard`

Interactive wizard for complete PGC setup. Recommended for first-time users.

```bash
cognition-cli wizard [options]
```

**Options:**

- `-p, --project-root <path>` - Project root directory (default: `.`)

**Workflow:**

1. **PGC Detection**: Checks for existing `.open_cognition/` directory
2. **Workbench Verification**: Validates eGemma workbench is running
3. **API Configuration**: Configures API keys for embeddings
4. **Init (if needed)**: Runs `init` interactively - user picks source directories and docs
5. **Overlay Selection**: Prompts for overlays (user now knows what sources/docs exist)
6. **Genesis**: Runs genesis with selected sources from metadata
7. **Documentation Ingestion**: Ingests selected docs from metadata
8. **Overlay Generation**: Generates selected overlays (O₁-O₇)

**Key Design**: Init runs FIRST so users can select sources before being asked about overlays. This prevents selecting O₄/O₇ when no docs are available.

**Example:**

```bash
# Run wizard (guided setup)
cognition-cli wizard

# Wizard with existing PGC shows options:
# - Update Existing Overlays
# - Init PGC (wipe and start fresh)
# - Cancel
```

---

### `cognition-cli genesis`

Build the verifiable skeleton of your codebase by extracting structural patterns.

```bash
cognition-cli genesis [sourcePaths...] [options]
```

**Arguments:**

- `[sourcePaths...]` - Source paths to analyze (reads from metadata.json if omitted)

**Options:**

- `-w, --workbench <url>` - URL of the egemma workbench (default: WORKBENCH_URL env var or `http://localhost:8000`)
- `-p, --project-root <path>` - Project root (default: current directory)
- `-n, --dry-run` - Preview files without processing
- `-r, --resume` - Resume from interrupted genesis (skips already-processed files)

**What it does:**

1. Parses TypeScript/JavaScript files
2. Extracts structural patterns (classes, functions, types)
3. Computes cryptographic hashes for provenance
4. Stores in content-addressable format
5. Indexes files in PGC for overlay generation

**Example:**

```bash
# Use paths from init (metadata.json)
cognition-cli genesis

# Analyze specific directory
cognition-cli genesis src/core

# Multiple directories (space-separated)
cognition-cli genesis src/ lib/

# Preview files that would be analyzed
cognition-cli genesis --dry-run

# Resume interrupted genesis
cognition-cli genesis --resume
```

---

### `cognition-cli genesis:docs`

Ingest markdown documentation into PGC with full provenance tracking.

```bash
cognition-cli genesis:docs [paths...] [options]
```

**Arguments:**

- `[paths...]` - Documentation paths to ingest (reads from metadata.json, falls back to VISION.md)

**Options:**

- `-p, --project-root <path>` - Project root (default: current directory)
- `-f, --force` - Force re-ingestion by removing existing entries first

**What it does:**

1. Parses markdown files (with hierarchical AST)
2. Validates structure and extracts metadata
3. Runs security validation (optional: Gemini LLM + semantic drift)
4. Stores with cryptographic hash
5. Tracks version history for drift detection

**Example:**

```bash
# Ingest docs from metadata.json (or VISION.md if not configured)
cognition-cli genesis:docs

# Ingest specific file
cognition-cli genesis:docs docs/ARCHITECTURE.md

# Ingest multiple files
cognition-cli genesis:docs docs/VISION.md docs/ARCHITECTURE.md

# Force re-ingestion
cognition-cli genesis:docs --force
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

Generate analytical overlays (O₁-O₇ layers).

**IMPORTANT:** Overlay generation reads from PGC index (created by `genesis`). Run `genesis` first to index source files.

```bash
cognition-cli overlay generate <type> [options]
```

**Overlay Types:**

- `structural_patterns` - O₁: Extract structural patterns from code
- `security_guidelines` - O₂: Security threats, boundaries, mitigations
- `lineage_patterns` - O₃: Mine dependency relationships
- `mission_concepts` - O₄: Extract concepts from strategic docs (requires docs)
- `operational_patterns` - O₅: Workflow patterns, quest structures
- `mathematical_proofs` - O₆: Theorems, lemmas, axioms
- `strategic_coherence` - O₇: Compute code-mission alignment (requires docs)

**Options:**

- `-f, --force` - Force regeneration even if patterns exist
- `--skip-gc` - Skip garbage collection (useful when switching branches)

**Examples:**

```bash
# Generate structural patterns (reads from PGC index)
cognition-cli overlay generate structural_patterns

# Generate security guidelines (O₂)
cognition-cli overlay generate security_guidelines

# Generate lineage patterns (O₃)
cognition-cli overlay generate lineage_patterns

# Generate mission concepts (O₄) - requires docs ingested
cognition-cli overlay generate mission_concepts

# Generate strategic coherence (O₇) - requires docs ingested
cognition-cli overlay generate strategic_coherence

# Force regeneration
cognition-cli overlay generate strategic_coherence --force
```

---

### `cognition-cli overlay list`

List all available overlays and their generation status.

```bash
cognition-cli overlay list
```

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

## Interactive & LLM Integration

### `cognition-cli tui`

Launch interactive terminal UI with LLM integration for conversational AI workflows.

```bash
cognition-cli tui [options]
```

**Options:**

- `-p, --project-root <path>` - Root directory of the project (default: `.`)
- `--session-id <anchor-id>` - Anchor ID to resume a previous session
- `-f, --file <path>` - Path to session state file (e.g., `.sigma/tui-1762546919034.state.json`)
- `-w, --workbench <url>` - URL of the egemma workbench (defaults to WORKBENCH_URL env var)
- `--session-tokens <number>` - Token threshold for context compression (default: `120000`)
- `--max-thinking-tokens <number>` - Maximum tokens for extended thinking mode (default: `32000`)
- `--provider <name>` - LLM provider to use: `claude` or `gemini` (default: `gemini`)
- `--model <name>` - Model to use (provider-specific)
- `--debug` - Enable debug logging for Sigma compression
- `--no-show-thinking` - Hide thinking blocks in TUI

**What it provides:**

- Real-time conversation with Claude or Gemini LLM providers
- Persistent session management with Sigma compression
- Interactive overlay status bar showing O1-O7 statistics
- Token tracking and automatic context compression at threshold
- Tool execution with confirmation dialogs
- Scroll history with position indicator

**Example:**

```bash
# Start TUI with default provider (Gemini)
cognition-cli tui

# Start with Claude provider (using API key)
ANTHROPIC_API_KEY=sk-ant-... cognition-cli tui --provider claude

# Start with Claude provider (using OAuth)
cognition-cli tui --provider claude

# Resume previous session
cognition-cli tui --session-id abc123

# Start with extended thinking mode
cognition-cli tui --max-thinking-tokens 64000

# Start with specific model
cognition-cli tui --provider claude --model claude-sonnet-4-5
```

---

### `cognition-cli tui provider`

Manage LLM providers for the TUI.

```bash
cognition-cli tui provider [command]
```

**Subcommands:**

#### `provider list`

List available LLM providers and their status.

```bash
cognition-cli tui provider list
```

**What it shows:**

- Available providers (Claude, Gemini)
- Health status (configured, not configured, error)
- Required environment variables
- Current default provider

**Example:**

```bash
cognition-cli tui provider list

# Output:
# ✅ claude - Configured (ANTHROPIC_API_KEY set)
# ✅ gemini - Configured (GEMINI_API_KEY set)
# Default: gemini
```

---

#### `provider set-default <provider>`

Set the default LLM provider.

```bash
cognition-cli tui provider set-default <provider>
```

**Arguments:**

- `<provider>` - Provider name: `claude` or `gemini`

**Example:**

```bash
# Set Claude as default
cognition-cli tui provider set-default claude

# Set Gemini as default
cognition-cli tui provider set-default gemini
```

---

#### `provider test <provider>`

Test provider availability and configuration.

```bash
cognition-cli tui provider test <provider>
```

**Arguments:**

- `<provider>` - Provider name: `claude` or `gemini`

**What it checks:**

- Environment variables (API keys)
- Provider initialization
- Basic connectivity

**Example:**

```bash
cognition-cli tui provider test claude
cognition-cli tui provider test gemini
```

---

#### `provider config`

Show current LLM provider configuration.

```bash
cognition-cli tui provider config
```

**What it shows:**

- Current default provider
- Configured providers and their status
- Environment variables (masked)
- Available models per provider

**Example:**

```bash
cognition-cli tui provider config

# Output:
# Default Provider: gemini
#
# Configured Providers:
# - claude: ✅ (ANTHROPIC_API_KEY: set)
# - gemini: ✅ (GEMINI_API_KEY: set)
```

---

#### `provider models [provider]`

List available models for a provider.

```bash
cognition-cli tui provider models [provider]
```

**Arguments:**

- `[provider]` - Optional provider name. If omitted, shows all models for all providers.

**What it shows:**

- Model IDs
- Model names and descriptions
- Provider-specific model capabilities

**Example:**

```bash
# List all models
cognition-cli tui provider models

# List Claude models only
cognition-cli tui provider models claude

# Output:
# Claude Models:
# - claude-sonnet-4-5-20250929 (Claude Sonnet 4.5)
# - claude-3-5-sonnet-20241022 (Claude 3.5 Sonnet)
# - claude-opus-4-20250514 (Claude Opus 4)
# - claude-3-7-sonnet-20250219 (Claude 3.7 Sonnet)
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

### Interactive & LLM Integration

- `tui` - Launch interactive TUI with LLM providers
- `tui provider list` - List available LLM providers
- `tui provider set-default <provider>` - Set default provider
- `tui provider test <provider>` - Test provider availability
- `tui provider config` - Show provider configuration
- `tui provider models [provider]` - List available models

### Advanced

- `overlay generate|list` - Generate analytical overlays
- `audit:transformations|docs` - Audit provenance
- `guide` - Interactive help

---

## Tips

**1. Start with wizard (recommended):**

```bash
cognition-cli wizard  # Interactive setup with auto-detection
```

**Or manual setup:**

```bash
cognition-cli init                              # Auto-detects sources and docs
cognition-cli genesis                           # Uses paths from metadata.json
cognition-cli overlay generate structural_patterns  # Uses paths from metadata.json
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
