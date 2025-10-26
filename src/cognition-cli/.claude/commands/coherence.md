# Mission Coherence Analysis

Please analyze how well our codebase aligns with strategic mission using the coherence overlay:

## Task

1. **Get overall coherence metrics**:

   ```bash
   cognition-cli coherence report
   ```

2. **Find drifted code** (score < 0.5):

   ```bash
   cognition-cli coherence drifted --max-score 0.5
   ```

3. **For each drifted symbol**, analyze:
   - **Why it has low coherence** - Check its top mission alignments
   - **Is it problematic?**
     - ✅ **Legitimate**: Utility code, infrastructure, framework boilerplate
     - ⚠️ **Problematic**: Feature creep, legacy cruft, misaligned direction
   - **Recommendations**:
     - If legitimate low coherence, explain and move on
     - If problematic, suggest refactoring or removal

4. **Summarize findings**:
   - % of code that is mission-aligned vs. drifted
   - Key themes from aligned code
   - Action items for drifted code

## Output Format

Structure your response like this:

### 📊 Overall Metrics

- Total symbols analyzed: X
- Mission concepts: Y
- Average coherence: Z%
- Aligned symbols: A (B%)
- Drifted symbols: C (D%)

### ✅ Aligned Code (Top 3)

1. **SymbolName** (score%) - Brief explanation of alignment

### ⚠️ Drifted Code Analysis

1. **SymbolName** (score%) - file path
   - Why low coherence: ...
   - Legitimate or problematic: ...
   - Recommendation: ...

### 🎯 Action Items

- [ ] Specific actions based on drift analysis

## Be Specific

- Quote actual mission concepts from the output
- Reference specific file paths and symbol names
- Provide concrete, actionable recommendations
