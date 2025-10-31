---
type: operational
overlay: O5_Operational
---

# Chapter 9: O₅ Operational — Workflow Guidance

> **The Axiom Applied**: Operational knowledge forms a sublattice where quest structures meet depth rules at precise points of alignment. "Which workflows apply at Depth 2?" is a computable query—not a search through documentation.

**Part**: II — The Seven Layers<br/>
**Layer**: O₅ (Operational)<br/>
**Role**: Workflow Guidance<br/>
**Knowledge Types**: 5 (quest_structure, sacred_sequence, workflow_pattern, depth_rule, terminology)<br/>

---

## Table of Contents

1. [Purpose and Scope](#purpose-and-scope)
2. [Knowledge Types](#knowledge-types)
3. [Storage Structure](#storage-structure)
4. [Extraction Process](#extraction-process)
5. [Embeddings and Similarity](#embeddings-and-similarity)
6. [Integration with Genesis](#integration-with-genesis)
7. [Query Examples](#query-examples)
8. [Real-World Usage](#real-world-usage)
9. [Design Patterns](#design-patterns)
10. [Comparison with Other Overlays](#comparison-with-other-overlays)
11. [Implementation Details](#implementation-details)
12. [Future Enhancements](#future-enhancements)
13. [Common Pitfalls](#common-pitfalls)
14. [Testing O₅ Extraction](#testing-o₅-extraction)

---

## Purpose and Scope

The **O₅ Operational overlay** stores workflow guidance, process patterns, and procedural knowledge extracted from operational documents like `OPERATIONAL_LATTICE.md`. Unlike O₄ (Mission) which answers "WHAT should we build?" and "WHY?", O₅ answers **"HOW should we work?"**

**Key Insight**: O₅ is prescriptive, not descriptive. It captures invariant sequences, depth-tracking rules, and workflow patterns that guide AI agents (and humans) through complex cognitive tasks.

### What O₅ Stores

**Workflow Patterns**: Procedural guidance for cognitive work

- Quest structures (What/Why/Success)
- Sacred sequences (invariant step orders like F.L.T.B)
- Depth rules (Depth 0-3 specific guidance)
- Workflow patterns (oracle/scribe rhythm, blocking, rebalancing)
- Terminology (Quest, Oracle, Scribe, AQS, CoMP)

**NOT stored in O₅**:

- Strategic vision (→ O₄ Mission)
- Code patterns (→ O₁ Structure)
- Security procedures (→ O₂ Security)
- Formal methods (→ O₆ Mathematical)

### Why O₅ Matters

**Problem**: AI agents (and humans) need procedural guidance to navigate complex tasks without getting lost or making structural mistakes.

**Solution**: O₅ provides queryable workflow knowledge:

```bash
# "How should I handle depth 2 work?"
cognition-cli lattice "O5[depth_rule] -> query 'depth 2 guidance'"

# "What's the correct sequence for quest initialization?"
cognition-cli lattice "O5[quest_structure]"

# "Which workflow patterns ensure security?"
cognition-cli lattice "O5[workflows] ~ O2[boundaries]"
```

---

## Knowledge Types

O₅ extracts **5 types of operational knowledge**:

### 1. Quest Structure

**Definition**: The What/Why/Success pattern for initializing cognitive work.

**Pattern**:

```markdown
## Quest: [Name]

**What**: Clear objective statement
**Why**: Motivation and context
**Success**: Concrete completion criteria
```

**Example from OPERATIONAL_LATTICE.md**:

```markdown
## Quest: Implement Lattice Algebra

**What**: Build boolean operations across overlays
**Why**: Enable compositional queries (meet, union, intersection)
**Success**:

- CLI command accepts "O1 - O2" syntax
- Parser handles precedence correctly
- Operations return typed results
```

**Metadata**:

```typescript
{
  patternType: 'quest_structure',
  text: 'Implement Lattice Algebra with boolean operations...',
  metadata: {
    quest_name: 'Implement Lattice Algebra',
    what: 'Build boolean operations...',
    why: 'Enable compositional queries...',
    success_criteria: ['CLI command...', 'Parser handles...', ...]
  },
  weight: 1.0
}
```

**Use Case**: Initialize new cognitive tasks with clear structure.

---

### 2. Sacred Sequence

**Definition**: Invariant step orders that MUST be followed (no reordering allowed).

**Pattern**: Sequences marked as "sacred" or with explicit ordering like "F.L.T.B" (Format, Lint, Test, Build).

**Example**:

```markdown
### Sacred Sequence: F.L.T.B

1. **Format**: Run code formatter (prettier, black, gofmt)
2. **Lint**: Run linter (eslint, pylint, clippy)
3. **Test**: Run test suite (unit, integration)
4. **Build**: Run build process (compile, bundle, package)
```

**Why Sacred?**: These sequences encode hard-won lessons. Violating them leads to:

- Formatting conflicts (skipping Format)
- Style violations in CI (skipping Lint)
- Broken code in production (skipping Test)
- Build failures after commit (skipping Build)

**Metadata**:

```typescript
{
  patternType: 'sacred_sequence',
  text: 'F.L.T.B: Format, Lint, Test, Build',
  metadata: {
    sequence_name: 'F.L.T.B',
    steps: [
      { order: 1, name: 'Format', description: 'Run code formatter...' },
      { order: 2, name: 'Lint', description: 'Run linter...' },
      { order: 3, name: 'Test', description: 'Run test suite...' },
      { order: 4, name: 'Build', description: 'Run build process...' }
    ],
    invariant: true
  },
  weight: 1.0
}
```

**Query**:

```bash
cognition-cli lattice "O5[sacred_sequence]"
# Returns: All invariant sequences that must be followed
```

---

### 3. Workflow Pattern

**Definition**: Process guidance for specific situations (depth tracking, oracle/scribe rhythm, blocking, rebalancing).

**Examples**:

#### Oracle/Scribe Rhythm

```markdown
### Workflow: Oracle/Scribe Rhythm

**Pattern**: Alternate between exploration (Oracle) and execution (Scribe)

- **Oracle mode**: Ask questions, explore, plan
- **Scribe mode**: Execute, document, build
- **Never mix**: Don't explore while building (context thrashing)
```

**Metadata**:

```typescript
{
  patternType: 'workflow_pattern',
  text: 'Oracle/Scribe rhythm: alternate exploration and execution',
  metadata: {
    pattern_name: 'oracle_scribe_rhythm',
    description: 'Alternate between exploration and execution modes',
    anti_patterns: ['Exploring while building causes context thrashing']
  }
}
```

#### Blocking Work

```markdown
### Workflow: Blocking

**When**: You're stuck on a dependency you can't resolve
**Action**:

1. Document the blocker
2. Move to parallel work
3. Return when blocker is resolved

**Never**: Sit idle waiting for blocker
```

#### Rebalancing Depth

```markdown
### Workflow: Rebalancing

**When**: Depth exceeds cognitive capacity (Depth > 3)
**Action**:

1. Pause current work
2. Elevate to higher depth
3. Summarize context
4. Resume with fresh perspective
```

---

### 4. Depth Rule

**Definition**: Depth-specific guidance for managing cognitive load at different levels.

**Depth Scale**:

- **Depth 0**: Strategic planning (no implementation)
- **Depth 1**: High-level design (interfaces, architecture)
- **Depth 2**: Implementation (writing code)
- **Depth 3**: Deep debugging (rare, high cognitive load)

**Example Rules**:

```markdown
### Depth 0: Strategic Planning

**Focus**: Vision, goals, trade-offs
**Avoid**: Implementation details, code
**Output**: Quest structure, architecture decisions

### Depth 1: High-Level Design

**Focus**: Interfaces, contracts, module boundaries
**Avoid**: Line-by-line implementation
**Output**: Type signatures, API contracts

### Depth 2: Implementation

**Focus**: Writing code, tests, documentation
**Avoid**: Simultaneous refactoring of unrelated code
**Output**: Working code with tests

### Depth 3: Deep Debugging

**Warning**: High cognitive load, rarely needed
**Focus**: Root cause analysis, stepping through execution
**Avoid**: Adding new features while debugging
**Exit Strategy**: Return to Depth 2 as soon as possible
```

**Metadata**:

```typescript
{
  patternType: 'depth_rule',
  text: 'Depth 2: Implementation - focus on writing code and tests',
  metadata: {
    depth_level: 2,
    focus: ['Writing code', 'Tests', 'Documentation'],
    avoid: ['Simultaneous refactoring', 'Architecture changes'],
    output: ['Working code with tests'],
    cognitive_load: 'medium'
  }
}
```

**Query**:

```bash
# Get guidance for specific depth
cognition-cli lattice "O5[depth_rule]" --filter "depth_level=2"
```

---

### 5. Terminology

**Definition**: Operational vocabulary with precise definitions (Quest, Oracle, AQS, CoMP, etc.).

**Example**:

```markdown
### Terminology

**Quest**: A unit of cognitive work with What/Why/Success structure

**Oracle**: Exploration phase (asking questions, planning)

**Scribe**: Execution phase (implementing, documenting)

**AQS (Agent Quality Score)**: Σ(coherence × completeness × correctness)

**CoMP (Computational Proof of Work)**: Validated work receipt with hash chain
```

**Metadata**:

```typescript
{
  patternType: 'terminology',
  text: 'Quest: A unit of cognitive work with What/Why/Success structure',
  metadata: {
    term: 'Quest',
    definition: 'A unit of cognitive work...',
    related_patterns: ['quest_structure', 'F.L.T.B']
  }
}
```

**Use Case**: Ensure consistent vocabulary across system and documentation.

---

## Storage Structure

### File Layout

```
.open_cognition/overlays/operational_patterns/
  <document-hash>.yaml       # Per-document overlay
  workflow_index.json        # Fast lookup index
```

### Overlay Format

```yaml
document_hash: 'a3f2b9c...'
document_path: 'docs/OPERATIONAL_LATTICE.md'
extracted_patterns:
  - patternType: 'quest_structure'
    text: 'Implement Lattice Algebra...'
    embedding: [0.123, 0.456, ...] # 768d vector
    weight: 1.0
    metadata:
      quest_name: 'Implement Lattice Algebra'
      what: 'Build boolean operations...'
      why: 'Enable compositional queries...'
      success_criteria: [...]

  - patternType: 'sacred_sequence'
    text: 'F.L.T.B: Format, Lint, Test, Build'
    embedding: [0.234, 0.567, ...]
    weight: 1.0
    metadata:
      sequence_name: 'F.L.T.B'
      steps: [...]
      invariant: true

generated_at: '2025-10-30T12:34:56Z'
transform_id: 'genesis_doc_transform_xyz'
```

---

## Extraction Process

### WorkflowExtractor

**Location**: `src/core/analyzers/workflow-extractor.ts`

**Input**: Parsed markdown AST (from `MarkdownParser`)

**Output**: Array of `OperationalKnowledge` items

**Extraction Patterns**:

#### 1. Quest Structure Detection

```typescript
// Pattern: ## Quest: [Name] followed by **What**/**Why**/**Success**
if (heading.level === 2 && heading.text.startsWith('Quest:')) {
  const questName = heading.text.replace('Quest:', '').trim();

  // Look for What/Why/Success in following paragraphs
  const what = findBoldContent('What');
  const why = findBoldContent('Why');
  const success = findBoldContent('Success');

  if (what && why && success) {
    patterns.push({
      patternType: 'quest_structure',
      text: `${questName}: ${what}`,
      metadata: { quest_name: questName, what, why, success_criteria: success },
    });
  }
}
```

#### 2. Sacred Sequence Detection

```typescript
// Pattern: "Sacred Sequence" or "F.L.T.B" or numbered lists with order markers
if (text.includes('sacred') || text.includes('F.L.T.B')) {
  const steps = extractOrderedSteps(section);

  patterns.push({
    patternType: 'sacred_sequence',
    text: section.text,
    metadata: {
      sequence_name: extractName(section),
      steps: steps,
      invariant: true,
    },
  });
}
```

#### 3. Depth Rule Detection

```typescript
// Pattern: ### Depth [0-3]: [Name]
if (heading.text.match(/Depth [0-3]:/)) {
  const depthLevel = parseInt(heading.text.match(/\d/)[0]);

  patterns.push({
    patternType: 'depth_rule',
    text: section.text,
    metadata: {
      depth_level: depthLevel,
      focus: extractBulletList('Focus'),
      avoid: extractBulletList('Avoid'),
      output: extractBulletList('Output'),
    },
  });
}
```

#### 4. Workflow Pattern Detection

```typescript
// Pattern: ### Workflow: [Name] or "Pattern:" prefix
if (heading.text.startsWith('Workflow:') || text.includes('Pattern:')) {
  patterns.push({
    patternType: 'workflow_pattern',
    text: section.text,
    metadata: {
      pattern_name: extractName(heading),
      description: extractDescription(section),
      anti_patterns: extractAntiPatterns(section),
    },
  });
}
```

#### 5. Terminology Detection

```typescript
// Pattern: **Term**: Definition or ### Terminology section
if (section.heading?.text === 'Terminology') {
  const terms = extractBoldDefinitions(section);

  terms.forEach((term) => {
    patterns.push({
      patternType: 'terminology',
      text: `${term.name}: ${term.definition}`,
      metadata: {
        term: term.name,
        definition: term.definition,
        related_patterns: term.references,
      },
    });
  });
}
```

---

## Embeddings and Similarity

### Embedding Generation

Each operational pattern gets a **768-dimensional embedding** from eGemma:

```typescript
// OperationalPatternsManager.generateEmbeddings()
for (const pattern of patterns) {
  const sanitizedText = this.sanitizeForEmbedding(pattern.text);

  const embedResponse = await this.workbench.embed({
    signature: sanitizedText,
    dimensions: 768,
  });

  pattern.embedding = embedResponse['embedding_768d'];
}
```

**Sanitization**: Remove non-ASCII chars that trigger eGemma's binary detection (em-dash, bullets, etc.).

### Similarity Queries

**Semantic search** finds patterns by meaning:

```typescript
// "How do I handle depth 2?"
const results = await operational.query('depth 2 guidance', 5);

// Returns top-5 patterns semantically related to "depth 2 guidance"
results.forEach(({ item, similarity }) => {
  console.log(`[${(similarity * 100).toFixed(1)}%] ${item.metadata.text}`);
});
```

**Cross-overlay alignment**:

```bash
# Which workflow patterns ensure security boundaries?
cognition-cli lattice "O5[workflows] ~ O2[boundaries]"
```

---

## Integration with Genesis

### Document Routing (Phase 2)

When `genesis:docs` processes a markdown file:

1. **Classify document**:

```typescript
const classifier = new DocumentClassifier();
const result = classifier.classify(doc, filePath);
// result.type = 'operational' for OPERATIONAL_LATTICE.md
```

2. **Route to WorkflowExtractor**:

```typescript
if (classification.type === DocumentType.OPERATIONAL) {
  const extractor = new WorkflowExtractor();
  const patterns = extractor.extract(ast);
  // Returns OperationalKnowledge[]
}
```

3. **Generate O₅ overlay**:

```typescript
await operationalManager.generateOverlay(
  documentPath,
  documentHash,
  patterns,
  transformId
);
```

4. **Store with embeddings**:

```yaml
# .open_cognition/overlays/operational_patterns/<hash>.yaml
extracted_patterns:
  - patternType: "quest_structure"
    embedding: [0.123, ...]  # ← Generated via eGemma
    ...
```

**Full pipeline**: `MarkdownParser` → `DocumentClassifier` → `WorkflowExtractor` → `OperationalPatternsManager` → O₅ overlay

---

## Query Examples

### Example 1: Get Quest Patterns

**Question**: What quest structures are defined?

**Query**:

```bash
cognition-cli lattice "O5[quest_structure]"
```

**Returns**: All quest patterns with What/Why/Success

**Use Case**: Initialize new cognitive work with established pattern.

---

### Example 2: Depth-Specific Guidance

**Question**: How should I work at Depth 2?

**Query**:

```bash
cognition-cli lattice "O5[depth_rule]" --filter "depth_level=2"
```

**Returns**:

```
Depth 2: Implementation
  Focus: Writing code, Tests, Documentation
  Avoid: Simultaneous refactoring, Architecture changes
  Output: Working code with tests
```

**Use Case**: Get procedural guidance for current depth level.

---

### Example 3: Workflow-Security Alignment

**Question**: Which workflow patterns respect security boundaries?

**Query**:

```bash
cognition-cli lattice "O5[workflow_pattern] ~ O2[boundary]" --threshold 0.7
```

**Returns**: Pairs of (workflow, boundary) with similarity ≥ 0.7

**Interpretation**: High similarity = workflow pattern respects security boundary

**Use Case**: Ensure workflows follow security best practices.

---

### Example 4: Sacred Sequences

**Question**: What are the invariant step orders?

**Query**:

```bash
cognition-cli lattice "O5[sacred_sequence]"
```

**Returns**:

```
F.L.T.B: Format, Lint, Test, Build
  Step 1: Format - Run code formatter
  Step 2: Lint - Run linter
  Step 3: Test - Run test suite
  Step 4: Build - Run build process
```

**Use Case**: Follow established process patterns to avoid common mistakes.

---

### Example 5: Terminology Lookup

**Question**: What does "Quest" mean in this system?

**Query**:

```bash
cognition-cli lattice "O5[terminology]" --query "Quest definition"
```

**Returns**:

```
Quest: A unit of cognitive work with What/Why/Success structure
  Related: quest_structure, F.L.T.B
```

**Use Case**: Ensure consistent vocabulary across team.

---

## Real-World Usage

### Scenario 1: Starting New Feature

**Context**: Developer needs to implement new feature

**Workflow**:

```bash
# 1. Get quest pattern
cognition-cli lattice "O5[quest_structure]" | head -20

# 2. Follow pattern
## Quest: Implement Feature X
**What**: [Concrete objective]
**Why**: [Motivation]
**Success**: [Measurable criteria]

# 3. Check sacred sequence
cognition-cli lattice "O5[sacred_sequence]"
# Reminds: F.L.T.B (Format, Lint, Test, Build)
```

**Result**: Structured approach, clear success criteria, process guidance.

---

### Scenario 2: Managing Cognitive Load

**Context**: Developer feels overwhelmed (too deep in implementation details)

**Workflow**:

```bash
# Check current depth guidance
cognition-cli lattice "O5[depth_rule]" --filter "depth_level=3"

# Returns:
# "Depth 3: Deep Debugging - HIGH COGNITIVE LOAD
#  Exit Strategy: Return to Depth 2 as soon as possible"

# Action: Rebalance to Depth 1
cognition-cli lattice "O5[depth_rule]" --filter "depth_level=1"

# Returns: High-level design focus
```

**Result**: Awareness of cognitive overload, guidance to rebalance.

---

### Scenario 3: Cross-Overlay Validation

**Context**: Ensure workflow aligns with mission

**Query**:

```bash
# Do our workflow patterns support mission goals?
cognition-cli lattice "O5[workflow_pattern] ~ O4[goal]" --threshold 0.8
```

**Returns**: Alignment scores between workflows and strategic goals

**Action**: If low alignment, adjust workflows or reassess goals.

---

## Design Patterns

### Pattern 1: Quest-First Development

**Principle**: Always start with What/Why/Success

**Anti-Pattern**: Jumping straight to implementation

**Example**:

```markdown
❌ "Let's add a cache"

✅ ## Quest: Add Response Caching
**What**: Cache API responses to reduce latency
**Why**: 80% of requests are duplicates
**Success**:

- Response time < 50ms for cached items
- Cache hit rate > 70%
- No stale data served
```

**Query**:

```bash
cognition-cli lattice "O5[quest_structure]" | grep -A 5 "caching"
```

---

### Pattern 2: Depth Tracking

**Principle**: Stay aware of cognitive depth, rebalance when overloaded

**Depth Scale**:

- 0: Planning (no code)
- 1: Architecture (interfaces)
- 2: Implementation (writing code)
- 3: Debugging (rare, high load)

**Rule**: Never spend more than 30 minutes at Depth 3

**Query**:

```bash
# Get exit strategy for Depth 3
cognition-cli lattice "O5[depth_rule]" --filter "depth_level=3"
```

---

### Pattern 3: Oracle/Scribe Rhythm

**Principle**: Separate exploration from execution

**Oracle Mode**:

- Ask questions
- Explore alternatives
- Read documentation
- Plan approach

**Scribe Mode**:

- Write code
- Run tests
- Document changes
- Commit work

**Anti-Pattern**: Exploring while coding (context thrashing)

**Query**:

```bash
cognition-cli lattice "O5[workflow_pattern]" --query "oracle scribe rhythm"
```

---

## Comparison with Other Overlays

| Overlay            | Focus          | Question Answered   | Example                                           |
| ------------------ | -------------- | ------------------- | ------------------------------------------------- |
| **O₄ Mission**     | Strategic      | WHAT to build? WHY? | "Build lattice algebra for compositional queries" |
| **O₅ Operational** | Procedural     | HOW to work?        | "Use F.L.T.B sequence: Format, Lint, Test, Build" |
| **O₂ Security**    | Constraints    | Is it safe?         | "Validate input before processing"                |
| **O₁ Structure**   | Implementation | How is it built?    | "meet() uses LanceDB ANN search"                  |

**Key Difference**: O₅ is **prescriptive** (tells you how), O₄ is **descriptive** (tells you what/why).

---

## Implementation Details

### OperationalPatternsManager

**Location**: `src/core/overlays/operational-patterns/manager.ts`

**Key Methods**:

```typescript
class OperationalPatternsManager {
  // Generate overlay for document
  async generateOverlay(
    documentPath: string,
    documentHash: string,
    patterns: OperationalKnowledge[],
    transformId: string
  ): Promise<void>;

  // Load existing overlay
  async loadOverlay(
    documentHash: string
  ): Promise<OperationalPatternsOverlay | null>;

  // Get all patterns across documents
  async getAllPatterns(): Promise<OperationalKnowledge[]>;

  // Filter by pattern type
  async getPatternsByType(
    patternType:
      | 'quest_structure'
      | 'sacred_sequence'
      | 'workflow_pattern'
      | 'depth_rule'
      | 'terminology'
  ): Promise<OperationalKnowledge[]>;

  // Semantic search
  async queryPatterns(query: string): Promise<OperationalKnowledge[]>;
}
```

**Constructor**:

```typescript
constructor(pgcRoot: string, workbenchUrl?: string) {
  this.overlayPath = path.join(pgcRoot, 'overlays', 'operational_patterns');
  this.workbench = new WorkbenchClient(workbenchUrl || 'http://localhost:8000');
}
```

---

## Future Enhancements

### Dynamic Quest Generation

```bash
# AI generates quest structure from natural language
cognition-cli quest generate "Add user authentication"

# Output:
## Quest: Implement User Authentication
**What**: Add login/logout with JWT tokens
**Why**: Users need secure access to protected resources
**Success**:
- Login endpoint returns valid JWT
- Protected routes require authentication
- Sessions expire after 1 hour
```

---

### Workflow Validation

```bash
# Check if current work follows sacred sequences
cognition-cli workflow validate

# Output:
✓ Focus: Quest defined
✓ Lock: Approach committed
✗ Test: No tests written yet
○ Build: Not started

Warning: Skipping Test phase detected
```

---

### Adaptive Depth Tracking

```bash
# System auto-detects depth from git activity
cognition-cli depth status

# Output:
Current Depth: 2 (Implementation)
Time at depth: 45 minutes
Recommendation: Continue (within healthy range)

# If overloaded:
Current Depth: 3 (Deep Debugging)
Time at depth: 90 minutes ⚠️
Recommendation: Rebalance to Depth 1 (take a step back)
```

---

### Workflow Templates

```bash
# Create reusable workflow templates
cognition-cli workflow template save "feature-development"

# Load template for new work
cognition-cli workflow template apply "feature-development"

# Templates include:
# - Quest structure
# - Sacred sequence checklist
# - Depth milestones
# - Success criteria
```

---

## Common Pitfalls

### Pitfall 1: Skipping Quest Definition

**Problem**: Jumping into implementation without What/Why/Success

**Symptom**: Unclear success criteria, scope creep, abandoned work

**Fix**:

```bash
# Always start with quest
cognition-cli lattice "O5[quest_structure]" | head -20
# Copy pattern, fill in specifics
```

---

### Pitfall 2: Violating Sacred Sequences

**Problem**: Skipping steps in F.L.T.B (e.g., building before running tests)

**Symptom**: Half-finished work, broken code, frequent rework

**Fix**:

```bash
# Check sacred sequences before starting
cognition-cli lattice "O5[sacred_sequence]"
# Follow steps in order
```

---

### Pitfall 3: Ignoring Depth Limits

**Problem**: Staying at Depth 3 (debugging) for too long

**Symptom**: Mental exhaustion, tunnel vision, diminishing returns

**Fix**:

```bash
# Check depth guidance
cognition-cli lattice "O5[depth_rule]" --filter "depth_level=3"
# Exit strategy: Return to Depth 1 or 2
```

---

### Pitfall 4: Context Thrashing (Oracle/Scribe Mixing)

**Problem**: Exploring alternatives while trying to write code

**Symptom**: Slow progress, constant switching, mental fatigue

**Fix**:

```bash
# Get workflow guidance
cognition-cli lattice "O5[workflow_pattern]" --query "oracle scribe"
# Separate modes: explore OR execute, never both
```

---

## Testing O₅ Extraction

### Test Case 1: OPERATIONAL_LATTICE.md

**Input**: `docs/overlays/O5_operational/OPERATIONAL_LATTICE.md`

**Expected Patterns**:

- 5-10 quest structures
- 2-3 sacred sequences (including F.L.T.B)
- 10-15 workflow patterns
- 4 depth rules (Depth 0-3)
- 20+ terminology definitions

**Verification**:

```bash
# Run genesis:docs
cognition-cli genesis:docs docs/overlays/O5_operational/OPERATIONAL_LATTICE.md

# Check extraction
cognition-cli lattice "O5[quest_structure]" | wc -l
# Expect: 5-10 items

cognition-cli lattice "O5[sacred_sequence]"
# Expect: F.L.T.B appears

cognition-cli lattice "O5[depth_rule]"
# Expect: 4 items (Depth 0, 1, 2, 3)
```

---

### Test Case 2: Cross-Overlay Queries

**Query**: Do workflow patterns align with security boundaries?

```bash
cognition-cli lattice "O5[workflow_pattern] ~ O2[boundary]" --threshold 0.7
```

**Expected**: Pairs showing which workflows respect which security boundaries

---

### Test Case 3: Semantic Search

**Query**: "How to handle user input?"

```bash
cognition-cli lattice "O5 -> O2" --query "handle user input"
```

**Expected**: Workflow patterns for input handling aligned with security guidelines

---

## Summary

**O₅ Operational** answers **"HOW to work?"** through:

1. **Quest Structures**: What/Why/Success pattern for initializing work
2. **Sacred Sequences**: Invariant step orders (F.L.T.B)
3. **Workflow Patterns**: Process guidance (oracle/scribe, blocking, rebalancing)
4. **Depth Rules**: Cognitive load management (Depth 0-3)
5. **Terminology**: Consistent vocabulary (Quest, Oracle, AQS, CoMP)

**Key Files**:

- `src/core/overlays/operational-patterns/manager.ts` — Manager
- `src/core/analyzers/workflow-extractor.ts` — Extractor
- `docs/overlays/O5_operational/OPERATIONAL_LATTICE.md` — Source document

**Storage**:

- `.open_cognition/overlays/operational_patterns/<hash>.yaml`

**Queries**:

```bash
lattice "O5[quest_structure]"           # Get quest patterns
lattice "O5[sacred_sequence]"           # Get invariant sequences
lattice "O5[depth_rule]"                # Get depth guidance
lattice "O5[workflows] ~ O2"            # Align workflows with security
lattice "O5 -> O2" --query "input"      # Project workflows to security
```

**Design Principle**: Procedural knowledge (HOW) complements strategic knowledge (WHAT/WHY) to enable effective cognitive work.

---

**Next Chapter**: [Chapter 10: O₆ Mathematical — Formal Properties](10-o6-mathematical.md)

**Previous Chapter**: [Chapter 8: O₄ Mission — Strategic Alignment](08-o4-mission.md)

---

**Status**: ✅ Complete (October 30, 2025)
**Author**: Collaborative implementation session
**Reviewed**: Pending
