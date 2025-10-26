# Mission Alignment Check

Before implementing a new feature, verify it aligns with our strategic mission.

## Task

I'm about to implement: **[FEATURE_NAME]**

Please verify alignment:

### Step 1: Search for Related Mission Concepts

```bash
cognition-cli concepts search "<feature-keyword>"
```

**Questions:**

- Does a mission concept exist for this feature?
- If yes, what's its weight and which section is it from?
- If no, could it fit under an existing broader concept?

### Step 2: Check Coherence of Similar Code

If similar code exists:

```bash
cognition-cli coherence for-symbol <SimilarSymbol>
```

**Questions:**

- How well does existing similar code align with mission?
- What mission concepts does it map to?
- Can we learn from its alignment/drift?

### Step 3: Strategic Recommendation

Based on the analysis, provide a clear recommendation:

#### ✅ **PROCEED** if:

- Mission concept exists with weight ≥ 0.5
- Concept is from Vision, Mission, or Strategic Intent sections
- Similar existing code has coherence ≥ 0.7

#### ⚠️ **REVISE VISION FIRST** if:

- No related mission concept exists
- Feature represents new strategic direction
- Would create high-value capability

#### 🔴 **RECONSIDER** if:

- Mission concept exists but has very low weight (< 0.3)
- Feature contradicts existing mission concepts
- Would increase drift in codebase

## Output Format

### 🔍 Mission Concept Analysis

**Searching for:** "<keyword>"

- **Found:** X concepts
- **Top match:** "Concept text" (weight%)
- **Section:** Section name
- **Assessment:** ...

### 🎯 Similar Code Analysis

**Symbol:** SymbolName

- **Coherence:** X%
- **Top alignments:** List top 3 mission concepts
- **Lesson:** What we can learn...

### 📋 Recommendation

**Status:** ✅ PROCEED / ⚠️ REVISE VISION / 🔴 RECONSIDER

**Reasoning:**

- Point 1
- Point 2
- Point 3

**Next Steps:**

- [ ] Specific action 1
- [ ] Specific action 2

## Be Strategic

- Focus on long-term strategic fit, not just technical merit
- Consider maintenance burden and coherence impact
- Suggest vision updates if feature is valuable but unaligned
