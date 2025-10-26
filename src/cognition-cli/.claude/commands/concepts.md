# Mission Concepts Explorer

Please help me explore the mission concepts extracted from our strategic documents.

## Task

1. **Show top mission concepts**:

   ```bash
   cognition-cli concepts top 20
   ```

2. **Analyze the concepts**:
   - What are the dominant themes?
   - Which sections contribute the most concepts?
   - Are there any surprising high-weight concepts?

3. **If I'm implementing a feature**, search for related concepts:

   ```bash
   cognition-cli concepts search "<feature-keyword>"
   ```

   - Does a concept exist for this feature?
   - What's its weight/importance?
   - Which section is it from?

4. **Provide strategic guidance**:
   - If concept exists with high weight → ✅ Feature is well-aligned
   - If concept exists with low weight → ⚠️ Consider priority
   - If concept doesn't exist → 🔴 Check if it aligns with vision

## Output Format

### 📚 Mission Themes

**Top Concepts:**

1. **ConceptText** (weight%) - Section name
   - What it means: ...
   - Why it's important: ...

**Key Themes:**

- Theme 1: Related concepts A, B, C
- Theme 2: Related concepts D, E, F

### 🎯 Feature Alignment Check

**Searching for: "<keyword>"**

- Found concepts: X
- Highest weight: Y% (concept text)
- Strategic recommendation: ...

### 💡 Insights

- Patterns observed across concepts
- Gaps in coverage
- Suggestions for strategic clarity

## Be Insightful

- Connect concepts to code architecture
- Highlight strategic priorities from weights
- Suggest if mission document needs updates
