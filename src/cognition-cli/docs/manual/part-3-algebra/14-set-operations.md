---
type: mathematical
overlay: O6_Mathematical
---

# Chapter 14: Set Operations — Finding What's Missing

> **The Coverage Problem**: You've documented security guidelines for 234 functions. Your codebase has 847 functions. Which 613 functions are unprotected? This is not a semantic question—it's set theory.
>
> **The Solution**: Set operations (union, intersection, difference) give you crisp answers: "What's in both?" "What's missing?" "Give me everything except X."

**Part**: III — The Algebra<br/>
**Chapter**: 14<br/>
**Focus**: Exact Matching, Coverage Analysis, Gap Detection<br/>
**Implementation**: `src/core/algebra/lattice-operations.ts`<br/>

---

## Table of Contents

1. [The Problem: When Fuzzy Isn't Enough](#the-problem-when-fuzzy-isnt-enough)
2. [Two Parallel Worlds](#two-parallel-worlds)
3. [Symbol-Based Operations (The Fast Path)](#symbol-based-operations-the-fast-path)
4. [Item-Based Operations (The Complete Path)](#item-based-operations-the-complete-path)
5. [Coverage Gap Analysis (The Killer Use Case)](#coverage-gap-analysis-the-killer-use-case)
6. [Select and Exclude](#select-and-exclude)
7. [Real-World Patterns](#real-world-patterns)
8. [Performance: When to Use What](#performance-when-to-use-what)
9. [Common Pitfalls](#common-pitfalls)

---

## The Problem: When Fuzzy Isn't Enough

Meet operations (Chapter 12) are powerful for semantic alignment:

```typescript
// "Which attacks violate these principles?" (fuzzy, threshold-based)
const violations = await meet(attacks, principles, { threshold: 0.8 });
```

**But sometimes you need exact answers**:

- "Which functions have **ZERO** security coverage?" (not "low similarity")
- "Give me **ALL** symbols from security AND operational overlays" (not "similar items")
- "What's in **BOTH** overlays exactly?" (not "what aligns semantically")

**Set operations solve this**: crisp set theory with no thresholds, no embeddings, just yes/no membership.

---

## Two Parallel Worlds

The lattice algebra provides **two operation families** that complement each other:

### World 1: Semantic Operations (Fuzzy)

**Purpose**: Find relationships between concepts

**Mechanism**: Vector similarity (cosine distance on 768-dim embeddings)

**Question**: "What's **related**?"

**Example**:

```typescript
// Fuzzy: Find attacks semantically similar to principles
const aligned = await meet(attacks, principles, { threshold: 0.7 });
// Returns: [(attack1, principle3, 0.84), (attack2, principle1, 0.71), ...]
```

**Output**: Pairs with similarity scores

---

### World 2: Set Operations (Crisp)

**Purpose**: Find exact membership relationships

**Mechanism**: ID/symbol matching (no embeddings needed)

**Question**: "What's **in/out**?"

**Example**:

```typescript
// Crisp: Find symbols with NO security coverage
const uncovered = symbolDifference(
  await structural.getSymbolSet(), // All code symbols
  await security.getSymbolSet() // Documented symbols
);
// Returns: Set { 'helperFunc', 'oldUtility', 'internalConfig', ... }
```

**Output**: Items (no scores)

---

### When to Use Which

| Question                             | Use This         |
| ------------------------------------ | ---------------- |
| "Do these concepts align?"           | Meet (~)         |
| "Which functions **lack** coverage?" | Difference (-)   |
| "What's in **both** overlays?"       | Intersection (&) |
| "Combine **all** from A and B"       | Union (+)        |
| "Is this function **documented**?"   | Set membership   |

**Key Insight**: Set operations answer **coverage questions**. Semantic operations answer **alignment questions**.

---

## Symbol-Based Operations (The Fast Path)

### The Problem

You have 847 functions in your codebase. You have security docs for 234 of them. **Which 613 functions are unprotected?**

You could:

1. ❌ Load all structural items (847 × ~500 bytes metadata = 400KB)
2. ❌ Load all security items (234 × ~500 bytes = 120KB)
3. ❌ Compute set difference on full objects (slow)

**Or**:

1. ✅ Extract symbol sets (847 strings + 234 strings = ~40KB)
2. ✅ Compute set difference on strings (fast)
3. ✅ **Only then** load full items if needed

**Symbol operations are 50× faster** because they skip metadata/embeddings.

---

### Getting Symbol Sets

Every overlay provides `getSymbolSet()`:

```typescript
const codeSymbols = await structural.getSymbolSet();
// Set(847) { 'handleLogin', 'validateToken', 'processPayment', ... }

const secureSymbols = await security.getSymbolSet();
// Set(234) { 'handleLogin', 'sanitizeInput', 'hashPassword', ... }
```

**What's in the set?** Symbol identifiers (function names, class names) that have coverage in that overlay.

---

### Symbol Difference: Finding Gaps

**Question**: Which symbols are in A but **NOT** in B?

```typescript
import { symbolDifference } from './lattice-operations.js';

const allCode = await structural.getSymbolSet(); // 847 symbols
const documented = await security.getSymbolSet(); // 234 symbols

const gaps = symbolDifference(allCode, documented);

console.log(`${gaps.size} symbols lack security coverage`);
// Output: 613 symbols lack security coverage

for (const symbol of gaps) {
  console.log(`  ⚠️  ${symbol}`);
}
```

**Use Case**: Pre-commit hooks, coverage reports, prioritizing documentation work

**Performance**: ~0.1ms for 1000 symbols

---

### Symbol Intersection: Measuring Coverage

**Question**: Which symbols are in **BOTH** A and B?

```typescript
import { symbolIntersection } from './lattice-operations.js';

const allCode = await structural.getSymbolSet();
const documented = await security.getSymbolSet();

const covered = symbolIntersection(allCode, documented);

const coveragePercent = (covered.size / allCode.size) * 100;

console.log(`Security coverage: ${coveragePercent.toFixed(1)}%`);
// Output: Security coverage: 27.6%
```

**Use Case**: Dashboard metrics, CI/CD gates, progress tracking

---

### Symbol Union: Combining Coverage

**Question**: What's the **total** set of documented symbols across overlays?

```typescript
import { symbolUnion } from './lattice-operations.js';

const securityDocs = await security.getSymbolSet(); // 234
const operationalDocs = await operational.getSymbolSet(); // 156

const allDocumented = symbolUnion(securityDocs, operationalDocs);

console.log(`${allDocumented.size} symbols have documentation`);
// Output: 347 symbols have documentation (assuming some overlap)
```

**Use Case**: Aggregate coverage across multiple doc sources

---

### Real Example: Coverage Dashboard

```typescript
async function showCoverageDashboard() {
  const structural = await registry.get('O1');
  const allCode = await structural.getSymbolSet();

  const overlays = [
    { name: 'Security', id: 'O2', emoji: '🔒' },
    { name: 'Lineage', id: 'O3', emoji: '🔗' },
    { name: 'Mission', id: 'O4', emoji: '🎯' },
    { name: 'Operational', id: 'O5', emoji: '⚙️' },
  ];

  console.log(`Documentation Coverage (${allCode.size} total symbols)\n`);

  for (const { name, id, emoji } of overlays) {
    const overlay = await registry.get(id);
    const documented = await overlay.getSymbolSet();
    const covered = symbolIntersection(allCode, documented);
    const percent = (covered.size / allCode.size) * 100;

    // Progress bar
    const barLength = 20;
    const filled = Math.round((percent / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

    console.log(`${emoji} ${name.padEnd(15)} [${bar}] ${percent.toFixed(1)}%`);
  }
}
```

**Output**:

```
Documentation Coverage (847 total symbols)

🔒 Security         [█████░░░░░░░░░░░░░░░] 27.6%
🔗 Lineage          [████████████████████] 100.0%
🎯 Mission          [██░░░░░░░░░░░░░░░░░░] 10.5%
⚙️  Operational      [█░░░░░░░░░░░░░░░░░░░] 5.3%
```

**Interpretation**:

- ✅ **Lineage (100%)**: Every symbol has dependency tracking
- ⚠️ **Security (27.6%)**: Most symbols lack security docs
- ✓ **Mission (10.5%)**: Only strategic symbols documented (expected)
- ✓ **Operational (5.3%)**: Only workflow-critical symbols (expected)

---

## Item-Based Operations (The Complete Path)

Symbol operations are fast but **symbols are just IDs**. Sometimes you need full items with metadata and embeddings.

### Union: Combine All Items

**Question**: Give me **all** items from these overlays (no duplicates)

```typescript
import { union } from './lattice-operations.js';

const securityItems = await security.getAllItems(); // 234 items
const operationalItems = await operational.getAllItems(); // 156 items

const allGuidance = union([securityItems, operationalItems], ['O2', 'O5']);

console.log(`Total guidance items: ${allGuidance.items.length}`);
// Output: Total guidance items: 390 (assuming no overlap)

// Full metadata available
for (const item of allGuidance.items) {
  console.log(`${item.metadata.type}: ${item.metadata.text}`);
}
```

**Use Case**: Comprehensive documentation queries, aggregating knowledge

**Performance**: ~8ms for 1000 items

---

### Intersection: Items in ALL Sets

**Question**: Which items appear in **EVERY** overlay? (matched by ID)

```typescript
import { intersection } from './lattice-operations.js';

const securityConstraints = await security.filter(
  (m) => m.type === 'constraint'
);
const missionPrinciples = await mission.filter((m) => m.type === 'principle');

const shared = intersection(
  [securityConstraints, missionPrinciples],
  ['O2', 'O4']
);

console.log(`${shared.items.length} items are BOTH constraints AND principles`);
```

**Note**: Item intersection by ID is rare in practice—usually you want **semantic alignment** (use Meet) or **symbol-based intersection** instead.

---

### Difference: Coverage Gaps

**Question**: Which items are in A but **NOT** in B?

```typescript
import { difference } from './lattice-operations.js';

const allCode = await structural.getAllItems(); // 847 items
const documented = await security.getAllItems(); // 234 items

const uncovered = difference(allCode, documented, ['O1', 'O2']);

console.log(`${uncovered.items.length} code symbols lack security docs\n`);

// Full items available—sort by importance
const sorted = uncovered.items
  .sort((a, b) => (b.metadata.importance || 0) - (a.metadata.importance || 0))
  .slice(0, 10);

console.log('Top 10 unprotected symbols:');
for (const item of sorted) {
  console.log(`  ⚠️  ${item.metadata.symbol} (${item.metadata.file_path})`);
}
```

**Output**:

```
613 code symbols lack security docs

Top 10 unprotected symbols:
  ⚠️  handlePayment (src/payment/handler.ts)
  ⚠️  processRefund (src/payment/refund.ts)
  ⚠️  exportUserData (src/export/gdpr.ts)
  ⚠️  deleteAccount (src/user/lifecycle.ts)
  ⚠️  adminOverride (src/admin/permissions.ts)
  ...
```

**Use Case**: Prioritized backlogs, security audits, compliance reports

---

## Coverage Gap Analysis (The Killer Use Case)

This is why set operations exist: **finding what's missing**.

### Example 1: Pre-Commit Hook

**Requirement**: New/modified code must have security documentation before merging.

```typescript
#!/usr/bin/env node
import { execSync } from 'child_process';
import { symbolDifference } from './core/algebra/lattice-operations.js';

async function checkSecurityCoverage() {
  // Get changed TypeScript files from git
  const changedFiles = execSync('git diff --cached --name-only')
    .toString()
    .split('\n')
    .filter((f) => f.endsWith('.ts'));

  if (changedFiles.length === 0) {
    console.log('✓ No TypeScript changes');
    process.exit(0);
  }

  // Load overlays
  const structural = await registry.get('O1');
  const security = await registry.get('O2');

  // Extract symbols from changed files
  const allItems = await structural.getAllItems();
  const changedSymbols = new Set(
    allItems
      .filter((item) => changedFiles.includes(item.metadata.file_path))
      .map((item) => item.metadata.symbol)
  );

  // Check coverage
  const secureSymbols = await security.getSymbolSet();
  const uncovered = symbolDifference(changedSymbols, secureSymbols);

  if (uncovered.size > 0) {
    console.error('❌ Security coverage check FAILED');
    console.error(`${uncovered.size} symbols lack documentation:\n`);
    for (const symbol of uncovered) {
      console.error(`  - ${symbol}`);
    }
    console.error('\nPlease add security docs before committing.');
    process.exit(1);
  }

  console.log('✓ Security coverage check passed');
}

checkSecurityCoverage();
```

**Integration**:

```bash
# .git/hooks/pre-commit
#!/bin/bash
node scripts/check-security-coverage.js || exit 1
```

**Impact**: Prevents unprotected code from entering the codebase.

---

### Example 2: Prioritized Security Backlog

**Requirement**: Generate a prioritized list of functions needing security docs, sorted by dependency count (high-impact functions first).

```typescript
async function generateSecurityBacklog() {
  const structural = await registry.get('O1');
  const security = await registry.get('O2');
  const lineage = await registry.get('O3');

  // Find gaps (symbol-based, fast)
  const allCode = await structural.getSymbolSet();
  const secured = await security.getSymbolSet();
  const gaps = symbolDifference(allCode, secured);

  // Load full items for gap symbols
  const structuralItems = await structural.getAllItems();
  const lineageItems = await lineage.getAllItems();

  const backlog = [];

  for (const symbol of gaps) {
    const item = structuralItems.find((i) => i.metadata.symbol === symbol);
    if (!item) continue;

    // Find dependency count from lineage overlay
    const lineageItem = lineageItems.find((l) => l.metadata.symbol === symbol);
    const depCount = lineageItem?.metadata.dependency_count || 0;

    backlog.push({
      symbol,
      file: item.metadata.file_path,
      depCount,
      priority: depCount > 10 ? 'HIGH' : depCount > 3 ? 'MEDIUM' : 'LOW',
    });
  }

  // Sort by dependency count (high to low)
  backlog.sort((a, b) => b.depCount - a.depCount);

  console.log('Security Documentation Backlog (Prioritized)\n');

  for (const { symbol, file, depCount, priority } of backlog.slice(0, 20)) {
    const emoji =
      priority === 'HIGH' ? '🔴' : priority === 'MEDIUM' ? '🟡' : '🟢';
    console.log(`${emoji} [${priority}] ${symbol} (${depCount} dependents)`);
    console.log(`   ${file}\n`);
  }
}
```

**Output**:

```
Security Documentation Backlog (Prioritized)

🔴 [HIGH] validateInput (47 dependents)
   src/validation/input.ts

🔴 [HIGH] sanitizeData (38 dependents)
   src/utils/sanitize.ts

🔴 [HIGH] authenticate (32 dependents)
   src/auth/core.ts

🟡 [MEDIUM] processPayment (8 dependents)
   src/payment/handler.ts

🟡 [MEDIUM] exportData (6 dependents)
   src/export/data.ts

🟢 [LOW] helperFunction (2 dependents)
   src/utils/helpers.ts
```

**Value**: Focus security documentation effort where it matters most (high-impact functions).

---

### Example 3: Coverage Trend Tracking

**Requirement**: Track security coverage improvement over time.

```typescript
// Coverage snapshot
interface Snapshot {
  date: string;
  coverage: number; // 0.0 - 1.0
  total: number;
  documented: number;
}

async function trackCoverageProgress(snapshots: Snapshot[]) {
  const structural = await registry.get('O1');
  const security = await registry.get('O2');

  const allCode = await structural.getSymbolSet();
  const documented = await security.getSymbolSet();
  const covered = symbolIntersection(allCode, documented);

  const currentSnapshot: Snapshot = {
    date: new Date().toISOString().split('T')[0],
    coverage: covered.size / allCode.size,
    total: allCode.size,
    documented: covered.size,
  };

  snapshots.push(currentSnapshot);

  // Calculate trend
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const improvement = ((last.coverage - first.coverage) / first.coverage) * 100;

  console.log('Security Coverage Trend\n');
  for (const snap of snapshots) {
    const percent = (snap.coverage * 100).toFixed(1);
    console.log(`${snap.date}  ${percent}% (${snap.documented}/${snap.total})`);
  }

  console.log(`\nImprovement: +${improvement.toFixed(1)}% over time`);
}
```

**Output**:

```
Security Coverage Trend

2025-01-01  15.3% (130/847)
2025-02-01  21.1% (179/847)
2025-03-01  27.6% (234/847)

Improvement: +80.4% over time
```

---

## Select and Exclude

Sometimes you don't want **all** items—you want to filter by a specific symbol set.

### Select: Include Only Matching

**Interface**:

```typescript
interface OverlayAlgebra {
  /**
   * Select items whose symbols are in the provided set
   */
  select(options: { symbols?: Set<string> }): Promise<OverlayItem[]>;
}
```

**Use Case**: Get security guidelines for specific functions

```typescript
// I'm refactoring auth—give me all relevant security docs
const authSymbols = new Set(['handleLogin', 'validateToken', 'hashPassword']);

const authGuidelines = await security.select({ symbols: authSymbols });

console.log(`Found ${authGuidelines.length} security guidelines for auth\n`);

for (const item of authGuidelines) {
  console.log(`${item.metadata.type}: ${item.metadata.text}`);
}
```

**Output**:

```
Found 8 security guidelines for auth

mitigation: Use bcrypt for password hashing with salt rounds ≥ 12
constraint: MUST validate tokens before granting access
threat_model: Brute force attacks on login endpoint
mitigation: Implement rate limiting (5 attempts per minute)
attack_vector: Session fixation via token reuse
mitigation: Regenerate session IDs after successful login
constraint: JWT tokens MUST expire within 1 hour
boundary: API Gateway validates all authentication headers
```

---

### Exclude: Remove Matching

**Use Case**: Get production guidelines (exclude test symbols)

```typescript
// Get security guidelines, excluding test-related symbols
const testSymbols = new Set(['mockAuth', 'testHelper', 'fakeUser']);

const production = await security.exclude({ symbols: testSymbols });

console.log(`${production.length} production security guidelines`);
```

---

### Composition: Find + Filter

**Pattern**: "Get security guidelines for symbols that **lack** operational docs"

```typescript
// Step 1: Find symbols without operational coverage
const allCode = await structural.getSymbolSet();
const documented = await operational.getSymbolSet();
const undocumented = symbolDifference(allCode, documented);

// Step 2: Get security guidelines for those undocumented symbols
const guidelines = await security.select({ symbols: undocumented });

console.log(`${guidelines.length} security items for undocumented code`);
```

**Use Case**: "What security guidance exists for code that **lacks workflow documentation**?"

---

## Real-World Patterns

### Pattern 1: Calculate Coverage Percentage

```typescript
async function calculateCoverage(
  structural: OverlayAlgebra,
  overlay: OverlayAlgebra
): Promise<number> {
  const allSymbols = await structural.getSymbolSet();
  const coveredSymbols = await overlay.getSymbolSet();
  const covered = symbolIntersection(allSymbols, coveredSymbols);
  return (covered.size / allSymbols.size) * 100;
}

// Usage
const coverage = await calculateCoverage(
  await registry.get('O1'),
  await registry.get('O2')
);
console.log(`Security coverage: ${coverage.toFixed(1)}%`);
```

---

### Pattern 2: Multi-Overlay Union

```typescript
async function getAllDocumentation(
  overlayIds: string[]
): Promise<OverlayItem[]> {
  const itemSets: OverlayItem[][] = [];

  for (const id of overlayIds) {
    const overlay = await registry.get(id);
    const items = await overlay.getAllItems();
    itemSets.push(items);
  }

  const result = union(itemSets, overlayIds);
  return result.items;
}

// Get all documentation (security + operational + mission)
const allDocs = await getAllDocumentation(['O2', 'O4', 'O5']);
```

---

### Pattern 3: Cascading Exclusions

```typescript
// Exclude multiple categories
const testSymbols = new Set(['mockAuth', 'testHelper']);
const legacySymbols = new Set(['oldAPI', 'deprecatedHandler']);
const deprecated = new Set(['legacyFunction']);

const exclusions = symbolUnion(
  symbolUnion(testSymbols, legacySymbols),
  deprecated
);

const production = await security.exclude({ symbols: exclusions });
```

---

## Performance: When to Use What

### Benchmarks (Reference: 847 symbols)

| Operation              | Time   | Use Case                            |
| ---------------------- | ------ | ----------------------------------- |
| `symbolDifference()`   | ~0.1ms | Coverage gap counting               |
| `symbolIntersection()` | ~0.1ms | Coverage percentage                 |
| `symbolUnion()`        | ~0.2ms | Aggregate coverage                  |
| `difference()` (items) | ~5ms   | Gap analysis with metadata          |
| `union()` (items)      | ~8ms   | Combine docs from multiple overlays |
| `select()`             | ~2ms   | Filter by symbol set                |
| `exclude()`            | ~1ms   | Inverse filter                      |

### Optimization Tips

**1. Use Symbol Operations for Counting**

```typescript
// ❌ Slow: Load full items just to count
const allItems = await structural.getAllItems();
const secureItems = await security.getAllItems();
const gaps = difference(allItems, secureItems, ['O1', 'O2']);
console.log(`${gaps.items.length} gaps`); // ~5ms

// ✅ Fast: Use symbol sets
const allSymbols = await structural.getSymbolSet();
const secureSymbols = await security.getSymbolSet();
const gaps = symbolDifference(allSymbols, secureSymbols);
console.log(`${gaps.size} gaps`); // ~0.1ms (50× faster)
```

**2. Cache Symbol Sets**

```typescript
// ❌ Repeated getSymbolSet() calls
for (const overlay of overlays) {
  const symbols = await overlay.getSymbolSet(); // Expensive!
  const gaps = symbolDifference(allCode, symbols);
}

// ✅ Cache once
const symbolCache = new Map();
for (const overlay of overlays) {
  if (!symbolCache.has(overlay.name)) {
    symbolCache.set(overlay.name, await overlay.getSymbolSet());
  }
  const symbols = symbolCache.get(overlay.name);
  const gaps = symbolDifference(allCode, symbols);
}
```

**3. Two-Phase Workflow**

```typescript
// Phase 1: Fast symbol operations to identify gaps
const gaps = symbolDifference(allCode, documented); // ~0.1ms

// Phase 2: Load full items ONLY for gaps
const allItems = await structural.getAllItems();
const gapItems = allItems.filter((item) => gaps.has(item.metadata.symbol));
```

**Speedup**: Only load what you need (100× faster for large codebases)

---

## Common Pitfalls

### Pitfall 1: Using Meet When You Need Difference

**Wrong**:

```typescript
// ❌ This finds SIMILAR items (not gaps)
const gaps = await meet(allCode, documented, { threshold: 0.3 });
// Returns items with LOW similarity (not what you want)
```

**Right**:

```typescript
// ✅ Set difference finds exact gaps
const gaps = symbolDifference(
  await structural.getSymbolSet(),
  await security.getSymbolSet()
);
```

**Rule**: Coverage questions → Set operations. Alignment questions → Meet.

---

### Pitfall 2: Forgetting Symbol vs Item Operations

**Wrong**:

```typescript
// ❌ Mixing symbol sets with item operations
const symbols = await structural.getSymbolSet(); // Set<string>
const items = await security.getAllItems(); // OverlayItem[]
const gaps = difference(symbols, items, ['O1', 'O2']); // Type error!
```

**Right**:

```typescript
// ✅ Use symbol operations OR item operations (not both)
const gaps = symbolDifference(
  await structural.getSymbolSet(),
  await security.getSymbolSet()
);
```

---

### Pitfall 3: Loading Items for Counting

**Wrong**:

```typescript
// ❌ Loading 847 items just to count gaps
const allItems = await structural.getAllItems(); // 400KB
const secureItems = await security.getAllItems(); // 120KB
const gaps = difference(allItems, secureItems, ['O1', 'O2']);
console.log(gaps.items.length); // Just need the count!
```

**Right**:

```typescript
// ✅ Use symbol sets for counting (50× faster)
const gaps = symbolDifference(
  await structural.getSymbolSet(),
  await security.getSymbolSet()
);
console.log(gaps.size);
```

---

## Summary

Set operations provide **exact matching** for coverage analysis.

### Three Operation Families

**1. Symbol Operations** (fastest):

- `symbolDifference()` - Gaps
- `symbolIntersection()` - Coverage
- `symbolUnion()` - Aggregates

**2. Item Operations** (complete):

- `union()` - Combine all
- `intersection()` - In all sets
- `difference()` - In A not B

**3. Selection** (filtering):

- `select()` - Include only
- `exclude()` - Remove matching

### When to Use What

- **Coverage counting?** → Symbol operations (~0.1ms)
- **Coverage reports with details?** → Item difference (~5ms)
- **Aggregate documentation?** → Item union (~8ms)
- **Filter by specific symbols?** → Select/exclude (~2ms)

### The Workflow

1. **Fast phase**: Symbol operations to identify gaps
2. **Detailed phase**: Load full items ONLY for gaps
3. **Analysis phase**: Semantic operations (Meet) to find alignment

### The Principle

**Set operations find WHAT is missing. Semantic operations explain WHY and HOW to fix it.**

```typescript
// What's missing? (set operations)
const gaps = symbolDifference(allCode, documented);

// How do we fix it? (semantic operations)
const gapItems = await structural.select({ symbols: gaps });
const guidance = await meet(gapItems, await security.getAllItems(), {
  threshold: 0.6,
});
```

**The pattern**: Crisp questions get crisp answers. Fuzzy questions get fuzzy answers. Use the right tool for the job.

---

**Previous Chapter**: [Chapter 13: Query Syntax and Parser](13-query-syntax.md) ✅

**Next Chapter**: [Chapter 15: The .cogx Format](../part-4-portability/15-cogx-format.md) 📋

---

**Status**: ✅ Complete (November 3, 2025)
