# Lineage Extraction Bug - Summary & Fix Proposal

## Current State
- **Structural patterns**: 94/102 in manifest (92%)
- **Lineage patterns**: 6/94 with dependencies (6%)
- **Expected**: Should be ~90%+ with full manifest

## What Works
✅ Only `implements` relationships are found (6 patterns)
- LineagePatternsManager → PatternManager
- TypeScriptParser → ASTParser
- etc.

## What Doesn't Work
❌ Types used in method parameters/returns are NOT found (88 patterns)
- OverlayOrchestrator uses `PGCManager`, `LanceVectorStore` in constructor
- GenesisOrchestrator uses `WorkbenchClient`, `StructuralMiner` in methods
- **These types ARE in the manifest**
- **But lineage extraction found 0 dependencies**

## Verified Facts

1. ✅ **Manifest has the types**: `PGCManager`, `LanceVectorStore`, etc. all present
2. ✅ **Structural data has the types**: Method params correctly show `"type": "PGCManager"`
3. ✅ **Lineage worker loads correct data**: Gets file-level structural data from transform
4. ✅ **Code paths exist**: Lines 280-288 call `processType()` for each param
5. ✅ **Filters should pass**: Types like `PGCManager` meet all criteria (uppercase, not built-in, etc.)
6. ✅ **Manifest lookup should work**: Line 303 does `structuralManifest[depSymbol]`

## The Mystery

**Why doesn't `processType()` find the dependencies?**

The worker should:
1. Load file-level structural data ✅
2. Iterate over classes ✅
3. Iterate over methods ✅
4. Call `processType(param.type, lineage)` for each param ✅
5. Extract types like "PGCManager" ✅
6. Add to `dependencySymbolToLineage` map ✅
7. Look up in manifest at line 303 ✅
8. Find it and add to dependencies ✅

**But it's not happening!**

## Hypothesis

There may be a subtle bug in the actual execution. Possibilities:

1. **Silent exception**: `processType()` or manifest lookup throws but is caught
2. **Wrong iteration**: Not actually iterating over the right classes/methods
3. **Data mismatch**: The loaded structural data doesn't match what we expect
4. **Timing issue**: Manifest is loaded but then becomes stale
5. **Type cleaning bug**: The regex in `processType()` mangles the type name

## Proposed Fixes

### Fix 1: Add Debug Logging (IMMEDIATE)
Add console.log statements to lineage worker to trace execution:

```typescript
// At line 270
console.log(`[DEBUG] Processing ${structuralData.classes?.length} classes`);

structuralData.classes?.forEach((c: ClassData) => {
  console.log(`[DEBUG] Class: ${c.name}, methods: ${c.methods?.length}`);
  c.methods?.forEach((m) => {
    console.log(`[DEBUG]   Method: ${m.name}, params: ${m.params?.length}`);
    m.params?.forEach((p) => {
      console.log(`[DEBUG]     Param: ${p.name}, type: ${p.type}`);
      processType(p.type, methodLineage);
    });
  });
});

// Inside processType() after cleaning
console.log(`[DEBUG] processType: input="${type}", cleaned="${cleanType}", excluded=${excludeTypes.has(cleanType)}`);

// At line 303
console.log(`[DEBUG] Looking up "${depSymbol}" in manifest: ${structuralManifest[depSymbol] || 'NOT FOUND'}`);
```

Then regenerate ONE lineage pattern with logging to see what happens.

### Fix 2: Use Imports Instead (ALTERNATIVE APPROACH)

Instead of extracting from method signatures, use `StructuralData.imports`:

```typescript
// At line 269, BEFORE iterating classes
const imports = structuralData.imports || [];
console.log(`[DEBUG] File has ${imports.length} imports`);

for (const imp of imports) {
  // Parse import: "import { PGCManager } from '../pgc/manager.js'"
  const match = imp.match(/import\s+{([^}]+)}/);
  if (match) {
    const symbols = match[1].split(',').map(s => s.trim());
    for (const symbol of symbols) {
      if (structuralManifest[symbol]) {
        // Found a dependency!
        dependencySymbolToLineage.set(symbol, parentLineage);
      }
    }
  }
}
```

This approach is simpler and more reliable - we know what the file imports!

### Fix 3: Bypass Lineage Worker Entirely (FAST PATH)

For blast radius, we don't need the time-traveling feature. We just need the CURRENT dependency graph. Build it directly from structural patterns:

```typescript
class DependencyGraphBuilder {
  async buildGraph(): Promise<Graph> {
    const graph = new Graph();

    // For each structural pattern
    for (const [symbol, filePath] of manifest) {
      const pattern = await loadPattern(symbol);
      const structuralData = await loadStructuralData(pattern.symbolStructuralDataHash);

      // Extract imports from file
      for (const imp of structuralData.imports) {
        const importedSymbols = parseImport(imp);
        for (const depSymbol of importedSymbols) {
          if (manifest[depSymbol]) {
            graph.addEdge(symbol, depSymbol, 'imports');
          }
        }
      }

      // Extract type usages
      for (const cls of structuralData.classes) {
        for (const method of cls.methods) {
          for (const param of method.params) {
            if (manifest[param.type]) {
              graph.addEdge(symbol, param.type, 'uses');
            }
          }
        }
      }
    }

    return graph;
  }
}
```

## Recommendation

1. **Immediate**: Add debug logging (Fix 1) and regenerate ONE pattern to see the trace
2. **Short-term**: Implement import-based dependencies (Fix 2) as it's more reliable
3. **Medium-term**: Build direct graph (Fix 3) for blast radius without time-travel
4. **Long-term**: Fix the lineage worker's time-travel algorithm once we understand the bug

## Next Steps

1. Add logging to lineage worker
2. Test on ONE symbol (e.g., OverlayOrchestrator)
3. See where the extraction fails
4. Implement appropriate fix

Would you like me to add the debug logging and test it?
