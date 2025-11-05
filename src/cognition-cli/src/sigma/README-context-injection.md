# Real-Time Lattice Context Injection

## Problem

During fluent conversation, Claude can lose track of workflow context when users make vague continuation requests:

```
User: [Long exploration of JIRA structure]
Claude: [Comprehensive analysis with implementation recommendations]
User: "ok please implement"
Claude: "What would you like me to implement?" ❌
```

The SDK session preserves ALL messages as tokens, but treats them equally:

- No understanding of importance (routine "good" vs paradigm-shifting insights)
- No overlay activation tracking (O1 structural, O5 operational, etc.)
- No semantic filtering (relevant context vs noise)

## Solution: Lattice-Based Context Injection

### Architecture

The lattice already tracks rich metadata for every turn:

- **Importance scores** (1-10): How significant is this turn?
- **Overlay activation** (O1-O7): Which aspects of cognition are engaged?
- **Embeddings** (768-dim): Semantic representation for similarity search
- **Paradigm shifts**: Breakthrough moments (novelty > 0.7)

**Real-time context injection** uses this lattice data to:

1. **Detect continuation requests** via pattern matching:
   - "implement", "do it", "continue", "let's go", etc.
   - Short messages (< 100 chars) with action verbs

2. **Query in-memory lattice** (no LLM, no tool calls):
   - Semantic search using cosine similarity on embeddings
   - Boost by importance score (high-value turns ranked higher)
   - Boost by overlay activation (O1/O4/O5 for implementation tasks)
   - Filter out routine turns (importance < 5)

3. **Inject top-K relevant context** directly into user message:

   ```
   [Recent context 1] I explained:
   The JIRA structure uses bridge tables to link...

   [Recent context 2] You asked:
   How can I reuse this for my workbench?

   ---

   Based on the above context:
   ok please implement
   ```

4. **Transparent to Claude**: No tool calls, no latency, just enhanced input

### Benefits

✅ **Real-time**: Works during fluent conversation (not just after compression)
✅ **Lattice-native**: Uses existing turn analyses with overlay scores
✅ **Semantic**: Vector similarity ensures relevance
✅ **Intelligent filtering**: Skips noise ("good", "thanks"), keeps high-importance turns
✅ **No overhead**: No LLM calls, no tool invocations, just in-memory queries

### When It Activates

**Automatically activates when:**

- User sends a continuation request (pattern detected)
- Lattice has history (`turnAnalyses.current.length > 0`)
- Relevant context found (relevance score > 0.4)

**Does NOT activate when:**

- First message (no history)
- Detailed requests (> 100 chars with context already provided)
- Low relevance (no similar high-importance turns found)
- After compression (uses injected recap instead)

### Configuration

```typescript
await injectRelevantContext(userMessage, turnAnalyses, embedder, {
  debug: true, // Enable logging
  minRelevance: 0.4, // Threshold for injection (0-1)
  windowSize: 20, // Recent turns to consider
  maxContextTurns: 3, // Max snippets to inject
  maxSnippetLength: 400, // Chars per snippet
});
```

### Implementation Details

**Relevance scoring:**

```typescript
relevance = similarity * importanceBoost * overlayBoost;

where: similarity = cosineSimilarity(userEmbed, turnEmbed); // 0-1
importanceBoost = 1 + importance_score / 10; // 1.0-2.0x
overlayBoost = 1 + (O1 + O4 + O5) / 30; // 1.0-2.0x
```

**Example scores:**

- Routine turn (importance=3, O1=2): `0.7 * 1.3 * 1.07 = 0.97`
- Important turn (importance=8, O1=9, O5=7): `0.7 * 1.8 * 1.53 = 1.93` ✅

**Overlay boosting:**

- **O1 (structural)**: Architecture, components, design patterns
- **O4 (mission)**: Goals, objectives, what we're trying to build
- **O5 (operational)**: Commands, workflows, implementation steps

### Testing

**To test with debug logging:**

```bash
npm run build
cd ~/src/project  # Or any project
WORKBENCH_URL=http://localhost:8000 WORKBENCH_API_KEY=dummy-key \
  node dist/cli.js tui --debug
```

**Test scenario:**

1. Start a conversation about implementing something
2. Provide detailed context (5+ important turns)
3. Send vague continuation: "ok let's do it"
4. Check debug logs for `[Context Injector]` messages
5. Verify Claude responds with understanding (not "what do you want?")

### Future Enhancements

- [ ] Add O3 (lineage) detection for cross-references ("as we discussed...")
- [ ] Track workflow state explicitly (quest name, current phase)
- [ ] Support multi-turn workflows (e.g., "continue from step 3")
- [ ] Add UI indicator when context is injected
- [ ] Configurable patterns per user preferences

### See Also

- `src/sigma/context-injector.ts` - Implementation
- `src/sigma/analyzer-with-embeddings.ts` - Turn analysis
- `src/sigma/context-reconstructor.ts` - Quest mode detection (post-compression)
- `src/sigma/recall-tool.ts` - Explicit memory tool (cold boot scenarios)
