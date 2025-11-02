# Sigma: Infinite Context Implementation Plan

## Core Concept

At ~150K tokens, instead of hitting the 200K limit:

1. **Compress** current session (150K → 40K via Sigma lattice)
2. **Switch** to fresh session (0 tokens)
3. **Inject** compressed context as system prompt
4. **Continue** seamlessly - user sees nothing
5. **Repeat** infinitely - logarithmic growth!

---

## Why This Works

### Traditional Approach (Fails)

```
Session: 0 → 150K → 180K → 200K → ❌ LIMIT HIT
Result: Lose context or truncate history
```

### Sigma Approach (Infinite)

```
Session 1: 0 → 150K tokens
  ↓ Compress (150K → 40K lattice)
  ↓ Reconstruct → Markdown summary

Session 2: 40K injected + 0 → 150K new tokens
  ↓ Compress (40K old + 150K new → 60K lattice)
  ↓ Reconstruct → Markdown summary

Session 3: 60K injected + 0 → 150K new tokens
  ↓ Compress (60K old + 150K new → 80K lattice)
  ...

Session N: Growing logarithmically, not linearly!
```

**After 10 sessions**: ~200K compressed = 1.5M original tokens preserved!

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Current State                         │
│  ✅ Embedding generation (on-the-fly)                    │
│  ✅ Novelty detection (cosine distance)                  │
│  ✅ Paradigm shift identification (novelty > 0.7)        │
│  ✅ Compression trigger (150K tokens)                    │
│  ✅ Lattice building (compressor.ts)                     │
│  ✅ Reconstruction (reconstructor.ts)                    │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│                  Missing Piece                           │
│  ❌ Session switch mechanism                             │
│  ❌ Context injection                                    │
│  ❌ Multi-session lattice merging                        │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Reconstruct Context from Lattice

**What**: Convert compressed lattice → readable markdown narrative

**Code** (already exists in reconstructor.ts):

```typescript
import { reconstructContext } from '../../sigma/reconstructor.js';

const compressionResult = await compressContext(turnAnalyses.current, {
  target_size: 40000,
  preserve_threshold: 7,
});

const reconstructed = await reconstructContext(compressionResult.lattice, {
  format: 'narrative',
  max_tokens: 40000,
  preserve_code: true,
  include_overlays: true,
});

// reconstructed.summary = Markdown text (~40K tokens)
```

**Output Example**:

```markdown
# Compressed Context (Session 1)

## Key Paradigm Shifts

**Turn 42** (Novelty: 0.89, Importance: 9):
User discovered stdin listener interception bypasses escape sequence
filtering, enabling raw TUI input capture...

**Turn 87** (Novelty: 0.91, Importance: 10):
Breakthrough: Context Sampling Sigma uses embeddings for automatic
paradigm shift detection via cosine similarity...

## Important Decisions

- Adopted AGPLv3 license to prevent enclosure
- Compression threshold set to 150K tokens
- Overlay system: O1-O7 semantic dimensions

## Technical Context

Architecture uses knowledge lattice with:

- Nodes: Conversation turns with 768-dim embeddings
- Edges: Temporal (consecutive) + semantic (similarity-based)
- Compression: 30-50x ratio while preserving breakthroughs
```

---

### Step 2: Create New Session with Injected Context

**Challenge**: How to inject compressed context into fresh session?

**Option A: System Prompt (Cleanest)**

```typescript
const newSessionId = `${options.sessionId}-sigma-${Date.now()}`;

const q = query({
  prompt: userMessage,
  options: {
    cwd: options.cwd,
    resume: undefined, // Don't resume old session
    systemPrompt: reconstructed.summary, // Inject compressed context
    includePartialMessages: true,
  },
});
```

