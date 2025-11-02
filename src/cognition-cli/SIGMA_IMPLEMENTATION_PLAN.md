# Context Sampling Sigma: Production Implementation Plan

## Executive Summary

Build Context Sampling Sigma as a **generalizable context management system**
integrated into cognition-cli that works on ANY conversation/knowledge domain,
not just the Gemini painters demo. This is production infrastructure, not a
proof-of-concept.

---

## Core Objective

**Enable cognition-cli to compress ANY context 30-50x while preserving creative
breakthroughs**, using the existing overlay + lattice infrastructure.

### What Success Looks Like

```bash
# User has a 200K token conversation approaching limit
cognition-cli tui --session-id abc123

# Sigma automatically:
1. Detects context approaching limit (180K tokens)
2. Analyzes conversation shape (which overlays are active)
3. Compresses to lattice (preserves paradigm shifts, compresses routine)
4. Continues conversation seamlessly (user sees no interruption)
5. Reconstructs context on-demand (query triggers graph traversal)
```

**User experience**: Infinite context feel, zero manual intervention.

---

## Part 1: System Architecture

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Cognition CLI + TUI                      │
│  (existing: overlays O1-O7, lattice, Claude Agent SDK)      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               Context Sampling Sigma (new)                  │
│                                                             │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │   Analyzer     │→ │  Compressor  │→ │ Reconstructor  │   │
│  │ (detect shape) │  │ (to lattice) │  │ (from lattice) │   │
│  └────────────────┘  └──────────────┘  └────────────────┘   │
│           │                  │                   │          │
│           ▼                  ▼                   ▼          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Lattice Storage (extended)                 │   │
│  │  - Conversation nodes (user/assistant turns)         │   │
│  │  - Overlay activation (which O1-O7 per turn)         │   │
│  │  - Importance weights (paradigm shifts = high)       │   │
│  │  - Semantic edges (relationships between turns)      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
Conversation Turn
    ↓
1. Analyzer: Classify turn
   - Which overlays active? (O1-O7)
   - Importance score (1-10)
   - Relationships to previous turns
    ↓
2. Store in lattice as node
   - Node: {turn_id, content, overlay_activation, importance}
   - Edges: Links to related turns
    ↓
3. Check token budget
   - If < 150K: Continue normally
   - If >= 150K: Trigger compression
    ↓
4. Compressor (if triggered)
   - Sort nodes by importance
   - Keep high-importance (paradigm shifts) verbatim
   - Compress medium-importance (semantic summary)
   - Discard low-importance (routine acknowledgments)
    ↓
5. Reconstructor (on next query)
   - Analyze query: Which overlays needed?
   - Traverse lattice: Find relevant nodes
   - Reconstruct context: Build prompt from graph
   - Send to Claude: Appears seamless to user
```

---

## Part 2: Implementation Components

### 2.1 Analyzer Module

**Purpose**: Classify each conversation turn by importance and overlay activation

```typescript
// src/sigma/analyzer.ts

interface TurnAnalysis {
  turn_id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: number;

  // Overlay activation (0-10 per overlay)
  overlay_scores: {
    O1_structural: number;
    O2_security: number;
    O3_lineage: number;
    O4_mission: number;
    O5_operational: number;
    O6_mathematical: number;
    O7_strategic: number;
  };

  // Importance metrics
  importance_score: number; // 1-10 overall
  is_paradigm_shift: boolean; // High I.P.S. moment
  is_routine: boolean; // Low importance

  // Relationships
  references: string[]; // Turn IDs this relates to
  semantic_tags: string[]; // Keywords for retrieval
}

