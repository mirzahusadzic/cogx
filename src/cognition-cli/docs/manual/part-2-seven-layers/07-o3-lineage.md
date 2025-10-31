---
type: operational
overlay: O3_Lineage
---

# Chapter 7: O₃ Lineage — Dependency Tracking

> "The threads—dependency chains that weave through code, revealing how changes ripple across the lattice."
>
> — The Shadow Architecture

**Part**: II — The Seven Layers<br/>
**Layer**: O₃ (Lineage)<br/>
**Role**: Dependency Tracking<br/>
**Knowledge Types**: 2 (dependency, lineage_chain)<br/>

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Dependency Layer](#2-the-dependency-layer)
3. [Core Concepts — Dependency, Chain, Blast Radius](#3-core-concepts--dependency-chain-blast-radius)
4. [Dependency Graph Structure](#4-dependency-graph-structure)
5. [Traversal Algorithms](#5-traversal-algorithms)
6. [Lineage Pattern Metadata](#6-lineage-pattern-metadata)
7. [Blast Radius Computation](#7-blast-radius-computation)
8. [Computational Proof of Work (cPOW)](#8-computational-proof-of-work-cpow)
9. [Use Cases — Safe Refactoring, Auditing, Dead Code](#9-use-cases--safe-refactoring-auditing-dead-code)
10. [Integration with Other Overlays](#10-integration-with-other-overlays)

---

## 1. Executive Summary

The **Lineage Patterns Overlay** (O₃) traces dependency relationships through your codebase, enabling impact analysis, blast radius computation, and transitive dependency tracking. It answers the critical question:

**"If I change this, what else breaks?"**

### Key Properties

**No LLM Required**: Extraction uses graph traversal and AST analysis (local, fast, deterministic).

**Directed Graph**: Dependencies form a directed acyclic graph (DAG) with 6 relationship types (IMPORT, EXTENDS, IMPLEMENTS, CALLS, REFERENCES, INJECTS).

**Bidirectional Traversal**: Forward lineage ("what does this depend on?") and reverse lineage ("what depends on this?").

**Blast Radius**: Compute the full impact of changes by traversing reverse dependencies to maximum depth.

**Worker-Based Parallelism**: 2-8 worker threads for optimal graph construction.

**Transitive Tracking**: Follow dependency chains up to 10 levels deep (configurable).

### Why Lineage Matters

**O₃ enables safe change management.** Before refactoring, you must know:

- What code depends on this symbol?
- What does this symbol depend on?
- If I change this, what is the blast radius?
- Are there circular dependencies?
- Is this code even used (dead code)?

**Without O₃, every change is risky.** With O₃, change is calculated.

---

## 2. The Dependency Layer

O₃ Lineage answers three fundamental questions:

1. **Forward Lineage**: "What does this symbol depend on?"
2. **Reverse Lineage**: "What depends on this symbol?"
3. **Blast Radius**: "If I change this, what is affected?"

### Data Flow

```
Source Code (TypeScript, JavaScript, etc.)
    ↓
Import/Export Analysis (AST parsing)
    ↓
Dependency Graph Construction (nodes + edges)
    ↓
Graph Traversal (DFS/BFS)
    ↓
Lineage Chain Extraction (transitive paths)
    ↓
Vector Embedding (eGemma - 768 dimensions)
    ↓
LanceDB Vector Store
    ↓
O₃ Lineage Patterns Overlay
```

### Key Components

```
┌─────────────────────────────────────────────────┐
│        LineagePatternsManager                   │
│   Coordinates graph construction and traversal  │
└──────────┬──────────────────────────────────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼──────┐  ┌──▼──────────┐
│ Worker   │  │  Embedding  │
│ Pool     │  │  Service    │
│ (2-8)    │  │  (eGemma)   │
└───┬──────┘  └──┬──────────┘
    │            │
    ▼            ▼
┌─────────────────────────┐
│  Dependency Graph       │
│  nodes.json + edges.json│
└─────────────────────────┘
    │
    ▼
┌────────────────────────┐
│   LanceDB Vector Store │
│   768-dimensional ANN  │
└────────────────────────┘
```

---

## 3. Core Concepts — Dependency, Chain, Blast Radius

### Concept 1: Dependency

A **dependency** is a directed relationship where one symbol references another.

```typescript
// File: src/services/user-service.ts
import { Database } from '../db/database.js';

class UserService {
  constructor(private db: Database) {}
  //                      ^^^^^^^^
  //                      Dependency: UserService → Database
}
```

**Representation**:

```typescript
interface DependencyEdge {
  from: string; // "UserService"
  to: string; // "Database"
  type: RelationType; // "IMPORT"
  location: {
    file: string; // "src/services/user-service.ts"
    line: number; // 3
  };
}
```

### Concept 2: Lineage Chain

A **lineage chain** is a transitive sequence of dependencies (a path through the graph).

**Example**:

```
API Handler → UserController → UserService → Database → ConnectionPool
```

If `Database` changes, the entire chain is potentially affected.

**Representation**:

```typescript
interface LineageChain {
  path: string[]; // ["APIHandler", "UserController", "UserService", "Database", "ConnectionPool"]
  depth: number; // 4 (number of edges)
  structural_hashes: string[]; // Links to O₁ for each node
  relationship_types: RelationType[]; // ["CALLS", "CALLS", "CALLS", "CALLS"]
}
```

### Concept 3: Blast Radius

The **blast radius** is the set of all code elements that could be impacted by a change.

**Computation**: Reverse lineage traversal to maximum depth.

**Example**:

```
Change: Database.query() signature changed

Blast Radius (reverse lineage):
  Depth 0: Database
  Depth 1: UserService, OrderService (direct dependents)
  Depth 2: UserController, OrderController (indirect via services)
  Depth 3: API Routes (indirect via controllers)
  Depth 4: Tests (indirect via routes)

Total: 15 symbols affected
```

---

## 4. Dependency Graph Structure

O₃ represents dependencies as a **directed graph** with nodes (symbols) and edges (relationships).

### Node Structure

```typescript
interface DependencyNode {
  symbol: string; // Symbol name (e.g., "UserService")
  file: string; // Source file path
  type: SymbolType; // "class", "function", "interface", etc.
  structural_hash: string; // Link to O₁ structural pattern
}
```

**Example**:

```json
{
  "symbol": "UserService",
  "file": "src/services/user-service.ts",
  "type": "class",
  "structural_hash": "sha256:abc123def456..."
}
```

### Edge Structure

```typescript
interface DependencyEdge {
  from: string; // Source symbol
  to: string; // Target symbol
  type: RelationType; // Relationship type
  location: {
    file: string; // Where the dependency occurs
    line: number; // Line number
  };
}
```

**Example**:

```json
{
  "from": "UserService",
  "to": "Database",
  "type": "IMPORT",
  "location": {
    "file": "src/services/user-service.ts",
    "line": 3
  }
}
```

### Relationship Types

```typescript
type RelationType =
  | 'IMPORT' // Direct import/require
  | 'EXTENDS' // Class inheritance
  | 'IMPLEMENTS' // Interface implementation
  | 'CALLS' // Function/method call
  | 'REFERENCES' // Variable/type reference
  | 'INJECTS'; // Dependency injection
```

**Example Relationships**:

```typescript
// IMPORT
import { Database } from '../db/database.js';

// EXTENDS
class UserService extends BaseService { }

// IMPLEMENTS
class UserService implements IUserService { }

// CALLS
const result = database.query(sql);

// REFERENCES
let db: Database;

// INJECTS
constructor(@inject('Database') private db: Database) { }
```

### Graph Representation

**Storage**: `nodes.json` + `edges.json`

```
.open_cognition/overlays/lineage_patterns/graph/
├── nodes.json           # All dependency nodes
└── edges.json           # All dependency edges
```

**nodes.json**:

```json
[
  {
    "symbol": "UserService",
    "file": "src/services/user-service.ts",
    "type": "class",
    "structural_hash": "sha256:abc..."
  },
  {
    "symbol": "Database",
    "file": "src/db/database.ts",
    "type": "class",
    "structural_hash": "sha256:def..."
  },
  {
    "symbol": "UserController",
    "file": "src/controllers/user.ts",
    "type": "class",
    "structural_hash": "sha256:ghi..."
  }
]
```

**edges.json**:

```json
[
  {
    "from": "UserService",
    "to": "Database",
    "type": "IMPORT",
    "location": { "file": "src/services/user-service.ts", "line": 3 }
  },
  {
    "from": "UserController",
    "to": "UserService",
    "type": "CALLS",
    "location": { "file": "src/controllers/user.ts", "line": 12 }
  }
]
```

---

## 5. Traversal Algorithms

O₃ supports **three traversal modes** for different use cases.

### Algorithm 1: Forward Lineage (Dependencies)

**Question**: "What does this symbol depend on?"

**Algorithm**: Depth-First Search (DFS) following outgoing edges

**Example**:

```
Start: UserService

Traversal:
  UserService → Database (IMPORT)
    Database → ConnectionPool (IMPORT)
      ConnectionPool → Config (IMPORT)

Result:
  UserService
    → Database (depth 1)
      → ConnectionPool (depth 2)
        → Config (depth 3)
```

**Use Case**: Understanding what code must exist for this symbol to work

### Algorithm 2: Reverse Lineage (Dependents)

**Question**: "What depends on this symbol?"

**Algorithm**: DFS following incoming edges (reverse direction)

**Example**:

```
Start: Database

Traversal:
  Database ← UserService (IMPORT)
    UserService ← UserController (CALLS)
      UserController ← API Routes (IMPORTS)

Result:
  Database
    ← UserService (depth 1)
      ← UserController (depth 2)
        ← API Routes (depth 3)
```

**Use Case**: Understanding what breaks if this symbol changes

### Algorithm 3: Blast Radius (Full Impact)

**Question**: "If I change this, what all is affected?"

**Algorithm**: Reverse lineage traversal to maximum depth (default: 10 levels)

**Example**:

```
Change: Database.query() signature modified

Blast Radius:
  Depth 0: Database (1 symbol)
  Depth 1: UserService, OrderService, ProductService (3 symbols)
  Depth 2: UserController, OrderController, ProductController (3 symbols)
  Depth 3: API Routes (5 symbols)
  Depth 4: Tests (12 symbols)

Total: 24 symbols affected
```

**Use Case**: Safe refactoring—know the full impact before making changes

### Traversal Implementation

```typescript
function computeBlastRadius(
  graph: DependencyGraph,
  startSymbol: string,
  maxDepth: number = 10
): BlastRadius {
  const visited = new Set<string>();
  const result: Map<number, Set<string>> = new Map();

  function traverse(symbol: string, depth: number) {
    if (depth > maxDepth || visited.has(symbol)) return;

    visited.add(symbol);

    if (!result.has(depth)) {
      result.set(depth, new Set());
    }
    result.get(depth)!.add(symbol);

    // Find all symbols that depend on this one (incoming edges)
    const dependents = graph.getIncomingEdges(symbol);
    for (const edge of dependents) {
      traverse(edge.from, depth + 1);
    }
  }

  traverse(startSymbol, 0);

  return {
    symbol: startSymbol,
    totalAffected: visited.size,
    byDepth: result,
  };
}
```

---

## 6. Lineage Pattern Metadata

Each lineage pattern includes comprehensive metadata linking back to O₁ and tracking computational cost.

```typescript
interface LineagePatternMetadata {
  symbol: string; // Starting symbol
  anchor: string; // File path
  symbolStructuralDataHash: string; // Hash of O₁ structural data
  embeddingHash: string; // Hash of embedding vector
  vectorId: string; // LanceDB vector ID

  lineage: {
    depth: number; // Max traversal depth
    dependency_count: number; // Total dependencies found
    chains: LineageChain[]; // All dependency chains
  };

  validation: {
    sourceHash: string; // Source code hash
    extractionMethod: string; // "graph_traversal"
    fidelity: number; // Quality score (0.0 - 1.0)
  };

  cpow: {
    magnitude: number; // Computational cost (0.0 - 1.0)
    computation: {
      traversal_depth: number; // Max depth traversed
      nodes_visited: number; // Total nodes visited
      embedding_model: string; // "egemma-v1"
    };
    timestamp: string;
  };

  computedAt: string; // ISO timestamp
}
```

### Example Lineage Metadata

```json
{
  "symbol": "UserService",
  "anchor": "src/services/user-service.ts",
  "symbolStructuralDataHash": "sha256:abc123def456...",
  "embeddingHash": "sha256:789ghi012jkl...",
  "vectorId": "lineage:abc123def456",

  "lineage": {
    "depth": 3,
    "dependency_count": 7,
    "chains": [
      {
        "path": ["UserService", "Database", "ConnectionPool"],
        "depth": 2,
        "structural_hashes": [
          "sha256:abc123...",
          "sha256:def456...",
          "sha256:ghi789..."
        ],
        "relationship_types": ["IMPORT", "CALLS"]
      },
      {
        "path": ["UserService", "UserRepository", "Database"],
        "depth": 2,
        "structural_hashes": [
          "sha256:abc123...",
          "sha256:jkl012...",
          "sha256:def456..."
        ],
        "relationship_types": ["IMPORT", "CALLS"]
      }
    ]
  },

  "validation": {
    "sourceHash": "sha256:source_mno345pqr678...",
    "extractionMethod": "graph_traversal",
    "fidelity": 0.98
  },

  "cpow": {
    "magnitude": 0.65,
    "computation": {
      "traversal_depth": 3,
      "nodes_visited": 15,
      "embedding_model": "egemma-v1"
    },
    "timestamp": "2025-10-30T16:00:00.000Z"
  },

  "computedAt": "2025-10-30T16:00:00.000Z"
}
```

---

## 7. Blast Radius Computation

Blast radius is O₃'s killer feature: **know the impact before making changes**.

### Algorithm

```typescript
1. Start at changed symbol
2. Traverse reverse dependencies (incoming edges)
3. Expand to depth N (default: 10)
4. Group results by depth
5. Return total count + breakdown
```

### Example: Database.query() Change

**Before the change**:

```bash
cognition-cli blast-radius Database.query
```

**Output**:

```
Blast Radius Analysis: Database.query
======================================

Depth 0 (Direct):
  - Database.query (starting point)

Depth 1 (Direct Callers):
  - UserRepository.findById
  - UserRepository.save
  - OrderRepository.findAll
  - ProductRepository.search

Depth 2 (Services):
  - UserService.getUser
  - UserService.updateUser
  - OrderService.listOrders
  - ProductService.searchProducts

Depth 3 (Controllers):
  - UserController.getUser
  - UserController.updateUser
  - OrderController.listOrders
  - ProductController.search

Depth 4 (API Routes):
  - GET /api/users/:id
  - PUT /api/users/:id
  - GET /api/orders
  - GET /api/products/search

Depth 5 (Tests):
  - user.service.test.ts (3 tests)
  - order.service.test.ts (2 tests)
  - product.service.test.ts (4 tests)
  - integration/api.test.ts (8 tests)

Total Affected: 24 symbols, 17 tests
Recommendation: Create comprehensive test plan before refactoring
```

### Blast Radius Metrics

```typescript
interface BlastRadius {
  symbol: string; // Starting symbol
  totalAffected: number; // Total symbols in blast radius
  byDepth: Map<number, Set<string>>; // Symbols grouped by depth
  criticalPaths: LineageChain[]; // Longest/most important chains
  testCoverage: {
    affectedTests: number; // Tests that must pass
    uncoveredSymbols: string[]; // Symbols with no tests
  };
}
```

### Use Case: Safe Refactoring

**Workflow**:

1. **Analyze blast radius**

   ```bash
   cognition-cli blast-radius MyFunction
   ```

2. **Create test plan** for all affected symbols

3. **Run tests** before making changes

   ```bash
   npm test
   ```

4. **Make change**

5. **Run tests** again to verify no breakage

6. **Check coverage** of affected symbols

   ```bash
   cognition-cli coverage --symbols $(cognition-cli blast-radius MyFunction --json | jq -r '.symbols[]')
   ```

---

## 8. Computational Proof of Work (cPOW)

Lineage pattern generation has tracked computational cost.

### Formula

```
cpow.magnitude = (TRAVERSAL_COST + EMBEDDING_COST) * fidelity

Where:
- TRAVERSAL_COST = 0.1 * (nodes_visited / 100)
  - Example: 150 nodes visited → 0.1 * (150 / 100) = 0.15

- EMBEDDING_COST = 0.75 (eGemma embedding - always expensive)

- fidelity = 0.0 - 1.0 (quality/completeness)
```

### Example Calculations

**Example 1: Small Graph (50 nodes)**

```
nodes_visited = 50
fidelity = 0.95

TRAVERSAL_COST = 0.1 * (50 / 100) = 0.05
cpow.magnitude = (0.05 + 0.75) * 0.95
               = 0.80 * 0.95
               = 0.76
```

**Example 2: Large Graph (300 nodes)**

```
nodes_visited = 300
fidelity = 0.98

TRAVERSAL_COST = 0.1 * (300 / 100) = 0.30
cpow.magnitude = (0.30 + 0.75) * 0.98
               = 1.05 * 0.98
               = 1.00 (capped at 1.0)
```

**Typical O₃ pattern**: **0.6 - 0.8** (moderate to high cost)

### Interpretation

| Magnitude | Interpretation                |
| --------- | ----------------------------- |
| 0.8 - 1.0 | Very high cost (large graph)  |
| 0.6 - 0.8 | High cost (typical)           |
| 0.4 - 0.6 | Moderate cost (small graph)   |
| 0.2 - 0.4 | Low cost (very small graph)   |
| < 0.2     | Very low cost (trivial graph) |

---

## 9. Use Cases — Safe Refactoring, Auditing, Dead Code

### Use Case 1: Safe Refactoring

**Question**: "Can I safely change this function signature?"

```bash
# Step 1: Check blast radius
$ cognition-cli blast-radius calculateHash

Blast Radius: 42 symbols affected
  - Depth 1: 8 direct callers
  - Depth 2: 15 indirect via services
  - Depth 3: 19 indirect via controllers

Recommendation: High impact. Create comprehensive test plan.
```

**Action**: Create tests for all 42 symbols before refactoring.

### Use Case 2: Dependency Auditing

**Question**: "What external dependencies does this module have?"

```bash
$ cognition-cli lineage dependencies AuthService --external-only

External Dependencies:
  - jsonwebtoken (npm) - Used by: AuthService.generateToken
  - bcrypt (npm) - Used by: AuthService.hashPassword
  - @types/node (npm) - Type definitions
```

**Action**: Audit external dependencies for security vulnerabilities.

### Use Case 3: Dead Code Detection

**Question**: "Is this function used anywhere?"

```bash
$ cognition-cli lineage reverse oldUtilityFunction

No dependents found.
Suggestion: oldUtilityFunction may be dead code.
```

**Action**: Delete unused code to reduce maintenance burden.

### Use Case 4: Circular Dependency Detection

**Question**: "Are there any circular dependencies?"

```bash
$ cognition-cli lineage cycles

Circular Dependencies Found:
  1. UserService → OrderService → UserService
     (src/services/user.ts:15 → src/services/order.ts:22 → src/services/user.ts:8)

  2. ConfigLoader → Database → ConfigLoader
     (src/config/loader.ts:10 → src/db/database.ts:5 → src/config/loader.ts:3)

Recommendation: Break circular dependencies to improve modularity.
```

**Action**: Refactor to eliminate circular dependencies.

### Use Case 5: Layer Violation Detection

**Question**: "Does the presentation layer directly depend on the data layer?"

```bash
$ cognition-cli lineage check-layers --rules layers.json

Layer Violations:
  ❌ UserController → Database (DIRECT)
     Expected: UserController → UserService → Database
     File: src/controllers/user.ts:45

Recommendation: Route through service layer.
```

**Action**: Refactor to follow architectural layers.

---

## 10. Integration with Other Overlays

O₃ Lineage is a **connector overlay**—it links O₁ to O₂, O₅, O₆, and O₇.

### O₃ Links to O₁ (Structure)

**Provenance**: Every lineage node links to O₁ structural pattern

```typescript
lineageChain.structural_hashes[] → O₁.getSymbol(hash)
```

**Use Case**: Understand **what** changed (O₁) and **who** is affected (O₃)

```bash
# Find structural details of all affected symbols
$ cognition-cli blast-radius Database --with-structure
```

### O₃ Feeds O₂ (Security)

**Threat Propagation**: If a function has a security vulnerability, trace it through dependencies

```bash
# Find all entry points that reach vulnerable function
$ cognition-cli lineage reverse Database.query --filter "architecturalRole=controller"

Entry Points (Threat Surface):
  - UserController.getUser (src/controllers/user.ts:15)
  - OrderController.listOrders (src/controllers/order.ts:22)
  - ProductController.search (src/controllers/product.ts:45)

Recommendation: Audit all entry points for SQL injection.
```

### O₃ Feeds O₅ (Operational)

**Quest Planning**: Use blast radius to scope refactoring quests

```typescript
// Quest: Refactor UserService
const blastRadius = await O3.computeBlastRadius('UserService');

const quest = {
  what: 'Refactor UserService to async/await',
  why: 'Improve code clarity and error handling',
  success: [
    `All ${blastRadius.totalAffected} affected symbols still pass tests`,
    'No breaking changes to API',
    'Performance maintained or improved',
  ],
};
```

### O₃ Feeds O₇ (Coherence)

**Centrality Weighting**: O₇ uses O₃ dependency counts for lattice weighting

```typescript
// From O₇ Coherence chapter
centrality = log₁₀(dependency_count + 1)

// dependency_count comes from O₃ reverse lineage
const dependents = await O3.getReverseDependencies(symbol);
const dependency_count = dependents.length;
```

**Use Case**: High-centrality symbols (many dependents) have higher influence on lattice coherence.

### Dependency Graph

```
        O₁ (Structure)
             ↓
        O₃ (Lineage)
             ↓
    ┌────────┼────────┐
    │        │        │
    ▼        ▼        ▼
  O₂ Sec   O₅ Ops   O₇ Coh
  (threat  (quest   (centrality
   propag)  scope)   weight)
```

**O₃ is the connector that links structure to impact.**

---

## Summary

O₃ Lineage is the **dependency tracking layer** that enables safe change management.

**Key Components**:

1. **Dependency Graph**: Directed graph with 6 relationship types
2. **Traversal Algorithms**: Forward, reverse, and blast radius computation
3. **Lineage Chains**: Transitive dependency paths (up to depth 10)
4. **Worker-Based Parallelism**: 2-8 workers for graph construction
5. **cPOW Tracking**: Computational cost (typical: 0.6-0.8)

**Performance**:

- Graph construction: ~500 files/min
- Traversal: ~10,000 nodes/sec
- Search: <100ms (LanceDB)

**Use Cases**:

- Safe refactoring (blast radius analysis)
- Dependency auditing (external dependencies)
- Dead code detection (unused symbols)
- Circular dependency detection
- Layer violation detection

**Integration**: Links O₁ to O₂ (threat propagation), O₅ (quest planning), O₇ (centrality weighting)

**The lattice knows the threads.** With O₃, every change is calculated, not risky.

---

**Next Chapter**: [Chapter 8: O₄ Mission](08-o4-mission.md) ✅

**Previous Chapter**: [Chapter 6: O₂ Security](06-o2-security.md) ✅

---

**Status**: ✅ Complete (October 30, 2025)
**Author**: Collaborative implementation session
**Reviewed**: Pending