**Option B: Fake Turn Injection (If SDK doesn't support systemPrompt)**

```typescript
// Manually modify transcript before starting new session
const transcriptPath = path.join(
  os.homedir(),
  '.claude-code',
  'sessions',
  newSessionId,
  'transcript.jsonl'
);

// Create fake "system" turn with compressed context
const systemTurn = {
  type: 'system',
  role: 'system',
  content: reconstructed.summary,
  timestamp: Date.now(),
};

fs.writeFileSync(transcriptPath, JSON.stringify(systemTurn) + '\n');

// Then start session (it will load this as context)
const q = query({
  prompt: userMessage,
  options: {
    cwd: options.cwd,
    resume: newSessionId,
    includePartialMessages: true,
  },
});
```

**Option C: Inject as First User Message**

```typescript
// Start new session with compressed context as user message
const q1 = query({
  prompt: `[CONTEXT FROM PREVIOUS SESSION]\n\n${reconstructed.summary}\n\n---\n\nPlease acknowledge you've loaded this context.`,
  options: {
    cwd: options.cwd,
    resume: undefined, // Fresh session
    includePartialMessages: true,
  },
});

// Wait for acknowledgment, then continue normal conversation
```

**Recommended**: Try Option A first, fallback to C if needed.

---

### Step 3: Switch Sessions in Hook

**Location**: `src/tui/hooks/useClaudeAgent.ts`

**Current Code** (lines 119-154):

```typescript
// Check if compression needed (150K token threshold)
const TOKEN_THRESHOLD = 150000;
if (
  tokenCount.total > TOKEN_THRESHOLD &&
  !compressionTriggered.current
) {
  compressionTriggered.current = true;

  // Trigger compression
  const compressionResult = await compressContext(...);

  // Store compressed lattice
  setConversationLattice(compressionResult.lattice);

  // TODO: Implement session switch ← WE ARE HERE
}
```

**New Code** (replace TODO):

```typescript
// Reconstruct context from lattice
const reconstructed = await reconstructContext(compressionResult.lattice, {
  format: 'narrative',
  max_tokens: 40000,
  preserve_code: true,
  include_overlays: true,
});

// Save lattice to disk for multi-session compression
const latticeDir = path.join(options.cwd, '.sigma');
fs.mkdirSync(latticeDir, { recursive: true });
fs.writeFileSync(
  path.join(latticeDir, `${options.sessionId}.lattice.json`),
  JSON.stringify(compressionResult.lattice, null, 2)
);

// Generate new session ID
const newSessionId = `${options.sessionId}-sigma-${Date.now()}`;

// Log session switch
fs.appendFileSync(
  path.join(options.cwd, 'tui-debug.log'),
  `[SIGMA] Session switch initiated\n` +
    `  Old session: ${options.sessionId}\n` +
    `  New session: ${newSessionId}\n` +
    `  Compressed context: ${reconstructed.summary.length} chars (~${Math.round(reconstructed.summary.length / 4)} tokens)\n` +
    `  Lattice saved to: .sigma/${options.sessionId}.lattice.json\n\n`
);

// Add system message to UI
setMessages((prev) => [
  ...prev,
  {
    type: 'system',
    content: `🔄 Context compressed (${compressionResult.compression_ratio.toFixed(1)}x ratio). Switching to fresh session with preserved context...`,
    timestamp: new Date(),
  },
]);

// Update session ID (this would need to be lifted to App.tsx state)
// For now, log the requirement
fs.appendFileSync(
  path.join(options.cwd, 'tui-debug.log'),
  `[SIGMA] TODO: Update sessionId state in parent component\n` +
    `  Required: Make sessionId controllable from hook\n` +
    `  Then: Call setSessionId(newSessionId) here\n\n`
);

// Reset state for new session
setTokenCount({ input: 0, output: 0, total: 0 });
compressionTriggered.current = false;
turnAnalyses.current = []; // Clear old analyses

