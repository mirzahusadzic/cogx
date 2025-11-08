# CRITICAL: LanceDB Migration Incomplete - System-Wide Embedding Load Failure

## Status: BLOCKING BUG

**Severity**: Critical
**Impact**: All overlay generation and security features broken after migration
**Date Identified**: 2025-11-08

---

## Problem Summary

The `migrate:lance` command successfully migrates embeddings to LanceDB and strips them from YAML files (v1 → v2 format), but **all embedding readers still expect embeddings in YAML files**. This causes system-wide failures after migration.

### What Works

- ✅ Migration itself (`migrate:lance`) - embeddings stored in LanceDB
- ✅ YAML files converted to v2 format (stripped embeddings)
- ✅ LanceDB storage working correctly

### What Breaks (15+ locations)

After running `migrate:lance`, these components fail with "No embeddings found":

#### Overlays (6 components)

1. **strategic-coherence/manager.ts:180, 444**
   - Error: `No mission concepts with embeddings found`
   - Blocks: `overlay generate strategic_coherence`

2. **mission-concepts/manager.ts:144, 374**
   - Cannot regenerate mission concepts after migration
   - Blocks: `overlay generate mission_concepts`

3. **security-guidelines/manager.ts:155**
   - Blocks: `overlay generate security_guidelines`

4. **operational-patterns/manager.ts:139**
   - Blocks: `overlay generate operational_patterns`

5. **mathematical-proofs/manager.ts:142**
   - Blocks: `overlay generate mathematical_proofs`

6. **strategic-coherence/algebra-adapter.ts:93**
   - Blocks: Algebra operations on coherence

#### Security/Integrity (2 components)

7. **security/mission-integrity.ts:90, 94**
   - Mission version recording fails
   - Blocks: Mission integrity monitoring

8. **security/mission-validator.ts:365**
   - Mission validation fails
   - Cannot verify mission alignment

#### Transforms (1 component)

9. **transforms/genesis-doc-transform.ts:594, 618**
   - Genesis document processing fails
   - Blocks: Document ingestion after migration

#### Sigma/Conversations (1 component)

10. **sigma/overlays/base-conversation-manager.ts:233**
    - Conversation turn embeddings fail
    - Blocks: Sigma conversation overlays

---

## Root Cause

All affected components follow this pattern:

```typescript
// Load overlay from YAML
const overlay = await this.manager.retrieve(docHash);
const concepts = overlay.extracted_concepts;

// Filter for concepts with embeddings - FAILS ON V2 FORMAT!
const conceptsWithEmbeddings = concepts.filter(
  (c) => c.embedding && c.embedding.length === 768
);

if (conceptsWithEmbeddings.length === 0) {
  throw new Error('No mission concepts with embeddings found'); // ❌ FAILS HERE
}
```

**The Issue**: After migration, YAML files are v2 format:

- `format_version: 2`
- `lancedb_metadata: { storage_path, overlay_type, document_hash, ... }`
- Concepts have **NO embeddings** (stripped to save disk space)

But the code still expects v1 format:

- Concepts have `embedding: number[]` field
- No awareness of LanceDB storage

---

## Expected Behavior After Migration

Components should be **LanceDB-aware** and follow this pattern:

```typescript
// 1. Load overlay metadata from YAML
const overlay = await this.manager.retrieve(docHash);

// 2. Check format version
if (overlay.format_version === 2 && overlay.lancedb_metadata) {
  // V2 FORMAT: Load embeddings from LanceDB
  const lanceStore = new DocumentLanceStore(pgcRoot);
  await lanceStore.initialize();

  const conceptsWithEmbeddings = await lanceStore.getConceptsByDocument(
    overlay.lancedb_metadata.overlay_type,
    overlay.lancedb_metadata.document_hash
  );

  await lanceStore.close();
} else {
  // V1 FORMAT (legacy): Load from YAML
  const conceptsWithEmbeddings = overlay.extracted_concepts.filter(
    (c) => c.embedding && c.embedding.length === 768
  );
}

// 3. Continue with embeddings loaded from appropriate source
```

---

## Migration Path (v1 → v2 Format)

### V1 Format (Before Migration)

```yaml
document_hash: abc123
extracted_concepts:
  - text: 'Concept 1'
    embedding: [0.1, 0.2, ..., 0.768] # 768D vector in YAML
  - text: 'Concept 2'
    embedding: [0.3, 0.4, ..., 0.768]
```

**Size**: ~2-5MB per document (embeddings in YAML)

### V2 Format (After Migration)

```yaml
format_version: 2
document_hash: abc123
lancedb_metadata:
  storage_path: .open_cognition/lance/documents.lancedb
  overlay_type: O4
  document_hash: abc123
  migrated_at: 2025-11-08T00:00:00Z
  concepts_count: 15
extracted_concepts:
  - text: 'Concept 1'
    # NO embedding field - stored in LanceDB
  - text: 'Concept 2'
    # NO embedding field - stored in LanceDB
```

