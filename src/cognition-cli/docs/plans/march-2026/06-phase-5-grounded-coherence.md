# Phase 5: Intent-Grounded Coherence (Week 10-11)

**Goal:** Replace shadow-only coherence with three-way meet: Structure × Mission × Intent. The system stops confusing "operational infrastructure" with "mission drift."

## The Problem

Current O₇ coherence computes:

```
O₇ = meet(O₁_shadow, O₄_concepts)
```

Where `O₁_shadow` = structural + docstring embeddings. This works for symbols whose _description_ aligns with the mission vocabulary. But it produces **false drift** for infrastructure symbols:

```
StrategicCoherenceManager → docstring: "computes alignment scores" → 50.1% match
  Verdict: DRIFTED ← WRONG. This IS the coherence system.

BlastRadiusInfo → docstring: "blast radius data structure" → 51.1% match
  Verdict: DRIFTED ← WRONG. This IS the structural integrity tool.
```

These symbols are mission-critical, but their docstrings use operational language, not mission language. The shadow can't distinguish between "drifted from mission" and "serves the mission but describes itself differently."

## The Fix: Three-Way Meet

```
O₇_v2 = meet(O₁_shadow, O₄_concepts, O_intent)
```

Where `O_intent` is a new embedding dimension derived from the lineage intent chain:

```typescript
// For each symbol, collect all intents from its transform history
async function computeIntentEmbedding(
  symbol: string,
  provenanceService: ProvenanceService,
  embeddingService: EmbeddingService
): Promise<number[]> {
  // 1. Get all transforms that touched this symbol's file
  const history = await provenanceService.getFileHistory(symbol.filePath);

  // 2. Collect reasoning.intent from each transform
  const intents = history
    .filter((t) => t.reasoning?.intent)
    .map((t) => t.reasoning!.intent);

  // 3. If no intents recorded (pre-lineage code), fall back to shadow
  if (intents.length === 0) return null; // graceful degradation

  // 4. Synthesize: Join all intents into a single narrative
  //    "Created to implement O₇ coherence checking. Refined to add Gaussian
  //     weighting. Updated to support lattice-aware centrality scoring."
  const synthesized = intents.join('. ');

  // 5. Embed the synthesized intent narrative (768D via eGemma)
  return embeddingService.embed(synthesized);
}
```

## 5.1 Intent Embedding Generator

**New file:** `src/core/overlays/strategic-coherence/intent-embeddings.ts`

Generates intent embeddings for all symbols that have lineage history:

```typescript
export class IntentEmbeddingGenerator {
  async generateForSymbol(symbol: string): Promise<IntentEmbedding | null> {
    const history = await this.provenanceService.getFileHistory(filePath);
    const intents = this.extractIntents(history);

    if (intents.length === 0) return null; // No lineage yet — graceful fallback

    // Synthesize intent narrative via Join operation
    const narrative = this.synthesizeNarrative(intents);

    // Embed (768D)
    const embedding = await this.embeddingService.embed(narrative);

    return {
      symbol,
      embedding,
      intent_count: intents.length,
      narrative, // Human-readable for debugging
      confidence: this.computeConfidence(intents), // Higher with more real intents vs rehydrated
    };
  }

  private computeConfidence(intents: IntentRecord[]): number {
    // Weighted average:
    //   Real-time intent (from IntentAdapter): weight 1.0
    //   Git commit message: weight 0.5
    //   Rehydrated/inferred: weight 0.3
    const weights = intents.map((i) => {
      if (i.source === 'ai_agent' || i.source === 'developer') return 1.0;
      if (i.method === 'git_commit_message') return 0.5;
      return 0.3; // rehydrated/inferred
    });
    return weights.reduce((a, b) => a + b, 0) / weights.length;
  }
}
```

## 5.2 Three-Way Coherence Computation

**File to modify:** `src/core/overlays/strategic-coherence/manager.ts`

