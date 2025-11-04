---
type: strategic
overlay: O4_Mission
---

# Chapter 21: Σ (Sigma) — Stateful AI with Infinite Context

> **The Context Problem**: Traditional AI conversations are stateless. When the context window fills, the agent forgets. When the session ends, continuity is lost.
>
> **The Sigma Solution**: Dual-lattice architecture with Meet operations enables infinite context through intelligent compression and session lifecycle management.

---

## The Fundamental Problem

Large Language Models (LLMs) operate within fixed context windows. Even with 200K token limits, conversations eventually hit a wall:

1. **Context Exhaustion**: At token limit, the agent must choose what to forget
2. **Session Termination**: When the session ends, all state is lost
3. **Shallow Compression**: Traditional summarization loses semantic richness
4. **No Continuity**: Resuming requires re-explaining everything

**The Cost**: Users lose hours of work. Agents lose hard-won understanding. Projects lose momentum.

---

## The Sigma (Σ) Architecture

Sigma solves infinite context through **dual-lattice semantic alignment**:

```
Project Lattice              Conversation Lattice
(.open_cognition/)           (.sigma/)
      ↓                             ↓
   7 Overlays  ──────∧──────  7 Overlays
   (pre-built)      Meet      (real-time)
                  Operation
                     ↓
              Alignment Score
                  (0-10)
                     ↓
            Importance Formula
                     ↓
          Intelligent Compression
```

### Core Principle

**Not all conversation turns are equally important to the project.**

- User: "I'm working on auth refactor" → **High project alignment** (O1, O4, O5)
- User: "That's great!" → **Low project alignment** (general chat)

Sigma uses **lattice Meet operations** to compute semantic alignment between conversation and project knowledge, preserving what matters and gracefully discarding noise.

---

## Dual-Lattice Architecture

### Project Lattice (Static)

**Location**: `.open_cognition/overlays/`

**Built via**: `cognition-cli genesis` (pre-computed from codebase)

**7 Project Overlays**:

- **O₁**: Structural (architecture, symbols, dependencies)
- **O₂**: Security (threats, vulnerabilities, mitigations)
- **O₃**: Lineage (history, provenance, change tracking)
- **O₄**: Mission (goals, principles, strategic alignment)
- **O₅**: Operational (workflows, quests, procedures)
- **O₆**: Mathematical (proofs, theorems, formal properties)
- **O₇**: Coherence (cross-layer synthesis, consistency)

**Purpose**: Ground truth about the codebase. Never changes during conversation.

### Conversation Lattice (Dynamic)

**Location**: `.sigma/overlays/`

**Built via**: Real-time analysis of chat turns

**7 Conversation Overlays** (mirror project structure):

- **O₁**: Architecture/design discussions
- **O₂**: Security concerns raised
- **O₃**: Knowledge evolution ("earlier we discussed...")
- **O₄**: Goals/objectives for session
- **O₅**: Commands/actions executed
- **O₆**: Algorithms/logic discussed
- **O₇**: Conversation flow, topic drift

**Purpose**: Capture project-relevant conversation. Built on-the-fly, flushed periodically (every 5 turns + on exit) and at compression.

---

## Meet Operation (∧)

The **Meet** operation computes semantic alignment between a conversation turn and project knowledge:

```typescript
// For each conversation turn
for (const overlay of ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7']) {
  // Query project overlay with turn content
  const projectOverlay = await projectRegistry.get(overlay);
  const results = await projectOverlay.query(turnContent, (topK = 3));

  // Compute alignment score (0-10)
  const maxSimilarity = Math.max(...results.map((r) => r.similarity));
  alignment[overlay] = Math.round(maxSimilarity * 10);
}

// Result: alignment_O1=8, alignment_O2=2, alignment_O3=5, ...
```

**Interpretation**:

- **alignment ≥ 6**: Highly relevant to project knowledge
- **alignment < 6**: General chat, low project relevance

---

## Importance Formula

Once we have alignment scores across all 7 overlays, we compute turn importance:

```typescript
importance = novelty × 5 + max(alignment_O1..O7) × 0.5
```

**Components**:

1. **Novelty** (0-10): How semantically different is this turn from recent history?
   - Computed via cosine distance from recent turn embeddings
   - High novelty = new topic/concept introduced

2. **Max Alignment** (0-10): Highest alignment across any overlay
   - Represents strongest project connection
   - `max(8, 2, 5, 9, 3, 1, 7) = 9`

3. **Weight Ratio**: Novelty weighted 10× higher than alignment
   - Prioritizes new information over repeated concepts
   - Even low-alignment turns preserved if highly novel

