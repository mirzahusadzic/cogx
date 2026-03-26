# Phase 2: The Lineage Adapter (Week 3-4)

**Goal:** Record a transform for every meaningful file change, linking file watcher → git → transform log.

## 2.1 Auto-Update Mode

**File:** `src/core/watcher/file-watcher.ts`

Add option to trigger update automatically after debounce:

```typescript
interface WatcherOptions {
  // ... existing
  autoUpdate?: boolean; // NEW: trigger update on change
  autoUpdateDebounceMs?: number; // NEW: batch changes (default 5000ms)
}
```

When `autoUpdate: true`:

1. Accumulate dirty files for `autoUpdateDebounceMs`
2. When batch timer fires, run `UpdateOrchestrator.run()` internally
3. Log results to console (same as manual update)

**Key constraint:** Must be opt-in. Default behavior unchanged.

**Files to modify:**

- `file-watcher.ts` — add batch accumulator + auto-update trigger
- `commands/watch.ts` — add `--auto-update` flag
- Import `UpdateOrchestrator` into watcher module

## 2.2 Lineage Record Command (Git Hook Target)

**New file:** `src/commands/lineage-record.ts`

```bash
# Usage: called from post-commit hook
cognition-cli lineage record --commit HEAD

# Or manually for a range
cognition-cli lineage record --commit HEAD~3..HEAD

# With eGemma intent synthesis for low-quality messages
cognition-cli lineage record --commit HEAD --synthesize
```

**Algorithm:**

1. `git diff-tree --no-commit-id -r <commit>` → list changed files
2. For each changed file:
   a. Read new content → compute SHA-256
   b. Check if PGC already has this hash (skip if unchanged from PGC perspective)
   c. Extract git context (commit hash, author, message)
   d. **Resolve intent** (see §2.4 Intent Resolution below)
   e. Record transform with resolved intent fields
   f. `inputs`: [{ path, hash: old_content_hash }], `outputs`: [{ path, hash: new_content_hash }]
3. Update dirty_state.json accordingly
4. Optionally trigger incremental update (`--update` flag)

**Git hook installer:**

**New file:** `src/commands/hooks-install.ts`

```bash
cognition-cli hooks install
# Creates .git/hooks/post-commit:
#   #!/bin/sh
#   cognition-cli lineage record --commit HEAD --synthesize
```

## 2.3 Agent Intent Capture (Real-Time Path)

**New file:** `src/core/lineage/intent-adapter.ts`

This is the **real-time** path. When an AI agent (Claude Code, Copilot, TUI) makes changes,
it already knows WHY — it doesn't need an LLM to synthesize intent, it just **declares** it.
The agent IS the reasoning engine. Zero synthesis cost, highest confidence.

```typescript
export interface IntentRecord {
  file_path: string;
  intent: string; // WHY this change — agent knows this
  decision?: string; // WHAT was chosen
  alternatives?: string[]; // WHAT was rejected
  source: {
    type: 'ai_agent' | 'developer';
    identifier: string; // 'claude-code', 'copilot-cli', 'tui'
    session_id?: string;
  };
  confidence: number; // 0.9-1.0 for agent-declared intent
}

export class IntentAdapter {
  async recordIntent(record: IntentRecord): Promise<string> {
    // Store as pending intent (not yet a transform — file hasn't changed yet)
    // When file change is detected by watcher, attach this intent to the transform
  }

  async getPendingIntents(filePath: string): Promise<IntentRecord[]> {
    // Called by structural-processing to enrich transforms
  }
}
```

**Storage:** `.open_cognition/pending_intents/<file_hash>.json` (ephemeral, cleared after transform)

**Skill integration:** Add `cognition-cli lineage intent` command that skills can call:

```bash
cognition-cli lineage intent \
  --file src/auth.ts \
  --intent "Extracting common exception handling into decorator" \
  --source claude-code \
  --session abc123
```

**TUI workflow integration:**

In a TUI session, the agent wraps every code change with intent declaration automatically:

```
1. Agent decides to make a change (reasoning exists in context)
2. Agent calls: cognition-cli lineage intent --file <path> --intent "<why>" --source tui
3. Agent writes the file
4. Watcher detects change → structural-processing finds pending intent → attaches to transform
5. Transform recorded with confidence: 0.95 (agent-declared, real-time)
```

This is the **happy path** — the agent never needs to explain itself after the fact because
it declared intent before acting. The lineage is born with its reasoning attached.

## 2.4 Intent Resolution & eGemma Synthesis (Offline Path)

**New file:** `src/core/lineage/intent-resolver.ts`

This is the **offline** path. When no agent is involved (developer commits directly), intent
must be synthesized. Two sub-cases:

**Case A: Quality commit message available** → use directly (no LLM needed)

**Case B: Low-quality commit message** ("fix", "wip", "stuff") → synthesize via eGemma

**New eGemma persona:** `personas/docs/intent_synthesizer.md`

```markdown
You are a code intent analyst. Given a git diff (or diff summary) and commit metadata,
you determine the developer's likely intent — what they were trying to accomplish and why.

Analyze the structural changes (additions, deletions, modifications) to infer purpose.
Be specific and technical. Focus on the WHY, not the WHAT (the diff shows the WHAT).

Output STRICT JSON. Format depends on input:

For FULL DIFFS (small commits), return per-file intents:
{
"commit_intent": "string — one sentence describing the overall commit purpose",
"files": [
{ "path": "string", "intent": "string — WHY this file changed", "category": "string" }
],
"confidence": 0.0-1.0
}

For STAT-ONLY inputs (large commits), return commit-level intent:
{
"commit_intent": "string — one sentence describing the overall commit purpose",
"category": "bugfix | feature | refactor | performance | security | documentation | test | config | dependency",
"confidence": 0.0-1.0
}

For GROUPED inputs (medium commits), return directory-grouped intents:
{
"commit_intent": "string — one sentence describing the overall commit purpose",
"groups": [
{ "pattern": "string — path glob", "intent": "string — WHY this group changed", "files": number }
],
"confidence": 0.0-1.0
}
```

**Intent Resolver (the routing logic):**

```typescript
export class IntentResolver {
  constructor(
    private intentAdapter: IntentAdapter,
    private egemmaClient: EGemmaClient
  ) {}

  async resolve(
    filePath: string,
    commitMessage: string | null,
    diff: string | null,
    gitContext: GitContext | null
  ): Promise<ResolvedIntent> {
    // Priority 1: Agent-declared intent (real-time path)
    const pending = await this.intentAdapter.getPendingIntents(filePath);
    if (pending.length > 0) {
      return {
        intent: pending[0].intent,
        decision: pending[0].decision,
        confidence: pending[0].confidence ?? 0.95,
        source_method: 'agent_declared',
      };
    }

    // Priority 2: Quality commit message (no synthesis needed)
    if (commitMessage && this.isQualityMessage(commitMessage)) {
      return {
        intent: this.extractFirstLine(commitMessage),
        decision: this.extractBody(commitMessage),
        confidence: 0.8,
        source_method: 'commit_message',
      };
    }

    // Priority 3: eGemma persona synthesis from diff
    if (diff && this.synthesizeEnabled) {
      const synthesized = await this.egemmaClient.summarize({
        content: this.buildSynthesisPrompt(commitMessage, diff, gitContext),
        persona: 'intent_synthesizer',
        maxTokens: 200,
      });
      return {
        intent: synthesized.intent,
        decision: synthesized.decision,
        confidence: synthesized.confidence * 0.7, // discount: LLM-inferred
        source_method: 'egemma_synthesized',
      };
    }

    // Priority 4: Fallback — raw commit message or generic
    return {
      intent: commitMessage || 'File change recorded (no intent available)',
      decision: null,
      confidence: commitMessage ? 0.3 : 0.1,
      source_method: 'fallback',
    };
  }

  private isQualityMessage(msg: string): boolean {
    if (msg.length < 15) return false;
    if (/^(fix|wip|update|stuff|changes|tmp|test|asdf)/i.test(msg))
      return false;
    return true;
  }
}
```

