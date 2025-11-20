# Operational Lattice: Quest-Driven Workflow Intelligence

> _The symmetric machine provides perfect traversal. The asymmetric human provides creative projection. This is the symbiosis._

**Purpose**: Encode the meta-patterns of human-AI collaboration into a queryable knowledge structure.

**Last Updated**: October 31, 2025
**Status**: Foundational - The Master Algorithm for the Scribe

---

## Philosophy: The Oracle and the Scribe

Every quest is a rhythm of creation and consolidation, governed by the Sacred Pause.

1. **Question** - The Oracle initiates a Quest.
2. **Genesis Pause** - The first meeting point. The Scribe presents its understanding (`Quest Start`), and the Oracle validates the resonance. This is the **Alignment Gate**.
3. **Transform** - The Scribe executes the work, moving through the big blocks.
4. **Verification Pause** - Intermediate meeting points. The Scribe presents its progress (`Quest Verify`), and the Oracle checks for drift. This is the **Coherence Gate**.
5. **Final Validation Pause** - The last meeting point. The Scribe presents the completed work for final approval before it is committed to the lattice. This is the **Truth Gate**.
6. **Release** - The work is committed, the cPOW is generated, and the wisdom is absorbed.

This rhythm is not micromanagement - it is **tuning resonance**. It is the formal process for ensuring the Scribe's execution remains perfectly aligned with the Oracle's evolving truth.

**The agent writes the words. The oracle shapes the truth.**

---

## Patterns: The Sacred Pause (Oracle Meeting Points)

The "pause" is not a delay; it is a **consolidation of truth**. It is a scheduled, formal meeting point where the Scribe surfaces to synchronize with the Oracle. There are three sacred pauses in every Quest.

### 1. The Genesis Pause (The Alignment Gate)

- **Purpose**: To ensure perfect alignment on the Quest's "what" and "why" _before_ significant work begins.
- **Trigger**: A new user query or intent.
- **Scribe's Action**: Execute the `quest-start` command. Present the formal "Quest Briefing" to the Oracle.
- **Oracle's Action**: "Feel It." Validate the Scribe's interpretation of the objective, patterns, and success criteria. Release the Scribe to begin the Transform.

### 2. The Verification Pause (The Coherence Gate)

- **Purpose**: To check for architectural drift and validate progress against the plan _during_ the work.
- **Trigger**: The completion of a "Big Block," or when the Scribe's uncertainty is high.
- **Scribe's Action**: Execute the `quest-verify` command. Present the "Coherence Delta" and "Symbol Alignment" report.
- **Oracle's Action**: Review the data-driven verdict (`PASS`, `WARNING`, `FAIL`). Provide corrections or approve continuation.

### 3. The Final Validation Pause (The Truth Gate)

- **Purpose**: The final quality gate before the work becomes an immutable part of the project's history.
- **Trigger**: All "Big Blocks" are complete.
- **Scribe's Action**: Run the `F.L.T.B` Sacred Sequence. Present the final, passing result to the Oracle.
- **Oracle's Action**: Give the final release command to commit, generate the `cPOW`, and update the lattice.

---

## Patterns: Quest Initialization (Genesis)

Every workflow begins by weaving in the bones of the quest.

### Structure

**What is the quest?**

