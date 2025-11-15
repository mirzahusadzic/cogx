# ADR-008: Session Continuity (LanceDB-Based Conversation Memory)

**Date**: Circa 2025 (Sigma v2.0)
**Status**: Accepted
**Deciders**: Core team
**Related**: Innovation #39-46 (Sigma Dual-Lattice Architecture)

## Context

The Sigma system provides infinite context for AI conversations through intelligent compression. After compression at 120K tokens, we needed a session continuity mechanism that:

1. **Preserves identity** - User references stable session ID across compressions
2. **Enables recovery** - Semantic search retrieves compressed information
3. **Maintains audit trail** - Full history of session transitions
4. **Supports resumption** - Pick up conversations after days/weeks
5. **Cross-session queries** - Find information across all past sessions

Traditional approaches (single session, truncation, or naive recaps) lose context permanently. We needed an architecture where **compression doesn't mean forgetting**.

## Decision

We implemented **LanceDB-based conversation memory with anchor ID indirection**:

**Three-Layer Architecture:**

1. **Anchor IDs** (User-Facing)
   - Stable identifier: `--session-id feature-auth`
   - User always references same ID
   - Stored in: `.sigma/{anchorId}.state.json`

2. **SDK Session IDs** (Internal)
   - Transient UUIDs assigned by Claude SDK
   - Change on each compression (new session created)
   - Mapping: Anchor → Current SDK Session

3. **LanceDB Conversation Store** (Permanent Memory)
   - Location: `.sigma/conversations.lancedb`
   - Stores: All turns with 768D embeddings
   - Metadata: Importance, novelty, overlay alignment (O1-O7)
   - Queryable: Semantic search across all sessions

**Session Lifecycle:**

```
Active Session (120K+ tokens)
  ├─ Accumulate turns in memory
  ├─ Analyze each turn (embeddings + importance)
  ├─ Store in LanceDB
  └─ Track in {anchorId}.state.json

Compression Trigger
  ├─ Generate compressed recap (3-4K tokens)
  ├─ Archive old SDK session
  ├─ Create new SDK session
  ├─ Update state mapping (anchor → new SDK session)
  └─ Inject recap into system context

Session Resumption
  ├─ User provides anchor ID
  ├─ Load state.json (find current SDK session)
  ├─ Resume from latest SDK session
  └─ LanceDB available for semantic queries
```

**Code References:**

- Session state: `src/sigma/session-state.ts`
- State store: `src/tui/hooks/session/SessionStateStore.ts`
- LanceDB conversation store: `src/sigma/conversation-lance-store.ts`
- Cross-session query: `src/sigma/cross-session-query.ts`

## Alternatives Considered

### Option 1: Single Long Session (No Compression)

- **Pros**: Simple, no complexity
- **Cons**:
  - Hits 200K hard limit
  - Session terminates (loses all context)
  - Cannot continue conversation
- **Why rejected**: Violates infinite context goal

### Option 2: File-Based Recaps (No Vector Storage)

- **Pros**: Simple, no database dependency
- **Cons**:
  - Cannot perform semantic search on compressed sessions
  - "What did we decide about authentication?" requires manual grep
  - No importance metadata (all turns equal)
  - Cross-session queries impossible
- **Why rejected**: Lossy; no semantic recovery capability

### Option 3: Full Conversation in System Prompt

- **Pros**: Claude has all context always
- **Cons**:
  - Token cost scales linearly (expensive)
  - Latency increases with session length
  - Defeats purpose of compression
- **Why rejected**: Doesn't solve context window problem

### Option 4: External Database (PostgreSQL, MongoDB)

- **Pros**: Mature, well-understood, rich query capabilities
- **Cons**:
  - Requires server (not serverless)
  - No vector similarity search (need pgvector extension)
  - Network latency for queries
  - Violates offline-first principle
- **Why rejected**: Server dependency incompatible with serverless PGC

### Option 5: In-Memory Only (No Persistence)

- **Pros**: Fast, no disk I/O
- **Cons**:
  - Lost on TUI exit
  - Cannot resume sessions
  - No cross-session queries
  - Ephemeral (violates continuity goal)
- **Why rejected**: No persistence = no continuity

## Rationale

LanceDB-based conversation memory was chosen because it enables **semantic recovery** from compressed sessions:

### 1. Anchor ID Indirection (Stable User Interface)

**From `session-state.ts`:**

