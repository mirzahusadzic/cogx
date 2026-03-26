# Phase 1: The Reasoning Spine (Week 1-2)

**Goal:** Every transform records WHY, not just WHAT.

## 1.1 Extend Transformation Schema

**File:** `src/core/types/transform.ts`

Add to `TransformationSchema`:

```typescript
// NEW FIELDS
reasoning: z.object({
  intent: z.string(),                    // WHY was this done
  decision: z.string().optional(),       // What choice was made
  alternatives: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
}).optional(),

source: z.object({
  type: z.enum(['developer', 'ai_agent', 'automated', 'system']),
  identifier: z.string().optional(),     // username, agent name, tool
  session_id: z.string().optional(),     // link to conversation
}).optional(),

git: z.object({
  commit_hash: z.string().optional(),
  author: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.string().optional(),
}).optional(),
```

**Migration:** All existing transforms remain valid (new fields are optional).

**Tests to write:**

- Schema validation accepts old transforms (backward compat)
- Schema validates new fields
- Transform ID changes when reasoning differs (content-addressable)

## 1.2 Make Transforms Append-Only (Soft Delete)

**File:** `src/core/pgc/transform-log.ts`

Replace hard `delete()` with invalidation:

```typescript
async invalidate(hash: string, reason: string): Promise<void> {
  const transform = await this.getTransformation(hash);
  if (!transform) return;

  // Write invalidation marker alongside manifest.yaml
  const invalidationPath = path.join(this.getTransformPath(hash), 'invalidated.yaml');
  await fs.writeFile(invalidationPath, yaml.dump({
    original_id: hash,
    reason,
    invalidated_at: new Date().toISOString(),
  }));
}

// Keep delete() for GC only, rename to purge()
async purge(hash: string): Promise<void> { /* existing delete logic */ }
```

**Update callers:**

- `structural-processing.ts:233` → use `invalidate()` instead of `delete()`
- Keep `purge()` for explicit GC commands only

**Tests:**

- Invalidated transforms still readable via `getTransformation()`
- `isInvalidated(hash)` returns true after invalidation
- History preserved for audit trail

## 1.3 Git Context Extractor

**New file:** `src/core/git/context-extractor.ts`

```typescript
export async function extractGitContext(
  filePath: string,
  projectRoot: string
): Promise<GitContext | null> {
  // Use `git log -1 --format=...` for the file
  // Return { commit_hash, author, message, timestamp }
  // Return null if not in a git repo
}

export async function extractGitDiffContext(
  filePath: string,
  projectRoot: string
): Promise<GitDiffContext | null> {
  // Use `git diff HEAD -- <file>` for unstaged changes
  // Parse insertions/deletions
  // Return { insertions, deletions, hunks }
}
```

**Integration point:** Call from `StructuralProcessingStep.processSingleFile()` before recording transform.

**Tests:**

- Works in git repo
- Returns null gracefully outside git
- Handles binary files, new files, deleted files

---
