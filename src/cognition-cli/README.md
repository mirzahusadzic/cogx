# Cognition CLI (`cognition-cli`)

<div align="center" style="margin-top: 20px; margin-bottom: 20px;">
<img src="./docs/assets/cognition-cli-logo.png" alt="Cognition CLI Logo" width="512"/>
</div>

> **A tool for building a verifiable, content-addressable knowledge graph of your codebase.**

The Cognition CLI is the reference implementation of the **Grounded Context Pool (PGC)**, a core component of the [CogX Architectural Blueprint](https://github.com/mirzahusadzic/cogx). It transforms unstructured source code into a rich, queryable, and verifiably-grounded knowledge graph, enabling a new generation of AI-powered developer tools and workflows.

It is designed to augment human intelligence by providing a deep, structural, and semantic understanding of a codebase, ensuring that any AI interaction is grounded in verifiable truth, not statistical approximation.

---

## The Core Problem: AI's Superficial Code Understanding

Modern Large Language Models (LLMs) are powerful pattern-matchers, but they lack a deep, verifiable understanding of a project's architecture. They operate on a limited "token window" and have no concept of the intricate dependency lattice that defines a real-world codebase. This leads to:

- **High-Confidence Hallucinations:** Generating code that looks plausible but is architecturally unsound.
- **Broken Refactoring:** Suggesting changes that break distant, unseen dependencies.
- **Lack of Strategic Insight:** Inability to reason about the system-level impact of a change.

**The Cognition CLI solves this by building the PGC: a persistent, stateful "second brain" for your project that is grounded in cryptographic truth.**

## The PGC Architecture at a Glance

The `cognition-cli` is the engine that builds and maintains the PGC. The PGC itself is a set of simple, transparent structures stored in a `.open_cognition` directory at the root of your project.

| Component         | Directory       | Role & Analogy                                                                                                                                  |
| :---------------- | :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Object Store**  | `objects/`      | **The Library of Truth.** A content-addressable store (like Git's) for every unique piece of data (code, ASTs). Immutable and deduplicated.     |
| **Transform Log** | `transforms/`   | **The Unforgettable History.** An immutable, append-only log of every operation, recording how knowledge was created. The system's audit trail. |
| **Index**         | `index/`        | **The Table of Contents.** A human-readable map from file paths to their current, valid content hashes in the Object Store.                     |
| **Reverse Deps**  | `reverse_deps/` | **The Nervous System.** An O(1) reverse-lookup index that makes dependency traversal and impact analysis instantaneous.                         |
| **Overlays**      | `overlays/`     | **The Specialized Senses.** Layers of analytical data (like structural patterns and lineages) that enrich the core knowledge graph.             |

---

## Key Features & Commands

The CLI provides a suite of tools to manage the PGC lifecycle.

| Command                                              | Description                                                                                                                                                                                                                                         | Key Operations                                                                                    |
| :--------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| `cognition-cli init`                                 | **Initializes the PGC.** Creates the `.open_cognition` directory and its core structure, preparing your project for analysis.                                                                                                                       | Create directories, generate metadata, `.gitignore`.                                              |
| `cognition-cli genesis [sourcePath]`                 | **Builds the Knowledge Graph.** Populates the PGC by parsing all source files, creating the verifiable "skeleton" of your project's structure.                                                                                                      | File discovery, AST parsing, content hashing, `TransformLog` creation, verification.              |
| `cognition-cli watch`                                | **🗼 Monument 1: Event Source.** Monitors file changes in real-time and maintains `dirty_state.json`. Foundation for incremental updates and multi-agent coordination.                                                                              | Real-time file watching, hash-based change detection, dirty state ledger.                         |
| `cognition-cli status`                               | **👁️ Monument 2: Instant Coherence Check.** Shows if PGC matches code in < 10ms. Calculates blast radius and optimizes commits.                                                                                                                     | Read dirty_state, calculate impact, show affected symbols, exit codes for CI/CD.                  |
| `cognition-cli update`                               | **🌱 Monument 3: Incremental Sync.** Heals PGC by re-processing only changed files. Implements the Update Function (U) from CogX blueprint.                                                                                                         | Process dirty files, update objects/transforms/index, Oracle verification, clear dirty_state.     |
| `cognition-cli guide [topic]`                        | **📚 Living Documentation.** Shows colorful, candid guides for commands - baked into the tool itself. Run `cognition-cli guide` to see all available topics.                                                                                        | Markdown rendering, command examples, architectural explanations, pro tips.                       |
| `cognition-cli overlay generate <type>`              | **Adds Analytical Layers.** Generates specialized overlays (`structural_patterns` or `lineage_patterns`), enriching the PGC with deeper semantic and relational insights. Supports `--force` for regeneration and `--skip-gc` for branch switching. | Symbol extraction, signature generation, vector embedding, `LanceDB` storage, garbage collection. |
| `cognition-cli patterns find-similar <symbol>`       | **Find Similar Patterns.** Uses vector similarity to find code that is structurally similar to a given symbol.                                                                                                                                      | Vector similarity search, architectural role matching.                                            |
| `cognition-cli patterns compare <symbol1> <symbol2>` | **Compare Patterns.** Compares the structural signatures and dependencies of two symbols.                                                                                                                                                           | Cosine similarity, signature comparison, architectural analysis.                                  |
| `cognition-cli patterns analyze`                     | **Analyze Architecture.** Provides distribution of architectural roles across the codebase.                                                                                                                                                         | Role aggregation, pattern statistics.                                                             |
| `cognition-cli query <question>`                     | **Traverses the Graph.** Searches for symbols and traces their dependency lineage through the PGC. Supports `--depth` and `--lineage` flags.                                                                                                        | Index lookup, structural data retrieval, recursive dependency traversal.                          |
| `cognition-cli audit:transformations <filePath>`     | **Verifies PGC Integrity.** Audits the transformation history of any file, ensuring the chain of provenance is unbroken and all data is coherent.                                                                                                   | History review, hash verification, integrity checks.                                              |

---

## Getting Started

### Prerequisites

- Node.js (v20.x or later)
- For advanced multi-language parsing, the `eGemma` server must be running. ([Project Repository](https://github.com/mirzahusadzic/egemma))

### Build and Run

1. **Navigate to the CLI directory:**

   ```bash
   cd src/cognition-cli
   ```text

2. **Install dependencies:**

   ```bash
   npm install
   ```text

3. **Build the project:**

   ```bash
   npm run build
   ```text

4. **Link for global access (recommended for development):**

   ```bash
   npm link
   ```text

### Example Workflow

1. **Initialize the PGC in your project:**

   ```bash
   cd /path/to/your/project
   cognition-cli init
   ```text

2. **Run the Genesis process to build the foundational knowledge:**

   ```bash
   cognition-cli genesis src/
   ```text

3. **Generate the structural and lineage pattern overlays:**

   ```bash
   cognition-cli overlay generate structural_patterns
   cognition-cli overlay generate lineage_patterns
   ```text

4. **Explore your codebase in a new way:**

   ```bash
   # List all structural patterns and their roles
   cognition-cli patterns list

   # Analyze architectural distribution
   cognition-cli patterns analyze --verbose

   # Inspect a specific symbol
   cognition-cli patterns inspect PGCManager

   # Visualize dependency tree
   cognition-cli patterns graph WorkbenchClient

   # Analyze blast radius (impact of changes)
   cognition-cli blast-radius PGCManager

   # Find code that is structurally similar
   cognition-cli patterns find-similar App

   # Compare two components
   cognition-cli patterns compare UserManager OrderManager

   # Trace dependency lineage
   cognition-cli query handleRequest --lineage --depth 3
   ```text

5. **Keep PGC synchronized with code changes (Monument 1-3):**

   ```bash
   # Terminal 1: Start the file watcher (run in background)
   cognition-cli watch

   # Terminal 2: Make changes to your code
   # Edit files as usual...

   # Terminal 2: Check coherence status (< 10ms)
   cognition-cli status

   # Output:
   # 🎐 PGC Status: INCOHERENT
   # Modified files: 3, Impacted symbols: 12

   # Terminal 2: Update PGC incrementally
   cognition-cli update

   # Terminal 2: Verify coherence
   cognition-cli status
   # 🔔 PGC Status: COHERENT
   ```text

   **The Complete Feedback Loop:**

   ```text
   watch → dirty_state.json → status → update → coherence restored ♻️
   ```text

   This is the **operational implementation** of the event-driven architecture from CogX. The PGC now has a reflexive nervous system - it detects changes and heals automatically!

---

## 🎉 First Human-AI Grounded Collaboration

**We did it!** The first architecture analysis generated through pure grounded AI reasoning:

📄 **[AI-Grounded Architecture Analysis](./docs/07_AI_Grounded_Architecture_Analysis.md)**

This document represents a breakthrough in AI-assisted development:

- ✅ **Zero hallucinations** - every claim backed by PGC data
- ✅ **100% reproducible** - regenerate anytime with same commands
- ✅ **Meta-cognitive** - cognition-cli analyzing itself using its own tools
- ✅ **No source reading** - AI reasoned about architecture from structured metadata alone

**The methodology**: Run `cognition-cli patterns analyze` and `cognition-cli blast-radius` on key components, synthesize the JSON output into architectural insights. No source files opened during analysis phase.

**This is the future**: Human creativity guided by AI insight, both grounded in verifiable truth.

---

## Table of Contents (Official Documentation)

- [00 - Introduction to Cognition CLI](./docs/00_Introduction.md)
- [01 - Structural Analysis: Mapping the Codebase](./docs/01_Structural_Analysis.md)
- [02 - Core Infrastructure: The Grounded Context Pool (PGC)](./docs/02_Core_Infrastructure.md)
- [03 - Commands: Interacting with the Cognition CLI](./docs/03_Commands.md)
- [04 - Miners and Executors: Extracting and Processing Knowledge](./docs/04_Miners_and_Executors.md)
- [05 - Verification and Oracles: Ensuring PGC Integrity](./docs/05_Verification_and_Oracles.md)
- [06 - Testing and Deployment](./docs/06_Testing_and_Deployment.md)
- [07 - AI-Grounded Architecture Analysis](./docs/07_AI_Grounded_Architecture_Analysis.md) ⭐ **First Human-AI Grounded Collaboration**

## Research & Collaboration

This project serves as a research platform for a new generation of AI development tools. The PGC architecture enables novel approaches to:

- **Verifiable AI Code Assistance**: Grounding AI responses in a source of cryptographic truth.
- **Architectural Reasoning**: Enabling AI agents to reason about code at a system-wide level.
- **True Symbiotic AI**: Fostering a partnership where the AI helps the human understand their own code, and the human verifies the AI's understanding.

Contributions to this research and the tool's development are welcome. Please refer to the [main CogX repository](https://github.com/mirzahusadzic/cogx) for the overarching architectural blueprint.
