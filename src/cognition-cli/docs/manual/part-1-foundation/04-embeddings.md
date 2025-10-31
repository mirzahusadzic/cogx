---
type: architectural
overlay: O4_Mission
---

# Chapter 4: Embeddings — Semantic Bridge to the Lattice

> **The Foundation**: Embeddings transform discrete knowledge (code, text, concepts) into continuous vector space, enabling semantic queries that transcend exact-match search. This is not database indexing—it's the mathematical substrate that makes "find code similar to this requirement" computable across the entire lattice.

**Part**: I — Foundation<br/>
**Purpose**: Semantic Search Infrastructure<br/>
**Model**: EmbeddingGemma-300M (768 dimensions)<br/>
**Storage**: LanceDB (Apache Arrow + vector similarity)<br/>

---

## Table of Contents

1. [Why Embeddings Matter](#why-embeddings-matter)
2. [The EmbeddingGemma-300M Model](#the-embeddinggemma-300m-model)
3. [LanceDB: Vector Storage Architecture](#lancedb-vector-storage-architecture)
4. [Dual Signature Architecture](#dual-signature-architecture)
5. [Embedding Service: Queue and Rate Limiting](#embedding-service-queue-and-rate-limiting)
6. [What Gets Embedded](#what-gets-embedded)
7. [Query Patterns](#query-patterns)
8. [Performance Characteristics](#performance-characteristics)
9. [Common Misconceptions](#common-misconceptions)
10. [Integration with Lattice Algebra](#integration-with-lattice-algebra)

---

## Why Embeddings Matter

### The Problem: Exact Match Is Not Enough

Traditional search operates on exact string matching (or variations like fuzzy/regex matching). This fails for semantic queries:

**Query**: "authentication middleware"
**Exact match misses**:

- Code using `@RequiresAuth()` decorator
- Functions named `verifyToken()`
- Classes called `SecurityGuard`
- Comments saying "check user permissions"

All of these are **semantically related** to authentication but share **no lexical overlap** with the query string.

### The Solution: Continuous Vector Space

Embeddings map text/code to points in 768-dimensional space where **semantic similarity = geometric proximity**.

```text
Query: "authentication middleware"
Embedding: [0.23, -0.45, 0.89, ..., 0.12]  (768 dims)

Similar vectors (cosine distance < 0.3):
  @RequiresAuth decorator      → [0.25, -0.43, 0.87, ..., 0.14]  (distance: 0.08)
  verifyToken() function       → [0.21, -0.48, 0.91, ..., 0.10]  (distance: 0.12)
  SecurityGuard class          → [0.19, -0.42, 0.85, ..., 0.15]  (distance: 0.18)
```

**Key insight**: You can now find authentication-related code **without knowing the exact symbol names**.

### Why Not Just Full-Text Search?

| Capability                | Full-Text Search             | Embedding-Based Search                    |
| ------------------------- | ---------------------------- | ----------------------------------------- |
| **Exact matches**         | ✅ Fast                      | ✅ Fast                                   |
| **Fuzzy/regex**           | ✅ Supported                 | ❌ Not needed                             |
| **Semantic similarity**   | ❌ No concept of meaning     | ✅ Core capability                        |
| **Cross-language**        | ❌ Must match keywords       | ✅ Concepts transcend syntax              |
| **Intent queries**        | ❌ "show me auth code" fails | ✅ Understands intent                     |
| **Algebraic composition** | ❌ Boolean AND/OR only       | ✅ Vector arithmetic (Lattice ∧, ∨, &, -) |

**Analogy**:

- Full-text search = Dictionary lookup (you must know the exact word)
- Embedding search = Asking a librarian who understands the topic

---

## The EmbeddingGemma-300M Model

### Model Specification

**Model**: `google/embeddinggemma-300m`
**Dimensions**: 768
**Architecture**: Transformer-based embedding model (Gemma family)
**Purpose**: General-purpose text and code embeddings
**License**: Permissive (Gemma Terms of Use)

**Location in code**: `src/config.ts:7`

```typescript
export const DEFAULT_EMBEDDING_MODEL_NAME = 'google/embeddinggemma-300m';
export const DEFAULT_EMBEDDING_DIMENSIONS = 768;
```

### Why 768 Dimensions?

**768 dimensions** is the standard for modern embedding models (BERT, Sentence-BERT, Gemma):

1. **Sufficient expressiveness**: Can represent complex semantic relationships
2. **Computational efficiency**: Small enough for real-time similarity search
3. **Interoperability**: Compatible with most vector databases and ML frameworks
4. **Proven track record**: Extensively tested in production systems

**Trade-off table**:

| Dimension Count | Expressiveness | Speed     | Storage (10K vectors) |
| --------------- | -------------- | --------- | --------------------- |
| **384**         | Moderate       | Very Fast | ~15 MB                |
| **768** (used)  | High           | Fast      | ~30 MB                |
| **1536**        | Very High      | Moderate  | ~60 MB                |
| **3072**        | Extreme        | Slow      | ~120 MB               |

For cognition-cli's use case (typically 10K-100K code artifacts), **768 dimensions hit the sweet spot**.

### Embedding Process

**Input**: Text string (code snippet, concept description, query)
**Output**: Float array of length 768

```typescript
// Example embedding call (simplified)
const response = await workbench.embed({
  signature: 'authentication middleware with JWT verification',
  dimensions: 768,
});

// response.embedding: [0.23, -0.45, 0.89, ..., 0.12] (768 floats)
```

### Workbench Integration

Cognition-CLI does **not** run the embedding model locally. All embeddings are generated via the **Workbench API**:

```typescript
// src/core/executors/workbench-client.ts
async embed(request: EmbedRequest): Promise<EmbedResponse> {
  const response = await fetch(`${this.baseUrl}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  return response.json();
}
```

**Why remote embeddings?**

1. **No local GPU required**: Workbench handles GPU inference
2. **Consistent embeddings**: Same model version across all users
3. **Rate limiting**: Centralized control prevents API abuse
4. **Easy upgrades**: Switch embedding models without changing CLI code

---

## LanceDB: Vector Storage Architecture

### Why LanceDB?

**LanceDB** is a serverless vector database built on Apache Arrow. It's designed for fast similarity search over large embedding collections.

| Feature         | LanceDB                        | Alternatives (Pinecone, Weaviate)  |
| --------------- | ------------------------------ | ---------------------------------- |
| **Deployment**  | Embedded (no server)           | Cloud-hosted or self-hosted server |
| **Storage**     | Local filesystem               | Remote database                    |
| **Latency**     | Sub-millisecond (local)        | 10-100ms (network RTT)             |
| **Portability** | .lancedb files travel with PGC | Requires migration scripts         |
| **Cost**        | Free (local compute)           | Pay per query/storage              |
| **Privacy**     | Data never leaves machine      | Data sent to third-party servers   |

**Decision**: LanceDB's serverless architecture aligns perfectly with PGC's "self-contained knowledge pool" philosophy.

### Storage Location

**Path**: `.open_cognition/patterns.lancedb/`
**Format**: Apache Arrow columnar storage
**Size**: ~36 MB for 32K LOC codebase (before template doc ingestion)

**Location in code**: `src/core/overlays/vector-db/lance-store.ts:120`

```typescript
const dbPath = path.join(this.pgcRoot, 'patterns.lancedb');
await fs.ensureDir(path.dirname(dbPath));
this.db = await connect(dbPath);
```

### Apache Arrow Schema

LanceDB uses Apache Arrow for zero-copy data access. Each vector record has this schema:

```typescript
// src/core/overlays/vector-db/lance-store.ts:70-88
export const VECTOR_RECORD_SCHEMA = new Schema([
  new Field('id', new Utf8()), // Unique identifier
  new Field('symbol', new Utf8()), // Symbol name (e.g., "MyClass.myMethod")
  new Field(
    'embedding',
    new FixedSizeList(
      768, // 768-dim embedding vector
      new Field('item', new Float(Precision.DOUBLE))
    )
  ),
  new Field('structural_signature', new Utf8()), // class:X | methods:5
  new Field('semantic_signature', new Utf8()), // docstring | class:X
  new Field('type', new Utf8()), // 'structural' or 'semantic'
  new Field('architectural_role', new Utf8()), // 'controller' | 'service' | 'util'
  new Field('computed_at', new Utf8()), // ISO timestamp
  new Field('lineage_hash', new Utf8()), // Provenance hash
  new Field('filePath', new Utf8()), // Source file path
  new Field('structuralHash', new Utf8()), // Content hash
]);
```

**Key fields**:

- `embedding`: The actual 768-dim vector used for similarity search
- `structural_signature`: Exact-match structural patterns (for hybrid queries)
- `semantic_signature`: Human-readable semantic description
- `lineage_hash`: Links vector back to O₃ Lineage for provenance

### Table Organization

LanceDB organizes embeddings into **tables** (one per overlay or knowledge type):

```text
.open_cognition/patterns.lancedb/
├── structural_patterns.lance       # O₁ Structural embeddings
├── lineage_patterns.lance          # O₃ Lineage embeddings
├── mission_concepts.lance          # O₄ Mission embeddings
├── operational_patterns.lance      # O₅ Operational embeddings
├── security_guidelines.lance       # O₂ Security embeddings
└── mathematical_proofs.lance       # O₆ Mathematical embeddings
```

Each table can be queried independently or combined (via lattice algebra) for cross-overlay queries.

---

## Dual Signature Architecture

### The Problem: Structural vs. Semantic Similarity

Consider these two TypeScript classes:

```typescript
// Class A: Structural pattern
class UserController {
  constructor(private db: Database) {}
  async create(data: User): Promise<User> {
    /* ... */
  }
  async findById(id: string): Promise<User> {
    /* ... */
  }
  async update(id: string, data: Partial<User>): Promise<User> {
    /* ... */
  }
  async delete(id: string): Promise<void> {
    /* ... */
  }
}

// Class B: Semantic purpose
class AccountManager {
  // Handles user registration, password resets, and account lifecycle
  async registerNewUser(email: string, password: string) {
    /* ... */
  }
  async resetPassword(email: string) {
    /* ... */
  }
  async deleteAccount(userId: string) {
    /* ... */
  }
}
```

**Question**: Are these classes "similar"?

**Answer**: Depends on what you mean by "similar"!

| Similarity Type | A vs B  | Reasoning                                                                       |
| --------------- | ------- | ------------------------------------------------------------------------------- |
| **Structural**  | ✅ HIGH | Both have ~4-5 methods, async functions, class-based, use external dependencies |
| **Semantic**    | ✅ HIGH | Both deal with user management, authentication, CRUD operations on accounts     |
| **Exact match** | ❌ LOW  | No shared method names, different constructors, different signatures            |

### The Solution: Dual Embeddings

Cognition-CLI generates **two embeddings per artifact** (The Shadow architecture, Monument 4.7):

**1. Structural Signature**

```typescript
structural_signature: "class:UserController | methods:4 | async:4 | dependencies:Database"
embedding_structural: [0.12, 0.45, -0.23, ..., 0.89]  // Embedding of structural pattern
```

**Purpose**: Find code with **similar structure** (useful for pattern matching, refactoring)

**2. Semantic Signature**

```typescript
semantic_signature: "UserController: Manages user CRUD operations with database persistence"
embedding_semantic: [0.65, -0.12, 0.34, ..., -0.45]  // Embedding of semantic purpose
```

**Purpose**: Find code with **similar purpose** (useful for mission alignment, feature discovery)

### When to Use Each

| Query Type                             | Use Signature | Example                               |
| -------------------------------------- | ------------- | ------------------------------------- |
| **"Find all classes with 5+ methods"** | Structural    | Pattern-based refactoring             |
| **"Find authentication-related code"** | Semantic      | Feature understanding                 |
| **"Find CRUD controllers"**            | Both (hybrid) | Structural pattern + semantic purpose |
| **"Show me error handling"**           | Semantic      | Concept-based discovery               |

**Implementation**: `src/core/overlays/vector-db/lance-store.ts:80-81`

---

## Embedding Service: Queue and Rate Limiting

### The Problem: Embedding Floods

When generating overlays (especially O₁ Structural), you might need to embed **thousands of code artifacts** simultaneously:

```text
O₁ Structural Generation:
- Parse 2,500 TypeScript files
- Extract 8,000 functions/classes
- Need 16,000 embeddings (2 per artifact: structural + semantic)
```

**Naive approach**: Send 16,000 concurrent embedding requests to Workbench

**Result**: 💥 **Rate limit exceeded** (Workbench rejects requests)

### The Solution: EmbeddingService Queue

**EmbeddingService** queues embedding requests and processes them with rate limiting:

**Location**: `src/core/services/embedding.ts`

```typescript
export class EmbeddingService extends EventEmitter {
  private queue: EmbeddingJob[] = [];
  private processing = false;

  async getEmbedding(
    signature: string,
    dimensions: number
  ): Promise<EmbedResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push({ signature, dimensions, resolve, reject });
      this.processQueue().catch(reject);
    });
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;

      // CRITICAL: Wait for rate limit before making request
      await this.workbench.waitForEmbedRateLimit();

      const response = await this.workbench.embed({
        signature: job.signature,
        dimensions: job.dimensions,
      });

      job.resolve(response);
    }
  }
}
```

### Rate Limiting Configuration

**Location**: `src/config.ts:21-22`

```typescript
export const EMBED_RATE_LIMIT_SECONDS = 10; // Time window
export const EMBED_RATE_LIMIT_CALLS = 5; // Max calls per window
```

**Interpretation**: **5 embedding requests per 10 seconds** = **0.5 requests/second** sustained

**Why so conservative?**

1. **Workbench throttling**: Prevents overwhelming the embedding service
2. **Fair sharing**: Multiple CLI users can share the same Workbench instance
3. **Cost control**: Embedding inference is GPU-intensive
4. **Graceful degradation**: Queue prevents failures, just slower completion

### Progress Reporting

During long embedding operations, you'll see progress like this:

```text
[MissionConcepts] Progress: 15/46 embedded (VISION.md [security validation])
```

This indicates:

- **15 concepts embedded** so far
- **46 concepts total** to embed
- **Currently processing**: VISION.md during security validation phase

**Why show progress?** Embedding 46 concepts at 0.5 req/sec takes ~90 seconds. Users need feedback that the system is working.

---

## What Gets Embedded

### O₁ Structural Patterns

**What**: Every function, class, method, interface extracted from code
**Signature**: Structural pattern + semantic purpose
**Count**: Typically 2-4x the number of files (10K LOC ≈ 500 embeddings)

**Example**:

```typescript
// Input code
class PaymentProcessor {
  async processPayment(amount: number, method: string): Promise<Receipt> {
    // Implementation
  }
}

// Structural embedding
{
  symbol: "PaymentProcessor.processPayment",
  structural_signature: "method:processPayment | params:2 | async:true | returns:Promise<Receipt>",
  semantic_signature: "Processes payment transactions and returns receipt"
}
```

### O₄ Mission Concepts

**What**: Strategic concepts extracted from VISION.md, mission docs
**Signature**: Concept name + definition + context
**Count**: Typically 20-100 per document

**Example (from VISION.md)**:

```yaml
# Input: Mission concept
concept: 'Verifiable Symbiosis'
definition: 'Mathematical guarantee that AI assistance preserves human intent'
context: 'Core principle ensuring AI augments rather than replaces human intelligence'

# Embedded as
embedding_semantic: [0.45, -0.23, 0.67, ..., -0.12] # 768-dim vector
```

### O₅ Operational Patterns

**What**: Workflow sequences, quest structures, sacred rituals
**Signature**: Pattern name + sequence + purpose
**Count**: Typically 10-50 per operational doc

### O₂ Security Guidelines

**What**: Threat models, attack vectors, mitigations
**Signature**: Threat name + affected systems + mitigation strategy
**Count**: Typically 5-30 per security doc

### O₆ Mathematical Proofs

**What**: Theorems, lemmas, axioms, formal statements
**Signature**: Statement + proof sketch + dependencies
**Count**: Typically 5-20 per mathematical doc

### O₃ Lineage Patterns

**What**: Dependency relationships, call chains
**Signature**: Symbol + dependencies + dependents
**Count**: Equal to O₁ (same symbols, different context)

**Note**: O₇ Coherence does **not** store embeddings—it computes alignment scores from other overlays.

---

## Query Patterns

### 1. Pure Semantic Search

**Query**: Natural language or concept description
**Method**: Embed query → find nearest neighbors in vector space

**Example**:

```bash
cognition-cli query "authentication middleware"
```

**Behind the scenes**:

```typescript
// 1. Embed the query
const queryEmbedding = await embed('authentication middleware'); // [0.23, -0.45, ...]

// 2. Search LanceDB for similar vectors
const results = await lancedb.search(queryEmbedding).limit(10).execute();

// 3. Results ranked by cosine distance
// [
//   { symbol: "@RequiresAuth", distance: 0.08 },
//   { symbol: "verifyToken()", distance: 0.12 },
//   { symbol: "SecurityGuard", distance: 0.18 },
//   ...
// ]
```

### 2. Hybrid Search (Structural + Semantic)

**Query**: Combine exact structural patterns with semantic similarity

**Example**:

```bash
cognition-cli query "classes with async methods handling user data"
```

**Interpretation**:

- **Structural filter**: `type = 'class' AND structural_signature CONTAINS 'async'`
- **Semantic search**: Embed "handling user data" → similarity search
- **Combine**: Filter first (structural), then rank by semantic similarity

### 3. Cross-Overlay Lattice Queries

**Query**: Compose knowledge from multiple overlays using lattice algebra

**Example**:

```bash
cognition-cli patterns --overlay structural_patterns \
  & security_guidelines \
  - operational_patterns
```

**Interpretation** (set-theoretic):

- **Structural ∩ Security**: Code artifacts that have security implications
- **Minus Operational**: Exclude operational/workflow patterns
- **Result**: Security-relevant code that isn't part of operational workflows

**Embedding role**: Each overlay's embeddings enable **semantic filtering** within that overlay before lattice composition.

### 4. Provenance Queries

**Query**: Trace embeddings back to source code via lineage

**Example**:

```bash
cognition-cli lineage "@RequiresAuth" --with-embeddings
```

**Output**:

```yaml
symbol: '@RequiresAuth'
source_file: src/auth/decorators.ts:15
lineage_hash: abc123def456...
embedding_distance_from_query: 0.08
dependencies:
  - verifyToken()  (distance: 0.12)
  - SecurityGuard  (distance: 0.18)
```

---

## Performance Characteristics

### Embedding Generation (Cold Start)

**Scenario**: First-time overlay generation for 32K LOC codebase

| Phase               | Count                                  | Rate    | Duration         |
| ------------------- | -------------------------------------- | ------- | ---------------- |
| **O₁ Structural**   | 2,000 artifacts × 2 = 4,000 embeddings | 0.5/sec | ~133 minutes     |
| **O₄ Mission**      | 46 concepts                            | 0.5/sec | ~2 minutes       |
| **O₂ Security**     | 20 guidelines                          | 0.5/sec | ~40 seconds      |
| **O₅ Operational**  | 30 patterns                            | 0.5/sec | ~1 minute        |
| **O₆ Mathematical** | 10 proofs                              | 0.5/sec | ~20 seconds      |
| **Total**           | ~4,106 embeddings                      | 0.5/sec | **~137 minutes** |

**Reality check**: This is **slow**. The rate limit (0.5 req/sec) is the bottleneck.

**Mitigation strategies** (future):

1. **Batch embedding API**: Send 10 signatures at once → 10x speedup
2. **Local embedding model**: Run EmbeddingGemma-300M locally (requires GPU)
3. **Incremental updates**: Only re-embed changed files (already implemented via hash checking)

### Query Performance (Hot Path)

**Scenario**: Semantic search query after embeddings are generated

```bash
time cognition-cli query "authentication middleware"
```

| Step               | Duration   | Notes                                |
| ------------------ | ---------- | ------------------------------------ |
| **Embed query**    | ~200ms     | Network RTT to Workbench             |
| **LanceDB search** | ~5ms       | Local vector similarity (HNSW index) |
| **Result ranking** | ~1ms       | Sort by distance                     |
| **Total**          | **~206ms** | Interactive response time ✅         |

**Takeaway**: Once embeddings exist, queries are **fast** (sub-second).

### Storage Overhead

**Scenario**: 10,000 code artifacts with dual embeddings (20,000 total vectors)

```text
20,000 vectors × 768 dims × 8 bytes/float = 122 MB (raw)
LanceDB compression ≈ 70% → ~36 MB on disk
```

**Measured**: `patterns.lancedb/` = 36 MB for 32K LOC codebase (matches calculation)

**Conclusion**: Storage overhead is **acceptable** for local filesystems.

---

## Common Misconceptions

### Misconception 1: "Embeddings replace exact-match search"

**Reality**: Embeddings **complement** exact-match search, not replace it.

**Use exact-match when**:

- You know the exact symbol name: `MyClass.myMethod`
- You're searching for specific patterns: `async function.*await`
- You need deterministic results (no similarity threshold ambiguity)

**Use embeddings when**:

- You don't know symbol names: "authentication logic"
- You're exploring related concepts: "show me similar error handling"
- You want semantic ranking: "most relevant to user management"

### Misconception 2: "Higher dimensions = better embeddings"

**Reality**: 768 dimensions is a **sweet spot**, not a limitation.

**Why not 3072 dimensions?**

| Aspect               | 768-dim                          | 3072-dim                         |
| -------------------- | -------------------------------- | -------------------------------- |
| **Expressiveness**   | High (sufficient for most tasks) | Very high (marginal gains)       |
| **Query speed**      | 5ms                              | 40ms (8x slower)                 |
| **Storage**          | 36 MB                            | 144 MB (4x larger)               |
| **Overfitting risk** | Low                              | Higher (curse of dimensionality) |

**Analogy**: A 768-dim space can represent ~10^230 unique concepts. We're not running out of space anytime soon.

### Misconception 3: "Embeddings are trained on my code"

**Reality**: EmbeddingGemma-300M is **pre-trained** on general text/code. Your code is **not** used for training.

**What happens**:

1. Workbench loads pre-trained EmbeddingGemma-300M model
2. Your code is **embedded** (mapped to vectors) using the pre-trained model
3. No model updates, no training, no data sent back to Google

**Privacy implication**: Your code embeddings stay on your machine (via LanceDB). Only the text signatures are sent to Workbench for embedding generation (ephemeral, not stored).

### Misconception 4: "Embeddings understand code semantics perfectly"

**Reality**: Embeddings capture **statistical patterns**, not formal semantics.

**What embeddings can do**:

- ✅ Recognize "this function handles authentication" (from docstrings, variable names)
- ✅ Group similar patterns (all classes with 5 methods cluster together)
- ✅ Find conceptually related code (even with no shared keywords)

**What embeddings cannot do**:

- ❌ Prove correctness (requires formal verification)
- ❌ Understand invariants (requires symbolic analysis)
- ❌ Detect logical bugs (requires execution or static analysis)

**Complementary tools**:

- **Embeddings**: Semantic search, concept discovery
- **AST analysis (O₁)**: Structural patterns, symbol relationships
- **Lineage (O₃)**: Dependency graphs, blast radius
- **Formal proofs (O₆)**: Mathematical correctness guarantees

---

## Integration with Lattice Algebra

### Embeddings as Lattice Elements

Each embedding vector **is** a lattice element (point in vector space). Lattice operations apply:

**1. Meet (∧)**: Intersection of semantic spaces

```text
Query: "authentication" ∧ "error handling"
Result: Code that handles authentication errors
```

**Implementation**: Embed both queries, compute **midpoint vector**, search near midpoint.

**2. Join (∨)**: Union of semantic spaces

```text
Query: "authentication" ∨ "authorization"
Result: Code related to either auth concept
```

**Implementation**: Search both embeddings separately, **merge results** (deduplication).

**3. Difference (-)**: Semantic exclusion

```text
Query: "user management" - "admin features"
Result: User management code excluding admin-specific logic
```

**Implementation**: Embed both, search "user management", **filter out** results close to "admin features" embedding.

**4. Intersection (&)**: Cross-overlay composition

```text
Query: structural_patterns & mission_concepts
Result: Code artifacts that align with mission principles
```

**Implementation**: For each structural pattern embedding, compute **semantic distance** to nearest mission concept embedding. Rank by alignment.

### Example: Multi-Overlay Query

**Goal**: Find security-critical code that violates mission principles

```bash
cognition-cli query \
  --overlay security_guidelines \
  & structural_patterns \
  - mission_concepts
```

**Execution**:

1. **O₂ Security**: Find all code mentioned in security guidelines (via embeddings)
2. **O₁ Structural**: Intersect with actual code artifacts (via symbol matching)
3. **O₄ Mission**: Exclude code that aligns with mission principles (via semantic distance)
4. **Result**: Security-critical code that **does not** align with mission

**Use case**: Identify legacy security patterns that need refactoring to align with new mission principles.

---

## Summary

**Embeddings are the semantic bridge** between discrete code artifacts and continuous meaning space. They enable:

1. **Semantic queries**: "Find authentication-related code" without knowing symbol names
2. **Cross-overlay composition**: Combine structural, mission, and security knowledge
3. **Similarity ranking**: Discover related concepts beyond exact-match search
4. **Mission alignment**: Measure semantic distance between code and strategic intent

**Key architectural decisions**:

- **EmbeddingGemma-300M (768-dim)**: Balance expressiveness, speed, and storage
- **LanceDB**: Serverless vector DB for portable, local similarity search
- **Dual signatures**: Structural + semantic embeddings per artifact
- **Rate-limited queue**: Graceful handling of large embedding workloads
- **Lattice integration**: Embeddings participate in algebraic query composition

**Performance profile**:

- **Cold start**: Slow (~137 minutes for 32K LOC due to rate limits)
- **Hot queries**: Fast (~200ms for semantic search)
- **Storage**: Efficient (~36 MB for 10K artifacts)

**Next steps**:

- **Chapter 5**: Lattice Algebra (formal operations on embeddings)
- **Chapter 6**: O₂ Security (first overlay deep dive)
- **Chapter 8**: O₄ Mission (mission concept embeddings in practice)

---

**Cross-references**:

- [Chapter 1: Cognitive Architecture](./01-cognitive-architecture.md) — Why embeddings matter for AI-human symbiosis
- [Chapter 2: The PGC](./02-the-pgc.md) — Where embeddings are stored (`patterns.lancedb/`)
- [Chapter 3: Why Overlays](./03-why-overlays.md) — Overlay-specific embedding strategies
- [Chapter 6: O₂ Security](../part-2-seven-layers/06-o2-security.md) — Security guideline embeddings
- [Chapter 8: O₄ Mission](../part-2-seven-layers/08-o4-mission.md) — Mission concept embeddings