**Example Calculation**:

```
Turn: "We need to implement JWT token refresh in the auth middleware"

Novelty: 8.5 (new security pattern not discussed recently)
Alignment: O1=8, O2=9, O3=2, O4=7, O5=4, O6=3, O7=6
Max Alignment: 9

Importance = 8.5 × 5 + 9 × 0.5 = 42.5 + 4.5 = 47.0

Result: PRESERVE (high importance)
```

```
Turn: "Thanks, that makes sense!"

Novelty: 1.2 (common acknowledgment phrase)
Alignment: O1=1, O2=0, O3=1, O4=2, O5=1, O6=0, O7=3
Max Alignment: 3

Importance = 1.2 × 5 + 3 × 0.5 = 6.0 + 1.5 = 7.5

Result: DISCARD (low importance)
```

---

## Session Lifecycle

### Phase 1: Normal Operation (0-150K tokens, configurable)

**State**: Single active session, conversation lattice building in-memory

**Note**: The compression threshold is configurable via `--session-tokens`:

```bash
cognition-cli tui --session-tokens 200000  # Compress at 200K tokens
cognition-cli tui --session-tokens 100000  # Compress earlier at 100K
cognition-cli tui                          # Default: 150K tokens
```

**Operations**:

1. User sends message → Claude processes → response generated
2. Turn analyzed: embeddings generated, alignment computed
3. Turn added to conversation overlays (in-memory)
4. **Periodic flush**: Every 5 turns, overlays flushed to disk (prevents data loss)
5. Lattice grows: nodes, edges, topic shifts tracked

**Visible to user**:

```text
Overlays: O1[12] O2[3] O3[8] O4[15] O5[6] O6[2] O7[10]
Nodes: 47 | Edges: 156 | Shifts: 23
Tokens: 85.2K (42.6%) | Compress at: 150.0K
```

### Phase 2: Compression Trigger (Default: 150K tokens)

**Threshold reached**: Token count ≥ configured threshold (default 150,000)

**Compression sequence**:

1. **Flush conversation lattice to disk**

   ```typescript
   await conversationRegistry.flushAll(sessionId);
   // Writes .sigma/overlays/O1-O7/*.json
   ```

2. **Generate 7-dimensional intelligent recap**

   ```typescript
   const recap = await compressContext(conversationLattice, {
     alignmentThreshold: 6, // Preserve turns with alignment ≥ 6
     minTurns: 5, // Need at least 5 turns
     maxRecapTokens: 4000, // Target recap size
   });
   ```

3. **Build structured recap by overlay**:

   ```markdown
   ## O₁ Structural (Architecture/Design)

   - Discussed JWT token refresh implementation in auth middleware
   - Decided on sliding window approach (15min access, 7day refresh)
   - Identified AuthService.ts as main integration point

   ## O₂ Security (Threats/Mitigations)

   - Raised concern about refresh token storage (httpOnly cookies chosen)
   - Discussed CSRF protection for refresh endpoint

   ## O₄ Mission (Goals/Objectives)

   - Primary goal: Implement secure, production-ready auth system
   - Constraint: Must maintain backward compatibility with v1 API

   [... continues for O3, O5, O6, O7 ...]
   ```

4. **Keep in-memory state for continuity**

   ```typescript
   // Overlays remain in memory to continue accumulating across SDK sessions
   // This ensures seamless session resumption with --session-id
   debug('Keeping conversation overlays in memory (continue accumulating)');
   ```

### Phase 3: Session Resurrection (New Session)

**Context reconstruction**:

1. **Read persisted lattice**

   ```typescript
   const sessionState = await reconstructSessionContext(sessionId, sigmaPath);
   ```

2. **Load 7-dimensional recap** from `.sigma/{sessionId}.recap.txt`

3. **Build rich system prompt**:

   ```typescript
   const systemPrompt = `
   You are resuming a conversation about: ${projectDescription}
   
   Previous session context (compressed via lattice algebra):
   
   ${recap}
   
   The conversation lattice contains ${stats.nodes} nodes across 7 overlays.
   Key discussion areas: ${stats.topOverlays.join(', ')}
   
   Continue naturally - you have full context via this intelligent recap.
   `;
   ```

4. **Start fresh session with full continuity**
   - Agent receives structured recap (not raw transcript)
   - MCP `recall_past_conversation` tool available for deep memory
   - User experiences seamless continuation

---

## The Result

### What Gets Preserved

**High-alignment turns** (alignment ≥ 6):

