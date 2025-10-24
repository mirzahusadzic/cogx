# Semantic Commands Implementation Plan

**Goal**: Add AI-powered semantic commands that leverage the PGC lattice for efficient code understanding and analysis.

## AI Integration via Slash Commands

This implementation provides **two interfaces** for interacting with the PGC:

### 1. CLI Commands (for users)

Direct invocation via terminal:

```bash
cognition-cli blast-radius PGCManager
cognition-cli overlay inspect structural_patterns "PGCManager"
```

### 2. Slash Commands (for AI assistants)

Files in `.claude/commands/` become slash commands that expand into prompts for the AI:

**Created Commands**:

- `/analyze-symbol` - Instructs AI to use PGC tools for comprehensive symbol analysis
- `/analyze-impact` - Guides AI through blast radius analysis before making changes
- `/explore-architecture` - Framework for understanding overall codebase architecture
- `/trace-dependency` - Step-by-step dependency chain tracing

**How it works**:

1. User types `/analyze-symbol` in Claude Code
2. Claude sees the expanded prompt from `.claude/commands/analyze-symbol.md`
3. Claude runs `cognition-cli blast-radius <symbol>` via Bash tool
4. Claude uses PGC-grounded data instead of hallucinating
5. All analysis backed by cryptographic hashes (verifiable cognition!)

**True Symbiosis**: The PGC provides verifiable, immutable context that grounds AI analysis in reality. The AI can leverage graph traversal, historical data, and semantic patterns without hallucination risk.

---

## Phase 1: Blast Radius (Foundation) 🔴 PRIORITY

### Command: `cognition-cli blast-radius <symbol> [options]`

**Purpose**: Show complete impact graph when a symbol changes - both consumers (up) and dependencies (down).

**Options**:

- `--max-depth <N>` - Maximum traversal depth (default: 3)
- `--direction <up|down|both>` - Traversal direction (default: both)
- `--json` - Output as JSON for programmatic use
- `--graph` - Generate visual graph (ASCII or export format)

**Implementation**:

1. **Bidirectional Graph Traversal** (core feature)
   - File: `src/core/graph/traversal.ts`
   - Implement:

     ```typescript
     interface BlastRadiusResult {
       symbol: string;
       consumers: Symbol[]; // Who uses this
       dependencies: Symbol[]; // What this uses
       graph: DirectedGraph;
       metrics: {
         totalImpacted: number;
         maxDepth: number;
         criticalPaths: Path[];
       };
     }

     class GraphTraversal {
       async getBlastRadius(
         symbol: string,
         options: TraversalOptions
       ): Promise<BlastRadiusResult>;
       async getConsumers(symbol: string, depth: number): Promise<Symbol[]>;
       async getDependencies(symbol: string, depth: number): Promise<Symbol[]>;
     }
     ```

2. **Reverse Index Builder**
   - File: `src/core/graph/reverse-index.ts`
   - Build index: `Symbol → [Files that import/use it]`
   - Use existing `StructuralData.imports` and `exports`
   - Materialize as: `.open_cognition/graph/import-index.json`

3. **Command Implementation**
   - File: `src/commands/blast-radius.ts`
   - ASCII tree visualization
   - Highlight critical paths (symbols with most consumers)

**Data needed**:

- Structural patterns (already have)
- Import/export relationships (in StructuralData)
- New: Import reverse index (build once, update incrementally)

**Testing**:

- Test with `GenesisOrchestrator` (should have many consumers)
- Test with leaf symbols (should have no consumers)
- Verify depth limiting works

---

## Phase 2: Explain (High Value) 🟡

### Command: `cognition-cli explain <symbol> [options]`

**Purpose**: Generate natural language explanation of what a symbol does using full graph context.

**Options**:

- `--context-depth <N>` - How deep to traverse for context (default: 2)
- `--verbose` - Include implementation details
- `--format <brief|detailed|technical>` - Explanation style

**Implementation**:

1. **Context Gatherer**
   - File: `src/core/semantic/context-gatherer.ts`

   ```typescript
   interface SymbolContext {
     symbol: StructuralData;
     dependencies: StructuralData[];
     consumers: StructuralData[];
     fileContext: string;
     architecturalRole: string;
     similarPatterns: Symbol[];
   }

   class ContextGatherer {
     async gatherContext(symbol: string, depth: number): Promise<SymbolContext>;
   }
   ```

2. **LLM Explanation Generator**
   - File: `src/core/semantic/explainer.ts`
   - Use Workbench API
   - Prompt template:

     ```
     You are analyzing a symbol in a codebase. Generate a clear explanation.

     Symbol: {name}
     Type: {type}
     Role: {architecturalRole}

     Structural Signature:
     {structuralSignature}

     Dependencies (what it uses):
     {dependencies}

     Consumers (what uses it):
     {consumers}

     Generate a {format} explanation of what this symbol does and why it exists.
     ```

3. **Caching**
   - Cache explanations keyed by `(symbol, structuralHash, format)`
   - Invalidate when structural hash changes
   - Store in: `.open_cognition/semantic/explanations/<symbol>.json`

