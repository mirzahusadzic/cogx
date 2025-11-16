# INCREMENTAL UPDATES

## Complete Incremental Update Plan for All Overlays

### Universal Strategy

**Core Principle**: Pre-filter at orchestrator level using manifest + sourceHash comparison, avoiding expensive worker operations for unchanged items.

---

## O₁ - Structural Patterns

### Current State:

- Manifest: `{ "symbolName": "filePath" }`
- Metadata files: Store `validation.sourceHash`
- Problem: All 484 jobs sent to workers even if 476 unchanged

### Proposed Changes:

**1. Extend Manifest Format (Backward Compatible)**

```json
{
  "DocumentSearchResult": {
    "filePath": "src/core/pgc/document-lance-store.ts",
    "sourceHash": "e4a644dd23176ec0e6507f8a1cbf5a7c6ff5ce2fbef7789f9b55cefa3dd84453",
    "lastUpdated": "2025-11-08T12:00:26.883Z"
  },
  "OldPattern": "src/old/file.ts" // Old format still supported
}
```

**2. Orchestrator Pre-filtering**

```typescript
// In overlay.ts, before creating jobs
async preFilterStructuralJobs(allFiles, force) {
  const manifest = await this.pgc.overlays.getManifest('structural_patterns');
  const jobsToProcess = [];

  for (const file of allFiles) {
    const currentContentHash = this.pgc.objectStore.computeHash(file.content);
    const structuralData = await this.miner.extractStructure(file);

    for (const symbol of extractSymbols(structuralData)) {
      const manifestEntry = manifest[symbol.name];

      // Backward compatible check
      const needsProcessing = force ||
        !manifestEntry ||
        (typeof manifestEntry === 'object' &&
         manifestEntry.sourceHash !== currentContentHash);

      if (needsProcessing) {
        jobsToProcess.push(createJob(symbol, file, currentContentHash));
      }
    }
  }

  return jobsToProcess;
}
```

**3. Update Manifest Writer**

```typescript
// When storing pattern metadata
await this.pgc.overlays.updateManifest('structural_patterns', symbolName, {
  filePath: relativePath,
  sourceHash: contentHash,
  lastUpdated: new Date().toISOString(),
});
```

---

## O₂ - Security Guidelines

### Current State:

- No manifest tracking
- Regenerates all security rules every time

### Proposed Changes:

**1. Create Manifest Tracking**

```json
{
  "Input Validation Rule": {
    "sourceFile": "SECURITY_GUIDELINES.md",
    "documentHash": "abc123...",
    "lastUpdated": "2025-11-08T12:00:00Z"
  }
}
```

**2. Document-Based Incremental Logic**

```typescript
async preFilterSecurityGuidelines(documents, force) {
  const manifest = await this.pgc.overlays.getManifest('security_guidelines');
  const docsToProcess = [];

  for (const doc of documents) {
    const currentDocHash = computeDocumentHash(doc);
    const existingEntry = manifest[doc.name];

    if (force || !existingEntry || existingEntry.documentHash !== currentDocHash) {
      docsToProcess.push(doc);
    }
  }

  return docsToProcess;
}
```

---

## O₃ - Lineage Patterns

### Current State:

- Built from manifest (already efficient!)
- No source file tracking

### Proposed Changes:

**1. Track Source Hashes in Lineage Manifest**

```json
{
  "src/core/pgc/manager.ts": {
    "patterns": ["PGCManager"],
    "sourceHash": "xyz789...",
    "dependencies": ["src/core/pgc/object-store.ts"],
    "lastAnalyzed": "2025-11-08T12:00:00Z"
  }
}
```

**2. Incremental Lineage Analysis**

```typescript
async generateLineageIncremental(force) {
  const manifest = await this.lineagePatternManager.getManifest();
  const filesToAnalyze = [];

  for (const file of allSourceFiles) {
    const currentHash = computeFileHash(file);
    const entry = manifest[file.path];

    if (force || !entry || entry.sourceHash !== currentHash) {
      filesToAnalyze.push(file);
    }
  }

  await this.lineagePatternManager.analyzeFiles(filesToAnalyze);
}
```

---

## O₄ - Mission Concepts

### Current State:

- Extracts from ingested documents
- No incremental tracking

### Proposed Changes:

**1. Document-Level Tracking**

```json
{
  "VISION.md": {
    "documentHash": "abc123...",
    "conceptCount": 15,
    "extractedConcepts": ["Lattice Operations", "Semantic Coherence", ...],
    "lastProcessed": "2025-11-08T12:00:00Z"
  }
}
```

**2. Incremental Concept Extraction**

```typescript
async preFilterMissionDocuments(documentHashes, force) {
  const manifest = await this.missionConceptsManager.getManifest();
  const docsToProcess = [];

  for (const [docPath, docHash] of documentHashes) {
    const entry = manifest[docPath];

    if (force || !entry || entry.documentHash !== docHash) {
      docsToProcess.push(docPath);
    }
  }

  return docsToProcess;
}
```

---

## O₅ - Operational Patterns

### Current State:

- Similar to structural patterns
- Tracks runtime/operational characteristics

### Proposed Changes:

**Same as O₁** - Use manifest with sourceHash tracking:

```json
{
  "handleRequest": {
    "filePath": "src/api/handler.ts",
    "sourceHash": "def456...",
    "operationalComplexity": 0.85,
    "lastUpdated": "2025-11-08T12:00:00Z"
  }
}
```

---

## O₆ - Mathematical Proofs

### Current State:

- Document-based extraction
- Theorem/proof tracking

### Proposed Changes:

**Document-Level Tracking** (like O₄):

```json
{
  "MATHEMATICAL_PROOFS.md": {
    "documentHash": "ghi789...",
    "proofsCount": 3,
    "extractedTheorems": ["Lattice Completeness", "Join Associativity"],
    "lastProcessed": "2025-11-08T12:00:00Z"
  }
}
```

---

## O₇ - Strategic Coherence

### Current State:

- Computes alignment between mission concepts and code
- No incremental support

### Proposed Changes:

**1. Track Input Dependencies**

```json
{
  "dependencies": {
    "missionConceptsHash": "abc123...",
    "structuralPatternsHash": "def456...",
    "lastComputed": "2025-11-08T12:00:00Z"
  },
  "coherenceScore": 0.85
}
```

**2. Skip If Dependencies Unchanged**

```typescript
async shouldRegenerateCoherence(force) {
  const manifest = await this.strategicCoherenceManager.getManifest();

  if (force) return true;

  // Check if inputs changed
  const missionHash = await computeMissionConceptsHash();
  const structuralHash = await computeStructuralPatternsHash();

  return !manifest.dependencies ||
    manifest.dependencies.missionConceptsHash !== missionHash ||
    manifest.dependencies.structuralPatternsHash !== structuralHash;
}
```

---

## Universal Manifest Interface

**Create common interface for all overlays:**

```typescript
interface OverlayManifestEntry {
  // Common fields
  lastUpdated: string;

  // Type-specific fields (union)
  filePath?: string; // For code patterns (O₁, O₅)
  sourceHash?: string; // For code patterns
  documentHash?: string; // For doc-based (O₂, O₄, O₆)
  sourceFile?: string; // For doc-based
  dependencies?: object; // For computed overlays (O₇)

  // Backward compatibility
  [key: string]: unknown; // Allow old string format
}

interface OverlayManifest {
  format_version?: number; // For future migrations
  entries: Record<string, OverlayManifestEntry | string>; // String = old format
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

1. ✅ Create `ManifestManager` with backward-compatible reading
2. ✅ Implement hash comparison utilities
3. ✅ Add pre-filtering to orchestrator base class

### Phase 2: Code-Based Overlays (Week 2)

1. ✅ Update O₁ (Structural Patterns)
2. ✅ Update O₅ (Operational Patterns)
3. ✅ Update O₃ (Lineage) - enhance existing

### Phase 3: Document-Based Overlays (Week 3)

1. ✅ Update O₄ (Mission Concepts)
2. ✅ Update O₂ (Security Guidelines)
3. ✅ Update O₆ (Mathematical Proofs)

### Phase 4: Computed Overlay (Week 4)

1. ✅ Update O₇ (Strategic Coherence)
2. ✅ Dependency tracking

### Phase 5: Testing & Migration (Week 5)

1. ✅ Test backward compatibility
2. ✅ Gradual migration of existing manifests
3. ✅ Performance benchmarks

---

## Migration Path

**Backward Compatibility Guarantees:**

```typescript
function readManifestEntry(entry: unknown, symbolName: string) {
  // Old format: "symbolName": "filePath"
  if (typeof entry === 'string') {
    return {
      filePath: entry,
      sourceHash: undefined, // Will trigger re-read from metadata
      needsMigration: true,
    };
  }

  // New format: "symbolName": { filePath, sourceHash, ... }
  return {
    ...entry,
    needsMigration: false,
  };
}
```

**Gradual Migration:**

- New overlays use new format immediately
- Old overlays migrate on next `--force` regeneration
- System works with mixed old/new formats indefinitely

---

## Performance Impact

**Before** (current):

- O₁: 484 jobs → 476 skipped in workers → 8 embedded
- Worker overhead: 476 × (spawn + IPC + overlay check)

**After** (with pre-filtering):

- O₁: 8 jobs → 8 embedded
- Worker overhead: 8 × (spawn + IPC)
- **~60x reduction in worker operations**

**Expected improvements:**

- 🚀 80-90% reduction in generation time for unchanged code
- 🚀 No more need for `--force` flag
- 🚀 True incremental updates without file watcher
- 🚀 Works identically for all 7 overlays

---

## Summary

This plan provides:

1. ✅ **Universal approach** for all 7 overlays
2. ✅ **Backward compatibility** with existing manifests
3. ✅ **No worker changes** - keeps them lightweight
4. ✅ **Manifest-based** - single source of truth
5. ✅ **Incremental by default** - no flags needed
6. ✅ **Document tracking** - works for both code and docs

**Sound good? Should we start with Phase 1 (Core Infrastructure)?**