- Architecture decisions
- Security discussions
- Mission-critical planning
- Technical problem-solving
- Code design rationale

**Novel information** (even if low alignment):

- New concepts introduced
- Unexpected insights
- Creative suggestions

### What Gets Discarded

**Low-alignment, low-novelty turns**:

- "That's great!"
- "Thanks!"
- "I see what you mean"
- Repeated explanations
- Off-topic chat

### Continuity Achieved

**Before Sigma**:

- User: "Remember when we discussed the auth refactor?"
- Agent: "I don't have context from previous sessions."

**After Sigma**:

- User: "Let's continue with the auth refactor"
- Agent: "Yes, we decided on JWT sliding windows with httpOnly cookies for refresh tokens. Ready to implement AuthService.ts integration?"

---

## Implementation Architecture

### Core Components

**1. Conversation Overlay Registry**

```typescript
// Central registry for O1-O7 conversation overlays
const registry = new ConversationOverlayRegistry(
  sigmaPath,      // .sigma/
  workbenchUrl,   // eGemma endpoint
  debug           // Verbose logging
);

const structural = await registry.get('O1');
await structural.addTurn({
  turn_id: 'turn-42',
  role: 'user',
  content: 'How should we implement auth?',
  timestamp: Date.now(),
  embedding: [0.23, -0.45, ...],
  project_alignment_score: 8,
  novelty: 7.2,
  importance: 40.0
});
```

**2. Turn Analyzer**

```typescript
// Computes novelty + alignment for each turn
const analysis = await analyzeTurn(
  turnContent,
  conversationHistory,
  projectRegistry,
  workbenchClient
);

// Returns: { novelty, alignment_O1..O7, importance }
```

**3. Context Compressor**

```typescript
// Generates intelligent recap from lattice
const recap = await compressContext(lattice, {
  alignmentThreshold: 6,
  minTurns: 5,
  maxRecapTokens: 4000,
});

// Returns markdown-formatted 7-dimensional summary
```

**4. Context Reconstructor**

```typescript
// Rebuilds session state from .sigma/
const context = await reconstructSessionContext(sessionId, sigmaPath);

// Returns: { recap, stats, lattice }
```

**5. MCP Recall Tool** (Enhanced with High-Fidelity Synthesis)

```typescript
// On-demand deep memory via MCP protocol
const recallTool = createRecallMcpServer(conversationRegistry, workbenchUrl);

// Agent can invoke: recall_past_conversation("auth implementation details")
```

**Recall System Improvements**:

1. **Query deconstruction** via `query_analyst` persona (SLM)
2. **Multi-overlay search** across all O1-O7 with embeddings
3. **Temporal re-ranking** - results sorted chronologically for coherence
4. **Enhanced synthesis** via `conversation_memory_assistant` persona:
   - Preserves technical details (file names, function names, decisions)
   - Maintains chronological flow
   - Includes importance/alignment metadata
   - Organizes multi-point discussions clearly
5. **Retry mechanism** - 5 retries with exponential backoff for 429 errors
6. **Increased coverage** - topK increased from 5 to 10 for better context

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User Input                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Turn Analysis (analyzeTurn)                    │
│  • Generate embedding                                       │
│  • Compute novelty vs recent history                        │
│  • Query all 7 project overlays (Meet operations)           │
│  • Compute alignment_O1..O7                                 │
│  • Calculate importance = novelty×5 + max(alignment)×0.5    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Populate Conversation Overlays (in-memory)          │
│  • O1-O7 managers.addTurn(...)                              │
│  • Build semantic graph (nodes, edges, shifts)              │
│  • Periodic flush: Every 5 turns → .sigma/overlays/         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 Claude Response                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        [Repeat until 150K tokens]
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│             Compression (at 150K threshold)                 │
│  1. Flush lattice to .sigma/overlays/                       │
│  2. Generate 7-dimensional recap                            │
│  3. Save recap to .sigma/{session}.recap.txt                │
│  4. Keep overlays in memory for continuity                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│          New Session (Context Reconstruction)               │
│  1. Load .sigma/{session}.recap.txt                         │
│  2. Build rich systemPrompt with recap                      │
│  3. Start fresh agent with full continuity                  │
│  4. MCP recall tool available for deep queries              │
└─────────────────────────────────────────────────────────────┘
```

---

## Real-Time Context Injection

### The Workflow Context Problem

During fluent conversation, Claude can lose track of workflow context when users make vague continuation requests:

```
User: [Long exploration of JIRA structure with detailed analysis]
Claude: [Comprehensive analysis with implementation recommendations]
User: "ok please implement"
Claude: "What would you like me to implement?" ❌
```

The SDK session preserves ALL messages as tokens, but treats them equally—no understanding of importance, overlay activation, or semantic relevance.

### Lattice-Based Solution

**Real-time context injection** uses the in-memory lattice to automatically enhance vague requests:

**1. Detect continuation requests** via pattern matching:

- "implement", "do it", "continue", "let's go", etc.
- Short messages (< 100 chars) with action verbs

**2. Query in-memory lattice** (no LLM, no tool calls):

- Semantic search using cosine similarity on 768-dim embeddings
- Boost by importance score (≥5) - high-value turns ranked higher
- Boost by overlay activation (O1/O4/O5 for implementation tasks)
- Filter out routine turns (importance < 5)

**3. Inject top-K relevant context** directly into user message:

```
[Recent context 1] I explained:
The JIRA structure uses bridge tables to link...

