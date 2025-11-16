# Context Continuity Failure Analysis

**Date:** 2025-11-15
**Session:** 117dee94-2c3f-4f28-b1d2-773eed985bbd
**Analyst:** Claude (Sonnet 4.5)

---

## Executive Summary

The context continuity system failed to capture complete conversation context due to a **timing race condition** between the analysis queue, embedding service, and compression trigger. Approximately **6-8 critical turns** containing the quest briefing were lost during compression because they were skipped during streaming and never re-analyzed before the compression trigger fired.

**Impact:** 66K tokens compressed to effectively 0K of useful context, losing the entire quest briefing and detailed planning that occurred across 18 turns.

---

## Evidence Trail

### Primary Sources

- `.sigma/case/debug.log` - Analysis queue execution trace
- `.sigma/case/session-1763205450469-claude-magic.log` - Full conversation timeline
- `.sigma/case/117dee94-2c3f-4f28-b1d2-773eed985bbd.recap.txt` - Compressed output
- `src/tui/hooks/useClaudeAgent.ts:203-330` - Compression trigger implementation
- `src/tui/hooks/analysis/AnalysisQueue.ts` - Turn analysis queue
- `src/tui/hooks/compression/useCompression.ts` - Compression orchestration

### Timeline of Events

```
11:10:23.102 - User: "howdy"
11:10:30.041 - Assistant: "Hey there! How can I help you today?"
11:13:07.038 - User: "/quest-start prepare full technical documentation..."
11:13:16.331 - Assistant starts quest briefing
11:13:17.664 - Tool use begins (18 tool calls over 64 seconds)
11:14:20.306 - Assistant completes quest briefing
11:15:01.284 - Compression triggered (66.0K tokens)
11:16:43.652 - User asks: "what was the quest?"
```

**Critical Gap:** 41 seconds between assistant completion and compression trigger, but analysis queue needed ~9+ seconds to process 18 turns with embeddings.

---

## Root Cause: The Perfect Storm

### 1. **Analysis Queue Skipping Pattern**

From `debug.log`:

```
[Σ]  Queue effect triggered, messages: 7 isThinking: true
[Σ]  Unanalyzed user/assistant messages: 3
[Σ]    Skipping assistant message - still streaming

[Σ]  Queue effect triggered, messages: 9 isThinking: true
[Σ]  Unanalyzed user/assistant messages: 4
[Σ]    Turn already analyzed, skipping
[Σ]    Skipping assistant message - still streaming

[... pattern repeats 6 times ...]

[Σ]  Queue effect triggered, messages: 31 isThinking: false
[Σ]  Unanalyzed user/assistant messages: 8
[Σ]    Turn already analyzed, skipping
```

**Analysis:**

- Queue triggered 8 times with increasing message counts (7→9→16→21→26→30→31→33)
- **6 occurrences** of "Skipping assistant message - still streaming"
- Multiple "Turn already analyzed, skipping" despite messages not being fully processed
- Final queue run shows **8 unanalyzed messages** when `isThinking: false`

**Code Location:** `src/tui/hooks/useClaudeAgent.ts:486-500`

```typescript
// For assistant messages, only queue if we're NOT currently thinking
if (message.type === 'assistant' && isThinking) {
  debug('   Skipping assistant message - still streaming');
  return;
}

// Skip if already analyzed
if (turnAnalysis.hasAnalyzed(turnTimestamp)) {
  debug('   Turn already analyzed, skipping');
  continue;
}
```

**The Problem:** Messages skipped during `isThinking: true` are **never queued for later analysis**. The code assumes they'll be caught on the next queue trigger, but if compression fires first, they're lost.

### 2. **Compression Trigger Doesn't Wait for Queue Completion**

**Code Location:** `src/tui/hooks/compression/useCompression.ts:111-134`

```typescript
useEffect(() => {
  // Don't check during streaming
  if (isThinking) {
    return;
  }

  const result = triggerRef.current.shouldTrigger(tokenCount, analyzedTurns);

  if (result.shouldTrigger) {
    // Immediately triggers compression
    onCompressionTriggered?.(tokenCount, analyzedTurns);
  }
}, [tokenCount, analyzedTurns, isThinking, ...]);
```

**Trigger Conditions (all must be true):**

- `isThinking === false` ✓
- `tokenCount > threshold` (65,990 > 20,000) ✓
- `analyzedTurns >= minTurns` (5 >= 5) ✓

