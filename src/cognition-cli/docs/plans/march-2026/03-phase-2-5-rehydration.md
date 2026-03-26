# Phase 2.5: Memory Rehydration from Git (Week 4-5)

**Goal:** Reconstruct the system's autobiography from a bare `git clone` — the nervous system regenerates from the bones.

## 2.5.1 The Rehydrate Command

**New file:** `src/commands/lineage-rehydrate.ts`

```bash
# Full history rehydration (default: all commits on current branch)
cognition-cli lineage rehydrate

# Bounded rehydration (last N commits)
cognition-cli lineage rehydrate --depth 100

# Range rehydration
cognition-cli lineage rehydrate --since 2025-01-01

# Resume (skip already-recorded commits)
cognition-cli lineage rehydrate --resume
```

**Algorithm:**

```
1. git log --reverse --format="%H|%an|%ae|%aI|%s" [--since=X | -n=depth]
   → ordered list of commits (oldest first = causal order)

2. For each commit:
   a. git diff-tree --no-commit-id -r -M <commit>
      → list of (status, old_path, new_path, old_hash, new_hash) per file
      → -M detects renames (critical for lineage continuity)

   b. Filter to supported file types (via ASTParserRegistry.supportedExtensions)

   c. For each changed file:
      - status A (added): inputs=[], outputs=[{path, hash}]
      - status M (modified): inputs=[{path, old_hash}], outputs=[{path, new_hash}]
      - status D (deleted): inputs=[{path, old_hash}], outputs=[]
      - status R (renamed): inputs=[{old_path, old_hash}], outputs=[{new_path, new_hash}]
        → record rename edge in transform (preserves identity across renames)

   d. Record transform:
      {
        goal: {
          objective: "Rehydrated from git history",
          criteria: ["Git commit verified", "File content hashed"],
          phimin: 0.6  // Lower than live — approximated, not observed
        },
        reasoning: {
          intent: commit_subject,          // First line of commit message
          decision: commit_body || null,   // Rest of commit message (if any)
          confidence: 0.5,                 // Approximate — we weren't there
        },
        source: {
          type: 'developer',
          identifier: author_name,
        },
        git: {
          commit_hash,
          author: author_name,
          author_email,
          message: full_commit_message,
          timestamp: author_date,
        },
        inputs: [...],
        outputs: [...],
        method: 'git_rehydration',
      }

   e. Store content in object store (checkout blob via `git show <hash>:<path>`)
   f. Update reverse_deps
   g. Record commit hash in rehydration manifest (for --resume)

3. After all commits processed:
   - Run genesis (structural extraction) on final state
   - Link transforms via TransformDAG (if Phase 3.1 available)
   - Report: "Rehydrated N commits, M file changes, K transforms recorded"
```

## 2.5.2 The Rehydration Manifest

**Storage:** `.open_cognition/rehydration/manifest.json`

```json
{
  "last_rehydrated_commit": "abc123def456...",
  "total_commits_processed": 847,
  "total_transforms_recorded": 3291,
  "rehydrated_at": "2025-03-26T10:00:00Z",
  "branch": "main",
  "depth": null,
  "since": null
}
```

This enables `--resume`: on subsequent runs, only process commits after `last_rehydrated_commit`. Also enables incremental rehydration — run `lineage rehydrate --resume` periodically to catch up with new commits that weren't recorded live.

## 2.5.3 Rehydration Intent Enrichment

Rehydration records raw commit messages as intent. For low-quality messages, use the
**IntentResolver** (§2.4) with `--synthesize` flag:

```bash
# Rehydrate first (fast, no LLM calls)
cognition-cli lineage rehydrate

# Then enrich low-confidence transforms via eGemma
cognition-cli lineage enrich --since <first_rehydrated_commit>
```

This uses the same `intent_synthesizer` persona and confidence tiers defined in §2.4.
The rehydration itself stays fast (no LLM in the critical path). Enrichment is a
separate, optional pass — can run lazily in background or as batch overnight.

### Diff Processing Strategy (Tiered)

The input to eGemma is always a **commit-level** payload, never per-file. One call per
commit regardless of size. The diff content included varies by tier:

```typescript
interface DiffTier {
  tier: 'micro' | 'small' | 'medium' | 'large';
  strategy: string;
  callCount: 1;  // Always 1 — never per-file
}

function classifyCommit(files: ChangedFile[], totalLines: number): DiffTier {
  if (files.length <= 3 && totalLines < 200)   return { tier: 'micro',  ... };
  if (files.length <= 10 && totalLines < 1000)  return { tier: 'small',  ... };
  if (files.length <= 30 && totalLines < 5000)  return { tier: 'medium', ... };
  return { tier: 'large', ... };
}
```

**Tier: Micro/Small (≤10 files, <1K lines) — Full Diff**

Send the complete `git show <commit>` unified diff to eGemma. The persona returns
per-file intents in a single structured response:

```json
// Prompt: full unified diff
// Response:
{
  "commit_intent": "Fix authentication token refresh race condition",
  "files": [
    {
      "path": "src/auth/token.ts",
      "intent": "Add mutex lock around refresh",
      "category": "bugfix"
    },
    {
      "path": "src/auth/token.test.ts",
      "intent": "Add concurrent refresh test",
      "category": "test"
    }
  ],
  "confidence": 0.7
}
```

This is the **highest quality** synthesis — the persona sees all context.

**Tier: Medium (11-30 files, 1K-5K lines) — Stat + Hunks**

Full diff would be wasteful. Send: commit message + `git diff --stat` + first N hunks
per file (capture the shape, not every line):

