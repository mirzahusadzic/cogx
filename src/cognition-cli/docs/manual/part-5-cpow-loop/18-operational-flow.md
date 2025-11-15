---
type: operational
overlay: O5_Operational
status: complete
---

# Chapter 18: Operational Flow

> **"Work is proof. Proof is work. The cPOW loop makes it verifiable."**

**Part**: V — cPOW Operational Loop
**Chapter**: 18
**Focus**: Transform Pipeline, Orchestrators, Quality Assurance
**Status**: Complete

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Transformation Pipeline](#the-transformation-pipeline)
3. [Orchestrators](#orchestrators)
4. [Quality Assurance](#quality-assurance)
5. [Audit Trail](#audit-trail)
6. [Real-World Examples](#real-world-examples)
7. [Integration with CLI](#integration-with-cli)

---

## Executive Summary

The **Operational Flow** describes how the Cognition CLI transforms source code and documentation into the queryable knowledge lattice through a verifiable pipeline.

### The Three-Phase Architecture

```
Phase I: Bottom-Up Aggregation (Genesis)
  ↓
Phase II: Semantic Enrichment (Overlay Generation)
  ↓
Phase III: Continuous Coherence (Watch → Update)
```

### Key Actors

1. **Oracles**: Validate quality and alignment
2. **Scribes**: Execute transformations
3. **Orchestrators**: Coordinate workflows
4. **Transform Log**: Immutable audit trail

### Why This Matters

Traditional build systems track **what changed**. The cPOW operational flow tracks:

- **What changed** (files, symbols)
- **Why it changed** (intent, goals)
- **How well it changed** (fidelity, quality)
- **Whether it aligns** (mission coherence)

This creates **verifiable AI cognition** with full provenance.

---

## The Transformation Pipeline

### Overview

Every operation in Cognition CLI follows a standard pipeline:

```
Input → [Oracle Validation] → [Scribe Execution] → [Receipt Generation] → Output
```

This is the **G→T→O** loop:

- **G**oal (intent, what we're trying to accomplish)
- **T**ransform (execution, the actual work)
- **O**racle (validation, quality assurance)

### Phase I: Bottom-Up Aggregation (Genesis)

**Command**: `cognition-cli genesis src/`

**What It Does**: Extracts structural patterns from source code.

#### Pipeline Steps

```
1. File Discovery
   ↓
2. AST Extraction (StructuralMiner)
   ↓
3. Symbol Indexing (PatternsManager)
   ↓
4. Embedding Generation (WorkbenchClient → eGemma)
   ↓
5. Vector Storage (LanceVectorStore)
   ↓
6. Overlay Population (O₁ Structure)
   ↓
7. Checkpoint Persistence (GenesisOracle)
```

#### Key Components

**StructuralMiner** (`src/core/structural/miner.ts`):

- Parses TypeScript/JavaScript using AST
- Extracts functions, classes, interfaces, types
- Captures import/export relationships
- Records structural signatures

**GenesisOracle** (`src/core/oracle/genesis-oracle.ts`):

- Validates PGC initialization
- Manages checkpointing for resumption
- Tracks processed files
- Ensures idempotency

**GenesisOrchestrator** (`src/core/orchestrators/genesis.ts`):

- Coordinates multi-step pipeline
- Handles errors and retries
- Reports progress
- Validates completeness

#### Checkpointing

Genesis supports incremental processing via checkpoints:

```typescript
interface GenesisCheckpoint {
  processedFiles: string[];
  lastProcessedPath: string;
  timestamp: number;
  totalFiles: number;
  phase: 'discovery' | 'extraction' | 'embedding' | 'complete';
}
```

**Benefits**:

- Resume after interruption
- Skip already-processed files
- Handle large codebases (5K+ files)
- Verify processing completeness

---

### Phase II: Semantic Enrichment (Overlay Generation)

**Command**: `cognition-cli overlay generate <type>`

**What It Does**: Generates semantic overlays using LLM analysis.

#### Pipeline Steps

```
1. Read O₁ Structure (baseline)
   ↓
2. Send to eGemma (LLM analysis)
   ↓
3. Extract overlay-specific knowledge
   ↓
4. Generate embeddings (768-dimensional)
   ↓
5. Store in overlay directory (YAML + LanceDB)
   ↓
6. Update manifest (source of truth)
```

#### Overlay-Specific Oracles

Each overlay has specialized validation:

**SecurityGuidelinesOracle**:

- Validates threat models
- Ensures attack vector completeness
- Verifies mitigation strategies
- Checks boundary definitions

**MissionConceptsOracle**:

- Validates strategic alignment
- Ensures concept weights are reasonable
- Verifies no mission drift
- Checks principle coverage

**OperationalPatternsOracle**:

- Validates workflow patterns
- Ensures quest structure completeness
- Verifies depth rules
- Checks sacred sequences

#### LLM Prompt Structure

Each oracle uses structured prompts:

```typescript
interface OraclePrompt {
  system: string; // Role and constraints
  context: string; // Relevant code/docs
  task: string; // Specific extraction task
  format: string; // Expected output format
  examples: Example[]; // Few-shot examples
}
```

**Example** (MissionConceptsOracle):

```typescript
{
  system: "You are a mission alignment expert analyzing strategic documents.",
  context: "VISION.md content here...",
  task: "Extract mission concepts with weights (0.0-1.0) based on importance.",
  format: "YAML with type, content, weight, section fields",
  examples: [/* ... */]
}
```

---

### Phase III: Continuous Coherence (Watch → Update)

**Commands**: `cognition-cli watch`, `cognition-cli update`

**What It Does**: Maintains PGC coherence as code evolves.

#### Workflow

```
1. watch: Monitor file changes
   ↓
2. dirty_state.json: Track modifications
   ↓
3. status: Check coherence (< 10ms)
   ↓
4. update: Re-process changed files only
   ↓
5. Coherence restored
```

#### UpdateOrchestrator

The UpdateOrchestrator implements **Monument 3** (incremental sync):

**Algorithm**:

```typescript
async function update(dirtyState: DirtyState): Promise<UpdateReceipt> {
  // 1. Validate dirty state
  const { modified, added, deleted } = dirtyState;

  // 2. Re-process changed files
  for (const file of [...modified, ...added]) {
    await structuralMiner.processFile(file);
    await embeddings.generate(file);
  }

  // 3. Remove deleted files from overlays
  for (const file of deleted) {
    await overlays.remove(file);
    await vectorStore.delete(file);
  }

  // 4. Update affected overlays
  await overlays.regenerate(['O1', 'O3', 'O7']);

  // 5. Clear dirty state
  await dirtyState.clear();

  return { status: 'coherent', filesProcessed: modified.length + added.length };
}
```

**Performance**:

- **Full genesis**: 2-5 minutes for 500 files
- **Incremental update**: 10-30 seconds for 5 changed files
- **Speedup**: 10-20x faster

---

## Orchestrators

Orchestrators coordinate multi-step workflows.

### GenesisOrchestrator

**Purpose**: Coordinate Phase I (bottom-up aggregation)

**Responsibilities**:

1. Initialize PGC and workbench connection
2. Discover source files
3. Extract structural patterns
4. Generate embeddings
5. Populate O₁ overlay
6. Create checkpoints
7. Report progress

**Error Handling**:

- Retry on network failures (3 attempts)
- Skip files with parse errors (log warnings)
- Resume from checkpoint on interruption
- Validate outputs before proceeding

**Progress Reporting**:

```typescript
interface GenesisProgress {
  phase: 'discovery' | 'extraction' | 'embedding' | 'complete';
  filesProcessed: number;
  totalFiles: number;
  currentFile: string;
  errors: Error[];
}
```

### UpdateOrchestrator

**Purpose**: Coordinate Phase III (incremental sync)

**Responsibilities**:

1. Read dirty state
2. Re-process changed files
3. Update affected overlays
4. Regenerate coherence scores
5. Clear dirty state
6. Report summary

**Optimization**:

- Only process changed files (not full codebase)
- Only regenerate affected overlays (O₁, O₃, O₇)
- Batch embedding requests
- Parallel processing where possible

### OverlayOrchestrator

**Purpose**: Coordinate Phase II (overlay generation)

**Responsibilities**:

1. Read O₁ structure (baseline)
2. Send context to LLM
3. Parse LLM responses
4. Validate extracted knowledge
5. Generate embeddings
6. Store in overlay + vector DB
7. Update manifest

**Quality Gates**:

- Validate YAML structure
- Check required fields present
- Verify embedding dimensions (768)
- Ensure uniqueness constraints
- Validate cross-references

---

## Quality Assurance

### Fidelity Scores (Φ)

Every transformation includes a **fidelity score** (0.0-1.0):

```yaml
fidelity: 0.94 # 94% confidence in extraction quality
```

**Calculation**:

```typescript
function calculateFidelity(extraction: Extraction): number {
  let score = 1.0;

  // Penalize missing fields
  if (!extraction.content) score -= 0.5;
  if (!extraction.metadata?.source) score -= 0.2;

  // Penalize short content (likely incomplete)
  if (extraction.content.length < 50) score -= 0.2;

  // Penalize missing embeddings
  if (!extraction.embedding) score -= 0.1;

  return Math.max(0, score);
}
```

**Usage**:

- Filter low-fidelity items in queries (e.g., `fidelity > 0.7`)
- Identify incomplete extractions for re-processing
- Track quality trends over time

### Agentic Quality Score (AQS)

For cPOW-based operations, **AQS** measures overall quest quality:

```
AQS = 0.4 × Fidelity + 0.3 × Coherence + 0.3 × Completeness
```

**Components**:

- **Fidelity**: Extraction accuracy
- **Coherence**: Mission alignment
- **Completeness**: Coverage of requirements

**Thresholds**:

- **AQS > 0.7**: High quality, produces reusable wisdom (CoMP)
- **AQS 0.5-0.7**: Acceptable, minor improvements needed
- **AQS < 0.5**: Low quality, rework required

### Coherence Validation

After Phase II, **O₇ Coherence** overlay validates alignment:

```typescript
interface CoherenceScore {
  symbol: string;
  score: number; // 0.0-1.0
  topConcepts: Array<{ concept: string; similarity: number }>;
  percentile: number; // Position in distribution
}
```

**Process**:

1. For each symbol in O₁
2. Compute embedding similarity to all concepts in O₄
3. Take weighted average of top-K similarities
4. Store score in O₇

**Alerts**:

- **Low coherence** (< 0.5): Potential mission drift
- **Zero coherence**: Symbol has no mission alignment
- **Negative trend**: Codebase drifting from mission

---

## Audit Trail

Every transformation creates an **immutable receipt** in the Transform Log.

### TransformLog Structure

```yaml
# .open_cognition/index/transforms/<hash>.yaml
type: transform_receipt
timestamp: '2025-11-15T14:32:11Z'
goal:
  intent: 'Extract structural patterns from source code'
  depth: 1
  success_criteria: 'All TypeScript files parsed and indexed'
transform:
  input_hash: 'a7f3b9c...'
  output_hash: 'd4e8f2a...'
  method: 'AST_EXTRACTION'
  duration_ms: 1234
oracle:
  validator: 'GenesisOracle'
  fidelity: 0.94
  verified: true
  issues: []
provenance:
  source_files: ['src/core/mission/validator.ts']
  dependencies: ['WorkbenchClient', 'MissionConceptsManager']
  overlays_affected: ['O1_structure']
```

### Audit Queries

**Find all transformations for a file**:

```bash
cognition-cli audit src/core/mission/validator.ts
```

**Check recent low-fidelity transforms**:

```bash
# Query transform log for fidelity < 0.7 in last 24 hours
```

**Verify provenance chain**:

```bash
# Trace from current state back to genesis
```

---

## Real-World Examples

### Example 1: Genesis Run

**Input**: 156 TypeScript files in `src/`

**Pipeline Execution**:

```
[14:30:00] GenesisOrchestrator: Starting Phase I
[14:30:01] File Discovery: Found 156 files
[14:30:02] StructuralMiner: Processing src/cli.ts (1/156)
[14:30:02]   - Extracted 5 functions, 2 classes
[14:30:03] WorkbenchClient: Generating embeddings (batch 1/16)
[14:30:05] LanceVectorStore: Stored 10 vectors
[14:30:06] GenesisOracle: Checkpoint saved (10/156 files)
...
[14:32:34] GenesisOrchestrator: Phase I complete
[14:32:34] Summary:
  - Files processed: 156
  - Functions extracted: 847
  - Classes extracted: 92
  - Interfaces extracted: 134
  - Embeddings generated: 1,073
  - Average fidelity: 0.94
  - Duration: 2m 34s
```

**Outputs**:

- O₁ Structure overlay: 1,073 items
- LanceDB vectors: 1,073 embeddings
- Transform receipts: 156 logs
- Checkpoint: Final state saved

---

### Example 2: Overlay Generation

**Input**: O₁ Structure (1,073 items)

**Pipeline Execution** (O₄ Mission):

```
[14:35:00] OverlayOrchestrator: Starting O₄ generation
[14:35:01] Reading O₁ structure...
[14:35:02] Reading VISION.md...
[14:35:03] MissionConceptsOracle: Analyzing strategic alignment
[14:35:05] WorkbenchClient: LLM prompt sent (2,341 tokens)
[14:35:12] WorkbenchClient: LLM response received (1,876 tokens)
[14:35:13] MissionConceptsOracle: Extracted 67 concepts
[14:35:14] MissionConceptsOracle: Validating...
  - Checking concept weights (0.0-1.0): ✓
  - Checking required sections: ✓
  - Checking uniqueness: ✓
[14:35:15] WorkbenchClient: Generating embeddings (67 concepts)
[14:35:20] LanceVectorStore: Stored 67 vectors
[14:35:21] Overlay written: .open_cognition/overlays/o4_mission/
[14:35:21] Manifest updated
[14:35:21] OverlayOrchestrator: O₄ generation complete
[14:35:21] Summary:
  - Concepts extracted: 67
  - Average weight: 0.76
  - Average fidelity: 0.91
  - Duration: 21s
```

**Outputs**:

- O₄ Mission overlay: 67 concepts
- LanceDB vectors: 67 embeddings
- Transform receipt: 1 log
- Manifest: Updated

---

### Example 3: Incremental Update

**Input**: 3 modified files from dirty_state.json

**Pipeline Execution**:

```
[15:10:00] UpdateOrchestrator: Reading dirty state
[15:10:00]   - Modified: 3 files
[15:10:00]   - Added: 1 file
[15:10:00]   - Deleted: 0 files
[15:10:01] StructuralMiner: Re-processing src/core/mission/validator.ts
[15:10:01]   - Extracted 6 functions (was 5, +1 new)
[15:10:02] StructuralMiner: Re-processing src/utils/helpers.ts
[15:10:02]   - Extracted 8 functions (was 7, +1 new)
[15:10:03] StructuralMiner: Re-processing src/api/routes.ts
[15:10:03]   - Extracted 12 functions (unchanged)
[15:10:04] StructuralMiner: Processing src/new-feature.ts (new)
[15:10:04]   - Extracted 4 functions, 1 class
[15:10:05] WorkbenchClient: Generating embeddings (batch 1/1)
[15:10:07] LanceVectorStore: Updated 31 vectors
[15:10:08] Overlays: Regenerating O₁, O₃, O₇
[15:10:10] O₁ updated (1,073 → 1,077 items)
[15:10:11] O₃ updated (lineage graph rebuilt)
[15:10:12] O₇ updated (coherence scores recalculated)
[15:10:13] Dirty state cleared
[15:10:13] UpdateOrchestrator: Update complete
[15:10:13] Summary:
  - Files processed: 4
  - Symbols updated: 31
  - Time: 13.2s (vs 2m 34s for full genesis = 12x speedup)
```

**Outputs**:

- O₁ Structure: +4 items (1,073 → 1,077)
- O₃ Lineage: Updated dependency graph
- O₇ Coherence: Recalculated scores for 31 symbols
- Dirty state: Cleared
- Transform receipts: 4 logs

---

## Integration with CLI

The operational flow powers all CLI commands:

### genesis

**Orchestrator**: GenesisOrchestrator
**Oracle**: GenesisOracle
**Output**: O₁ overlay, transform logs

### genesis:docs

**Orchestrator**: DocsOrchestrator
**Oracle**: DocsOracle
**Output**: O₄ overlay (concepts), document index

### overlay generate

**Orchestrator**: OverlayOrchestrator
**Oracle**: Type-specific (MissionConceptsOracle, SecurityGuidelinesOracle, etc.)
**Output**: O₂-O₇ overlays, transform logs

### update

**Orchestrator**: UpdateOrchestrator
**Oracle**: GenesisOracle (for structural validation)
**Output**: Updated overlays (O₁, O₃, O₇), cleared dirty state

### coherence

**Query**: O₇ overlay (no transformation)
**Output**: Alignment scores, drift detection

---

## Key Takeaways

1. **Three-Phase Architecture**: Genesis → Overlay Generation → Continuous Coherence
2. **G→T→O Loop**: Every operation has Goal, Transform, Oracle validation
3. **Orchestrators**: Coordinate multi-step workflows with error handling
4. **Quality Assurance**: Fidelity scores, AQS, coherence validation
5. **Audit Trail**: Immutable transform logs with full provenance
6. **Incremental Processing**: 10-20x speedup via dirty state tracking

---

## Next Steps

- **[Chapter 19: Quest Structures](19-quest-structures.md)** — Learn quest anatomy and depth levels
- **[Chapter 20: cPOW Reference](20-cpow-reference.md)** — Deep dive into cPOW mathematics
- **[Chapter 5: CLI Operations](../part-1-foundation/05-cli-operations.md)** — Command reference

---

**The operational flow is not just a pipeline—it's a verifiable proof system.** Every transformation is traceable, every quality score is measurable, and every oracle decision is auditable. This is how we move from "AI did something" to "AI did something verifiable."
