# O₃: Lineage Patterns Overlay

> _The threads—dependency chains that weave through code, revealing how changes ripple across the lattice._

## Overview

The **Lineage Patterns Overlay** traces dependency relationships through your codebase, enabling impact analysis, blast radius computation, and transitive dependency tracking. It answers the critical question: **"If I change this, what else breaks?"**

**Layer**: Dependency Tracking
**Purpose**: Trace dependency chains and compute change impact
**Status**: ✅ Implemented
**Extraction Method**: Graph traversal + AST analysis
**Speed**: Fast (no LLM required for traversal)

## Architecture

### Data Flow

```text
Source Code
    ↓
Import/Export Analysis
    ↓
Dependency Graph Construction
    ↓
Graph Traversal (DFS/BFS)
    ↓
Lineage Pattern Extraction
    ↓
Vector Embedding (eGemma)
    ↓
LanceDB Storage
```

### Key Components

- **Dependency Graph**: Directed graph of code dependencies
- **Lineage Tracer**: Traverses dependency chains
- **Blast Radius Calculator**: Computes impact of changes
- **Worker Pool**: Parallel lineage mining
- **Embedding Service**: Generates semantic embeddings of dependency contexts

## Core Concepts

### 1. Dependency

A **dependency** is a relationship where one symbol references another:

```typescript
// File: src/services/user-service.ts
import { Database } from '../db/database.js';

class UserService {
  constructor(private db: Database) {}
  //                      ^^^^^^^^
  //                      Dependency: UserService → Database
}
```

### 2. Lineage Chain

A **lineage chain** is a transitive sequence of dependencies:

```text
API Handler → Service → Repository → Database → Connection Pool
```

If `Database` changes, the entire chain is potentially affected.

### 3. Blast Radius

The **blast radius** is the set of all code elements that could be impacted by a change:

```text
Change: Database.query() signature changed
Blast Radius:
  - Repository (direct user)
  - Service (indirect, via Repository)
  - API Handler (indirect, via Service)
  - Tests (indirect, via all above)
```

## Lineage Pattern Metadata

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
    sourceHash: string;
    extractionMethod: string;
    fidelity: number;
  };

  cpow: {
    magnitude: number;
    computation: {
      traversal_depth: number;
      nodes_visited: number;
      embedding_model: string;
    };
    timestamp: string;
  };

  computedAt: string;
}
```

### Lineage Chain Structure

```typescript
interface LineageChain {
  path: string[]; // Sequence of symbols
  depth: number; // Chain length
  structural_hashes: string[]; // Link to O₁ for each node
  relationship_types: RelationType[]; // IMPORT, EXTENDS, IMPLEMENTS, etc.
}

type RelationType =
  | 'IMPORT' // Direct import
  | 'EXTENDS' // Class inheritance
  | 'IMPLEMENTS' // Interface implementation
  | 'CALLS' // Function call
  | 'REFERENCES' // Variable/type reference
  | 'INJECTS'; // Dependency injection
```

## Example Lineage Entry

```json
{
  "symbol": "UserService",
  "anchor": "src/services/user-service.ts",
  "symbolStructuralDataHash": "sha256:abc123...",
  "embeddingHash": "sha256:def456...",
  "vectorId": "lineage:abc123",
  "lineage": {
    "depth": 3,
    "dependency_count": 7,
    "chains": [
      {
        "path": ["UserService", "Database", "ConnectionPool"],
        "depth": 2,
        "structural_hashes": ["sha256:a", "sha256:b", "sha256:c"],
        "relationship_types": ["IMPORT", "CALLS"]
      },
      {
        "path": ["UserService", "UserRepository", "Database"],
        "depth": 2,
        "structural_hashes": ["sha256:a", "sha256:d", "sha256:b"],
        "relationship_types": ["IMPORT", "CALLS"]
      }
    ]
  },
  "validation": {
    "sourceHash": "sha256:source123...",
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
    "timestamp": "2025-10-29T16:00:00Z"
  },
  "computedAt": "2025-10-29T16:00:00Z"
}
```

## Dependency Graph Structure

### Node

```typescript
interface DependencyNode {
  symbol: string; // Symbol name
  file: string; // Source file
  type: SymbolType; // class, function, etc.
  structural_hash: string; // Link to O₁
}
```

### Edge

```typescript
interface DependencyEdge {
  from: string; // Source symbol
  to: string; // Target symbol
  type: RelationType; // Relationship type
  location: {
    file: string;
    line: number;
  };
}
```

## Traversal Algorithms

### 1. Forward Lineage (Dependencies)

**Question**: "What does this symbol depend on?"

```text
Traverse: symbol → dependencies → their dependencies → ...
```

**Example**:

```text
UserService
  → Database
    → ConnectionPool
      → Config
```

### 2. Reverse Lineage (Dependents)

**Question**: "What depends on this symbol?"

```text
Traverse: symbol ← dependents ← their dependents ← ...
```

**Example**:

```text
Database
  ← UserService
    ← UserController
      ← API Routes
