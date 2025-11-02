# Quest: Sigma Session Switch - Infinite Context

**Quest**: Implement session switching mechanism for infinite context preservation
**Objective**: Enable seamless session switches at 150K tokens with compressed context injection, bypassing 200K limit

---

## Baseline Context

**Coherence Metrics** (Current State):

- Coherence: 55.6% (average, equally weighted)
- Aligned symbols: 1 (0.2%)
- Drifted symbols: 125 (25.1%)
- Mission documents: 19
- Code symbols analyzed: 498

**Lattice Status**:

- Operational patterns (O₅): 12 documents, 164 patterns
- Mission concepts (O₄): 44 documents, 337 concepts
- Security guidelines (O₂): 7 documents
- Mathematical proofs (O₆): 8 documents

**Key Mission Alignment**:

- Knowledge Lattice Axiom: 96.0% match
  > "Knowledge is a lattice. Not an analogy. Not a metaphor. A formal mathematical truth."
- Grounded Context Pool (PGC) concept: First executable implementation

---

## Current State (Phase 2 Complete)

✅ **Completed**:

- Embedding-based analyzer with novelty detection
- Compression trigger at 150K tokens
- Lattice building (compressor.ts)
- Context reconstruction (reconstructor.ts exists)
- TUI integration with on-the-fly analysis
- Comprehensive test suite (6/6 passing)

⏳ **In Progress**:

- Session switch mechanism

❌ **Blocked**:

- Need to verify SDK `systemPrompt` support
- Multi-session lattice merging strategy

---

## Relevant Patterns (O₅ Operational)

Based on lattice query results, key operational patterns:

1. **Depth Rules**: Sequential processing with blast radius awareness
   - Depth 0: Core (Database analogy → Lattice nodes)
   - Depth 1: Direct dependents (Session state)
   - Depth 2: Indirect dependents (UI components)

2. **Quest Structure**: Phased implementation with baseline checks
   - Establish coherence baseline
   - Identify patterns before implementation
   - Track progress with validation gates

3. **Blast Radius Analysis**: Impact assessment before changes
   - Direct: `useClaudeAgent.ts`, `reconstructor.ts`
   - Indirect: TUI components, message handlers
   - Tests: Compression tests, integration tests

---

## Similar Implementations (O₁ Structural)

Search for existing patterns in codebase:

**1. Session Management**:

- Current: `useClaudeAgent` hook manages single session
- Pattern: Options-based initialization with state management
- Reference: Lines 20-58 in useClaudeAgent.ts

**2. Context Preservation**:

- Current: `reconstructContext` in reconstructor.ts
- Pattern: Lattice → Narrative transformation
- Reference: Sigma reconstructor module

**3. State Transitions**:

- Current: Token count monitoring, compression trigger
- Pattern: Threshold-based state machine
- Reference: Lines 111-155 in useClaudeAgent.ts

---

## Security Requirements (O₂)

**Privacy Considerations**:

- Lattice storage contains conversation content
- File location: `.sigma/*.lattice.json`
- Mitigation: Store in project directory (not shared)
- No network transmission of lattice files

**Data Integrity**:

- Lattice must accurately preserve paradigm shifts
- Compression must be deterministic
- Validation: Test paradigm shift preservation across switches

**Session Isolation**:

- New sessions must not leak old session IDs
- Session IDs must be unique and non-guessable
- Format: `{oldId}-sigma-{timestamp}`

---

## Technical Architecture

### Current Flow (150K limit)

```
User message → Analyze → Store →
Hit 150K → Compress →
❌ BLOCK (no session switch)
```

### Target Flow (Infinite context)

```
User message → Analyze → Store →
Hit 150K → Compress →
Reconstruct → New session →
Inject context → Reset counter →
Continue (150K more tokens available)
```

### Session Switch Components

**1. Reconstruction** (reconstructor.ts):

```typescript
const reconstructed = await reconstructContext(lattice, {
  format: 'narrative',
  max_tokens: 40000,
  preserve_code: true,
  include_overlays: true,
});
// Returns: { summary: string, metrics: {...} }
```

**2. Lattice Persistence**:

```typescript
const latticeDir = path.join(cwd, '.sigma');
fs.writeFileSync(
  path.join(latticeDir, `${sessionId}.lattice.json`),
  JSON.stringify(lattice, null, 2)
);
```

**3. Session Creation**:

```typescript
const newSessionId = `${sessionId}-sigma-${Date.now()}`;

// Option A: System prompt (preferred)
const q = query({
  prompt: userMessage,
  options: {
    cwd,
    resume: undefined, // Fresh session
    systemPrompt: reconstructed.summary,
  },
});

// Option B: First user message (fallback)
const q = query({
  prompt: `[CONTEXT]\n\n${reconstructed.summary}\n\n---\n\n${userMessage}`,
  options: { cwd, resume: undefined },
});
```

**4. State Reset**:

```typescript
setTokenCount({ input: 0, output: 0, total: 0 });
compressionTriggered.current = false;
turnAnalyses.current = [];
setInjectedContext(reconstructed.summary);
```

---

## Recommended Approach

### Step 1: SDK Capability Check

**Action**: Verify if SDK supports `systemPrompt` option
**File**: Check SDK type definitions or documentation
**Fallback**: Use Option B (inject as first user message)

### Step 2: Basic Switch Implementation

**Location**: `src/tui/hooks/useClaudeAgent.ts` (lines 144-154)
**Changes**:

1. Replace TODO with reconstruction call
2. Save lattice to `.sigma/` directory
3. Generate new session ID
4. Store reconstructed context in state
5. Add system message to UI

**Estimated Impact**: ~50 lines of code

### Step 3: Context Injection