```typescript
function buildMediumPrompt(commit: GitCommit): string {
  const stat = execSync(`git diff-tree --stat ${commit.hash}`); // compact summary
  const hunks = commit.files.map((f) => ({
    path: f.path,
    status: f.status,
    // First 50 lines of diff per file — captures the intent, skips boilerplate
    diff_preview: execSync(`git show ${commit.hash} -- ${f.path} | head -50`),
  }));
  return `Commit: ${commit.message}\n\nStat:\n${stat}\n\nKey changes:\n${formatHunks(hunks)}`;
}
```

Response: grouped intents by directory or concern (not per-file — too many):

```json
{
  "commit_intent": "Migrate authentication from session-based to JWT",
  "groups": [
    {
      "pattern": "src/auth/*",
      "intent": "Replace session store with JWT signing",
      "files": 8
    },
    {
      "pattern": "src/middleware/*",
      "intent": "Update auth middleware for Bearer tokens",
      "files": 4
    },
    {
      "pattern": "tests/auth/*",
      "intent": "Update auth test fixtures",
      "files": 6
    }
  ],
  "confidence": 0.55
}
```

Files within a group share the group's intent. IntentResolver maps `file.path → group.intent`
by longest prefix match.

**Tier: Large (30+ files or 5K+ lines) — Stat Only**

Typical for: dependency bumps, mass renames (handled separately by §2.5.4), generated code,
initial commits. Full diff would waste context. Send only:

```typescript
function buildLargePrompt(commit: GitCommit): string {
  const stat = execSync(`git diff-tree --stat --stat-width=120 ${commit.hash}`);
  const summary =
    `${commit.files.length} files changed, ` +
    `${commit.insertions} insertions, ${commit.deletions} deletions`;
  return `Commit: ${commit.message}\n\n${summary}\n\nFile stat:\n${stat}`;
}
```

Response: single commit-level intent applied to all files:

```json
{
  "commit_intent": "Upgrade React from v18 to v19 — dependency migration",
  "category": "dependency",
  "confidence": 0.4
}
```

Lower confidence because the persona can't see the actual changes — only the shape.

**Tier selection is automatic.** The `--synthesize` flag enables synthesis; the tier
classifier decides _how much_ context to send. No user intervention needed.

**Batch efficiency during rehydration:**

For `lineage enrich` processing hundreds of commits, requests are batched with
concurrency control (default: 3 parallel eGemma calls) to avoid overwhelming the server:

```typescript
async function enrichBatch(
  commits: Transform[],
  concurrency = 3
): Promise<void> {
  const queue = commits.filter((t) => t.reasoning?.confidence < 0.5);
  // Process in parallel with concurrency limit
  await pMap(
    queue,
    async (transform) => {
      const tier = classifyCommit(transform);
      const diff = await reconstructDiff(transform); // git show <hash>
      const enriched = await egemma.synthesize(buildPrompt(tier, diff));
      await transformLog.updateReasoning(transform.id, enriched);
    },
    { concurrency }
  );
}
```

**For rehydrated transforms specifically:**

- Git diffs are reconstructed via `git show <commit>` (full commit, not per-file)
- eGemma synthesizes intent from reconstructed diff using tier-appropriate prompt
- Confidence is discounted further: `egemma_confidence * 0.7 * 0.8` (inferred + historical)
- Original commit message always preserved in `git.message` regardless of enrichment

## 2.5.4 Rename Tracking & Identity Continuity

Git's `-M` flag detects renames. This is critical for lineage — without it, a renamed file looks like a deletion + creation, breaking the provenance chain.

```typescript
interface RenameTransform extends Transformation {
  // Special transform type for renames
  rename: {
    old_path: string;
    new_path: string;
    similarity: number; // Git's rename similarity score (0-100)
  };
}
```

When the provenance engine (Phase 3) traces backward through a rename transform, it follows the `old_path` to continue the chain. The file's _identity_ survives the rename.

**Bulk Rename Handling:**

Mass renames (`git mv src/old/ src/new/`) generate many individual rename diffs. Without
special handling, this produces N individual "Refactor" transforms with near-identical intents.

```typescript
interface BulkRenameTransform extends Transformation {
  bulk_rename: {
    pattern: string; // Detected pattern: "src/old/* → src/new/*"
    files: Array<{
      old_path: string;
      new_path: string;
      similarity: number;
    }>;
    count: number;
  };
}
```

**Detection:** During `lineage record` or `rehydrate`, if a single commit contains ≥ 5 renames
with a common path prefix change, group them into a single `BulkRenameTransform`:

```typescript
function detectBulkRename(renames: RenameEntry[]): BulkRenameGroup | null {
  if (renames.length < 5) return null;
  // Find longest common prefix change: old_prefix → new_prefix
  const prefixChange = findCommonPrefixChange(renames);
  if (!prefixChange) return null;
  // Group matches: renames that follow the prefix pattern
  const grouped = renames.filter((r) => matchesPrefixChange(r, prefixChange));
  if (grouped.length / renames.length < 0.7) return null; // < 70% match = not bulk
  return {
    pattern: `${prefixChange.old}* → ${prefixChange.new}*`,
    files: grouped,
  };
}
```

The single bulk transform replaces N individual transforms. ProvenanceService resolves
individual file queries by checking `bulk_rename.files[]` for the specific old→new mapping.

**Tests:**

- Rehydrate repo with known rename → verify chain crosses rename boundary
- Rehydrate with --resume → verify no duplicate transforms
- Rehydrate with --depth 10 → verify only last 10 commits processed
- Rehydrate empty repo → graceful no-op
- Rehydrate non-git directory → clear error message

---
