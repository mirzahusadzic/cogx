# Context Management - Quick Reference Guide

## ✅ FIXES IMPLEMENTED (2025-11-05)

All 4 critical issues have been resolved! The system now maintains context across multi-turn conversations.

### 1. ✅ One-Shot Recap Consumption - FIXED

**Problem:** Recap injected only for first query, then cleared
**Solution:** Removed `setInjectedRecap(null)` at line 994 - recap now persists
**Impact:** Follow-up questions after compression maintain full context
**Example:**

```
Recap contains: "Using TypeScript ORM with migrations"
Q1: "Should we add validation?" → Works (recap available) ✅
Q2: "How do we test this?" → Works (recap still available) ✅
Q3+: "Add error handling" → Works (recap persists) ✅
```

### 2. ✅ Discarded Low-Importance Turns - FIXED

**Problem:** Turns with importance < 3 permanently deleted
**Solution:** Low-importance turns now compressed at 10% instead of discarded
**Impact:** Decisions preserved with minimal token overhead
**Example:**

```
User: "Target device has 1GB RAM" (importance=2) → COMPRESSED at 10% ✅
After compression: "How do we handle memory?" → Assistant remembers constraint ✅
```

### 3. ✅ Shallow Real-Time Context - FIXED

**Problem:** Only 20 recent turns scanned, only top 3 injected
**Solution:** Increased to 50 turns window + 5 context turns + paradigm shift inclusion
**Impact:** Can access decisions from 50+ turns ago, better context awareness
**Changes:**

- `windowSize`: 20 → 50 turns
- `maxContextTurns`: 3 → 5 turns
- `minRelevance`: 0.4 → 0.35 (catches more relevant context)
- `maxSnippetLength`: 400 → 500 chars
- Added: All paradigm shifts included regardless of recency

### 4. ✅ Messages Array Clarity - ENHANCED

**Problem:** UI message after compression wasn't clear about what happened
**Solution:** Enhanced system message with detailed breakdown
**Impact:** Users understand what was preserved, compressed, or discarded
**New message format:**

```
🎯 Context compressed (30x ratio, quest mode)
   • Preserved: 12 paradigm shifts
   • Compressed: 45 important turns
   • Discarded: 8 low-value turns
   • Message history remains visible in UI
   • Intelligent recap will inject on next query
```

---

## Critical Issues at a Glance (HISTORICAL - NOW FIXED)

### 1. ~~One-Shot Recap Consumption~~ ✅ FIXED

**Was:** Recap injected only for first query, then cleared
**Now:** Recap persists across all queries until new session

---

## Quick Diagnosis Guide

**Problem:** "Assistant forgot what we decided earlier"

- Check: Was it > 20 turns ago? → Real-time injector misses it
- Check: Was it low-importance? → Might have been discarded
- Solution: Call `recall_past_conversation` MCP tool explicitly

**Problem:** "Follow-up questions lost context"

- Check: How many queries after compression?
- If 2nd query: Recap was cleared after 1st query
- Solution: Include context in 2nd query manually

**Problem:** "Can't see old conversation in UI"

- Check: Did compression happen?
- Solution: Use MCP tool or scroll back in recap file (`.sigma/{id}.recap.txt`)

---

## Files to Modify (Priority Order)

| Fix                           | File                     | Line(s)    | Priority |
| ----------------------------- | ------------------------ | ---------- | -------- |
| Keep recap persistent         | useClaudeAgent.ts        | 990-999    | CRITICAL |
| Increase injection window     | context-injector.ts      | 99-102     | HIGH     |
| Preserve low-importance turns | compressor.ts            | 70-86      | HIGH     |
| Keep recent session history   | useClaudeAgent.ts        | 976-983    | MEDIUM   |
| Add conversation structure    | context-reconstructor.ts | All recaps | MEDIUM   |

---

## Performance Impact of Fixes

