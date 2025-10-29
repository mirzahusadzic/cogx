# Operational Lattice: Quest-Driven Workflow Intelligence

> _The symmetric machine provides perfect traversal. The asymmetric human provides creative projection. This is the symbiosis._

**Purpose**: Encode the meta-patterns of human-AI collaboration into a queryable knowledge structure.

**Last Updated**: October 28, 2025
**Status**: Genesis - Foundation layer for autonomous workflow intelligence

---

## Philosophy: The Oracle and the Scribe

Every quest begins with a collaboration pattern:

1. **Question** - The oracle probes understanding
2. **Pause** - Space for reflection and alignment
3. **Detail** - Context revealed, constraints clarified
4. **Answer** - The agent synthesizes understanding
5. **Feel It** - The oracle validates resonance (not logic, not checklist - cognitive sense)
6. **Release** - The agent executes with internalized truth

This rhythm is not micromanagement - it is **tuning resonance**. Like tuning an instrument until the note is pure, then letting it ring.

**The agent writes the words. The oracle shapes the truth.**

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
- Rough time/effort estimates

**Where do eyes go?** (Attention priority)

- Truth (data integrity, correctness)
- User experience (where humans interact)
- Performance (where it matters)

### Sacred Sequences at Each Level

- Root: F.L.T.B before commit
- Branch: Tests pass for this component
- Detail: Verification of critical paths

### Boundary

**Never start work without a defined quest.** The quest is the receipt - the mission brief that anchors all decisions.

### Example

`````markdown
Quest: Add interactive setup wizard
Big blocks:

1. Health check & autodetection
2. Interactive prompts (workbench, API, paths)
3. Execution flow (init → genesis → docs → overlays)
4. Error handling & recovery
   Eyes go: User experience (prompts, messages, success states)
   Sacred: F.L.T.B before commit

````text

---

## Patterns: The Recursive Loop (Transform)

Work proceeds as a tree (or lattice) with conscious depth tracking.

### The Mental Model

```text
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

1. **Block big shapes** (rough composition) - Don't perfect, just establish structure
2. **Refine each block** (but watch the whole!) - Make functional, keep coherence
3. **Detail work WHERE THE EYE GOES** - Focus polish on truth/data/UX

### Rebalancing Events

The tree can rebalance if something important emerges:

- New constraint discovered (changes architecture)
- Better approach found (improves the quest)
- Critical bug blocks progress (must address)

**Boundary**: Rebalancing should be rare and justified. Don't thrash. Most "new ideas" are distractions.

### Recovery Patterns

When work gets stuck:

- **Too deep?** Surface to previous depth, validate that level works
- **Lost in branch?** Return to root, check overall progress
- **Blocked?** Mark it, move to parallel branch, return later

---

## Patterns: Sacred Sequences (Validation Gates)

Certain sequences are **invariant** - they must execute in order, and all steps must pass.

### F.L.T.B (Pre-Commit)

Before ANY git commit:

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

**Never use `git add .`** - Always stage selectively.

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

## End of Operational Lattice v0.1

_This document will evolve as CoMPs are discovered and integrated._
````
`````