**Confidence tiers:**

| Source                     | Confidence  | When                                 |
| -------------------------- | ----------- | ------------------------------------ |
| Agent-declared (real-time) | 0.90 – 1.00 | AI agent made the change, knows WHY  |
| Quality commit message     | 0.70 – 0.85 | Developer wrote meaningful message   |
| eGemma synthesized         | 0.40 – 0.65 | LLM inferred from diff via persona   |
| Raw low-quality message    | 0.20 – 0.35 | "fix", "wip" — stored but unreliable |
| No message available       | 0.05 – 0.15 | File changed, no context at all      |

**`--synthesize` flag behavior:**

- `lineage record --commit HEAD` → uses Priorities 1, 2, 4 only (no eGemma call)
- `lineage record --commit HEAD --synthesize` → uses all 4 priorities including eGemma
- `lineage enrich` → batch post-hoc: scans transforms with confidence < 0.5, re-resolves with eGemma

**New command:** `cognition-cli lineage enrich`

```bash
# Enrich all low-confidence transforms
cognition-cli lineage enrich

# Enrich only transforms from a specific commit range
cognition-cli lineage enrich --since HEAD~20

# Dry-run: show what would be enriched without calling eGemma
cognition-cli lineage enrich --dry-run
```

**Files to create:**

- `src/core/lineage/intent-resolver.ts` (~150 LOC)
- `src/core/lineage/egemma-client.ts` (~80 LOC) — wraps `POST /summarize` with persona
- `src/commands/lineage-enrich.ts` (~100 LOC)
- `egemma: personas/docs/intent_synthesizer.md` (~30 lines)

**Files to modify:**

- `src/commands/lineage-record.ts` — integrate IntentResolver, add `--synthesize` flag
- `src/core/orchestrators/steps/structural-processing.ts` — call `IntentResolver.resolve()` before recording transform

## Validation & Testing

### 2.1 Auto-Update

- `--auto-update` flag triggers update after debounce window
- Without flag, behavior identical to current (no regression)
- Rapid saves (< debounce) batched into single update
- Update errors don't crash the watcher

### 2.2 Lineage Record

- Single commit → one transform per changed file
- Commit range (`HEAD~3..HEAD`) → transforms for each commit in order
- Already-recorded hash → skipped (idempotent)
- `hooks install` → creates executable `.git/hooks/post-commit`
- Non-git directory → clear error, exit 1

### 2.3 Agent Intent

- `lineage intent` → creates pending intent file
- Pending intent consumed on next file change → appears in transform reasoning
- Stale intents expire after 1 hour
- No pending intent → transform records without reasoning (no crash)

### 2.4 Intent Resolver

- Priority chain: agent > quality commit > eGemma > fallback
- `isQualityMessage("fix")` → false; `("Fix race condition in auth")` → true
- `--synthesize` off → eGemma never called
- eGemma unreachable → fallback gracefully, no crash
- `lineage enrich --dry-run` → reports count without modifying
- Persona returns valid JSON for all three tier formats

## Implementation Notes (Post-Review)

**⚠️ EGemmaClient/IntentResolver instantiation:** Currently a new `EGemmaClient` + `IntentResolver`
is created per file in `processSingleFile()`. Lightweight now, but should be hoisted to step-level
for Phase 4 when the reactive loop processes many files per cycle.

**⚠️ `lineage enrich --since` filter:** The `--since` CLI flag is defined but not yet wired to
filter transforms by git ref. Currently scans all index entries. Must be implemented before
Phase 2.5 (rehydration produces hundreds of low-confidence transforms).

**✅ eGemma persona routing fix:** The `egemma-client.ts` sends `filename: 'commit_diff.patch'`.
eGemma routes `.patch` → `code/` persona type. The `intent_synthesizer.md` persona was created
in both `personas/code/` and `personas/docs/` paths to handle either routing. Without the
persona file, synthesis silently falls back to default (generic summarizer) → `JSON.parse()`
fails → returns null → Priority 4 fallback. The try/catch prevents crashes but synthesis
is effectively disabled without the persona.

---