| Fix                         | Token Overhead      | Speed Impact            | Difficulty |
| --------------------------- | ------------------- | ----------------------- | ---------- |
| Keep recap persistent       | +5-10K per query    | +500ms (SLM generation) | Medium     |
| Increase window to 50 turns | +200-400 tokens     | Negligible              | Easy       |
| Archive instead of discard  | +20-30K per session | Negligible              | Medium     |
| Structured turn history     | +2-5K per recap     | Negligible              | Easy       |
| Session chaining            | +100 tokens         | Negligible              | Medium     |

---

## Testing Scenarios

### Test 1: Follow-up After Compression

```
1. Start conversation (50+ turns to hit compression)
2. Let compression trigger
3. User Q1: "Can you test this?" → Should work (recap available)
4. User Q2: "Also check error handling" → Should work (inject recent)
5. Verify: Q2 response references Q1 context
```

### Test 2: Old Decision Recovery

```
1. Turn 10: "Use TypeScript"
2. Turn 50: Compression triggers
3. Turn 55: "Should we use Rust?"
4. Expected: Assistant remembers TypeScript from turn 10
5. Actual: May not find turn 10 (outside recent 20)
```

### Test 3: Low-Importance Preservation

```
1. Turn 5: "We only have 256MB heap" (importance=2, gets discarded)
2. Turn 50: Compression triggers
3. Turn 55: "How do we optimize memory?"
4. Expected: Remembers 256MB constraint
5. Actual: Constraint permanently lost
```

---

## Root Cause Analysis Map

```
Why Assistant Loses Recent Conversation?
├─ After compression, why lose Q1 context in Q2?
│  └─ Because: injectedRecap cleared after Q1 (line 994)
│  └─ Because: real-time injector only scans 20 turns
│
├─ Why can't find old architectural decision?
│  └─ Because: injector window is 20 turns (line 99)
│  └─ Because: older turns not in turnAnalyses anymore
│
├─ Why are low-importance decisions lost?
│  └─ Because: compressor discards importance < 3 (line 71)
│  └─ Because: lattice only contains preserved nodes (line 143)
│
├─ Why can't see conversation flow after compression?
│  └─ Because: messages[] reset to empty (line 539)
│  └─ Because: recap is text blob, not conversation history (line 993)
│
└─ Why is first fix complex?
   └─ Because: recap generation is expensive (SLM + LLM)
   └─ Because: keeping it in state might bloat memory
   └─ Solution: Cache intelligently, clear on session switch
```

---

## Code Patterns to Watch

### Pattern 1: injectedRecap Lifecycle (DANGEROUS)

```typescript
// Generated during compression
setInjectedRecap(reconstructed.recap); // Set

// Used once
if (injectedRecap) {
  finalPrompt = `${injectedRecap}\n\n---\n\nUser request: ${prompt}`;
  setInjectedRecap(null); // ← IMMEDIATELY CLEARED
}
```

**Problem:** Next query has no access
**Solution:** Keep in state until session switch

### Pattern 2: Recent Turns Window (SHALLOW)

```typescript
const recentTurns = turnAnalyses.slice(-windowSize); // Default: 20
```

**Problem:** Older context inaccessible
**Solution:** Increase to 50-100, add importance weighting

### Pattern 3: Turn Classification (PERMANENT)

```typescript
if (turn.is_routine) {
  discarded.push(turn.turn_id); // Never restored
}
```

**Problem:** Low-importance but contextually important turns lost
**Solution:** Archive instead of delete, keep full text

---

## MCP Tool as Workaround

The `recall_past_conversation` MCP tool can partially fill gaps:

```typescript
// In new session, assistant can call:
mcp__conversation -
  memory__recall_past_conversation({
    query: 'What were the key architectural decisions?',
  });

// Returns synthesized answer from old context
// BUT: Slower (requires SLM + LLM)
// BUT: Not integrated into conversation history
// BUT: Requires assistant to explicitly remember to use it
```

---

## Timeline of Failures in Long Conversation

