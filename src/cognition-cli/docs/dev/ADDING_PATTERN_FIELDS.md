# Adding New Fields to Structural Patterns

**Date:** 2025-11-17
**Context:** Lessons learned from adding Python `body_dependencies` support

## The Problem

When adding new fields to structural data extracted from code, there are **multiple places** that must be updated. Missing any of these will cause data to be silently dropped or ignored.

## Real-World Example: Adding `body_dependencies`

We wanted to track Python class instantiations in function bodies (e.g., `client = DatabaseClient()`), not just type annotations. This required changes across 3 repositories and 7 files.

### The Bug Hunt Timeline

1. ✅ **eGemma changes** (17:02) - Added extraction logic
2. ⏰ **First regen** (17:05) - eGemma hadn't hot-reloaded yet → no data
3. ⏰ **Second regen** (17:15) - eGemma had stale LRU cache → old data
4. ⏰ **Third regen** (17:21) - eGemma restarted, but **Zod schema was dropping the data!**
5. ✅ **Schema fix** (17:30) - Finally worked

**The sneaky culprit:** The Zod validation schema didn't include the new field, so it was silently stripped even though eGemma was returning it correctly.

## Checklist: All Places to Update

When adding a new field to structural patterns, you MUST update:

### 1. Data Source (eGemma)

**Location:** `~/src/egemma/src/util/ast_parser.py`

Add extraction logic to capture the new data from AST.

**Example:**

```python
class ASTBodyDependencyVisitor(ast.NodeVisitor):
    def __init__(self):
        self.instantiations = []

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name):
            if node.func.id[0].isupper():  # Class name
                self.instantiations.append(node.func.id)

# Add to function output
functions.append({
    "name": node.name,
    "params": params,
    "returns": _get_node_name(node.returns),
    "body_dependencies": {  # ← NEW FIELD
        "instantiations": list(set(body_visitor.instantiations)),
        "method_calls": body_visitor.method_calls,
    },
})
```

**Validation:**

```bash
curl -s -X POST http://localhost:8000/parse-ast \
  -H "Authorization: Bearer dummy-key" \
  -F "file=@test.py" \
  -F "language=python" | jq '.functions[0].body_dependencies'
```

### 2. TypeScript Type Schema (cognition-cli)

**Location:** `src/core/types/structural.ts`

Update the Zod schema to include the new field. If you skip this, **the data will be silently dropped** during validation!

**Example:**

```typescript
export const FunctionDataSchema = z.object({
  name: z.string(),
  docstring: z.string(),
  params: z.array(ParameterDataSchema),
  returns: z.string(),
  is_async: z.boolean(),
  decorators: z.array(z.string()),
  body_dependencies: z
    .object({
      // ← NEW FIELD (optional!)
      instantiations: z.array(z.string()),
      method_calls: z.array(z.tuple([z.string(), z.string()])),
    })
    .optional(), // Optional because TypeScript won't have it
});
```

**⚠️ Critical:** Mark as `.optional()` if the field only exists for some languages (e.g., Python but not TypeScript).

**After changes:**

```bash
npm run build  # Rebuild TypeScript
```

### 3. Lineage Worker (cognition-cli)

**Location:** `src/core/overlays/lineage/worker.ts`

Update lineage extraction to process the new field when building dependency graphs.

**Example:**

```typescript
// Process class methods
c.methods?.forEach((m) => {
  const methodLineage = `${classLineage} -> ${m.name}`;

  // Process type annotations (existing)
  m.params?.forEach((p) => processType(p.type, methodLineage));
  processType(m.returns, methodLineage);

  // Process body_dependencies (NEW)
  const bodyDeps = (m as any).body_dependencies;
  if (bodyDeps?.instantiations) {
    bodyDeps.instantiations.forEach((className: string) => {
      dependencySymbolToLineage.set(className, methodLineage);
    });
  }
});

// Also update standalone functions!
structuralData.functions?.forEach((f: FunctionData) => {
  // ... same pattern
});
```

**Commit:** `aa3f2b7 - feat: process body_dependencies from Python AST in lineage extraction`

### 4. Graph Traversal (cognition-cli)

**Location:** `src/core/graph/traversal.ts`

Update blast-radius graph building to process the new field.

**Example:**

```typescript
// In buildGraph() method
structuralData.classes?.forEach((c: ClassData) => {
  c.methods?.forEach((m) => {
    // Process parameters and returns (existing)
    // ...

    // Process body_dependencies (NEW)
    const bodyDeps = (m as any).body_dependencies;
    if (bodyDeps?.instantiations) {
      for (const className of bodyDeps.instantiations) {
        if (manifest[className]) {
          edges.push({
            from: symbol,
            to: className,
            type: 'uses',
            fromFile: filePath,
            toFile: this.getFilePathFromManifestEntry(manifest[className]),
          });
          // Update adjacency lists
          // ...
        }
      }
    }
  });
});
```

**Commit:** `c1304ed - feat: process body_dependencies in blast-radius graph traversal`

### 5. Tests (cognition-cli)

**Location:** `src/core/overlays/lineage/__tests__/worker.test.ts`

Add tests verifying the new field is processed correctly.

**Example:**