async function analyzeTurn(
  turn: ConversationTurn,
  context: ConversationContext
): Promise<TurnAnalysis> {
  // 1. Detect overlay activation
  const overlayScores = await detectOverlayActivation(turn, context);

  // 2. Calculate importance
  const importance = calculateImportance(turn, overlayScores);

  // 3. Detect paradigm shifts
  const isParadigmShift = detectParadigmShift(turn, context);

  // 4. Find relationships
  const references = findReferences(turn, context);

  // 5. Extract semantic tags
  const tags = extractSemanticTags(turn);

  return {
    turn_id: turn.id,
    content: turn.content,
    role: turn.role,
    timestamp: Date.now(),
    overlay_scores: overlayScores,
    importance_score: importance,
    is_paradigm_shift: isParadigmShift,
    is_routine: importance < 3,
    references,
    semantic_tags: tags,
  };
}
```

**How it works**:

1. **Overlay detection**: Use keyword matching + existing overlay registry
2. **Importance scoring**: Weight by novelty, user engagement, result quality
3. **Paradigm shift detection**: Large topic changes, "eureka" moments, architectural decisions
4. **Reference finding**: Mentions of previous turns, code references
5. **Semantic tagging**: Extract entities, concepts, commands

### 2.2 Compressor Module

**Purpose**: Convert conversation history to compact lattice representation

```typescript
// src/sigma/compressor.ts

interface CompressionResult {
  original_size: number; // Tokens before
  compressed_size: number; // Tokens after
  compression_ratio: number; // original / compressed

  lattice: ConversationLattice; // Graph representation

  preserved_turns: string[]; // High-importance kept verbatim
  summarized_turns: string[]; // Medium-importance compressed
  discarded_turns: string[]; // Low-importance removed
}

async function compressContext(
  turns: TurnAnalysis[],
  targetSize: number = 40000 // Target ~40K tokens (20% of 200K)
): Promise<CompressionResult> {
  // 1. Sort turns by importance
  const sorted = turns.sort((a, b) => b.importance_score - a.importance_score);

  // 2. Allocate token budget
  let budget = targetSize;
  const preserved: string[] = [];
  const summarized: string[] = [];
  const discarded: string[] = [];

  for (const turn of sorted) {
    const turnSize = estimateTokens(turn.content);

    // Always preserve paradigm shifts
    if (turn.is_paradigm_shift) {
      preserved.push(turn.turn_id);
      budget -= turnSize;
      continue;
    }

    // Discard routine turns
    if (turn.is_routine) {
      discarded.push(turn.turn_id);
      continue;
    }

    // Compress medium-importance
    if (budget > turnSize * 0.3) {
      summarized.push(turn.turn_id);
      budget -= turnSize * 0.3; // Assume 70% compression
    } else {
      discarded.push(turn.turn_id);
    }
  }

  // 3. Build lattice
  const lattice = buildConversationLattice(turns, {
    preserved,
    summarized,
    discarded,
  });

  return {
    original_size: turns.reduce((sum, t) => sum + estimateTokens(t.content), 0),
    compressed_size: targetSize - budget,
    compression_ratio: 0, // Calculate after
    lattice,
    preserved_turns: preserved,
    summarized_turns: summarized,
    discarded_turns: discarded,
  };
}
```

**How it works**:

1. **Sort by importance**: High → Medium → Low
2. **Preserve paradigm shifts**: Keep verbatim (no loss)
3. **Compress medium**: Use LLM to summarize (70% reduction)
4. **Discard routine**: Remove acknowledgments, repetitive content
5. **Build lattice**: Store as graph with edges for relationships

### 2.3 Reconstructor Module

**Purpose**: Rebuild context from lattice for Claude queries

```typescript
// src/sigma/reconstructor.ts

interface ReconstructedContext {
  prompt: string; // Context for Claude
  turns_included: string[]; // Which turns used
  token_count: number; // Size of reconstructed context
  relevance_score: number; // How relevant to query (0-1)
}

async function reconstructContext(
  query: string,
  lattice: ConversationLattice,
  tokenBudget: number = 40000
): Promise<ReconstructedContext> {
  // 1. Analyze query to detect required overlays
  const queryOverlays = await analyzeQuery(query);

  // 2. Find relevant nodes via graph traversal
  const relevantNodes = lattice.findNodesByOverlay(queryOverlays, {
    maxNodes: 50,
    sortBy: 'importance',
  });

  // 3. Expand to include referenced turns
  const expandedNodes = expandWithReferences(relevantNodes, lattice);

  // 4. Sort by importance and chronology
  const sorted = sortForReconstruction(expandedNodes);

  // 5. Build prompt within budget
  let budget = tokenBudget;
  const included: string[] = [];
  const promptParts: string[] = [];

  for (const node of sorted) {
    const nodeSize = estimateTokens(node.content);

    if (budget >= nodeSize) {
      included.push(node.turn_id);
      promptParts.push(formatTurn(node));
      budget -= nodeSize;
    }
  }

  return {
    prompt: promptParts.join('\n\n'),
    turns_included: included,
    token_count: tokenBudget - budget,
    relevance_score: calculateRelevance(included, query),
  };
}
```

**How it works**:

1. **Query analysis**: Detect which overlays the query needs
2. **Graph traversal**: Find turns matching those overlays
3. **Expansion**: Include referenced turns (maintain coherence)
4. **Prioritization**: Sort by importance + chronological order
5. **Budget allocation**: Fit within token limit

---

## Part 3: Integration with Existing Cognition-CLI

### 3.1 Hook into TUI Session

**Modify**: `src/tui/hooks/useClaudeAgent.ts`

```typescript
// Add Sigma integration
import { analyzeTurn, compressContext, reconstructContext } from '@/sigma';

