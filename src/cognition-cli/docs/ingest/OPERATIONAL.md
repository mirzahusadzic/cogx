# Operational Patterns

> _Operational discipline turns cognitive insights into verifiable impact._

## Overview

Cognition CLI is not just a tool; it is a way of working. It demands a shift from "hacking" to "engineering." These operational patterns define how we interact with the system to maintain high coherence and low entropy.

**Discipline is the bridge between goals and accomplishment.**

## Terminology

**Quest** — A bounded unit of work with clear success criteria (e.g., "Implement feature X").
**Oracle** — The PGC acting as the source of truth for queries.
**Scribe** — The logging and auditing subsystem.
**Depth** — Level of detail:

- Depth 0: Strategic (Architecture, Mission)
- Depth 1: Tactical (Files, Interfaces)
- Depth 2: Kinetic (Lines of code, Implementation)
  **AQS** — Agentic Quality Score.

## Sacred Sequences

### The Oracle-Scribe Cycle

**The rhythm of collaboration is invariant.**

1. **Genesis Pause** — Validate quest before work begins (`genesis`).
2. **Verification Pause** — Check drift during work (`coherence`).
3. **Final Validation** — F.L.T.B before commit (`audit`).

_Note: "Oracle" here refers to the Human-in-the-loop, distinct from the PGC Oracle._

### F.L.T.B (Format, Lint, Test, Build)

**This sequence is invariant and must never be violated.**

Before pushing any code, the machine must bless it:

1. **Format** — `npm run format` (Prettier)
2. **Lint** — `npm run lint` (ESLint)
3. **Test** — `npm test` (Jest/Vitest)
4. **Build** — `npm run build` (TypeScript compilation)

**All four steps must pass before any commit is accepted.**

### The Genesis Cycle

**[The loop of cognitive synchronization.]**

When changing code, the mental model must update:

1. **Edit** — Modify the source code.
2. **Genesis** — Run `cognition-cli genesis` to update the PGC.
3. **Verify** — Run `cognition-cli coherence` to check alignment.

## Quest Structures

### Quest: Onboard New Project

**What**: Initialize Cognition CLI in a greenfield or brownfield repository.

**Why**: To establish the baseline for verifiable development.

**Success Criteria**:

- PGC initialized (`.sigma` and `.open_cognition` created).
- `genesis` completes without errors.
- `ask "what does this project do?"` returns a coherent answer.

**Big Blocks**: Large repositories (>500 files) may require memory tuning.

**Eyes Go**: `src/commands/init.ts`

### Quest: Refactor Subsystem

**What**: restructure a module (e.g., moving from `utils` to `core`).

**Why**: To improve cohesion and reduce coupling.

**Success Criteria**:

- All imports updated.
- Tests pass.
- Blast radius analysis shows no unexpected breaks.

### Quest Lifecycle

**The lifecycle ensures no effort is wasted.**

1. **Generation** — Quests are generated from strategic gaps (CoMP).
2. **Execution** — Work is tracked via AQS (Agentic Quality Score).
3. **Completion** — Success is verified against the Oracle.

## Depth Rules

### Depth Transitions

**Depth increases when blocking issues require detailed investigation.**

**Depth decreases when patterns emerge and can be abstracted.**

- ✅ **Rebalancing** — Every 30 minutes, ask: "Am I at the right depth?"
- ❌ **Depth lock** — Getting stuck debugging a single function for 4 hours without stepping back to question the design.

## Workflow Patterns

### [Pattern Name] The Coherence Check

**[Bold statement about when to use this pattern.]**

Use this pattern before starting any major feature work.

Triggers:

- Starting a new Quest.
- Returning to the project after a break.

Actions:

- Run `cognition-cli concepts list` to refresh mission memory.
- Run `cognition-cli status` to check system health.

### [Pattern Name] The Blast Radius Review

**[Measure twice, cut once.]**

Use this pattern before merging complex PRs.

Triggers:

- Modifying a "Core" or "Shared" component.

Actions:

- Run `cognition-cli blast-radius <file>`
- If impact > 10 files, require an additional manual review.

## Metrics

### Agentic Quality Score (AQS)

AQS = (Completion × Correctness × Coherence) / Time

**Components**:

- **Completion** — % of requirements implemented.
- **Correctness** — % of tests passing.
- **Coherence** — Similarity score with `VISION.md`.
- **Time** — Normalized execution time.

## Operational Boundaries

### Boundary: Dirty State

**Constraint**: Cannot run `genesis` on a dirty git tree (optional but recommended).
**Enforcement**: Warning in CLI.
**Recovery**: Commit or stash changes.
