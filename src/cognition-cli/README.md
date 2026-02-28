# Cognition Σ CLI

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18012832.svg)](https://doi.org/10.5281/zenodo.18012832)

<div align="center" style="margin-top: 20px; margin-bottom: 20px;">
<img src="./docs/assets/cognition-cli-logo.png" alt="Cognition CLI Logo" width="512"/>
</div>

> **The reference implementation of the [CogX Architectural Blueprint](https://github.com/mirzahusadzic/cogx)** — A production-ready dual-lattice engine for verifiable AI-human symbiosis with infinite context.

Cognition Σ CLI is the working implementation of the **Grounded Context Pool (PGC)** combined with **Σ (Sigma) dual-lattice architecture**. It transforms your codebase into a queryable, verifiable knowledge graph with seven cognitive overlays (O₁-O₇), and provides an interactive TUI with true stateful AI that never forgets.

**Want the theory?** See the **[CogX Blueprint](../../README.md)** for mathematical foundations, axioms, and architectural vision.

## At a Glance

| Metric             | Value                            |
| ------------------ | -------------------------------- |
| Production Code    | ~104,188 lines TypeScript        |
| Test Coverage      | ~92% (172 test files)            |
| Core Commands      | 40+ with tab completion          |
| Cognitive Overlays | 7 (O₁-O₇)                        |
| LLM Providers      | 3 (Gemini, Claude, OpenAI/local) |

_For detailed metrics, see [Comprehensive Analysis](docs/architecture/COMPREHENSIVE_ANALYSIS.md)._

---

## 🚀 Quick Start

```bash
# Install
cd src/cognition-cli
npm install && npm run build && npm link

# Navigate to your project
cd /path/to/your/project

# Run interactive setup wizard
cognition-cli wizard

# Or manually initialize
cognition-cli init
cognition-cli genesis src/
cognition-cli genesis:docs docs/

# Launch interactive TUI with infinite context
cognition-cli tui
```

### LLM Provider Support

Cognition CLI supports multiple LLM providers:

- **Gemini** (Google) - Included by default
- **Claude** (Anthropic) - Optional, requires additional setup
- **OpenAI/Local** - OpenAI API or OpenAI-compatible endpoints (e.g., local models via eGemma workbench)

#### Gemini (Default Provider)

You can connect to Gemini using either an API key or Google Cloud Vertex AI (ADC).

```bash
# Option A: API Key
export GEMINI_API_KEY=your-key-here

# Option B: Vertex AI
# No API key required - uses Application Default Credentials (ADC)
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT=your-project-id  # Optional if set in gcloud config
export GOOGLE_CLOUD_LOCATION=us-central1     # Optional if set in gcloud config

# Ensure you are authenticated
gcloud auth application-default login

# Launch TUI (uses Gemini by default)
cognition-cli tui
```

**License**: Apache 2.0 (Open Source)
By using the Gemini provider, you agree to the [Google Gemini API Terms of Service](https://ai.google.dev/gemini-api/terms).

#### Enabling Claude Support

Due to licensing restrictions (cognition-cli is AGPL-3.0, Claude Agent SDK is proprietary),
the Claude provider requires manual installation.

**Installation (from source):**

```bash
git clone https://github.com/mirzahusadzic/cogx
cd cogx/src/cognition-cli
npm install
npm install @anthropic-ai/claude-agent-sdk  # Optional: for Claude support
npm run build
npm link  # Makes 'cognition-cli' available globally

# Now you can use it from anywhere
cd /path/to/your/project
cognition-cli tui --provider claude
```

Claude can be used with:

```bash
# With official OpenAI API
export ANTHROPIC_API_KEY=sk-ant-...
cognition-cli tui --provider claude
```

**Note:** If the Claude Agent SDK is not installed, cognition-cli will automatically fall back to Gemini.

**License**: Proprietary (Anthropic Commercial ToS)
By installing `@anthropic-ai/claude-agent-sdk`, you accept [Anthropic's Terms of Service](https://www.anthropic.com/legal/commercial-terms).

#### OpenAI/Local Provider

Supports official OpenAI API or any OpenAI-compatible endpoint (e.g., local models via eGemma workbench).

```bash
# With official OpenAI API
export OPENAI_API_KEY=sk-...
cognition-cli tui --provider openai

# With local workbench (auto-configures when gpt-oss model is loaded)
# No API key needed - workbench auto-detected
cognition-cli tui --provider openai
```

**Auto-configuration:** When eGemma workbench has a chat model loaded (e.g., `gpt-oss-20b`), cognition-cli automatically configures the OpenAI provider to use the local endpoint.

**License**: MIT (@openai/agents SDK)

---

## 💡 What Is This?

**Two lattices working together:**

- **Project Lattice** (`.open_cognition/`) — Your codebase as a verifiable knowledge graph with 7-dimensional overlays
- **Conversation Lattice** (`.sigma/`) — AI memory built on-the-fly from chat, with intelligent compression

**The Result:** AI that never forgets, grounded in your project's truth, with zero hallucinations.

### The Breakthrough: Dual-Lattice Meet Operations

```
Project Lattice ∧ Conversation Lattice = Project Alignment Score
```

When context limit (200K tokens) is hit:

1. Flush conversation lattice to `.sigma/overlays/`
2. Query all 7 overlays for high-alignment turns
3. Generate 7-dimensional recap (O₁-O₇)
4. Transition to fresh session with intelligent systemPrompt
5. Add `recall_past_conversation` tool for on-demand deep memory

**Result:** True stateful AI with infinite context.

---

## 🎯 Core Workflows

### 1. Code Analysis & Pattern Discovery

```bash
# Build structural knowledge graph
cognition-cli genesis src/

# Generate structural overlay
cognition-cli overlay generate structural_patterns

# Find similar patterns
cognition-cli patterns find-similar App

# Analyze blast radius
cognition-cli blast-radius PGCManager
```

### 2. Interactive TUI with Infinite Context

```bash
# Launch interactive session with Gemini (default)
cognition-cli tui

# Use Claude provider
cognition-cli tui --provider claude

# Use specific model
cognition-cli tui --provider claude --model claude-sonnet-4-5

# With debug mode to see turn analysis
cognition-cli tui --debug

# Manage providers
cognition-cli tui provider list
cognition-cli tui provider set-default claude
```

**Features:**

- ✅ Multi-provider support (Claude, Gemini & OpenAI/local with unified UX)
- ✅ Thinking blocks visualization for extended reasoning
- ✅ Infinite context across sessions with intelligent compression
- ✅ **Tri-Modal Compression Strategy** (Semantic, Standard, Survival) for TPM protection
- ✅ **Dynamic Thinking Budgeting** for optimized reasoning performance
- ✅ Real-time lattice visualization with live stats
- ✅ Live overlay status (O₁-O₇) in status bar
- ✅ Token tracking with compression threshold (200K)
- ✅ Multiline input with improved paste handling
- ✅ ESC interrupt for aborting agent responses
- ✅ Tool execution with permission confirmation dialogs

**Learn more:** [TUI Documentation](./src/tui/README.md) | [SIGMA Architecture](docs/sigma/ARCHITECTURE.md)

### 3. PR Impact Analysis (O₁+O₂+O₃+O₄+O₇)

Comprehensive PR assessment combining all 5 overlays:

```bash
# Analyze current changes
cognition-cli pr-analyze

# Analyze specific branch
cognition-cli pr-analyze --branch feature/auth-refactor

# Export for CI/CD
cognition-cli pr-analyze --json > pr-analysis.json
```

**Output includes:**

- 📦 Structural changes (O₁)
- 🔒 Security review (O₂)
- 💥 Blast radius (O₃)
- 🎯 Mission alignment (O₄)
- 📈 Coherence impact (O₇)
- ✅ Mergeable recommendation with risk score

### 4. Security Blast Radius (O₂+O₃)

Cascading security impact when a file/symbol is compromised:

```bash
# Analyze security impact
cognition-cli security blast-radius src/auth.ts

# By symbol name
cognition-cli security blast-radius validateToken

# Export for security audit
cognition-cli security blast-radius src/auth.ts --json
```

**Use cases:**

- Vulnerability triage (prioritize by blast radius)
- Security code reviews
- Incident response (understand attack surface)

### 5. Real-Time Synchronization (The Three Monuments)

```bash
# Terminal 1: Start file watcher
cognition-cli watch

# Terminal 2: Check status (< 10ms)
cognition-cli status

# Terminal 2: Incremental update
cognition-cli update
```

**The Complete Loop:**

```
watch → dirty_state.json → status → update → coherence restored ♻️
```

---

## 📋 Command Reference

| Command                   | Description                        | Learn More                                                           |
| :------------------------ | :--------------------------------- | :------------------------------------------------------------------- |
| `wizard`                  | Interactive guided setup           | [CLI Operations](docs/manual/part-1-foundation/05-cli-operations.md) |
| `init`                    | Initialize PGC with auto-detection | [Getting Started](docs/guides/00_Introduction.md)                    |
| `genesis [path]`          | Build code knowledge graph         | [Structural Analysis](docs/guides/01_Structural_Analysis.md)         |
| `genesis:docs [path]`     | Ingest documentation               | [Mission Extraction](docs/guides/09_Mission_Concept_Extraction.md)   |
| `watch`                   | Real-time file monitoring          | [Commands](docs/guides/03_Commands.md)                               |
| `status`                  | Instant coherence check            | [Commands](docs/guides/03_Commands.md)                               |
| `update`                  | Incremental sync                   | [Commands](docs/guides/03_Commands.md)                               |
| `overlay generate <type>` | Generate analytical overlays       | [Commands](docs/guides/03_Commands.md)                               |
| `tui`                     | Interactive TUI with Σ system      | [Claude Integration](docs/guides/08_Claude_CLI_Integration.md)       |
| `pr-analyze`              | Cross-overlay PR analysis          | [Commands](docs/guides/03_Commands.md)                               |
| `security blast-radius`   | Security impact analysis           | [Commands](docs/guides/03_Commands.md)                               |
| `patterns <command>`      | Structural pattern operations      | [Structural Analysis](docs/guides/01_Structural_Analysis.md)         |
| `concepts <command>`      | Mission concept operations         | [Mission Extraction](docs/guides/09_Mission_Concept_Extraction.md)   |
| `coherence <command>`     | Mission-code coherence             | [Mission Security](docs/guides/10_Mission_Security_Validation.md)    |
| `query <question>`        | Graph traversal                    | [AI Analysis](docs/guides/07_AI_Grounded_Architecture_Analysis.md)   |
| `audit <command>`         | PGC integrity verification         | [Verification](docs/guides/05_Verification_and_Oracles.md)           |

---

## 🏗️ Architecture Quick Reference

### Seven Overlays (O₁-O₇)

| Overlay | Name         | Purpose                                                 |
| :------ | :----------- | :------------------------------------------------------ |
| **O₁**  | Structural   | AST-based code structure, symbols, dependencies         |
| **O₂**  | Security     | Vulnerability & threat analysis, attack surface mapping |
| **O₃**  | Lineage      | Provenance & history, Git integration, authorship       |
| **O₄**  | Mission      | Strategic alignment, concept extraction, value scoring  |
| **O₅**  | Operational  | Workflow intelligence, quest patterns, procedures       |
| **O₆**  | Mathematical | Formal properties, proofs, invariants, theorems         |
| **O₇**  | Coherence    | Cross-overlay synthesis, consistency checking           |

**Deep dive:** [CogX Architecture](../../docs/architecture/README.md)

### Four Pillars

The PGC is built on four foundational pillars in `.open_cognition/`:

- **Objects** — Content-addressable immutable storage (like Git)
- **Transforms** — Append-only audit trail with fidelity scores
- **Index** — Human-readable path → hash mappings
- **Reverse Deps** — O(1) dependency lookup for instant impact analysis

**Deep dive:** [Core Infrastructure](docs/guides/02_Core_Infrastructure.md)

---

## 📖 Documentation

### Getting Started

- **[00 - Introduction](docs/guides/00_Introduction.md)** — Overview and core concepts
- **[Complete Lattice Book](https://mirzahusadzic.github.io/cogx)** — 21-chapter reference manual
- **[CogX Blueprint](../../README.md)** — Theoretical foundations and vision

### Implementation Guides

- **[01 - Structural Analysis](docs/guides/01_Structural_Analysis.md)** — Code understanding
- **[02 - Core Infrastructure (PGC)](docs/guides/02_Core_Infrastructure.md)** — Four pillars
- **[03 - Commands Reference](docs/guides/03_Commands.md)** — Complete CLI reference
- **[04 - Miners and Executors](docs/guides/04_Miners_and_Executors.md)** — Transform pipeline
- **[05 - Verification and Oracles](docs/guides/05_Verification_and_Oracles.md)** — Validation
- **[06 - Testing and Deployment](docs/guides/06_Testing_and_Deployment.md)** — Production usage

### Advanced Topics

- **[07 - AI-Grounded Architecture Analysis](docs/guides/07_AI_Grounded_Architecture_Analysis.md)** ⭐ — Zero-hallucination analysis
- **[08 - Claude Code Integration](docs/guides/08_Claude_CLI_Integration.md)** 🤖 — TUI details
- **[09 - Mission Concept Extraction](docs/guides/09_Mission_Concept_Extraction.md)** — Strategic alignment
- **[10 - Mission Security Validation](docs/guides/10_Mission_Security_Validation.md)** — Security validation
- **[11 - Internal Architecture](docs/guides/11_Internal_Architecture.md)** 🏗️ — System internals

### Architecture Documentation

- **[Comprehensive Analysis](docs/architecture/COMPREHENSIVE_ANALYSIS.md)** 📊 — Complete system analysis and metrics
- **[SIGMA Architecture](docs/sigma/ARCHITECTURE.md)** ⭐ — Official Σ architecture document
- **[Session Boundary Rationale](docs/sigma/SESSION_BOUNDARY_RATIONALE.md)** — Design patterns and rationale
- **[Dual-Use Mandate](docs/guides/DUAL_USE_MANDATE.md)** — Security philosophy
- **[Operational Lattice](docs/guides/OPERATIONAL_LATTICE.md)** — O₅ workflows
- **[Vision Document](docs/guides/VISION.md)** — Project vision and goals

---

## 🎉 Latest Release

**v2.7.1 - March 1, 2026** — [Architectural Consolidation & Tool Robustness](https://github.com/mirzahusadzic/cogx/releases/tag/v2.7.1):

- 🔄 **Task State Recovery Protocol** — Implemented a critical self-correction mechanism to prevent agents from hanging on state violations.
- 📜 **SIGMA.md Grounding** — Introduced repository-level grounding for project-specific instructions (build/test loops, standards).
- 🛠️ **Enhanced File Tools** — Added `cwd` support for relative paths, `exclude` for globbing, and an `is_literal` flag for `grep`.
- 🧬 **Unified LLM Abstraction** — Major refactoring of LLM tools, database stores, and orchestrators removed boilerplate and improved consistency.

**v2.7.0 - February 26, 2026** — [Task Management Excellence & TUI Performance](https://github.com/mirzahusadzic/cogx/releases/tag/v2.7.0):

- ⛓️ **Task Management Excellence** — Implemented strict sequential task management and surgical context hygiene with ID-based merging.
- 📋 **SigmaTaskPanel Overhaul** — Improved task visibility (dimmed collapsed tasks), higher visibility limits, and cumulative session tracking.
- 🐚 **Shell Completion Expansion** — Full Bash, Zsh, and Fish completions for the `tui` command, including support for `--solo` and `--ctx-tools` flags.
- 📊 **Reactive TUI Feedback** — Real-time turn tracking and reactive token display for immediate cost and state visibility.

**v2.6.9 - February 25, 2026** — [SigmaTask Context Eviction & TUI Analytics](https://github.com/mirzahusadzic/cogx/releases/tag/v2.6.9):

- ✂️ **Surgical Eviction** — Task-aware tool log eviction across Gemini, OpenAI, and Minimax to significantly reduce context bloat and token usage.
- 🚀 **Provider Expansions** — Added experimental Minimax support, migrated to Gemini 3.0/3.1 defaults, and purged legacy 2.x EOL models.
- 📟 **CLI & Token Accuracy** — Introduced `--solo` mode for isolated execution and fixed TUI token counters to accurately track surgical drops.
- 🧹 **Infrastructure & Cleanup** — Bumped `@google/adk` to 0.3.0, preserved thought signatures during eviction.

**Impact:** Significantly reduces token waste and context bloat while optimizing for **implicit token caching** (achieving **80%+ hit rates** via surgical prefix stability). This ensures economic sustainability for agentic sessions by leveraging low-threshold (1,024 tokens) implicit caching.

**Previous releases:** [v2.6.7](https://github.com/mirzahusadzic/cogx/releases/tag/v2.6.7) | [v2.6.6](https://github.com/mirzahusadzic/cogx/releases/tag/v2.6.6) | [v2.6.5](https://github.com/mirzahusadzic/cogx/releases/tag/v2.6.5) | [v2.6.4](https://github.com/mirzahusadzic/cogx/releases/tag/v2.6.4) | [v2.6.3](https://github.com/mirzahusadzic/cogx/releases/tag/v2.6.3) | [v2.6.2](https://github.com/mirzahusadzic/cogx/releases/tag/v2.6.2) | [v2.6.0](https://github.com/mirzahusadzic/cogx/releases/tag/v2.6.0) | [v2.5.1](https://github.com/mirzahusadzic/cogx/releases/tag/v2.5.1) | [v2.5.0](https://github.com/mirzahusadzic/cogx/releases/tag/v2.5.0) | [v2.4.2](https://github.com/mirzahusadzic/cogx/releases/tag/v2.4.2) | [v2.0.0 - Σ Launch](https://github.com/mirzahusadzic/cogx/releases/tag/v2.0.0)

**Full changelog:** [CHANGELOG.md](./CHANGELOG.md)

---

## 🔬 Breakthroughs

### First Human-AI Grounded Collaboration (Oct 24, 2025)

**[AI-Grounded Architecture Analysis](docs/guides/07_AI_Grounded_Architecture_Analysis.md)**

- ✅ **Zero hallucinations** — Every claim backed by PGC data
- ✅ **100% reproducible** — Regenerate anytime
- ✅ **Meta-cognitive** — Cognition-cli analyzing itself
- ✅ **No source reading** — Reasoning from structured metadata alone

### Infinite Context via Dual-Lattice (Nov 3, 2025)

**[Interactive TUI with Σ System](./src/tui/README.md)**

- ✅ **Infinite context** — Agent never forgets across sessions
- ✅ **Dual-lattice Meet operations** — Project ∧ Conversation alignment
- ✅ **Intelligent compression** — Preserves project-relevant, discards noise
- ✅ **MCP memory tool** — `recall_past_conversation` for deep memory
- ✅ **Production tested** — 150K+ token sessions, zero context loss

### Manager/Worker Delegation (Dec 20, 2025)

**[Manager/Worker Delegation Architecture](docs/architecture/COMPREHENSIVE_ANALYSIS.md)**

- ✅ **Structured Delegation** — Explicit acceptance criteria for verifiable task completion
- ✅ **Stateful Task Management** — Stable task IDs across session restarts
- ✅ **Multi-Provider Support** — Unified delegation flow for Gemini, Claude, and OpenAI agents
- ✅ **Auto-Verification** — Automated status reporting from workers to managers

### Sigma Task Protocol v2.0 (Jan 16, 2026)

**[Verifiable Task Execution](docs/sigma/ARCHITECTURE.md)**

- ✅ **Structured Grounding** — Verifiable execution via `grounding` and `grounding_evidence` arrays
- ✅ **Tri-Modal Compression** — Proactive context management (Semantic, Standard, Survival)
- ✅ **Multi-Provider Optimization** — Unified TPM protection for Gemini, OpenAI, and eGemma
- ✅ **Reasoning-First Enforcement** — Agents plan complex operations before execution

---

## 🤝 Contributing

Contributions welcome! See **[CONTRIBUTING.md](../../CONTRIBUTING.md)** in the main repository.

---

## 📄 License & Prior Art

**License:** AGPL-v3 — See [LICENSE](../../LICENSE) file for details.

**NO WARRANTY. NO LIABILITY.** The entire risk as to quality and performance is with you.

### Defensive Publication

For the complete list of innovations (#1-47) protected as prior art and publication details, see:

👉 **[CogX README - Defensive Prior Art Publication](../../README.md#defensive-prior-art-publication)**

**Key innovations specific to this implementation:**

- Σ (Sigma) Dual-Lattice Architecture (#39)
- 7-Dimensional Conversation Overlays (#40)
- Intelligent Context Compression (#41)
- Session Lifecycle Management (#42)
- Interactive TUI with Real-Time Visualization (#46)
- Multi-Agent Collaborative System (#47)

**Publication DOI:** [10.5281/zenodo.18012832](https://doi.org/10.5281/zenodo.18012832)

---

## 📚 Citation

If you use this work in research, please cite:

```bibtex
@software{cognition_cli_2026,
  author = {Husadžić, Mirza},
  title = {Cognition Σ CLI: Seven-Overlay Knowledge Graph with Infinite Context},
  year = {2026},
  version = {2.7.1},
  doi = {10.5281/zenodo.18012832},
  url = {https://github.com/mirzahusadzic/cogx/tree/main/src/cognition-cli}
}
```

---

**Built with ❤️ for human-AI symbiosis**
