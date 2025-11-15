# ADR-006: Compression Strategy (120K Token Threshold)

**Date**: Circa 2025
**Status**: Accepted
**Deciders**: Core team

## Context

The Sigma system (infinite context AI) needed a compression strategy to handle unlimited conversation length. Claude's context window is approximately 200K tokens, but multi-turn conversations quickly exceed this limit.

**The Challenge:**

1. **Context window limit** - Claude can only process ~200K tokens at once
2. **Multi-step responses** - Single user query can trigger 10-20K tokens of tool calls
3. **Session continuity** - Users expect the AI to "remember" earlier conversations
4. **Information loss** - Naive truncation discards important decisions
5. **User experience** - Compression must be seamless (no perceived interruption)

We needed a proactive compression strategy that:
- Triggers BEFORE hitting hard limits
- Preserves paradigm shifts and important decisions
- Compresses routine interactions aggressively
- Maintains conversation coherence across session boundaries

## Decision

We implemented a **120K token threshold with turn-based importance-weighted compression**:

**Trigger Conditions:**
- Token count: `tokenCount >= 120,000`
- Minimum turns: `analyzedTurns >= 5`
- Compression state: Not already triggered

**Compression Algorithm:**
1. **Analyze all turns** - Generate 768D embeddings, compute importance scores (1-10)
2. **Classify turns** - Paradigm shifts (importance >= 7.5), Important (5-7), Routine (< 5)
3. **Allocate 40K budget** - Target compressed size
4. **Preserve paradigm shifts** - 100% retention (no compression)
5. **Summarize important** - 30% retention (semantic compression)
6. **Compress routine** - 10% retention (aggressive summarization)

**Result:**
- Input: 120K tokens
- Output: ~3-4K tokens
- Compression ratio: 30-50x
- Paradigm shifts: 100% preserved

**Code References:**
- Trigger: `src/tui/hooks/compression/CompressionTrigger.ts:24`
- Algorithm: `src/sigma/compressor.ts:30-102`
- Coordination: `src/tui/hooks/compression/useCompression.ts`

## Alternatives Considered

### Option 1: Fixed 150K Threshold (At Hard Limit)
- **Pros**: Maximizes context usage before compression
- **Cons**:
  - No safety buffer for multi-step tool calls
  - Risk hitting hard limit mid-response (truncation)
  - Emergency compression under time pressure
  - User sees interruption
- **Why rejected**: Too reactive; no safety margin for multi-step responses

### Option 2: Uniform Compression (All Turns Equal)
- **Pros**: Simple algorithm, predictable behavior
- **Cons**:
  - Paradigm shifts (critical decisions) treated same as "ok thanks"
  - Important architectural discussions compressed equally to greetings
  - No semantic awareness of importance
  - Mission alignment decisions lost
- **Why rejected**: Destroys valuable information while preserving noise

### Option 3: Recency-Based (Keep Recent, Discard Old)
- **Pros**: Simple heuristic, recent context often most relevant
- **Cons**:
  - Loses important earlier decisions (mission changes, architectural choices)
  - Cannot recall paradigm shifts from session start
  - Temporal bias (recent != important)
  - No semantic consideration
- **Why rejected**: Ignores importance; temporal proximity not sufficient

### Option 4: LLM-Based Summarization (No Embeddings)
- **Pros**: Semantic understanding via LLM
- **Cons**:
  - Expensive (must send entire conversation to LLM)
  - Slow (LLM inference time)
  - Non-deterministic (summary varies across runs)
  - Cannot quantify importance scores
  - No structured metadata preservation
- **Why rejected**: Too slow and expensive for real-time compression

### Option 5: No Compression (Session Termination)
- **Pros**: Zero complexity, no information loss
- **Cons**:
  - User starts fresh session (loses all context)
  - No continuity across sessions
  - Violates "infinite context" design goal
  - Poor user experience
- **Why rejected**: Defeats purpose of Sigma system

## Rationale

The 120K threshold with importance-weighted compression was chosen because:

### 1. Safety Buffer (120K vs. 200K Total)

**From SESSION_BOUNDARY_RATIONALE.md**:
> "The 120K threshold is set conservatively because Claude may need to perform multiple tool calls and analysis steps (adding 10-20K tokens) before completing the response. Compression actually triggers after the response completes, which could be at 130-140K tokens. The 120K threshold provides a safety buffer to prevent hitting the 150K hard limit mid-task."

**Real-world buffer:**
- Threshold: 120K
- Tool calls: +10-20K
- Actual compression: 130-140K
- Hard limit: 200K
- Safety margin: 60-70K tokens

### 2. Importance-Based Preservation

**Algorithm** (`src/sigma/compressor.ts:57-102`):
```typescript
for (const turn of sorted) {
  const turnSize = estimateTokens(turn.content);

  if (turn.is_paradigm_shift || turn.importance_score >= 7) {
    preserved.push(turn.turn_id);  // Keep 100%
    budget -= turnSize;
  } else if (turn.is_routine) {
    const compressedSize = Math.ceil(turnSize * 0.1);  // 10%
    summarized.push(turn.turn_id);
    budget -= compressedSize;
  } else {
    const compressedSize = Math.ceil(turnSize * 0.3);  // 30%
    summarized.push(turn.turn_id);
    budget -= compressedSize;
  }
}
```