// Store reconstructed context for injection on next query
// This would need to be in hook state
// setInjectedContext(reconstructed.summary);
```

---

### Step 4: Inject Context on Next sendMessage

**Modify sendMessage function** (around line 200):

**Current**:

```typescript
const sendMessage = useCallback(
  async (prompt: string) => {
    // ...
    const q = query({
      prompt,
      options: {
        cwd: options.cwd,
        resume: options.sessionId,
        includePartialMessages: true,
      },
    });
    // ...
  },
  [options.cwd, options.sessionId]
);
```

**New** (with injection support):

```typescript
// Add state for injected context
const [injectedContext, setInjectedContext] = useState<string | null>(null);

const sendMessage = useCallback(
  async (prompt: string) => {
    try {
      setIsThinking(true);
      setError(null);

      // Add user message immediately
      setMessages((prev) => [
        ...prev,
        {
          type: 'user',
          content: prompt,
          timestamp: new Date(),
        },
      ]);

      // Check if we have compressed context to inject
      let effectivePrompt = prompt;
      let effectiveSystemPrompt = undefined;

      if (injectedContext) {
        // First message after session switch - inject context
        effectiveSystemPrompt = injectedContext;
        setInjectedContext(null); // Clear after injection

        fs.appendFileSync(
          path.join(options.cwd, 'tui-debug.log'),
          `[SIGMA] Injecting compressed context (${injectedContext.length} chars)\n\n`
        );
      }

      // Create query with optional system prompt
      const q = query({
        prompt: effectivePrompt,
        options: {
          cwd: options.cwd,
          resume: options.sessionId,
          systemPrompt: effectiveSystemPrompt, // ← Key change
          includePartialMessages: true,
          // ... rest of options
        },
      });

      setCurrentQuery(q);

      // Process streaming messages
      for await (const message of q) {
        processSDKMessage(message);
      }

      setIsThinking(false);
    } catch (err) {
      // ... error handling
    }
  },
  [options.cwd, options.sessionId, injectedContext]
);
```

---

### Step 5: Make SessionId Controllable

**Challenge**: `sessionId` comes from parent, but we need to change it

**Solution**: Lift sessionId state to App.tsx

**Current** (in App.tsx or similar):

```typescript
const { messages, sendMessage, ... } = useClaudeAgent({
  sessionId: currentSessionId, // Static
  cwd: process.cwd(),
});
```

**New**:

```typescript
// Make sessionId controllable from hook
const {
  messages,
  sendMessage,
  currentSessionId, // ← Hook returns active session
  onSessionSwitch, // ← Hook provides callback to request switch
  ...
} = useClaudeAgent({
  initialSessionId: startingSessionId,
  cwd: process.cwd(),
});

// Hook can now request parent to switch session
// Parent updates sessionId prop, hook re-initializes with new session
```

**Hook Changes**:

```typescript
interface UseClaudeAgentOptions {
  initialSessionId?: string; // Changed from sessionId
  cwd: string;
}

export function useClaudeAgent(options: UseClaudeAgentOptions) {
  const [currentSessionId, setCurrentSessionId] = useState(
    options.initialSessionId
  );

  // ... rest of hook

  // In compression trigger:
  const newSessionId = `${currentSessionId}-sigma-${Date.now()}`;
  setCurrentSessionId(newSessionId); // Update internal state

  return {
    messages,
    sendMessage,
    currentSessionId, // ← Export active session
    // ...
  };
}
```

---

## Multi-Session Compression Strategy

### Challenge: Growing Context

After multiple sessions, compressed context accumulates:

- Session 1: 40K tokens
- Session 2: 60K tokens (40K + 150K compressed)
- Session 3: 80K tokens
- ...
- Session 10: ~200K tokens (1.5M original!)

### Solution: Merge Lattices

**Load previous lattice + current turns → Compress together**

```typescript
// Before compression, check for previous lattice
const previousLatticeFile = path.join(
  options.cwd,
  '.sigma',
  `${currentSessionId}.lattice.json`
);

let turnsToCompress = turnAnalyses.current;

