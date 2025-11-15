# ADR-003: Shadow Embeddings (Dual Embedding System)

**Date**: October 28, 2025 (Monument 4.7)
**Status**: Accepted
**Deciders**: Core team
**Monument**: 4.7 - "The Shadow"

## Context

The O₁ Structure overlay initially used a single embedding per code symbol, capturing structural metadata:

```typescript
'class:UserService | extends:BaseService | methods:5 | decorators:1';
```

This worked well for **architectural pattern matching** ("Find functions similar to `authenticate()`"), but failed for **mission alignment queries** ("Find code implementing user privacy principles").

**The Problem:**

Code symbols have two fundamentally different semantic projections:

1. **The Body** (Structural) - Pure architecture: class hierarchies, method counts, parameter types
2. **The Shadow** (Semantic) - Purpose and meaning: docstrings, business logic intent

A single embedding cannot simultaneously optimize for:

- Pattern matching: "Find services extending BaseService with 5+ methods"
- Mission alignment: "Find code prioritizing user consent and data privacy"

We needed a dual embedding system where each symbol projects into both structural and semantic vector spaces.

## Decision

We implemented **Monument 4.7: The Shadow Architecture**, where every code symbol generates **two 768-dimensional embeddings**:

**The Body (Structural Embedding):**

- **Input**: Pure structural signature
- **Example**: `"class:AuthService | extends:BaseService | methods:8 | decorators:2"`
- **Purpose**: Architectural pattern matching
- **Vector ID**: `pattern_{path}_{symbol}`
- **Type**: `'structural'`

**The Shadow (Semantic Embedding):**

- **Input**: Docstring + type context
- **Example**: `"Manages user authentication and authorization | class:AuthService"`
- **Purpose**: Mission coherence and semantic search
- **Vector ID**: `pattern_semantic_{path}_{symbol}`
- **Type**: `'semantic'`

Both embeddings stored in LanceDB with metadata field `type: 'structural' | 'semantic'` for filtering.

**Code References:**

- Signature generation: `src/core/overlays/structural/worker.ts:85-198`
- Dual embedding: `src/core/overlays/structural/patterns.ts:346-498`
- Manager: `src/core/overlays/structural-patterns/manager.ts:32-36`

## Alternatives Considered

### Option 1: Single Hybrid Embedding

- **Pros**: Simple—one embedding per symbol, half storage cost
- **Cons**:
  - Mixed signal: structural metadata and semantic meaning in one vector
  - Cannot optimize for both pattern matching and mission alignment
  - Queries return inconsistent results (structure vs. meaning confusion)
  - Cannot filter by query type
- **Why rejected**: Violates separation of concerns; cognitive mismatch between query types

### Option 2: Concatenated Signature (Single Embedding)

- **Pros**: Both structural and semantic data in one signature
- **Example**: `"class:AuthService | extends:BaseService | methods:8 | Manages user authentication"`
- **Cons**:
  - Embedding model sees mixed signal (architecture + purpose)
  - Cannot weight structural vs. semantic components independently
  - Pattern matching contaminated by docstring variations
  - Mission alignment contaminated by structural boilerplate
- **Why rejected**: Mixing orthogonal signals degrades both use cases

### Option 3: Separate Overlays (O₁ Structure, O₁-Semantic)

- **Pros**: Complete separation at overlay level
- **Cons**:
  - Violates seven-overlay architecture (would become eight)
  - Duplicate storage of symbol metadata
  - Two overlay managers for same conceptual layer
  - Complexity in knowing which overlay to query
- **Why rejected**: Architectural bloat; separation should be at vector level, not overlay level

### Option 4: Embedding Only Docstrings (No Structural)

- **Pros**: Optimized for semantic search
- **Cons**:
  - Cannot perform architectural pattern matching
  - "Find functions with similar signatures" impossible
  - Loses refactoring assistance (structural similarity)
  - Not all symbols have docstrings (incomplete coverage)
- **Why rejected**: Sacrifices critical pattern-matching capability

## Rationale

The dual embedding system solves three distinct problems:

### 1. Pattern Matching (The Body)

**Use Case**: "Find functions that take `userId` and return `Promise<User>`"

**Structural Embedding Input:**

```
function:authenticate | params:userId,password | returns:Promise<User>
```

**Why Structural Works:**

- Focuses on type signatures, parameter order, return types
- Ignores semantic meaning (what authentication means philosophically)
- Finds architectural clones even if docstrings differ

**Code**: `src/core/overlays/structural/worker.ts:139-198`

### 2. Mission Alignment (The Shadow)

**Use Case**: "Find code implementing privacy-preserving patterns"

**Semantic Embedding Input:**

```
Handles user authentication with privacy-preserving session management | class:AuthService
```

**Why Semantic Works:**

