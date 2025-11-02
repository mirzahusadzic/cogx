# Sigma Session Switch - Infinite Context Architecture

## The Insight

At ~150K tokens, instead of hitting 200K limit:
1. **Compress** current context (150K → 40K via Sigma)
2. **Switch** to new session (fresh 0 tokens)
3. **Inject** compressed context as system prompt
4. **Continue** seamlessly with infinite context

This bypasses Claude's linear 200K limit with preserved paradigm shifts!

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Session Lifecycle                        │
└─────────────────────────────────────────────────────────────┘

Session 1 (0-150K tokens):
  User messages → Assistant responses → Sigma analyzes
  ↓
  150K reached → Trigger compression
  ↓
  Sigma compresses (150K → 40K lattice)
  ↓
  Reconstruct lattice → Markdown summary (40K tokens)
  ↓
Session 2 (0 tokens, injected with 40K context):
  System: [Compressed context from Session 1]
  ↓
  Continue conversation → Sigma analyzes new turns
  ↓
  150K reached again → Compress Session 1 + Session 2
  ↓
Session 3 (0 tokens, injected with 40K context):
  System: [Compressed context from Sessions 1+2]
  ↓
  ... infinite continuation
```

---

## Implementation Steps

### Step 1: Reconstruct Context from Lattice

Use existing `reconstructor.ts` to build narrative:

```typescript
import { reconstructContext } from '../../sigma/reconstructor.js';

// After compression
const compressionResult = await compressContext(...);
const lattice = compressionResult.lattice;

// Reconstruct as markdown
const reconstructed = await reconstructContext(lattice, {
  format: 'narrative',
  max_tokens: 40000,
  preserve_code: true,
  include_overlays: true,
});

// reconstructed.summary = Markdown text (~40K tokens)
```

### Step 2: Create New Session with Injected Context

Use SDK's system prompt injection:

```typescript
// Generate new session ID
const newSessionId = `${options.sessionId}-sigma-${Date.now()}`;

// Create system prompt with compressed context
const systemPrompt = `# Compressed Context (Sigma)

This session continues from a previous conversation. Below is the compressed context preserving all paradigm shifts and important decisions:

${reconstructed.summary}

---

Continue the conversation naturally, referencing this context as needed.`;

// Start new query with system prompt
const q = query({
  prompt: '[Continuing from compressed context]',
  options: {
    cwd: options.cwd,
    // Don't resume - start fresh session
    resume: undefined,
    systemPrompt: systemPrompt, // Inject compressed context
    includePartialMessages: true,
  },
});
```

### Step 3: Switch Sessions Seamlessly

Update state to use new session:

```typescript
// After compression and reconstruction
const newSessionId = `${options.sessionId}-sigma-${Date.now()}`;

// Update session ID (triggers new session on next sendMessage)
// This would need to be exposed from the hook
setSessionId(newSessionId);

// Reset token counter (fresh session)
setTokenCount({ input: 0, output: 0, total: 0 });

// Reset compression trigger for new session
compressionTriggered.current = false;

// Add system message to UI
setMessages((prev) => [
  ...prev,
  {
    type: 'system',
    content: `🔄 Session switched (compressed ${compressionResult.original_size} → ${compressionResult.compressed_size} tokens, ratio: ${compressionResult.compression_ratio.toFixed(1)}x)`,
    timestamp: new Date(),
  },
]);

// Log switch
fs.appendFileSync(
  path.join(options.cwd, 'tui-debug.log'),
  `[SIGMA] Session switched: ${options.sessionId} → ${newSessionId}\n` +
    `  Injected context: ${reconstructed.summary.length} chars (~${Math.round(reconstructed.summary.length / 4)} tokens)\n` +
    `  Ready for next 150K tokens\n\n`
);
```

### Step 4: Store Lattice for Multi-Session Compression

Save lattice to disk for future compressions:

```typescript
// After compression
const latticeFile = path.join(
  options.cwd,
  '.sigma',
  `${options.sessionId}.lattice.json`
);

fs.mkdirSync(path.dirname(latticeFile), { recursive: true });
fs.writeFileSync(
  latticeFile,
  JSON.stringify(compressionResult.lattice, null, 2)
);