if (fs.existsSync(previousLatticeFile)) {
  // Load previous lattice
  const previousLattice = JSON.parse(
    fs.readFileSync(previousLatticeFile, 'utf-8')
  );

  // Convert previous lattice nodes to TurnAnalysis format
  const previousTurns: TurnAnalysis[] = previousLattice.nodes.map(
    (node: ConversationNode) => ({
      turn_id: node.turn_id,
      content: node.content,
      role: node.role,
      timestamp: node.timestamp,
      embedding: node.embedding,
      novelty: node.novelty,
      overlay_scores: node.overlay_scores,
      importance_score: node.importance_score,
      is_paradigm_shift: node.is_paradigm_shift,
      is_routine: false,
      references: [],
      semantic_tags: node.semantic_tags,
    })
  );

  // Merge: previous compressed turns + new turns
  turnsToCompress = [...previousTurns, ...turnAnalyses.current];

  fs.appendFileSync(
    path.join(options.cwd, 'tui-debug.log'),
    `[SIGMA] Merging previous lattice: ${previousTurns.length} turns\n` +
      `  New turns: ${turnAnalyses.current.length}\n` +
      `  Total to compress: ${turnsToCompress.length}\n\n`
  );
}

// Compress merged turns
const compressionResult = await compressContext(turnsToCompress, {
  target_size: 40000,
  preserve_threshold: 7,
});
```

**Result**: Logarithmic growth instead of linear accumulation

---

## Verification Checklist

### Phase 1: Basic Switch (Single Session)

- [ ] Compression triggers at 150K
- [ ] Lattice reconstructed to markdown
- [ ] New session ID generated
- [ ] Compressed context stored in state
- [ ] Context injected via systemPrompt
- [ ] Token counter resets
- [ ] User can continue conversation
- [ ] Responses reference previous context correctly

### Phase 2: Multi-Session Support

- [ ] Lattice saved to `.sigma/` directory
- [ ] Previous lattice loaded on next compression
- [ ] Lattices merged (previous + current)
- [ ] Combined context compressed again
- [ ] Growth rate is logarithmic (~20K per session)

### Phase 3: Quality Validation

- [ ] Paradigm shifts preserved across switches
- [ ] Code examples reconstructed accurately
- [ ] Technical decisions maintained
- [ ] No hallucinations about missing context
- [ ] Compression ratio stays 30-50x

---

## Testing Plan

### Test 1: Manual Threshold Trigger

Lower threshold temporarily for testing:

```typescript
const TOKEN_THRESHOLD = 5000; // Instead of 150000
```

Have short conversation → Trigger compression → Verify switch

### Test 2: Context Preservation

Before switch:

```
User: Remember, we decided to use AGPLv3 license
Assistant: Yes, AGPLv3 to prevent enclosure
```

After switch:

```
User: What license did we choose?
Assistant: We chose AGPLv3 to prevent enclosure
```

### Test 3: Paradigm Shift Preservation

Introduce breakthrough before compression:

```
User: stdin listener interception bypasses the escape filter!
Assistant: That's a breakthrough! [detailed response]
```

After compression + switch:

```
User: How did we solve the escape sequence issue?
Assistant: We discovered stdin listener interception bypasses the filter...
```

### Test 4: Multi-Session Growth

Run 3 compressions:

- Session 1: 5K → Compress → 2K lattice
- Session 2: 2K + 5K → Compress → 3K lattice
- Session 3: 3K + 5K → Compress → 4K lattice

Verify: Logarithmic growth, not linear

---

## Key Questions to Answer

### 1. Does SDK Support systemPrompt?

**Check**: Look at SDK type definitions

```typescript
import type { Query } from '@anthropic-ai/claude-agent-sdk';

