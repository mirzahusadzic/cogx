# Lineage Patterns Usage Analysis

**Date:** 2025-11-17
**Context:** Investigation into what lineage_patterns (O₃) overlay is actually used for vs. architectural expectations

## Problem Discovery

While fixing Python body_dependencies support for blast-radius, discovered that:
1. **blast-radius does NOT use lineage_patterns** - it builds its own graph from structural_patterns
2. This means we have **two separate dependency tracking systems** that are architecturally redundant

## Current Usage: Where lineage_patterns (O₃) is Actually Used

### 1. CLI Commands (Direct Usage)

**`cognition-cli patterns inspect <symbol>`**
- Shows dependency tree with depth levels
- Parses `lineageSignature` field from overlay metadata
- Example output:
  ```
  🌳 Lineage Pattern:
     Dependencies (3):
     → SnowflakeClient (depth: 1)
     → DataTransformer (depth: 1)
     → Logger (depth: 2)
  ```

**`cognition-cli patterns graph <symbol>`**
- Visualizes dependency graph in ASCII or JSON
- Uses same `lineageSignature` parsing
- Supports max-depth filtering

**`cognition-cli patterns find-similar`**
- Infrastructure exists for vector similarity search
- **BUT**: Appears unused in practice

### 2. Sigma Claude Context (Indirect Usage)

**System Prompt Population**
- `src/sigma/context-reconstructor.ts` includes lineage in system prompt
- Section: "Knowledge Evolution (O3 Lineage)"
- Populated from vector search results with lineage embeddings
- Provides dependency context to Claude during conversations

**ISSUE**: System prompt claims:
> "Blast radius: Dependency tracking via lineage overlay (4 relationships: imports, extends, implements, uses)"

This is **INCORRECT** - blast-radius uses GraphTraversal, not lineage overlay!

### 3. Update Orchestrator (Cross-file Invalidation)

**Monument 4.9: Cross-file invalidation**
- `src/core/orchestrators/update.ts` tracks reverse dependencies
- When file A changes and file B imports A:
  - B's lineage_patterns become stale
  - Orchestrator invalidates B's patterns automatically
  - Forces regeneration on next access

**Code location:** `src/core/orchestrators/update.ts:454-469`

### 4. Vector Search Infrastructure (Mostly Unused)

**Embeddings:**
- Each lineage pattern has 768D vector from eGemma
- Embeds the ENTIRE dependency tree structure (not just symbol name)
- Stored in LanceDB for similarity search

**Intended Use:**
- Semantic queries: "Find symbols with similar dependencies"
- Example: "Show me all functions that depend on similar database abstractions"

**Reality:**
- Infrastructure is built and working
- **BUT**: No commands or features actually query lineage embeddings
- The embeddings are computed but rarely (if ever) searched

## What lineage_patterns is NOT Used For

### ❌ blast-radius Command
- **Expected:** Use pre-computed lineage_patterns from O₃
- **Reality:** Builds own graph from structural_patterns via GraphTraversal
- **Location:** `src/core/graph/traversal.ts`
- **Reason:** Needs richer metadata (file paths, architectural roles) than lineage stores

### ❌ Security Blast Radius
- Same as above - uses GraphTraversal
- **Location:** `src/commands/security-blast-radius.ts`

### ❌ PR Analysis
- Doesn't appear to use lineage_patterns
- May use GraphTraversal or other mechanisms

## Architectural Redundancy

### Two Dependency Tracking Systems

**System 1: lineage_patterns (O₃)**
- Pre-computed during overlay generation
- Stores: `{ symbol, lineage: [{ type, relationship, depth }] }`
- Has embeddings for similarity search
- Updated incrementally via invalidation
- **Storage:** `.open_cognition/overlays/lineage_patterns/`

**System 2: GraphTraversal (blast-radius)**
- Computed on-demand from structural_patterns
- Stores: Full graph with nodes, edges, adjacency lists
- Has architectural roles, file paths, types
- Re-built from scratch on each query
- **Storage:** In-memory only (not persisted)

### Recent Changes Made to BOTH Systems

To support Python body_dependencies, we had to update:

1. ✅ **eGemma** (`~/src/egemma/src/util/ast_parser.py`)
   - Added `ASTBodyDependencyVisitor`
   - Extracts class instantiations from function bodies
   - Returns `body_dependencies: { instantiations: [...], method_calls: [...] }`

2. ✅ **Lineage Worker** (`src/core/overlays/lineage/worker.ts`)
   - Processes `body_dependencies.instantiations`
   - Adds to dependency graph during traversal
   - Commit: `aa3f2b7 - feat: process body_dependencies from Python AST in lineage extraction`

3. ✅ **Graph Traversal** (`src/core/graph/traversal.ts`)
   - Added same `body_dependencies` processing
   - For both methods AND standalone functions
   - Commit: `c1304ed - feat: process body_dependencies in blast-radius graph traversal`

**This duplication is a code smell!**

## Data Format Differences

### lineage_patterns stores:
```json
{
  "symbol": "SnowflakeClient",
  "lineage": [
    { "type": "DatabaseConnection", "relationship": "uses", "depth": 1 },
    { "type": "Logger", "relationship": "uses", "depth": 2 }
  ]
}
```

