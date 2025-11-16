# YAML Format Migration: v1 → v2

## Overview

Version 2.x introduces a **dual-storage architecture** where:

- **YAML files** store human-readable metadata (NO embeddings)
- **LanceDB** stores embeddings + all metadata for fast semantic search

This provides a **95% reduction in YAML file size** while enabling **10-100x faster queries**.

## Format Versions

### v1 Format (Legacy - Deprecated in v2.x, Removed in v3.0)

```yaml
session_id: abc-123
turns:
  - turn_id: turn-1
    role: user
    content: 'Hello world'
    timestamp: 1762206210458
    embedding: # ← 768 floats (11.5KB per turn!)
      - -0.06945426762104034
      - -0.06362920999526978
      # ... 766 more floats
    project_alignment_score: 7.5
    novelty: 0.65
    importance: 8
generated_at: 2025-11-03T20:00:00.000Z
```

**File size:** ~156KB for 7 turns (~22KB per turn)

### v2 Format (Current)

```yaml
session_id: abc-123
format_version: 2 # ← Version marker
turns:
  - turn_id: turn-1
    role: user
    content: 'Hello world'
    timestamp: 1762206210458
    # NO embedding field!         # ← Stored in LanceDB instead
    project_alignment_score: 7.5
    novelty: 0.65
    importance: 8
generated_at: 2025-11-03T20:00:00.000Z
```

**File size:** ~288 bytes for 1 turn (~300 bytes per turn)

## Automatic Migration

The migration happens **automatically and lazily** when:

1. **Loading sessions** - When `getAllItems()` is called
2. **Resuming sessions** - When using `--session-id`
3. **Querying conversations** - When the recall tool accesses old data

### Migration Process

```
┌─────────────────────────┐
│ getAllItems() called    │
└──────────┬──────────────┘
           │
           ▼
   ┌───────────────────┐
   │ Check LanceDB     │
   │ for session data  │
   └──────┬────────────┘
          │
          ├─── Has data? ──> ✅ Use LanceDB (fast path, skip YAML)
          │
          └─── Empty? ──────> Load from YAML
                              │
                              ▼
                       ┌──────────────────┐
                       │ Detect v1 format │
                       │ (has embeddings) │
                       └─────┬────────────┘
                             │
                             ▼
                       ┌─────────────────────┐
                       │ Migrate to LanceDB  │
                       │ - Store all turns   │
                       │ - Keep YAML as-is   │
                       └─────┬───────────────┘
                             │
                             ▼
                       [DEPRECATED] warnings logged
                       "v1 format will be removed in v3.0"
```

### What Happens During Migration

1. **Detection**: System checks if YAML has `embedding` field and no `format_version: 2`
2. **Warning**: Deprecation notice logged to console
3. **LanceDB Write**: All turns (with embeddings) written to LanceDB
4. **YAML Preserved**: Original v1 YAML files are **kept as backup** (never deleted)
5. **Future Access**: Next time, LanceDB is used (YAML not re-read)

## Benefits

### Space Savings

```
v1 Format (7 sessions × 7 overlays):
   1094.6KB wasted in YAML embeddings

v2 Format (same data):
   ~10KB YAML metadata
   ~1MB LanceDB (optimized binary format)

Savings: ~95% reduction in YAML size
```

### Performance

```
v1 Format (YAML parsing):
   Query time: 500ms - 5s
   Algorithm: O(n) linear scan

v2 Format (LanceDB):
   Query time: 10-50ms
   Algorithm: O(log n) indexed vector search

Speedup: 10-100x faster
```

## Manual Migration

If you want to migrate all files upfront instead of lazily:

```bash
# Preview migration (dry run)
npx tsx src/sigma/migrate-yaml-to-lancedb.ts .sigma --dry-run

# Run full migration
npx tsx src/sigma/migrate-yaml-to-lancedb.ts .sigma
```

## Testing Migration

We provide test scripts to verify the migration:

### Check Migration Status

```bash
node test-yaml-migration.mjs .sigma
```

Output:

```
📊 Migration Summary
===================
Total Sessions:     7
v1 Format (legacy): 7 ⚠️
v2 Format (new):    0 ✅
Total Turns:        49
Embedding Storage:  1094.6KB wasted in YAML
Expected Savings:   ~1039.9KB (95% reduction)
```

