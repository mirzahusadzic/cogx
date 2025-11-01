# Semantic Q&A Explorer

Please help me query the knowledge lattice using semantic search across all overlays.

## Task

1. **Run the semantic Q&A query**:

   ```bash
   cognition-cli ask "<your question>" --verbose
   ```

2. **Analyze the results**:
   - What overlays provided the most relevant results?
   - Are semantic vectors (shadows) being matched or structural patterns?
   - What's the similarity score of the top matches?
   - Is the synthesized answer accurate and complete?

3. **Explain the query process**:
   - **Step 1**: Query intent deconstruction - what intent was detected?
   - **Step 2**: Multi-overlay search - which overlays were queried?
   - **Step 3**: Answer synthesis - how did the LLM combine the sources?
   - **Step 4**: Sources - what were the top matches and their overlays?

4. **Provide insights**:
   - If results are weak (similarity < 60%): Suggest what knowledge might be missing
   - If no results found: Recommend which overlays need to be populated
   - If results are strong: Highlight which overlays are most aligned with the question

## Output Format

### 🔍 Query Analysis

**Question:** "<the user's question>"

**Intent Detection:**

- Intent type: (e.g., conceptual_overview, implementation_details, etc.)
- Extracted entities: [list]
- Scope: (e.g., conceptual, technical, architectural)
- Refined query: "<the refined search query>"

### 📊 Search Results

**Top Matches (by overlay):**

1. **[Similarity%] Overlay ID - Type**
   - Text: <excerpt from match>
   - Why it's relevant: ...
   - Shadow vs Body: <semantic or structural vector>

**Coverage by Overlay:**

- O1 (Structure): X matches
- O2 (Security): Y matches
- O4 (Mission): Z matches
- etc.

### 💡 Synthesized Answer

<The LLM-generated answer from the command>

**Answer Quality:**

- Completeness: ✅/⚠️/🔴
- Source diversity: <number of overlays used>
- Confidence: <based on similarity scores>

### 🎯 Recommendations

**If answer is incomplete:**

- Missing overlays: [list]
- Suggested next steps: "Run `cognition-cli overlay generate <overlay>` to populate..."

**If answer is strong:**

- Key insight: <what makes this answer reliable>
- Related queries to explore: [suggestions]

### 📝 Knowledge Gaps

- Are there concepts mentioned in the answer that don't have high similarity matches?
- Which overlays could be enhanced to improve future queries?
- Are semantic shadows (docstrings, purpose statements) being utilized effectively?

## Be Insightful

- Explain which overlay architecture (O1-O7) contributed most to the answer
- Highlight if semantic vectors (shadows) vs structural vectors (bodies) were matched
- Suggest improvements to documentation/overlays if gaps exist
- Connect the answer quality to the lattice algebra principles
