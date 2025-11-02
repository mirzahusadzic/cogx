# Sigma Embedding Strategy

## TL;DR: Not Yet, But Infrastructure Exists

**Phase 1-3**: No embeddings (keyword-based detection is sufficient for MVP)
**Phase 4+**: Add embeddings for semantic similarity and better relevance

---

## Current Implementation (Phase 1): Keyword-Based

### What We're Using Now

**Overlay Detection** (`analyzer.ts`):
```typescript
// O1 (Structural)
if (content.includes('architecture')) scores.O1_structural = 8;

// O6 (Mathematical)
if (content.includes('```')) scores.O6_mathematical = 8;
```

**Importance Scoring**:
- Content length
- Question marks
- Code blocks
- Paradigm shift keywords ("eureka", "solved", "breakthrough")

**Graph Edges**:
- Temporal (consecutive turns)
- References (explicit mentions)
- No semantic similarity yet

### Why No Embeddings in Phase 1?

1. **Speed**: Build in hours, not days
2. **Simplicity**: No API dependencies, no async batching complexity
3. **Good Enough**: Keyword matching works well for structured technical conversations
4. **Testing Focus**: Prove compression/reconstruction concept first

---

## When We Generate Embeddings (Phase 4+)

### Trigger Points

**You should add embeddings when:**

1. **After MVP proven** - Compression/reconstruction working in production
2. **When you see gaps** - "Sigma missed these related turns"
3. **For better reconstruction** - Query understanding needs improvement
4. **For cross-domain** - Testing medical/legal conversations (non-programming)

### Use Case 1: Semantic Similarity Edges

**Problem**: Related turns far apart in time aren't connected

**Example**:
```
Turn 5: "How do we handle mouse events in the terminal?"
Turn 50: "The stdin listener interception solved the mouse issue"
```

Currently: No edge (not consecutive, no explicit reference)
With embeddings: Semantic edge (cosine similarity = 0.85)

**Implementation**:
```typescript
// Phase 4: Add to compressor.ts
import { EmbeddingService } from '@/core/services/embedding.js';

async function addSemanticEdges(
  lattice: ConversationLattice,
  threshold: number = 0.7
): Promise<ConversationLattice> {
  const embedder = new EmbeddingService(workbenchEndpoint);

  // Generate embeddings for all nodes
  const embeddings = await Promise.all(
    lattice.nodes.map(async (node) => ({
      node_id: node.id,
      embedding: await embedder.getEmbedding(node.content, 768),
    }))
  );

  // Find similar pairs
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const similarity = cosineSimilarity(
        embeddings[i].embedding.vector,
        embeddings[j].embedding.vector
      );

      if (similarity > threshold) {
        lattice.edges.push({
          from: embeddings[i].node_id,
          to: embeddings[j].node_id,
          type: 'semantic_similarity',
          weight: similarity,
        });
      }
    }
  }

  return lattice;
}
```

### Use Case 2: Better Overlay Detection

**Problem**: Keywords miss semantic matches

**Example**:
```
"We need to restructure the component hierarchy"
```

Keyword: No "architecture" → O1 score = 0
Semantic: Similar to "architecture design structure" → O1 score = 7

**Implementation**:
```typescript
// Phase 4: Enhance analyzer.ts
async function detectOverlayActivation(
  turn: ConversationTurn,
  context: ConversationContext
): Promise<OverlayScores> {
  const embedder = new EmbeddingService(workbenchEndpoint);

  // Define overlay semantic signatures
  const overlaySignatures = {
    O1_structural: "architecture structure design components hierarchy",
    O2_security: "security credentials permissions authentication",
    O3_lineage: "earlier mentioned discussed previously remember",
    O4_mission: "goal objective plan strategy purpose",
    O5_operational: "command workflow execute implement run",
    O6_mathematical: "algorithm function code formula calculate",
    O7_strategic: "validate test verify review assess",
  };

  // Get turn embedding
  const turnEmbed = await embedder.getEmbedding(turn.content, 768);

  // Calculate similarity to each overlay
  const scores: OverlayScores = {};
  for (const [overlay, signature] of Object.entries(overlaySignatures)) {
    const overlayEmbed = await embedder.getEmbedding(signature, 768);
    const similarity = cosineSimilarity(
      turnEmbed.vector,
      overlayEmbed.vector
    );
    scores[overlay] = Math.round(similarity * 10); // Scale to 0-10
  }

  return scores;
}
```

### Use Case 3: Query Understanding

**Problem**: Reconstruction misses relevant context

**Example Query**:
```
"How did we solve the scrolling issue?"
```

Keyword match: "scroll" appears in 3 turns
Semantic match: "mouse events", "stdin interception", "scroll" all related (8 turns)

**Implementation**:
```typescript
// Phase 4: Enhance reconstructor.ts
async function findNodesByOverlay(
  lattice: ConversationLattice,
  query: string,
  maxNodes: number
): Promise<ConversationNode[]> {
  const embedder = new EmbeddingService(workbenchEndpoint);

  // Get query embedding
  const queryEmbed = await embedder.getEmbedding(query, 768);

  // Score all nodes by semantic relevance
  const scored = lattice.nodes.map((node) => ({
    node,
    relevance: cosineSimilarity(queryEmbed.vector, node.embedding!),
  }));

  // Sort and return top N
  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, maxNodes).map((s) => s.node);
}
```

---

## Embedding Infrastructure (Already Exists!)

### EmbeddingService (`src/core/services/embedding.ts`)

**Features**:
- Queue-based batching (efficient API usage)
- Rate limiting (respects API limits)
- Workbench client integration
- Configurable dimensions (768, 1536, etc.)

**Usage**:
```typescript
import { EmbeddingService } from '@/core/services/embedding.js';

