# Cognition CLI (`cognition-cli`)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.17489413.svg)](https://doi.org/10.5281/zenodo.17489413)

<div align="center" style="margin-top: 20px; margin-bottom: 20px;">
<img src="./docs/assets/cognition-cli-logo.png" alt="Cognition CLI Logo" width="512"/>
</div>

> **A cryptographically-grounded knowledge graph system with seven cognitive overlays for verifiable code understanding and mission alignment.**

The Cognition CLI is the reference implementation of the **Grounded Context Pool (PGC)**, a core component of the [CogX Architectural Blueprint](https://github.com/mirzahusadzic/cogx). It transforms unstructured code and documentation into a rich, queryable, verifiably-grounded knowledge graph with **seven specialized cognitive overlays** (O₁-O₇), enabling AI-powered development grounded in cryptographic truth, not statistical approximation.

---

## The Core Problem: AI's Superficial Code Understanding

Modern Large Language Models (LLMs) are powerful pattern-matchers, but they lack deep, verifiable understanding of a project's architecture and mission. They operate on limited "token windows" with no concept of:

- **Architectural Coherence**: The intricate dependency lattice defining real-world codebases
- **Mission Alignment**: Whether code actually serves the project's strategic goals
- **Security Implications**: Dual-use risks, vulnerabilities, and attack surfaces
- **Mathematical Guarantees**: Formal properties and invariants that must hold

This leads to:

- **High-Confidence Hallucinations**: Plausible but architecturally unsound code
- **Broken Refactoring**: Changes that break distant, unseen dependencies
- **Mission Drift**: Features that violate project values or introduce dual-use risks
- **Lack of Provable Guarantees**: No formal verification of critical properties

**The Cognition CLI solves this through the PGC: a persistent, stateful "second brain" with seven cognitive overlays, each providing a different lens for understanding your project.**

---

## The Seven-Overlay Architecture

The PGC is not just a dependency graph - it's a **multi-dimensional knowledge lattice** with seven specialized overlays:

| Overlay | Name         | Purpose                         | Key Capabilities                                                |
| :------ | :----------- | :------------------------------ | :-------------------------------------------------------------- |
| **O₁**  | Structural   | AST-based code structure        | Symbols, dependencies, architectural roles, pattern matching    |
| **O₂**  | Security     | Vulnerability & threat analysis | Attack surface mapping, dual-use detection, security guidelines |
| **O₃**  | Lineage      | Provenance & history            | Git integration, authorship, version tracking, change analysis  |
| **O₄**  | Mission      | Strategic alignment             | Concept extraction, mission coherence, value alignment scoring  |
| **O₅**  | Operational  | Workflow intelligence           | Quest patterns, operational procedures, development workflows   |
| **O₆**  | Mathematical | Formal properties               | Proofs, invariants, theorems, formal verification               |
| **O₇**  | Coherence    | Cross-overlay synthesis         | Mission-code alignment, consistency checking, drift detection   |

Each overlay is **content-addressed**, **cryptographically grounded**, and **independently verifiable**. They form a queryable lattice where overlays can interact via Boolean algebra operations (∩, ∪, ¬, Δ).

---

## The PGC: Four Pillars of Truth

The PGC is built on four foundational pillars stored in `.open_cognition/`:

| Pillar           | Directory       | Role & Analogy                                                                                    |
| :--------------- | :-------------- | :------------------------------------------------------------------------------------------------ |
| **Objects**      | `objects/`      | **The Library of Truth.** Content-addressable store (like Git) for immutable, deduplicated data.  |
| **Transforms**   | `transforms/`   | **The Unforgettable History.** Append-only audit trail of every operation with fidelity scores.   |
| **Index**        | `index/`        | **The Table of Contents.** Human-readable map from paths to current content hashes.               |
| **Reverse Deps** | `reverse_deps/` | **The Nervous System.** O(1) reverse-lookup for instant dependency traversal and impact analysis. |

**Additional Subsystems:**

| Directory            | Purpose                                                            |
| :------------------- | :----------------------------------------------------------------- |
| `overlays/`          | Seven specialized analytical layers (O₁-O₇) with vector embeddings |
| `security/`          | Transparency logs (JSONL audit trail of all mission loads)         |
| `mission_integrity/` | Mission drift alerts, validation logs                              |

---

## Fidelity Labeling: Transparent Uncertainty

Every transform in the PGC carries a **fidelity score** representing certainty:

- **1.0** - AST parsing (deterministic, perfect fidelity)
- **0.85** - SLM extraction (small language model, high confidence)
- **0.70** - LLM analysis (large language model, lower certainty)

**No hallucinations are tolerated in high-fidelity data.** The system makes uncertainty transparent rather than hiding it.

---

## Key Workflows

### 1. Code Analysis (O₁ Structural)

```bash
# Initialize PGC
cognition-cli init

# Build structural knowledge graph
cognition-cli genesis src/

# Generate structural overlay
cognition-cli overlay generate structural_patterns

# Find similar patterns
cognition-cli patterns find-similar App

# Analyze blast radius
cognition-cli blast-radius PGCManager
```

### 2. Documentation & Mission Alignment (O₄, O₇)

```bash
# Ingest mission documents
cognition-cli genesis:docs docs/

# Extract mission concepts
cognition-cli concepts list

# Check mission coherence
cognition-cli coherence check
```

### 3. Security Analysis (O₂)

```bash
# Generate security overlay
cognition-cli overlay generate security_guidelines

# Check for security issues
cognition-cli security threats

# View security coherence
cognition-cli security coherence
```

### 4. Real-Time Synchronization (The Three Monuments)

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

## Command Reference

| Command                                 | Description                                     | Key Operations                                        |
| :-------------------------------------- | :---------------------------------------------- | :---------------------------------------------------- |
| `cognition-cli init`                    | Initialize PGC structure                        | Create directories, metadata, .gitignore              |
| `cognition-cli genesis [path]`          | Build code knowledge graph                      | AST parsing, hashing, transform logging               |
| `cognition-cli genesis:docs [path]`     | Ingest documentation                            | Markdown parsing, concept extraction, mission overlay |
| `cognition-cli watch`                   | **Monument 1**: Real-time file monitoring       | Hash-based change detection, dirty state tracking     |
| `cognition-cli status`                  | **Monument 2**: Instant coherence check (<10ms) | Blast radius calculation, impact analysis             |
| `cognition-cli update`                  | **Monument 3**: Incremental sync                | Process dirty files, oracle verification              |
| `cognition-cli overlay generate <type>` | Generate analytical overlays                    | Symbol extraction, embeddings, vector storage         |
| `cognition-cli patterns <command>`      | Structural pattern operations                   | find-similar, compare, analyze, inspect               |
| `cognition-cli concepts <command>`      | Mission concept operations                      | list, search, align                                   |
| `cognition-cli coherence <command>`     | Mission-code coherence                          | check, score, drift detection                         |
| `cognition-cli security <command>`      | Security analysis                               | threats, coherence, guidelines                        |
| `cognition-cli query <question>`        | Graph traversal                                 | Index lookup, dependency traversal                    |
| `cognition-cli audit <command>`         | PGC integrity verification                      | Transform history, hash verification                  |

---

## Security & Transparency

### Dual-Use Technology Acknowledgment

Cognition-cli implements **measurement infrastructure** for semantic alignment. Like any measurement tool, it can be used for:

- ✅ **Guidance**: Helping developers align with project values
- ⚠️ **Enforcement**: Ideological conformity checking

**The tool does not make ethical judgments.** You control:

- Which workbench to use (`WORKBENCH_URL`)
- Which models to use (defaults: `gemini-2.5-flash`, `gemini-2.0-flash-thinking`)
- Security mode: `off`, `advisory`, or `strict`

### Transparency Logging

All mission operations are logged to `.open_cognition/security/transparency.jsonl`:

```jsonl
{
  "timestamp": "2025-10-31T15:30:48.612Z",
  "action": "mission_loaded",
  "user": "username",
  "mission_title": "Operational Lattice",
  "mission_source": "docs/overlays/O5_operational/OPERATIONAL_LATTICE.md",
  "concepts_count": 8,
  "mission_hash": "d1d302..."
}
```

**Logs are local and under your control.** Disabling logging is visible in forks.

---

## Getting Started

### Prerequisites

- **Node.js** v20.x or later
- **Workbench Server** (optional, for embeddings): [eGemma Project](https://github.com/mirzahusadzic/egemma)

### Installation

```bash
cd src/cognition-cli
npm install
npm run build
npm link  # For global access
```

### Quick Start

```bash
# Navigate to your project
cd /path/to/your/project

# Initialize PGC
cognition-cli init

# Build structural knowledge
cognition-cli genesis src/

# Ingest documentation
cognition-cli genesis:docs docs/

# Generate overlays
cognition-cli overlay generate structural_patterns
cognition-cli overlay generate lineage_patterns

# Check mission alignment
cognition-cli coherence check

# Start watching for changes
cognition-cli watch
```

---

## Architecture Highlights

### The Four Pillars + Seven Overlays

```
.open_cognition/
├── objects/              # Content-addressable immutable storage
├── transforms/           # Append-only operation audit trail
├── index/                # Path → hash mappings
├── reverse_deps/         # O(1) dependency lookup
├── overlays/
│   ├── structural_patterns/       # O₁: AST, symbols, roles
│   ├── security_guidelines/       # O₂: Threats, vulnerabilities
│   ├── lineage_patterns/          # O₃: Git history, provenance
│   ├── mission_concepts/          # O₄: Strategic concepts
│   ├── operational_patterns/      # O₅: Workflows, procedures
│   ├── mathematical_proofs/       # O₆: Formal properties
│   └── strategic_coherence/       # O₇: Cross-overlay synthesis
├── security/
│   └── transparency.jsonl         # Audit trail
└── mission_integrity/
    └── alerts.log                 # Mission drift warnings
```

### Cryptographic Grounding

- **SHA-256 content addressing** for all objects
- **Merkle-tree-like structure** via transform logs
- **Fidelity labeling** for transparent uncertainty
- **Oracle validation** at every stage

---

## Documentation

📖 **[Complete Documentation Site](https://mirzahusadzic.github.io/cogx/)** — Full manual with 16 chapters covering cognitive architecture, 7 overlays, and lattice algebra

### Foundation Manual

The comprehensive 16-chapter manual organized by parts:

- **Part I: Foundation** — Cognitive architecture, PGC, overlays, embeddings, core security (7+ Gemini personas)
- **Part II: The Seven Overlays** — O₁ through O₇ (structural, security, lineage, mission, operational, mathematical, coherence)
- **Part III: The Algebra** — Boolean operations and query syntax for multi-overlay reasoning

[📚 Read the Manual](https://mirzahusadzic.github.io/cogx/manual/part-1-foundation/01-cognitive-architecture)

### Official Guides

- [00 - Introduction to Cognition CLI](./docs/00_Introduction.md)
- [01 - Structural Analysis](./docs/01_Structural_Analysis.md)
- [02 - Core Infrastructure (PGC)](./docs/02_Core_Infrastructure.md)
- [03 - Commands Reference](./docs/03_Commands.md)
- [04 - Miners and Executors](./docs/04_Miners_and_Executors.md)
- [05 - Verification and Oracles](./docs/05_Verification_and_Oracles.md)
- [06 - Testing and Deployment](./docs/06_Testing_and_Deployment.md)
- [07 - AI-Grounded Architecture Analysis](./docs/07_AI_Grounded_Architecture_Analysis.md) ⭐
- [08 - Claude Code Integration](./docs/08_Claude_CLI_Integration.md) 🤖
- [09 - Mission Concept Extraction](./docs/09_Mission_Concept_Extraction.md)
- [10 - Mission Security Validation](./docs/10_Mission_Security_Validation.md)

### Additional Resources

- [Manual: Complete 900+ Page Guide](./docs/manual/README.md)
- [Dual-Use Mandate](./docs/DUAL_USE_MANDATE.md)
- [Operational Lattice](./docs/overlays/O5_operational/OPERATIONAL_LATTICE.md)

---

## 🎉 Breakthroughs

### First Human-AI Grounded Collaboration

**[AI-Grounded Architecture Analysis](./docs/07_AI_Grounded_Architecture_Analysis.md)**

- ✅ **Zero hallucinations** - every claim backed by PGC data
- ✅ **100% reproducible** - regenerate anytime
- ✅ **Meta-cognitive** - cognition-cli analyzing itself
- ✅ **No source reading** - reasoning from structured metadata alone

### Seven-Overlay Lattice System

Complete implementation of the multi-overlay architecture from CogX blueprint, enabling:

- **Mission alignment scoring** between code and strategic documents
- **Security threat modeling** and attack surface analysis
- **Formal verification** support via mathematical overlay
- **Cross-overlay coherence** checking

---

## Research & Contributions

This project serves as a research platform for **verifiable AI-assisted development**. The PGC architecture enables:

- **Cryptographically-grounded AI assistance** - no hallucinations
- **Mission-aligned development** - code that serves project values
- **Multi-dimensional reasoning** - seven cognitive lenses on every change
- **True symbiotic AI** - human creativity + AI insight, both grounded in truth

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) and the [main CogX repository](https://github.com/mirzahusadzic/cogx).

---

## License

AGPL-v3 - See LICENSE file for details.

**NO WARRANTY. NO LIABILITY.** The entire risk as to quality and performance is with you.

---

## Citation

If you use this work in research, please cite:

```bibtex
@software{cognition_cli_2025,
  author = {Husadžić, Mirza},
  title = {Cognition CLI: A Seven-Overlay Knowledge Graph for Verifiable Code Understanding},
  year = {2025},
  doi = {10.5281/zenodo.17489413},
  url = {https://github.com/mirzahusadzic/cogx}
}
```