```
Turn 0:        START
Turn 1-10:     Early decisions (importance varies)
Turn 20:       Architecture discussed (importance varies)
Turn 30:       Implementation started
Turn 40:       Changes to approach
Turn 50:       Low-importance decisions (importance < 3)

Turn 75:       ⚠️ COMPRESSION TRIGGERS (150K tokens)
               ├─ Discarded: turns with importance < 3
               ├─ Generated: recap (40K tokens)
               ├─ Set: injectedRecap = recap
               └─ Reset: token count = 0

Turn 75-Q1:    ✅ User asks follow-up
               ├─ Recap available ✅
               ├─ Recent turns injected ✅
               └─ Works well

Turn 75-Q2:    ❌ User asks second follow-up
               ├─ Recap cleared ❌
               ├─ Only 20 recent turns scanned ❌
               ├─ Q1 response might not be high-importance ❌
               └─ Likely fails to connect Q1-Q2

Turn 80:       ❌ "What about that constraint from turn 50?"
               ├─ Turn 50 was low-importance → DISCARDED ❌
               ├─ Window only includes turns 60-80
               └─ Fails to remember

Turn 100:      ⚠️ SECOND COMPRESSION (if conversation continues)
               └─ Previous compression context lost for similar reasons
```

---

## Quick Wins (Easy Fixes)

1. **Increase window size** (5 min, +200 tokens)
   - Change `windowSize = 20` to `windowSize = 50`
   - Change `maxContextTurns = 3` to `maxContextTurns = 5`
2. **Format recap better** (10 min, no token cost)
   - Add turn numbers: `Turn X: [role]: [content]`
   - Add section headers
   - Make it parse-able as conversation history

3. **Add session boundaries** (20 min, +100 tokens)
   - Inject "Previous session contained: [summary]"
   - Help assistant understand session transitions

---

## Long-term Solution Architecture

```
Current (Problematic):
  messages[] ← Current session only
  ├─ Reset after compression
  └─ No old context visible

Proposed (Better):
  messages[] ← Current session + recap as structured history
  ├─ Keep recap as system messages with turn structure
  ├─ Include turn numbers and timestamps
  └─ Preserve across queries in new session

MCP Tool ← Explicit memory recall (slow)
  └─ Backed by overlays + semantic search

Real-time Injection ← Semantic sliding window (fast)
  ├─ Increased window (50+ turns)
  └─ Better scoring

Persistent Lattice ← Archive, not discard (medium)
  ├─ Keep all turns (even discarded)
  ├─ Archive low-importance separately
  └─ Enable recovery via MCP tool
```

---

## Questions to Ask When Debugging Context Loss

1. **How many turns have passed since compression?**
   - 1st query: OK (recap available)
   - 2nd+ query: Risk (recap cleared)

2. **Is the forgotten context recent or old?**
   - Last 20 turns: Real-time injector should find it
   - 20+ turns ago: Likely missed

3. **What was the importance score of the forgotten turn?**
   - importance >= 7: Preserved in lattice
   - importance 3-7: In lattice but not in recap
   - importance < 3: DISCARDED, unrecoverable

4. **Did the turn belong to the previous session?**
   - Yes: Only accessible via MCP tool
   - No (current session): Should be in context injection

5. **Is the assistant aware of the MCP tool?**
   - Check system prompt
   - Ensure tool is documented in recap

---

## Final Recommendations

**Immediate (This week):**

- Increase `windowSize` from 20 to 50
- Increase `maxContextTurns` from 3 to 5
- Add session boundary markers

**Short-term (This sprint):**

- Keep recap persistent across queries (don't clear after 1st use)
- Format recap as conversation history (not text blob)
- Add "previous session ID" to context

**Long-term (Next quarter):**

- Archive all turns (don't discard)
- Improve importance scoring to catch low-scoring but contextually important turns
- Automatic recall trigger for paradigm shift references
- Session chaining with temporal filtering in overlays