Extend the existing coherence computation to incorporate intent:

```typescript
// Current: 2-way meet
const shadowSimilarity = cosineSimilarity(
  symbol.shadowEmbedding,
  concept.embedding
);

// New: 3-way meet (when intent available)
const intentEmbedding = await intentGenerator.generateForSymbol(symbol.name);

let coherenceScore: number;
if (intentEmbedding && intentEmbedding.confidence > 0.3) {
  // Three-way: Structure × Mission × Intent
  const intentSimilarity = cosineSimilarity(
    intentEmbedding.embedding,
    concept.embedding
  );

  // Weighted combination:
  //   - Intent similarity weighted by confidence (0.3-1.0)
  //   - Shadow similarity fills the remainder
  //   - As intent confidence grows, shadow influence shrinks
  const intentWeight = intentEmbedding.confidence * 0.5; // Max 50% from intent
  const shadowWeight = 1.0 - intentWeight;

  coherenceScore =
    shadowSimilarity * shadowWeight + intentSimilarity * intentWeight;
} else {
  // Graceful fallback: shadow-only (current behavior)
  coherenceScore = shadowSimilarity;
}
```

**Why this weighting:**

- Fresh codebase (no lineage): 100% shadow — identical to current behavior
- Rehydrated from git (confidence ~0.5): ~25% intent, ~75% shadow
- Full live lineage (confidence ~1.0): ~50% intent, ~50% shadow
- Intent never fully replaces shadow — structure still matters

## 5.3 What This Fixes

The `StrategicCoherenceManager` example:

```
Current (shadow-only):
  docstring embedding: "computes alignment scores between code and mission"
  × mission concept: "verifiable grounding of all knowledge"
  = 50.1% → DRIFTED

With intent:
  intent narrative: "Implements O₇ — the conscience overlay. Created to judge
    alignment between code structure and mission concepts. Refined to add
    Gaussian-filtered centrality weighting for noise reduction."
  × mission concept: "verifiable grounding of all knowledge"
  = ~78% → ALIGNED ← correct

Three-way:
  shadow (50.1%) × 0.5 + intent (78%) × 0.5 = 64.1% → ALIGNED ← correct
```

Infrastructure symbols that _serve_ the mission but _describe_ themselves operationally are correctly reclassified.

## 5.4 Temporal Coherence Report

**New command extension:** `cognition-cli coherence report --history`

```
📊 Strategic Coherence Report (with Intent Grounding)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Coherence Metrics:
    Shadow-only coherence:   63.1% (structural + docstring)
    Intent-grounded:         71.4% (+8.3%) ← with reasoning lineage
    Confidence:              0.62 (62% of symbols have intent history)

  Reclassified Symbols (shadow→intent):
    StrategicCoherenceManager: 50.1% → 64.1% (no longer drifted)
    BlastRadiusInfo:           51.1% → 63.8% (no longer drifted)
    runBlastRadius:            51.1% → 62.9% (no longer drifted)

  Still Drifted (confirmed by intent):
    PrerequisitesResult:       50.3% → 48.7% (intent: "utility check", weak mission link)

  Coherence Over Last 10 Commits:
    abc123  71.4%  ━━━━━━━━━━━━━━▓░░░░░  "Added lineage adapter"
    def456  69.8%  ━━━━━━━━━━━━━▓░░░░░░  "Refactored auth flow"    ← drift
    ghi789  70.6%  ━━━━━━━━━━━━━━▓░░░░░  "Fixed auth regression"   ← recovered
```

**Tests:**

- Symbol with no lineage → falls back to shadow-only (backward compat)
- Symbol with rehydrated intents (confidence 0.5) → blended score
- Symbol with live intents (confidence 1.0) → 50/50 blend
- Infrastructure symbol (operational docstring, mission-aligned intent) → reclassified from drifted to aligned
- Truly drifted symbol (weak intent + weak shadow) → stays drifted

---
