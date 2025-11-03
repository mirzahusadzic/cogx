# Overlay Algebra System

> **Boolean algebra for cognitive overlays. Build powerful primitives, compose UX sugar on top.**

## Architecture Overview

This directory implements the foundational algebra for lattice operations across all PGC overlays.

### Core Concepts

```
Every Overlay implements OverlayAlgebra
    ↓
Every Overlay gains algebraic operations (Meet, Union, Intersection, etc.)
    ↓
Complex queries become compositions of simple operations
    ↓
CLI commands are syntactic sugar over algebra
```

---

## Files

### `overlay-algebra.ts` ✅ COMPLETE

Universal interface that all overlay managers must implement.

**Key interfaces:**

- `OverlayAlgebra<T>` - The contract every overlay implements
- `OverlayItem<T>` - Universal item format with embedding + metadata
- `MeetResult<A, B>` - Result of semantic alignment operation
- `SetOperationResult<T>` - Result of set operations (union, intersection, etc.)

**Core methods:**

- `getAllItems()` - Get all items with embeddings
- `getItemsByType(type)` - Filter by domain-specific type
- `filter(predicate)` - Metadata-based filtering
- `query(text, topK)` - Semantic search
- `select(options)` - Filter by symbol/ID sets
- `exclude(options)` - Remove by symbol/ID sets
- `getSymbolSet()` - Get unique symbols for set operations
- `getIdSet()` - Get unique IDs for exact matching

### `lattice-operations.ts` ✅ COMPLETE

Pure functions implementing boolean algebra over overlays.

**Semantic operations (vector-based):**

- `meet(A, B, options)` - Find alignment via cosine similarity
- `project(query, from, to)` - Query-guided traversal

**Set operations (exact matching):**

- `union(sets)` - Combine items from multiple overlays
- `intersection(sets)` - Items present in ALL overlays
- `difference(A, B)` - Items in A but not in B
- `complement(universal, exclusion)` - Items NOT in set

**Symbol-level operations:**

- `symbolDifference(A, B)` - Symbols in A not in B
- `symbolIntersection(A, B)` - Symbols in both
- `symbolUnion(A, B)` - All symbols from both

### `overlay-registry.ts` ✅ COMPLETE

Central registry mapping overlay IDs (O1-O7) to manager instances.

**Features:**

- Lazy initialization (managers created on demand)
- Type-safe overlay lookup
- Metadata about each overlay (name, description, supported types)
- Check which overlays have data

**Note:** All managers are currently cast as `any` because they don't yet implement `OverlayAlgebra`. This is the next step.

---

## Usage Examples

### Example 1: Security Coverage Gaps

```typescript
import { createOverlayRegistry } from './overlay-registry.js';
import { symbolDifference } from './lattice-operations.js';

const registry = createOverlayRegistry(pgcRoot);
const structural = await registry.get('O1');
const security = await registry.get('O2');

// Which code symbols lack security guidelines?
const codeSymbols = await structural.getSymbolSet();
const secureSymbols = await security.getSymbolSet();
const gaps = symbolDifference(codeSymbols, secureSymbols);

console.log(`${gaps.size} symbols lack security coverage`);
```

### Example 2: Semantic Alignment (Meet)

```typescript
import { meet } from './lattice-operations.js';

const security = await registry.get('O2');
const mission = await registry.get('O4');

// Which attack vectors violate mission principles?
const attacks = await security.getItemsByType('attack_vector');
const principles = await mission.getItemsByType('principle');

const violations = await meet(attacks, principles, { threshold: 0.8 });

for (const { itemA, itemB, similarity } of violations) {
  console.log(`Attack: ${itemA.metadata.text}`);
  console.log(`Violates: ${itemB.metadata.text}`);
  console.log(`Similarity: ${similarity.toFixed(2)}`);
}
```

### Example 3: Query Projection

```typescript
import { project } from './lattice-operations.js';

const operational = await registry.get('O5');
const security = await registry.get('O2');

// Given workflow patterns for "handling user input", what security applies?
const guidance = await project(
  'handle user authentication',
  operational,
  security,
  {
    threshold: 0.7,
  }
);
```

### Example 4: Set Operations

```typescript
import { union, intersection, difference } from './lattice-operations.js';

const security = await registry.get('O2');
const mission = await registry.get('O4');

// Items that are BOTH security constraints AND mission principles
const constraints = await security.getItemsByType('constraint');
const principles = await mission.getItemsByType('principle');
const shared = intersection([constraints, principles], ['O2', 'O4']);

console.log(`${shared.items.length} items are both security AND mission`);
```

### Example 5: Symbol-Specific Security

```typescript
const security = await registry.get('O2');

// Get security guidelines for specific symbols only
const authSymbols = new Set(['handleLogin', 'validateToken', 'refreshSession']);
const authGuidelines = await security.select({ symbols: authSymbols });

console.log(`Found ${authGuidelines.length} security guidelines for auth`);
```

---

## CLI Design

### Raw Algebra (Power Users)