[Recent context 2] You asked:
How can I reuse this for my workbench?

---

Based on the above context:
ok please implement
```

**4. Transparent to Claude**: No tool calls, no latency, just enhanced input

### Relevance Scoring

```typescript
relevance = similarity × importanceBoost × overlayBoost

where:
  similarity = cosineSimilarity(userEmbed, turnEmbed)  // 0-1
  importanceBoost = 1 + importance_score / 10          // 1.0-2.0x
  overlayBoost = 1 + (O1 + O4 + O5) / 30              // 1.0-2.0x
```

**Example scores**:

- Routine turn (importance=3, O1=2): `0.7 × 1.3 × 1.07 = 0.97`
- Important turn (importance=8, O1=9, O5=7): `0.7 × 1.8 × 1.53 = 1.93` ✅

### When It Activates

**Automatically activates when:**

- User sends continuation request (pattern detected)
- Lattice has history (`turnAnalyses.length > 0`)
- Relevant context found (relevance score > 0.4)

**Does NOT activate when:**

- First message (no history)
- Detailed requests (> 100 chars with context already provided)
- Low relevance (no similar high-importance turns found)
- After compression (uses injected recap instead)

### Implementation

**File**: `src/sigma/context-injector.ts`

```typescript
await injectRelevantContext(userMessage, turnAnalyses, embedder, {
  debug: true, // Enable logging
  minRelevance: 0.4, // Threshold for injection (0-1)
  windowSize: 20, // Recent turns to consider
  maxContextTurns: 3, // Max snippets to inject
  maxSnippetLength: 400, // Chars per snippet
});
```

---

## Session Anchors & Alias Support

### The Session Continuity Problem

Old compression approach created chained state files with fake session IDs:

```
.sigma/
├── bf7b840e-4f78-41dc-bbb1-aab4470aedc9.state.json          (original)
├── bf7b840e-4f78-41dc-bbb1-aab4470aedc9-sigma-1762216733217.state.json  (chain 1)
└── bf7b840e-4f78-41dc-bbb1-aab4470aedc9-sigma-1762216733218.state.json  (chain 2)
```

**Problems**:

- Multiple state files for same conversation
- No clean way to resume "latest" session
- User must know exact mangled session ID
- Fake session IDs (`-sigma-timestamp`) instead of real SDK UUIDs

### Anchor-Based Architecture

**Solution**: ONE state file per conversation anchor that tracks the current SDK session UUID.

```json
{
  "anchor_id": "bf7b840e-4f78-41dc-bbb1-aab4470aedc9",
  "current_session": "actual-sdk-uuid-after-compression",
  "alias": "jira-work",
  "created_at": "2025-11-04T10:00:00.000Z",
  "last_updated": "2025-11-04T12:00:00.000Z",

  "compression_history": [
    {
      "sdk_session": "bf7b840e-4f78-41dc-bbb1-aab4470aedc9",
      "timestamp": "2025-11-04T10:00:00.000Z",
      "reason": "initial"
    },
    {
      "sdk_session": "new-sdk-uuid-123",
      "timestamp": "2025-11-04T12:00:00.000Z",
      "reason": "compression",
      "tokens": 150000
    }
  ],

  "stats": {
    "total_turns_analyzed": 72,
    "paradigm_shifts": 0,
    "avg_novelty": "0.549",
    "avg_importance": "5.3"
  }
}
```

### User Experience

```bash
# Start new session (SDK generates UUID)
cognition-cli tui
# → Creates anchor: {sdk-uuid}.state.json