**Size**: ~50-100KB per document (metadata only)

### LanceDB Storage

- Path: `.open_cognition/lance/documents.lancedb`
- Schema: `DocumentConceptRecord` (document-lance-store.ts:23-41)
- Retrieval: By `overlay_type` + `document_hash`

---

## Fix Required

### Phase 1: Create LanceDB Loading Helper (NEW FILE)

Create `src/core/pgc/embedding-loader.ts`:

```typescript
/**
 * Load embeddings from YAML (v1) or LanceDB (v2)
 * Provides backward compatibility during migration period
 */
export class EmbeddingLoader {
  async loadConceptsWithEmbeddings(
    overlayData: any,
    pgcRoot: string
  ): Promise<MissionConcept[]> {
    // V2 format: Load from LanceDB
    if (overlayData.format_version === 2 && overlayData.lancedb_metadata) {
      const lanceStore = new DocumentLanceStore(pgcRoot);
      await lanceStore.initialize();

      const concepts = await lanceStore.getConceptsByDocument(
        overlayData.lancedb_metadata.overlay_type,
        overlayData.lancedb_metadata.document_hash
      );

      await lanceStore.close();
      return concepts;
    }

    // V1 format: Load from YAML (legacy)
    const conceptField = this.getConceptField(overlayData);
    return (
      overlayData[conceptField]?.filter(
        (c: any) => c.embedding && c.embedding.length === 768
      ) || []
    );
  }
}
```

### Phase 2: Update All Affected Components (15 files)

Replace all instances of:

```typescript
// OLD (v1 only)
const conceptsWithEmbeddings = overlay.extracted_concepts.filter(
  (c) => c.embedding && c.embedding.length === 768
);
```

With:

```typescript
// NEW (v1 + v2 compatible)
const loader = new EmbeddingLoader();
const conceptsWithEmbeddings = await loader.loadConceptsWithEmbeddings(
  overlay,
  this.pgcRoot
);
```

### Phase 3: Update Tests

- Add tests for v2 format loading
- Test backward compatibility with v1 format
- Test error handling when LanceDB unavailable

---

## Components Requiring Updates

### High Priority (blocks user-facing features)

1. `core/overlays/strategic-coherence/manager.ts` - Strategic coherence generation
2. `core/overlays/mission-concepts/manager.ts` - Mission concepts regeneration
3. `core/security/mission-integrity.ts` - Mission integrity monitoring
4. `core/security/mission-validator.ts` - Mission validation

### Medium Priority (blocks internal features)

5. `core/overlays/security-guidelines/manager.ts`
6. `core/overlays/operational-patterns/manager.ts`
7. `core/overlays/mathematical-proofs/manager.ts`
8. `core/overlays/strategic-coherence/algebra-adapter.ts`

### Lower Priority (specialized features)

9. `core/transforms/genesis-doc-transform.ts` - Document ingestion
10. `sigma/overlays/base-conversation-manager.ts` - Sigma conversations

---

## Verification Test

After fixes, run this test sequence:

```bash
# 1. Generate initial overlays (v1 format)
cognition-cli overlay generate mission_concepts
cognition-cli overlay generate strategic_coherence

# 2. Migrate to LanceDB (v1 → v2)
cognition-cli migrate:lance

# 3. Verify overlays still work (should load from LanceDB)
cognition-cli overlay generate strategic_coherence  # Should work with v2
cognition-cli coherence show  # Should display coherence metrics

# 4. Verify mission integrity
cognition-cli integrity show  # Should work with migrated data
```

**Expected**: All commands succeed, no "No embeddings found" errors

---

## Timeline Impact

- **Current State**: Migration complete, but system partially broken
- **User Impact**: Cannot regenerate overlays or run coherence checks after migration
- **Fix Complexity**: Medium (15 files to update, but pattern is consistent)
- **Estimated Fix Time**: 2-4 hours for complete system update

---

## Related Issues

1. **Wizard Skips Strategic Coherence** - Wizard doesn't check for v2 format, skips generation
2. **Mission Integrity File Size** - versions.json at 200KB+ after migration (separate issue)
3. **No Migration Rollback** - Cannot revert v2 → v1 without backup

---

# CRITICAL ISSUE 2: Sigma Lattice Storing Embeddings in JSON

## Status: PERFORMANCE CRITICAL

**Severity**: Critical
**Impact**: 550MB .sigma directory, 2-3 minute compression times
**Date Identified**: 2025-11-08

### Problem

The Sigma conversation lattice is storing **full 768D embeddings in JSON format** for every conversation turn. This causes massive disk usage and slow compression.

**Current State** (after 3 compressions):

