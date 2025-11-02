# Sigma Integration Test Plan

## Objective

Validate that Context Sampling Sigma integrates correctly with the TUI and performs on-the-fly compression.

## Test Scenarios

### Scenario 1: Embedding Generation

**Test**: Verify embeddings are generated for each turn

**Steps**:
1. Start TUI session
2. Send a few messages (user + assistant)
3. Check `tui-debug.log` for embedding generation
4. Verify no errors in analysis

**Expected**:
- Each user/assistant message triggers `analyzeTurn`
- Embeddings stored with each analysis
- No SIGMA ERROR messages in log

---

### Scenario 2: Novelty Detection

**Test**: Verify novelty increases for novel content

**Steps**:
1. Send repetitive message ("hello")
2. Send novel message ("Let's implement a context compression system using embeddings and lattice graphs")
3. Check turn analyses for novelty scores

**Expected**:
- Repetitive message: low novelty (< 0.4)
- Novel message: high novelty (> 0.6)
- Paradigm shift detected if novelty > 0.7

---

### Scenario 3: Compression Trigger

**Test**: Verify compression triggers at 180K tokens

**Note**: This requires a long conversation. For testing, we can:
- Option A: Lower threshold temporarily (e.g., 5K tokens)
- Option B: Load existing long session transcript

**Steps**:
1. Modify `TOKEN_THRESHOLD` to 5000 in useClaudeAgent.ts
2. Have conversation with ~10 messages
3. Check for compression trigger in `tui-debug.log`

**Expected**:
- `[SIGMA] Compression triggered at XXXX tokens`
- Compression ratio > 5x
- Paradigm shifts preserved
- Routine turns discarded

---

### Scenario 4: Lattice Stats

**Test**: Verify lattice is built correctly

**Steps**:
1. After compression triggers, check log for:
   - Node count
   - Edge count
   - Paradigm shift count
   - Compression ratio

**Expected**:
- Nodes include preserved + summarized turns
- Edges connect temporal + semantic relationships
- Paradigm shifts all preserved

---

## Manual Test (Quick Validation)

**Simplest test**: Just run TUI and send a few messages

```bash
# From cognition-cli directory
npm run tui

# In TUI:
> hello
> What's the weather?
> Let's build a revolutionary context compression system using algebraic embeddings
```

Check `tui-debug.log` for:
- `[SIGMA ERROR]` (should not appear)
- Embedding generation (implicit in analysis)
- Novelty scores varying with content

---

## Integration Checklist

- [x] EmbeddingService initialized on mount
- [x] Turn analysis triggered for user/assistant messages
- [x] Embeddings generated on-the-fly
- [x] Novelty calculated from recent embeddings
- [x] Compression trigger at 180K tokens
- [x] Lattice built and stored
- [x] Compression stats logged
- [ ] Test with real TUI session
- [ ] Verify no performance impact
- [ ] Validate compression quality

---

## Next Steps

1. **Lower threshold for testing**: Change `TOKEN_THRESHOLD` to 5000 temporarily
2. **Run TUI and test**: Send 10-15 messages to trigger compression
3. **Validate logs**: Check `tui-debug.log` for compression stats
4. **Revert threshold**: Change back to 180000 for production

Once validated:
- Write Anthropic collaboration pitch
- Document Sigma architecture
- Prepare demo materials
