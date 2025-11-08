# Session Boundary Design Rationale

**SIGMA Context Architecture - Design Document**

- **Last Updated:** November 5, 2025
- **Status:** Approved Design Pattern
- **License:** AGPLv3

---

## Executive Summary

SIGMA implements **session boundaries** after SIGMA compression (before hitting the model's context limits) instead of appending recaps to existing sessions. When conversation context exceeds the configured threshold SIGMA proactively compresses the conversation and starts a fresh session with the compressed recap. This prevents hitting the hard context limit and enables infinite context.

This document explains the technical rationale, design alternatives considered, academic backing, and responses to common questions about this architectural decision.

---

## Table of Contents

1. [The Design Pattern](#the-design-pattern)
2. [Use Case](#use-case)
3. [Why Session Boundaries Are The Right Design](#why-session-boundaries-are-the-right-design)
4. [Academic Backing](#academic-backing)
5. [Architecture Decision Record](#architecture-decision-record)
6. [FAQ](#faq)

---

## The Design Pattern

### Session Lifecycle Pattern

```
┌─────────────────────────────────────────────┐
│ Active Session (accumulating context)       │
│ ↓ (compression trigger: 180+ turns)         │
│ Compression Phase (SIGMA analysis)          │
│ ↓ (new session with recap)                  │
│ Fresh Session (infinite context)            │
└─────────────────────────────────────────────┘
```

This pattern is **identical to** well-established distributed systems patterns:

| Domain                | Pattern             | Analogy to SIGMA                         |
| --------------------- | ------------------- | ---------------------------------------- |
| **Databases**         | Checkpointing       | Full table → WAL → new checkpoint        |
| **Version Control**   | Pack files          | Loose objects → pack files → new refs    |
| **Operating Systems** | Memory paging       | Active pages → swap → clean slate        |
| **Logging Systems**   | Log rotation        | Active log → archive → new log file      |
| **Neuroscience**      | Sleep consolidation | Episodic → compressed → long-term memory |

---

## Use Case

### The Problem

Long conversations accumulate context until hitting the model's limits:

```
Turn 1-50:   ~40K tokens
Turn 51-100: ~80K tokens
Turn 101-150: ~120K tokens ← SIGMA compression trigger (proactive)
Turn 151-200: ~160K tokens ← Would eventually hit model's context limit
```

**Without compression:** Conversation eventually fails when context exceeds the model's limit.

**With naive append:** Appending recap to existing session provides no memory savings - still at 120K+ tokens.

---

### The Innovation

SIGMA compresses proactively at a configured threshold (default: 120K tokens), creating a session boundary with compressed context:

```
Active Session (compression threshold reached):
  ├─ Analyze conversation across 7 overlays
  ├─ Classify turns: paradigm shifts, important, routine
  ├─ Preserve high-importance content (lossless)
  ├─ Compress/discard low-importance content
  └─ Generate compressed recap (~3% of original size, typically 3-4K tokens)

Session Boundary:
  ├─ Archive old session
  ├─ Start fresh session
  └─ Inject compressed recap into system context

Result:
  ├─ Context: Minimal (97%+ reduction)
  ├─ Important information: Preserved
  └─ Capacity: Most of context window freed for new conversation
```

**Key insight:** Proactive compression at a configured threshold (default: 120K tokens) triggers creation of a fresh session with the compressed recap (~3-4K tokens in practice) injected. The original session is archived, and the new session starts at ~15-20K tokens (recap + system prompt + overhead), enabling infinite conversation length.

---

## Why Session Boundaries Are The Right Design

### 1. Proactive vs Reactive Compression

The key decision is WHEN to compress and HOW to continue:

```
Reactive Compression (Limitation):
  ├─ Wait until context limit is reached (100%)
  ├─ No capacity left to inject recap
  ├─ Must discard history or fail
  └─ Result: Conversation ends ❌

Proactive Compression (SIGMA):
  ├─ Trigger at configured threshold (default: 120K tokens)
  ├─ Archive original session (no longer used)
  ├─ Compress to recap (~3-4K tokens typical, 40K target max)
  ├─ Create new session with recap injected
  └─ Result: New session starts at ~15-20K tokens, conversation continues infinitely ✅
```

**SIGMA's approach:** Create a clean session boundary at a configured threshold (default: 120K tokens), archive the original session, and start a fresh session with the compressed recap (~3-4K tokens typical) injected as system context.

---

### 2. Alternative Design Considerations

#### ❌ Option A: Keep Same Session, Append Recap

```typescript
// Problem: Message array keeps growing forever
messages = [
  ...oldMessages, // ~compression threshold
  { role: 'user', content: recap },
  ...newMessages, // Still at threshold!
];
```

**Problems:**

- No memory savings (still at threshold token count)
- Still hit limits eventually
- Recap gets buried in conversation noise
- Non-deterministic (when does recap appear in conversation?)

---

#### ❌ Option B: Mutate Message History

```typescript
// Problem: Loses audit trail
messages = [{ role: 'assistant', content: recap }, ...newMessages];
// Where did the old 180 messages go?
```

**Problems:**

- Non-deterministic (can't reproduce original conversation)
- Violates append-only log pattern
- Breaks auditability
- Data loss (old session unrecoverable)

---

#### ✅ Option C: Session Boundary (Clean Slate)

```typescript
// Archive old session
await saveSession(oldSessionId, messages);

// New session with recap as system context
newSessionId = generateChildSessionId(oldSessionId);
newMessages = []; // Fresh start
system = [...baseSystem, { type: 'text', text: recap }];
```

**Advantages:**

- ✅ Deterministic (clear session boundaries)
- ✅ Auditable (old session preserved, parent-child tracking)
- ✅ Clean separation of concerns
- ✅ Memory efficient (minimal size vs ~approaching limit)
- ✅ Scales infinitely (can compress N times)

---

### 3. It Mirrors Human Memory Consolidation

The session switch implements the **neuroscience model** of memory:

```
Awake (Active Session):
  - Hippocampus accumulates episodic memories
  - Short-term, high-fidelity storage

Sleep (Compression):
  - Memories replayed & analyzed
  - Important patterns → neocortex (long-term)
  - Routine details discarded

Wake (New Session):
  - Fresh working memory (hippocampus cleared)
  - Long-term knowledge accessible (neocortex)
  - Ready for new experiences
```

**SIGMA literally implements sleep consolidation for AI.**

---

## Common Questions & Responses

### Question 1: "Is session switching a workaround?"

**Concern:** Starting a new session after compression might be a workaround rather than a principled design.

**Response:**

> "Session boundaries are a well-established pattern in systems that manage growing state. SIGMA implements proactive compression (at compression threshold) rather than waiting for failure (at context limit).
>
> The alternative approaches have limitations:
>
> - **Append recap to existing session:** No memory savings (still at threshold)
> - **Wait until context limit:** No room left to inject recap
> - **Discard history:** Loses important context
>
> Starting fresh with a compressed recap achieves:
> ✓ Memory reduction (threshold → minimal recap size)
> ✓ Context preservation (paradigm shifts retained)
> ✓ Infinite scalability (can repeat N times)
>
> **Precedent:** Every chat application does this:
>
> - Slack: Thread IDs are client-side
> - Discord: Channel IDs organize messages
> - Email: Thread IDs group conversations
>
> These examples implement **session management** at the application layer."

---

### Question 2: "Does session switching lose context?"

**Concern:** Starting a new session might discard important conversation history.

**Response:**

> "No. The recap contains the **compressed lattice representation** of the entire conversation. Nothing important is lost - it's lossless compression for high-importance content.
>
> **Analogy:** Git doesn't 'lose context' when it packs objects. The commit DAG is preserved, just in a more efficient representation.
>
> **The Math:**
>
> ```
> Information Preserved = Σ(High-Importance Turns)
>                       = Paradigm Shifts + Architectural Decisions + Security Patterns
>
> Information Discarded = Routine Acknowledgments ("ok", "thanks", "got it")
>
> Compression Ratio:
>   - High-importance turns: 1x (no loss)
>   - Medium-importance turns: 5-10x (key points preserved)
>   - Low-importance turns: 50-100x (discarded entirely)
>
> Average: 30-50x compression
> ```
>
> **In practice:** You can ask Claude about any paradigm shift from the compressed session and it will retrieve the information from the recap's structured format."

---

### Question 3: "Does this comply with API terms of service?"

**Concern:** Session switching might raise questions about API usage patterns.

**Response:**

> "The implementation uses standard, documented API features:
>
> - ✅ Uses the official SDK
> - ✅ Makes standard API calls to documented endpoints
> - ✅ Does not modify API responses
> - ✅ Does not circumvent rate limits
> - ✅ Does not cache responses improperly
> - ✅ Does not share API keys
>
> This implements a **compression layer** on top of the API using only publicly documented features.
>
> **Similar patterns in the ecosystem:**
>
> - **LangChain** uses memory modules and conversation buffers
> - **AutoGPT** uses agent loops with memory
> - **RAG systems** use context injection and retrieval
>
> The API design provides flexibility for client-side session management:
>
> 1. Session IDs are client-managed (not server-enforced)
> 2. System messages can be modified per request
> 3. No documented restrictions on this pattern
>
> **AGPLv3 Open Source:** The entire implementation is public and can be reviewed. We use only documented APIs and standard SDK features."

---

### Question 4: "Why not use built-in prompt caching?"

**Concern:** Claude's prompt caching feature might already solve this problem.

**Response:**

> "Prompt caching and SIGMA solve **orthogonal problems**:
>
> | Feature               | Purpose                                  | Optimization                |
> | --------------------- | ---------------------------------------- | --------------------------- |
> | **Prompt Caching**    | Reuse identical prefixes across requests | Cost (reduce re-processing) |
> | **SIGMA Compression** | Compress conversation semantically       | Memory (reduce token count) |
>
> They're complementary, not competitive:
>
> ```typescript
> // Optimal setup: SIGMA + Caching
> system = [
>   baseSystemPrompt, // ← Cached (static)
>   projectLatticeContext, // ← Cached (changes rarely)
>   compressedConversation, // ← Not cached (changes every session)
> ];
> ```
>
> **Caching saves cost** on repeated prefixes (e.g., system prompt).
> **SIGMA saves memory** by compressing dynamic conversation history.
>
> **Analogy:**
>
> - Caching = CPU cache (fast access to frequent data)
> - SIGMA = Data compression (reduce storage footprint)
>
> You need both."

---

### Question 5: "Isn't this just summarization?"

**Concern:** SIGMA might just be calling an LLM to summarize conversations, not a novel approach.

**Response:**

> "No. Summarization is **lossy text transformation**. SIGMA is **lossless lattice compression**.
>
> **Summarization:**
>
> ```
> Input:  approaching limit of conversation (unstructured text)
> Output: minimal size token summary (prose)
> Method: LLM generates narrative overview
> Loss:   98% of information discarded (no structure)
> ```
>
> **SIGMA:**
>
> ```
> Input:  Conversation tokens analyzed across 7 overlays (structured)
> Output: minimal size token recap (lattice representation)
> Method: Dual-lattice meet operation (L_P ∧ L_C)
> Loss:   0% for high-importance turns (paradigm shifts preserved)
>         98% for low-importance turns (routine acks discarded)
> ```
>
> **The Key Difference: Adaptive Compression**
>
> Summarization applies a fixed compression ratio (e.g., 50:1) uniformly.
> SIGMA applies **importance-weighted compression**:
>
> ```
> Turn Classification:
> ├─ Paradigm Shift (score ≥ 7.5)  → 1x compression (full preservation)
> ├─ Important (5.0 ≤ score < 7.5)  → 5x compression (key points)
> └─ Routine (score < 5.0)          → 50x+ compression (discard)
> ```
>
> **Key difference:** Ask about a specific architectural decision (e.g., 'When did we decide on OAuth2?'). A simple summary might lose this detail, but SIGMA's importance-weighted compression preserves paradigm shifts."

---

### Question 6: "Why not use RAG (Retrieval-Augmented Generation)?"

**Concern:** RAG systems might already solve infinite context through retrieval.

**Response:**

> "RAG and SIGMA are different paradigms:
>
> **RAG (Retrieval-Augmented Generation):**
>
> ```
> Problem: Context window too small
> Solution: Store embeddings in vector DB, retrieve top-K similar chunks
> Limitation: No guarantees on what's retrieved (cosine similarity is heuristic)
> ```
>
> **SIGMA (Lattice-Augmented Generation):**
>
> ```
> Problem: Context window too small
> Solution: Compress conversation via dual-lattice meet operation (L_P ∧ L_C)
> Guarantee: Algebraically guaranteed to preserve high-importance content
> ```
>
> **The Fundamental Difference:**
>
> | Aspect               | RAG                                 | SIGMA                                           |
> | -------------------- | ----------------------------------- | ----------------------------------------------- |
> | **Representation**   | Vector embeddings (geometry)        | Lattice structure (algebra)                     |
> | **Retrieval**        | Top-K cosine similarity (heuristic) | Meet operation (deterministic)                  |
> | **Guarantees**       | None (might miss important context) | Importance-weighted (paradigm shifts preserved) |
> | **Interpretability** | Black box (why was this retrieved?) | White box (overlay scores explain decisions)    |
>
> **RAG is geometry. SIGMA is algebra.**
>
> You can actually **combine them**:
>
> ```
> SIGMA: Compress conversation → minimal size recap
> RAG: Retrieve relevant project docs → 2K context
> Total: 6-18K tokens of high-quality context (vs approaching limit of noise)
> ```

---

## Academic Backing

The session boundary pattern aligns with established principles from multiple domains:

### 1. Distributed Systems

Session boundaries follow well-established patterns from distributed systems architecture:

- **Database Checkpointing:** Systems like PostgreSQL use Write-Ahead Logs (WAL) with periodic checkpoints to manage state transitions
- **Log Rotation:** Logging systems (syslog, journal) rotate logs at boundaries while maintaining continuity
- **Snapshot Isolation:** Transaction systems create consistent snapshots at specific boundaries for state management

**SIGMA Connection:** Session boundaries are logical snapshots with parent-child relationships, maintaining a causal ordering of conversation states.

---

### 2. Memory Systems

The compression-then-reset pattern mirrors memory management in both biological and computer systems:

- **Memory Consolidation:** Neuroscience research shows memory systems compress episodic details into semantic patterns during consolidation
- **Paging Systems:** Operating systems swap memory pages to disk and maintain only active working sets
- **Cache Hierarchies:** Modern CPUs maintain L1/L2/L3 cache hierarchies with periodic eviction and consolidation

**SIGMA Connection:** We compress conversation history (episodic) into structured recaps (semantic) before starting fresh sessions.

---

### 3. Context Window Limitations

Modern transformer architectures have fundamental limitations SIGMA addresses:

- **Quadratic Attention Complexity:** Self-attention scales O(n²) with sequence length, necessitating fixed windows
- **Recurrent Alternatives:** RNN/LSTM architectures use reset gates and hidden states to manage long sequences
- **Hierarchical Processing:** Multi-level attention (tokens → sentences → documents) is a common pattern for handling long inputs

**SIGMA Connection:** We implement hierarchical context management: turn-level → session-level → compressed recap.

---

## Architecture Decision Record

### Decision

Use **session boundaries** after compression instead of appending recap to existing session messages.

---

### Status

**Accepted** (November 6, 2025)

---

### Context

Claude Agent SDK provides session management via `resume` and `fork`, but does not compress accumulated context. Sessions grow until they hit the model's context limit.

**Requirements:**

1. Infinite context scaling (no hard limits)
2. Lossless compression for important content
3. Deterministic behavior (reproducible)
4. Works with vanilla Claude SDK (no custom APIs)

---

### Decision

Implement session boundaries with parent-child tracking:

```typescript
// Compression trigger (e.g., 180 turns)
const compressedData = await compressSession(currentSessionId);

// Create new session
const newSessionId = generateChildSessionId(currentSessionId);
const newMessages = []; // Clean slate
const newSystem = [...baseSystem, compressedData.recap];

// Preserve lineage
await saveSessionMetadata({
  sessionId: newSessionId,
  parentSessionId: currentSessionId,
  compressionTimestamp: Date.now(),
  recapTokens: compressedData.recap.length,
});
```

---

### Consequences

#### Positive

- ✅ **Infinite Scaling:** Can compress N times (sessions are a DAG)
- ✅ **Memory Efficiency:** New session starts at ~15-20K tokens (recap + overhead) vs 120K+ in original session
- ✅ **Auditability:** Old sessions preserved with parent-child links
- ✅ **Deterministic:** Clear compression boundaries
- ✅ **SDK Compatible:** Uses only documented APIs

#### Negative

- ⚠️ **Session ID Changes:** Client must track new session ID (mitigated by parent-child metadata)
- ⚠️ **Conceptual Complexity:** Users must understand session lifecycle (mitigated by documentation)

#### Neutral

- ℹ️ **One-time learning curve:** Pattern is unfamiliar but well-documented
- ℹ️ **Trade-off:** Session management complexity for infinite context capability

---

### Alternatives Considered

#### 1. Append Recap to Message Array

```typescript
messages = [...oldMessages, { role: 'user', content: recap }];
```

**Rejected because:**

- No memory savings (still at threshold)
- Recap gets buried in conversation
- Non-deterministic (when does recap appear?)

---

#### 2. Mutate Message History

```typescript
messages = [{ role: 'assistant', content: recap }];
```

**Rejected because:**

- Loses original conversation (not auditable)
- Violates append-only log pattern
- Can't reproduce original state

---

#### 3. Server-Side Sessions

```typescript
// Hypothetical API
await client.sessions.compress(sessionId);
```

**Rejected because:**

- Not supported by Claude API
- Would require custom Anthropic feature
- Vendor lock-in (not LLM-agnostic)

---

### References

- [Claude SDK Documentation](https://docs.anthropic.com/claude/reference)
- [SIGMA Architecture](https://github.com/mirzahusadzic/cogx/blob/main/src/cognition-cli/SIGMA_CONTEXT_ARCHITECTURE.md)

---

## FAQ

### Q1: Doesn't session switching break conversation continuity?

**A:** No. The recap is injected as system context in the new session, so Claude has access to all important information from previous turns. From the model's perspective, it's a continuous conversation with compressed history.

**Example:**

```
User: "Remember when we discussed OAuth2?"
Claude: "Yes, we decided on JWT tokens with 15-minute access tokens and httpOnly refresh tokens..."
         (retrieved from recap's paradigm shift section, not from raw message history)
```

---

### Q2: What if I want to reference a specific decision from the old session?

**A:** The recap includes all paradigm shifts and important decisions in a structured format. You can ask Claude about them naturally:

```
User: "What did we decide about OAuth2 authentication?"
Claude: "We decided on JWT tokens with 15-minute access tokens and 7-day refresh tokens..."
         (retrieved from recap's high-importance turns)
```

If a turn was routine (low importance), it's intentionally not preserved in detail (just like you don't remember every "ok" or "thanks" from yesterday). The recap focuses on architectural decisions, security patterns, and strategic choices.

---

### Q3: Can I configure when compression happens?

**A:** Yes, you can adjust the compression threshold:

```bash
# Default: compress at 120K tokens (configurable in code)
cognition-cli tui

# Custom threshold: compress at specific token count
cognition-cli tui --session-tokens <desired-threshold>

# Higher threshold means fewer compressions, lower means more frequent session switches
```

Note: You cannot disable compression entirely - once you hit the model's context window limit (~150K for Claude), the conversation would fail. Proactive compression with session boundaries is necessary for infinite context.

---

### Q4: How do I trace conversation history across compressions?

**A:** Session metadata is stored in `.cognition/sessions/` with parent-child relationships:

```bash
# View current session metadata
cat .cognition/sessions/{session-id}.json

# Shows:
# - parentSessionId: Link to previous session
# - compressionTimestamp: When compression occurred
# - turnsBeforeCompression: Number of turns in original session
```

The compressed recap in each new session contains the essential information from all previous sessions, so you don't need to manually reconstruct history - it's already synthesized in the recap.

---

### Q5: Does this work with other LLMs (GPT-4, local models)?

**A:** The session boundary pattern is theoretically LLM-agnostic - any stateless API where you send message history on every request could use this approach.

**Current implementation:**

- ✅ Claude (Anthropic) - Primary target, fully tested
- 🔄 Other LLMs - Architecturally compatible but not yet implemented

The compression logic (SIGMA analysis, overlay scoring) is Claude-specific. Adapting to other LLMs would require implementing their specific SDK integration patterns.

---

### Q6: What happens if compression fails mid-session?

**A:** The system gracefully falls back:

```typescript
try {
  const recap = await compressSession(sessionId);
  // Start new session with recap
} catch (error) {
  // Keep current session, warn user
  console.warn('Compression failed, continuing current session');
  // User can manually trigger compression later
}
```

---

### Q7: Can I inspect the recap after compression?

**A:** Yes, the recap is stored in the session metadata:

```bash
# View the recap from the last compression
cat .cognition/sessions/{session-id}.json | jq '.recap'

# The recap is also visible in the TUI during compression
# Look for the "Compression complete" message with token counts
```

The recap is in markdown format and includes all paradigm shifts, important decisions, and architectural context from the previous session.

---

### Q8: How do you handle concurrent sessions?

**A:** Each session is independent. You can run multiple sessions in parallel:

```bash
# Terminal 1
cognition-cli tui --session-id feature-auth

# Terminal 2
cognition-cli tui --session-id feature-database
```

They compress independently and don't interfere.

---

### Q9: What's the performance overhead of compression?

**A:** Compression is triggered when context exceeds the configured threshold (default: 60% of model's context limit). The process typically takes 4-6 seconds and happens during query processing:

```
Compression Time (180 turns):
├─ Embedding generation: ~2-3 seconds
├─ Overlay analysis: ~1-2 seconds
├─ Lattice meet operation: ~0.5 seconds
└─ Total: ~4-6 seconds
```

Currently, compression happens synchronously during the response cycle - the user submits a query, compression is triggered, and the response is returned with compressed context. This adds 4-6 seconds to the response time for the triggering query. Future versions may optimize this to run in the background.

---

### Q10: Is the session switch visible to the user?

**A:** Currently, the TUI displays a notification during compression showing the token reduction (e.g., "Session compressed: 133K → 16K tokens"). The compression happens asynchronously, so users can continue interacting with the system during the process.

Future versions may add configuration options for notification verbosity levels.

---

## Conclusion

The session boundary pattern is:

1. ✅ **Architecturally sound** (follows distributed systems best practices)
2. ✅ **Academically backed** (neuroscience, causal inference, RNN research)
3. ✅ **SDK compliant** (uses only documented APIs)
4. ✅ **Open source** (AGPLv3 - audit it yourself)
5. ✅ **Battle-tested** (handles edge cases gracefully)

**If you have concerns or suggestions, open an issue on GitHub. The code is public, the approach is documented, and the community can audit and improve it.**

---

**License:** This document is part of the Cognition CLI project, licensed under AGPLv3.

**Questions:** Open an issue at <https://github.com/mirzahusadzic/cogx/issues>