```

### 3. Blast Radius (Full Impact)

**Question**: "If I change this, what all is affected?"

```text
Compute: reverse lineage to max depth
```

## Storage Structure

```text
.open_cognition/
└── pgc/
    └── overlays/
        └── lineage_patterns/
            ├── manifest.json          # Index of all lineage patterns
            ├── metadata/
            │   └── {hash}.json       # Lineage metadata
            ├── graph/
            │   ├── nodes.json        # All dependency nodes
            │   └── edges.json        # All dependency edges
            └── vectors.lance/        # LanceDB vector database
```

## Usage

### Generate Lineage Patterns

```bash
# Generate lineage for entire codebase
cognition-cli overlay generate lineage_patterns

# Generate with specific depth
cognition-cli overlay generate lineage_patterns --depth 5

# Generate for specific file
cognition-cli overlay generate lineage_patterns --path src/services/user-service.ts
```

### Compute Blast Radius

```bash
# Find all code affected by changing a symbol
cognition-cli blast-radius UserService

# Limit depth
cognition-cli blast-radius UserService --depth 3

# Output as JSON
cognition-cli blast-radius UserService --json
```

### Visualize Dependencies

```bash
# Generate dependency graph
cognition-cli lineage graph UserService --output graph.dot

# Render as SVG (requires graphviz)
dot -Tsvg graph.dot -o graph.svg
```

## Integration with Other Overlays

### Links to O₁ (Structure)

Every lineage node links to structural data:

```text
lineage.chains[].structural_hashes[] → O₁ structural patterns
```

This enables:

- Understanding **what** changed (O₁) and **who** is affected (O₃)
- Type-aware dependency analysis

### Feeds O₂ (Security)

Security threat propagation:

```text
Vulnerable function → O₃ lineage → All transitive callers
```

**Use case**: If `Database.query()` has SQL injection risk, find all entry points that reach it.

### Feeds O₅ (Operational)

Dependency-aware quest planning:

```text
Quest: Refactor UserService
→ Check lineage to see blast radius
→ Generate test plan for all dependents
```

### Feeds O₇ (Coherence)

Coherence across dependency boundaries:

```text
Mission concept in Service → propagates to → Controller → API
```

Verify: Does the implementation preserve mission intent across layers?

## Computational Proof of Work (cPOW)

```typescript
cpow.magnitude = (TRAVERSAL_COST + EMBEDDING_COST) * fidelity

Where:
- TRAVERSAL_COST = 0.1 * (nodes_visited / 100)
- EMBEDDING_COST = 0.75 (eGemma embedding)
- fidelity = 0.0 - 1.0
```

Typical magnitude: **0.6 - 0.8** (moderate to high cost)

## Performance Characteristics

| Metric             | Value                    |
| ------------------ | ------------------------ |
| Graph Construction | ~500 files/min           |
| Traversal Speed    | ~10,000 nodes/sec        |
| Max Depth          | 10 levels (configurable) |
| Embedding Speed    | ~10 chains/sec           |
| Search Latency     | <100ms (LanceDB)         |

## Use Cases

### 1. Safe Refactoring

**Before**:

```bash
# Check blast radius
cognition-cli blast-radius Database.query
```

**Output**:

```text
Blast Radius: 47 symbols affected
  - UserService (direct)
  - OrderService (direct)
  - ... (45 more)

Recommendation: Create tests for all affected services
```

### 2. Dependency Auditing

**Question**: "What external dependencies does this module have?"

```bash
cognition-cli lineage dependencies AuthService --external-only
```

**Output**:

```text
External Dependencies:
  - jsonwebtoken (npm)
  - bcrypt (npm)
  - @types/node (npm)
```

### 3. Dead Code Detection

**Question**: "Is this symbol used anywhere?"

```bash
cognition-cli lineage reverse OldUtilityFunction
```

**Output**:

```text
No dependents found.
Suggestion: OldUtilityFunction may be dead code.
```

### 4. Circular Dependency Detection

```bash
cognition-cli lineage cycles
```

**Output**:

```text
Circular Dependencies Found:
  1. UserService → OrderService → UserService
  2. ConfigLoader → Database → ConfigLoader
```

## Best Practices

### For Developers

1. **Check blast radius before major changes**

   ```bash
   cognition-cli blast-radius MyFunction
   ```

2. **Visualize dependencies for new features**

   ```bash
   cognition-cli lineage graph NewFeature
   ```

3. **Detect circular dependencies early**

   ```bash
   git add . && cognition-cli lineage cycles
   ```

### For Architects

1. **Analyze layer violations**

   ```bash
   # Check if presentation layer depends on data layer (should go through service)
   cognition-cli lineage check-layers
   ```

2. **Track technical debt**

   ```bash
   # Find modules with too many dependencies
   cognition-cli lineage complexity --threshold 20
   ```

## Future Enhancements

- [ ] **Transitive CVE Impact**: Track security vulnerabilities through dependencies
- [ ] **Performance Impact Analysis**: Track performance-critical paths
- [ ] **Dependency Health Score**: Rate dependency quality
- [ ] **Auto-Refactoring Suggestions**: Suggest dependency simplifications
- [ ] **Real-time Dependency Watching**: Monitor dependency changes live

## Related Documentation

- [Multi-Overlay Architecture](../../architecture/MULTI_OVERLAY_ARCHITECTURE.md)
- [O₁: Structural Patterns](../O1_structure/STRUCTURAL_PATTERNS.md)
- [O₂: Security Guidelines](../O2_security/SECURITY_GUIDELINES.md)