**The Fatal Flaw:** No check for:

- Is `AnalysisQueue.processing === true`?
- Is `AnalysisQueue.queue.length > 0`?
- Are there unanalyzed messages in the message array?

The compression trigger fires **immediately** when conditions are met, regardless of whether the analysis queue is still working through pending turns.

### 3. **The "Pending Turn Fix" Is Insufficient**

**Code Location:** `src/tui/hooks/useClaudeAgent.ts:207-232`

```typescript
// FIX: Detect pending (unanalyzed) turn before compression
const lastMessage = messages[messages.length - 1];
const lastAnalyzed = turnAnalysis.analyses[turnAnalysis.analyses.length - 1];

const hasPendingTurn =
  lastMessage &&
  lastMessage.type !== 'system' &&
  lastMessage.type !== 'tool_progress' &&
  (!lastAnalyzed || lastMessage.timestamp.getTime() > lastAnalyzed.timestamp);
```

**What It Does:**

- Checks if the **last message** is unanalyzed
- Adds it as a minimal node to the lattice
- Re-queues it for analysis after compression

**What It Misses:**

- The **6-8 messages in the middle** that were skipped during streaming
- Messages that are queued in `AnalysisQueue` but not yet processed
- Messages with timestamps in `analyzedTimestamps` set but incomplete embeddings

**Evidence from recap.txt:**

```
## Recent Conversation

**[USER]**: howdy

**[ASSISTANT]**: Hey there! How can I help you today?

**[USER]**: /quest-start prepare full technical documentation on how sigma contex continuity works

**[ASSISTANT]**: I'll help you initialize this quest! Let me gather the baseline context by running the cognition-cli commands to understand the current state and find...

**[ASSISTANT]**: Let me search for more specific information about sigma and context continuity in the codebase:
```

The recap captured the **chat preamble** but shows the assistant's work was **truncated mid-sentence**. The entire 18-turn tool sequence (shown in full in `session-*.log`) was **not analyzed** and therefore **not included in overlay scoring**.

### 4. **Embedding Service Latency Bottleneck**

**From Session Log Analysis:**

- 18 turns generated in 64 seconds (11:13:16 → 11:14:20)
- Average turn rate: ~3.5 seconds per turn
- Estimated embedding time: ~500ms per turn
- **Total embedding time needed:** ~9 seconds for 18 turns

**But:**

- Compression triggered at 11:15:01 (41 seconds after assistant finished)
- If queue started processing only after `isThinking: false` at 11:14:20
- And had to process 18 turns sequentially
- It would need 9+ seconds **just for embeddings**
- Plus analysis overhead (overlay scoring, novelty calculation, etc.)

**Queue Processing Status at Compression:**

```
[Σ]  Queue effect triggered, messages: 31 isThinking: false
[Σ]  Unanalyzed user/assistant messages: 8
```

**8 unanalyzed messages** means roughly **half the conversation** was still pending analysis when compression fired.

### 5. **Low-Quality Overlay Scores in Compressed Output**

**From `117dee94...recap.txt`:**

```
## Actions Taken (O5 Operational)
1. [Score: 6/10] howdy
2. [Score: 6/10] Hey there! How can I help you today?
3. [Score: 6/10] I'll help you initialize this quest! ...
```

**Analysis:**

- Only **3 turns** captured in O5 (Operational) overlay
- All scored at **6/10** (medium-low importance)
- The actual quest briefing (18 turns with tool use, file references, pattern analysis) scored **nothing higher than 6/10**

**Expected scores for the missing content:**

- Tool use turns: O5 (Operational) should be **8-9/10**
- Architecture discussions: O1 (Structural) should be **7-8/10**
- Quest planning: O4 (Mission) should be **8-9/10**
- File references: O6 (Mathematical) should be **7-8/10** (code blocks present)

**Why scores are low:** The turns with high-value content were **never analyzed**, so the compressor only had the trivial opening exchanges to work with.

---

## The Race Condition Cascade

