# Cognition CLI - Quick Reference Guide

## What Is It?

**Cognition CLI** = AI-powered code understanding tool that builds a verifiable "digital brain" of your codebase using cryptographically-grounded knowledge graphs.

## Problem It Solves

LLMs hallucinate, miss dependencies, and can't reason about system-level impacts. Cognition CLI grounds them in cryptographic truth.

## The 4 Pillars (Your Digital Brain)

```
.open_cognition/
├── objects/       → Immutable Knowledge (content-addressed with SHA-256)
├── transforms/    → Audit Trail (how knowledge was created)
├── index/         → Table of Contents (file paths to hashes)
└── reverse_deps/  → Nervous System (dependency relationships)
```

## The 7 Cognitive Overlays

| Layer            | ID  | What It Analyzes                       |
| ---------------- | --- | -------------------------------------- |
| **Structural**   | O₁  | Code structure, functions, classes     |
| **Security**     | O₂  | Threats, attack vectors, mitigations   |
| **Lineage**      | O₃  | Dependencies, imports, call chains     |
| **Mission**      | O₄  | Project principles, strategic concepts |
| **Operational**  | O₅  | Workflows, processes, patterns         |
| **Mathematical** | O₆  | Formal proofs, theorems                |
| **Coherence**    | O₇  | Alignment metrics, drift detection     |

## Essential Commands

### Initialize & Build Knowledge

```bash
cognition-cli init                    # Create .open_cognition
cognition-cli genesis src/            # Parse all files → knowledge graph
```

### Real-Time Synchronization (3 Monuments)

```bash
cognition-cli watch                   # Monitor changes → dirty_state.json
cognition-cli status                  # Check coherence (< 10ms)
cognition-cli update                  # Heal incremental changes
```

### Analyze Patterns

```bash
cognition-cli patterns find-similar UserManager           # Find similar code
cognition-cli patterns analyze                           # Show architectural roles
cognition-cli blast-radius UpdateService                 # Impact analysis
```

### Advanced Queries

```bash
cognition-cli query handleRequest --lineage --depth 3    # Trace dependencies
cognition-cli lattice "O1 & O4"                          # Boolean operations
cognition-cli coherence analyze                          # Mission alignment
```

### Audit & Verify

```bash
cognition-cli audit:transformations src/core/pgc.ts      # Verify history
audit:docs                                               # Validate integrity
```

## The Philosophy in 5 Points

1. **Verifiable Truth** - Cryptographically grounded, not guesses
2. **Layered Extraction** - AST parsing first, fallback to AI models
3. **Fidelity Labeling** - Every fact labeled with confidence score
4. **Transparent Auditing** - Complete transformation history
5. **Human-AI Symbiosis** - AI assists humans, humans verify AI

## Technology Stack

- **Language:** TypeScript 5.3
- **Runtime:** Node.js 20+
- **CLI Framework:** Commander.js
- **Vector DB:** LanceDB (768-dimensional embeddings)
- **External:** eGemma workbench (for advanced parsing)
- **Key Libraries:** Zod, Chokidar, Chalk, Workerpool

## How It Works: The 3-Monument Pattern

```
┌─────────────────────────────────────────────────┐
│ Monument 1: WATCH (Event Source)                │
│ Detects file changes → dirty_state.json         │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│ Monument 2: STATUS (Coherence Check)            │
│ Is PGC coherent? (< 10ms) → exit codes          │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│ Monument 3: UPDATE (Incremental Healing)        │
│ Reprocess changed files, sync PGC               │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
           COHERENT AGAIN ✓
```

## Key Data Structures

### In `.open_cognition/objects/`

```json
{
  "name": "UserManager",
  "type": "class",
  "methods": ["authenticate", "authorize"],
  "dependencies": ["Database", "Logger"],
  "fidelity": 1.0,
  "extraction_method": "ast_native"
}
```

### In `.open_cognition/index/`

```json
{
  "path": "src/core/users/manager.ts",
  "currentHash": "0d21c926b21f3ce4dc3deff151aa457090940b786d02b6f3209315024f2ebc42",
  "lastModified": "2025-10-31T00:31:00Z"
}
```

## Unique Capabilities

- **Vector Similarity** - Find architecturally similar code
- **Lattice Algebra** - Boolean operations across overlays (`O1 & O2 - O3`)
- **Self-Analysis** - CLI can analyze itself using its own tools
- **Dual-Use Awareness** - Explicitly documents weaponization risks
- **Cognitive Prosthetics** - Architecture extends to human memory preservation

## Statistics

- **28,281** lines of production TypeScript
- **7** cognitive overlays
- **6** supported languages (TS/JS/Python/Java/Rust/Go)
- **155** objects in the knowledge graph (on this repo)
- **85+** passing tests
- **25+** documentation pages

## What Makes It Different?

Most tools use LLMs blindly. Cognition CLI:

1. **Verifies everything** via cryptographic hashing
2. **Prioritizes deterministic methods** (AST parsing first)
3. **Labels uncertainty** with fidelity scores
4. **Provides audit trails** for every operation
5. **Enables human oversight** through transparent metrics
6. **Respects mission values** through drift detection
7. **Self-heals in real-time** via the Monument pattern

## Next Steps

1. **Try genesis:** `cognition-cli genesis src/` to build your knowledge graph
2. **Explore patterns:** `cognition-cli patterns analyze` to see architectural roles
3. **Set up monitoring:** `cognition-cli watch` + `cognition-cli status` in CI/CD
4. **Read the docs:** 25+ markdown files covering every aspect
5. **Understand the risk:** Read `DUAL_USE_MANDATE.md` before deployment

## Key Documents

- `README.md` - Overview and quick start
- `docs/02_Core_Infrastructure.md` - Deep dive into PGC
- `docs/04_Miners_and_Executors.md` - How extraction works
- `DUAL_USE_MANDATE.md` - Critical: dual-use acknowledgment
- `COGNITIVE_PROSTHETICS.md` - Vision for human memory preservation
- `docs/LATTICE_ALGEBRA.md` - Query language guide

---

**Version:** 1.7.5  
**Author:** Mirza Husadzic  
**License:** AGPL-3.0-or-later  
**Status:** Production-ready, actively maintained