const embedder = new EmbeddingService('http://localhost:3001');

const response = await embedder.getEmbedding(
  "How do we handle mouse events?",
  768 // Dimensions
);

console.log(response.vector); // Float array [0.123, -0.456, ...]
```

### Vector Database (`src/core/overlays/vector-db`)

**Already exists** for O1, O3, O4 overlays:
- Stores embeddings in ChromaDB
- Semantic search support
- Used for code symbol similarity

**Can reuse** for conversation turn embeddings.

---

## Implementation Timeline

### Phase 1 (Current): ✅ **No Embeddings**
- Keyword-based overlay detection
- Rule-based importance scoring
- Temporal + reference edges
- **Status**: Complete, working

### Phase 2 (Next 1-2 weeks): **No Embeddings**
- Integrate with useClaudeAgent.ts
- Test with real TUI sessions
- Validate compression/reconstruction
- **Embeddings**: Not needed yet

### Phase 3 (Before Anthropic Pitch): **No Embeddings**
- Measure metrics (compression ratio, fidelity)
- Prepare demo materials
- Test with sample conversations
- **Embeddings**: Not needed for pitch

### Phase 4 (Post-Pitch Enhancement): **Add Embeddings**
- After MVP validated
- When we see concrete needs
- Based on feedback from usage

**Order of Implementation**:
1. Semantic similarity edges (biggest impact on reconstruction quality)
2. Better overlay detection (improves classification accuracy)
3. Query understanding (improves relevance scoring)

---

## Cost Considerations

### Embedding Generation Costs

**Assumptions**:
- 200K token conversation ≈ 100 turns
- Each turn ≈ 500 tokens
- Workbench embedding: $0.0001 per 1K tokens

**Calculations**:
```
100 turns × 500 tokens/turn = 50K tokens
50K tokens × $0.0001/1K = $0.005 (half a cent)
```

**Plus semantic similarity**:
```
100 nodes × 99 comparisons / 2 = 4,950 comparisons
(O(n²) but only done once during compression)
```

**Total**: ~$0.01 per conversation compression (negligible)

### Storage Costs

**Per conversation lattice**:
- 100 nodes × 768 floats × 4 bytes = ~300KB embeddings
- Plus node metadata: ~50KB
- **Total**: ~350KB per compressed conversation

**Compared to**:
- Original conversation: 200K tokens ≈ 800KB text
- Compressed lattice without embeddings: ~10KB
- Compressed lattice with embeddings: ~360KB

**Trade-off**: Embeddings add size but improve reconstruction quality

---

## Decision Framework

### When to Add Embeddings?

**Add embeddings if**:
- Keyword matching misses relevant turns (false negatives)
- Reconstruction quality < 90% fidelity
- Testing non-technical domains (medical, legal) where keywords don't work well
- User feedback: "Sigma didn't understand my query"

**Don't add embeddings if**:
- Current system works (keyword-based is sufficient)
- Compression/reconstruction meets targets
- Adding complexity without proven need
- Cost/latency concerns outweigh benefits

### Testing Without Embeddings First

**Why start simple**:
1. **Faster iteration** - No API dependencies
2. **Easier debugging** - Rule-based is transparent
3. **Prove concept** - Compression/reconstruction works regardless
4. **Baseline metrics** - Can measure improvement when adding embeddings

**Then enhance**:
1. Measure keyword-based performance (baseline)
2. Add embeddings (one use case at a time)
3. Measure improvement (quantify benefit)
4. Keep if improvement > cost/complexity

---

## Answer to Your Question

> "when do we generate embeddings?"

**Short Answer**: Not yet. Phase 4+, after MVP proven.

**Detailed Answer**:

**Phase 1-3 (Now - Anthropic Pitch)**:
- ❌ No embeddings generated
- ✅ Keyword-based detection sufficient
- ✅ Temporal + reference edges work
- ✅ Fast to build, test, demo

**Phase 4+ (Post-Pitch Enhancement)**:
- ✅ Generate embeddings during compression
- ✅ Store in lattice nodes
- ✅ Use for semantic similarity edges
- ✅ Use for better overlay detection
- ✅ Use for query understanding

**Trigger**: When keyword-based shows limitations in real usage

**Infrastructure**: Already exists (`EmbeddingService`, `vector-db`)

**Cost**: ~$0.01 per conversation (negligible)

---

**Current Status**: Phase 1 complete, no embeddings needed yet. Proceed to Phase 2 integration. 🎯→🔨→✅

**Next**: Hook Sigma into useClaudeAgent.ts (still no embeddings required)
