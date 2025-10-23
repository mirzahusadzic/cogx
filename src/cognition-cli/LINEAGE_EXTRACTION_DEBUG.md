# Lineage Extraction Debug Report

## Problem
After regenerating structural patterns (manifest: 94 entries), lineage extraction still only finds dependencies in 6% of patterns (6/94).

## Investigation

### Confirmed Working:
1. ✅ Manifest has 94 symbols (up from 16)
2. ✅ User-defined types ARE in the manifest (WorkbenchClient, PGCManager, etc.)
3. ✅ Code DOES use these custom types in method signatures
4. ✅ Reverse deps exist for symbols

### Example: GenesisOrchestrator
**Expected**: Should have dependencies on WorkbenchClient, PGCManager, GenesisOracle, etc.
**Actual**: 0 dependencies found

**Method signatures use custom types:**
- `PGCManager`
- `WorkbenchClient`
- `StructuralMiner`
- `GenesisOracle`
- `SourceFile`
- `StructuralData`

**All these types ARE in manifest** ✅

### Root Cause Hypothesis

The lineage worker (`src/core/overlays/lineage/worker.ts`) has this flow:

1. **Line 147-156**: Get transform IDs for the symbol's structural hash
2. **Line 159-163**: Load transform data, get `outputs[0].hash` (sourceStructuralHash)
3. **Line 166-173**: Retrieve the FULL FILE structural data from that hash
4. **Line 269-295**: Extract types from ALL classes/functions/interfaces in the file
5. **Line 298-333**: Look up extracted types in manifest

### Issue #1: Wrong Hash Being Used?

Line 163 uses `transformData.outputs[0].hash` as the "sourceStructuralHash" to load the file's structure.

**Question**: Is this the right hash? Let's check:
- The symbol's `symbolStructuralDataHash` points to JUST that symbol's structural data
- The transform's `outputs[0].hash` should point to... what exactly?
  - Is it the FULL FILE structural data?
  - Is it the content hash?
  - Is it something else?

### Issue #2: Type Extraction Scope

Lines 270-295 extract types from the ENTIRE FILE:
```typescript
structuralData.classes?.forEach((c: ClassData) => {
  // Extracts types from ALL classes in file
```

**Problem**: If GenesisOrchestrator is one of multiple classes in genesis.ts, it's extracting types from all of them, not just GenesisOrchestrator.

But wait - the structural pattern should be symbol-specific... Let me verify.

### Issue #3: Symbol vs File Structural Data

There are TWO kinds of structural data:
1. **File-level**: Full AST of entire file (all classes, functions, interfaces)
2. **Symbol-level**: Just one class/function/interface

The lineage worker seems to expect file-level data (line 169-295), but the structural patterns store symbol-level data.

**Critical question**: When we call `pgc.objectStore.retrieve(sourceStructuralHash)` on line 166, what do we get?
- File-level StructuralData? (classes[], functions[], interfaces[])
- Symbol-level StructuralData? (just ONE class/function/interface)

### Issue #4: Transform Log Investigation Needed

The transform log is supposed to record:
- **Inputs**: What went into creating this symbol
- **Outputs**: What was created

For structural patterns, what should the transform look like?
- Input: Raw file content?
- Output: Structural data for the symbol?

**If output is symbol-level**, then line 163 `transformData.outputs[0].hash` gives us the symbol's own structural data, NOT the file it came from. That would explain why no dependencies are found - we're looking at the symbol in isolation!

## Hypothesis

**The lineage worker expects a "time-traveling" flow**:
1. Find when symbol was created (transform ID)
2. Load the INPUT that created it (the full file at that moment)
3. Extract dependencies from that file context

**But what's actually happening**:
1. Find when symbol was created (transform ID)
2. Load the OUTPUT (the symbol itself in isolation)
3. Try to extract dependencies (but symbol-level data might not have full context)

## To Verify

1. Check what `transformData.outputs[0].hash` actually points to:
   - Is it file-level or symbol-level structural data?

2. Check if transform has INPUTS that point to file-level data

3. Verify what data is stored for a symbol in the object store

## Proposed Fix

**Option A**: Store file-level context with each symbol
- When creating structural patterns, also store reference to full file structural data
- Use that for dependency extraction

**Option B**: Use imports/exports instead of type extraction
- Don't rely on method signatures
- Use `StructuralData.imports` and `exports` fields
- Build dependency graph from import relationships

**Option C**: Fix transform log to track correct data
- Ensure transforms record both:
  - Input: Full file structural data
  - Output: Symbol-specific structural data
- Update lineage worker to use inputs instead of outputs

## Next Steps

1. Inspect one transform to see its structure
2. Check what data `outputs[0].hash` points to
3. Implement correct fix based on findings
