# Refactor: Query Logic Consolidation (Discovery Findings)

Following the [find-refactor-candidates](../../.claude/commands/find-refactor-candidates.md) 3-step pipeline, we identified significant logic duplication between the CLI's `ask` command and the Sigma layer's `query-conversation` service.

## 📊 Summary

- **Primary Candidates:** `src/commands/ask.ts` and `src/sigma/query-conversation.ts`
- **Validated Similarity:** 89.7% (Structural Pattern)
- **Estimated Code Reduction:** ~120 LOC
- **Impact:** High (Consolidates core 3-stage query pipeline)

---

## 🔍 Validation (3-Step Pipeline)

### Phase 1: Discover

A broad scan of `AskOptions` surfaced `QueryConversationOptions` as the top structural match (79.5% ANN similarity).

### Phase 2: Validate

Running `cognition-cli patterns compare AskOptions QueryConversationOptions` yielded **89.7% exact cosine similarity**.

- **Shared Signature:** interface | properties:6 | shape:{...} | imports:16 | exports:2
- **Signature Note:** Both symbols share the exact same number of imports and exports, indicating they sit in the same dependency sandwich.

### Phase 3: Ground (Source Audit)

Direct inspection of the source code confirms 100% logic duplication in the `QueryIntent` definition:

```typescript
// src/commands/ask.ts:104
interface QueryIntent {
  intent: 'search' | 'status' | 'meta';
  confidence: number;
  reasoning: string;
}

// src/sigma/query-conversation.ts:16
interface QueryIntent {
  intent: 'search' | 'status' | 'meta';
  confidence: number;
  reasoning: string;
}
```

Both files implement the same 3-stage sequence:

1. **Analyze Intent**: LLM-driven intent classification.
2. **Semantic Search**: LanceDB similarity search based on intent.
3. **Synthesis**: Final response generation from search results.

---

## 💡 Proposed Refactoring

### 1. Extract Shared Types

Move `QueryIntent` and a new `BaseQueryOptions` interface to a central location.

- **Target:** `src/core/types/query.ts`

### 2. Create `QueryPipeline` Service

Extract the 3-stage logic from `ask.ts` into a reusable service in the `sigma` or `core` layer. This service should handle:

- Intent analysis (using a shared LLM prompt).
- Cross-session / Overlay-scoped search.
- Result weighting and normalization.

### 3. Update Consumers

- **CLI (`ask.ts`)**: Become a thin wrapper around the `QueryPipeline` service.
- **Sigma (`query-conversation.ts`)**: Leverage the same pipeline for conversational grounding.

## 🚀 Impact & Benefits

- **DRY Compliance**: Changes to the search algorithm or intent classification only need to happen in one place.
- **Consistency**: Ensures the CLI and the TUI/Conversation layers use the exact same search logic.
- **Maintenance**: Simplifies unit testing of the query engine without needing to mock CLI-specific constructs.

## ❌ Rejected Candidates (False Positives)

During the same scan, `OverlayDocument` vs `IBaseOverlayDocument` (89% similarity) was **rejected** during Phase 2 (Validate). Despite high vector similarity, their structural signatures diverged (5 properties vs 7 properties) and their logical roles (Content vs Metadata) are distinct. No refactoring is recommended for this pair.
