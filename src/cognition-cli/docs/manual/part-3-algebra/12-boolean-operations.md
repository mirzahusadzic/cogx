---
type: mathematical
overlay: O6_Mathematical
---

# Chapter 12: Boolean Operations on Knowledge

> **The Axiom Applied**: When you query "O2 ∧ O4" (security Meet mission), you're not searching—you're computing the greatest lower bound in a knowledge lattice. This is why compositional queries work. This is why overlays compose. This is why the algebra is complete.

**Part**: III — The Algebra<br/>
**Chapter**: 12<br/>
**Focus**: Boolean Operations, Meet/Union/Intersection/Difference<br/>
**Implementation**: `src/core/algebra/`<br/>

---

## Table of Contents

1. [The Problem: Querying Across Cognitive Layers](#the-problem-querying-across-cognitive-layers)
2. [Core Operations](#core-operations)
3. [Composing Operations](#composing-operations)
4. [The Universal Interface: OverlayAlgebra](#the-universal-interface-overlayalgebra)
5. [Implementation Architecture](#implementation-architecture)
6. [Performance Characteristics](#performance-characteristics)
7. [Real-World Examples](#real-world-examples)
8. [Design Decisions](#design-decisions)
9. [Extension Points](#extension-points)
10. [Testing](#testing)
11. [Common Pitfalls](#common-pitfalls)
12. [Future Directions](#future-directions)

---

## The Problem: Querying Across Cognitive Layers

Traditional approaches to querying knowledge systems fall into two camps:

1. **Exact Matching** (SQL, NoSQL)
   - Fast, precise
   - Brittle: requires exact field matches
   - Can't handle semantic similarity

2. **Semantic Search** (Vector DBs)
   - Handles similarity well
   - Hard to compose queries
   - No set operations

**The Lattice Algebra combines both**: exact set operations (union, intersection, difference) with semantic operations (meet, project).

---

## Core Operations

### Semantic Operations (Vector-Based)

These operations use **cosine similarity** on 768-dimensional embeddings to find semantic alignment.

#### Meet (∧)

**Definition**: Find items from overlay A that are semantically aligned with items from overlay B.

**Signature**:

```typescript
meet<A, B>(
  itemsA: OverlayItem<A>[],
  itemsB: OverlayItem<B>[],
  options: { threshold?: number, topK?: number }
): Promise<MeetResult<A, B>[]>
```

**Returns**: Pairs `(itemA, itemB, similarity)` where `cosine_similarity(A.embedding, B.embedding) >= threshold`.

**Use Cases**:

- Which attack vectors violate mission principles?
- Which code symbols align with security guidelines?
- Which workflow patterns support strategic goals?

**Example**:

```typescript
import { meet } from './lattice-operations.js';

const security = await registry.get('O2');
const mission = await registry.get('O4');

const attacks = await security.getItemsByType('attack_vector');
const principles = await mission.getItemsByType('principle');

// Find attacks that violate principles (high similarity = violation)
const violations = await meet(attacks, principles, { threshold: 0.8 });

for (const { itemA, itemB, similarity } of violations) {
  console.log(`Attack: ${itemA.metadata.text}`);
  console.log(`Violates: ${itemB.metadata.text}`);
  console.log(`Similarity: ${(similarity * 100).toFixed(1)}%`);
}
```

**CLI Syntax**:

```bash
cognition-cli lattice "O2[attacks] ~ O4[principles]"
```

**How It Works**:

1. Create temporary vector store for `itemsB`
2. For each item in `itemsA`, run similarity search against `itemsB`
3. Filter results by threshold
4. Sort by similarity (descending)

**Performance**: O(n × log m) where n = |itemsA|, m = |itemsB| (uses LanceDB's ANN search)

---

#### Project (→)

**Definition**: Query-guided traversal from one overlay to another.

**Signature**:

```typescript
project<A, B>(
  query: string,
  from: OverlayAlgebra<A>,
  to: OverlayAlgebra<B>,
  options: { threshold?: number, topK?: number }
): Promise<MeetResult<A, B>[]>
```

**Returns**: Items from target overlay that are semantically related to query results from source overlay.

**Use Cases**:

- "Given workflow patterns for 'handling user input', what security guidelines apply?"
- "For code symbols related to 'authentication', what mission concepts are relevant?"

**Example**:

```typescript
import { project } from './lattice-operations.js';

const operational = await registry.get('O5');
const security = await registry.get('O2');

// Find security guidelines for workflows about "user authentication"
const guidance = await project(
  'handle user authentication',
  operational, // Source: O₅ Operational
  security, // Target: O₂ Security
  { threshold: 0.7, topK: 5 }
);
```

**CLI Syntax**:

```bash
cognition-cli lattice "O5 -> O2" --query "handle user authentication"
```

**How It Works**:

1. Embed the query string (768d vector)
2. Find top-K items in source overlay matching query
3. Run `meet()` between source results and target overlay
4. Return aligned pairs

---

### Set Operations (Exact Matching)

These operations use **item IDs** for exact matching (no embedding similarity).

#### Union (∪)

**Definition**: Combine items from multiple overlays. Deduplicates by ID.

**Signature**:

```typescript
union<T>(
  itemSets: OverlayItem<T>[][],
  sourceOverlays: string[]
): SetOperationResult<T>
```

**Use Cases**:

- Combine security and operational guidelines
- Merge concepts from multiple documents
- Aggregate knowledge across overlays

**Example**:

```typescript
import { union } from './lattice-operations.js';

const security = await registry.get('O2');
const operational = await registry.get('O5');

const securityGuidelines = await security.getAllItems();
const workflowPatterns = await operational.getAllItems();

const allGuidance = union([securityGuidelines, workflowPatterns], ['O2', 'O5']);

console.log(`Combined: ${allGuidance.items.length} items`);
```

**CLI Syntax**:

```bash
cognition-cli lattice "O2 + O5"
cognition-cli lattice "O2 | O5"  # Alternative
```

---

#### Intersection (∩)

**Definition**: Items present in **ALL** overlays (matched by ID).

**Signature**:

```typescript
intersection<T>(
  itemSets: OverlayItem<T>[][],
  sourceOverlays: string[]
): SetOperationResult<T>
```

**Use Cases**:

- Find items that are BOTH security constraints AND mission principles
- Identify common patterns across overlays

**Example**:

```typescript
import { intersection } from './lattice-operations.js';

const constraints = await security.getItemsByType('constraint');
const principles = await mission.getItemsByType('principle');

// Items that appear in BOTH sets (same ID)
const shared = intersection([constraints, principles], ['O2', 'O4']);

console.log(`${shared.items.length} items are both security AND mission`);
```

**CLI Syntax**:

```bash
cognition-cli lattice "O2 & O4"
cognition-cli lattice "O2 AND O4"  # SQL-style
```

**Note**: This is **exact ID matching**, not semantic similarity. For semantic intersection, use `meet()` with high threshold (≥0.9).

---

#### Difference (\)

**Definition**: Items in A but **NOT** in B (by ID).

**Signature**:

```typescript
difference<T>(
  itemsA: OverlayItem<T>[],
  itemsB: OverlayItem<T>[],
  sourceOverlays: [string, string]
): SetOperationResult<T>
```

**Use Cases**:

- **Coverage gap analysis**: Which code symbols lack security guidelines?
- Which mission concepts have no workflow patterns?
- Which attacks have no mitigations?

**Example**:

```typescript
import { difference } from './lattice-operations.js';

const codeSymbols = await structural.getAllItems();
const securityGuidelines = await security.getAllItems();

// Which symbols have NO security coverage?
const uncovered = difference(codeSymbols, securityGuidelines, ['O1', 'O2']);

console.log(`${uncovered.items.length} symbols lack security coverage`);
```

**CLI Syntax**:

```bash
cognition-cli lattice "O1 - O2"   # Coverage gaps
cognition-cli lattice "O1 \ O2"   # Alternative
```

**Most Common Use Case**:

```bash
# Which code symbols are not covered by security guidelines?
cognition-cli lattice "O1 - O2"
```

---

#### Complement (¬)

**Definition**: Items NOT in the given set (relative to a universal set).

**Signature**:

```typescript
complement<T>(
  universalSet: OverlayItem<T>[],
  exclusionSet: OverlayItem<T>[],
  sourceOverlays: [string, string]
): SetOperationResult<T>
```

**Use Cases**:

- All code symbols that have NO security guidelines
- Same as `difference(universal, exclusion)`

**CLI Syntax**:

```bash
cognition-cli lattice "!O2"       # Items NOT in O2
cognition-cli lattice "NOT O2"    # SQL-style
```

**Note**: Complement requires specifying a universal set. In practice, use `difference()` instead:

```bash
# Instead of: !(O2)
# Use: O1 - O2  (code symbols not in security)
```

---

### Symbol-Level Set Operations

These operate directly on **symbol sets** (strings), not items with embeddings.

#### Symbol Difference

**Definition**: Symbols in set A but not in set B.

**Signature**:

```typescript
symbolDifference(
  symbolsA: Set<string>,
  symbolsB: Set<string>
): Set<string>
```

**Use Cases**:

- Fast coverage gap analysis (no item retrieval)
- Set algebra on symbol identifiers

**Example**:

```typescript
import { symbolDifference } from './lattice-operations.js';

const codeSymbols = await structural.getSymbolSet();
const securedSymbols = await security.getSymbolSet();

const gaps = symbolDifference(codeSymbols, securedSymbols);

console.log(`${gaps.size} symbols lack security coverage`);
for (const symbol of Array.from(gaps).slice(0, 10)) {
  console.log(`  - ${symbol}`);
}
```

**Performance**: O(n + m) — much faster than item-level operations.

---

#### Symbol Intersection & Union

**Signatures**:

```typescript
symbolIntersection(symbolsA: Set<string>, symbolsB: Set<string>): Set<string>
symbolUnion(symbolsA: Set<string>, symbolsB: Set<string>): Set<string>
```

**Use Cases**:

- Fast set membership checks
- Pre-filtering before expensive operations

---

## Composing Operations

Operations compose naturally via **precedence** and **parentheses**.

### Operator Precedence (Highest to Lowest)

1. **Semantic**: `~` (meet), `->` (project)
2. **Intersection**: `&`, `AND`
3. **Difference**: `-`, `\`
4. **Union**: `+`, `|`, `OR`

**Example**:

```
O2[critical] ~ O4 - O2[vulnerability]
```

**Parsed as**:

```
(O2[critical] ~ O4) - O2[vulnerability]
```

**Meaning**: Critical attacks aligned with principles, minus known vulnerabilities.

---

### Using Parentheses

**Query**:

```bash
cognition-cli lattice "(O2 + O5) ~ O4"
```

**Meaning**:

1. Union of security and operational
2. Find alignment with mission

**Without Parentheses**:

```bash
cognition-cli lattice "O2 + O5 ~ O4"
```

**Parsed as**:

```
O2 + (O5 ~ O4)
```

**Different meaning**: Union of security with (operational aligned with mission).

---

## The Universal Interface: OverlayAlgebra

All operations work because every overlay implements `OverlayAlgebra<T>`:

```typescript
interface OverlayAlgebra<T extends OverlayMetadata> {
  // Identity
  getOverlayId(): string;
  getOverlayName(): string;
  getSupportedTypes(): string[];

  // Core data access
  getAllItems(): Promise<OverlayItem<T>[]>;
  getItemsByType(type: string): Promise<OverlayItem<T>[]>;

  // Filtering
  filter(predicate: (metadata: T) => boolean): Promise<OverlayItem<T>[]>;
  query(
    text: string,
    topK?: number
  ): Promise<Array<{ item: OverlayItem<T>; similarity: number }>>;

  // Set operations
  select(options: SelectOptions): Promise<OverlayItem<T>[]>;
  exclude(options: SelectOptions): Promise<OverlayItem<T>[]>;
  getSymbolSet(): Promise<Set<string>>;
  getIdSet(): Promise<Set<string>>;

  // Metadata
  getPgcRoot(): string;
}
```

**Key Principle**: Once a manager implements this interface, it participates in the algebra **for free**.

---

## Implementation Architecture

### Lexer (Tokenizer)

**Input**: String query like `"O2[critical] ~ O4"`

**Output**: Token stream

```typescript
[
  { type: 'OVERLAY_ID', value: 'O2' },
  { type: 'FILTER', value: 'critical' },
  { type: 'MEET', value: '~' },
  { type: 'OVERLAY_ID', value: 'O4' },
  { type: 'EOF', value: '' },
];
```

**Supported Tokens**:

- `OVERLAY_ID`: O1, O2, ..., O7
- `FILTER`: `[attacks]`, `[severity=critical]`
- `UNION`: `+`, `|`, `OR`
- `INTERSECTION`: `&`, `AND`
- `DIFFERENCE`: `-`, `\`
- `COMPLEMENT`: `!`, `NOT`
- `MEET`: `~`, `MEET`
- `PROJECT`: `->`, `TO`
- `LPAREN`, `RPAREN`: `(`, `)`

**Code**: `src/core/algebra/query-parser.ts` (lines 50-250)

---

### Parser (AST Builder)

**Input**: Token stream

**Output**: Abstract Syntax Tree (AST)

**AST Node Types**:

```typescript
type ASTNode =
  | OverlayNode // O2
  | FilteredOverlayNode // O2[critical]
  | UnaryOpNode // !O2
  | BinaryOpNode; // O2 ~ O4
```

**Example**:

```
Query: "(O2 ~ O4) - O2[vulnerability]"

AST:
  BinaryOpNode (operator: 'difference')
    ├─ left: BinaryOpNode (operator: 'meet')
    │    ├─ left: OverlayNode (O2)
    │    └─ right: OverlayNode (O4)
    └─ right: FilteredOverlayNode
         ├─ overlayId: O2
         └─ filter: { typeFilter: 'vulnerability' }
```

**Precedence Handling**: Recursive descent parser with precedence climbing.

**Code**: `src/core/algebra/query-parser.ts` (lines 250-450)

---

### Evaluator (Executor)

**Input**: AST

**Output**: Query result (items, meet results, or set operation results)

**Evaluation Strategy**: Recursive post-order traversal

```typescript
async evaluate(node: ASTNode): Promise<any> {
  switch (node.type) {
    case 'overlay':
      return this.evaluateOverlay(node);

    case 'filtered_overlay':
      return this.evaluateFilteredOverlay(node);

    case 'binary_op':
      const left = await this.evaluate(node.left);
      const right = await this.evaluate(node.right);
      return this.applyBinaryOp(node.operator, left, right);
  }
}
```

**Code**: `src/core/algebra/query-parser.ts` (lines 450-550)

---

## Performance Characteristics

| Operation                | Time Complexity | Notes                     |
| ------------------------ | --------------- | ------------------------- |
| `meet(A, B)`             | O(n × log m)    | Uses LanceDB ANN search   |
| `union(A, B)`            | O(n + m)        | Hash-based deduplication  |
| `intersection(A, B)`     | O(n + m)        | Two-pass set intersection |
| `difference(A, B)`       | O(n + m)        | Hash-based set difference |
| `symbolDifference(A, B)` | O(n + m)        | Native Set operations     |
| Filter by type           | O(n)            | Linear scan over items    |
| Query embedding          | ~100ms          | eGemma API call           |

**Optimization Notes**:

- `meet()` uses temporary LanceDB tables (in-memory) for fast similarity search
- Symbol-level operations bypass item retrieval (10-100× faster)
- Use `select()` to filter before expensive operations

---

## Real-World Examples

### Example 1: Security Coverage Gaps

**Question**: Which code symbols lack security guidelines?

**Query**:

```bash
cognition-cli lattice "O1 - O2"
```

**Returns**: List of symbols with no corresponding security items.

**Use Case**: Identify areas of codebase that need security review.

---

### Example 2: Attack-Principle Alignment

**Question**: Which attack vectors violate mission principles?

**Query**:

```bash
cognition-cli lattice "O2[attack_vector] ~ O4[principle]" --threshold 0.8
```

**Returns**: Pairs of (attack, principle) with similarity ≥ 0.8.

**Interpretation**: High similarity = attack violates principle (semantic conflict).

---

### Example 3: Workflow Security Mapping

**Question**: For workflows about "user input", what security applies?

**Query**:

```bash
cognition-cli lattice "O5 -> O2" --query "handle user input"
```

**Returns**: Security guidelines aligned with operational patterns about input handling.

**Use Case**: Context-aware security guidance during development.

---

### Example 4: Complex Composition

**Question**: Critical security items aligned with mission, excluding known vulnerabilities.

**Query**:

```bash
cognition-cli lattice "(O2[critical] ~ O4) - O2[vulnerability]"
```

**Breakdown**:

1. Filter O2 for critical items
2. Find alignment with O4 (mission)
3. Remove known vulnerabilities from results

**Returns**: Actionable security-mission alignments without noise from known issues.

---

## Design Decisions

### Why ASCII-Only Operators?

**Problem**: Mathematical symbols like ∪, ∩, ∧, → are beautiful but **not typeable**.

**Solution**: ASCII equivalents that are **easy to type**:

- `+` or `|` for union (∪)
- `&` or `AND` for intersection (∩)
- `-` or `\` for difference (\)
- `~` for meet (∧)
- `->` for project (→)

**Trade-off**: Slightly less elegant, but **100× more usable**.

---

### Why Two Operation Types? (Semantic vs Exact)

**Semantic operations** (`meet`, `project`) use **embeddings** → fuzzy matching, handles synonyms.

**Set operations** (`union`, `intersection`) use **IDs** → exact matching, fast, deterministic.

**Both are needed**:

- Use semantic when you want "similar concepts"
- Use exact when you want "same item ID"

**Example**:

- Semantic: "Which attacks are similar to this principle?" (meet)
- Exact: "Which items have IDs in both O2 and O4?" (intersection)

---

### Why Precedence?

**Without precedence**:

```
O2 + O5 ~ O4
```

**Ambiguous**: Could be `(O2 + O5) ~ O4` or `O2 + (O5 ~ O4)`.

**With precedence** (~ binds tighter than +):

```
O2 + (O5 ~ O4)  ← Correct parse
```

**Rule**: Semantic operations bind tighter than set operations (makes sense: alignment is more specific than union).

---

## Extension Points

### Adding New Operations

To add a new operation (e.g., `xor`):

1. **Add token type**:

```typescript
enum TokenType {
  // ... existing ...
  XOR = 'XOR',
}
```

2. **Add lexer support**:

```typescript
case '^':
  tokens.push({ type: TokenType.XOR, ... });
```

3. **Add parser precedence level**:

```typescript
private parseXor(): ASTNode {
  let left = this.parseIntersection();
  while (this.currentToken.type === TokenType.XOR) {
    // ...
  }
}
```

4. **Add evaluator**:

```typescript
case 'xor':
  return xor(left, right, ['left', 'right']);
```

5. **Implement operation**:

```typescript
export function xor<T>(
  itemsA: OverlayItem<T>[],
  itemsB: OverlayItem<T>[]
): SetOperationResult<T> {
  // Items in A or B, but not both
  const idsA = new Set(itemsA.map(i => i.id));
  const idsB = new Set(itemsB.map(i => i.id));

  const xorItems = [
    ...itemsA.filter(i => !idsB.has(i.id)),
    ...itemsB.filter(i => !idsA.has(i.id))
  ];

  return { items: xorItems, ... };
}
```

---

### Adding New Overlay Types

To add a new overlay (e.g., O₈ API Specifications):

1. **Create manager** implementing `OverlayAlgebra`
2. **Register in `OverlayRegistry`**:

```typescript
case 'O8':
  return new APISpecsManager(this.pgcRoot, this.workbenchUrl);
```

3. **Update overlay info**:

```typescript
{
  id: 'O8',
  name: 'API Specifications',
  description: 'Contracts, schemas, endpoint docs',
  supportedTypes: ['endpoint', 'schema', 'contract']
}
```

4. **Query it**:

```bash
cognition-cli lattice "O8 ~ O2"  # APIs aligned with security
```

**That's it.** The algebra works automatically.

---

## Testing

### Unit Tests

Test each operation in isolation:

```typescript
describe('meet', () => {
  it('should find alignment above threshold', async () => {
    const itemsA = [{ id: 'a1', embedding: [0.1, 0.2, ...], ... }];
    const itemsB = [{ id: 'b1', embedding: [0.15, 0.25, ...], ... }];

    const results = await meet(itemsA, itemsB, { threshold: 0.9 });

    expect(results).toHaveLength(1);
    expect(results[0].similarity).toBeGreaterThanOrEqual(0.9);
  });
});
```

### Integration Tests

Test full query pipeline:

```typescript
describe('QueryEngine', () => {
  it('should parse and execute "O1 - O2"', async () => {
    const engine = createQueryEngine(pgcRoot);
    const result = await engine.execute('O1 - O2');

    expect(result.metadata.operation).toBe('difference');
    expect(result.metadata.sourceOverlays).toEqual(['O1', 'O2']);
  });
});
```

### End-to-End Tests

Test real queries on real PGC:

```bash
# Setup: Initialize PGC with test data
cognition-cli init --path ./test-project
cognition-cli genesis ./test-project/src
cognition-cli genesis:docs ./test-project/docs

# Test: Run queries
cognition-cli lattice "O1 - O2" > output.json

# Verify: Check results
assert "$(jq '.items | length' output.json)" -gt 0
```

---

## Common Pitfalls

### Pitfall 1: Forgetting Filters

**Wrong**:

```bash
cognition-cli lattice "O2 ~ O4"
```

**Problem**: Compares ALL security items with ALL mission items (millions of pairs).

**Right**:

```bash
cognition-cli lattice "O2[attacks] ~ O4[principles]"
```

**Fix**: Filter by type BEFORE expensive operations.

---

### Pitfall 2: Meet vs Intersection

**Meet** (`~`): Semantic similarity (embeddings)
**Intersection** (`&`): Exact ID match

**Example**:

```bash
# Wrong: Intersection by ID (probably no matches)
cognition-cli lattice "O2[attacks] & O4[principles]"

# Right: Semantic alignment
cognition-cli lattice "O2[attacks] ~ O4[principles]"
```

---

### Pitfall 3: Threshold Too High

**Query**:

```bash
cognition-cli lattice "O2 ~ O4" --threshold 0.95
```

**Problem**: Threshold 0.95 is VERY strict (near-identical embeddings). Likely returns 0 results.

**Fix**: Start with threshold 0.7, adjust based on results.

---

## Future Directions

### N-Way Meet

Currently `meet()` is binary. Could extend to n-way:

```bash
cognition-cli lattice "meet(O2, O4, O5)"
```

**Meaning**: Items aligned across ALL three overlays.

**Implementation**: Nested binary meets or direct n-way similarity.

---

### Weighted Meet

Allow different weights for different overlays:

```bash
cognition-cli lattice "meet(O2:0.3, O4:0.7)"
```

**Meaning**: Alignment score = 30% O2 + 70% O4.

---

### Aggregation Functions

Add SQL-like aggregations:

```bash
cognition-cli lattice "O2[attacks] | count"
cognition-cli lattice "O2[severity=critical] | avg(weight)"
```

---

## Summary

**The Lattice Algebra** provides:

1. **Two operation types**:
   - Semantic (meet, project) via embeddings
   - Exact (union, intersection, difference) via IDs

2. **ASCII-only syntax** (easy to type)

3. **Composability** (operations chain naturally)

4. **Universal interface** (`OverlayAlgebra`) → any overlay gains algebra

5. **Full implementation**:
   - Lexer (tokenizer)
   - Parser (AST builder)
   - Evaluator (executor)
   - CLI command

**Key Files**:

- `src/core/algebra/overlay-algebra.ts` — Interface
- `src/core/algebra/lattice-operations.ts` — Operations
- `src/core/algebra/query-parser.ts` — Parser + evaluator
- `src/core/algebra/overlay-registry.ts` — Registry
- `src/commands/lattice.ts` — CLI

**Next Chapter**: Chapter 13: Query Syntax and Parser (coming soon)

**Previous Chapter**: [Chapter 11: O₇ Coherence](../part-2-seven-layers/11-o7-coherence.md)

---

**Status**: ✅ Complete (October 30, 2025)
**Author**: Collaborative implementation session
**Reviewed**: Pending