export function useClaudeAgent(options: AgentOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [lattice, setLattice] = useState<ConversationLattice | null>(null);
  const [tokenCount, setTokenCount] = useState({ total: 0 });

  // Sigma: Analyze each turn
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    analyzeTurn(lastMessage, { history: messages }).then((analysis) => {
      // Store in lattice
      addToLattice(analysis);
    });
  }, [messages]);

  // Sigma: Compress when approaching limit
  useEffect(() => {
    if (tokenCount.total > 180000 && !lattice) {
      console.log('Sigma: Compressing context...');

      compressContext(messages).then((result) => {
        setLattice(result.lattice);
        console.log(
          `Compressed ${result.original_size} → ${result.compressed_size} tokens`
        );
      });
    }
  }, [tokenCount]);

  // Sigma: Reconstruct context for queries
  const sendMessage = async (content: string) => {
    let contextPrompt = '';

    if (lattice) {
      // Reconstruct from lattice
      const reconstructed = await reconstructContext(content, lattice);
      contextPrompt = reconstructed.prompt;
    } else {
      // Use full history (not compressed yet)
      contextPrompt = messages.map((m) => formatMessage(m)).join('\n');
    }

    // Send to Claude with reconstructed context
    await agentSDK.sendMessage(content, { context: contextPrompt });
  };

  return { messages, sendMessage, tokenCount, lattice };
}
```

### 3.2 Leverage Existing Overlay System

**Reuse**: `src/core/OverlayRegistry.ts` for overlay detection

````typescript
// src/sigma/overlay-detector.ts

import { OverlayRegistry } from '@/core/OverlayRegistry';

async function detectOverlayActivation(
  turn: ConversationTurn,
  context: ConversationContext
): Promise<OverlayScores> {
  const registry = new OverlayRegistry(context.projectRoot);
  await registry.initialize();

  const scores = {
    O1_structural: 0,
    O2_security: 0,
    O3_lineage: 0,
    O4_mission: 0,
    O5_operational: 0,
    O6_mathematical: 0,
    O7_strategic: 0,
  };

  // Check O1: Mentions of architecture, structure, components
  const o1Data = registry.getOverlay('O1');
  if (o1Data && containsEntities(turn.content, o1Data.items)) {
    scores.O1_structural = calculateMatchScore(turn.content, o1Data.items);
  }

  // Check O5: Mentions of workflows, commands, operations
  const o5Data = registry.getOverlay('O5');
  if (o5Data && containsCommands(turn.content)) {
    scores.O5_operational = calculateCommandScore(turn.content);
  }

  // Check O6: Code blocks, algorithms, formulas
  if (
    turn.content.includes('```') ||
    /\d+\s*[+\-*/]\s*\d+/.test(turn.content)
  ) {
    scores.O6_mathematical = 8;
  }

  // Check O7: Strategic keywords (goal, plan, validate, test)
  if (/\b(goal|plan|strategy|validate|test|verify)\b/i.test(turn.content)) {
    scores.O7_strategic = 6;
  }

  return scores;
}
````

### 3.3 Extend Lattice Storage

**Modify**: `src/core/Lattice.ts` to support conversation nodes

