# Chapter 8: O₄ Mission — Strategic Alignment

> **The Axiom Applied**: Mission concepts form a sublattice where vision meets principles at points of coherent alignment. "Does this code serve our mission?" becomes a computable query—measuring semantic distance between implementation and intent.

**Part**: II — The Seven Layers<br/>
**Layer**: O₄ (Mission)<br/>
**Role**: Strategic Alignment<br/>
**Knowledge Types**: 4 (concept, principle, goal, vision)<br/>

---

## Table of Contents

1. [Purpose and Scope](#purpose-and-scope)
2. [The Four Knowledge Types](#the-four-knowledge-types)
3. [MissionConceptsManager Architecture](#missionconceptsmanager-architecture)
4. [Document Classification and Routing](#document-classification-and-routing)
5. [Strategic Coherence Scoring](#strategic-coherence-scoring)
6. [Cross-Overlay Queries](#cross-overlay-queries)
7. [Real-World Examples](#real-world-examples)
8. [Implementation Deep Dive](#implementation-deep-dive)
9. [Common Pitfalls](#common-pitfalls)
10. [Performance Characteristics](#performance-characteristics)

---

## Purpose and Scope

The **O₄ Mission overlay** stores strategic knowledge extracted from mission documents like `VISION.md`, `MISSION.md`, and `CODING_PRINCIPLES.md`. It answers **"WHAT should we build?"** and **"WHY?"**

**Key Distinction**: O₄ is **descriptive** (what/why), not prescriptive (how).

### What O₄ Stores

**Strategic Knowledge**: High-level vision, goals, principles, concepts

- Vision statements (long-term aspirations)
- Mission concepts (core ideas)
- Principles (invariant truths)
- Goals (measurable objectives)

**NOT stored in O₄**:

- Workflow guidance (→ O₅ Operational)
- Security constraints (→ O₂ Security)
- Code structure (→ O₁ Structure)
- Formal proofs (→ O₆ Mathematical)

### Why O₄ Matters

**Problem**: How do you verify that code aligns with strategic intent? How do you detect mission drift?

**Solution**: O₄ enables **strategic coherence scoring**:

```bash
# "Does this function serve our mission?"
cognition-cli coherence report

# "Which mission principles apply to this code?"
cognition-cli lattice "O1[symbol=handleAuth] -> O4[principle]"

# "Are security constraints aligned with mission?"
cognition-cli lattice "O2[constraint] ~ O4[principle]"
```

---

## The Four Knowledge Types

O₄ extracts **4 types of strategic knowledge** from mission documents.

### 1. Vision

**Definition**: Long-term aspirational statements describing the desired future state.

**Purpose**: Provides the "North Star" for all strategic decisions.

**Detection Pattern**:

- Documents named `VISION.md`, `MISSION.md`
- Sections with headers containing "vision", "aspiration", "future"
- Forward-looking language ("will be", "aims to", "envisions")

**Example**:

```markdown
## Vision

We envision a world where AI cognitive systems are:

- **Transparent**: Every decision is auditable and explainable
- **Portable**: Knowledge travels with the code, not locked in tools
- **Verifiable**: Claims about system behavior are provably true
- **Compositional**: Simple overlays combine into powerful queries
```

**Embedding Content**: Full vision statement

**Metadata Fields**:

```typescript
{
  type: 'vision',
  text: 'We envision a world where AI cognitive systems...',
  context: '## Vision\n\nWe envision...',
  source_file: 'VISION.md',
  scope: 'long_term' | 'strategic' | 'aspirational'
}
```

**Use Case**: Validate that strategic decisions align with long-term vision.

---

### 2. Concept

**Definition**: Core ideas and themes that define the mission.

**Purpose**: Extracts key concepts that capture mission essence.

**Detection Pattern**:

- High TF-IDF scores (words unique to mission documents)
- Frequently mentioned terms
- Noun phrases that appear in strategic contexts
- Terms defined explicitly (e.g., "The Lattice", "PGC", "Overlay")

**Example**:

```markdown
The **Persistent Grounded Context (PGC)** is the foundational data structure
that stores all cognitive knowledge. Unlike traditional databases, the PGC is:

- Content-addressable (hash-based storage)
- Immutable (append-only, versioned)
- Portable (can be exported as .cogx files)
- Compositional (overlays combine via lattice algebra)
```

**Embedding Content**: Concept name + definition + key properties

**Metadata Fields**:

```typescript
{
  type: 'concept',
  text: 'Persistent Grounded Context (PGC): foundational data structure...',
  context: '...',
  source_file: 'VISION.md',
  concept_name: 'PGC',
  aliases: ['Persistent Grounded Context', 'PGC'],
  related_concepts: ['Overlay', 'Lattice', 'Content-addressable']
}
```

**Use Case**: Ensure code uses concepts consistently with mission definitions.

---

### 3. Principle

**Definition**: Invariant truths that govern all implementation decisions.

**Purpose**: Non-negotiable rules that apply to every line of code.

**Detection Pattern**:

- Imperative language: "must", "always", "never"
- Principle statements: "is essential", "is fundamental"
- Sections titled "Principles", "Philosophy", "Core Values"

**Example**:

```markdown
## Architectural Principles

### 1. Immutability is Essential

**Principle**: Once data is written, it cannot be changed. All state changes
create new versions.

**Why**: Immutability enables cryptographic provenance, reproducible builds,
and fearless concurrency.

**Violations to Watch**:

- Direct file mutation without hash recalculation
- In-place array/object modifications
- Shared mutable state across workers
```

**Embedding Content**: Principle statement + rationale + implications

**Metadata Fields**:

```typescript
{
  type: 'principle',
  text: 'Immutability is Essential: Once data is written...',
  context: '## Architectural Principles\n\n### 1. Immutability...',
  source_file: 'CODING_PRINCIPLES.md',
  principle_name: 'Immutability is Essential',
  category: 'architectural' | 'implementation' | 'design',
  imperative: 'must' | 'always' | 'never'
}
```

**Use Case**: Flag code that violates architectural principles.

---

### 4. Goal

**Definition**: Measurable objectives with concrete success criteria.

**Purpose**: Translate vision into actionable targets.

**Detection Pattern**:

- Measurable outcomes: "reduce by X%", "achieve Y"
- Time-bound: "by Q2", "within 6 months"
- Success criteria: "when...", "until...", "once..."
- Sections titled "Goals", "Objectives", "Milestones"

**Example**:

```markdown
## Strategic Goals

### Q4 2025: Complete Lattice Algebra

**Goal**: Implement boolean operations across all overlays

**Success Criteria**:

- ✓ Meet operation (O₂ ∧ O₄) with configurable threshold
- ✓ Union, Intersection, Difference on overlay sets
- ✓ Query parser supporting ASCII operators (~, ->, +, -, &)
- ✓ CLI command: `cognition-cli lattice "O1 - O2"`
- ✓ Documentation: Chapter 12 (Boolean Operations)

**Impact**: Enables compositional queries for security, coherence, workflow analysis
```

**Embedding Content**: Goal statement + success criteria + impact

**Metadata Fields**:

```typescript
{
  type: 'goal',
  text: 'Complete Lattice Algebra: Implement boolean operations...',
  context: '## Strategic Goals\n\n### Q4 2025...',
  source_file: 'MISSION.md',
  goal_name: 'Complete Lattice Algebra',
  timeline: 'Q4 2025',
  success_criteria: [
    'Meet operation implemented',
    'Set operations implemented',
    'Query parser complete',
    // ...
  ],
  status: 'in_progress' | 'completed' | 'blocked' | 'pending'
}
```

**Use Case**: Track progress toward strategic objectives, identify blockers.

---

## MissionConceptsManager Architecture

### Class Overview

```typescript
/**
 * MissionConceptsManager
 *
 * Manages mission concepts overlays in the PGC (O₄ layer).
 * Stores extracted strategic knowledge from mission documents.
 *
 * LOCATION: src/core/overlays/mission-concepts/manager.ts
 *
 * OVERLAY STRUCTURE:
 * .open_cognition/overlays/mission_concepts/<doc-hash>.yaml
 */
export class MissionConceptsManager {
  private overlayPath: string;
  private workbench: WorkbenchClient;

  constructor(pgcRoot: string, workbenchUrl?: string) {
    this.overlayPath = path.join(pgcRoot, 'overlays', 'mission_concepts');
    this.workbench = new WorkbenchClient(
      workbenchUrl || 'http://localhost:8000'
    );
  }

  // Core methods
  async generateOverlay(/* ... */): Promise<void>;
  async loadOverlay(
    documentHash: string
  ): Promise<MissionConceptsOverlay | null>;
  async listOverlays(): Promise<string[]>;
  async queryConceptsgetText(
    queryText: string,
    topK?: number
  ): Promise<MissionConcept[]>;
}
```

### Overlay Format

**Storage**: `.open_cognition/overlays/mission_concepts/<doc-hash>.yaml`

**Structure**:

```yaml
document_hash: abc123def456...
document_path: VISION.md
generated_at: '2025-10-30T12:00:00Z'
transform_id: genesis_doc_transform_v1

extracted_concepts:
  - type: vision
    text: 'We envision AI cognitive systems that are transparent...'
    context: "## Vision\n\nWe envision..."
    source_file: VISION.md
    scope: long_term
    embedding: [0.123, 0.456, ..., 0.789] # 768 dimensions

  - type: concept
    text: 'Persistent Grounded Context (PGC): foundational data structure'
    context: 'The **PGC** is...'
    source_file: VISION.md
    concept_name: PGC
    aliases: ['Persistent Grounded Context', 'PGC']
    embedding: [0.234, 0.567, ..., 0.890]

  - type: principle
    text: 'Immutability is Essential: Once data is written...'
    context: '## Architectural Principles...'
    source_file: CODING_PRINCIPLES.md
    principle_name: Immutability is Essential
    category: architectural
    imperative: must
    embedding: [0.345, 0.678, ..., 0.901]

  - type: goal
    text: 'Complete Lattice Algebra by Q4 2025'
    context: '## Strategic Goals...'
    source_file: MISSION.md
    goal_name: Complete Lattice Algebra
    timeline: Q4 2025
    status: completed
    embedding: [0.456, 0.789, ..., 0.012]
```

### Embedding Generation

**Algorithm**: Same as O₂ Security (sanitize text, call eGemma, validate 768 dimensions)

```typescript
async generateEmbeddings(concepts: MissionConcept[]): Promise<MissionConcept[]> {
  const results: MissionConcept[] = [];

  for (const concept of concepts) {
    // 1. Sanitize text (remove Unicode, special chars)
    const sanitized = this.sanitizeForEmbedding(concept.text);

    // 2. Call eGemma for embedding
    const response = await this.workbench.embed({
      signature: sanitized,
      dimensions: 768,
    });

    // 3. Validate embedding
    const embedding = response['embedding_768d'];
    if (!embedding || embedding.length !== 768) {
      console.warn(`Invalid embedding for concept: ${concept.text}`);
      continue;
    }

    // 4. Attach embedding
    results.push({ ...concept, embedding });
  }

  return results;
}
```

### Query Interface

```typescript
/**
 * Query mission concepts by semantic similarity
 */
async queryConcepts(
  queryText: string,
  topK: number = 5
): Promise<Array<{ concept: MissionConcept; similarity: number }>> {
  // 1. Generate query embedding
  const queryEmbedding = await this.workbench.embed({
    signature: queryText,
    dimensions: 768,
  });

  // 2. Load all overlays
  const overlays = await this.listOverlays();
  const allConcepts: MissionConcept[] = [];

  for (const hash of overlays) {
    const overlay = await this.loadOverlay(hash);
    if (overlay) {
      allConcepts.push(...overlay.extracted_concepts);
    }
  }

  // 3. Compute cosine similarity
  const results = allConcepts.map((concept) => ({
    concept,
    similarity: this.cosineSimilarity(queryEmbedding, concept.embedding!),
  }));

  // 4. Sort by similarity and return top K
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
```

**Example Queries**:

```typescript
// Find principles related to immutability
const results = await manager.queryConcepts('immutable data storage', 5);

// Find goals related to performance
const goals = await manager.queryConcepts('optimize performance speed', 10);

// Find vision statements about portability
const vision = await manager.queryConcepts('portable exportable knowledge', 5);
```

---

## Document Classification and Routing

### Phase 2 Integration

Genesis command routes strategic documents to O₄:

```typescript
// In GenesisDocTransform (src/core/transforms/genesis-doc-transform.ts)

async routeToOverlays(
  classification: { type: DocumentType; confidence: number },
  ast: MarkdownDocument,
  filePath: string,
  contentHash: string,
  objectHash: string
): Promise<void> {
  switch (classification.type) {
    case DocumentType.STRATEGIC:
      await this.generateMissionOverlay(ast, contentHash, objectHash, filePath);
      break;
    // ... other cases
  }
}

async generateMissionOverlay(
  ast: MarkdownDocument,
  contentHash: string,
  objectHash: string,
  relativePath: string
): Promise<void> {
  // 1. Extract mission concepts from AST
  const extractor = new ConceptExtractor();
  const concepts = await extractor.extractConcepts(ast, relativePath);

  if (concepts.length === 0) {
    return; // No mission concepts found
  }

  // 2. Generate overlay via MissionConceptsManager
  const manager = new MissionConceptsManager(this.pgcRoot, this.workbenchUrl);
  await manager.generateOverlay(
    relativePath,
    contentHash,
    concepts,
    this.getTransformId()
  );
}
```

### Document Classification

**Classifier** (`src/core/analyzers/document-classifier.ts`):

```typescript
enum DocumentType {
  STRATEGIC = 'strategic', // Mission, vision, principles ← O₄
  OPERATIONAL = 'operational', // Workflows, quest structure
  SECURITY = 'security', // Threat models, vulnerabilities
  MATHEMATICAL = 'mathematical', // Theorems, proofs
  TECHNICAL = 'technical', // API docs, architecture (generic)
}
```

**Strategic Classification Signals**:

- Filename: `VISION.md`, `MISSION.md`, `PRINCIPLES.md`, `GOALS.md`
- Headers: "Vision", "Mission", "Principle", "Goal", "Strategy"
- Keywords: "envision", "aspire", "fundamental", "core value"
- Forward-looking language: "will be", "aims to", "strives for"

---

## Strategic Coherence Scoring

O₄ Mission enables **coherence analysis**: measuring alignment between code and strategic intent.

### The Problem

How do you know if code serves the mission? Traditional approaches:

- Manual code review (subjective, incomplete)
- Naming conventions (easily violated)
- Documentation (becomes stale)

### The Solution: Embedding-Based Coherence

**Idea**: Measure semantic distance between code symbols (O₁) and mission concepts (O₄).

**Algorithm**:

```
1. Extract code symbols from O₁ (functions, classes, modules)
2. Extract mission concepts from O₄ (vision, principles, goals)
3. For each symbol:
   a. Compute cosine similarity to all mission concepts
   b. Find nearest concept (highest similarity)
   c. Record alignment score
4. Aggregate scores to produce coherence report
```

### Implementation

```typescript
// In StrategicCoherenceManager (src/core/overlays/strategic-coherence/manager.ts)

interface CoherenceScore {
  symbol: string;                 // Code symbol (e.g., "handleAuth")
  file_path: string;              // Where the symbol is defined
  nearest_concept: string;        // Closest mission concept
  similarity: number;             // Cosine similarity (0-1)
  alignment_level: 'high' | 'medium' | 'low' | 'none';
}

async analyzeCoherence(
  structural: OverlayAlgebra,    // O₁
  mission: OverlayAlgebra         // O₄
): Promise<CoherenceScore[]> {
  // 1. Get all code symbols
  const symbols = await structural.getAllItems();

  // 2. Get all mission concepts
  const concepts = await mission.getAllItems();

  // 3. For each symbol, find nearest concept
  const scores: CoherenceScore[] = [];

  for (const symbol of symbols) {
    let maxSimilarity = 0;
    let nearestConcept = null;

    for (const concept of concepts) {
      const similarity = this.cosineSimilarity(
        symbol.embedding,
        concept.embedding
      );

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        nearestConcept = concept;
      }
    }

    scores.push({
      symbol: symbol.metadata.symbol,
      file_path: symbol.metadata.file_path,
      nearest_concept: nearestConcept?.metadata.text || 'None',
      similarity: maxSimilarity,
      alignment_level: this.classifyAlignment(maxSimilarity),
    });
  }

  return scores.sort((a, b) => a.similarity - b.similarity); // Worst first
}

private classifyAlignment(similarity: number): string {
  if (similarity >= 0.8) return 'high';
  if (similarity >= 0.6) return 'medium';
  if (similarity >= 0.4) return 'low';
  return 'none';
}
```

### Example Coherence Report

```bash
cognition-cli coherence report

# Output:
Strategic Coherence Analysis
============================

Overall Coherence: 73% (219/300 symbols have medium+ alignment)

High Alignment (>0.8):
✓ handleAuthentication     → Principle: "Security is foundational" (0.89)
✓ calculateStructuralHash  → Principle: "Hashes are provenance" (0.87)
✓ generateEmbedding        → Concept: "Semantic substrate" (0.85)

Medium Alignment (0.6-0.8):
⚠ processUserInput         → Principle: "Validate all input" (0.72)
⚠ exportOverlay            → Concept: "Portable knowledge" (0.68)

Low Alignment (<0.6):
❌ helperFunction           → Concept: "PGC immutability" (0.42)
❌ tempStorage              → Principle: "Content-addressable" (0.38)
❌ utils                    → Goal: "Lattice algebra" (0.25)

Recommendations:
1. Rename "helperFunction" to reflect mission alignment
2. Review "tempStorage" - violates immutability principle?
3. Clarify "utils" purpose relative to strategic goals
```

---

## Cross-Overlay Queries

O₄ Mission becomes powerful when combined with other overlays via lattice algebra.

### Example 1: Which Code Serves Our Mission?

**Query**: `O1[symbols] ~ O4[concept]`

**Meaning**: Find code symbols (O₁) that semantically align with mission concepts (O₄)

**Use Case**: Identify code that directly implements mission goals

```bash
cognition-cli lattice "O1 ~ O4" --threshold 0.8

# Output:
# High-Alignment Code:
# - handleAuth (0.89) → "Security is foundational"
# - calculateHash (0.87) → "Hashes are provenance"
# - exportCogx (0.85) → "Portable knowledge"
```

**TypeScript**:

```typescript
import { meet } from './core/algebra/lattice-operations.js';

const structural = await registry.get('O1');
const mission = await registry.get('O4');

const symbols = await structural.getAllItems();
const concepts = await mission.getAllItems();

const aligned = await meet(symbols, concepts, { threshold: 0.8 });

for (const { itemA, itemB, similarity } of aligned) {
  console.log(
    `${itemA.metadata.symbol} → ${itemB.metadata.text} (${similarity})`
  );
}
```

### Example 2: Do Security Constraints Align With Principles?

**Query**: `O2[constraint] ~ O4[principle]`

**Meaning**: Find security constraints (O₂) that align with mission principles (O₄)

**Use Case**: Verify that security rules serve strategic goals

```bash
cognition-cli lattice "O2[constraint] ~ O4[principle]" --threshold 0.75

# Output:
# Aligned Security Constraints:
# - "Validate all input" (0.89) → "Security is foundational"
# - "Use content-addressable storage" (0.82) → "Hashes are provenance"
# - "Immutable overlay storage" (0.79) → "Immutability is essential"
```

### Example 3: Which Principles Apply to This Function?

**Query**: `O1[symbol=handleAuth] -> O4[principle]`

**Meaning**: Given code symbol (O₁), project to applicable mission principles (O₄)

**Use Case**: Find principles relevant to specific code during review

```bash
cognition-cli lattice "O1[handleAuth] -> O4[principle]"

# Output:
# Principles for handleAuth:
# 1. "Security is foundational" (similarity: 0.89)
# 2. "Validate all input" (similarity: 0.85)
# 3. "Never store plaintext passwords" (similarity: 0.78)
# 4. "Use cryptographic hashing" (similarity: 0.72)
```

### Example 4: Goal Progress Tracking

**Query**: `O4[goal][status=in_progress]`

**Meaning**: Find all in-progress goals from mission documents

**Use Case**: Track progress toward strategic objectives

```bash
cognition-cli lattice "O4[goal][status=in_progress]"

# Output:
# In-Progress Goals:
# - "Complete Lattice Algebra" (Q4 2025)
#   Success Criteria: 4/5 complete
#   Remaining: Documentation
#
# - "Implement cPOW Validation Loop" (Q1 2026)
#   Success Criteria: 2/6 complete
#   Remaining: Oracle, Scribe, AQS, Receipt
```

---

## Real-World Examples

### Example 1: Mission Drift Detection

**Scenario**: Detect when code changes diverge from mission alignment.

```typescript
// In CI/CD pipeline
import { analyzeCoherence } from './core/overlays/strategic-coherence/manager.js';

async function detectDrift() {
  // Get coherence scores before and after changes
  const beforeScores = await analyzeCoherence(structural, mission);

  // Make code changes...

  const afterScores = await analyzeCoherence(structural, mission);

  // Compute drift
  const drift = afterScores.filter((after, i) => {
    const before = beforeScores[i];
    return after.similarity < before.similarity - 0.1; // 10% drop
  });

  if (drift.length > 0) {
    console.warn(`⚠️  Mission drift detected in ${drift.length} symbols:`);
    for (const score of drift) {
      console.warn(`   - ${score.symbol}: ${score.similarity.toFixed(2)}`);
    }
    process.exit(1); // Fail CI
  }
}
```

### Example 2: Principle Violation Detection

**Scenario**: Flag code that violates architectural principles.

```typescript
// Find mutable operations that violate "Immutability is Essential"
const mutabilityPrinciple = await mission.filter((m) =>
  m.text.includes('Immutability is Essential')
);

const mutableOps = await structural.filter(
  (m) => m.symbol.includes('update') || m.symbol.includes('modify')
);

const violations = await meet(mutableOps, mutabilityPrinciple, {
  threshold: 0.7,
});

if (violations.length > 0) {
  console.warn('⚠️  Potential immutability violations:');
  for (const { itemA, itemB, similarity } of violations) {
    console.warn(`   - ${itemA.metadata.symbol} (${itemA.metadata.file_path})`);
    console.warn(`     Violates: ${itemB.metadata.text}`);
  }
}
```

### Example 3: Strategic Code Review Checklist

**Scenario**: Generate mission-aligned review checklist for PRs.

```bash
# Get changed files from git
git diff main --name-only > changed_files.txt

# Extract symbols from changed files
cognition-cli patterns changed_files.txt --format symbols > symbols.txt

# Find applicable principles for each symbol
for symbol in $(cat symbols.txt); do
  echo "## $symbol"
  cognition-cli lattice "O1[$symbol] -> O4[principle]" --limit 3
  echo
done

# Output:
# ## handleUserInput
# Applicable Principles:
# 1. "Validate all input" (0.89)
# 2. "Never trust external data" (0.85)
# 3. "Security is foundational" (0.78)
#
# ## exportOverlay
# Applicable Principles:
# 1. "Portable knowledge" (0.92)
# 2. "Content-addressable storage" (0.87)
# 3. "Immutability is essential" (0.81)
```

---

## Implementation Deep Dive

### Directory Structure

```
src/core/overlays/mission-concepts/
  ├── manager.ts           # MissionConceptsManager class
  └── index.ts             # Exports

.open_cognition/overlays/mission_concepts/
  ├── abc123.yaml          # Overlay for VISION.md
  ├── def456.yaml          # Overlay for MISSION.md
  └── ghi789.yaml          # Overlay for CODING_PRINCIPLES.md
```

### Key Methods

#### generateOverlay

```typescript
async generateOverlay(
  documentPath: string,
  documentHash: string,
  concepts: MissionConcept[],
  transformId: string
): Promise<void> {
  // 1. Generate embeddings for all concepts
  const withEmbeddings = await this.generateEmbeddings(concepts, documentPath);

  // 2. Create overlay structure
  const overlay: MissionConceptsOverlay = {
    document_hash: documentHash,
    document_path: documentPath,
    extracted_concepts: withEmbeddings,
    generated_at: new Date().toISOString(),
    transform_id: transformId,
  };

  // 3. Write to disk
  await fs.ensureDir(this.overlayPath);
  const filePath = path.join(this.overlayPath, `${documentHash}.yaml`);
  await fs.writeFile(filePath, YAML.stringify(overlay));
}
```

#### loadOverlay

```typescript
async loadOverlay(documentHash: string): Promise<MissionConceptsOverlay | null> {
  const filePath = path.join(this.overlayPath, `${documentHash}.yaml`);

  if (!(await fs.pathExists(filePath))) {
    return null;
  }

  const content = await fs.readFile(filePath, 'utf-8');
  return YAML.parse(content) as MissionConceptsOverlay;
}
```

#### queryConcepts

```typescript
async queryConcepts(
  queryText: string,
  topK: number = 5
): Promise<Array<{ concept: MissionConcept; similarity: number }>> {
  // 1. Generate query embedding
  const sanitized = this.sanitizeForEmbedding(queryText);
  const response = await this.workbench.embed({
    signature: sanitized,
    dimensions: 768,
  });
  const queryEmbedding = response['embedding_768d'];

  // 2. Load all overlays
  const hashes = await this.listOverlays();
  const allConcepts: MissionConcept[] = [];

  for (const hash of hashes) {
    const overlay = await this.loadOverlay(hash);
    if (overlay) {
      allConcepts.push(...overlay.extracted_concepts);
    }
  }

  // 3. Compute similarities
  const results = allConcepts
    .filter((concept) => concept.embedding && concept.embedding.length === 768)
    .map((concept) => ({
      concept,
      similarity: this.cosineSimilarity(queryEmbedding, concept.embedding!),
    }));

  // 4. Sort and return top K
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
```

---

## Common Pitfalls

### Pitfall 1: Confusing O₄ (Mission) with O₅ (Operational)

**Problem**: Storing workflow guidance in mission documents.

**Symptom**: Mission overlay contains "how to work" instead of "what to build".

**Example**:

```markdown
❌ WRONG (in VISION.md):

## Workflow

1. Focus: Define the quest
2. Lock: Commit to approach
3. Test: Validate assumptions
4. Build: Execute the plan

✅ CORRECT (in VISION.md):

## Vision

We envision a cognitive architecture where knowledge is verifiable,
portable, and compositional.
```

**Fix**:

- O₄ = WHAT to build, WHY (strategic)
- O₅ = HOW to work (procedural)
- See [Chapter 9: O₅ Operational](09-o5-operational.md)

### Pitfall 2: Overly Generic Concepts

**Problem**: Extracting concepts that are too vague to measure alignment.

**Symptom**: Low coherence scores even for mission-aligned code.

**Example**:

```typescript
❌ TOO GENERIC:
concept: "Software system"

✅ SPECIFIC:
concept: "Persistent Grounded Context (PGC): content-addressable immutable storage"
```

**Fix**: Ensure concepts are specific, well-defined, and unique to your mission.

### Pitfall 3: Missing Principle Rationale

**Problem**: Stating principles without explaining WHY they matter.

**Symptom**: Hard to verify violations, unclear trade-offs.

**Example**:

```markdown
❌ INCOMPLETE:
**Principle**: Immutability is essential.

✅ COMPLETE:
**Principle**: Immutability is essential.

**Why**: Immutability enables:

- Cryptographic provenance (hash = identity)
- Reproducible builds (same input → same output)
- Fearless concurrency (no race conditions)

**Violations to Watch**:

- Direct file mutation without hash recalculation
- In-place array/object modifications
```

**Fix**: Always include rationale and concrete violation examples.

### Pitfall 4: Stale Mission Documents

**Problem**: Mission documents become outdated as project evolves.

**Symptom**: Coherence scores drop over time, goals show "blocked" indefinitely.

**Fix**: Regular mission review cadence

```bash
# Monthly mission review
cognition-cli coherence report --compare-to last-month

# Flag stale goals
cognition-cli lattice "O4[goal][status=blocked]"

# Update mission documents
# Re-run genesis to regenerate O₄ overlays
cognition-cli genesis VISION.md MISSION.md
```

### Pitfall 5: Ignoring Low-Coherence Signals

**Problem**: Low coherence scores treated as "just metrics" instead of actionable feedback.

**Symptom**: Growing number of low-alignment symbols, mission drift.

**Fix**: Treat coherence as a code smell

```typescript
// In CI/CD
if (coherenceScore < 0.6) {
  throw new Error(
    `Low mission alignment for ${symbol} (${coherenceScore.toFixed(2)}). ` +
      `Either improve alignment or update mission to reflect new reality.`
  );
}
```

---

## Performance Characteristics

### Embedding Generation

**Operation**: Generate embeddings for N mission concepts

**Complexity**: O(N × E) where E = embedding API latency (~100ms)

**Benchmark**:

- 10 concepts: ~1 second
- 50 concepts: ~5 seconds
- 100 concepts: ~10 seconds

**Optimization**: Embeddings cached in overlay files (generated once, queried many times)

### Query Performance

**Operation**: Semantic search across M overlays with total N concepts

**Complexity**: O(M × N × D) where D = 768 dimensions (cosine similarity)

**Benchmark**:

- 1 overlay, 50 concepts: ~5ms
- 3 overlays, 150 concepts: ~15ms
- 10 overlays, 500 concepts: ~50ms

**Optimization**: Use LanceDB for large-scale queries (O(N × log M) via ANN)

### Coherence Analysis

**Operation**: Analyze coherence for S symbols against C concepts

**Complexity**: O(S × C × D) for pairwise similarity

**Benchmark**:

- 100 symbols × 50 concepts: ~50ms
- 500 symbols × 150 concepts: ~750ms
- 1000 symbols × 500 concepts: ~5 seconds

**Optimization**: Batch processing, parallel workers, LanceDB ANN

---

## Summary

**O₄ Mission: Strategic Alignment**

- **4 Knowledge Types**: vision, concept, principle, goal
- **Strategic Role**: Answers "WHAT to build?" and "WHY?"
- **Coherence Scoring**: Measure alignment between code and mission via embeddings
- **Cross-Overlay Queries**: O₁ ~ O₄ (code serving mission), O₂ ~ O₄ (security aligned)
- **Drift Detection**: Track coherence over time, flag misalignment
- **Integration**: Genesis command routes strategic documents to O₄

**Key Distinction**: O₄ is descriptive (what/why), O₅ is prescriptive (how).

**Use Cases**:

- Strategic code review (which principles apply?)
- Mission drift detection (coherence dropping?)
- Goal progress tracking (which goals in progress?)
- Principle violation detection (code contradicting principles?)

**Next Steps**:

- Chapter 9: O₅ Operational (workflow guidance) ✅ Complete
- Chapter 11: O₇ Coherence (cross-layer synthesis)
- Part V: cPOW Loop (Oracle, Scribe, AQS, Receipt)

---

**Next Chapter**: [Chapter 9: O₅ Operational — Workflow Guidance](09-o5-operational.md) ✅

**Previous Chapter**: [Chapter 7: O₃ Lineage — Dependency Tracking](07-o3-lineage.md)

---

**Status**: ✅ Complete (October 30, 2025)
**Author**: Collaborative implementation session
**Reviewed**: Pending