```bash
# Which symbols lack security coverage?
cognition-cli lattice "difference(O1.symbols, O2.symbols)"

# Security items that align with mission principles
cognition-cli lattice "meet(O2.constraints, O4.principles, threshold=0.8)"

# Workflow patterns for handling input → security guidelines
cognition-cli lattice "project('handle user input', O5 -> O2)"

# Items in BOTH security AND mission
cognition-cli lattice "intersection(O2.constraints, O4.principles)"

# All guidelines EXCEPT vulnerabilities
cognition-cli lattice "difference(O2.*, O2.vulnerability)"
```

### UX Sugar (Convenience Commands)

```bash
# Security commands (built on algebra)
cognition-cli security attacks --align-with mission
  → translates to: lattice "meet(O2.attacks, O4.principles)"

cognition-cli security coverage-gaps
  → translates to: lattice "difference(O1.symbols, O2.symbols)"

# Workflow commands
cognition-cli workflow patterns --secure
  → translates to: lattice "meet(O5.workflows, O2.boundaries)"

# Coherence (already exists, will be refactored to use algebra)
cognition-cli coherence report
  → translates to: lattice "meet(O1.symbols, O4.concepts)"
```

---

## Implementation Status

### ✅ Complete (Foundational Layer)

1. **`overlay-algebra.ts`** - Interface definition
2. **`lattice-operations.ts`** - Core operations (meet, union, intersection, etc.)
3. **`overlay-registry.ts`** - Central overlay lookup

### 🔨 In Progress (Manager Refactoring)

Need to refactor each manager to implement `OverlayAlgebra`:

4. **SecurityGuidelinesManager** (`src/core/overlays/security-guidelines/manager.ts`)
5. **OperationalPatternsManager** (`src/core/overlays/operational-patterns/manager.ts`)
6. **MissionConceptsManager** (`src/core/overlays/mission-concepts/manager.ts`)
7. **MathematicalProofsManager** (`src/core/overlays/mathematical-proofs/manager.ts`)
8. **StrategicCoherenceManager** (`src/core/overlays/strategic-coherence/manager.ts`)
9. **LineagePatternsManager** (`src/core/overlays/lineage/manager.ts`)
10. **StructuralPatternsManager** (`src/core/overlays/structural/patterns.ts`)

### 📋 Pending (Query Layer)

11. **Query Engine** - Parse algebra expressions like `"meet(O2, O4)"`
12. **Lattice CLI Command** - `cognition-cli lattice <expression>`
13. **Sugar Commands** - Security, workflow, proofs commands
14. **Refactor Coherence** - Use algebra instead of manual loops

---

## Design Principles

### 1. Build Primitives First

Every complex query decomposes into primitive operations (meet, union, filter).

### 2. Universal Interface

Every overlay speaks the same language (`OverlayAlgebra`), enabling composition.

### 3. Type Safety

Domain-specific metadata types are preserved through generic interfaces.

### 4. Lazy Evaluation

Overlays are loaded on demand (not all at startup).

### 5. Composability

Operations chain: `meet(filter(A), filter(B))` just works.

---

## Next Steps

1. **Refactor SecurityGuidelinesManager** to implement `OverlayAlgebra`
   - Add `getAllItems()`, `filter()`, `select()`, `exclude()`
   - Add `getSymbolSet()`, `getIdSet()`
   - Implement domain-specific types

2. **Repeat for all other managers** (O1, O3, O4, O5, O6, O7)

3. **Build query engine** to parse expressions like:

   ```
   "meet(O2.attacks, O4.principles, threshold=0.8)"
   "difference(O1.symbols, O2.symbols)"
   ```

4. **Create `cognition-cli lattice` command** that uses the query engine

5. **Build sugar commands** (`security`, `workflow`, etc.) on top of algebra

6. **Refactor coherence command** to use `meet()` instead of manual loops

---

## Questions & Design Decisions

### Q: Should we support n-way Meet?

Currently `meet(A, B)` is binary. Should we support `meet(A, B, C, ...)`?

**Answer:** Yes, but as composition:

```typescript
meet(meet(A, B), C); // Equivalent to meet(A, B, C)
```

### Q: How do we handle overlays without embeddings?

Some overlays (like O3 Lineage) may not have semantic embeddings.

**Answer:** They can still participate in set operations (union, intersection, difference), just not semantic operations (meet, project).

### Q: Should set operations work across different metadata types?

Can we do `union([O2.attacks, O4.concepts])`?

**Answer:** Yes, but the result type is `OverlayMetadata` (base type). Domain-specific fields are preserved but not type-checked.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   CLI Commands (UX Sugar)               │
│  security, workflow, coherence, proofs, lattice         │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────┐
│                Query Engine (Future)                    │
│  Parse: "meet(O2.attacks, O4.principles)"               │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────┐
│         Lattice Operations (lattice-operations.ts)      │
│  meet, union, intersection, difference, project         │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────┐
│         Overlay Registry (overlay-registry.ts)          │
│  Map O1-O7 → Manager instances                          │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────┐
│      Overlay Algebra Interface (overlay-algebra.ts)     │
│  Universal contract for all overlays                    │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────┴────────────────────────────────────┐
│              Overlay Managers (TODO: Refactor)           │
│  SecurityGuidelinesManager, MissionConceptsManager, etc. │
└──────────────────────────────────────────────────────────┘
```

---

**Status:** Foundation complete. Ready to refactor managers to implement OverlayAlgebra.