```typescript
// src/core/Lattice.ts

interface ConversationNode extends LatticeNode {
  type: 'conversation_turn';
  turn_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;

  // Sigma metadata
  overlay_scores: OverlayScores;
  importance_score: number;
  is_paradigm_shift: boolean;
  semantic_tags: string[];
}

interface ConversationEdge extends LatticeEdge {
  type: 'conversation_reference' | 'semantic_similarity';
  weight: number; // Relationship strength
}

class ConversationLattice extends Lattice {
  addTurn(analysis: TurnAnalysis): void {
    const node: ConversationNode = {
      id: analysis.turn_id,
      type: 'conversation_turn',
      turn_id: analysis.turn_id,
      role: analysis.role,
      content: analysis.content,
      timestamp: analysis.timestamp,
      overlay_scores: analysis.overlay_scores,
      importance_score: analysis.importance_score,
      is_paradigm_shift: analysis.is_paradigm_shift,
      semantic_tags: analysis.semantic_tags,
    };

    this.addNode(node);

    // Add edges to referenced turns
    for (const refId of analysis.references) {
      this.addEdge({
        from: analysis.turn_id,
        to: refId,
        type: 'conversation_reference',
        weight: 1.0,
      });
    }
  }

  findNodesByOverlay(
    overlays: string[],
    options: { maxNodes: number; sortBy: 'importance' | 'recency' }
  ): ConversationNode[] {
    const allNodes = this.getNodes().filter(
      (n) => n.type === 'conversation_turn'
    ) as ConversationNode[];

    // Filter by overlay activation
    const relevant = allNodes.filter((node) => {
      for (const overlay of overlays) {
        const score = node.overlay_scores[overlay as keyof OverlayScores];
        if (score >= 5) return true; // Threshold
      }
      return false;
    });

    // Sort
    if (options.sortBy === 'importance') {
      relevant.sort((a, b) => b.importance_score - a.importance_score);
    } else {
      relevant.sort((a, b) => b.timestamp - a.timestamp);
    }

    return relevant.slice(0, options.maxNodes);
  }
}
```

---

## Part 4: Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

**Goal**: Analyzer + basic compression working

- [ ] Create `src/sigma/` directory structure
- [ ] Implement `analyzer.ts` (turn classification)
- [ ] Implement `compressor.ts` (basic lattice conversion)
- [ ] Extend `Lattice.ts` to support conversation nodes
- [ ] Write unit tests for analyzer

**Deliverable**: Can analyze turns and detect overlays

### Phase 2: Integration with TUI (Week 2)

**Goal**: Sigma hooked into live conversations

- [ ] Modify `useClaudeAgent.ts` to call analyzer on each turn
- [ ] Add automatic compression trigger at 180K tokens
- [ ] Store analyzed turns in lattice
- [ ] Add debug logging to track Sigma activity
- [ ] Test with real TUI sessions

**Deliverable**: TUI automatically compresses at threshold

### Phase 3: Reconstruction (Week 3)

**Goal**: Query-driven context rebuilding

- [ ] Implement `reconstructor.ts` (graph traversal + prompt building)
- [ ] Integrate with Claude Agent SDK (use reconstructed context)
- [ ] Add relevance scoring (ensure reconstructed context is coherent)
- [ ] Test with various query types (code, explanation, strategy)
- [ ] Measure fidelity (does Claude respond correctly?)

**Deliverable**: Conversations continue seamlessly after compression

### Phase 4: Optimization (Week 4)

**Goal**: Improve compression ratio and reconstruction quality

- [ ] Tune importance scoring algorithm
- [ ] Add semantic summarization (LLM-based compression)
- [ ] Implement caching (avoid recompressing unchanged history)
- [ ] Add metrics dashboard (show compression stats in TUI)
- [ ] Performance profiling (ensure <100ms overhead)

**Deliverable**: 30-50x compression with >90% fidelity

### Phase 5: Generalization (Week 5)

**Goal**: Works for ANY domain, not just programming

- [ ] Test with medical conversation (diagnosis workflow)
- [ ] Test with legal conversation (case analysis)
- [ ] Test with creative conversation (art critique)
- [ ] Extract domain-agnostic patterns
- [ ] Document overlay activation patterns per domain

**Deliverable**: Proof that Sigma generalizes

---

## Part 5: Success Metrics

### Quantitative Metrics