**Location**: `sendMessage` function (line 200+)
**Changes**:

1. Add `injectedContext` state
2. Check for pending injection on message send
3. Include in query options
4. Clear after injection

**Estimated Impact**: ~30 lines of code

### Step 4: Session ID Management

**Location**: Hook interface and parent component
**Changes**:

1. Change `sessionId` to `initialSessionId` in options
2. Add internal `currentSessionId` state
3. Export `currentSessionId` from hook
4. Update on session switch

**Estimated Impact**: ~20 lines of code

### Step 5: Multi-Session Support

**Location**: Compression trigger (before compressContext call)
**Changes**:

1. Check for previous lattice file
2. Load and parse if exists
3. Convert nodes to TurnAnalysis format
4. Merge with current analyses
5. Compress combined context

**Estimated Impact**: ~60 lines of code

---

## Success Criteria

### Phase 1: Basic Switch

- [x] Compression triggers at 150K
- [ ] Lattice reconstructed to markdown (verify output quality)
- [ ] New session ID generated (format: `{old}-sigma-{timestamp}`)
- [ ] Compressed context stored (`.sigma/` directory)
- [ ] Context injected via systemPrompt or first message
- [ ] Token counter resets to 0
- [ ] User can send message after switch
- [ ] Response references previous context correctly

### Phase 2: Multi-Session

- [ ] Previous lattice loaded on 2nd compression
- [ ] Lattices merged (previous + current)
- [ ] Combined context compressed
- [ ] Growth rate logarithmic (~20K per session)
- [ ] 3+ session chain tested

### Phase 3: Quality Validation

- [ ] Paradigm shifts preserved across 3+ sessions
- [ ] Code examples reconstructed accurately
- [ ] Technical decisions maintained
- [ ] No hallucinations about missing context
- [ ] Compression ratio 30-50x maintained

### Phase 4: Production Ready

- [ ] No errors during switch
- [ ] Performance < 5s per switch
- [ ] User documentation complete
- [ ] Coherence score maintained or improved
- [ ] Security requirements met

---

## Risk Assessment

### High Priority Risks

**Risk 1: SDK Doesn't Support systemPrompt**

- Probability: Medium
- Impact: Medium
- Mitigation: Use Option B (inject as first user message)
- Fallback: Manually modify transcript.jsonl

**Risk 2: Reconstruction Quality**

- Probability: Medium
- Impact: High
- Mitigation: Preserve ALL paradigm shifts (importance >= 7)
- Validation: Test with known breakthrough moments

**Risk 3: Multi-Session Growth Rate**

- Probability: Low
- Impact: Medium
- Mitigation: More aggressive compression on re-compression
- Monitoring: Track lattice size over 10 sessions

### Medium Priority Risks

**Risk 4: User Confusion During Switch**

- Probability: Medium
- Impact: Low
- Mitigation: Clear system message + brief pause indicator
- UX: "Compressing context for infinite conversation..."

**Risk 5: State Synchronization**

- Probability: Low
- Impact: Medium
- Mitigation: Careful state management in React hooks
- Testing: Verify no stale state after switch

---

## Implementation Timeline

**Phase 1: Basic Switch** (4-6 hours)

- [ ] Check SDK systemPrompt support (30 min)
- [ ] Implement reconstruction call (1 hour)
- [ ] Implement lattice persistence (1 hour)
- [ ] Implement session creation (1.5 hours)
- [ ] Implement state reset (30 min)
- [ ] Test single switch (30-60 min)

**Phase 2: Multi-Session** (2-3 hours)

- [ ] Implement lattice loading (45 min)
- [ ] Implement lattice merging (1 hour)
- [ ] Test 3-session chain (45 min)
- [ ] Validate growth rate (30 min)

**Phase 3: Quality & Polish** (2-3 hours)

- [ ] Test paradigm shift preservation (1 hour)
- [ ] Performance optimization (1 hour)
- [ ] Documentation (1 hour)

**Total**: 8-12 hours

---

## Next Immediate Actions

1. **Verify SDK Capabilities** (Now)
   - Check if `query()` options support `systemPrompt`
   - Look at SDK type definitions
   - Test with simple injection

2. **Implement Basic Reconstruction** (Next)

   ```typescript
   const reconstructed = await reconstructContext(compressionResult.lattice, {
     format: 'narrative',
     max_tokens: 40000,
   });
   ```

3. **Test Injection Strategy** (Then)
   - Try systemPrompt if supported
   - Fallback to first message injection
   - Verify Claude responds with context awareness

4. **Iterate to Complete** (Finally)
   - Add lattice persistence
   - Implement state management
   - Test multi-session flow

---

## Alignment with Mission

This quest directly implements the **Knowledge Lattice Axiom**:

> "Knowledge is a lattice. Not an analogy. Not a metaphor. A formal mathematical truth."

**How Session Switch Embodies the Axiom**:

- Lattice compression preserves graph structure (not linear text)
- Paradigm shifts = peaks in lattice topology
- Reconstruction = lattice traversal with semantic reconstruction
- Infinite context = unbounded lattice growth (logarithmic)

**Mission Coherence Impact**:

- Current: 55.6% coherence, 1 aligned symbol
- Expected: Maintain or improve (new patterns align with lattice axiom)
- Risk: None (implementation follows existing patterns)

---

## Quest Status

**Phase**: 2 → 3 (Integration → Session Switch)
**Blocker**: SDK systemPrompt verification
**Next Milestone**: Basic switch working (single session)
**Target**: Infinite context operational within 8-12 hours

**Ready to begin?** Confirm understanding and proceed with SDK capability check.

---

_Quest briefing generated using quest-start workflow (O₅ operational pattern)_