# Resume with anchor ID
cognition-cli tui --session-id bf7b840e-4f78-41dc-bbb1-aab4470aedc9
# → Always loads LATEST session, even after multiple compressions

# Resume with alias
cognition-cli tui --alias jira-work
# → Resolves to anchor, loads latest session
```

### Logic Flow

**1. Starting TUI**:

```typescript
// User provides: --session-id bf7b840e-4f78-41dc-bbb1-aab4470aedc9
const state = loadSessionState(anchorId, projectRoot);

if (!state) {
  // Fresh start - SDK will create new UUID
  resumeSession = undefined;
} else {
  // Try to resume current_session
  resumeSession = state.current_session;
}

query({ resume: resumeSession, ... });

// SDK returns real UUID in first message
// Update state if SDK gave us new ID (expiration/compression)
```

**2. Compression Happens**:

```typescript
// SDK creates NEW session (we set resume: undefined)
// On first message of NEW session, SDK gives us new UUID

// Update the SAME state file
const updatedState = updateSessionState(
  currentState,
  newSdkSessionId,
  'compression',
  tokenCount.total
);
saveSessionState(updatedState, projectRoot);

// Now current_session points to new SDK UUID
// Anchor ID stays the same!
```

**3. Next Resume**:

```typescript
// User again: --session-id bf7b840e-4f78-41dc-bbb1-aab4470aedc9
const state = loadSessionState(anchorId, projectRoot);
// state.current_session = "new-sdk-uuid-123" (after compression)

query({ resume: "new-sdk-uuid-123", ... });
// If expired, SDK gives ANOTHER new UUID → update state again
```

### Alias Support

**Set alias for a session**:

```typescript
setSessionAlias(anchorId, 'jira-work', projectRoot);
```

**Resolve alias to anchor**:

```typescript
const anchorId = resolveAlias('jira-work', projectRoot);
// Returns anchor ID or throws if multiple sessions share alias
```

**Collision detection**:

```bash
cognition-cli tui --alias jira-work

# If multiple sessions have "jira-work":
❌ Multiple sessions found with alias "jira-work": uuid-1, uuid-2
   Please use --session-id with the specific anchor ID instead.
```

### Benefits

✅ **Single source of truth** - ONE file per conversation
✅ **Always up-to-date** - `current_session` reflects latest SDK session
✅ **User-friendly** - Same anchor ID works forever
✅ **Audit trail** - `compression_history` tracks all SDK sessions
✅ **Alias support** - Human-readable names with collision detection
✅ **Handles expiration** - SDK gives new UUID, we update state
✅ **Handles compression** - SDK gives new UUID, we update state

### Implementation

**Files**:

- `src/sigma/session-state.ts` - Anchor management, alias resolution, migration
- `src/tui/hooks/useClaudeAgent.ts` - Integrated anchor system
- `src/commands/tui.ts` - Added `--alias` flag
- `src/cli.ts` - Updated TUI command options

---

## Lattice Reconstruction from LanceDB

### The Resume Problem

Before compression (< 150K tokens), no `.lattice.json` exists. When resuming a session, the in-memory `turnAnalyses` array was empty, breaking context injection and overlay tracking.

### Solution: LanceDB as Source of Truth

**LanceDB contains ALL turn data** (flushed every 5 turns):

- Full turn content
- 768-dim embeddings
- Importance scores
- Novelty values
- Overlay alignment (O1-O7)
- Paradigm shift flags

**Reconstruction process**:

```typescript
// Rebuild from LanceDB when no lattice file exists
const rebuiltAnalyses = await rebuildTurnAnalysesFromLanceDB(
  sessionId,
  projectRoot
);

// Result: Full turnAnalyses array with all metadata
turnAnalyses.current = rebuiltAnalyses;
```

### Data Flow

```typescript
// 1. Query LanceDB for all turns in session
const turns = await lanceStore.getSessionTurns(sessionId, 'asc');

// 2. Convert to TurnAnalysis format
const analyses: TurnAnalysis[] = turns.map((turn) => ({
  turn_id: turn.id,
  role: turn.role,
  content: turn.content,
  timestamp: turn.timestamp,
  embedding: turn.embedding,
  novelty: turn.novelty,
  importance_score: turn.importance,
  is_paradigm_shift: turn.is_paradigm_shift,
  overlay_scores: {
    O1_structural: turn.alignment_O1,
    O2_security: turn.alignment_O2,
    O3_lineage: turn.alignment_O3,
    O4_mission: turn.alignment_O4,
    O5_operational: turn.alignment_O5,
    O6_mathematical: turn.alignment_O6,
    O7_strategic: turn.alignment_O7,
  },
  references: turn.references || [],
  semantic_tags: turn.semantic_tags || [],
}));
```

### Full Lattice Reconstruction

```typescript
// Build complete lattice with temporal edges
const lattice = await rebuildLatticeFromLanceDB(sessionId, projectRoot);

