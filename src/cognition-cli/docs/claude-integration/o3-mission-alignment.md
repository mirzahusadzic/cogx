# O₃ Mission Alignment

**Track how your code aligns with strategic vision using semantic embeddings and coherence scoring.**

---

## Overview

The **O₃ (Overlay 3) layer** connects your code to your mission by:

1. **Extracting mission concepts** from strategic documents (like VISION.md)
2. **Computing semantic similarity** between code symbols and mission concepts
3. **Scoring coherence** to identify aligned vs. drifted code
4. **Validating document integrity** to ensure mission truth

This enables **mission-driven development** where you can:

- See which code implements strategic goals
- Detect architectural drift from vision
- Ensure consistency between documentation and implementation

---

## Commands

### 1. Mission Concepts

**Extract and explore concepts from strategic documents.**

#### `concepts list`

Browse all extracted mission concepts with their weights and sections.

````bash
cognition-cli concepts list --limit 50
```text

**Output:**

```text
📚 Mission Concepts (showing 50 of 1076)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   1. ██████████████████████████ 87.4%
      Open Cognition
      Section: Vision: Open Cognition | Occurrences: 6 | Embedding: ✓

   2. ██████████████████████ 78.2%
      verifiable AI cognition
      Section: Mission | Occurrences: 4 | Embedding: ✓
```text

**Options:**

- `--limit <number>` - Limit results (default: 100)
- `--json` - Output raw JSON

#### `concepts top [N]`

Show top N mission concepts by weight.

```bash
cognition-cli concepts top 10
```text

**Use case:** Quickly identify the most important strategic themes.

#### `concepts search <keyword>`

Find concepts matching a keyword.

```bash
cognition-cli concepts search "verifiable"
```text

**Output:**

```text
🔍 Concepts Matching "verifiable" (15 found)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. ██████████████████████ 78.2%
     verifiable AI cognition
     Section: Mission | Occurrences: 4
```text

**Use case:** Find all mission concepts related to a specific theme.

#### `concepts by-section <section>`

Filter concepts by their source section.

```bash
cognition-cli concepts by-section Mission
cognition-cli concepts by-section "Strategic Intent"
```text

**Common sections:**

- `Vision`
- `Mission`
- `Principles`
- `Strategic Intent`
- `Why AGPLv3`

#### `concepts inspect <text>`

Deep dive into a specific concept.

```bash
cognition-cli concepts inspect "Open Cognition"
```text

**Output:**

```text
🔬 Mission Concept: Open Cognition
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Importance:
    ████████████████████████████████████ 87.4%

  Source:
    Document: ../../VISION.md
    Section: Vision: Open Cognition
    Section hash: c1f20262344971427...

  Occurrences:
    Appears 6 time(s) in document

  Embedding:
    ✓ 768-dimensional vector (768 dims)
    First 5 dims: [-0.082, -0.047, 0.005, -0.012, -0.034...]
```text

---

### 2. Strategic Coherence

**Measure semantic alignment between code symbols and mission concepts.**

#### `coherence report`

Display overall strategic coherence metrics dashboard.

```bash
cognition-cli coherence report
```text

**Output:**

```text
📊 Strategic Coherence Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Generated: 10/26/2025, 2:15:54 PM
  Mission document: 3298981e...

  Analysis Scope:
    Code symbols analyzed:   158
    Mission concepts:        1076

  Coherence Metrics:
    Average coherence:       0.520
    Alignment threshold:     ≥ 0.7

  Symbol Distribution:
    ✓ Aligned:               0 (0.0%)
    ⚠ Drifted:               158 (100.0%)
```text

**Options:**

- `--json` - Output raw JSON
- `-p, --project-root <path>` - Project root directory

#### `coherence aligned`

Show symbols aligned with mission (score ≥ threshold).

```bash
cognition-cli coherence aligned --min-score 0.7
```text

**Output:**

```text
✓ Symbols Aligned with Mission (score ≥ 0.70)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ConceptExtractor [src/core/analyzers/concept-extractor.ts]
   ██████████████ 72.5%
   Top mission alignments:
     • mission concepts extraction... (78.2%)
     • analyze strategic documents... (71.4%)
     • extract key concepts... (69.8%)
```text

**Options:**

- `--min-score <score>` - Minimum coherence score (default: 0.7)
- `--json` - Output raw JSON

#### `coherence drifted`

Show symbols that drifted from mission (score < threshold).

```bash
cognition-cli coherence drifted --max-score 0.5
```text

**Output:**

```text
⚠ Symbols Drifted from Mission (score < 0.50)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. UtilityHelper [src/utils/helper.ts]
   ████ 35.2%
   Best mission alignments:
     • code quality... (38.1%)
     • maintainable software... (34.9%)
