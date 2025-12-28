# PGC Tooling Best Practices for Agents

This guide defines the standard operating procedure (SOP) for agents using the `cognition-cli` PGC tools. Adhering to this protocol ensures grounded, verifiable, and hallucination-free responses.

## Core Philosophy: "Query, Don't Guess"

Agents often try to "read the code" to understand architecture. This is inefficient and error-prone for large codebases. Instead, use the **Grounded Context Pool (PGC)** tools which query pre-computed knowledge graphs.

**The Loop:**

1. **Discover**: Find relevant symbols (`patterns list`).
2. **Impact**: Measure change impact (`blast-radius`).
3. **Trace**: detailed lineage (`patterns graph`).

---

## 1. Blast Radius Analysis (`blast-radius`)

**Purpose**: Determine the "Splash Zone" of a change. Who breaks if I touch this?
**Key Flag**: `--json` (Mandatory for agents)

### Usage

```bash
cognition-cli blast-radius <symbol> --json
```

### Output Schema (JSON)

```json
{
  "symbol": "string",
  "metrics": {
    "totalImpacted": number, // <20 is low risk, >50 is high risk
    "maxConsumerDepth": number,
    "criticalPaths": [
      {
        "reason": "string",
        "path": ["SymbolA", "SymbolB"]
      }
    ]
  },
  "consumers": [ // Upstream (things that use this)
    {
      "symbol": "string",
      "filePath": "string",
      "role": "core|utility|integration|..."
    }
  ],
  "dependencies": [] // Downstream (things this needs)
}
```

### Best Practice

- **Always** check `totalImpacted` before proposing a refactor.
- If `totalImpacted > 20`, warn the user about high risk.
- Use `criticalPaths` to identify architectural bottlenecks.

---

## 2. Structural Discovery (`patterns`)

**Purpose**: Navigate the codebase semantically without reading every file.

### A. Listing Symbols

Find what exists.

```bash
cognition-cli patterns list --json
```

### B. Dependency Graph

Visualize the tree.

```bash
cognition-cli patterns graph <symbol> --json --max-depth 5
```

**Schema**:

```json
{
  "symbol": "string",
  "nodes": [{ "id": "string", "depth": number }],
  "edges": [{ "from": "string", "to": "string" }]
}
```

### C. Similarity Search

Find "prior art" or similar implementations.

```bash
cognition-cli patterns find-similar <symbol> --top-k 5 --json
```

---

## 3. The "Workbench Review" Workflow

When asked to "Review the Workbench implementation of X", follow this sequence:

1. **Search**: `cognition-cli patterns list | grep -i "Persona"`
   - _Result_: Found `PersonaManager`, `PersonaTemplate`.
2. **Inspect**: `cognition-cli patterns inspect PersonaManager`
   - _Result_: It's a "Core Service" in `src/services/personas.ts`.
3. **Trace**: `cognition-cli patterns graph PersonaManager --direction down --json`
   - _Result_: Depends on `FileSystem`, `VectorDB`.
4. **Impact**: `cognition-cli blast-radius PersonaManager --json`
   - _Result_: Used by `ChatEndpoint`, `SummarizeEndpoint`.

**Result**: A complete architectural map without reading 50 files.

---

## 4. Troubleshooting

- **"Symbol not found"**:
  - Did you run `cognition-cli overlay generate structural_patterns`?
  - Is the casing correct? (Symbols are case-sensitive).
  - Try `grep` to find the exact export name first.

- **"Impact 0"**:
  - Is this a new symbol?
  - Is it an unused export (dead code)?
