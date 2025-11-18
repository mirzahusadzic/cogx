---
type: operational
overlay: O5_Operational
status: complete
---

# Quick Start: 10 Minutes to First Query

> **"Show me the code. Show me the query. Get started in 10 minutes."**

This guide gets you from zero to querying your codebase in under 10 minutes.

---

## Prerequisites (2 minutes)

**Required**:

- Node.js 25+ (`node --version`)
- Git repository with source code
- Docker (for eGemma workbench)

**Optional**:

- npm/yarn for global install

---

## Setup (5 minutes)

### 1. Install Cognition CLI

```bash
# Option 1: Global install (recommended)
npm install -g cognition-cli

# Option 2: npx (no install)
npx cognition-cli --version
```

Verify installation:

```bash
cognition-cli --version
# Output: 2.3.2 (Infinite Context with Continuity)
```

### 2. Start eGemma Workbench

```bash
# In your project directory:
docker compose up -d

# Verify it's running:
curl http://localhost:8000/health
# Output: {"status":"ok"}
```

**No docker-compose.yml?** Download the starter:

```bash
curl -O https://raw.githubusercontent.com/mirzahusadzic/cogx/main/docker-compose.yml
docker compose up -d
```

### 3. Run the Wizard

```bash
cognition-cli wizard
```

**Interactive prompts**:

1. **Source directory**: Enter `src/` (or your source path)
2. **Ingest documentation**: Choose `Yes`
3. **Overlays to generate**: Select all (recommended) or minimum: O₁, O₄, O₇

**What happens**:

- ✅ Creates `.open_cognition/` directory (PGC)
- ✅ Analyzes source code (genesis)
- ✅ Ingests documentation (genesis:docs)
- ✅ Generates overlays (O₁-O₇)

**Time**: 3-5 minutes for small-medium codebase

---

## First Queries (3 minutes)

### Query 1: Ask About Documentation

```bash
cognition-cli ask "what is the main purpose of this project"
```

**Output**:

```
🤔 Question: what is the main purpose of this project

Answer:

This project creates verifiable AI-human symbiosis through
a dual-lattice cognitive architecture...

Sources:
  1. [89.2% match] O4 — VISION.md
  2. [76.5% match] O4 — README.md
```

### Query 2: Find Security Coverage Gaps

```bash
cognition-cli lattice "O1 - O2"
```

**Output**:

```
Code Symbols NOT Covered by Security:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function:processPayment (src/payments.ts:45)
function:handleUserInput (src/input.ts:12)
class:AdminController (src/admin.ts:67)

Total: 23 uncovered symbols
```

**Insight**: These functions need security documentation!

### Query 3: Check Mission Alignment

```bash
cognition-cli coherence aligned --limit 10
```

**Output**:

```
High-Aligned Symbols (≥70%):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. MissionValidator (src/core/mission/validator.ts)
   Coherence: 87.3%
   Top concepts: verifiable_alignment, mission_integrity

2. SecurityGuard (src/core/security/guard.ts)
   Coherence: 84.1%
   Top concepts: boundary_enforcement, attack_prevention

...
```

### Query 4: Find Similar Patterns

```bash
cognition-cli patterns find-similar "MissionValidator" --top-k 5
```

**Output**:

```
🔍 Structural patterns similar to MissionValidator:

1. IntegrityValidator [validator]
   📁 src/core/security/integrity.ts
   ████████████████ 91.2%
   Validates data integrity and checksums

2. CoherenceValidator [validator]
   📁 src/core/coherence/validator.ts
   ██████████████ 85.7%
   Validates coherence across overlays

...
```

---

## What Just Happened?

You now have a **queryable knowledge lattice** of your codebase:

```
Your Codebase
      ↓
  [genesis]  ← Extracted structure, embeddings
      ↓
  .open_cognition/ (PGC)
      ├── O₁ Structure: Code symbols, functions, classes
      ├── O₂ Security: Threats, boundaries, mitigations
      ├── O₃ Lineage: Dependencies, call chains
      ├── O₄ Mission: Vision, principles, goals
      ├── O₅ Operational: Workflows, patterns
      ├── O₆ Mathematical: Theorems, proofs
      └── O₇ Coherence: Alignment scores
      ↓
  [lattice algebra]  ← Query relationships
      ↓
  Insights: gaps, alignment, patterns
```