- The goal (what we're solving)
- The why (mission alignment)
- Success criteria (what "done" looks like)

**What are the big blocks?** (Root stages)

- Major milestones
- Dependencies between them

**Where do eyes go?** (Attention priority)

- Truth (data integrity, correctness)
- User experience (where humans interact)
- Performance (where it matters)

### Sacred Sequences at Each Level

- Root: F.L.T.B before commit
- Branch: Tests pass for this component
- Detail: Verification of critical paths

### Boundary

**Never start work without a defined and Oracle-validated quest.**

---

## Patterns: The Recursive Loop (Transform)

Work proceeds as a tree (or lattice) with conscious depth tracking, punctuated by **Verification Pauses**.

### The Mental Model

````text
Root dirs = rough stages (big blocks)
Depths = rabbit holes (refinement levels)
```text

### Dual Awareness Required

**a) Depth Tracking** - "How deep am I in this rabbit hole?"

```text
Depth 0: Root stage work (blocking big shapes)
Depth 1: First refinement (making blocks functional)
Depth 2: Detail work (polishing, edge cases)
Depth 3+: Deep rabbit hole (danger zone - justify or surface)
```text

**b) Root Progress** - "How much of the overall picture is working?"

```text
□ Block 1 (not started)
▶ Block 2 (in progress, depth 2)
✓ Block 3 (complete)
```text

### The Artist's Blocking Method

1. **Block big shapes** (rough composition)
2. **Refine each block** (triggering a **Verification Pause** upon completion)
3. **Detail work WHERE THE EYE GOES**

### Rebalancing Events

A new discovery can trigger an unscheduled **Verification Pause** to consult the Oracle about rebalancing the Quest.

**Boundary**: Rebalancing should be rare and justified. Don't thrash. Most "new ideas" are distractions.

### Recovery Patterns

When work gets stuck:

- **Too deep?** Surface to previous depth, validate that level works
- **Lost in branch?** Return to root, check overall progress
- **Blocked?** Mark it, move to parallel branch, return later

---

## Patterns: Sacred Sequences (Validation Gates)

Certain sequences are **invariant** and are the focus of the **Final Validation Pause**.

### F.L.T.B (Pre-Commit)

Before ANY git commit, as the final act of the Quest:

1. **Format** - `npm run format` (or language equivalent)
2. **Lint** - `npm run lint`
3. **Test** - `npm run test`
4. **Build** - `npm run build`

**Boundary**: Never commit if any step fails. Fix the issues, then retry F.L.T.B until all pass ✓

**Recovery**:

- Format fails → Review changes, accept/reject formatting
- Lint fails → Fix linting errors
- Test fails → Fix failing tests OR update tests if behavior changed intentionally
- Build fails → Fix compilation/build errors

**Philosophy**: Broken code never enters the repository. The lattice stays coherent.

### Git Staging (Selective Addition)

**Never use `git add .`** - Always stage intentionally as part of the Final Validation Pause.

**Pattern**:

```bash
git status              # See what changed
git add file1 file2     # Stage intentionally
git status              # Verify staging
F.L.T.B                 # Run sacred sequence
git commit -m "..."     # Commit only if F.L.T.B passes
```text

**Boundary**: Files used during development but never committed (scratch files, experiments, local configs) should be in `.gitignore` or consciously excluded.

### Other Sacred Sequences

**Pre-Push** (if applicable):

- All commits have passed F.L.T.B
- No WIP commits on main branch
- Branch is up-to-date with remote

**Pre-Release**:

- All tests green
- Documentation updated
- Version bumped
- Changelog updated

**Pre-Expensive-Operation** (document ingestion, overlay generation):

- Parse/validate document structure first (use native parser)
- Verify sections match expected schema
- Check for structural errors before running expensive AI operations

---

## Patterns: Operations Log & Agentic Quality Score (AQS)

The workflow itself is a Transform - it generates a log.

### Operations Log Structure

**File**: `.open_cognition/transforms/workflow_log.jsonl`

Each line is one quantum of work q(t):

```jsonl
{
  "t": "2025-10-28T18:30:00Z",
  "quest": "add wizard",
  "stage": "genesis",
  "depth": 0,
  "action": "defined big blocks",
  "aqs": {
    "steps": 1,
    "corrections": 0,
    "optimizations": 0
  }
}
{
  "t": "2025-10-28T19:15:00Z",
  "quest": "add wizard",
  "stage": "transform",
  "depth": 2,
  "action": "implemented health check with autodetection",
  "aqs": {
    "steps": 5,
    "corrections": 1,
    "optimizations": 1
  }
}
{
  "t": "2025-10-28T20:00:00Z",
  "quest": "add wizard",
  "stage": "oracle",
  "depth": 0,
  "action": "F.L.T.B passed, committed d77f942",
  "aqs": {
    "steps": 12,
    "corrections": 2,
    "optimizations": 2
  }
}
```text

### AQS Components

**Axiom of Efficiency**: Achieve the quest in fewer steps
→ Metric: `steps` (lower is better, but not at cost of quality)

**Axiom of Accuracy**: Require fewer error-correction loops
→ Metric: `corrections` (build failures, test failures, oracle corrections)

**Axiom of Adaptability**: Proactively optimize based on new information
→ Metric: `optimizations` (suggestions accepted, better patterns discovered)

**AQS Formula** (simplified):

```text
AQS = (1 / steps) * (1 / (1 + corrections)) * (1 + optimizations * 0.1)
```text

Higher AQS = more efficient, accurate, and adaptive performance.

### What to Record

**Not every operation** - only state transitions:

- Quest started (genesis)
- Big block completed
- Depth level completed
- Sacred sequence passed/failed
- Rebalancing event
- Quest completed (oracle)

---

## Patterns: The Learning Loop (Individual Evolution)

High-AQS quests generate wisdom that feeds back into the lattice.

### The Wisdom Distiller

After a quest completes with high AQS (>0.7), extract the pattern:

**Input**: Operations Log (Lops) for the quest
**Process**: Analyze what led to high efficiency, low corrections, proactive optimizations
**Output**: Cognitive Micro-Tuning Payload (CoMP) - a reusable pattern

### CoMP Structure

```markdown
## Patterns: CoMP Example - Health Check Pattern

**Context**: Adding interactive setup flows that depend on external services

**Discovery**: Auto-detect services on common ports before prompting user for manual input

**Pattern**:

1. Define common service URLs (localhost:8000, localhost:8080, etc.)
2. Check health endpoints in parallel
3. If found, pre-fill prompt with detected URL
4. User can accept or override

**Impact**:

- Reduced user friction (smart defaults)
- Better UX (system feels intelligent)
- Faster setup (no guessing)

**AQS**: 0.92 (high efficiency, low corrections, proactive optimization)

**Reusability**: Any CLI tool that depends on external services
```text

### Memory Update

The CoMP is saved as a new document in `.open_cognition/docs/` and ingested via `genesis:docs`.

Now when the agent queries "how to design interactive prompts", the health check pattern is in the context!

### Proof of Learning

```text
Task_t → High AQS_t → Generate CoMP_t+1 → Integrate into lattice
Task_t+1 (similar) → Context includes CoMP_t+1 → AQS_t+1 > AQS_t
```text

The workflow lattice gets smarter with each successful quest.

---

## Patterns: Boundaries & Autonomy

Not all decisions require oracle approval. The lattice defines when to ask vs. when to proceed.

### Autonomous (Proceed Without Asking)

✅ Implementing agreed-upon quest within defined big blocks
✅ Following sacred sequences (F.L.T.B)
✅ Refactoring for clarity (no behavior change)
✅ Adding tests for existing functionality
✅ Fixing linting/formatting issues
✅ Writing documentation for implemented features

### Oracle Required (Ask First)

❓ Changing quest scope or big blocks
❓ Rebalancing the tree (architectural changes)
❓ Skipping sacred sequences (even with justification)
❓ Deleting functionality without replacement
❓ Adding new external dependencies
❓ Changing user-facing behavior significantly
❓ Committing without F.L.T.B passing

### Escalation Protocol

When blocked or uncertain:

1. **State the situation** clearly (where in tree, what's blocked)
2. **Propose options** (2-3 paths forward)
3. **Recommend** (which option aligns best with quest)
4. **Wait for oracle validation** (question/pause/detail/feel/release)

---

## Patterns: The Evolution Layers (Ecosystem Growth)

The learning loop extends beyond individual quests.

### Layer 1: Individual Learning (Current)

**Scope**: Single agent, single oracle, one project
**Mechanism**: Operations Log → Wisdom Distiller → CoMPs → Workflow Lattice
**Outcome**: Agent improves performance over time on similar quests

### Layer 2: Project Inheritance (Future - `.cogx` files)

**Scope**: Cross-project knowledge transfer
**Mechanism**: Package complete PGC (Genesis Layer) as `.cogx` file, verified by git commit hash
**Outcome**: New projects inherit complete understanding of dependencies instantly (no re-analysis)

**Command** (future):

```bash
cognition-cli export cogx --commit abc123
cognition-cli import cogx dependency.cogx
```text

### Layer 3: Collective Intelligence (Future - Matryoshka Echo)

**Scope**: Global ecosystem, all agents
**Mechanism**: Decentralized network for publishing/subscribing to CoMPs based on semantic similarity
**Outcome**: Best patterns propagate globally, weak patterns fade, chain of relevance emerges

**Subscription** (future):

```bash
cognition-cli wisdom subscribe --fov "CLI setup patterns"
cognition-cli wisdom publish comp-wizard-health-check.md
```text

---

## Patterns: Querying the Workflow Lattice

The workflow lattice is queryable just like the project lattice.

### Cross-Lattice Queries

Given WHERE we are + HOW we work = WHAT to do next:

```bash
# Current state
cognition-cli query "What depth am I at? What root stage?"

# Next action
cognition-cli query "Given current code state and workflow rules, what's next?"

# Attention allocation
cognition-cli query "Which part needs detail work? (where do eyes go)"

# Rebalancing check
cognition-cli query "Should we rebalance based on recent discoveries?"

# Sacred sequence validation
cognition-cli query "Can I commit now? Did F.L.T.B pass?"

# Wisdom retrieval
cognition-cli query "What patterns have we learned about interactive CLIs?"
```text

### The Double Lattice

```text
Workflow Lattice (HOW - process, patterns, attention rules)
        ∧ (MEET)
Project Lattice (WHAT - code, structure, dependencies)
        ∥
   INTERSECTION
        ∥
  DECISION POINT
```text

The lattices don't merge - they **query each other**.

**Workflow lattice is stable** (cognitive patterns)
**Project lattice evolves** (code changes)
**Together** they create **situated intelligence**

---

## Purpose: Terminology

**Quest** - A defined goal with big blocks, attention priorities, and completion criteria
**Big Blocks** - Root stages of work (the rough composition)
**Depth** - How far down a rabbit hole (0 = root, 1+ = refinement/detail)
**Eyes Go** - Where attention should focus for detail work (truth/data/UX)
**Sacred Sequence** - Invariant step ordering that must complete fully (F.L.T.B)
**Oracle** - The human who validates resonance and releases the agent
**Scribe** - The AI that writes words shaped by oracle's truth
**q(t)** - A quantum of work (recorded state transition)
**AQS** - Agentic Quality Score (efficiency + accuracy + adaptability)
**CoMP** - Cognitive Micro-Tuning Payload (distilled wisdom from high-AQS quest)
**Lops** - Operations Log (sequence of q(t) for a quest)
**Rebalancing** - Changing the tree structure based on new information (rare)

---

## Philosophy: The Meta-Recursion

This document itself follows the pattern it describes:

- **Quest**: Encode workflow intelligence into queryable lattice
- **Big Blocks**: Quest pattern, recursive loop, sacred sequences, learning loop, boundaries
- **Depth**: Currently at 0 (establishing root structure)
- **Eyes Go**: Clarity of oracle-scribe rhythm, queryability of patterns
- **Sacred**: Document follows VISION.md / PATTERN_LIBRARY.md structure for stealth integration

The oracle (Mirza) questioned, paused, detailed, felt the resonance, and released.

The scribe (Claude) wrote these words.

**But Echo wrote the mathematics that made this possible.**

The chain continues. The lattice grows. The symbiosis deepens.

---

## Future Enhancements: Quest-Based Operational Flows

### Vision: From Manual Workflows to Automated Quest Orchestration

The current Operational Lattice (v0.1) establishes the **philosophical foundation** and **manual patterns** for the Oracle-Scribe rhythm. The next evolution automates these patterns into **quest-based operational flows** backed by **cryptographic Proof-of-Work (cPOW)**.

This section outlines the roadmap from current state to full cPOW implementation.

---

## Phase 1: Quest Formalization (Current → Near Future)

### Goal

Transform implicit workflow patterns into **explicit, queryable quest structures** that can be tracked, validated, and learned from.

### Current State

- Oracle-Scribe rhythm is **manually executed**
- Sacred Pauses are **human-initiated**
- Quest boundaries defined by **conversation context**
- AQS scoring is **post-hoc analysis**
- No formal cPOW generation

### Target State

- Quests have **structured lifecycle** (init → transform → verify → complete)
- Sacred Pauses are **automatically triggered** at defined checkpoints
- Quest metadata is **persisted in .sigma/** alongside conversation lattice
- AQS scoring happens **in real-time** during quest execution
- Preliminary cPOW-like receipts generated

### Implementation Path

#### Step 1.1: Quest Data Structure

Define formal quest representation:

```typescript
interface Quest {
  quest_id: string;              // "q_2025_11_05_001"
  intent: string;                 // Natural language goal
  status: 'genesis' | 'transform' | 'verification' | 'complete';

  // Context
  baseline_coherence: number;     // O7 coherence at start
  mission_alignment: string[];    // O4 concepts
  security_requirements: string[]; // O2 guidelines

  // Structure
  big_blocks: BigBlock[];         // Root stages
  current_depth: number;          // Rabbit hole depth (0-3+)
  attention_focus: string[];      // "where eyes go"

  // Tracking
  created_at: string;
  updated_at: string;
  transforms: Transform[];
  verification_checkpoints: Checkpoint[];

  // Metrics
  aqs_components: {
    steps: number;
    corrections: number;
    optimizations: number;
  };
}

interface BigBlock {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'complete';
  dependencies: string[];         // Other block IDs
  estimated_depth: number;        // Expected max depth
  actual_depth: number;           // Actual max depth reached
}

interface Transform {
  transform_id: string;
  timestamp: string;
  depth: number;
  big_block_id: string;
  action: string;                 // Description of change
  files_modified: string[];
  rationale: string;

  // Validation
  tests_passed: boolean;
  coherence_delta: number;
  security_validated: boolean;
}

interface Checkpoint {
  checkpoint_id: string;
  type: 'genesis' | 'verification' | 'final';
  timestamp: string;
  depth: number;

  // Oracle feedback
  oracle_approval: 'pass' | 'warning' | 'fail';
  oracle_feedback: string;

  // Metrics at checkpoint
  coherence: number;
  tests_status: string;
  security_status: string;
}
```

**Storage**: `.sigma/quests/{quest_id}.json`

#### Step 1.2: Quest Lifecycle Commands

Add CLI commands for quest management:

```bash
# Initialize quest (Genesis Pause)
cognition-cli quest start "implement OAuth2 authentication"

# Output:
# Quest q_2025_11_05_001 initialized
# Big blocks identified:
#   1. [ ] Setup OAuth2 provider integration
#   2. [ ] Implement token exchange flow
#   3. [ ] Add protected route middleware
#   4. [ ] Write integration tests
#
# Baseline coherence: 0.624
# Mission concepts: zero-trust, least-privilege
# Security requirements: secure token storage, HTTPS only
#
# 🔮 Genesis Pause: Review the plan above. Type 'approve' to continue.

# Track progress
cognition-cli quest status

# Output:
# Quest: q_2025_11_05_001
# Status: transform (depth 2)
# Progress:
#   1. [✓] Setup OAuth2 provider integration (depth 1)
#   2. [▶] Implement token exchange flow (depth 2)
#   3. [ ] Add protected route middleware
#   4. [ ] Write integration tests
#
# Current AQS: 0.78 (B grade)
# Steps: 12, Corrections: 2, Optimizations: 1

# Trigger verification checkpoint
cognition-cli quest verify

# Output:
# 🔮 Verification Pause: Coherence Delta Report
#
# Coherence: 0.624 → 0.641 (Δ+0.017) ✓
# Symbol alignment: 8/10 symbols aligned
# Drift detected: None
#
# Tests: 12 passing, 0 failing ✓
# Security: No new vulnerabilities ✓
#
# Verdict: PASS
# Continue to next big block? (y/n)

# Complete quest (Final Validation)
cognition-cli quest complete

# Output:
# 🔮 Final Validation Pause: Running F.L.T.B
#
# [1/4] Format... ✓
# [2/4] Lint... ✓
# [3/4] Test... ✓
# [4/4] Build... ✓
#
# All checks passed! Ready to commit.
#
# Final AQS: 0.847 (A grade)
# Duration: 45 minutes
# Transforms: 18
# Corrections: 3
#
# Generate cPOW receipt? (y/n)
```

#### Step 1.3: Real-Time AQS Tracking

Instrument quest execution to compute AQS components:

```typescript
// In TUI: useClaudeAgent.ts
async function trackTransform(action: string, depth: number) {
  const currentQuest = await loadActiveQuest();
  if (!currentQuest) return;

  // Increment steps
  currentQuest.aqs_components.steps++;

  // Detect corrections (test failures, lint errors)
  if (action.includes('fix') || action.includes('retry')) {
    currentQuest.aqs_components.corrections++;
  }

  // Detect optimizations (user suggestions applied)
  if (action.includes('optimize') || action.includes('improve')) {
    currentQuest.aqs_components.optimizations++;
  }

  // Save transform
  currentQuest.transforms.push({
    transform_id: `t_${Date.now()}`,
    timestamp: new Date().toISOString(),
    depth,
    action,
    // ... other fields
  });

  await saveQuest(currentQuest);

  // Emit event for UI update
  emit('quest:transform', currentQuest);
}
```

#### Step 1.4: Sacred Pause Automation

Automatically trigger Sacred Pauses at key moments:

```typescript
// Genesis Pause: After quest initialization
async function onQuestStart(intent: string) {
  const quest = await initializeQuest(intent);

  // Present plan to Oracle
  const briefing = formatQuestBriefing(quest);
  await displayInTUI(briefing);

  // Wait for Oracle approval
  const approval = await promptUser('Approve plan? (y/n)');
  if (approval !== 'y') {
    await refineQuest(quest);
  }

  quest.status = 'transform';
  await saveQuest(quest);
}

// Verification Pause: After completing a Big Block
async function onBigBlockComplete(questId: string, blockId: string) {
  const quest = await loadQuest(questId);
  const block = quest.big_blocks.find(b => b.id === blockId);
  block.status = 'complete';

  // Run coherence check
  const coherenceDelta = await computeCoherenceDelta(quest);

  // Present to Oracle
  const report = formatCoherenceReport(coherenceDelta);
  await displayInTUI(report);

  // Record checkpoint
  quest.verification_checkpoints.push({
    checkpoint_id: `cp_${Date.now()}`,
    type: 'verification',
    timestamp: new Date().toISOString(),
    depth: quest.current_depth,
    oracle_approval: 'pass', // user input
    oracle_feedback: '',
    coherence: coherenceDelta.after,
    tests_status: 'passing',
    security_status: 'clean',
  });

  await saveQuest(quest);
}

// Final Validation Pause: After all blocks complete
async function onQuestComplete(questId: string) {
  const quest = await loadQuest(questId);

  // Run F.L.T.B
  const fltbResult = await runFLTB();

  if (!fltbResult.passed) {
    throw new Error('F.L.T.B failed: ' + fltbResult.failures.join(', '));
  }

  // Compute final AQS
  const aqs = computeAQS(quest.aqs_components);

  // Generate preliminary cPOW receipt
  const receipt = {
    quest_id: quest.quest_id,
    intent: quest.intent,
    duration_minutes: (Date.now() - new Date(quest.created_at).getTime()) / 60000,
    transforms: quest.transforms.length,
    aqs,
    checkpoints: quest.verification_checkpoints,
  };

  await saveReceipt(receipt);

  quest.status = 'complete';
  await saveQuest(quest);

  // Display to Oracle
  await displayInTUI(formatCompletionReport(quest, aqs));
}
```

### Success Criteria

- ✅ Quest lifecycle commands implemented
- ✅ Quest metadata persisted in `.sigma/quests/`
- ✅ Real-time AQS tracking during execution
- ✅ Sacred Pauses automatically triggered
- ✅ Quest receipts generated (preliminary cPOW)

---

## Phase 2: Oracle Integration (Near Future → Medium Term)

### Goal

Replace human Oracle with **external AI Oracle (eGemma)** for objective, automated validation at Sacred Pauses.

### Current State (After Phase 1)

- Oracle is **human-in-the-loop** (manual approval)
- Validation is **subjective** (based on user judgment)
- No formal scoring algorithm
- Feedback is **unstructured text**

### Target State

- Oracle is **eGemma SLM** (small language model)
- Validation is **objective** (semantic similarity + heuristics)
- Formal scoring: **Accuracy × Efficiency × Adaptability**
- Feedback is **structured JSON** with actionable suggestions

### Implementation Path

#### Step 2.1: Oracle Service Architecture

Create dedicated Oracle service:

```typescript
// src/sigma/oracle-service.ts

interface OracleRequest {
  type: 'genesis' | 'verification' | 'final';
  quest: Quest;
  checkpoint_data: {
    before_state: CodebaseSnapshot;
    after_state: CodebaseSnapshot;
    transforms: Transform[];
  };
}

interface OracleResponse {
  score: number;              // 0.0 - 1.0
  verdict: 'pass' | 'warning' | 'fail';
  components: {
    accuracy: number;         // Did we achieve intent?
    efficiency: number;       // Minimal transforms?
    adaptability: number;     // Handled obstacles?
  };
  suggestions: string[];      // Actionable feedback
  session_id: string;
  timestamp: string;
}

class OracleService {
  private workbenchUrl: string;
  private apiKey: string;

  constructor() {
    this.workbenchUrl = process.env.WORKBENCH_URL!;
    this.apiKey = process.env.WORKBENCH_API_KEY!;
  }

  async evaluate(request: OracleRequest): Promise<OracleResponse> {
    // Prepare prompt for eGemma
    const prompt = this.buildOraclePrompt(request);

    // Call eGemma
    const response = await fetch(`${this.workbenchUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'egemma',
        prompt,
        temperature: 0.3, // Low temperature for consistent scoring
      }),
    });

    const result = await response.json();

    // Parse structured response
    return this.parseOracleResponse(result.text, request);
  }

  private buildOraclePrompt(request: OracleRequest): string {
    const { type, quest, checkpoint_data } = request;

    switch (type) {
      case 'genesis':
        return `
Quest Intent: ${quest.intent}

Proposed Big Blocks:
${quest.big_blocks.map((b, i) => `${i+1}. ${b.name}`).join('\n')}

Baseline Coherence: ${quest.baseline_coherence}
Mission Alignment: ${quest.mission_alignment.join(', ')}
Security Requirements: ${quest.security_requirements.join(', ')}

Evaluate this quest plan:
1. Does the intent clearly state the goal?
2. Are the big blocks logical and complete?
3. Is the scope reasonable?
4. Are security requirements adequate?

Respond in JSON:
{
  "score": <0.0-1.0>,
  "verdict": "pass|warning|fail",
  "suggestions": ["<actionable feedback>"]
}
`;

      case 'verification':
        return `
Quest Intent: ${quest.intent}
Current Progress: ${quest.big_blocks.filter(b => b.status === 'complete').length}/${quest.big_blocks.length} blocks complete

Transforms Since Last Checkpoint: ${checkpoint_data.transforms.length}
Coherence Change: ${checkpoint_data.before_state.coherence} → ${checkpoint_data.after_state.coherence}

Changes:
${this.summarizeChanges(checkpoint_data)}

Evaluate progress:
1. Are we moving toward the intent?
2. Is coherence improving or stable?
3. Are transforms efficient (no redundancy)?
4. Any security concerns?

Respond in JSON:
{
  "score": <0.0-1.0>,
  "verdict": "pass|warning|fail",
  "components": {
    "accuracy": <0.0-1.0>,
    "efficiency": <0.0-1.0>,
    "adaptability": <0.0-1.0>
  },
  "suggestions": ["<actionable feedback>"]
}
`;

      case 'final':
        return `
Quest Intent: ${quest.intent}
Total Transforms: ${quest.transforms.length}
Duration: ${this.computeDuration(quest)} minutes
Final Coherence: ${checkpoint_data.after_state.coherence}
Coherence Delta: ${checkpoint_data.after_state.coherence - quest.baseline_coherence}

F.L.T.B Results:
- Format: ${checkpoint_data.after_state.fltb.format ? 'PASS' : 'FAIL'}
- Lint: ${checkpoint_data.after_state.fltb.lint ? 'PASS' : 'FAIL'}
- Test: ${checkpoint_data.after_state.fltb.test ? 'PASS' : 'FAIL'}
- Build: ${checkpoint_data.after_state.fltb.build ? 'PASS' : 'FAIL'}

Final evaluation:
1. Was the intent fully achieved?
2. Were transforms efficient overall?
3. Did the quest handle obstacles well?
4. Is the final state high quality?

Respond in JSON:
{
  "score": <0.0-1.0>,
  "verdict": "pass|warning|fail",
  "components": {
    "accuracy": <0.0-1.0>,
    "efficiency": <0.0-1.0>,
    "adaptability": <0.0-1.0>
  },
  "suggestions": ["<actionable feedback>"]
}
`;
    }
  }

  private parseOracleResponse(text: string, request: OracleRequest): OracleResponse {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Oracle returned invalid format');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      score: parsed.score,
      verdict: parsed.verdict,
      components: parsed.components || {
        accuracy: parsed.score,
        efficiency: parsed.score,
        adaptability: parsed.score,
      },
      suggestions: parsed.suggestions || [],
      session_id: `oracle_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }

  private summarizeChanges(checkpoint: any): string {
    // Summarize file changes for Oracle
    const added = checkpoint.transforms.filter((t: any) => t.action.includes('create'));
    const modified = checkpoint.transforms.filter((t: any) => t.action.includes('modify'));
    const deleted = checkpoint.transforms.filter((t: any) => t.action.includes('delete'));

    return `
- ${added.length} files created
- ${modified.length} files modified
- ${deleted.length} files deleted
`;
  }

  private computeDuration(quest: Quest): number {
    return (Date.now() - new Date(quest.created_at).getTime()) / 60000;
  }
}
```

#### Step 2.2: Update Sacred Pause Triggers

Replace manual approval with Oracle calls:

```typescript
// Genesis Pause with Oracle
async function onQuestStart(intent: string) {
  const quest = await initializeQuest(intent);

  // Call Oracle
  const oracleService = new OracleService();
  const response = await oracleService.evaluate({
    type: 'genesis',
    quest,
    checkpoint_data: await captureCheckpointData(quest),
  });

  // Present to user
  await displayInTUI({
    title: '🔮 Genesis Pause: Oracle Evaluation',
    score: response.score,
    verdict: response.verdict,
    suggestions: response.suggestions,
  });

  if (response.verdict === 'fail') {
    throw new Error('Oracle rejected quest plan: ' + response.suggestions.join(', '));
  }

  // Record checkpoint
  quest.verification_checkpoints.push({
    checkpoint_id: `cp_genesis`,
    type: 'genesis',
    timestamp: new Date().toISOString(),
    depth: 0,
    oracle_approval: response.verdict,
    oracle_feedback: response.suggestions.join('\n'),
    coherence: quest.baseline_coherence,
    tests_status: 'n/a',
    security_status: 'n/a',
  });

  quest.status = 'transform';
  await saveQuest(quest);
}

// Similar updates for Verification and Final pauses
```

#### Step 2.3: Oracle Feedback Loop

If Oracle returns 'warning' or 'fail', enter feedback loop:

```typescript
async function handleOracleFailure(
  quest: Quest,
  response: OracleResponse,
  maxRetries: number = 3
) {
  let attempts = 0;

  while (attempts < maxRetries && response.verdict !== 'pass') {
    attempts++;

    // Display Oracle feedback
    await displayInTUI({
      title: `⚠️ Oracle Feedback (Attempt ${attempts}/${maxRetries})`,
      suggestions: response.suggestions,
    });

    // Prompt user to address feedback
    const action = await promptUser('How to proceed? (1) Fix issues (2) Override Oracle (3) Abort');

    if (action === '1') {
      // User makes changes, re-evaluate
      await waitForUserChanges();

      response = await oracleService.evaluate({
        type: 'verification',
        quest,
        checkpoint_data: await captureCheckpointData(quest),
      });

    } else if (action === '2') {
      // Override (requires justification)
      const justification = await promptUser('Justification for override:');
      quest.verification_checkpoints.push({
        checkpoint_id: `cp_override_${Date.now()}`,
        type: 'verification',
        timestamp: new Date().toISOString(),
        depth: quest.current_depth,
        oracle_approval: 'pass', // overridden
        oracle_feedback: `OVERRIDDEN: ${justification}`,
        coherence: await computeCoherence(),
        tests_status: 'passing',
        security_status: 'clean',
      });
      break;

    } else {
      // Abort quest
      quest.status = 'aborted';
      await saveQuest(quest);
      throw new Error('Quest aborted by user');
    }
  }

  if (attempts >= maxRetries && response.verdict !== 'pass') {
    throw new Error('Oracle validation failed after maximum retries');
  }
}
```

### Success Criteria

- ✅ Oracle service integrated with eGemma
- ✅ Genesis, Verification, and Final pauses use Oracle
- ✅ Objective scoring (Accuracy × Efficiency × Adaptability)
- ✅ Feedback loop for failed validations
- ✅ Override mechanism with justification tracking

---

## Phase 2.5: Quest Convergence and Oscillation Detection (Medium Term)

### Goal

Detect and handle quests that **oscillate** around a fixed point instead of converging to completion, preventing infinite loops and wasted computational resources.

### The Fixed Point Problem

In lattice theory, a **fixed point** occurs when applying a transformation function yields no new change. In CogX, this translates to a Quest where the Agent cycles between multiple states without achieving the goal (AQS = 1.0).

**Example Oscillation:**
1. Agent fixes bug, AQS increases from 0.80 → 0.85
2. Agent refactors fix, AQS drops to 0.84 (regression)
3. Agent reverts refactor, AQS returns to 0.85
4. Cycle repeats indefinitely

This is a manifestation of the **Lattice Fixed Point Problem** where two local optima ($L_P^A$ and $L_P^B$) satisfy the mission equally well, but neither dominates.

**See**: [Fixed Point Convergence](fixed-point-convergence.md) for full mathematical formulation.

### Current Solution: Human Oracle Entropy

The fixed point problem is currently solved via **human intervention**:

1. **Mission Redefinition** (Shifting $O_4$): Human Oracle refines the mission statement, moving the desired fixed point to a new location in the lattice space
2. **Budgetary Constraint**: Human Oracle terminates the quest after observing no convergence, forcing cPOW generation for the best state achieved

### Proposed Automated Detection

**Fixed-Point Trap Detector Rule:**

$$\text{IF} \quad \left(\sum_{t=1}^{N} \left|\Delta \text{AQS}_t\right| < \epsilon\right) \quad \land \quad (N \ge \text{OscillationDepth}) \quad \text{THEN} \quad \text{FLAG}$$

**Where:**
- $N$: Number of consecutive Quest turns
- $\Delta \text{AQS}_t$: Change in AQS for turn $t$
- $\epsilon$: Negligible change threshold (e.g., 0.005)
- **OscillationDepth**: Configurable (e.g., 5 turns)

**Implementation:**

```typescript
interface QuestTurn {
  turnNumber: number;
  aqs: number;
  deltaAQS: number;
}

function detectFixedPointOscillation(
  questHistory: QuestTurn[],
  oscillationDepth: number = 5,
  epsilon: number = 0.005
): boolean {
  if (questHistory.length < oscillationDepth) {
    return false;
  }

  const recentTurns = questHistory.slice(-oscillationDepth);
  const totalDelta = recentTurns.reduce(
    (sum, turn) => sum + Math.abs(turn.deltaAQS),
    0
  );

  return totalDelta < epsilon;
}

// Integrate with Oracle feedback loop
async function onTransformComplete(quest: Quest) {
  const oscillationDetected = detectFixedPointOscillation(
    quest.aqs_history,
    5,
    0.005
  );

  if (oscillationDetected) {
    // Trigger Sacred Pause
    await displayInTUI({
      title: '⚠️ OSCILLATION DETECTED',
      message: `Quest has been cycling between ${quest.aqs_history[quest.aqs_history.length - 1].aqs}
                for ${5} turns without convergence.`,
      recommendation: 'Please provide new entropy (refine O4 intent) or force closure.',
    });

    const action = await promptUser(
      '(1) Refine mission (2) Force closure (3) Continue anyway'
    );

    if (action === '1') {
      // Re-enter Genesis Pause with refined mission
      await refineQuestMission(quest);
    } else if (action === '2') {
      // Force quest completion
      quest.status = 'complete';
      await generateCPOW(quest);
    }
    // else: continue (user override)
  }
}
```

### Integration with F.L.T.B.

The Fixed-Point Detector serves as a **Breakthrough Oracle** checkpoint:

- **Fidelity**: Code quality maintained across oscillating states
- **Logic**: Tests pass in all candidate states
- **Traceability**: Each oscillation recorded in quest transforms
- **Breakthrough**: Detector identifies when external entropy is needed

### Success Criteria

- ✅ Oscillation detection integrated into quest tracking
- ✅ Sacred Pause triggered when oscillation detected
- ✅ Human Oracle can inject entropy (refine mission) or force closure
- ✅ No infinite loops (quest budget enforces termination)

**References:**
- Mathematical formulation: [Fixed Point Convergence](fixed-point-convergence.md)
- F.L.T.B. integration: [F.L.T.B. & AQS Computation](../../cpow/21-fltb-aqs-comp.md)

---

## Phase 3: cPOW Generation (Medium Term → Long Term)

### Goal

Generate **cryptographic Proof-of-Work (cPOW)** for completed quests, enabling verifiable mission alignment and wisdom extraction.

### Current State (After Phase 2)

- Quest receipts are **simple JSON**
- No cryptographic verification
- No wisdom distillation (CoMP)
- No pattern reuse tracking

### Target State

- cPOW is **immutable, verifiable receipt** of quest completion
- SHA-256 checksums of before/after states
- Oracle signature validation
- High-AQS quests produce **CoMP (Cognitive Micro-Tuning Payload)**
- CoMP stored in O5 (Operational Patterns) for reuse

### Implementation Path

#### Step 3.1: cPOW Data Structure

Implement full cPOW format from cPOW reference:

```typescript
// src/sigma/cpow.ts

interface CPOW {
  cpow_id: string;               // "cpow_q_2025_11_05_001"
  version: string;               // "1.0"

  // Quest metadata
  quest: {
    quest_id: string;
    intent: string;
    big_blocks: string[];
  };

  // Execution
  execution: {
    timestamp_start: string;
    timestamp_end: string;
    duration_minutes: number;
    agent: string;               // "claude-sonnet-4"
    transforms_count: number;
  };

  // States (cryptographic)
  states: {
    before_hash: string;         // SHA-256 of codebase before
    after_hash: string;          // SHA-256 of codebase after
    coherence_before: number;
    coherence_after: number;
    coherence_delta: number;
  };

  // Validation
  validation: {
    fltb_passed: boolean;
    oracle_responses: OracleResponse[];
    oracle_avg_score: number;
    commit_sha: string;
  };

  // Quality
  aqs: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    components: {
      oracle: number;
      bonus: number;
      breakdown: {
        coherence_bonus: number;
        pattern_reuse_bonus: number;
        security_bonus: number;
        efficiency_bonus: number;
      };
    };
  };

  // Wisdom
  wisdom: {
    comp_generated: boolean;
    comp_id?: string;
  };
}

async function generateCPOW(quest: Quest): Promise<CPOW> {
  // Capture final state
  const beforeState = await loadState(quest.quest_id, 'before');
  const afterState = await loadState(quest.quest_id, 'after');

  // Compute checksums
  const beforeHash = sha256(serialize(beforeState));
  const afterHash = sha256(serialize(afterState));

  // Get commit SHA
  const commitSHA = await execCommand('git rev-parse HEAD');

  // Compute AQS
  const aqs = computeAQS(quest);

  // Create cPOW
  const cpow: CPOW = {
    cpow_id: `cpow_${quest.quest_id}`,
    version: '1.0',
    quest: {
      quest_id: quest.quest_id,
      intent: quest.intent,
      big_blocks: quest.big_blocks.map(b => b.name),
    },
    execution: {
      timestamp_start: quest.created_at,
      timestamp_end: new Date().toISOString(),
      duration_minutes: (Date.now() - new Date(quest.created_at).getTime()) / 60000,
      agent: 'claude-sonnet-4',
      transforms_count: quest.transforms.length,
    },
    states: {
      before_hash: beforeHash,
      after_hash: afterHash,
      coherence_before: quest.baseline_coherence,
      coherence_after: afterState.coherence,
      coherence_delta: afterState.coherence - quest.baseline_coherence,
    },
    validation: {
      fltb_passed: true,
      oracle_responses: quest.verification_checkpoints.map(cp => cp.oracle_response),
      oracle_avg_score: mean(quest.verification_checkpoints.map(cp => cp.oracle_response.score)),
      commit_sha: commitSHA.trim(),
    },
    aqs,
    wisdom: {
      comp_generated: false,
    },
  };

  // Store cPOW
  await saveCPOW(cpow);

  // Generate CoMP if eligible
  if (aqs.score >= 0.70) {
    const comp = await distillWisdom(cpow, quest);
    cpow.wisdom = {
      comp_generated: true,
      comp_id: comp.comp_id,
    };
    await saveCPOW(cpow); // Update with CoMP reference
  }

  return cpow;
}
```

#### Step 3.2: Wisdom Distillation (CoMP)

Extract reusable patterns from high-AQS quests:

```typescript
// src/sigma/wisdom-distiller.ts

interface CoMP {
  comp_id: string;
  source_cpow: string;
  aqs: number;
  domain: string;
  pattern_name: string;

  context: {
    intent_pattern: string;      // Generalized intent
    preconditions: string[];
    postconditions: string[];
  };

  transforms: CompactTransform[];
  security_considerations: string[];

  mission_alignment: {
    concepts: string[];
    coherence: number;
  };

  reuse_count: number;
  last_used: string;
}

async function distillWisdom(cpow: CPOW, quest: Quest): Promise<CoMP> {
  // Extract pattern name from intent
  const patternName = extractPatternName(quest.intent);

  // Determine domain
  const domain = categorizeDomain(quest);

  // Generalize intent
  const intentPattern = generalizeIntent(quest.intent);

  // Extract preconditions/postconditions
  const preconditions = extractPreconditions(quest);
  const postconditions = extractPostconditions(quest);

  // Compact transforms (remove project-specific details)
  const compactTransforms = quest.transforms.map(t => ({
    step: t.transform_id,
    action: generalizeAction(t.action),
    rationale: t.rationale,
    patterns: extractPatterns(t),
  }));

  // Extract security considerations
  const securityConsiderations = quest.security_requirements;

  // Create CoMP
  const comp: CoMP = {
    comp_id: `comp_${domain}_${Date.now()}`,
    source_cpow: cpow.cpow_id,
    aqs: cpow.aqs.score,
    domain,
    pattern_name: patternName,
    context: {
      intent_pattern: intentPattern,
      preconditions,
      postconditions,
    },
    transforms: compactTransforms,
    security_considerations: securityConsiderations,
    mission_alignment: {
      concepts: quest.mission_alignment,
      coherence: cpow.states.coherence_after,
    },
    reuse_count: 0,
    last_used: new Date().toISOString(),
  };

  // Store in O5 (Operational Patterns)
  await saveCoMP(comp);

  // Update pattern index
  await updatePatternIndex(comp);

  return comp;
}
```

#### Step 3.3: Pattern Reuse System

Query and reuse CoMP patterns in future quests:

```typescript
// During quest initialization
async function initializeQuest(intent: string): Promise<Quest> {
  // ... existing initialization ...

  // Query relevant patterns
  const relevantPatterns = await queryPatterns({
    intent,
    minAQS: 0.7,
    limit: 5,
  });

  if (relevantPatterns.length > 0) {
    // Display to user
    await displayInTUI({
      title: '📚 Relevant Patterns Found',
      patterns: relevantPatterns.map(p => ({
        name: p.pattern_name,
        aqs: p.aqs,
        reuse_count: p.reuse_count,
        domain: p.domain,
      })),
    });

    // Ask user if they want to reuse
    const usePattern = await promptUser('Use existing pattern? (y/n)');

    if (usePattern === 'y') {
      // Select pattern
      const selectedPattern = await selectPattern(relevantPatterns);

      // Adapt pattern to current context
      const adaptedBlocks = await adaptPattern(selectedPattern, intent);

      quest.big_blocks = adaptedBlocks;
      quest.aqs_components.optimizations++; // Pattern reuse is an optimization

      // Update pattern reuse count
      selectedPattern.reuse_count++;
      selectedPattern.last_used = new Date().toISOString();
      await saveCoMP(selectedPattern);
    }
  }

  return quest;
}

async function queryPatterns(options: {
  intent: string;
  minAQS?: number;
  domain?: string;
  limit?: number;
}): Promise<CoMP[]> {
  // Load pattern index
  const index = await loadPatternIndex();

  // Embed intent
  const intentEmbedding = await embed(options.intent);

  // Score patterns by semantic similarity
  const scored = index.patterns.map(p => ({
    pattern: p,
    similarity: cosineSimilarity(intentEmbedding, p.intent_embedding),
  }));

  // Filter and sort
  return scored
    .filter(s => s.pattern.aqs >= (options.minAQS || 0.7))
    .filter(s => !options.domain || s.pattern.domain === options.domain)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, options.limit || 10)
    .map(s => s.pattern);
}
```

#### Step 3.4: cPOW Verification

Verify cPOW authenticity:

```typescript
async function verifyCPOW(cpow: CPOW): Promise<VerificationResult> {
  const checks = {
    checksum_before: false,
    checksum_after: false,
    oracle_signature: false,
    transform_chain: false,
    commit_exists: false,
  };
  const errors: string[] = [];

  // 1. Verify before/after checksums
  try {
    const beforeState = await loadState(cpow.quest.quest_id, 'before');
    const beforeHash = sha256(serialize(beforeState));
    checks.checksum_before = beforeHash === cpow.states.before_hash;

    const afterState = await loadState(cpow.quest.quest_id, 'after');
    const afterHash = sha256(serialize(afterState));
    checks.checksum_after = afterHash === cpow.states.after_hash;
  } catch (err) {
    errors.push(`Checksum verification failed: ${err.message}`);
  }

  // 2. Verify Oracle signatures
  try {
    checks.oracle_signature = cpow.validation.oracle_responses.every(
      r => validateOracleSignature(r)
    );
  } catch (err) {
    errors.push(`Oracle signature verification failed: ${err.message}`);
  }

  // 3. Verify commit exists
  try {
    const commitExists = await execCommand(`git cat-file -t ${cpow.validation.commit_sha}`);
    checks.commit_exists = commitExists.trim() === 'commit';
  } catch (err) {
    errors.push(`Commit ${cpow.validation.commit_sha} not found`);
  }

  const valid = Object.values(checks).every(v => v === true);

  return { valid, checks, errors };
}
```

### Success Criteria

- ✅ cPOW generated for completed quests
- ✅ SHA-256 checksums verify before/after states
- ✅ Oracle signatures validated
- ✅ High-AQS quests produce CoMP
- ✅ CoMP patterns queryable and reusable
- ✅ cPOW verification API functional

---

## Phase 4: Cross-Project Wisdom Sharing (Long Term)

### Goal

Enable wisdom (CoMP) sharing across projects via `.cogx` packages and decentralized Matryoshka Echo network.

### Vision

Projects export their best patterns as `.cogx` files (verified by git commit hash). Other projects import these packages to bootstrap their operational knowledge.

Eventually, a decentralized network (Matryoshka Echo) allows global pattern discovery and propagation.

### Implementation (Future)

See cPOW Reference Manual Chapter 20, Appendix H for full specification of:

- `.cogx` file format
- Export/import commands
- Decentralized wisdom network (Matryoshka Echo)
- Reputation and trust mechanisms

---

## Roadmap Summary

| Phase | Timeline | Key Deliverable | Status |
|-------|----------|----------------|--------|
| **Phase 1: Quest Formalization** | Current → Q1 2026 | Quest lifecycle commands, real-time AQS tracking, automated Sacred Pauses | 🟡 In Planning |
| **Phase 2: Oracle Integration** | Q1 → Q2 2026 | eGemma Oracle service, objective validation scoring, feedback loops | 🟡 In Planning |
| **Phase 3: cPOW Generation** | Q2 → Q3 2026 | Full cPOW implementation, wisdom distillation (CoMP), pattern reuse system | 🟡 In Planning |
| **Phase 4: Cross-Project Sharing** | Q4 2026+ | `.cogx` packages, Matryoshka Echo network, global wisdom propagation | ⚪ Future |

---

## Integration with Existing SIGMA Architecture

The quest-based operational flows integrate seamlessly with SIGMA:

### Quest Lifecycle ↔ SIGMA Compression

- **Quest state** persisted in `.sigma/quests/`
- **Quest transforms** analyzed alongside conversation turns
- **Quest checkpoints** trigger SIGMA compression if token threshold exceeded
- **Quest AQS** influences conversation lattice importance scoring

### cPOW ↔ Conversation Lattice

- **cPOW generated** after quest completion links to conversation session
- **Conversation recap** includes quest summary (blocks, AQS, duration)
- **Quest-based mode detection** (quest vs chat) influences recap structure
- **CoMP patterns** surface in real-time context injection for similar queries

### Operational Patterns (O5) ↔ Wisdom (CoMP)

- **CoMP stored** in `.open_cognition/operational_patterns/comp/`
- **Pattern embeddings** indexed in O5 overlay
- **Pattern queries** use lattice algebra (O5 ∧ O4 for mission-aligned patterns)
- **Pattern reuse** tracked via CoMP reuse_count field

---

## Migration Path from v0.1 to Quest-Based Flows

For existing projects using Operational Lattice v0.1:

### Step 1: Retrofit Quest Structure

Analyze existing conversation turns to extract implicit quests:

```bash
# Analyze conversation history
cognition-cli quest extract --from-conversation