- Focuses on purpose and intent from docstrings
- Ignores structural boilerplate (extends, implements, decorators)
- Finds mission-aligned code even if architectures differ

**Code**: `src/core/overlays/structural/worker.ts:85-132`

### 3. Strategic Coherence (O₇ Integration)

**Use Case**: Cross-layer alignment between code (O₁) and mission (O₄)

**Algorithm** (`src/core/overlays/strategic-coherence/manager.ts:189-214`):

```typescript
// 1. Filter for semantic vectors (the shadow)
const semanticVectors = vectorRecords.filter(
  (v) => v.metadata.type === 'semantic'
);

// 2. Compute cosine similarity between semantic vectors and mission concepts
for (const codeVector of semanticVectors) {
  for (const missionVector of missionConcepts) {
    const similarity = cosineSimilarity(
      codeVector.embedding,
      missionVector.embedding
    );
    // Higher similarity = better alignment
  }
}
```

**Why Shadow Works:**

- Semantic embeddings capture purpose (align with mission concepts)
- Structural embeddings would compare architecture to mission (nonsensical)
- O₇ coherence queries require semantic projection

## Consequences

### Positive

- **Dual-purpose queries** - Same overlay supports pattern matching AND mission alignment
- **Better relevance** - Structural queries not contaminated by semantic variations
- **Mission coherence** - O₇ can compute alignment using semantic projections
- **Fallback graceful** - If no semantic signature (missing docstring), structural still works
- **Refactoring assistance** - Structural similarity finds architectural clones for refactoring
- **Semantic search** - Find code by purpose, not just structure

### Negative

- **Storage cost doubled** - Two vectors per symbol (~72 MB for 32K LOC vs. ~36 MB)
- **Embedding API cost** - Two API calls per symbol (2× workbench usage)
- **Processing time** - Dual embedding generation takes ~2× longer
- **Query complexity** - Users must understand when to filter by `type='structural'` vs `type='semantic'`

### Neutral

- **LanceDB filtering** - Requires metadata filtering (`WHERE type='semantic'`)
- **Incomplete coverage** - Symbols without docstrings have no semantic vector (acceptable)
- **Schema complexity** - VECTOR_RECORD_SCHEMA includes `type` field

## Evidence

### Code Implementation

- Signature generation:
  - Structural: `src/core/overlays/structural/worker.ts:139-198`
  - Semantic: `src/core/overlays/structural/worker.ts:85-132`
- Dual embedding: `src/core/overlays/structural/patterns.ts:346-498`
- Storage schema: `src/core/overlays/vector-db/lance-store.ts:68-88` (VECTOR_RECORD_SCHEMA with `type` field)
- Coherence integration: `src/core/overlays/strategic-coherence/manager.ts:189-214`

### Documentation

- Shadow architecture: `docs/overlays/O1_structure/STRUCTURAL_PATTERNS.md:90-109`
- Manager comments: `src/core/overlays/structural-patterns/manager.ts:32-36`

### Innovation Disclosure

From `VISION.md:179-180`:

> **Published**: October 28, 2025
>
> **Monument 4.7: The Shadow:** Dual embedding system for structural and semantic signatures enabling both code pattern matching and mission alignment queries

### Data Schema

```typescript
// From lance-store.ts:68-88
export const VECTOR_RECORD_SCHEMA = new Schema([
  new Field('id', new Utf8()),
  new Field('symbol', new Utf8()),
  new Field('embedding', new FixedSizeList(768, ...)), // 768-dim vector
  new Field('structural_signature', new Utf8()),  // The body
  new Field('semantic_signature', new Utf8()),    // The shadow
  new Field('type', new Utf8()),                  // 'structural' or 'semantic'
  // ... other fields
]);
```

## Notes

**Monument Designation:**

This decision is formally designated as **Monument 4.7** in the CogX innovation timeline, indicating its architectural significance.

**Design Insight:**

The shadow metaphor is deliberate: just as a physical object casts a shadow that reveals its shape from a different angle, every code symbol casts a semantic shadow (docstring + purpose) that reveals its meaning from a mission-alignment angle.

**Storage Calculation:**

- 4,106 symbols × 2 vectors × 768 dims × 8 bytes = ~48 MB raw
- LanceDB compression: ~70% → ~14 MB overhead vs. single embedding
- Acceptable trade-off for dual-purpose capability

**Future Enhancements:**

- Tri-embedding system? (structural, semantic, dependency-graph)
- Sparse embedding updates (regenerate only semantic when docstring changes)
- Embedding versioning (track structural vs. semantic staleness independently)

**Related Decisions:**

- ADR-001 (LanceDB) - Provides storage for dual vectors with metadata filtering
- ADR-002 (Seven Overlays) - Shadow enables O₁ to serve both pattern matching and O₇ coherence
- ADR-007 (Coherence) - Uses semantic vectors exclusively for mission alignment