### Test Automatic Migration

```bash
node test-auto-migration.mjs .sigma
```

This simulates accessing v1 files and verifies:

- ✅ Migration to LanceDB succeeds
- ✅ Embeddings are stored correctly
- ✅ Deprecation warnings are shown
- ✅ YAML files remain intact

### Test v2 Format Creation

```bash
node test-v2-format.mjs
```

Verifies that new sessions create v2 format:

- ✅ `format_version: 2` is set
- ✅ No `embedding` field in YAML
- ✅ Embeddings stored in LanceDB only
- ✅ File size is minimal (~288 bytes vs ~22KB)

## Backward Compatibility

### v2.x (Current)

- ✅ Reads v1 format (with embeddings)
- ✅ Reads v2 format (without embeddings)
- ✅ Writes v2 format only
- ⚠️ Deprecation warnings for v1
- ✅ Automatic migration on access

### v3.0 (Future - Breaking Change)

- ❌ v1 format support removed
- ✅ v2 format only
- 💥 v1 files must be migrated before upgrading

## Rollback

If you need to rollback to v1.x:

1. **YAML files are preserved** - Original v1 files still contain embeddings
2. **Delete LanceDB**: `rm -rf .sigma/conversations.lancedb`
3. **Downgrade**: `npm install cognition-cli@1.x`

The v1 code will read the old YAML files normally.

## File Structure

```
.sigma/
├── conversations.lancedb/        # ← New in v2.x
│   └── conversation_turns/       # LanceDB table
│       ├── data/                 # Binary vector data
│       └── indices/              # Vector indices
├── overlays/                     # ← Preserved from v1.x
│   ├── conversation-structural/
│   │   └── {session-id}.yaml    # v1: 156KB, v2: 288 bytes
│   ├── conversation-security/
│   ├── conversation-lineage/
│   ├── conversation-mission/
│   ├── conversation-operational/
│   ├── conversation-mathematical/
│   └── conversation-coherence/
└── {session-id}.lattice.json     # Compressed lattice
```

## FAQ

### Q: Are my old YAML files deleted?

**A:** No! They are kept as backup. Only new sessions write v2 format.

### Q: What if LanceDB fails?

**A:** The system gracefully falls back to YAML. Embeddings can be regenerated from content.

### Q: Do I need to migrate immediately?

**A:** No. Migration happens automatically when you access old sessions. You can also run manual migration if preferred.

### Q: Can I delete v1 YAML files after migration?

**A:** Yes, once LanceDB has all data. Run tests first:

```bash
node test-yaml-migration.mjs .sigma
# Check that "Total turns in DB" matches expectations
```

### Q: What's the timeline for v3.0?

**A:** v1 format is deprecated in v2.x but still supported. v3.0 removal date TBD (likely 6+ months).

## Implementation Details

### LanceDB Schema

```typescript
{
  id: string,                    // turn_id
  session_id: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  timestamp: number,             // Unix timestamp (stored as Int64)
  embedding: number[768],        // eGemma 768D vectors
  novelty: number,
  importance: number,
  is_paradigm_shift: boolean,
  alignment_O1-O7: number,       // Project alignment scores
  semantic_tags: string,         // JSON array
  references: string,            // JSON array
}
```

### BigInt Handling

LanceDB stores timestamps as Apache Arrow Int64 (BigInt). The code handles conversion:

```typescript
// LanceDB returns BigInt
const record = await lanceStore.getTurn('turn-1');
// timestamp: 1762206210458n

// Converted to number for TypeScript compatibility
plainRecord.timestamp = Number(record.timestamp);
// timestamp: 1762206210458
```

## Summary

✅ **Automatic migration** - No user action required
✅ **Backward compatible** - Reads both v1 and v2
✅ **95% space savings** - YAML files are tiny
✅ **10-100x faster** - LanceDB vector operations
✅ **Safe rollback** - Original files preserved
⚠️ **v1 deprecated** - Will be removed in v3.0

---

**Migration Status**: ✅ Complete and tested
**Breaking Change**: v3.0 (TBD)
**Recommended Action**: Continue using v2.x, migration happens automatically