- **Compression Ratio**: 30-50x (200K → 4-7K tokens)
- **Reconstruction Time**: <100ms (lattice traversal + prompt building)
- **Fidelity**: >90% (user can't tell context was compressed)
- **Overhead**: <5% (analysis + compression time vs conversation time)

### Qualitative Metrics

- **User Experience**: Seamless (no interruptions, infinite context feel)
- **Generalization**: Works across domains (programming, medicine, law, etc.)
- **Integration**: Minimal changes to existing code (<10% diff)
- **Maintainability**: Clean abstractions (Sigma is a module, not spaghetti)

### Validation Tests

1. ✓ Start conversation, reach 180K tokens, compression triggers automatically
2. ✓ After compression, ask about early conversation → Claude recalls correctly
3. ✓ After compression, continue new topics → no degradation
4. ✓ Check lattice size → <10KB for 200K token conversation
5. ✓ Test in different domain → same compression ratio

---

## Part 6: Technical Decisions

### 6.1 Storage Format

**Option A**: JSON lattice (human-readable, easy debugging)
**Option B**: Binary format (smaller, faster)
**Decision**: Start with JSON (Phase 1-4), optimize to binary if needed (Phase 5)

### 6.2 Compression Strategy

**Option A**: Rule-based (keyword matching, heuristics)
**Option B**: LLM-based (use Claude to summarize)
**Decision**: Hybrid - rules for importance scoring, LLM for semantic summarization

### 6.3 Overlay Detection

**Option A**: Static analysis (regex, keyword matching)
**Option B**: LLM-based (ask Claude "which overlay is this?")
**Decision**: Static (Phase 1-3), add LLM refinement if needed (Phase 4)

### 6.4 Reconstruction Algorithm

**Option A**: Graph traversal only (follow edges)
**Option B**: Hybrid (graph + semantic search + LLM ranking)
**Decision**: Start with graph traversal, add semantic search if fidelity <90%

---

## Part 7: Risk Mitigation

### Risk 1: Compression Loses Context

**Symptom**: Claude gives wrong answers after compression
**Mitigation**:

- Always preserve paradigm shifts (never compress)
- Test reconstruction with known queries (regression tests)
- Add "context health check" (periodically validate fidelity)

### Risk 2: Reconstruction Too Slow

**Symptom**: >500ms to rebuild context, user sees lag
**Mitigation**:

- Cache reconstructed contexts (avoid rebuilding same query)
- Pre-compute common queries (anticipate user needs)
- Use incremental updates (only rebuild diff since last query)

### Risk 3: Doesn't Generalize

**Symptom**: Works for programming, fails for medicine
**Mitigation**:

- Test early with diverse domains (Phase 5)
- Extract domain-agnostic patterns (overlay system is already domain-agnostic)
- Allow per-domain tuning (importance scoring can be customized)

---

## Part 8: Integration Points with Existing Systems

### With Overlays (O1-O7)

- **O1 (Structural)**: Architectural discussions, design decisions
- **O2 (Security)**: Credentials, permissions, vulnerabilities
- **O3 (Lineage)**: Cross-references, "as we discussed earlier"
- **O4 (Mission)**: Goal-setting, strategic planning
- **O5 (Operational)**: Command execution, workflow steps
- **O6 (Mathematical)**: Code, algorithms, formulas
- **O7 (Strategic)**: Validation, testing, reflection

**Usage**: Sigma uses overlay activation to determine importance and reconstruction relevance

### With Lattice

- **Existing**: Entity → Relationship → Entity (code, files, dependencies)
- **New**: ConversationTurn → Reference → ConversationTurn (conversation graph)

**Usage**: Same graph infrastructure, different node types

### With Claude Agent SDK

- **Existing**: Send message with full history
- **New**: Send message with reconstructed context from lattice

**Usage**: Transparent to SDK (still receives string context, just compressed)

---

## Next Steps

1. **Review this plan** - Confirm architecture and phasing
2. **Create Phase 1 branch** - `feature/sigma-analyzer`
3. **Implement analyzer module** - Start with overlay detection
4. **Write tests** - Ensure analyzer works on sample conversations
5. **Integrate with TUI** - Hook into `useClaudeAgent.ts`

---

**Document Status**: Draft v1.0 (Production Implementation)
**Target**: Generalized context compression for ANY domain
**Timeline**: 5 weeks (5 hours/week = 25 hours total)
**License**: AGPLv3 (civilization starter kit remains open)