// Result: { nodes, edges, metadata }
// - nodes: All conversation turns with full metadata
// - edges: Temporal connections (turn N → turn N+1)
// - metadata: Session info, turn counts, compression ratio
```

### When It's Used

**Automatic fallback** in `loadAnchorSession`:

```typescript
if (fs.existsSync(latticePath)) {
  // Load existing lattice.json (post-compression)
  const lattice = JSON.parse(fs.readFileSync(latticePath));
  turnAnalyses.current = lattice.nodes;
} else {
  // No lattice yet - rebuild from LanceDB
  const rebuiltAnalyses = await rebuildTurnAnalysesFromLanceDB(
    sessionId,
    projectRoot
  );
  turnAnalyses.current = rebuiltAnalyses;
}
```

### Benefits

✅ **Seamless resume** - Works before compression threshold
✅ **Full metadata** - All importance scores, embeddings preserved
✅ **Context injection ready** - Enables real-time context injection on resume
✅ **Transparent** - Automatic fallback, no user action needed
✅ **LanceDB as source** - Single source of truth for embeddings

### Implementation

**File**: `src/sigma/lattice-reconstructor.ts`

```typescript
// Rebuild turnAnalyses only
await rebuildTurnAnalysesFromLanceDB(sessionId, projectRoot);

// Rebuild full lattice structure
await rebuildLatticeFromLanceDB(sessionId, projectRoot);
```

---

## Automatic Migration

### Old State Format Detection

When loading an existing session, Sigma automatically detects old state format:

```typescript
// Old format has newSessionId, lacks compression_history
if (sessionState && !('compression_history' in sessionState)) {
  sessionState = migrateOldStateFile(anchorId, options.cwd);
}
```

### Migration Process

**1. Follow compression chain**:

```typescript
// Start: bf7b840e-4f78-41dc-bbb1-aab4470aedc9.state.json
// → reads newSessionId: "bf7b840e-4f78-41dc-bbb1-aab4470aedc9-sigma-1762216733217"
//
// Load: bf7b840e-4f78-41dc-bbb1-aab4470aedc9-sigma-1762216733217.state.json
// → reads newSessionId: undefined (leaf node)
```

**2. Build compression_history array**:

```typescript
compression_history: [
  {
    sdk_session: 'bf7b840e-4f78-41dc-bbb1-aab4470aedc9',
    timestamp: '2025-11-04T00:38:53.217Z',
    reason: 'initial',
  },
  {
    sdk_session: 'bf7b840e-4f78-41dc-bbb1-aab4470aedc9-sigma-1762216733217',
    timestamp: '2025-11-04T00:38:53.217Z',
    reason: 'compression',
    tokens: 126430,
  },
];
```

**3. Delete old chained files**:

```bash
🔄 Migrating old state file: bf7b840e-4f78-41dc-bbb1-aab4470aedc9
  🗑️  Removed old chained file: bf7b840e-4f78-41dc-bbb1-aab4470aedc9-sigma-1762216733217.state.json
  ✅ Migrated to new format (2 sessions)
```

**4. Preserve stats**:

```typescript
stats: oldState.turnAnalysis
  ? {
      total_turns_analyzed: oldState.turnAnalysis.total_turns_analyzed,
      paradigm_shifts: oldState.turnAnalysis.paradigm_shifts,
      routine_turns: oldState.turnAnalysis.routine_turns,
      avg_novelty: oldState.turnAnalysis.avg_novelty,
      avg_importance: oldState.turnAnalysis.avg_importance,
    }
  : undefined;
```

### User Experience

**Transparent migration** - happens automatically on first load:

```bash
cognition-cli tui --session-id bf7b840e-4f78-41dc-bbb1-aab4470aedc9

🔄 Migrating old state file: bf7b840e-4f78-41dc-bbb1-aab4470aedc9
  🗑️  Removed old chained file: bf7b840e-4f78-41dc-bbb1-aab4470aedc9-sigma-1762216733217.state.json
  ✅ Migrated to new format (2 sessions)

🔄 Resuming: bf7b840e-4f78-41dc-bbb1-aab4470aedc9 (2 sessions)
```

### Implementation

**File**: `src/sigma/session-state.ts`

```typescript
// Migrate single session
migrateOldStateFile(anchorId, projectRoot);