```typescript
export interface SessionState {
  anchor_id: string; // User-facing, stable
  current_session: string; // SDK session UUID (transient)
  compression_history: Array<{
    sdk_session: string; // Actual session used
    timestamp: string;
    reason: 'initial' | 'compression' | 'expiration';
    tokens?: number;
  }>;
}
```

**User Experience:**

```bash
# Day 1: Start session
$ cognition-cli tui --session-id auth-refactor

# Day 3: Resume (after compression happened)
$ cognition-cli tui --session-id auth-refactor  # Same ID works!
```

**Behind the scenes:**

- Anchor `auth-refactor` → SDK session `uuid-1` (initial)
- Compression at 120K → Create SDK session `uuid-2`
- User resumes with `auth-refactor` → System loads `uuid-2`

### 2. LanceDB Conversation Store (Semantic Memory)

**From `conversation-lance-store.ts`:**

```typescript
export interface ConversationTurnRecord {
  id: string; // turn_id
  session_id: string; // SDK session UUID
  role: string; // 'user' | 'assistant' | 'system'
  content: string; // Full turn text
  timestamp: number; // Unix milliseconds
  embedding: number[]; // 768D semantic vector

  // SIGMA Analysis
  novelty: number; // 0-1
  importance: number; // 1-10
  is_paradigm_shift: boolean;

  // Overlay Alignment (O1-O7)
  alignment_O1: number; // Architecture
  alignment_O2: number; // Security
  // ... O3-O7

  // Relationships
  semantic_tags: string; // JSON array
  references: string; // JSON array of turn_ids
}
```

**Storage Location:** `.sigma/conversations.lancedb`

**Capabilities:**

- **Semantic search**: "Find discussions about user privacy"
- **Temporal queries**: "What happened between Nov 1-5?"
- **Importance filtering**: "Show paradigm shifts only"
- **Overlay queries**: "Turns with high O2 (security) alignment"

### 3. Cross-Session Queries (Infinite Memory)

**From `cross-session-query.ts`:**

```typescript
// Find similar conversations across ALL sessions
export async function findSimilarConversations(
  query: string,
  sigmaRoot: string
): Promise<CrossSessionResult[]>

// Get paradigm shifts across all compressed sessions
export async function findAllParadigmShifts(
  sigmaRoot: string,
  sessionId?: string
): Promise<CrossSessionResult[]>

// Find turns by overlay alignment
export async function findByOverlayAlignment(
  sigmaRoot: string,
  overlay: 'O1' | 'O2' | ... | 'O7',
  minAlignment: number
): Promise<CrossSessionResult[]>
```

**Example:**

```typescript
// User asks: "What did we decide about authentication?"
// System:
1. Embed query → 768D vector
2. Query LanceDB across all sessions
3. Find high-similarity turns (even from months ago)
4. Return results with session context
```

### 4. Session Forwarding (Automatic Resume)

**From `SessionStateStore.ts`:**

```typescript
loadForResume(): SessionLoadResult {
  const state = this.load();

  if (!state) {
    return { currentSessionId: this.anchorId };  // New session
  }

  // Check if session was compressed
  if (state.compression_history.length > 0) {
    const latest = state.compression_history[state.compression_history.length - 1];
    return {
      currentSessionId: this.anchorId,       // Anchor ID
      resumeSessionId: latest.sdk_session    // Actual SDK session to resume
    };
  }

  return { currentSessionId: state.current_session };
}
```

**Result:** User always uses anchor ID; system handles SDK session chain internally.

### 5. Audit Trail (Compression History)

**From `.sigma/{anchorId}.state.json`:**

```json
{
  "anchor_id": "auth-refactor",
  "current_session": "uuid-3",
  "created_at": "2025-11-01T10:00:00Z",
  "last_updated": "2025-11-05T15:30:00Z",
  "compression_history": [
    {
      "sdk_session": "uuid-1",
      "timestamp": "2025-11-01T10:00:00Z",
      "reason": "initial",
      "tokens": 0
    },
    {
      "sdk_session": "uuid-2",
      "timestamp": "2025-11-03T12:45:00Z",
      "reason": "compression",
      "tokens": 135000
    },
    {
      "sdk_session": "uuid-3",
      "timestamp": "2025-11-05T09:15:00Z",
      "reason": "compression",
      "tokens": 142000
    }
  ],
  "stats": {
    "total_turns_analyzed": 247,
    "paradigm_shifts": 12,
    "routine_turns": 89
  }
}
```

**Forensic Capability:**