---

## Continuous Workflow (Optional)

**Development mode** (keeps PGC in sync):

```bash
# Terminal 1: Watch for file changes
cognition-cli watch

# Terminal 2: Make code changes...
vim src/core/mission/validator.ts

# Terminal 2: Check coherence
cognition-cli status

# Terminal 2: Sync PGC
cognition-cli update
```

**Benefits**:

- **Fast updates**: Only processes changed files (seconds vs minutes)
- **Always coherent**: PGC stays in sync with code
- **CI/CD ready**: Use `status` exit codes in scripts

---

## Next Steps

### Learn the CLI

- **[Chapter 5: CLI Operations](../part-1-foundation/05-cli-operations.md)** — Complete command reference (25+ commands)
- **[Contextual Help](../part-1-foundation/05-cli-operations.md#guide--contextual-help)** — Run `cognition-cli guide` for in-CLI help

### Understand the Architecture

- **[Chapter 1: Cognitive Architecture](../part-1-foundation/01-cognitive-architecture.md)** — Why overlays exist
- **[Chapter 2: The PGC](../part-1-foundation/02-the-pgc.md)** — How knowledge is stored
- **[Chapter 3: Why Overlays?](../part-1-foundation/03-why-overlays.md)** — Separation of concerns

### Master the Algebra

- **[Chapter 12: Boolean Operations](../part-3-algebra/12-boolean-operations.md)** — Meet, Union, Difference
- **[Chapter 13: Query Syntax](../part-3-algebra/13-query-syntax.md)** — Parser and operators
- **[Chapter 14: Set Operations](../part-3-algebra/14-set-operations.md)** — Symbol algebra

### Advanced Topics

- **[Chapter 21: Σ (Sigma) Architecture](../part-6-sigma/21-sigma-architecture.md)** — Infinite context via dual-lattice
- **[Interactive TUI](../part-1-foundation/05-cli-operations.md#tui--interactive-terminal)** — Converse with Claude about your code

---

## Troubleshooting

### "PGC not initialized"

```bash
# Run wizard or manual init:
cognition-cli init
cognition-cli genesis src/
```

### "Workbench not running"

```bash
# Check Docker:
docker compose ps

# Restart workbench:
docker compose restart

# Check logs:
docker compose logs -f
```

### "Out of memory during genesis"

```bash
# Increase Node.js heap:
NODE_OPTIONS=--max-old-space-size=8192 cognition-cli wizard
```

### "No results from queries"

```bash
# Check overlays are generated:
cognition-cli overlay list

# Generate missing overlays:
cognition-cli overlay generate mission_concepts
cognition-cli overlay generate security_guidelines
```

---

## Common Queries Cheat Sheet

```bash
# Coverage gaps
cognition-cli lattice "O1 - O2"                    # Code without security docs

# Mission alignment
cognition-cli security attacks                     # Attacks vs principles
cognition-cli coherence aligned                    # High-aligned code

# Dependency analysis
cognition-cli blast-radius <symbol>                # Impact of changing symbol
cognition-cli patterns graph <symbol>              # Dependency tree

# Pattern discovery
cognition-cli patterns find-similar <symbol>       # Similar patterns
cognition-cli patterns analyze                     # Architectural overview

# Workflow analysis
cognition-cli workflow patterns --secure           # Security-aligned workflows
cognition-cli workflow patterns --aligned          # Mission-aligned workflows

# Mission concepts
cognition-cli concepts top 20                      # Top 20 mission concepts
cognition-cli concepts search "security"           # Find security concepts

# Ask anything
cognition-cli ask "how does X work"                # Semantic Q&A
cognition-cli ask "what is the purpose of Y"       # Documentation questions
```

---

## Get Help

- **In-CLI help**: `cognition-cli guide`
- **Command reference**: `cognition-cli <command> --help`
- **Full manual**: [The Lattice Book](../README.md)
- **Issues**: <https://github.com/mirzahusadzic/cogx/issues>

---

**Congratulations!** You've built a queryable knowledge lattice in under 10 minutes. Now go explore your codebase using lattice algebra. 🎉