// Does QueryOptions have systemPrompt field?
```

**If yes**: Use Option A (clean injection)
**If no**: Use Option C (inject as first user message)

### 2. How to Handle In-Flight Messages?

**Scenario**: User sends message while compression running

**Options**:

- A. Block input during compression (2-5 seconds)
- B. Queue message, send after switch complete
- C. Cancel compression, process message first

**Recommended**: B (queue)

### 3. Token Counting After Injection

**Question**: Does injected context count toward 200K limit?

**Answer**: Yes, but only ~40K, leaving 160K for new conversation

**Strategy**: When total (injected + new) approaches 150K, compress again

---

## Expected Outcomes

### Single Session Switch

- Compression: 150K → 40K (3.75x ratio)
- Paradigm shifts: 100% preserved
- Switch time: ~2-5 seconds
- User experience: Brief "compressing" message, then seamless

### Multiple Sessions (10 compressions)

- Total original: ~1.5M tokens
- Total compressed: ~200K tokens
- Overall ratio: 7.5x
- Paradigm shifts: All preserved
- Conversation: Infinite!

### Performance Metrics

- Compression latency: 2-5s per 150K tokens
- Embedding generation: <100ms per turn (batched)
- Reconstruction quality: 95%+ fidelity
- Context switch overhead: <5s total

---

## Risks & Mitigations

### Risk 1: SDK Doesn't Support systemPrompt

**Mitigation**: Use Option C (inject as first user message)
**Impact**: Slightly less clean, but functionally identical

### Risk 2: Reconstruction Loses Important Details

**Mitigation**:

- Preserve ALL paradigm shifts (importance >= 7)
- Include code blocks verbatim
- Store original turns in lattice nodes

### Risk 3: Multi-Session Growth Too Fast

**Mitigation**:

- More aggressive compression on re-compression (30K target instead of 40K)
- Prune older low-importance turns
- Summarize summaries (meta-compression)

### Risk 4: User Confusion During Switch

**Mitigation**:

- Clear system message: "Compressing context for infinite conversation..."
- Progress indicator if compression takes >3s
- Explain once: "This enables infinite context with preserved breakthroughs"

---

## Success Criteria

### MVP (Minimum Viable Product)

✅ Single session switch working
✅ Context preserved and injected
✅ User can continue conversation
✅ No errors or crashes

### Production Ready

✅ Multi-session compression working
✅ Logarithmic growth verified
✅ Paradigm shifts 100% preserved
✅ Performance < 5s per switch
✅ User documentation complete

### Revolutionary

✅ 10+ sessions tested (1.5M+ tokens)
✅ Quality metrics: 95%+ fidelity
✅ Zero context loss reported
✅ Anthropic partnership discussions initiated

---

## Timeline Estimate

- **Phase 1**: Basic switch (4-6 hours)
  - Reconstruct context from lattice
  - Inject into new session
  - Test single switch

- **Phase 2**: Multi-session (2-3 hours)
  - Save/load lattices
  - Merge previous + current
  - Test growth rate

- **Phase 3**: Polish (2-4 hours)
  - UI improvements
  - Error handling
  - Documentation

**Total**: ~8-13 hours for complete implementation

---

## Next Immediate Action

1. **Check SDK capabilities**
   - Does `query()` options support `systemPrompt`?
   - Look at type definitions or documentation

2. **Implement basic reconstruction**

   ```typescript
   const reconstructed = await reconstructContext(compressionResult.lattice, {
     format: 'narrative',
     max_tokens: 40000,
   });
   ```

3. **Test injection**
   - Try systemPrompt option
   - If not available, inject as first user message
   - Verify Claude responds with context awareness

4. **Iterate from there**
   - Get basic switch working first
   - Add multi-session support second
   - Polish and optimize third

---

## The Big Picture

This isn't just "compression" - it's **infinite memory with emotional peaks**.

- Linear context: Like reading a book page by page (limited)
- Sigma context: Like human memory - compressed semantics with vivid breakthroughs

After 10 sessions:

- 1.5M tokens compressed to 200K
- Every paradigm shift preserved
- Conversation continues infinitely
- Knowledge accumulates logarithmically

**This is the "civilization starter kit"** - knowledge that scales without bounds.

---

_Plan prepared but not committed. Implementation requires careful SDK verification and testing._