```text

**Use case:** Identify code that has drifted from strategic intent - candidates for refactoring or deletion.

#### `coherence for-symbol <name>`

Show detailed mission alignment for a specific symbol.

```bash
cognition-cli coherence for-symbol ConceptExtractor
```text

**Output:**

```text
🎯 Strategic Coherence: ConceptExtractor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  File: src/core/analyzers/concept-extractor.ts
  Hash: ac8368144e6a6dfd...

  Overall Coherence:
   ██████████████ 72.5%

  Top 5 Mission Alignments:

  1. ████████████████ 78.2%
     Section: Mission
     "extract mission concepts from strategic documents"

  2. ███████████████ 74.3%
     Section: Vision: Open Cognition
     "semantic analysis of documentation"
```text

#### `coherence compare <symbol1> <symbol2>`

Compare mission alignment of two symbols.

```bash
cognition-cli coherence compare ConceptExtractor UtilityHelper
```text

**Output:**

```text
⚖️  Coherence Comparison: ConceptExtractor vs UtilityHelper
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ConceptExtractor
    src/core/analyzers/concept-extractor.ts
    ██████████████ 72.5%

  UtilityHelper
    src/utils/helper.ts
    ████ 35.2%

  ConceptExtractor is more aligned with mission by 37.3%
```text

**Use case:** Compare architectural alternatives or refactoring candidates.

---

### 3. Document Integrity

**Validate document index and provenance.**

#### `audit:docs`

Audit document integrity in PGC (index/docs validation).

```bash
cognition-cli audit:docs
```text

**Output:**

```text
📋 Document Integrity Audit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Document integrity check passed

  ✓ Document integrity verified: 1 document(s) validated

📚 Indexed Documents (1):

  VISION.md.json → ../../VISION.md
    Content: 3298981e68fe...
    Object:  7a4b2c1f89de...
    Ingested: 10/26/2025, 1:04:23 PM

  Use "genesis:docs <path>" to ingest documents.
```text

**What it checks:**

1. Document index entries exist in object store
2. Content hashes match stored objects
3. Transform logs exist for document ingestion
4. Detects orphaned document objects

**Options:**

- `-p, --project-root <path>` - Project root directory

---

## Workflow: Mission-Driven Development

### Step 1: Ingest Your Strategic Documents

```bash
# Ingest VISION.md (or any markdown document)
cognition-cli genesis:docs ../../VISION.md

# Verify ingestion
cognition-cli audit:docs
```text

### Step 2: Generate Mission Concepts Overlay

```bash
# Extract concepts with semantic embeddings
cognition-cli overlay generate mission_concepts
```text

This:

- Parses document structure
- Extracts key concepts from each section
- Weights concepts by frequency and position
- Generates 768-dim embeddings via eGemma

### Step 3: Generate Strategic Coherence Overlay

```bash
# Compute code ↔ mission alignment
cognition-cli overlay generate strategic_coherence
```text

This:

- Loads all code symbols from O₁ (structural patterns)
- Loads all mission concepts from O₃
- Computes cosine similarity between code and mission embeddings
- Scores each symbol's overall coherence

### Step 4: Explore Alignment with Claude

In Claude Code:

```markdown
User: Show me which code is most aligned with our mission

Claude:
I'll check the strategic coherence overlay...

[Runs: cognition-cli coherence aligned]

Based on the coherence scores, here are our most mission-aligned components:

1. **ConceptExtractor** (72.5%) - src/core/analyzers/concept-extractor.ts
   Strongly aligned with "extract mission concepts from strategic documents"

2. **MissionValidator** (68.9%) - src/core/security/mission-validator.ts
   Aligned with "validate strategic intent" and "detect mission drift"
```text

---

## Integration with Claude Code

### Slash Command: `/coherence`

Create `.claude/commands/coherence.md`:

```markdown
# Mission Coherence Analysis

Please analyze how well our codebase aligns with strategic mission:

1. Run `cognition-cli coherence report` to see overall metrics
2. Run `cognition-cli coherence drifted --max-score 0.5` to find drifted code
3. For each drifted symbol, explain:
   - Why it might have low coherence
   - Whether it's technical debt or legitimately utility code
   - Recommendations for improving alignment

Be specific and reference the actual mission concepts from the output.
```text

**Usage in Claude:**

```bash
User: /coherence

Claude: I'll analyze mission alignment...
[Runs coherence report]
[Identifies drifted code]
[Provides specific recommendations]
```text

### Slash Command: `/mission-check`

Create `.claude/commands/mission-check.md`:

```markdown
# Mission Concept Check

