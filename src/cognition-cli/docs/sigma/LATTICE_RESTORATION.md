# Sigma Lattice Restoration

This document describes what data is preserved when a Sigma conversation lattice is saved to disk and restored in a later TUI session.

## Overview

When you use `cognition-cli tui --session-id <session-id>`, the TUI will:

1. ✅ Restore the conversation lattice from `.sigma/{sessionId}.lattice.json`
2. ✅ Rebuild turn analyses from lattice nodes
3. ✅ Load conversation overlays on-demand from `.sigma/overlays/`
4. ✅ Display restoration status in the UI

## What's Preserved in the Lattice

The lattice is stored as a JSON file in `.sigma/{sessionId}.lattice.json` and contains:

### 1. Nodes (ConversationNode[])

Each node represents a conversation turn and preserves:

| Field               | Type                                | Description                     | Example                        |
| ------------------- | ----------------------------------- | ------------------------------- | ------------------------------ |
| `id`                | `string`                            | Unique node identifier          | `"turn-1704067200000"`         |
| `type`              | `"conversation_turn"`               | Node type (always this value)   | `"conversation_turn"`          |
| `turn_id`           | `string`                            | Turn identifier (same as `id`)  | `"turn-1704067200000"`         |
| `role`              | `"user" \| "assistant" \| "system"` | Who sent this message           | `"user"`                       |
| `content`           | `string`                            | The actual message text         | `"How do I implement...?"`     |
| `timestamp`         | `number`                            | Unix timestamp in milliseconds  | `1704067200000`                |
| `embedding`         | `number[]`                          | 768-dimensional semantic vector | `[0.123, -0.456, ...]`         |
| `novelty`           | `number`                            | Novelty score (0-1)             | `0.85`                         |
| `importance_score`  | `number`                            | Importance rating (1-10)        | `8`                            |
| `is_paradigm_shift` | `boolean`                           | High-impact moment flag         | `true`                         |
| `semantic_tags`     | `string[]`                          | Keywords for retrieval          | `["binary-tree", "algorithm"]` |
| `overlay_scores`    | `OverlayScores`                     | Activation for all 7 overlays   | See below                      |

#### Overlay Scores Structure

```typescript
{
  O1_structural: 8,      // Architecture/design (0-10)
  O2_security: 0,        // Security concerns (0-10)
  O3_lineage: 0,         // Cross-references (0-10)
  O4_mission: 5,         // Goals/objectives (0-10)
  O5_operational: 2,     // Commands/actions (0-10)
  O6_mathematical: 9,    // Algorithms/logic (0-10)
  O7_strategic: 3        // Validation/testing (0-10)
}
```

### 2. Edges (ConversationEdge[])

Each edge represents a relationship between turns:

| Field    | Type       | Description                    | Example                |
| -------- | ---------- | ------------------------------ | ---------------------- |
| `from`   | `string`   | Source turn ID                 | `"turn-1704067200000"` |
| `to`     | `string`   | Target turn ID                 | `"turn-1704067300000"` |
| `type`   | `EdgeType` | Relationship type              | `"temporal"`           |
| `weight` | `number`   | Strength of relationship (0-1) | `0.8`                  |

#### Edge Types

- **`temporal`**: Sequential conversation flow (A→B happened right after)
- **`semantic_similarity`**: Thematically related (A and B discuss similar topics)
- **`conversation_reference`**: Explicit reference (B mentions something from A)

### 3. Metadata

Session-level metadata:

```typescript
{
  session_id: "tui-1704067200000",
  created_at: 1704067500000,
  original_turn_count: 25,      // Turns before compression
  compressed_turn_count: 9,     // Turns after compression
  compression_ratio: 2.8        // How much was compressed
}
```

## What's NOT Preserved in Nodes

When rebuilding `TurnAnalysis` from lattice nodes, some fields are reconstructed or lost:

| Field        | Status               | Notes                                                               |
| ------------ | -------------------- | ------------------------------------------------------------------- |
| `references` | ❌ **Lost**          | Turn-to-turn references are not stored in nodes. Use edges instead. |
| `is_routine` | ⚠️ **Reconstructed** | Calculated from `importance_score < 3`                              |

## Restoration Process

### In `useClaudeAgent.ts` (lines 720-800)

```typescript
// 1. Check if lattice exists
const latticePath = path.join('.sigma', `${sessionId}.lattice.json`);
if (fs.existsSync(latticePath)) {
  // 2. Load and parse lattice
  const restoredLattice = JSON.parse(fs.readFileSync(latticePath, 'utf-8'));

  // 3. Restore lattice state
  setConversationLattice(restoredLattice);

  // 4. Rebuild turn analyses from nodes
  const restoredAnalyses = restoredLattice.nodes.map((node) => ({
    turn_id: node.id,
    role: node.role,
    content: node.content,
    timestamp: node.timestamp,
    embedding: node.embedding || [],
    novelty: node.novelty || 0,
    importance_score: node.importance_score || 0,
    is_paradigm_shift: node.is_paradigm_shift || false,
    is_routine: (node.importance_score || 0) < 3, // Reconstructed
    overlay_scores: node.overlay_scores,
    references: [], // Not preserved - start empty
    semantic_tags: node.semantic_tags || [],
  }));

  turnAnalyses.current = restoredAnalyses;

  // 5. Display restoration message
  setMessages((prev) => [
    ...prev,
    {
      type: 'system',
      content: `🕸️  Resumed session with ${nodes.length} nodes, ${edges.length} edges`,
      timestamp: new Date(),
    },
  ]);
}
```