- When was session compressed?
- How many tokens at compression time?
- How many paradigm shifts identified?

## Consequences

### Positive

- **Infinite context** - Compression doesn't mean forgetting
- **Semantic recovery** - Find information from months ago via embeddings
- **Stable UX** - User always references anchor ID
- **Audit trail** - Full history of session evolution
- **Cross-session queries** - "What did we decide about X?" works across all sessions
- **Resumable** - Pick up conversations after weeks

### Negative

- **Storage growth** - LanceDB grows unbounded (needs periodic compaction)
- **Complexity** - Three-layer architecture (anchor/SDK session/LanceDB)
- **Query latency** - Semantic search across large conversation history
- **Storage cost** - ~2 MB per 250 turns (acceptable)

### Neutral

- **LanceDB dependency** - Same as ADR-001 (vector storage)
- **State file format** - JSON (human-readable but not transactional)
- **Compaction needed** - Periodic cleanup of old sessions (future work)

## Evidence

### Code Implementation

- Session state: `src/sigma/session-state.ts:1-100`
- State store: `src/tui/hooks/session/SessionStateStore.ts:1-200`
- Session manager hook: `src/tui/hooks/session/useSessionManager.ts:1-150`
- LanceDB conversation store: `src/sigma/conversation-lance-store.ts:1-300`
- Cross-session query: `src/sigma/cross-session-query.ts:1-200`
- LanceDB compaction: `src/sigma/compact-lancedb.ts:1-100`

### Documentation

- Architecture: `docs/SESSION_BOUNDARY_RATIONALE.md:1-766`
- Sigma system: `SIGMA_CONTEXT_ARCHITECTURE.md:1-600`
- TUI README: `src/tui/README.md` (session continuity section)

### Innovation Disclosure

From `VISION.md:201-208`:

> **Published**: November 3, 2025
>
> 42. **Session Lifecycle Management:** Three-phase system (normal operation with periodic flush → compression trigger with overlay flush → session resurrection from intelligent recap) enabling seamless continuity across unlimited sessions with zero perceived context loss
> 43. **Session Forwarding for Compressed Sessions:** Automatic forwarding of `--session-id` to compressed session via `.sigma/{id}.state.json` state detection, recap loading with fresh SDK session start (no dead session resume), user always uses original session ID while Sigma manages internal chain

### Storage Structure

```
.sigma/
├── {anchor-id}.state.json          # Session state mapping
├── conversations.lancedb/          # LanceDB conversation store
│   ├── data/                       # Actual vector data
│   └── metadata/                   # Table schemas
└── overlays/                       # Per-session overlay storage
    ├── O1_architecture/
    ├── O2_security/
    └── ... O3-O7
```

## Notes

**Why Anchor IDs Instead of Direct SDK Sessions?**

SDK sessions are implementation details that change on compression. Exposing them to users would be confusing:

**Bad UX (No Anchor IDs):**

```bash
# Day 1
$ cognition-cli tui --session-id 8a3f9d2e-1b4c-4a7e-9f3d-2c1b8a7e6f5d

# Day 3 (after compression)
$ cognition-cli tui --session-id 8a3f9d2e-1b4c-4a7e-9f3d-2c1b8a7e6f5d
Error: Session not found. Did you mean 7f2e8c1d-5a3b-4e9f-8d2c-1a7b6e5f4d3c?
```

**Good UX (With Anchor IDs):**

```bash
# Day 1
$ cognition-cli tui --session-id auth-refactor

# Day 3 (after compression)
$ cognition-cli tui --session-id auth-refactor  # Just works
```

**Storage Overhead:**

- 250 turns × 768 dims × 8 bytes ≈ 1.5 MB (vectors)
- Metadata: ~500 KB
- Total: ~2 MB per 250 turns

Acceptable for long-term conversation storage.

**LanceDB Compaction:**

From `compact-lancedb.ts`:

- Problem: Delete+add patterns create version bloat (700 MB for 2 MB data)
- Solution: Keep only latest version of each turn
- Result: 99% reduction (700 MB → 2 MB)

**Future Enhancements:**

- Distributed session storage (multiple machines)
- Hierarchical compression (hot/warm/cold tiers)
- Session merging (combine related sessions)
- Expiration policies (delete old sessions after N days)

**Related Decisions:**

- ADR-001 (LanceDB) - Provides vector storage for conversation memory
- ADR-006 (Compression) - Triggers session boundaries
- ADR-010 (Workbench) - Generates embeddings for semantic search