Before implementing a new feature, let's verify alignment with mission:

1. Run `cognition-cli concepts search "<feature-keyword>"` to see if concept exists
2. If concept exists, show its weight and section
3. If concept doesn't exist, check if feature aligns with existing vision
4. Recommend whether to:
   - Proceed (aligned)
   - Revise VISION.md first (new strategic direction)
   - Reconsider (not aligned)
```text

---

## Best Practices

### 1. Keep Mission Documents Updated

```bash
# After updating VISION.md, re-ingest
cognition-cli genesis:docs ../../VISION.md

# Regenerate overlays
cognition-cli overlay generate mission_concepts
cognition-cli overlay generate strategic_coherence
```text

**Why:** Coherence scores are only as good as your mission document.

### 2. Set Coherence Thresholds Based on Your Project

```bash
# Strict (products with clear mission)
cognition-cli coherence aligned --min-score 0.8

# Moderate (most projects)
cognition-cli coherence aligned --min-score 0.7

# Permissive (exploratory projects)
cognition-cli coherence aligned --min-score 0.6
```text

### 3. Use Coherence in Code Reviews

```bash
# Before approving a PR
cognition-cli coherence for-symbol NewFeatureClass

# If coherence < 0.5, ask:
# - Does this belong in this project?
# - Is it utility code (legitimately low coherence)?
# - Should we update mission to include this direction?
```text

### 4. Track Coherence Over Time

```bash
# Save coherence report
cognition-cli coherence report --json > coherence-$(date +%Y%m%d).json

# Compare over time
# High drift = mission evolution or technical debt
```text

---

## Understanding Coherence Scores

### What Does a Score Mean?

| Score       | Interpretation                      | Action                          |
| ----------- | ----------------------------------- | ------------------------------- |
| **0.8-1.0** | Directly implements mission concept | ✅ Keep as core component       |
| **0.7-0.8** | Well-aligned with strategic intent  | ✅ Maintain alignment           |
| **0.5-0.7** | Moderate alignment                  | ⚠️ Review for improvement       |
| **0.3-0.5** | Low alignment                       | ⚠️ Refactor or justify          |
| **0.0-0.3** | Very low alignment                  | 🔴 Technical debt or misaligned |

### Low Scores Are Not Always Bad

**Legitimate reasons for low coherence:**

- **Utility code** - Generic helpers, formatters, parsers
- **Infrastructure** - Build scripts, configs, boilerplate
- **Third-party** - External integrations, adapters
- **Framework code** - Required by framework, not strategic

**Problematic low coherence:**

- **Feature creep** - Code added without strategic justification
- **Legacy cruft** - Old code that no longer serves mission
- **Misaligned direction** - Code implementing abandoned strategies

---

## Advanced: Custom Coherence Analysis

### Example: Find Utility vs. Strategic Code

```bash
# Get all symbols
cognition-cli coherence report --json > all-coherence.json

# Filter with jq
cat all-coherence.json | jq '.symbol_coherence[] | select(.overallCoherence < 0.4) | .symbolName'

# Result: List of likely utility code
```text

### Example: Mission Coverage Analysis

```bash
# Which mission concepts are well-implemented?
cognition-cli coherence report --json | \
  jq '.concept_implementations[] | select(.implementingSymbols | length > 0) | {concept: .conceptText, implementations: (.implementingSymbols | length)}'
```text

---

## Troubleshooting

### "No mission concepts found"

**Cause:** VISION.md hasn't been ingested or overlay not generated.

**Fix:**

```bash
cognition-cli genesis:docs ../../VISION.md
cognition-cli overlay generate mission_concepts
```text

### "No strategic coherence overlay found"

**Cause:** Coherence overlay not generated.

**Fix:**

```bash
# Requires both O₁ and O₃
cognition-cli overlay generate structural_patterns
cognition-cli overlay generate mission_concepts
cognition-cli overlay generate strategic_coherence
```text

### Coherence scores seem wrong

**Possible causes:**

1. **Embeddings not generated** - Check concepts have `embedding: ✓`
2. **eGemma not accessible** - Check WORKBENCH_URL and WORKBENCH_API_KEY
3. **Outdated mission document** - Re-ingest after changes

**Debug:**

```bash
# Check concept embeddings
cognition-cli concepts list --limit 5

# Each should show "Embedding: ✓"
```text

---

## Next Steps

- **[Best Practices](./best-practices.md)** - Recommended patterns
- **[Real-World Workflows](./workflows.md)** - End-to-end examples
- **[Command Reference](./command-reference.md)** - All commands

---

**← Back to [Claude Code Integration](../08_Claude_CLI_Integration.md)**
````