### GraphTraversal builds:
```typescript
{
  nodes: Map<string, GraphNode>, // { symbol, filePath, type, structuralHash, architecturalRole }
  edges: GraphEdge[],            // { from, to, type, fromFile, toFile }
  outgoing: Map<string, Set<string>>,
  incoming: Map<string, Set<string>>
}
```

GraphTraversal has much richer metadata needed for blast-radius reporting.

## Why Two Systems Exist

### Historical Context (Speculative)
1. **lineage_patterns was designed first** for semantic search and context reconstruction
2. **GraphTraversal added later** when blast-radius needed richer metadata
3. Nobody refactored to consolidate them

### Technical Reasons
1. **Different output formats** - lineage is JSON for display, graph is in-memory for traversal
2. **Different performance characteristics** - lineage is pre-computed, graph is on-demand
3. **Different use cases** - lineage for context/display, graph for impact analysis

## Performance Characteristics

### lineage_patterns (Pre-computed)
- **Generation time:** O(N × M × D) where N=symbols, M=avg deps, D=max depth
- **Query time:** O(1) - just read from disk
- **Storage:** ~1-5KB per symbol (JSON)
- **Staleness:** Updated only when source files change

### GraphTraversal (On-demand)
- **Generation time:** O(N × M) - builds full graph from structural patterns
- **Query time:** O(V + E) - BFS traversal
- **Storage:** In-memory only
- **Staleness:** Always fresh (reads latest structural_patterns)

## Architectural Questions to Resolve

### Should blast-radius use lineage_patterns?

**Pros:**
- Pre-computed = faster queries
- Already has embeddings for similarity
- Reduces code duplication

**Cons:**
- Would need to store richer metadata in lineage (file paths, roles)
- Staleness issues if lineage not regenerated
- Harder to extend with new relationship types

### Should lineage_patterns be removed?

**Pros:**
- Eliminates duplication
- Simplifies codebase
- One source of truth for dependencies

**Cons:**
- Loses pre-computation benefits
- Loses semantic embeddings (though they're underused)
- Loses invalidation tracking (Monument 4.9)

### Should they be merged?

**Option: Unified Dependency Store**
- Store graph structure in lineage_patterns
- Add metadata GraphTraversal needs (paths, roles)
- blast-radius reads from lineage instead of rebuilding
- Keep embeddings for future semantic features

**Benefits:**
- Single source of truth
- Pre-computed = faster
- Incremental updates via invalidation
- Embeddings available for advanced features

**Challenges:**
- Migration complexity
- Schema changes to lineage metadata
- Need to ensure freshness guarantees

## Recommendations

### Short-term (Keep As-Is)
- Document the duplication clearly
- Add tests to ensure both systems stay in sync
- Consider lineage_patterns optional for projects that don't need it

### Medium-term (Consolidate)
- Enhance lineage_patterns schema with GraphTraversal metadata
- Migrate blast-radius to read from lineage_patterns
- Deprecate GraphTraversal once migration complete

### Long-term (Leverage Embeddings)
- Build features that actually USE lineage embeddings
- "Find similar dependencies" command
- "Suggest refactoring opportunities" based on lineage similarity
- Integrate into Sigma for smarter context retrieval

## Open Questions

1. **Why weren't lineage embeddings used more?**
   - Was the feature abandoned?
   - Was performance not good enough?
   - Was the use case not clear?

2. **What is the performance delta?**
   - How much faster is reading lineage vs. building graph?
   - Is it significant enough to matter?

3. **What breaks if we remove lineage_patterns?**
   - Sigma context would lose O₃ section
   - `patterns inspect/graph` commands would fail
   - Cross-file invalidation would need replacement
   - But core features (blast-radius, security) would work fine

4. **Monument 4.9 (invalidation) - can it be preserved?**
   - Could we invalidate structural_patterns instead?
   - Or track invalidation separately from overlay storage?

## Related Files

### Lineage Implementation
- `src/core/overlays/lineage/worker.ts` - Mining and traversal
- `src/core/overlays/lineage/manager.ts` - Embedding and storage
- `src/core/overlays/lineage/types.ts` - Type definitions
- `src/core/overlays/lineage/algebra-adapter.ts` - Vector DB integration

### GraphTraversal Implementation
- `src/core/graph/traversal.ts` - Graph building and BFS
- `src/core/graph/types.ts` - Graph types
- `src/commands/blast-radius.ts` - CLI consumer

### Usage Sites
- `src/commands/patterns.ts` - inspect and graph commands
- `src/sigma/context-reconstructor.ts` - Sigma context
- `src/core/orchestrators/update.ts` - Invalidation tracking

## Commits Referenced

- `aa3f2b7` - feat: process body_dependencies from Python AST in lineage extraction
- `c1304ed` - feat: process body_dependencies in blast-radius graph traversal
- `1eea039` - feat: extract function body dependencies and imported symbols from Python AST (eGemma)

---

**Next Steps:** Review this analysis and decide on consolidation strategy.
