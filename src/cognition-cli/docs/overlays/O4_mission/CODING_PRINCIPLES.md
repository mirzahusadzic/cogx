# Coding Principles: Strategic Grounding for Implementation

> _The Articles of the Constitution—invariant truths that govern all code in pursuit of the mission._

## Overview

This document defines the **fundamental coding principles** that ground all implementation decisions in the Cognition CLI. These are not workflows or processes—they are **atomic truths** that apply to every line of code, every architectural choice, every refactoring decision.

**Purpose**: Strategic alignment between mission and code semantics
**Layer**: O₄ Strategic Intent (alongside Vision/Mission)
**Validation**: Tracked via O₇ Coherence (principle adherence scoring)

## Architectural Philosophy

### 1. Immutability is Essential

**Principle**: Once data is written, it cannot be changed. All state changes create new versions.

**Why**: Immutability enables cryptographic provenance, reproducible builds, and fearless concurrency.

**Implementing Patterns**:

```typescript
// ✅ CORRECT: Content-addressable storage (immutable)
const hash = calculateHash(content);
objectStore.put(hash, content); // Hash is the key, content cannot change

// ❌ INCORRECT: Mutable storage
const id = generateId();
database.update(id, newContent); // Same ID, different content (no provenance)
```

**Implementing Symbols**:

- `ObjectStore.put()` - Write-once storage
- `calculateStructuralHash()` - Deterministic hashing
- `TransformLog.append()` - Append-only history

**Violations to Watch**:

- Direct file mutation without hash recalculation
- In-place array/object modifications
- Shared mutable state across workers

---

### 2. Hashes are Provenance

**Principle**: Every piece of data is addressed by its cryptographic hash. The hash IS the identity.

**Why**: Content-addressable storage ensures data integrity, deduplication, and verifiable provenance.

**Implementing Patterns**:

```typescript
// ✅ CORRECT: Hash as identity
interface PGCObject {
  hash: string; // SHA-256 of content
  content: unknown;
}

// Storage: .open_cognition/pgc/objects/{hash}.json

// ❌ INCORRECT: Separate ID and content
interface DatabaseRecord {
  id: number; // Auto-increment (no content binding)
  data: unknown;
}
```

**Implementing Symbols**:

- `PGCManager.getObjectByHash()`
- `StructuralData.structuralHash`
- `Manifest.sourceHash` (provenance tracking)

**Key Insight**: If `hash(content1) === hash(content2)`, then `content1 === content2` (collision-resistant hash assumption).

---

### 3. Prefer Determinism Over Randomness

**Principle**: Given the same input, always produce the same output. Avoid non-deterministic operations.

**Why**: Determinism enables reproducible builds, testability, and provenance validation.

**Implementing Patterns**:

```typescript
// ✅ CORRECT: Deterministic hash
function calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ❌ INCORRECT: Timestamp-based ID
function generateId(): string {
  return `${Date.now()}-${Math.random()}`; // Different every time!
}
```

**Exceptions**:

- UUIDs for external API correlation (not for PGC keys)
- Timestamps for human-readable logs (not for hashing)

---

### 4. Parallelize Mining, Serialize Embedding

**Principle**: Use worker pools for CPU-intensive AST parsing. Use a single queue for API-bound embedding generation.

**Why**: Maximize CPU utilization during mining while respecting API rate limits during embedding.

**Implementing Patterns**:

```typescript
// ✅ CORRECT: Worker pool for mining
const workerPool = workerpool.pool(workerScript, {
  maxWorkers: calculateOptimalWorkers(jobCount),
});

// Sequential embedding service
const embeddingService = new EmbeddingService(apiUrl);
for (const symbol of symbols) {
  const embedding = await embeddingService.embed(symbol); // One at a time
}

// ❌ INCORRECT: Sequential mining
for (const file of files) {
  const ast = parseAST(file); // Slow! Should be parallelized
}
```

**Implementing Symbols**:

- `StructuralPatternsManager.initializeWorkerPool()`
- `EmbeddingService` (singleton, centralized)
- `calculateOptimalWorkers()` (adaptive worker count)

---

### 5. Tree-sitter Over Regex

**Principle**: Use Tree-sitter AST parsing for code analysis. Reserve regex for simple markdown patterns.

**Why**: AST parsing is language-aware, robust to formatting changes, and provides structural context.

**Implementing Patterns**:

```typescript
// ✅ CORRECT: Tree-sitter AST
const parser = Parser();
parser.setLanguage(TypeScript);
const tree = parser.parse(sourceCode);
const rootNode = tree.rootNode;

// ❌ INCORRECT: Regex for code parsing
const classPattern = /class\s+(\w+)/g; // Fragile! Breaks on multiline, comments, etc.
```

**When Regex is OK**:

- Markdown pattern extraction (`> blockquote`, `**bold**`)
- Simple string validation
- Log parsing

---

### 6. Validate Before Trust

**Principle**: All external inputs must pass validation before entering the system. Use oracles to verify invariants.

**Why**: Defense in depth. Cryptographic hashing is not enough if invalid data enters the system.

**Implementing Patterns**:

```typescript
// ✅ CORRECT: Schema validation
const OverlayMetadataSchema = z.object({
  sourceHash: z.string(),
  embeddingHash: z.string(),
  fidelity: z.number().min(0).max(1),
});

const validated = OverlayMetadataSchema.parse(rawData);

// ❌ INCORRECT: Trust external input
function processMetadata(data: any) {
  objectStore.put(data.hash, data); // No validation!
}
```

**Implementing Symbols**:

- `PatternMetadataSchema` (Zod schemas)
- `GenesisOracle.verify()` (structural coherence)
- `OverlayOracle.validate()` (overlay integrity)

---

### 7. Fail Fast, Fail Loud

**Principle**: If an invariant is violated, throw immediately. Do not silently continue with corrupted state.

**Why**: Early detection prevents cascading failures and makes debugging easier.

**Implementing Patterns**:

```typescript
// ✅ CORRECT: Fail fast
if (!objectStore.has(hash)) {
  throw new Error(`Object not found: ${hash}`);
}

// ❌ INCORRECT: Silent failure
const obj = objectStore.get(hash);
if (!obj) {
  return null; // Caller may not check, corruption spreads
}
```

**When to Use Graceful Degradation**:

- User-facing features (show error message, not stack trace)
- External API failures (retry with backoff)
- Non-critical paths (logging, metrics)

---

### 8. One Source of Truth

**Principle**: Every piece of data has exactly one authoritative source. Derived data must be recomputable from the source.

**Why**: Prevents synchronization bugs, ensures consistency, enables cache invalidation.

**Implementing Patterns**:

```typescript
// ✅ CORRECT: Single source of truth
// Source: .open_cognition/pgc/objects/{hash}.json
// Derived: .open_cognition/pgc/overlays/*/metadata/{hash}.json
// Rule: Overlay can be regenerated from object store

// ❌ INCORRECT: Duplicate sources of truth
// - File1: { name: "UserService", type: "class" }
// - File2: { name: "UserService", type: "service" }
// Which is correct? Impossible to know.
```

**Key Locations**:

- **Object Store**: Source of truth for all content
- **Manifests**: Index (derived, can be rebuilt)
- **Embeddings**: Derived from structural signatures

---

### 9. Explicit Over Implicit

**Principle**: Make dependencies, assumptions, and invariants explicit in code and documentation.

**Why**: Self-documenting code reduces cognitive load and prevents bugs from hidden assumptions.

**Implementing Patterns**:

```typescript
// ✅ CORRECT: Explicit dependencies
class OverlayOrchestrator {
  constructor(
    private pgc: PGCManager,
    private workbench: WorkbenchClient,
    private vectorDB: LanceVectorStore
  ) {
    // All dependencies visible at construction
  }
}

// ❌ INCORRECT: Implicit global state
class OverlayOrchestrator {
  async generate() {
    const pgc = getPGCInstance(); // Where does this come from?
  }
}
```

**In Documentation**:

```typescript
/**
 * INVARIANT: manifest.entries[].sourceHash must exist in objectStore
 * ASSUMPTION: SHA-256 provides 128-bit collision resistance
 * DEPENDENCY: Requires eGemma API at WORKBENCH_URL
 */
```

---

### 10. Test the Oracle, Not the Implementation

**Principle**: Tests should verify invariants and outcomes, not implementation details.

**Why**: Implementation can change. Invariants should not.

**Implementing Patterns**:

```typescript
// ✅ CORRECT: Test invariant
test('overlay generation is idempotent', () => {
  const result1 = generateOverlay(source);
  const result2 = generateOverlay(source);
  expect(result1.hash).toBe(result2.hash);
});

// ❌ INCORRECT: Test implementation
test('overlay uses worker pool', () => {
  const spy = jest.spyOn(workerpool, 'pool');
  generateOverlay(source);
  expect(spy).toHaveBeenCalled(); // Fragile! Implementation detail.
});
```

**Key Invariants to Test**:

- Idempotence (same input → same output)
- Provenance integrity (all hashes are valid)
- Structural coherence (manifest ↔ objects)

---

## Principle Categories

| Category         | Principles                                  |
| ---------------- | ------------------------------------------- |
| **Data**         | Immutability, Hashes are Provenance         |
| **Computation**  | Determinism, Parallelize Mining             |
| **Parsing**      | Tree-sitter Over Regex                      |
| **Safety**       | Validate Before Trust, Fail Fast            |
| **Architecture** | One Source of Truth, Explicit Over Implicit |
| **Testing**      | Test the Oracle, Not the Implementation     |

## Dimensional Coherence Scoring

When `genesis:docs` ingests this document, each principle becomes a **concept** in the O₄ layer with:

```typescript
{
  text: "Immutability is essential",
  source: "CODING_PRINCIPLES.md",
  category: "DATA",
  embedding: [...],  // 768-dimensional vector
}
```

Then, O₇ Coherence can compute:

```bash
# Overall strategic coherence (mission + principles)
cognition-cli coherence check

# Mission alignment only
cognition-cli coherence check --filter "source:VISION.md"

# Principles adherence (automated architectural review)
cognition-cli coherence check --filter "source:CODING_PRINCIPLES.md"
```

This enables **multi-dimensional strategic alignment**:

- Does the code embody our **mission**?
- Does the code follow our **principles**?

## Principle Violation Detection

The system can detect violations:

```typescript
interface PrincipleViolation {
  principle: string; // "Immutability is essential"
  violating_symbol: string; // "UserService.updateUser()"
  file: string;
  line: number;
  issue: string; // "Mutates object in place"
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  suggested_fix: string; // "Return new object instead of mutating"
}
```

**Detection Methods**:

1. **Pattern-based**: AST analysis for mutation patterns
2. **LLM-assisted**: Send code + principle → validate alignment
3. **Manual review**: Developers mark violations during code review

## Integration with Other Overlays

### O₁ (Structure)

Principles manifest in structural patterns:

```text
Principle: "Immutability is essential"
  ↓
O₁ Patterns:
  - ObjectStore.put() (write-once)
  - readonly modifiers in TypeScript
  - Pure functions (no side effects)
```

### O₂ (Security)

Principles enforce security:

```text
Principle: "Validate Before Trust"
  ↓
O₂ Security:
  - Schema validation (Zod)
  - Input sanitization
  - Oracle verification
```

### O₃ (Lineage)

Principles propagate through dependencies:

```text
Principle: "One Source of Truth"
  ↓
O₃ Lineage:
  - Trace source → derived data
  - Verify no duplicate authorities
```

### O₇ (Coherence)

Principles enable adherence scoring:

```bash
# Find symbols that violate "Immutability"
cognition-cli coherence drifted --principle "Immutability is essential"

# Output:
Symbol: UserService.update()
Alignment: 0.32 (LOW)
Issue: Mutates object in place
Fix: Return new object
```

## The Zen of Cognition CLI

Inspired by "The Zen of Python" (PEP 20), here are the guiding aphorisms:

```text
Immutability over mutation.
Hashes are identity.
Determinism over randomness.
Provenance over trust.
Explicit over implicit.
Fail fast over silent corruption.
Validate before trust.
Test invariants, not implementation.
One source of truth.
Structure over regex.
Parallel mining, serial embedding.
```

## Future Enhancements

- [ ] **Automated Violation Detection**: AST analysis for principle violations
- [ ] **LLM-Assisted Review**: Send code + principles → alignment score
- [ ] **Principle Evolution Tracking**: Version principles like code
- [ ] **Cross-Project Principles**: Share principles across projects
- [ ] **Principle-Driven Refactoring**: Suggest refactorings based on violations

## Related Documentation

- [O₄: Mission Concepts - Pattern Library](./PATTERN_LIBRARY.md)
- [O₇: Strategic Coherence](../O7_coherence/STRATEGIC_COHERENCE.md)
- [Multi-Overlay Architecture](../../architecture/MULTI_OVERLAY_ARCHITECTURE.md)