// On next compression (Session 2 → Session 3):
// Load previous lattice + current turns → compress together → new session
```

---

## SDK Integration Points

### Current SDK Usage

```typescript
const q = query({
  prompt: userMessage,
  options: {
    cwd: options.cwd,
    resume: options.sessionId, // Resume existing session
    includePartialMessages: true,
  },
});
```

### After Session Switch

```typescript
const q = query({
  prompt: userMessage,
  options: {
    cwd: options.cwd,
    resume: newSessionId, // New session with compressed context
    systemPrompt: compressedContext, // Injected context
    includePartialMessages: true,
  },
});
```

**Note**: Check if SDK supports `systemPrompt` option. If not:
- Option A: Inject as first user message + assistant response
- Option B: Modify transcript.jsonl manually before resume
- Option C: Use SDK's initialization hook if available

---

## Hook API Changes

### Current Return

```typescript
return {
  messages,
  sendMessage,
  interrupt,
  isThinking,
  error,
  tokenCount,
  conversationLattice,
};
```

### After Session Switch Support

```typescript
return {
  messages,
  sendMessage,
  interrupt,
  isThinking,
  error,
  tokenCount,
  conversationLattice,
  currentSessionId, // Track active session
  compressionStats, // Last compression metrics
  sessionHistory, // Array of session IDs + compression ratios
};
```

---

## User Experience

### Before Compression (Session 1)

```
Token count: 149,523 / 200,000
[User typing...]
```

### During Compression (150K reached)

```
Token count: 150,847 / 200,000

🔄 Compressing context...
  Analyzed: 327 turns
  Preserved: 45 paradigm shifts
  Compressed: 150K → 40K (3.75x ratio)
  Switching to new session...

✓ Ready! Context preserved, continuing conversation.

Token count: 0 / 200,000 (+ 40K injected context)
[User typing...]
```

### After Switch (Session 2)

User continues typing as normal - no interruption!
- Old context available in compressed form
- New session has fresh 200K limit
- Can go another 150K tokens before next compression

---

## Multi-Session Compression

### Scenario: 3 Sessions

**Session 1** (0-150K):
- Compress: 150K → 40K lattice
- Switch to Session 2

**Session 2** (0-150K):
- Load Session 1 lattice (40K)
- Compress: Session 1 lattice (40K) + Session 2 turns (150K) → 60K lattice
- Switch to Session 3

**Session 3** (0-150K):
- Load Sessions 1+2 lattice (60K)
- Compress: Previous lattice (60K) + Session 3 turns (150K) → 80K lattice
- Switch to Session 4

**Growth rate**: ~20K tokens per session (logarithmic, not linear!)

After 10 sessions: ~200K tokens compressed (1.5M original tokens!)

---

## Implementation Checklist

### Phase 1: Basic Session Switch
- [x] Trigger compression at 150K
- [x] Build lattice with compressor
- [ ] Reconstruct context from lattice (use reconstructor.ts)
- [ ] Create new session ID
- [ ] Inject compressed context as system prompt
- [ ] Update sessionId in hook state
- [ ] Reset token counter
- [ ] Test single session switch

### Phase 2: Multi-Session Support
- [ ] Save lattice to disk (.sigma/session-id.lattice.json)
- [ ] Load previous lattice on next compression
- [ ] Merge previous lattice + current turns
- [ ] Compress combined context
- [ ] Track session history (IDs + ratios)

### Phase 3: Reconstruction Quality
- [ ] Validate reconstructed context accuracy
- [ ] Test paradigm shift preservation across switches
- [ ] Measure compression ratio over multiple sessions
- [ ] Optimize reconstruction format (markdown vs JSON)

### Phase 4: UI Polish
- [ ] Show compression progress bar
- [ ] Display session history in UI
- [ ] Allow manual compression trigger
- [ ] Show injected context preview

---

## Key Questions to Resolve

1. **Does SDK support `systemPrompt` in options?**
   - If yes: Use it for clean injection
   - If no: Need workaround (modify transcript or inject as fake turns)

2. **Should we interrupt user during compression?**
   - Option A: Block input during compression (~2-5 seconds)
   - Option B: Queue messages and process after switch

3. **How to handle embeddings across sessions?**
   - Embeddings stored in lattice nodes
   - Load previous embeddings for novelty calculation
   - New turns compare against compressed + recent history

4. **What if compression fails?**
   - Fallback: Continue current session (hit 200K limit naturally)
   - Warn user: "Compression failed, approaching context limit"

---

## Next Steps

1. **Verify SDK capabilities**: Check if `systemPrompt` supported
2. **Implement basic switch**: Reconstruct → new session → inject
3. **Test single switch**: Validate context preserved across sessions
4. **Measure quality**: Compare responses before/after switch
5. **Polish UX**: Add progress indicators and session history

Once validated:
- **Infinite context achieved!** 🎯
- Sessions can continue indefinitely
- Paradigm shifts always preserved
- Linear 200K limit bypassed with logarithmic growth