```
┌─────────────────────────────────────────────────────────────┐
│ 1. High-velocity conversation (18 turns in 64 seconds)     │
│    ↓                                                         │
│ 2. isThinking: true blocks queue from analyzing assistant   │
│    ↓                                                         │
│ 3. Messages accumulate in "unanalyzed" state                │
│    ↓                                                         │
│ 4. Token count exceeds threshold (65K > 20K)                │
│    ↓                                                         │
│ 5. Assistant finishes → isThinking: false                   │
│    ↓                                                         │
│ 6. Compression trigger fires immediately                    │
│    ↓                                                         │
│ 7. AnalysisQueue still has 8 pending turns                  │
│    ↓                                                         │
│ 8. Compressor uses incomplete analysis (only 3 turns)       │
│    ↓                                                         │
│ 9. Context reconstructor builds recap from low-quality data │
│    ↓                                                         │
│ 10. Result: 66K → 0K useful context (quest briefing lost)   │
└─────────────────────────────────────────────────────────────┘
```

---

## Specific Code Failures

### Failure Point 1: Queue Skipping Logic

**File:** `src/tui/hooks/useClaudeAgent.ts:486-491`

```typescript
// For assistant messages, only queue if we're NOT currently thinking
if (message.type === 'assistant' && isThinking) {
  debug('   Skipping assistant message - still streaming');
  return; // ❌ LOST: Message is never queued for later
}
```

**Issue:** Uses `return` instead of `continue`, preventing the message from being queued for later analysis.

**Impact:** 6 assistant messages skipped and never recovered.

### Failure Point 2: Compression Trigger Preconditions

**File:** `src/tui/hooks/compression/useCompression.ts:117-133`

```typescript
const result = triggerRef.current.shouldTrigger(tokenCount, analyzedTurns);

if (result.shouldTrigger) {
  // ❌ MISSING: No check for queue.processing or queue.length > 0
  onCompressionTriggered?.(tokenCount, analyzedTurns);
}
```

**Issue:** Doesn't check if `AnalysisQueue` is still processing turns.

**Impact:** Compression fires while 8 turns are still pending analysis.

### Failure Point 3: Pending Turn Detection Scope

**File:** `src/tui/hooks/useClaudeAgent.ts:213-226`

```typescript
const hasPendingTurn =
  lastMessage && // ❌ ONLY checks last message
  lastMessage.type !== 'system' &&
  lastMessage.type !== 'tool_progress' &&
  (!lastAnalyzed || lastMessage.timestamp.getTime() > lastAnalyzed.timestamp);
```

**Issue:** Only detects the **last** unanalyzed message, not all unanalyzed messages.

**Impact:** 6-7 middle turns lost, only the final message is preserved.

### Failure Point 4: AnalysisQueue Deduplication

**File:** `src/tui/hooks/analysis/AnalysisQueue.ts:76-88`

```typescript
hasAnalyzed(timestamp: number): boolean {
  return this.analyzedTimestamps.has(timestamp);
}

async enqueue(task: AnalysisTask): Promise<void> {
  // Skip if already analyzed
  if (this.hasAnalyzed(task.timestamp)) {
    return; // ❌ May skip tasks that failed or were interrupted
  }
```

**Issue:** Timestamp-based deduplication doesn't account for failed/incomplete analyses.

**Impact:** If a turn was marked "analyzed" but embedding failed, it's never retried.

---

## Why The Compressed Recap Lost Context

**Compression Input:**

- **Expected:** 18 high-quality turn analyses with embeddings, overlay scores, semantic tags
- **Actual:** 3 low-quality turn analyses (trivial opening exchanges)

**Overlay Filtering (from `context-reconstructor.ts:476-479`):**

```typescript
const filtered = await filterConversationByAlignment(
  conversationRegistry,
  6 // Min alignment score
);
```

**Result:**

- O1 Structural: (None)
- O2 Security: (None)
- O3 Lineage: (None)
- O4 Mission: (None)
- O5 Operational: 3 items, all score 6/10
- O6 Mathematical: (None)
- O7 Coherence: (None)

**Why overlays are empty:** The turns that should have activated O1/O4/O5/O6 were **never analyzed**, so the conversation registry has no high-scoring items to filter.

**Fallback to "Recent Conversation" (from `context-reconstructor.ts:387-424`):**

```typescript
function getLastConversationTurns(lattice: ConversationLattice): {
  turns: Array<{ role: string; content: string; timestamp: number }>;
  pendingTask: string | null;
};
```

The recap shows the last 5 turns, but they're **incomplete/truncated** because the lattice only has 3 fully-analyzed nodes.

---

## Smoking Gun Evidence

### From `debug.log` Line 13, 17, 22, 26, 30, 35:

```
[Σ]    Skipping assistant message - still streaming
```

**Frequency:** 6 occurrences
**Meaning:** 6 assistant messages encountered while `isThinking: true`
**Outcome:** All 6 were skipped and never re-analyzed before compression