**Testing**:

- Explain `PGCManager` (should mention lifecycle, storage, etc.)
- Explain simple interface (should be brief)
- Verify context gathering includes correct depth

---

## Phase 3: Time Travel (Unique Capability) 🟢

### Command: `cognition-cli time-travel <symbol> [options]`

**Purpose**: Show historical evolution of a symbol using the transform log.

**Options**:

- `--at <date|commit>` - Point in time to view
- `--history` - Show all historical versions
- `--diff <hash1> <hash2>` - Compare two versions semantically

**Implementation**:

1. **Historical Symbol Loader**
   - File: `src/core/temporal/symbol-history.ts`

   ```typescript
   interface SymbolVersion {
     timestamp: Date;
     transformId: string;
     structuralHash: string;
     structuralData: StructuralData;
     contentHash: string;
   }

   class SymbolHistory {
     async getVersionAt(
       symbol: string,
       timestamp: Date
     ): Promise<SymbolVersion>;
     async getAllVersions(symbol: string): Promise<SymbolVersion[]>;
     async compareVersions(v1: string, v2: string): Promise<SemanticDiff>;
   }
   ```

2. **Semantic Diff**
   - File: `src/core/temporal/semantic-diff.ts`
   - Compare structural signatures
   - Detect:
     - Signature changes (params, return types)
     - Dependency changes (new/removed imports)
     - Behavioral changes (method additions/removals)

   ```typescript
   interface SemanticDiff {
     signatureChanges: Change[];
     dependencyChanges: Change[];
     structuralChanges: Change[];
     summary: string;
   }
   ```

3. **Timeline Visualization**
   - Show version history as timeline
   - Highlight breaking changes
   - Link to git commits if available

**Testing**:

- Test on symbol that has evolved multiple times
- Verify timestamp-based lookup works
- Test semantic diff on real refactorings

---

## Phase 4: Semantic Search (Discovery) 🟣

### Command: `cognition-cli find-by-behavior "<query>" [options]`

**Purpose**: Find symbols by natural language description using semantic embeddings.

**Options**:

- `--type <class|function|interface>` - Filter by symbol type
- `--role <role>` - Filter by architectural role
- `--top-k <N>` - Number of results (default: 10)
- `--threshold <N>` - Minimum similarity score (default: 0.7)

**Implementation**:

1. **Query Embedding**
   - File: `src/core/semantic/query-search.ts`
   - Embed user query using same model as patterns
   - Search both structural and lineage pattern vector DBs

   ```typescript
   class SemanticSearch {
     async searchByBehavior(
       query: string,
       options: SearchOptions
     ): Promise<SearchResult[]>;
     async embedQuery(query: string): Promise<number[]>;
   }
   ```

2. **Hybrid Search**
   - Combine vector search with filters
   - Score by:
     - Semantic similarity (vector distance)
     - Architectural role match
     - Import popularity (more consumers = more important)

3. **Result Ranking**
   - Blend multiple signals
   - Show similarity score + explanation

**Testing**:

- "Find all classes that handle API requests"
- "Find functions that parse configuration"
- Verify filters work correctly

---

## Phase 5: Refactor Suggestions (Advanced) 🔵

### Command: `cognition-cli suggest-refactor <symbol> [options]`

**Purpose**: Find similar patterns and suggest improvements based on project conventions.

**Options**:

- `--similarity <N>` - Minimum similarity threshold (default: 0.85)
- `--pattern <name>` - Specific pattern to check against
- `--auto-apply` - Apply suggestions automatically (dangerous!)

**Implementation**:

1. **Pattern Matcher**
   - File: `src/core/refactor/pattern-matcher.ts`
   - Find structurally similar symbols
   - Compare implementations

   ```typescript
   interface RefactorSuggestion {
     type: 'rename' | 'extract' | 'inline' | 'standardize';
     reason: string;
     similarSymbols: Symbol[];
     diff: string;
     confidence: number;
   }
   ```

2. **Convention Analyzer**
   - Detect common patterns in similar code
   - Suggest alignment with majority pattern
   - Examples:
     - "5 similar managers use singleton, consider adopting"
     - "Similar functions use async/await, but yours uses .then()"

3. **Safe Application**
   - Generate proposed changes
   - Show diff
   - Require confirmation

**Testing**:

- Find class that doesn't follow common pattern
- Verify suggestions are sensible
- Test dry-run mode

---

## Phase 6: Execution Tracing (Debugging) 🟤

### Command: `cognition-cli trace-execution <symbol> [options]`

**Purpose**: Show potential execution paths through the codebase.

**Options**:

- `--entry-point <symbol>` - Start of execution
- `--max-depth <N>` - Maximum call depth (default: 5)
- `--highlight <symbol>` - Highlight specific symbol in trace

**Implementation**:

1. **Call Graph Builder**
   - File: `src/core/graph/call-graph.ts`
   - Build from lineage patterns
   - Show method calls, function invocations

   ```typescript
   interface ExecutionPath {
     path: Symbol[];
     depth: number;
     probability: number; // based on common patterns
   }

   class CallGraphBuilder {
     async buildCallGraph(entryPoint: string): Promise<ExecutionPath[]>;
   }
   ```

2. **Path Ranking**
   - Rank paths by likelihood
   - Detect cycles
   - Highlight critical paths

**Testing**:

- Trace from CLI entry point
- Verify call chains are correct
- Test cycle detection

---

## Implementation Priority

### MVP (Ship First):

1. ✅ Blast Radius - Foundation for everything else
2. ✅ Explain - Immediate value, uses blast radius
3. ✅ Time Travel - Unique selling point

### V2 (High Value):

4. Semantic Search - Discovery aid
5. Semantic Diff - Part of time travel

### V3 (Advanced):

6. Refactor Suggestions - Complex but powerful
7. Execution Tracing - Nice to have

---

## Shared Infrastructure Needed

### 1. Graph Database Layer

**File**: `src/core/graph/graph-db.ts`

```typescript
interface GraphNode {
  id: string;
  type: 'class' | 'function' | 'interface';
  filePath: string;
  structuralHash: string;
  metadata: Record<string, unknown>;
}

interface GraphEdge {
  from: string;
  to: string;
  type: 'imports' | 'extends' | 'implements' | 'calls' | 'uses';
  weight: number;
}

class GraphDB {
  async addNode(node: GraphNode): Promise<void>;
  async addEdge(edge: GraphEdge): Promise<void>;
  async traverse(
    startNode: string,
    direction: 'up' | 'down',
    depth: number
  ): Promise<GraphNode[]>;
  async shortestPath(from: string, to: string): Promise<GraphNode[]>;
}
```

**Storage**: Use SQLite for queryability, or keep as JSON with indexes

### 2. Semantic Cache Layer

**File**: `src/core/semantic/cache.ts`

```typescript
class SemanticCache {
  async get<T>(key: string, structuralHash: string): Promise<T | null>;
  async set<T>(key: string, structuralHash: string, value: T): Promise<void>;
  async invalidate(structuralHash: string): Promise<void>;
}
```

### 3. Workbench Integration Helpers

**File**: `src/core/executors/workbench-helpers.ts`

```typescript
class WorkbenchHelpers {
  async explainSymbol(context: SymbolContext, format: string): Promise<string>;
  async summarizeChanges(diff: SemanticDiff): Promise<string>;
  async embedQuery(query: string): Promise<number[]>;
}
```

---

## Testing Strategy

### Unit Tests:

- Each graph operation (traversal, path finding)
- Context gathering accuracy
- Caching behavior

### Integration Tests:

- Full command execution on real codebase
- Performance with large graphs
- Accuracy of explanations

### Acceptance Tests:

- User workflows:
  - "I want to understand what GenesisOrchestrator does"
  - "I want to see what breaks if I change PGCManager"
  - "I want to find all symbols that do X"

---

## Performance Considerations

### Indexing:

- Build indexes on genesis/pattern generation
- Incremental updates on file changes
- Graph indexes: adjacency lists for fast traversal

### Caching:

- Cache expensive LLM calls
- Cache graph traversals
- Invalidate intelligently (only affected subgraphs)

### Optimization:

- Limit traversal depth
- Parallel graph walks
- Batch LLM requests

---

## Documentation

Each command needs:

1. **Usage examples** in `--help`
2. **Tutorial** in docs showing real scenarios
3. **Architecture doc** explaining how it works
4. **Performance characteristics** (what's fast/slow)

---

## Migration Path

### Phase 1: Ship blast-radius

- Add to existing `patterns` command group
- Beta flag: `--enable-blast-radius`

### Phase 2: New command group

- `cognition-cli semantic <subcommand>`
- Subcommands: explain, search, trace, etc.

### Phase 3: Integration

- Make blast-radius first-class citizen
- Add semantic features to existing commands
- Example: `cognition-cli patterns inspect <symbol> --explain`

---

## Success Metrics

### For blast-radius:

- ✅ Can find all consumers of a symbol
- ✅ Can find all dependencies of a symbol
- ✅ Performance: <2s for typical symbol with depth=3

### For explain:

- ✅ Generates accurate, helpful explanations
- ✅ Explanations cite relevant context
- ✅ Performance: <5s including LLM call

### For time-travel:

- ✅ Can reconstruct any past state
- ✅ Semantic diff is meaningful
- ✅ Timeline shows clear evolution

---

## Notes

- All commands should work **offline** except LLM-powered ones (explain, suggest-refactor)
- Graph operations should be **deterministic** (same query → same result)
- Cache aggressively but **invalidate correctly** (structural hash is key)
- Make it **fast** - these commands should feel instant for typical use

---

## Next Steps

1. ✅ Complete lineage patterns regeneration
2. ✅ Implement blast-radius core (bidirectional traversal)
3. ✅ Add reverse import index
4. ✅ Ship blast-radius command MVP
5. Start on explain command (high value, builds on blast-radius)