**Classification:**
- **Paradigm shifts** (importance >= 7.5, novelty > 0.7): 100% preserved
- **Important** (3-7): 30% retention (summarized)
- **Routine** (< 3): 10% retention (compressed)

**Result:** High-value content never lost, noise aggressively removed.

### 3. Turn-Based Analysis (No Race Conditions)

**Problem Solved** (Commit `2d1ffc1`):
- Before: Two React effects raced (queue messages vs. trigger compression)
- Result: 50%+ context loss (compression triggered before queueing complete)

**Solution:**
```typescript
// Sequential execution (no race)
1. Queue all messages for analysis
2. Wait for queue completion
3. Trigger compression manually (not automatic effect)
4. Ensure 100% capture rate
```

**Evidence:** `useCompression.ts:110-147` (disabled automatic effect, manual trigger)

### 4. Async Non-Blocking Analysis

**From `AnalysisQueue.ts`:**
- Background processing (doesn't block UI)
- Deduplication (timestamp + message ID)
- Persistence tracking (`pendingPersistence` counter)
- Compression readiness (`isReadyForCompression()`)

**User experience:** No perceived lag during analysis.

### 5. Configurable Threshold

**CLI parameter:**
```bash
cognition-cli tui --session-tokens 150000  # Custom threshold
```

**Default:** 120,000 tokens
**Minimum:** 5 turns (prevent premature compression)

**Future-proof:** Adjustable as Claude's context window changes.

## Consequences

### Positive
- **Proactive compression** - Never hits hard limit mid-response
- **Zero information loss** - Paradigm shifts preserved forever
- **Semantic awareness** - Importance scoring preserves valuable turns
- **Seamless UX** - User never perceives context loss
- **30-50x compression** - 120K → 3-4K tokens (97% reduction)
- **Infinite context** - Can repeat compression indefinitely
- **Configurable** - Users can adjust threshold for their use case

### Negative
- **Embedding cost** - Every turn requires embedding generation (~200ms)
- **Processing delay** - 4-6 seconds for compression (analysis + lattice operations)
- **Complexity** - Importance scoring, paradigm shift detection, lattice algebra
- **Potential loss** - Important turns with low embedding alignment might be compressed (rare)

### Neutral
- **120K not arbitrary** - Derived from 200K limit minus safety buffer
- **Minimum 5 turns** - Prevents compression in short sessions (design choice)
- **40K target** - Optimized for typical paradigm shift density

## Evidence

### Code Implementation
- Trigger logic: `src/tui/hooks/compression/CompressionTrigger.ts:1-136`
- Compression algorithm: `src/sigma/compressor.ts:30-276`
- React hook: `src/tui/hooks/compression/useCompression.ts:1-192`
- Analysis queue: `src/tui/hooks/analysis/AnalysisQueue.ts:1-300`
- Turn analysis: `src/tui/hooks/analysis/useTurnAnalysis.ts:1-239`

### Documentation
- Design rationale: `docs/SESSION_BOUNDARY_RATIONALE.md:100-766`
- Sigma architecture: `SIGMA_CONTEXT_ARCHITECTURE.md:1-600`
- Turn classification: `docs/SESSION_BOUNDARY_RATIONALE.md` (importance thresholds)

### Performance Metrics
**From SESSION_BOUNDARY_RATIONALE.md:**
```
Compression Metrics:
├─ Threshold: 120K tokens (configurable)
├─ Compression Ratio: 30-50x average
├─ Result: 120K → 3-4K tokens
├─ Analysis time: 4-6 seconds
├─ Lattice ops: <100ms
└─ Context preservation: 100% (no data loss)
```

### Commit History
- `2d1ffc1` - "Finalize Option C - eliminate React effect race" (fixed 50% context loss)
- `fb3b29e` - "Resolve context continuity race condition" (async analysis coordination)

### Classification Distribution
```
Paradigm Shifts (importance >= 7): Preserved 100%
Important Turns (3-7):              Summarized 30%
Routine Turns (< 3):               Compressed 10%
```

## Notes

**Why 120K, Not 100K or 140K?**

Threshold derivation:
- Claude total: ~200K tokens
- Safety buffer needed: 20-30K (multi-step tool calls)
- Comfortable margin: 120K
- Actual compression happens: 130-140K (after response completes)
- Final safety: 60-70K tokens before hard limit

**Turn Classification Formula:**
```
importance = novelty × 5 + max(alignment_O1..O7) × 0.5
paradigm_shift = (importance >= 7.5) AND (novelty > 0.7)
routine = importance < 3
```

**Why Not Just Increase Context Window?**

Even with 1M token context (future models):
- Cost scales linearly with context size
- Processing latency increases
- Compression still valuable for long-running sessions
- Importance-based filtering improves signal-to-noise

**Future Enhancements:**
- User-configurable importance thresholds
- Adaptive thresholds based on conversation density
- Multi-level compression (hot/warm/cold storage)
- Distributed compression (multiple agents sharing context)

**Related Decisions:**
- ADR-001 (LanceDB) - Stores conversation lattice for analysis
- ADR-005 (React TUI) - Visualizes compression progress
- ADR-008 (Session Continuity) - Uses compressed recaps for session boundaries
- ADR-010 (Workbench) - External API generates embeddings for importance scoring