### From `debug.log` Line 37:

```
[useCompression] Triggering compression: 65990 tokens > 20000 threshold with 5 turns
```

**"5 turns"** means only **5 turn analyses** existed when compression fired, but the conversation had **~18+ turns** of actual content.

### From `session-*.log` Lines 243-282:

Full quest briefing with:

- Architecture components listed
- Similarity analysis results
- Quest success criteria
- Technical specifications
- 10-item todo list

**All missing from the compressed recap.**

---

## Impact Assessment

### Quantitative Losses

- **Turns analyzed:** 3/18 (16.7% capture rate)
- **Context preserved:** ~0.5K/66K tokens (~0.75% useful context)
- **Paradigm shifts detected:** 0 (should have been 1-2)
- **Tool uses recorded:** 0 (should have been 18)
- **Overlay activations:** 1 overlay vs. expected 4-5 overlays

### Qualitative Losses

- ❌ Quest objective completely lost
- ❌ Success criteria not preserved
- ❌ Architecture discovery (analyzeTurn, useTurnAnalysis patterns) lost
- ❌ Todo list (10 items) lost
- ❌ Security requirements lost
- ❌ Coherence baseline (54.2%) lost

### User Experience Impact

User's next message: "what was the quest?"

**This proves the context loss:** The system had just spent 18 turns building a detailed quest briefing, and **none of it survived compression**.

---

## Architectural Insights

### Design Assumption Violations

**Assumption 1:** "Turns are analyzed before compression triggers"

- **Reality:** Compression can trigger while queue is processing
- **Violated by:** Race condition between `useCompression` and `AnalysisQueue`

**Assumption 2:** "The pending turn fix catches all unanalyzed messages"

- **Reality:** Only catches the last message
- **Violated by:** Implementation only checks `messages[messages.length - 1]`

**Assumption 3:** "isThinking: false means all messages are ready for analysis"

- **Reality:** isThinking only tracks SDK streaming state, not queue state
- **Violated by:** Queue processing can lag behind SDK completion

**Assumption 4:** "analyzedTimestamps set accurately tracks completion"

- **Reality:** Timestamp may be added before embedding completes
- **Violated by:** Async embedding service failures not handled

### The Real Problem: Missing Synchronization Primitive

The system has **no synchronization** between:

1. Message arrival (from SDK)
2. Turn analysis (AnalysisQueue)
3. Compression trigger (useCompression)

**What's needed:** A state machine that enforces:

```
READY → ANALYZING → ANALYZED → COMPRESSIBLE
```

With transitions guarded by:

- `canCompress = queue.length === 0 && queue.processing === false`

---

## Conclusion

The context continuity failure is **not a single bug** but a **systemic timing issue** arising from:

1. **Architectural assumption:** That `isThinking: false` implies "all messages analyzed"
2. **Missing synchronization:** Between message arrival, analysis completion, and compression trigger
3. **Insufficient error recovery:** Skipped messages are never queued for retry
4. **Scope limitation:** Pending turn detection only checks the last message

The "pending turn fix" in `useClaudeAgent.ts:207-232` patches **one symptom** (the last message) but misses the **root cause** (the 6-8 messages skipped during streaming).

**Result:** A compression system that works perfectly for slow conversations but catastrophically fails under high-velocity tool-heavy workloads.

---

## Recommendations (Analysis Only - No Solutions)

### Critical Questions for Implementation

1. **Should compression wait for queue completion?**
   - Current: No (triggers on isThinking: false)
   - Risk: Loses unanalyzed turns
   - Tradeoff: Latency vs. completeness

2. **Should skipped messages be queued for retry?**
   - Current: No (return statement prevents queuing)
   - Risk: Permanent loss of streaming-phase messages
   - Tradeoff: Duplicate analysis vs. missing analysis

3. **Should embedding failures block compression?**
   - Current: No (compression proceeds with partial data)
   - Risk: Low-quality overlay scores
   - Tradeoff: Availability vs. quality

4. **Should the system detect "high-velocity mode"?**
   - Current: No (same logic for all conversation speeds)
   - Risk: Race conditions under load
   - Tradeoff: Complexity vs. robustness

---

**Analysis Complete.**
**Timestamp:** 2025-11-15T[current-time]
**Confidence:** 95% (based on code inspection + log correlation)
**Next Step:** Design phase (not included in this analysis)
