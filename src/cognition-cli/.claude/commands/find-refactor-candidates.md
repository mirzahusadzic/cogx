# Find Refactoring Candidates

Use structural pattern similarity to discover refactoring opportunities via a 3-step pipeline: **discover → validate → ground**.

## Goal

Identify code that shares high structural similarity, validate that similarity represents real duplication (not just architectural convention), and suggest concrete refactorings grounded in actual source code.

## Understanding the Tools

`cognition-cli patterns` has three commands for similarity analysis. Each uses a **different search method** — understanding this is critical to avoiding false positives:

| Command        | Best For                                      | Technical Method                                                                                                                        | Precision |
| -------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `find-similar` | **Discovery** — surfacing candidate clusters  | Vector DB ANN (approximate nearest neighbor) search. Fast but approximate — can miss matches due to index approximation or top-K cutoff | Low       |
| `compare`      | **Verification** — confirming a specific pair | Direct vector fetch + exact cosine similarity. Bypasses ANN indexing entirely                                                           | High      |
| `inspect`      | **Context** — understanding a single symbol   | Single-lookup + top-K neighbors                                                                                                         | Medium    |

**Key insight:** `find-similar` uses approximate search that trades precision for speed. Symbols can be "pushed out" of top-K results by tightly clustered neighbors even when they have high pairwise similarity. `compare` gives mathematical ground truth.

## ⚠️ Critical Warning: High Similarity ≠ Refactorable Duplication

AST/vector similarity measures **structural shape**, not **logical duplication**. Common false positive patterns:

- **Models extending the same base class** (e.g., Pydantic `BaseModel` subclasses, SQLAlchemy ORM models) will show 0.85–0.91 similarity because they share the same shape (extends, 0 methods, 0 decorators) — but a metaclass/factory would add indirection for negligible savings
- **Config-only classes** (schemas, DTOs, request/response objects) are naturally uniform — similar structure does NOT mean duplicated logic
- **Classes in the same architectural role with different interfaces** — e.g., data transformers may show 0.80+ similarity but have completely different method signatures, inputs, and outputs

**How to detect false positives with `compare`:** Look at the structural signatures. If `methods`, `imports`, or `exports` counts diverge between two "similar" symbols, the similarity is structural (same shape) not logical (same code).

## Steps

### Phase 1: Discover (broad scan)

1. Run `cognition-cli patterns list` to get all symbols and available roles

2. For each major architectural role:
   - Select 1–2 representative symbols
   - Run `cognition-cli patterns find-similar <symbol> --top-k 10`
   - Note candidate groups with similarity > 0.70 (not 0.85 — real duplication often starts at 0.70+)

### Phase 2: Validate (cheap structural check)

1. For each candidate pair/group from Phase 1, run `cognition-cli patterns compare <symbolA> <symbolB>`:
   - **Compare structural signatures** (extends, methods, imports, exports, decorators)
   - Apply this decision matrix:

   | Signature Match                                 | Similarity | Action                                                                  |
   | ----------------------------------------------- | ---------- | ----------------------------------------------------------------------- |
   | Identical extends + methods + imports + exports | > 0.80     | ✅ Proceed to Phase 3 (very likely real duplication)                    |
   | Same extends, different method count            | > 0.75     | ⚠️ Possible — check if base class can absorb methods                    |
   | Different imports or exports                    | any        | ❌ Likely false positive — different dependencies means different logic |
   | Same structure, extends:BaseModel/Base          | > 0.85     | ⚠️ Probably just architectural convention, not duplication              |
   - **Reject** candidates where signatures diverge — do NOT proceed to code reading

### Phase 3: Ground (read actual code)

1. For validated candidates ONLY, read the actual source files:
   - Count exact LOC per class/function
   - Identify the **specific lines** that are duplicated (not just "similar shape")
   - Verify that duplicated logic exists (identical code blocks, copy-pasted methods)
   - Check for subtle differences that prevent naive extraction (different error handling, extra parameters, special-case logic)
   - Note what is unique to each symbol (these become subclass overrides or hook methods)

2. For each confirmed refactoring opportunity:
   - Reference exact line numbers
   - Count current LOC vs estimated refactored LOC
   - Design the concrete fix (name the new class/function/decorator, describe its interface)
   - Identify which symbol has unique logic that needs a hook/override
   - Assess risk (does this touch hot paths? does it change public API?)

3. Also look for **cross-cutting patterns** during code reading that AST similarity may not surface:
   - Repeated try/except or error-handling blocks across endpoint files
   - Repeated context manager / session management boilerplate
   - Identical factory functions or test fixtures
   - These are often the biggest wins but live across files, not within symbol pairs

## Output Format

Present findings organized by priority tier (🔴 High / 🟡 Medium / 🟢 Low) with:

- Exact file paths and line numbers
- Concrete before/after LOC counts
- Specific fix descriptions (not generic "extract base class")
- A rejected candidates section explaining false positives

Include a summary table and recommended execution order.

## Example

```
🔍 Refactoring Candidates Found:

## 🔴 High Priority

### 1. Repository Consolidation (~64 LOC)

**Where:** `src/storage/repository.py`
**Validated:** `compare MemberRepo AdminRepo` → 93.4% similarity, identical signatures:
  MemberRepo: class | extends:Base | methods:3 | imports:2 | exports:14
  AdminRepo:  class | extends:Base | methods:3 | imports:2 | exports:14

**Pattern:** MemberRepository (lines 120–186, 66 LOC) and AdminRepository
(lines 188–256, 68 LOC) are 95% identical:

  | Method  | Member LOC | Admin LOC | Difference           |
  |---------|-----------|-----------|----------------------|
  | add     | 31        | 31        | Only ORM model name  |
  | remove  | 12        | 12        | Only assertion msg   |
  | list    | 17        | 17        | Identical            |

**Fix:** Extract `GenericRelationshipRepository` base with `add()`, `remove()`,
`list()`. Each subclass adds only its unique method. 134 LOC → ~80 LOC.

## ❌ Rejected Candidates

### Data Processors — BaseProcessor

**AST similarity:** 83% between ProcessorA, ProcessorB, ProcessorC.
**Rejected by `compare`:** Different import counts (3 vs 1 vs 4) → different deps.
  ProcessorA: methods:1 | imports:3 | exports:1
  ProcessorB: methods:1 | imports:1 | exports:1
**Confirmed by code:** Completely different method signatures and interfaces.
A base class would add complexity with zero code reduction.
```

## Follow-up Questions

After presenting findings, ask:

- "Which refactoring would you like to tackle first?"
- "Should I create a detailed implementation plan for any of these?"
- "Would you like me to analyze a specific architectural role more deeply?"

## Notes

- **Always run `compare` before reading code** — it takes seconds and filters out false positives
- `find-similar` casts a wide net; `compare` gives ground truth; code reading confirms
- Focus on LOC counts and line references, not abstract patterns
- High similarity between models/schemas/DTOs is usually architectural convention, not duplication
- The real wins are often in **cross-cutting patterns** (error handling, session management, factories) that AST similarity may not surface — look for these during code reading
- Suggest incremental refactoring when impact is large