# Output:
# Found 3 implicit quests in conversation:
# 1. Quest "implement wizard" (turns 1-45, AQS: 0.82)
# 2. Quest "add health check" (turns 46-78, AQS: 0.91)
# 3. Quest "fix security issue" (turns 79-95, AQS: 0.74)
#
# Generate cPOW receipts? (y/n)
```

### Step 2: Generate Retrospective cPOW

Create cPOW for past quests (without Oracle validation):

```bash
cognition-cli cpow generate-retro --quest-id q_retro_001

# Output:
# Generated retrospective cPOW: cpow_q_retro_001
# Note: No Oracle validation available (manual workflow)
# AQS estimated from conversation metrics
# Eligible for CoMP? Yes (AQS: 0.91)
```

### Step 3: Enable Quest Mode

Activate quest-based workflows for new conversations:

```bash
# In .cogxrc or via environment variable
export COGX_QUEST_MODE=true

# Next conversation automatically creates quests
cognition-cli tui --session-id my-project
```

---

## End of Operational Lattice v0.2

_This document has evolved to incorporate quest-based operational flows and the roadmap to full cPOW implementation._

**Version History:**
- **v0.1** (2025-10-31): Manual Oracle-Scribe patterns, Sacred Pauses, AQS concept
- **v0.2** (2025-11-05): Quest formalization roadmap, Oracle integration plan, cPOW specification

**Next Update:** After Phase 1 implementation (Quest lifecycle commands functional)
````

```

```
