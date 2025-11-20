# O₁: Structural Patterns Overlay

> _The skeleton of code—classes, functions, interfaces—the bones upon which all other overlays rest._

## Overview

The **Structural Patterns Overlay** is the foundational layer of the PGC (Grounded Context Pool). It extracts the structural skeleton of your codebase: classes, functions, interfaces, types, and their architectural relationships.

**Layer**: Code Artifacts
**Purpose**: Extract code structure for similarity search and pattern recognition
**Status**: ✅ Implemented
**Extraction Method**: Tree-sitter AST parsing (no LLM required)
**Speed**: Fast (local parsing only)

## Architecture

### Data Flow

```text
Source Code
    ↓
Tree-sitter AST Parser
    ↓
Structural Data Extraction
    ↓
Structural Signature Generation
    ↓
Vector Embedding (eGemma)
    ↓
LanceDB Vector Store
```

### Key Components

- **Worker Pool**: Parallel AST parsing using worker threads
- **Embedding Service**: Centralized eGemma embedding generation
- **Vector Store**: LanceDB for similarity search
- **Pattern Manager**: Coordinates extraction and storage

## Extracted Entities

### Symbol Types

The overlay extracts the following symbol types:

| Symbol Type | Description           | Example                            |
| ----------- | --------------------- | ---------------------------------- |
| `class`     | Class definitions     | `class UserService { ... }`        |
| `function`  | Function declarations | `function calculateHash() { ... }` |
| `interface` | TypeScript interfaces | `interface Config { ... }`         |
| `type`      | Type aliases          | `type UserId = string`             |
| `method`    | Class methods         | `async save() { ... }`             |

### Architectural Roles

Each symbol is classified by its architectural role:

- **`service`**: Business logic and orchestration
- **`model`**: Data structures and entities
- **`utility`**: Helper functions and tools
- **`controller`**: API handlers and routing
- **`config`**: Configuration and constants
- **`test`**: Test code
- **`unknown`**: Unclassified

## Structural Signature

Each symbol generates a **structural signature** that captures its essence:

### Format

```text
{type} {name}
params: {parameters}
returns: {returnType}
role: {architecturalRole}
```

### Example

```text
function calculateStructuralHash
params: content: string
returns: string
role: utility
```

This signature is embedded into a 768-dimensional vector using eGemma.

## Dual Embeddings: Body & Shadow

The overlay supports **dual embeddings** for richer semantic search:

### 1. Structural Embedding (The Body)

The primary embedding based on structural signature (parameters, return types, architectural role).

**Vector ID**: `structural:{hash}`

### 2. Semantic Embedding (The Shadow)

Optional secondary embedding based on documentation and semantic context (docstrings, comments, type meanings).

**Vector ID**: `semantic:{hash}`

This allows searches like:

- "Find all authentication functions" (semantic)
- "Find functions that take userId and return Promise\<User\>" (structural)

## Metadata Schema

Each structural pattern entry includes:

```typescript
interface PatternMetadata {
  symbol: string; // Symbol name
  anchor: string; // File path
  symbolStructuralDataHash: string; // Hash of structural data
  embeddingHash: string; // Hash of embedding vector
  structuralSignature: string; // Human-readable signature
  semanticSignature?: string; // Optional shadow signature
  semanticEmbeddingHash?: string; // Hash of semantic embedding
  semanticVectorId?: string; // Vector ID for semantic embedding
  architecturalRole: string; // Role classification
  computedAt: string; // ISO timestamp
  vectorId: string; // Primary vector ID

  validation: {
    sourceHash: string; // Source code hash
    embeddingModelVersion: string; // eGemma version
    extractionMethod: string; // "ast_local" or "ast_remote"
    fidelity: number; // 0.0 - 1.0 quality score
  };

  cpow: {
    magnitude: number; // Computational cost (0.0 - 1.0)
    computation: {
      extraction_method: string;
      embedding_model: string;
      api_calls: number;
    };
    timestamp: string;
  };
}
```