```typescript
it('CRITICAL: should extract dependencies from Python function body_dependencies', async () => {
  const fileStructuralData: StructuralData = {
    language: 'python',
    functions: [
      {
        name: '_ingest_from_database',
        params: [{ name: 'submitter', type: 'WorkbenchSubmitter' }],
        returns: 'None',
        is_async: true,
        decorators: [],
        body_dependencies: {
          // ← NEW FIELD
          instantiations: ['DatabaseClient', 'DataTransformer'],
          method_calls: [['database_client', 'get_history']],
        },
      },
    ],
    // ...
  };

  // Test that dependencies are extracted from BOTH type annotations AND body
  expect(dependencies.has('WorkbenchSubmitter')).toBe(true); // From type
  expect(dependencies.has('DatabaseClient')).toBe(true); // From body
});
```

**Run tests:**

```bash
npm test -- worker.test.ts
```

**Commit:** `cd9e9d2 - test: add tests for Python body_dependencies in lineage extraction`

### 6. Rebuild and Regenerate

**After all code changes:**

```bash
# 1. Rebuild cognition-cli
cd ~/src/cogx/src/cognition-cli
npm run build

# 2. Restart eGemma (to clear cache)
cd ~/src/egemma
# Kill the process and restart
uv run --env-file=.env uvicorn src.server:app --host localhost --port 8000 --reload

# 3. Regenerate overlays in target project
cd ~/src/example-project
cognition-cli overlay generate structural_patterns --force
cognition-cli overlay generate lineage_patterns --force  # If needed

# 4. Verify it works
cognition-cli blast-radius DatabaseClient
```

## Common Pitfalls

### ❌ Pitfall 1: Zod Schema Not Updated

**Symptom:** eGemma returns data correctly (verified with curl), but cognition-cli doesn't store it

**Cause:** Zod schema validation strips unknown fields

**Fix:** Always update `src/core/types/structural.ts` schemas

**Debug:**

```bash
# Test eGemma directly
curl -s http://localhost:8000/parse-ast ... | jq '.functions[0].body_dependencies'

# Check stored data in PGC
cd ~/src/example-project
HASH=$(jq -r '.symbolStructuralDataHash' .open_cognition/overlays/structural_patterns/FILE#SYMBOL.json)
cat ".open_cognition/objects/${HASH:0:2}/${HASH:2}" | jq '.functions[0].body_dependencies'
```

If eGemma has it but PGC doesn't → **Zod schema issue!**

### ❌ Pitfall 2: eGemma LRU Cache

**Symptom:** Changes work with curl but not with cognition-cli

**Cause:** eGemma caches parse results by file content hash

**Fix:** Restart eGemma server to clear cache

**Debug:**

```bash
# Check eGemma process start time
ps aux | grep uvicorn | grep egemma

# If started before code changes → restart!
```

### ❌ Pitfall 3: Forgot Standalone Functions

**Symptom:** Methods work but standalone functions don't

**Cause:** Updated `classes[].methods` but forgot `functions[]`

**Fix:** Always update BOTH:

- `structuralData.classes[].methods[]`
- `structuralData.functions[]`

### ❌ Pitfall 4: Missing `.optional()`

**Symptom:** TypeScript files fail to parse

**Cause:** Field required in schema but only Python has it

**Fix:** Mark language-specific fields as `.optional()`

## Verification Checklist

After making all changes, verify end-to-end:

- [ ] **eGemma returns new field** (test with curl)
- [ ] **Zod schema includes new field** (check TypeScript types)
- [ ] **PGC stores new field** (check object store)
- [ ] **Lineage worker processes it** (check lineage patterns)
- [ ] **Graph traversal uses it** (check blast-radius output)
- [ ] **Tests cover it** (run test suite)
- [ ] **Both methods AND functions work** (test both)

## Quick Reference: File Locations

| Component       | Repository    | File Path                                            |
| --------------- | ------------- | ---------------------------------------------------- |
| AST Extraction  | eGemma        | `src/util/ast_parser.py`                             |
| Type Schema     | cognition-cli | `src/core/types/structural.ts`                       |
| Lineage Worker  | cognition-cli | `src/core/overlays/lineage/worker.ts`                |
| Graph Traversal | cognition-cli | `src/core/graph/traversal.ts`                        |
| Tests           | cognition-cli | `src/core/overlays/lineage/__tests__/worker.test.ts` |

## Related Documentation

- [Lineage Usage Analysis](./LINEAGE_USAGE_ANALYSIS.md) - Why we have two dependency tracking systems
- [Structural Types](../../src/core/types/structural.ts) - Complete type definitions
- [The PGC](../manual/part-1-foundation/02-the-pgc.md) - How overlays work

## Lessons Learned

1. **Zod schemas are gatekeepers** - They silently drop unknown fields
2. **Cache invalidation is hard** - eGemma LRU cache caused confusion
3. **Test at every layer** - curl → schema → storage → processing → output
4. **Language-specific fields need `.optional()`** - TypeScript won't have Python fields
5. **Both methods AND functions** - Easy to forget standalone functions

---

**Next time someone adds a pattern field, follow this checklist to avoid the 4-hour debugging session! 😅**