## Conversation Overlays

Conversation overlays are stored separately in `.sigma/overlays/{overlay-name}/{sessionId}.yaml`:

```yaml
# .sigma/overlays/conversation-structural/tui-1704067200000.yaml
session_id: tui-1704067200000
turns:
  - turn_id: turn-1704067200000
    role: user
    content: 'How do I implement a binary search tree?'
    timestamp: 1704067200000
    embedding: [0.123, -0.456, ...]
    project_alignment_score: 0.85
    novelty: 0.85
    importance: 8
generated_at: '2024-01-01T00:05:00.000Z'
```

### Overlay Restoration

Overlays are **loaded on-demand** from disk via `BaseConversationManager.getAllItems()`:

1. When you call `conversationRegistry.get('O1')`, it returns a manager
2. The manager's `getAllItems()` method:
   - Reads all `.yaml` files from `.sigma/overlays/conversation-structural/`
   - Loads persisted turns from disk
   - Merges with in-memory turns (new session)
   - Returns combined result

**No explicit restoration needed** - the overlay managers handle disk loading automatically!

### Periodic Persistence

Overlays are automatically flushed to disk in two scenarios:

1. **Periodic flush**: Every 5 turns (see `useClaudeAgent.ts:248-263`)
   - Ensures data is saved regularly, not just during compression
   - Prevents data loss in short sessions or early exits

2. **Cleanup flush**: On component unmount (see `useClaudeAgent.ts:818-833`)
   - Final flush when TUI exits or session changes
   - Guarantees all conversation data is saved

This means conversation overlays are always available for memory recall, even if compression hasn't triggered yet.

## Memory Recall

The conversation overlays enable semantic memory recall via the `mcp__conversation-memory__recall_past_conversation` tool:

```typescript
// Example query
tool.use({
  query: "What did we discuss about TUI scrolling?"
});
```

The recall system:
1. **Query deconstruction** - SLM analyzes the query intent
2. **Multi-overlay search** - Searches all 7 overlays (O1-O7) with embeddings
3. **Temporal re-ranking** - Results sorted chronologically for coherence
4. **Context synthesis** - LLM synthesizes answer with metadata (importance, alignment, overlay types)

The `conversation_memory_assistant` persona ensures high-fidelity recall that preserves:
- Technical details (file names, function names, decisions)
- Chronological flow
- Importance and alignment scores
- Clear organization of multi-point discussions

## Example Usage

```bash
# Start a session, work until compression happens
cognition-cli tui
# ... conversation continues ...
# ... compression triggered at 150K tokens ...
# Files saved:
#   .sigma/tui-1704067200000.lattice.json
#   .sigma/tui-1704067200000.recap.txt
#   .sigma/overlays/conversation-structural/tui-1704067200000.yaml
#   ... (6 more overlay files)

# Resume the original session (before compression)
cognition-cli tui --session-id tui-1704067200000

# ✅ Lattice restored with all nodes and edges
# ✅ Turn analyses rebuilt from lattice
# ✅ Overlays loaded on-demand from disk
# ✅ Sigma stats show correct counts
# ✅ Conversation continues seamlessly
```

## Testing

See `src/sigma/lattice-restoration.test.ts` for comprehensive tests that verify:

- ✅ Complete lattice save/restore with all metadata
- ✅ Correct rebuilding of `TurnAnalysis` from nodes
- ✅ Paradigm shift turns are preserved correctly
- ✅ Multiple edge types (temporal, semantic, reference) are preserved
- ✅ Embeddings (768-dimensional vectors) are intact
- ✅ Overlay scores for all 7 overlays are preserved

Run tests with:

```bash
npm test -- lattice-restoration
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ TUI Session with --session-id                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ useClaudeAgent.ts: loadSessionState()                       │
│                                                             │
│  1. Load tokens from transcript.jsonl                       │
│  2. Restore lattice from .sigma/{id}.lattice.json    ◄──────┼─── ConversationLattice
│  3. Rebuild turnAnalyses from nodes                         │     - nodes[]
│  4. Overlays load on-demand (automatic)                     │     - edges[]
│                                                             │     - metadata
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Restored State                                              │
│                                                             │
│  • conversationLattice: Full graph structure                │
│  • turnAnalyses.current: Array of TurnAnalysis              │
│  • Sigma stats: Nodes, edges, paradigm shifts               │
│  • UI message: "🕸️  Resumed with X nodes, Y edges"          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Conversation Continues                                      │
│                                                             │
│  • New turns are analyzed                                   │
│  • Lattice continues growing                                │
│  • Overlays accumulate in memory + on disk                  │
│  • Next compression uses restored + new data                │
└─────────────────────────────────────────────────────────────┘
```

## Key Insights

1. **Embeddings are expensive** - Preserving the 768-dimensional vectors means you don't need to re-embed turns on restore
2. **Graph structure is living** - Edges capture relationships that go beyond linear conversation flow
3. **Overlay scores enable project alignment** - Each turn's O1-O7 scores show which aspects of the project were discussed
4. **References are edges, not fields** - Instead of storing `references: string[]` in nodes, we use edges of type `conversation_reference`
5. **Memory persistence across SDK sessions** - Overlays stay in memory even when SDK session is restarted, ensuring continuity