## Storage Structure

```text
.open_cognition/
└── pgc/
    └── overlays/
        └── structural_patterns/
            ├── manifest.json              # Index of all patterns
            ├── metadata/
            │   └── {hash}.json           # Pattern metadata
            └── vectors.lance/            # LanceDB vector database
```

## Usage

### Generate Structural Patterns

```bash
# Generate patterns for entire codebase
cognition-cli overlay generate structural_patterns

# Generate for specific directory
cognition-cli overlay generate structural_patterns --path src/services
```

### Search by Similarity

```bash
# Find similar code patterns
cognition-cli patterns search "function that validates user input"

# Search with limit
cognition-cli patterns search "async service method" --limit 10
```

### List All Patterns

```bash
cognition-cli patterns list
```

## Computational Proof of Work (cPOW)

Each pattern generation has a tracked computational cost:

```typescript
cpow.magnitude = (GENESIS_COST + OVERLAY_COST) * fidelity

Where:
- GENESIS_COST = 0.05 (local AST) or 0.15 (remote API)
- OVERLAY_COST = 0.75 (embedding generation)
- fidelity = 0.0 - 1.0 (quality/refinement level)
```

Typical magnitude: **~0.8** (high computational cost due to embedding)

## Performance Characteristics

| Metric            | Value                    |
| ----------------- | ------------------------ |
| Parsing Speed     | ~1000 files/min (local)  |
| Embedding Speed   | ~10 symbols/sec (eGemma) |
| Worker Pool Size  | 2-8 workers (adaptive)   |
| Vector Dimensions | 768 (eGemma default)     |
| Search Latency    | <100ms (LanceDB)         |

## Integration Points

### Used By

- **Blast Radius Analysis**: Find impacted code for changes
- **Pattern Discovery**: Identify similar code patterns
- **Refactoring Tools**: Find refactoring candidates
- **Code Navigation**: Semantic code search

### Depends On

- **Genesis**: Provides initial structural data
- **eGemma**: Generates embeddings
- **LanceDB**: Vector storage and search

## Validation & Oracles

The overlay includes validation oracles to ensure structural coherence:

```typescript
// Oracle checks:
✓ All metadata has valid source hashes in object store
✓ All embeddings have corresponding vector IDs
✓ All symbols have valid structural signatures
✓ Manifest is in sync with metadata files
```

## Example Pattern Entry

```json
{
  "symbol": "ConceptExtractor",
  "anchor": "src/core/analyzers/concept-extractor.ts",
  "symbolStructuralDataHash": "sha256:abc123...",
  "embeddingHash": "sha256:def456...",
  "structuralSignature": "class ConceptExtractor\nrole: service",
  "architecturalRole": "service",
  "computedAt": "2025-10-29T16:00:00.000Z",
  "vectorId": "structural:abc123",
  "validation": {
    "sourceHash": "sha256:source123...",
    "embeddingModelVersion": "egemma-v1",
    "extractionMethod": "ast_local",
    "fidelity": 0.95
  },
  "cpow": {
    "magnitude": 0.76,
    "computation": {
      "extraction_method": "ast_local",
      "embedding_model": "egemma-v1",
      "api_calls": 1
    },
    "timestamp": "2025-10-29T16:00:00.000Z"
  }
}
```

## Future Enhancements

- [ ] **Control Flow Analysis**: Extract control flow patterns
- [ ] **Dependency Injection Patterns**: Track DI relationships
- [ ] **Design Pattern Detection**: Identify common design patterns
- [ ] **Code Clone Detection**: Find duplicate code structures
- [ ] **Semantic Shadow Enhancement**: Richer semantic embeddings from docstrings

## Related Documentation

- [Multi-Overlay Architecture](../../architecture/MULTI_OVERLAY_ARCHITECTURE.md)
- [O₃: Lineage Overlay](O3-lineage-patterns.md) - Tracks dependencies