```
567M    .sigma/
  4.7MB - 4d733219-a019-4fa7-8db5-4b34bfb10737.lattice.json
  2.4MB - bd7fd844-2d8b-4a8d-833b-5604e1ef5ec2.lattice.json
  1.3MB - da85a959-90b8-410e-b1d4-2252dcc8f82c.lattice.json
  ------
  8.4MB just in lattice.json files (without overlays)
```

**Compression Performance**:

- Current: 2-3 minutes per compression
- Bottleneck: Writing 5MB+ JSON files with embeddings
- Disk I/O: ~100-200 turns × 768D × 8 bytes = 1-2MB pure embedding data

### Root Cause

`tui/hooks/useClaudeAgent.ts:551-554`:

```typescript
fs.writeFileSync(
  path.join(latticeDir, `${currentSessionId}.lattice.json`),
  JSON.stringify(compressionResult.lattice, null, 2) // ❌ FULL EMBEDDINGS!
);
```

The lattice structure includes embeddings:

```json
{
  "nodes": [
    {
      "id": "turn-1762558246548",
      "embedding": [
        -0.11755116, 0.04686287, ..., // 768 dimensions in JSON!
      ]
    }
  ]
}
```

### Impact

1. **Disk Usage**: 550MB .sigma directory (should be <50MB)
2. **Compression Speed**: 2-3 minutes (should be <10 seconds)
3. **Memory Usage**: Loading 5MB JSON into memory on every session
4. **Scalability**: After 10 sessions, .sigma will be 5GB+

### Solution

**Phase 1: Strip Embeddings from lattice.json**

Update `useClaudeAgent.ts:551-554` to strip embeddings:

```typescript
// Strip embeddings before saving lattice
const latticeWithoutEmbeddings = {
  ...compressionResult.lattice,
  nodes: compressionResult.lattice.nodes.map((node) => {
    const { embedding, ...nodeWithoutEmbedding } = node;
    return nodeWithoutEmbedding;
  }),
};

fs.writeFileSync(
  path.join(latticeDir, `${currentSessionId}.lattice.json`),
  JSON.stringify(latticeWithoutEmbeddings, null, 2)
);
```

**Lattice v2 Format** (without embeddings):

```json
{
  "format_version": 2,
  "lancedb_metadata": {
    "storage_path": ".sigma/conversations.lancedb",
    "session_id": "4d733219-a019-4fa7-8db5-4b34bfb10737"
  },
  "nodes": [
    {
      "id": "turn-1762558246548",
      "role": "assistant",
      "content": "...",
      "timestamp": 1762559959652,
      // NO embedding field - stored in LanceDB
      "novelty": 0.8,
      "importance": 7
    }
  ],
  "edges": [...],
  "metadata": {...}
}
```

**Expected Size**: 50-100KB (vs 5MB current)

**Phase 2: Update Lattice Reconstructor**

The `LatticeReconstructor` must load embeddings from LanceDB when reconstructing:

`sigma/lattice-reconstructor.ts`:

```typescript
async reconstructLattice(sessionId: string): Promise<Lattice> {
  // 1. Load lattice metadata from JSON (no embeddings)
  const latticeJson = await this.loadLatticeJson(sessionId);

  // 2. Check format version
  if (latticeJson.format_version === 2) {
    // V2: Load embeddings from LanceDB
    const lanceStore = new ConversationLanceStore(this.sigmaRoot);
    await lanceStore.initialize();

    // Hydrate nodes with embeddings
    for (const node of latticeJson.nodes) {
      const turnRecord = await lanceStore.getTurn(node.id);
      if (turnRecord) {
        node.embedding = turnRecord.embedding;
      }
    }

    await lanceStore.close();
  }

  // 3. Reconstruct lattice with embeddings loaded
  return this.buildLattice(latticeJson);
}
```

**Phase 3: Ensure Embeddings Stored in LanceDB**

The conversation turns should already be stored in LanceDB during compression. Verify this happens in the compression pipeline.

### Expected Performance After Fix

- **Disk Usage**: 550MB → 50MB (.sigma directory, 90% reduction)
- **Compression Time**: 2-3 minutes → <10 seconds (20x faster)
- **Memory Usage**: 5MB → 100KB per lattice load (50x reduction)
- **Scalability**: 10 sessions = 500MB → 50MB

### Migration Path

1. **Migrate existing lattice.json files** to strip embeddings
2. **Ensure embeddings in LanceDB** for all existing turns
3. **Update reconstruction logic** to load from LanceDB
4. **Delete old lattice.json** files or archive them

### Verification Test

```bash
# 1. Check current size
du -sh .sigma/

# 2. Run compression
# (inside TUI, compress session)

# 3. Check new lattice size
ls -lh .sigma/*.lattice.json

# Expected: <100KB per lattice (vs 5MB before)
```

---

## Notes

- Migration itself is correct (data safely in LanceDB)
- YAML files correctly marked as v2 format
- Only issue is readers not updated to LanceDB-aware pattern
- Fix is mechanical but affects many files
- No data loss risk - all embeddings safely in LanceDB
