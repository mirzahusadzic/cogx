# Chapter 5: O₁ Structure — Code Artifacts

> "The skeleton of code—classes, functions, interfaces—the bones upon which all other overlays rest."
>
> — The Shadow Architecture

**Part**: II — The Seven Layers<br/>
**Layer**: O₁ (Structure)<br/>
**Role**: Code Artifacts<br/>
**Knowledge Types**: 5 (class, function, interface, type, method)<br/>

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Foundational Layer](#2-the-foundational-layer)
3. [Extracted Entities — Symbol Types and Roles](#3-extracted-entities--symbol-types-and-roles)
4. [Structural Signature — The Body](#4-structural-signature--the-body)
5. [Dual Embeddings — Body & Shadow](#5-dual-embeddings--body--shadow)
6. [Pattern Metadata Schema](#6-pattern-metadata-schema)
7. [Worker-Based Parallel Extraction](#7-worker-based-parallel-extraction)
8. [Computational Proof of Work (cPOW)](#8-computational-proof-of-work-cpow)
9. [Performance and Storage](#9-performance-and-storage)
10. [Integration with Other Overlays](#10-integration-with-other-overlays)

---

## 1. Executive Summary

The **Structural Patterns Overlay** (O₁) is the foundational layer of the PGC (Grounded Context Pool). It extracts the structural skeleton of your codebase: classes, functions, interfaces, types, and their architectural relationships.

### Key Properties

**No LLM Required**: Extraction uses Tree-sitter AST parsing (local, fast, deterministic).

**Pure Structure**: Captures the "bones" of code—function signatures, class hierarchies, type definitions—without implementation details.

**Dual Embeddings**: Supports both structural embeddings (the "body": parameters, return types) and semantic embeddings (the "shadow": docstrings, comments).

**Worker-Based Parallelism**: Uses worker threads for parallel AST parsing with optimal CPU utilization (2-8 workers).

**768-Dimensional Vectors**: Each symbol is embedded via eGemma into a 768-dimensional vector for similarity search.

### Why Structure Matters

**O₁ is the foundation**. Every other overlay depends on it:

- **O₂ (Security)**: Maps security threats to code symbols
- **O₃ (Lineage)**: Tracks dependencies between symbols
- **O₄ (Mission)**: Computes alignment between symbols and mission concepts
- **O₅ (Operational)**: Links workflows to code artifacts
- **O₆ (Mathematical)**: Associates proofs with implementations
- **O₇ (Coherence)**: Synthesizes alignment across all layers

**Without O₁, there is no lattice.**

---

## 2. The Foundational Layer

O₁ Structure answers the question: **"What code artifacts exist in this codebase?"**

### Data Flow

```
Source Code (TypeScript, JavaScript, etc.)
    ↓
Tree-sitter AST Parser (local)
    ↓
Symbol Extraction (classes, functions, interfaces, types, methods)
    ↓
Structural Signature Generation (params, return types, role)
    ↓
Vector Embedding (eGemma - 768 dimensions)
    ↓
LanceDB Vector Store
    ↓
O₁ Structural Patterns Overlay
```

### Key Components

```
┌─────────────────────────────────────────────────┐
│         StructuralPatternsManager                │
│   Coordinates extraction and storage             │
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
┌────────────────────────┐
│   LanceDB Vector Store  │
│   768-dimensional ANN   │
└────────────────────────┘
```

**Worker Pool**: Parallel AST parsing using worker threads (optimal: 2-8 workers based on job count and CPU cores)

**Embedding Service**: Centralized eGemma embedding generation (sequential to avoid rate limits)

**Vector Store**: LanceDB for fast similarity search (<100ms latency)

**Pattern Manager**: Coordinates extraction, embedding, storage, and metadata tracking

---

## 3. Extracted Entities — Symbol Types and Roles

O₁ extracts **5 symbol types** and classifies them into **7 architectural roles**.

### Symbol Types

| Symbol Type | Description           | Example                                 |
| ----------- | --------------------- | --------------------------------------- |
| `class`     | Class definitions     | `class UserService { ... }`             |
| `function`  | Function declarations | `function calculateHash() { ... }`      |
| `interface` | TypeScript interfaces | `interface Config { port: number }`     |
| `type`      | Type aliases          | `type UserId = string`                  |
| `method`    | Class methods         | `async save(user: User): Promise<void>` |

### Architectural Roles

Each symbol is classified by its architectural role based on naming patterns, file path, and signature:

| Role         | Description                    | Examples                          |
| ------------ | ------------------------------ | --------------------------------- |
| `service`    | Business logic & orchestration | `UserService`, `AuthManager`      |
| `model`      | Data structures & entities     | `User`, `Product`, `OrderSchema`  |
| `utility`    | Helper functions & tools       | `calculateHash`, `parseUrl`       |
| `controller` | API handlers & routing         | `UserController`, `apiHandler`    |
| `config`     | Configuration & constants      | `AppConfig`, `DATABASE_URL`       |
| `test`       | Test code                      | `describe`, `it`, `test*`         |
| `unknown`    | Unclassified                   | Symbols that don't match patterns |

### Role Classification Algorithm

```typescript
function classifyArchitecturalRole(
  symbolName: string,
  filePath: string,
  symbolType: string
): string {
  // Test files
  if (filePath.includes('.test.') || filePath.includes('.spec.')) {
    return 'test';
  }

  // Service layer
  if (symbolName.includes('Service') || symbolName.includes('Manager')) {
    return 'service';
  }

  // Models and entities
  if (
    symbolName.includes('Model') ||
    symbolName.includes('Schema') ||
    symbolName.includes('Entity')
  ) {
    return 'model';
  }

  // Controllers and handlers
  if (
    symbolName.includes('Controller') ||
    symbolName.includes('Handler') ||
    symbolName.includes('Router')
  ) {
    return 'controller';
  }

  // Configuration
  if (
    symbolName.includes('Config') ||
    symbolName.toUpperCase() === symbolName
  ) {
    return 'config';
  }

  // Utility functions
  if (symbolType === 'function' && !symbolName.match(/^[A-Z]/)) {
    return 'utility';
  }

  return 'unknown';
}
```

---

## 4. Structural Signature — The Body

Each symbol generates a **structural signature** that captures its essence without implementation details.

### Signature Format

```
{type} {name}
params: {parameters}
returns: {returnType}
role: {architecturalRole}
```

### Example 1: Function

```typescript
// Source code
function calculateStructuralHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}
```

**Structural Signature**:

```
function calculateStructuralHash
params: content: string
returns: string
role: utility
```

### Example 2: Class

```typescript
// Source code
class UserService {
  constructor(private db: Database) {}

  async getUser(id: string): Promise<User> {
    return this.db.users.findById(id);
  }

  async saveUser(user: User): Promise<void> {
    await this.db.users.save(user);
  }
}
```

**Structural Signature**:

```
class UserService
role: service
```

### Example 3: Interface

```typescript
// Source code
interface Config {
  port: number;
  host: string;
  database: DatabaseConfig;
}
```

**Structural Signature**:

```
interface Config
role: config
```

### Example 4: Method

```typescript
// Source code (method within UserService)
async saveUser(user: User): Promise<void> {
  await this.db.users.save(user);
}
```

**Structural Signature**:

```
method saveUser
params: user: User
returns: Promise<void>
role: service
```

### Why Structural Signatures?

**Abstraction**: Captures the interface, not the implementation

**Stability**: Doesn't change when implementation logic changes (only when signature changes)

**Searchability**: Enables queries like "find functions that take `userId: string` and return `Promise<User>`"

**Embeddability**: Compact text representation suitable for vector embedding (768 dimensions via eGemma)

---

## 5. Dual Embeddings — Body & Shadow

O₁ supports **dual embeddings** for richer semantic search: the structural "body" and the semantic "shadow".

### The Body: Structural Embedding

**What**: Embedding based on structural signature (parameters, return types, architectural role)

**Vector ID**: `structural:{hash}`

**Use Case**: Structural search

**Example Query**: "Find all functions that take `userId: string` and return `Promise<User>`"

**Result**:

```typescript
function getUser(userId: string): Promise<User>; // similarity: 0.95
function fetchUser(userId: string): Promise<User>; // similarity: 0.93
function loadUser(id: string): Promise<User>; // similarity: 0.87
```

### The Shadow: Semantic Embedding

**What**: Optional secondary embedding based on documentation and semantic context (docstrings, comments, type meanings)

**Vector ID**: `semantic:{hash}`

**Use Case**: Semantic search

**Example Query**: "Find all authentication functions"

**Result**:

```typescript
function authenticateUser(credentials: Credentials): Promise<AuthResult>; // similarity: 0.92
function verifyToken(token: string): boolean; // similarity: 0.88
function login(username: string, password: string): Promise<Session>; // similarity: 0.85
```

### Example: Dual Embeddings

```typescript
/**
 * Authenticates a user with username and password.
 * Returns an authentication token on success.
 */
async function authenticateUser(
  username: string,
  password: string
): Promise<AuthToken> {
  // ... implementation
}
```

**Structural Signature (Body)**:

```
function authenticateUser
params: username: string, password: string
returns: Promise<AuthToken>
role: service
```

**Semantic Signature (Shadow)**:

```
Authenticates a user with username and password.
Returns an authentication token on success.
function authenticateUser: (username, password) -> AuthToken
role: service (authentication)
```

**Storage**:

- Body embedding: `structural:sha256_abc123...` → 768-dim vector [0.12, -0.34, ...]
- Shadow embedding: `semantic:sha256_abc123...` → 768-dim vector [0.45, -0.21, ...]

**Query Behavior**:

- Structural query ("function that takes two strings and returns Promise<AuthToken>") → matches body
- Semantic query ("authentication function") → matches shadow

---

## 6. Pattern Metadata Schema

Each structural pattern entry includes comprehensive metadata for provenance, validation, and cPOW tracking.

```typescript
interface PatternMetadata {
  symbol: string; // Symbol name (e.g., "UserService")
  anchor: string; // File path (e.g., "src/services/user.ts")
  symbolStructuralDataHash: string; // Hash of structural data
  embeddingHash: string; // Hash of embedding vector
  structuralSignature: string; // Human-readable signature (the body)
  semanticSignature?: string; // Optional shadow signature
  semanticEmbeddingHash?: string; // Hash of semantic embedding
  semanticVectorId?: string; // Vector ID for semantic embedding
  architecturalRole: string; // Role classification
  computedAt: string; // ISO timestamp

  vectorId: string; // Primary vector ID (structural:{hash})

  validation: {
    sourceHash: string; // Source code hash (provenance)
    embeddingModelVersion: string; // eGemma version (e.g., "egemma-v1")
    extractionMethod: string; // "ast_local", "ast_remote", or "llm_supervised"
    fidelity: number; // Quality score (0.0 - 1.0)
  };

  cpow: {
    magnitude: number; // Computational cost (0.0 - 1.0)
    computation: {
      extraction_method: string; // AST parsing method
      embedding_model: string; // eGemma model name
      api_calls: number; // Number of API calls
    };
    timestamp: string; // ISO timestamp
  };
}
```

### Example Pattern Metadata

```json
{
  "symbol": "ConceptExtractor",
  "anchor": "src/core/analyzers/concept-extractor.ts",
  "symbolStructuralDataHash": "sha256:abc123def456...",
  "embeddingHash": "sha256:789ghi012jkl...",
  "structuralSignature": "class ConceptExtractor\nrole: service",
  "architecturalRole": "service",
  "computedAt": "2025-10-30T16:00:00.000Z",
  "vectorId": "structural:abc123def456",

  "validation": {
    "sourceHash": "sha256:source_mno345pqr678...",
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
    "timestamp": "2025-10-30T16:00:00.000Z"
  }
}
```

### Validation Properties

**sourceHash**: SHA-256 hash of the source file content (enables verification that pattern matches current source)

**embeddingModelVersion**: eGemma model version (enables detection when embeddings need regeneration)

**extractionMethod**: How the pattern was extracted

- `ast_local`: Local Tree-sitter AST parsing (fast, no network)
- `ast_remote`: Remote API call for AST (slower, more accurate)
- `llm_supervised`: LLM-assisted extraction (highest fidelity, most expensive)

**fidelity**: Quality score (0.0 - 1.0)

- 1.0 = Perfect extraction (all metadata complete, high confidence)
- 0.8 = Good extraction (most metadata, minor ambiguities)
- 0.5 = Acceptable extraction (basic metadata, some gaps)
- < 0.5 = Low-quality extraction (missing metadata, needs review)

---

## 7. Worker-Based Parallel Extraction

O₁ uses **worker threads** for parallel AST parsing with optimal CPU utilization.

### Architecture

```
Main Thread (StructuralPatternsManager)
    │
    ├─→ Worker 1: Parse file 1 → Extract symbols → Return results
    ├─→ Worker 2: Parse file 2 → Extract symbols → Return results
    ├─→ Worker 3: Parse file 3 → Extract symbols → Return results
    └─→ Worker N: Parse file N → Extract symbols → Return results
    │
    ▼
Embedding Service (Sequential)
    │
    ├─→ Generate embedding for symbol 1
    ├─→ Generate embedding for symbol 2
    ├─→ Generate embedding for symbol 3
    └─→ Generate embedding for symbol N
    │
    ▼
LanceDB Vector Store
```

### Optimal Worker Count

```typescript
function calculateOptimalWorkers(jobCount: number): number {
  const cpuCount = os.cpus().length;

  if (jobCount <= 10) {
    return Math.min(2, cpuCount); // Small jobs: 2 workers max
  }

  if (jobCount <= 50) {
    return Math.min(4, cpuCount); // Medium jobs: 4 workers max
  }

  // Large jobs: use up to 8 workers (leave CPUs for main process)
  return Math.min(8, Math.floor(cpuCount * 0.75));
}
```

**Philosophy**: Balance parallelism with system responsiveness

**Small Jobs (≤10 files)**: 2 workers (low overhead)

**Medium Jobs (11-50 files)**: 4 workers (moderate parallelism)

**Large Jobs (>50 files)**: Up to 8 workers, capped at 75% of CPU cores (aggressive parallelism while leaving resources for main process and embedding service)

### Why Sequential Embedding?

**Rate Limits**: eGemma API has rate limits (10-20 req/sec)

**Network Bandwidth**: Parallel requests can saturate network

**Predictability**: Sequential embedding provides predictable throughput

**Centralized Service**: Single `EmbeddingService` instance manages all requests (connection pooling, retry logic, error handling)

### Worker Lifecycle

1. **Initialization**: Create worker pool with optimal worker count
2. **Job Distribution**: Distribute file parsing jobs to workers
3. **Symbol Extraction**: Workers parse AST and extract symbols (parallel)
4. **Embedding Generation**: Main thread generates embeddings (sequential)
5. **Storage**: Write metadata and vectors to PGC and LanceDB
6. **Shutdown**: Terminate workers and close embedding service

---

## 8. Computational Proof of Work (cPOW)

Every pattern extraction has a tracked **computational cost** (cPOW magnitude: 0.0 - 1.0).

### Formula

```
cpow.magnitude = (GENESIS_COST + OVERLAY_COST) * fidelity

Where:
- GENESIS_COST = extraction method cost
  - ast_local: 0.05 (local parsing, fast)
  - ast_remote: 0.15 (remote API, slower)
  - llm_supervised: 0.30 (LLM-assisted, most expensive)

- OVERLAY_COST = 0.75 (embedding generation - always expensive)

- fidelity = 0.0 - 1.0 (quality/refinement level)
```

### Example Calculations

**Example 1: Local AST + High Fidelity**

```
extraction_method = "ast_local"
fidelity = 0.95

cpow.magnitude = (0.05 + 0.75) * 0.95
               = 0.80 * 0.95
               = 0.76
```

**Example 2: Remote AST + Medium Fidelity**

```
extraction_method = "ast_remote"
fidelity = 0.80

cpow.magnitude = (0.15 + 0.75) * 0.80
               = 0.90 * 0.80
               = 0.72
```

**Example 3: LLM-Supervised + Perfect Fidelity**

```
extraction_method = "llm_supervised"
fidelity = 1.00

cpow.magnitude = (0.30 + 0.75) * 1.00
               = 1.05 * 1.00
               = 1.00 (capped at 1.0)
```

### Interpretation

| Magnitude | Interpretation                    |
| --------- | --------------------------------- |
| 0.8 - 1.0 | Very high computational cost      |
| 0.6 - 0.8 | High computational cost (typical) |
| 0.4 - 0.6 | Moderate computational cost       |
| 0.2 - 0.4 | Low computational cost            |
| < 0.2     | Very low computational cost       |

**Typical O₁ pattern**: **~0.76** (high cost due to embedding generation)

### Why Track cPOW?

**Resource Planning**: Estimate time/cost for overlay regeneration

**Optimization**: Identify expensive operations for caching/optimization

**Transparency**: Users understand computational investment in each artifact

**Provenance**: Complete audit trail of how each pattern was computed

---

## 9. Performance and Storage

### Performance Characteristics

| Metric            | Value           | Notes                         |
| ----------------- | --------------- | ----------------------------- |
| Parsing Speed     | ~1000 files/min | Local Tree-sitter AST parsing |
| Embedding Speed   | ~10 symbols/sec | eGemma API (network-bound)    |
| Worker Pool Size  | 2-8 workers     | Adaptive based on job count   |
| Vector Dimensions | 768             | eGemma default                |
| Search Latency    | <100ms          | LanceDB ANN index             |

### Storage Structure

```
.open_cognition/
└── overlays/
    └── structural_patterns/
        ├── manifest.json              # Index of all patterns
        ├── metadata/
        │   ├── {hash1}.json          # Pattern metadata
        │   ├── {hash2}.json
        │   └── ...
        └── vectors.lance/            # LanceDB vector database
            ├── data/                 # Vector data
            ├── index/                # ANN index
            └── metadata.json         # DB metadata
```

### Storage Estimates

**Per Symbol**:

- Metadata: ~1-2 KB (JSON with validation and cPOW)
- Vector (body): 768 × 4 bytes = 3 KB (float32)
- Vector (shadow): 768 × 4 bytes = 3 KB (optional)

**Total per symbol**: ~4-8 KB (without shadow), ~7-11 KB (with shadow)

**Example codebase** (1,000 symbols):

- Metadata: 1-2 MB
- Vectors: 3-6 MB (body only), 6-9 MB (body + shadow)
- Total: ~4-11 MB

---

## 10. Integration with Other Overlays

O₁ is the **foundation**—all other overlays depend on it.

### O₂ (Security) Uses O₁

**What**: Maps security threats to code symbols

**How**: Load symbol embeddings from O₁, compute similarity with security threat embeddings

```typescript
// Find code vulnerable to SQL injection
const sqlInjectionThreat = await O2.getThreat('SQL Injection');
const vulnerableSymbols = await O1.findSimilar(sqlInjectionThreat.embedding, {
  filter: { architecturalRole: 'controller' },
  limit: 10,
});
```

### O₃ (Lineage) Uses O₁

**What**: Tracks dependencies between symbols

**How**: Parse import statements, build dependency graph, link to O₁ symbols

```typescript
// Find all symbols that depend on UserService
const userServiceSymbol = await O1.getSymbol('UserService');
const dependents = await O3.getReverseDependencies(userServiceSymbol.hash);
```

### O₄ (Mission) Uses O₁

**What**: Computes alignment between code symbols and mission concepts

**How**: Load symbol embeddings from O₁, compute cosine similarity with mission concept embeddings

```typescript
// Find code that implements "cryptographic truth"
const missionConcept = await O4.getConcept('Cryptographic truth is essential');
const alignedSymbols = await O1.findSimilar(missionConcept.embedding, {
  limit: 10,
  sortBy: 'similarity',
});
```

### O₅ (Operational) Uses O₁

**What**: Links operational workflows to code artifacts

**How**: Map workflow steps to O₁ symbols

```typescript
// Find code involved in "F.L.T.B" workflow
const fltbWorkflow = await O5.getWorkflow('F.L.T.B');
const involvedSymbols = await O1.getSymbols({
  paths: fltbWorkflow.scripts.map((s) => s.path),
});
```

### O₆ (Mathematical) Uses O₁

**What**: Associates formal proofs with implementations

**How**: Link theorem statements to O₁ symbols via docstring annotations

```typescript
// Find implementation of "Structural Hash Uniqueness" theorem
const theorem = await O6.getTheorem('Structural Hash Uniqueness');
const implementation = await O1.getSymbol('calculateStructuralHash');
```

### O₇ (Coherence) Uses O₁

**What**: Synthesizes alignment across all layers

**How**: Load all symbol embeddings from O₁, compute alignment with mission concepts from O₄

```typescript
// Compute lattice coherence
const structuralPatterns = await O1.getAllSymbols();
const missionConcepts = await O4.getAllConcepts();
const coherence = await O7.computeCoherence(
  structuralPatterns,
  missionConcepts
);
```

### Dependency Graph

```
        O₁ (Structure)
             ↓
    ┌────────┼────────┐
    │        │        │
    ▼        ▼        ▼
  O₂ Sec   O₃ Lin   O₄ Mis
    │        │        │
    └────────┼────────┘
             ↓
          O₅ Ops
             ↓
          O₆ Math
             ↓
          O₇ Coh
```

**All layers depend on O₁.**

---

## Summary

O₁ Structure is the **foundational layer** that extracts the structural skeleton of your codebase.

**Key Components**:

1. **Symbol Extraction**: 5 types (class, function, interface, type, method)
2. **Architectural Roles**: 7 classifications (service, model, utility, controller, config, test, unknown)
3. **Structural Signatures**: Compact text representation of code artifacts
4. **Dual Embeddings**: Body (structural) and Shadow (semantic) embeddings
5. **Worker-Based Parallelism**: 2-8 worker threads for optimal CPU utilization
6. **cPOW Tracking**: Computational cost measurement (0.0 - 1.0)

**Performance**:

- Parsing: ~1000 files/min (local Tree-sitter)
- Embedding: ~10 symbols/sec (eGemma)
- Search: <100ms (LanceDB ANN)

**Storage**: ~4-11 KB per symbol (metadata + vectors)

**Integration**: All other overlays (O₂-O₇) depend on O₁

**The lattice begins here.** Without structure, there is no foundation for security, lineage, mission, operations, proofs, or coherence.

---

**Next Chapter**: [Chapter 6: O₂ Security](06-o2-security.md) ✅

**Previous Chapter**: [Chapter 4.5: Core Security](../part-1-foundation/04.5-core-security.md) ✅