// Batch migrate all sessions
migrateAllOldStates(projectRoot);
```

---

## Technical Specifications

### Storage Structure

```
.sigma/
├── overlays/
│   ├── O1-conversation-structural/
│   │   └── {sessionId}.json        # Structural discussions
│   ├── O2-conversation-security/
│   │   └── {sessionId}.json        # Security concerns
│   ├── O3-conversation-lineage/
│   │   └── {sessionId}.json        # Knowledge evolution
│   ├── O4-conversation-mission/
│   │   └── {sessionId}.json        # Goals/objectives
│   ├── O5-conversation-operational/
│   │   └── {sessionId}.json        # Commands executed
│   ├── O6-conversation-mathematical/
│   │   └── {sessionId}.json        # Algorithms discussed
│   └── O7-conversation-coherence/
│       └── {sessionId}.json        # Conversation flow
├── {sessionId}.recap.txt           # 7-dimensional intelligent recap
├── {sessionId}.lattice.json        # Full lattice snapshot
└── {sessionId}.state.json          # Session metadata
```

### Overlay JSON Format

```json
{
  "overlay_id": "O1",
  "overlay_name": "Conversation Structural",
  "session_id": "tui-1762110970306",
  "turns": [
    {
      "turn_id": "turn-42",
      "role": "user",
      "content": "How should we implement JWT auth?",
      "timestamp": 1730588450123,
      "embedding": [0.23, -0.45, 0.67, ...],
      "project_alignment_score": 8,
      "novelty": 7.2,
      "importance": 40.0,
      "metadata": {
        "alignment_O1": 8,
        "alignment_O2": 9,
        "alignment_O3": 2,
        "alignment_O4": 7,
        "alignment_O5": 4,
        "alignment_O6": 3,
        "alignment_O7": 6
      }
    }
  ],
  "statistics": {
    "total_turns": 47,
    "high_importance_turns": 23,
    "avg_alignment": 6.2,
    "topic_shifts": 8
  }
}
```

---

## Performance Characteristics

### Memory Usage

**In-memory lattice** (per session):

- ~5-10MB for 100 turns
- ~50-100MB for 1000 turns (at 150K tokens)
- Flushed to disk at compression threshold

**Disk usage** (per session):

- Overlay JSONs: ~10-20MB (compressed)
- Recap file: ~10-20KB (markdown)
- Lattice snapshot: ~50-100MB (full graph)

### Computational Cost

**Per turn** (real-time):

- Embedding generation: ~50-100ms (eGemma)
- 7 overlay queries: ~200-400ms (vector similarity)
- Alignment calculation: ~10ms (pure math)
- **Total: ~300-500ms overhead per turn**

**At compression** (150K tokens):

- Lattice flush: ~1-2s (write to disk)
- Recap generation: ~5-10s (LLM summarization)
- State cleanup: ~100ms
- **Total: ~7-12s compression time**

**Session resurrection**:

- Recap loading: ~100ms (read file)
- System prompt construction: ~50ms
- **Total: ~150ms startup overhead**

---

## Comparison to Alternatives

### vs. Managed Memory Services

| Feature          | Sigma (Σ)                               | Cloud-based Memory        |
| ---------------- | --------------------------------------- | ------------------------- |
| **Architecture** | Dual-lattice Meet operations            | RAG-based retrieval       |
| **Alignment**    | 7-dimensional semantic scoring          | Single similarity score   |
| **Preservation** | Mathematically grounded (alignment ≥ 6) | Heuristic-based selection |
| **Compression**  | Intelligent 7D recap                    | Black-box summarization   |
| **Transparency** | Full lattice visible (.sigma/)          | Opaque internal state     |
| **Ownership**    | Local, open source                      | Cloud-hosted, proprietary |
| **Cost**         | Free (local eGemma)                     | Usage-based pricing       |

### vs. Traditional RAG

| Feature        | Sigma (Σ)                    | Traditional RAG          |
| -------------- | ---------------------------- | ------------------------ |
| **Indexing**   | Real-time lattice building   | Batch document chunking  |
| **Retrieval**  | Meet operations (∧)          | Cosine similarity search |
| **Context**    | 7 cognitive dimensions       | Single embedding space   |
| **Continuity** | Session lifecycle with recap | No session concept       |
| **Alignment**  | Project-aware (dual-lattice) | Query-only relevance     |

### vs. Long Context Windows

| Feature             | Sigma (Σ)                           | 200K Context Window          |
| ------------------- | ----------------------------------- | ---------------------------- |
| **Effective Limit** | Infinite (via compression)          | 200K tokens (hard limit)     |
| **Cost**            | O(1) per turn (local)               | O(n²) attention (cloud)      |
| **Quality**         | Preserves important, discards noise | Everything preserved equally |
| **Continuity**      | Across sessions                     | Single session only          |
| **Transparency**    | Visible preservation logic          | Opaque attention mechanism   |

---

## Use Cases

### 1. Long-Running Development Sessions

**Scenario**: Multi-day implementation of complex feature

**Without Sigma**:

- Daily context loss
- Repeated explanations
- Lost architectural decisions
- Momentum breaks

**With Sigma**:

- Seamless daily continuation
- Agent remembers design decisions
- Architecture stays coherent
- Weeks of productive collaboration

### 2. Codebase Exploration

**Scenario**: Understanding large, unfamiliar codebase

**Without Sigma**:

- Agent forgets previous file discussions
- Repeated questions about same modules
- No accumulation of understanding

**With Sigma**:

- Conversation lattice builds codebase mental model
- Agent recalls "we looked at AuthService.ts earlier"
- Understanding compounds over sessions

### 3. Pair Programming

**Scenario**: Collaborative development over hours

**Without Sigma**:

- Context limit forces session restart mid-task
- Loss of debugging history
- Repeated setup explanations

**With Sigma**:

- Continuous flow through 150K+ tokens
- Full debugging history preserved
- Natural multi-hour sessions

### 4. Research & Prototyping

**Scenario**: Exploring multiple solution approaches

**Without Sigma**:

- Agent forgets earlier experiments
- No memory of rejected approaches
- Circular discussions

**With Sigma**:

- O3 (Lineage) tracks exploration history
- Agent: "We tried approach A, failed due to X"
- Systematic narrowing of solution space

---

## Future Directions

### Adaptive Compression Thresholds

Current: ✅ **User-configurable threshold via `--session-tokens` CLI parameter** (default: 150K)

Future: Dynamic adjustment based on:

- Conversation complexity (high novelty → delay compression)
- Overlay balance (uneven O1-O7 → compress earlier)
- Automatic learning from user patterns

### Cross-Session Knowledge Transfer

Current: Each session independent

Future: Meet operations across sessions:

- "Find all discussions about auth across last 10 sessions"
- Build meta-lattice of session lattices
- Long-term project memory

### Collaborative Memory

Current: Single-user session memory

Future: Multi-user shared lattice:

- Team conversation overlays
- Consensus-weighted importance
- Merge conflicts in knowledge graph

### Federated Lattices

Current: Local .sigma/ storage

Future: Distributed lattice synchronization:

- P2P lattice sharing
- Content-addressed overlay deduplication
- Privacy-preserving Meet operations

---

## Conclusion

Sigma (Σ) demonstrates that **infinite context is achievable through lattice algebra**. By treating conversation as a dynamic lattice aligned with project knowledge, we achieve:

1. **Mathematical Rigor**: Meet operations, not heuristics
2. **Semantic Precision**: 7-dimensional alignment scoring
3. **Practical Performance**: 300-500ms per-turn overhead
4. **Full Transparency**: Visible .sigma/ lattice structure
5. **True Continuity**: Sessions resume with structured recap

The symmetric machine provides perfect memory.
The asymmetric human provides creative projection.

**Together: infinite possibilities.**

---

## References

### Implementation Files

**Core Sigma**:

- `src/sigma/conversation-registry.ts` - Conversation overlay registry
- `src/sigma/analyzer-with-embeddings.ts` - Turn analysis and alignment scoring
- `src/sigma/compressor.ts` - Context compression logic
- `src/sigma/context-reconstructor.ts` - Session resurrection
- `src/sigma/recall-tool.ts` - MCP memory tool

**Real-Time Context Injection** (NEW):

- `src/sigma/context-injector.ts` - Semantic search and context enhancement
- `src/sigma/README-context-injection.md` - Implementation guide

**Session Management** (NEW):

- `src/sigma/session-state.ts` - Anchor management, alias resolution, migration
- `src/sigma/lattice-reconstructor.ts` - LanceDB reconstruction

**Integration**:

- `src/tui/hooks/useClaudeAgent.ts` - TUI integration with Sigma
- `src/tui/README.md` - TUI implementation documentation

See the [GitHub repository](https://github.com/mirzahusadzic/cogx) for full source code.

---

**Status**: ✅ Complete (Implemented & Production-Tested)
**Version**: 2.0
**Last Updated**: November 4, 2025
