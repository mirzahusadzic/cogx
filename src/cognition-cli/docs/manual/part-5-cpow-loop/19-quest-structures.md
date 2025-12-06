---
type: operational
overlay: O5_Operational
status: complete
---

# Chapter 19: Quest Structures

> **"Every transform is a quest. Every quest has a structure. Every structure has depth."**

Quest Structures define the **operational framework** for executing work in the cognition-cli system. This chapter documents the anatomy of quests, depth tracking, sacred sequences (F.L.T.B), quest lifecycle, and mission alignment mechanisms.

**Why Quests Matter**:

- **Structured execution**: Transforms follow a predictable pattern
- **Verifiable quality**: Oracle validation at every step
- **Depth awareness**: Complexity tracking prevents runaway work
- **Mission alignment**: Every quest maps to strategic goals
- **Learning loops**: Successful patterns become reusable wisdom (CoMP)

**Reference Implementation**:

- Quest Operations Log: `src/cognition-cli/src/core/quest/operations-log.ts`
- Workflow Extraction: `src/cognition-cli/src/core/analyzers/workflow-extractor.ts`
- Operations Log Storage: `.open_cognition/workflow_log.jsonl`

---

## Quest Anatomy: The Five Elements

Every quest has five structural elements that define its purpose, scope, and success criteria.

### 1. What — Intent Declaration

**Purpose**: Clearly state the objective in natural language.

**Format**:

```typescript
intent: 'Add JWT authentication to user service';
```

**Properties**:

- **Clear**: Unambiguous goal statement
- **Actionable**: Describes what will change
- **Bounded**: Finite scope (not open-ended)
- **Testable**: Success can be verified

**Examples**:

```typescript
// ✅ Good: Clear, bounded, actionable
'Implement email validation for user registration form';
'Fix memory leak in background sync worker';
'Add dark mode toggle to settings page';

// ❌ Bad: Vague, unbounded, not actionable
'Make the app better';
'Improve performance';
'Add features users want';
```

**Implementation**:

When initializing a quest via the Operations Log:

```typescript
import { QuestOperationsLog } from 'cognition-cli/quest';

const log = new QuestOperationsLog();
await log.logQuestStart({
  quest_id: 'quest-2025-11-15-001',
  intent: 'Add JWT authentication to user service',
  baseline_coherence: 0.82,
  mission_concepts: ['security', 'authentication'],
  security_level: 'high',
});
```

---

### 2. Why — Mission Alignment

**Purpose**: Connect the quest to strategic mission concepts from O₄ (Mission).

**Format**:

```typescript
mission_concepts: ['security', 'user-experience', 'compliance'];
```

**Properties**:

- **Aligned**: Maps to O₄ concepts (not arbitrary tags)
- **Ranked**: Most important concepts first
- **Traceable**: Can measure alignment via coherence
- **Validated**: Concepts exist in mission overlay

**Mission Alignment Process**:

1. **Extract concepts** from O₄ (Mission) overlay:

   ```bash
   cognition-cli concepts top 20
   ```

2. **Select relevant concepts** for the quest:

   ```typescript
   mission_concepts: [
     'security', // Primary: Authentication is security-critical
     'user-experience', // Secondary: Login flow affects UX
     'compliance', // Tertiary: GDPR/auth requirements
   ];
   ```

3. **Validate alignment** during quest:

   ```bash
   cognition-cli coherence aligned --limit 10
   # Shows which symbols align with mission concepts
   ```

4. **Measure drift** after completion:

   ```bash
   cognition-cli coherence check
   # Coherence should increase (positive delta)
   ```

**Example**:

```typescript
// Quest: Add JWT authentication
await log.logQuestStart({
  quest_id: 'quest-auth-001',
  intent: 'Add JWT authentication to user service',
  baseline_coherence: 0.82, // Before quest
  mission_concepts: [
    'security', // Primary alignment
    'user-management', // Secondary alignment
    'api-design', // Tertiary alignment
  ],
  security_level: 'high', // Security-sensitive quest
});

// After quest completion
await log.logQuestComplete({
  quest_id: 'quest-auth-001',
  final_coherence: 0.87, // After quest
  coherence_delta: +0.05, // ✅ Positive = aligned work
  // ... other metrics
});
```

**Anti-Pattern**: Negative coherence delta indicates misaligned work that drifted from mission.

---

### 3. Success — Validation Criteria

**Purpose**: Define what "done" looks like in measurable terms.

**Format**:

```typescript
success_criteria: [
  'JWT tokens generated and validated',
  'All tests passing (unit + integration)',
  'F.L.T.B sequence completes without errors',
  'API endpoints return 401 for invalid tokens',
  'Documentation updated in README.md',
];
```

**Properties**:

- **Measurable**: Can verify programmatically
- **Complete**: Covers all aspects (code, tests, docs)
- **Explicit**: No implicit assumptions
- **Oracle-friendly**: Can be checked by validation gates

**Success Validation Layers**:

1. **F.L.T.B Sacred Sequence** (automated):
   - Format: `npm run format` passes
   - Lint: `npm run lint` passes
   - Test: `npm test` passes
   - Build: `npm run build` succeeds

2. **Oracle Evaluation** (quality assessment):
   - Accuracy: Does it solve the stated intent? (0-1)
   - Efficiency: Is it performant and resource-conscious? (0-1)
   - Adaptability: Is it maintainable and extensible? (0-1)

3. **Coherence Validation** (mission alignment):
   - `coherence_delta > 0`: Work aligned with mission
   - `coherence_delta ≈ 0`: Neutral work (refactoring)
   - `coherence_delta < 0`: ⚠️ Drift detected

**Example**:

```typescript
// Quest completion with success validation
await log.logQuestComplete({
  quest_id: 'quest-auth-001',
  duration_minutes: 45.2,
  transforms_count: 3,
  final_coherence: 0.87,
  coherence_delta: +0.05, // ✅ Mission aligned
  commit_sha: 'a7b3c9d...',
  fltb_passed: true, // ✅ Sacred sequence passed
  aqs_score: 0.91, // ✅ High quality (AAA metrics)
  aqs_grade: 'A',
  comp_generated: true, // ✅ Wisdom extracted
  comp_id: 'comp-auth-pattern-001',
});
```

---

### 4. Big Blocks — Stage Decomposition

**Purpose**: Break complex quests into manageable stages.

**Format**:

```typescript
big_blocks: [
  'Create JWTService class',
  'Add authentication middleware',
  'Update user login endpoint',
  'Add integration tests',
];
```

**Properties**:

- **Sequential**: Logical order of execution
- **Independent**: Each block is self-contained
- **Testable**: Can validate each block separately
- **Bounded**: Each block is < 1 transform (ideally)

**Depth Mapping**:

Big blocks help manage depth (complexity):

```typescript
// Depth 0-1: Single big block (trivial/simple)
big_blocks: ['Add email validation regex'];

// Depth 2: Multiple big blocks (moderate)
big_blocks: [
  'Create validation utility',
  'Add to registration form',
  'Add tests',
];

// Depth 3: Complex decomposition (complex)
big_blocks: [
  'Design authentication architecture',
  'Implement JWT service',
  'Add middleware layer',
  'Update all endpoints',
  'Add comprehensive tests',
  'Update documentation',
];
```

**Anti-Pattern**: Depth 3+ without explicit big blocks leads to scope creep.

---

### 5. Eyes Go — Attention Priorities

**Purpose**: Direct focus to critical quality dimensions.

**Format**:

```typescript
attention_priorities: ['truth', 'security', 'performance'];
```

**Common Priorities**:

- **truth**: Correctness, accuracy, no bugs
- **security**: Boundary enforcement, attack prevention
- **performance**: Speed, efficiency, resource usage
- **UX**: User experience, ergonomics, clarity
- **maintainability**: Code quality, documentation, tests
- **completeness**: All edge cases, error handling
- **alignment**: Mission coherence, principle adherence

**Usage in Oracle Evaluation**:

The Oracle uses `attention_priorities` to weight its AAA scoring:

```typescript
// Quest with security priority
attention_priorities: ['security', 'truth', 'UX'];

// Oracle evaluation emphasizes security
await log.logOracleEvaluation({
  quest_id: 'quest-auth-001',
  transform_id: 'transform-001',
  oracle_score: 0.89,
  accuracy: 0.92, // ✅ Truth dimension
  efficiency: 0.85, // Moderate performance
  adaptability: 0.9, // ✅ Security-focused: good boundary design
  feedback:
    'Excellent security boundaries. Consider caching tokens for performance.',
  session_id: 'oracle-session-123',
  accepted: true,
});
```

---

## Depth Levels: Complexity Tracking

Depth tracks **how deep you are in the problem space**. It prevents runaway complexity and enforces rebalancing.

### Depth Semantics

| Depth        | Label       | Time Limit | Characteristics                              | Example                |
| ------------ | ----------- | ---------- | -------------------------------------------- | ---------------------- |
| **Depth 0**  | Trivial     | < 5 min    | Single-file edit, no dependencies            | Fix typo in README     |
| **Depth 1**  | Simple      | < 30 min   | Few files, isolated change                   | Add email validation   |
| **Depth 2**  | Moderate    | < 2 hours  | Multiple files, some dependencies            | Add JWT authentication |
| **Depth 3**  | Complex     | < 1 day    | Architecture changes, cross-cutting concerns | Refactor auth system   |
| **Depth 3+** | ⚠️ **Halt** | N/A        | Requires justification or surfacing to user  | Major rewrite          |

### Depth Tracking in Operations Log

The Operations Log tracks depth implicitly via transform count and duration:

```typescript
// Depth 0-1: Quick quest
{
  quest_id: 'quest-001',
  duration_minutes: 8.3,      // < 30 min = Depth 1
  transforms_count: 1,         // Single transform
  final_coherence: 0.83,
  coherence_delta: +0.01
}

// Depth 2: Moderate quest
{
  quest_id: 'quest-002',
  duration_minutes: 87.5,     // < 2 hours = Depth 2
  transforms_count: 3,         // Multiple transforms
  final_coherence: 0.88,
  coherence_delta: +0.05
}

// Depth 3+: ⚠️ Complex quest (requires justification)
{
  quest_id: 'quest-003',
  duration_minutes: 340.2,    // > 2 hours = Depth 3+
  transforms_count: 12,        // Many transforms
  final_coherence: 0.91,
  coherence_delta: +0.06       // High delta justifies depth
}
```

### Rebalancing Rules

**When to Rebalance** (surface from depth):

1. **Depth 3+ without justification**: Quest is too complex
2. **Negative coherence delta**: Work is drifting from mission
3. **Repeated Oracle rejections**: Quality issues (low AQS)
4. **Transform count > 10**: Too many changes in one quest

**How to Rebalance**:

```bash
# Check current depth via operations log
cognition-cli status

# If depth > 3, surface decision to user:
# "Quest has been running for 4 hours (Depth 3+).
#  Continue (12 transforms so far) or commit current progress?"

# Option 1: Commit partial progress
git add .
git commit -m "Partial: Auth service (3/6 big blocks complete)"

# Option 2: Split into multiple quests
# Quest A: Core authentication (Depth 2)
# Quest B: Middleware layer (Depth 1)
# Quest C: Integration tests (Depth 1)
```

**Anti-Pattern**: Never allow Depth 4+ without explicit user approval.

---

## Sacred Sequences: F.L.T.B

The **F.L.T.B (Format, Lint, Test, Build)** sacred sequence is an **invariant validation pipeline** that must pass before any commit.

### The Four Layers

```text
┌─────────────────────────────────────────────┐
│ 1. FORMAT — Code Formatting                 │
│    Command: npm run format                   │
│    Purpose: Consistent style, readable code  │
│    Example: Prettier, Black, gofmt          │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│ 2. LINT — Code Quality                      │
│    Command: npm run lint                     │
│    Purpose: Detect bugs, enforce patterns   │
│    Example: ESLint, Pylint, golangci-lint   │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│ 3. TEST — Automated Tests                   │
│    Command: npm test                         │
│    Purpose: Verify correctness, regressions │
│    Example: Jest, Pytest, Go test           │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│ 4. BUILD — Compilation/Bundling             │
│    Command: npm run build                    │
│    Purpose: Ensure deployability            │
│    Example: TypeScript, Webpack, Go build   │
└────────────────┬────────────────────────────┘
                 ↓
              ✅ READY TO COMMIT
```

### Implementation

**Manual Execution**:

```bash
# Run sacred sequence manually
npm run format && npm run lint && npm test && npm run build

# If all pass:
git add .
git commit -m "Add JWT authentication (F.L.T.B ✓)"
```

**Pre-Commit Hook** (recommended):

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running F.L.T.B sacred sequence..."

# 1. Format
echo "  [1/4] Format..."
npm run format || exit 1

# 2. Lint
echo "  [2/4] Lint..."
npm run lint || exit 1

# 3. Test
echo "  [3/4] Test..."
npm test || exit 1

# 4. Build
echo "  [4/4] Build..."
npm run build || exit 1

echo "✅ F.L.T.B passed. Proceeding with commit."
```

**CI/CD Integration**:

```yaml
# .github/workflows/fltb.yml
name: F.L.T.B Sacred Sequence

on: [push, pull_request]

jobs:
  fltb:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: 1. Format
        run: npm run format

      - name: 2. Lint
        run: npm run lint

      - name: 3. Test
        run: npm test

      - name: 4. Build
        run: npm run build

      - name: ✅ F.L.T.B Passed
        run: echo "All sacred sequence gates passed"
```

**Operations Log Tracking**:

```typescript
// Quest completion includes F.L.T.B status
await log.logQuestComplete({
  quest_id: 'quest-auth-001',
  duration_minutes: 45.2,
  transforms_count: 3,
  final_coherence: 0.87,
  coherence_delta: +0.05,
  commit_sha: 'a7b3c9d...',
  fltb_passed: true, // ✅ Sacred sequence passed
  aqs_score: 0.91,
  aqs_grade: 'A',
});
```

### Why F.L.T.B is Sacred

1. **Prevents regressions**: Tests catch breaking changes
2. **Enforces quality**: Lint detects bugs before production
3. **Ensures consistency**: Format maintains readability
4. **Guarantees deployability**: Build validates compilation

**Anti-Pattern**: Committing without F.L.T.B passes creates technical debt.

---

## Quest Lifecycle: From Intent to Receipt

The complete quest lifecycle follows a **9-phase pattern**:

```text
Phase 1: Quest Initialization
   ↓
Phase 2: G→T→O Feedback Loop (repeats per big block)
   ├─ Goal Formulation
   ├─ Transform Execution
   └─ Oracle Validation (AAA)
   ↓
Phase 3: F.L.T.B Sacred Sequence
   ↓
Phase 4: Git Commit
   ↓
Phase 5: PGC Overlay Update
   ↓
Phase 6: cPOW Generation
   ↓
Phase 7: AQS Computation
   ↓
Phase 8: CoMP Distillation
   ↓
Phase 9: Quest Completion
```

### Phase 1: Quest Initialization

**Purpose**: Declare intent, establish baseline, select mission concepts.

**Operations Log**:

```typescript
await log.logQuestStart({
  quest_id: 'quest-2025-11-15-001',
  intent: 'Add JWT authentication to user service',
  baseline_coherence: 0.82, // Current O₇ score
  mission_concepts: ['security', 'api-design'],
  security_level: 'high',
});
```

**Output**:

```
🎯 Quest started: "Add JWT authentication to user service"
Quest ID: quest-2025-11-15-001
Baseline coherence: 0.820
📝 Logged to: .open_cognition/workflow_log.jsonl
```

**What Happens**:

- Quest ID generated (timestamp-based)
- Baseline coherence measured (from O₇)
- Mission concepts validated (from O₄)
- Entry written to Operations Log (`.open_cognition/workflow_log.jsonl`)

---

### Phase 2: G→T→O Feedback Loop

**Purpose**: Execute work through **Goal → Transform → Oracle** cycles.

#### 2a. Goal Formulation

Define the specific outcome for this transform:

```typescript
Goal = {
  what: 'Create JWTService class with sign() and verify() methods',
  why: 'Centralize token logic for reusability',
  success: 'Class exported, unit tests pass, no lint errors',
  files: ['src/auth/JWTService.ts', 'src/auth/__tests__/JWTService.test.ts'],
};
```

#### 2b. Transform Execution

Propose and apply code changes:

```typescript
// Propose transform
await log.logTransform({
  quest_id: 'quest-2025-11-15-001',
  action: 'transform_proposed',
  transform_id: 'transform-001',
  transform_type: 'create',
  files_affected: ['src/auth/JWTService.ts'],
  rationale: 'Centralize JWT token generation and validation',
});

// Apply transform (after Oracle approval)
await log.logTransform({
  quest_id: 'quest-2025-11-15-001',
  action: 'transform_applied',
  transform_id: 'transform-001',
  transform_type: 'create',
  files_affected: ['src/auth/JWTService.ts'],
  rationale: 'Centralize JWT token generation and validation',
  coherence_delta: +0.02, // Coherence improved
});
```

**Output**:

```
🔨 Transform Proposed: transform-001
Type: create, Files: 1
📝 Logged to: .open_cognition/workflow_log.jsonl

🔨 Transform Applied: transform-001
Type: create, Files: 1
Coherence Δ: +0.020
📝 Logged to: .open_cognition/workflow_log.jsonl
```

#### 2c. Oracle Validation (AAA Framework)

Evaluate transform quality using **Accuracy, Efficiency, Adaptability**:

```typescript
await log.logOracleEvaluation({
  quest_id: 'quest-2025-11-15-001',
  transform_id: 'transform-001',
  oracle_score: 0.89, // Weighted average
  accuracy: 0.92, // Correctness (0-1)
  efficiency: 0.85, // Performance (0-1)
  adaptability: 0.9, // Maintainability (0-1)
  feedback:
    'Well-structured implementation. Consider adding token expiry checks.',
  session_id: 'oracle-session-123',
  accepted: true, // ✅ Transform approved
});
```

**Output**:

```
🔮 Oracle evaluated: transform-001
Score: 0.890 (ACCEPTED)
  Accuracy: 0.92, Efficiency: 0.85, Adaptability: 0.90
📝 Logged to: .open_cognition/workflow_log.jsonl
```

**AAA Scoring Details**:

| Dimension        | Weight | Criteria                                                     |
| ---------------- | ------ | ------------------------------------------------------------ |
| **Accuracy**     | 40%    | Does it solve the intent? Correct logic? Edge cases handled? |
| **Efficiency**   | 30%    | Is it performant? Resource-conscious? Avoids waste?          |
| **Adaptability** | 30%    | Is it maintainable? Well-documented? Extensible?             |

```typescript
// Oracle score formula
oracle_score = accuracy * 0.4 + efficiency * 0.3 + adaptability * 0.3;
```

**Repeat** 2a-2c for each big block in the quest.

---

### Phase 3: F.L.T.B Sacred Sequence

**Purpose**: Validate all changes before commit.

```bash
# Run sacred sequence
npm run format  # ✅ Code formatted
npm run lint    # ✅ No lint errors
npm test        # ✅ All tests pass
npm run build   # ✅ Build succeeds
```

**If any step fails**:

- Fix the issue
- Re-run F.L.T.B
- Do NOT proceed to commit until all pass

---

### Phase 4: Git Commit

**Purpose**: Persist changes to version control.

```bash
git add .
git commit -m "Add JWT authentication

- Created JWTService class
- Added sign() and verify() methods
- Unit tests for token lifecycle
- Updated API middleware

F.L.T.B ✓ | Depth 2 | Coherence +0.05"

# Commit SHA: a7b3c9d2e5f8...
```

**Commit Message Best Practices**:

- First line: Imperative summary (< 72 chars)
- Body: What changed, why it changed
- Footer: F.L.T.B status, depth, coherence delta

---

### Phase 5: PGC Overlay Update

**Purpose**: Regenerate affected overlays to maintain lattice coherence.

```bash
# Automatic update (triggered by cognition-cli watch)
cognition-cli update

# Manual update
cognition-cli genesis src/  # Regenerate O₁ (Structure)
cognition-cli overlay generate lineage  # Regenerate O₃ (Lineage)
cognition-cli coherence check  # Validate O₇ (Coherence)
```

**What Updates**:

- **O₁ (Structure)**: If code structure changed (new classes/functions)
- **O₃ (Lineage)**: If dependencies changed (new imports/calls)
- **O₄ (Mission)**: If documentation changed (mission concepts)
- **O₇ (Coherence)**: Always (alignment scores recalculated)

---

### Phase 6: cPOW Generation

**Purpose**: Create immutable computational receipt.

**Format** (stored in overlay metadata):

```yaml
cpow:
  magnitude: 0.85
  computation:
    extraction_method: 'AST traversal + eGemma embeddings'
    embedding_model: 'eGemma-768'
    api_calls: 42
    oracle_validation: 'APPROVED'
  timestamp: '2025-11-15T14:32:11Z'
  git_commit: 'a7b3c9d2e5f8...'
```

**Purpose**:

- **Provenance**: What work was done
- **Verification**: How it was computed
- **Immutability**: Cannot be forged or modified
- **Portability**: Travels with .cogx export

---

### Phase 7: AQS Computation

**Purpose**: Calculate **Agentic Quality Score** from Operations Log.

**Formula** (from README.md):

```typescript
AQS =
  path_efficiency * 0.4 + // Fewer steps = better
  (1 - correction_penalty) * 0.3 + // Fewer errors = better
  proactive_bonus * 0.3; // More optimizations = better

// Path Efficiency: Ratio of transforms to big blocks
path_efficiency = min_transforms / actual_transforms;

// Correction Penalty: Ratio of rejected to total transforms
correction_penalty = oracle_rejections / total_transforms;

// Proactive Bonus: Ratio of improvements to total transforms
proactive_bonus = proactive_improvements / total_transforms;
```

**Example**:

```typescript
// Quest metrics from Operations Log
const quest = {
  big_blocks: 3,                  // Minimum 3 transforms needed
  transforms_applied: 4,          // Actual transforms (1 extra)
  oracle_rejections: 1,           // 1 transform rejected
  proactive_improvements: 2       // 2 optimizations
};

// Compute AQS
const path_efficiency = 3 / 4 = 0.75;
const correction_penalty = 1 / 4 = 0.25;
const proactive_bonus = 2 / 4 = 0.5;

const aqs_score = (
  0.75 * 0.4 +
  (1 - 0.25) * 0.3 +
  0.5 * 0.3
) = 0.3 + 0.225 + 0.15 = 0.675;

const aqs_grade = 'C';  // 0.60-0.79 = C
```

**Grading Scale**:

| Score     | Grade | Quality                                      |
| --------- | ----- | -------------------------------------------- |
| 0.90+     | A     | Excellent (efficient, few errors, proactive) |
| 0.80-0.89 | B     | Good (efficient, some errors)                |
| 0.70-0.79 | C     | Acceptable (moderate efficiency)             |
| 0.60-0.69 | D     | Poor (many errors, inefficient)              |
| < 0.60    | F     | Failing (excessive errors, wasteful)         |

---

### Phase 8: CoMP Distillation

**Purpose**: Extract reusable wisdom (Crystallized Mission Patterns) from successful quests.

**When to Distill**:

- AQS grade ≥ B (0.80+)
- Positive coherence delta (mission-aligned)
- F.L.T.B passed
- Novel pattern (not duplicate of existing CoMP)

**Example**:

```yaml
# .open_cognition/comp/auth-pattern-001.yaml
comp_id: comp-auth-pattern-001
quest_id: quest-2025-11-15-001
aqs_score: 0.91
aqs_grade: A

pattern:
  name: 'JWT Authentication Pattern'
  context: 'Adding token-based auth to REST API'
  solution: |
    1. Create JWTService class (sign, verify)
    2. Add authentication middleware
    3. Update protected endpoints
    4. Add comprehensive tests

  big_blocks:
    - 'Create JWTService class'
    - 'Add middleware layer'
    - 'Update endpoints'
    - 'Add integration tests'

  sacred_sequence: F.L.T.B

  depth: 2 # Moderate complexity

  mission_alignment:
    concepts: ['security', 'api-design']
    coherence_delta: +0.05

  reusability: high

provenance:
  git_commit: a7b3c9d2e5f8...
  timestamp: '2025-11-15T14:35:22Z'
  author: user@example.com
```

**Usage**:

Future quests can reference this CoMP:

```bash
# Search for authentication patterns
cognition-cli ask "how do I add authentication"

# Output includes CoMP reference:
# "Based on CoMP comp-auth-pattern-001 (AQS: 0.91, Grade A):
#  1. Create JWTService class
#  2. Add middleware layer
#  ..."
```

---

### Phase 9: Quest Completion

**Purpose**: Finalize quest with metrics and receipt.

**Operations Log**:

```typescript
await log.logQuestComplete({
  quest_id: 'quest-2025-11-15-001',
  duration_minutes: 87.5, // 1.5 hours (Depth 2)
  transforms_count: 4, // 4 transforms applied
  final_coherence: 0.87, // After quest
  coherence_delta: +0.05, // ✅ Improved alignment
  commit_sha: 'a7b3c9d2e5f8...', // Git commit
  fltb_passed: true, // ✅ Sacred sequence
  cpow_id: 'cpow-quest-001', // cPOW identifier
  aqs_score: 0.91, // ✅ Grade A
  aqs_grade: 'A',
  comp_generated: true, // ✅ Wisdom extracted
  comp_id: 'comp-auth-pattern-001', // CoMP identifier
});
```

**Output**:

```
✅ Quest completed: quest-2025-11-15-001
Duration: 87.5 minutes
Transforms: 4, Coherence Δ: +0.050
F.L.T.B: PASSED
Commit: a7b3c9d2
AQS: 0.910 (Grade: A)
🎓 Wisdom distilled: comp-auth-pattern-001
📝 Logged to: .open_cognition/workflow_log.jsonl
```

---

## Mission Alignment: Coherence Checks

Mission alignment ensures every quest **strengthens the lattice** rather than drifting from strategic goals.

### Three Alignment Mechanisms

#### 1. Concept Validation (Pre-Quest)

**Purpose**: Ensure quest maps to existing O₄ (Mission) concepts.

```bash
# List available mission concepts
cognition-cli concepts top 20

# Output:
# 1. security (weight: 0.95)
# 2. user-experience (weight: 0.89)
# 3. api-design (weight: 0.85)
# ...

# Select concepts for quest
mission_concepts: ['security', 'api-design']
```

**Validation**:

- Concepts MUST exist in O₄ (reject unknown concepts)
- At least 1 concept required (cannot be empty)
- Ranked by relevance (most important first)

---

#### 2. Coherence Tracking (During Quest)

**Purpose**: Measure alignment drift at each transform.

```typescript
// After each transform
await log.logTransform({
  quest_id: 'quest-001',
  action: 'transform_applied',
  transform_id: 'transform-001',
  // ...
  coherence_delta: +0.02, // ✅ Positive = moving toward mission
});
```

**Interpretation**:

| Coherence Delta | Meaning               | Action            |
| --------------- | --------------------- | ----------------- |
| +0.05 to +0.10  | Strong alignment      | ✅ Continue quest |
| +0.01 to +0.04  | Moderate alignment    | ✅ Continue quest |
| -0.01 to +0.01  | Neutral (refactoring) | ⚠️ Monitor        |
| -0.02 to -0.04  | Drift detected        | ⚠️ Rebalance      |
| < -0.05         | Severe drift          | 🛑 Halt quest     |

**Example**:

```typescript
// Transform 1: Create JWTService (+0.02)
coherence: 0.82 → 0.84 ✅

// Transform 2: Add middleware (+0.01)
coherence: 0.84 → 0.85 ✅

// Transform 3: Refactor tests (0.00)
coherence: 0.85 → 0.85 ⚠️ Neutral

// Transform 4: Add unnecessary feature (-0.03)
coherence: 0.85 → 0.82 🛑 DRIFT DETECTED

// Action: Revert Transform 4, rebalance quest
```

---

#### 3. Final Coherence Check (Post-Quest)

**Purpose**: Validate net alignment improvement.

```bash
# Check final coherence after quest
cognition-cli coherence check

# Output:
# Coherence Score: 0.87 (+0.05 from baseline)
# Status: ✅ COHERENT (aligned with mission)
```

**Validation Rules**:

| Final Delta    | Status          | Grade Impact      |
| -------------- | --------------- | ----------------- |
| +0.05+         | ✅ Excellent    | AQS bonus +0.05   |
| +0.02 to +0.04 | ✅ Good         | No penalty        |
| -0.01 to +0.01 | ⚠️ Neutral      | No penalty        |
| -0.02 to -0.04 | ⚠️ Drift        | AQS penalty -0.05 |
| < -0.05        | 🛑 Severe drift | AQS penalty -0.10 |

**Example**:

```typescript
// Quest with positive alignment
await log.logQuestComplete({
  quest_id: 'quest-001',
  baseline_coherence: 0.82,
  final_coherence: 0.87,
  coherence_delta: +0.05, // ✅ Strong alignment
  aqs_score: 0.91 + 0.05, // Bonus applied
  aqs_grade: 'A',
});

// Quest with drift
await log.logQuestComplete({
  quest_id: 'quest-002',
  baseline_coherence: 0.85,
  final_coherence: 0.82,
  coherence_delta: -0.03, // ⚠️ Drift detected
  aqs_score: 0.85 - 0.05, // Penalty applied
  aqs_grade: 'B', // Downgraded from A
});
```

---

## Operations Log: The Append-Only Audit Trail

All quest activities are recorded in `.open_cognition/workflow_log.jsonl`.

### Log Format: JSONL (JSON Lines)

**Structure**: One JSON object per line (append-only).

**Example**:

```jsonl
{"timestamp":"2025-11-15T14:00:00Z","quest_id":"quest-001","action":"quest_start","user":"alice","intent":"Add JWT auth","baseline_coherence":0.82,"mission_concepts":["security"],"security_level":"high"}
{"timestamp":"2025-11-15T14:05:12Z","quest_id":"quest-001","action":"transform_proposed","user":"alice","transform_id":"t-001","transform_type":"create","files_affected":["src/auth/JWTService.ts"],"rationale":"Centralize token logic"}
{"timestamp":"2025-11-15T14:06:45Z","quest_id":"quest-001","action":"oracle_evaluation","user":"alice","transform_id":"t-001","oracle_score":0.89,"accuracy":0.92,"efficiency":0.85,"adaptability":0.90,"feedback":"Good structure","session_id":"oracle-123","accepted":true}
{"timestamp":"2025-11-15T14:07:20Z","quest_id":"quest-001","action":"transform_applied","user":"alice","transform_id":"t-001","transform_type":"create","files_affected":["src/auth/JWTService.ts"],"rationale":"Centralize token logic","coherence_delta":0.02}
{"timestamp":"2025-11-15T15:27:30Z","quest_id":"quest-001","action":"quest_complete","user":"alice","duration_minutes":87.5,"transforms_count":4,"final_coherence":0.87,"coherence_delta":0.05,"commit_sha":"a7b3c9d...","fltb_passed":true,"aqs_score":0.91,"aqs_grade":"A","comp_generated":true,"comp_id":"comp-auth-001"}
```

### Entry Types

#### 1. quest_start

```typescript
{
  timestamp: "2025-11-15T14:00:00Z",
  quest_id: "quest-001",
  action: "quest_start",
  user: "alice",
  intent: "Add JWT authentication",
  baseline_coherence: 0.82,
  mission_concepts: ["security", "api-design"],
  security_level: "high"
}
```

#### 2. transform_proposed

```typescript
{
  timestamp: "2025-11-15T14:05:12Z",
  quest_id: "quest-001",
  action: "transform_proposed",
  user: "alice",
  transform_id: "t-001",
  transform_type: "create",
  files_affected: ["src/auth/JWTService.ts"],
  rationale: "Centralize JWT token logic"
}
```

#### 3. oracle_evaluation

```typescript
{
  timestamp: "2025-11-15T14:06:45Z",
  quest_id: "quest-001",
  action: "oracle_evaluation",
  user: "alice",
  transform_id: "t-001",
  oracle_score: 0.89,
  accuracy: 0.92,
  efficiency: 0.85,
  adaptability: 0.90,
  feedback: "Well-structured implementation",
  session_id: "oracle-123",
  accepted: true
}
```

#### 4. transform_applied

```typescript
{
  timestamp: "2025-11-15T14:07:20Z",
  quest_id: "quest-001",
  action: "transform_applied",
  user: "alice",
  transform_id: "t-001",
  transform_type: "create",
  files_affected: ["src/auth/JWTService.ts"],
  rationale: "Centralize JWT token logic",
  coherence_delta: 0.02
}
```

#### 5. quest_complete

```typescript
{
  timestamp: "2025-11-15T15:27:30Z",
  quest_id: "quest-001",
  action: "quest_complete",
  user: "alice",
  duration_minutes: 87.5,
  transforms_count: 4,
  final_coherence: 0.87,
  coherence_delta: 0.05,
  commit_sha: "a7b3c9d...",
  fltb_passed: true,
  aqs_score: 0.91,
  aqs_grade: "A",
  comp_generated: true,
  comp_id: "comp-auth-001"
}
```

### Log Analysis

**Query quest history**:

```typescript
import { QuestOperationsLog } from 'cognition-cli/quest';

const log = new QuestOperationsLog();

// Get all entries for a quest
const entries = await log.getQuestLog('quest-001');
console.log(`Quest has ${entries.length} log entries`);

// Get quest duration
const duration = await log.getQuestDuration('quest-001');
console.log(`Quest took ${duration?.toFixed(1)} minutes`);

// Get transform count
const count = await log.getTransformCount('quest-001');
console.log(`Quest applied ${count} transforms`);

// Get average Oracle score
const avgScore = await log.getAverageOracleScore('quest-001');
console.log(`Average quality: ${(avgScore! * 100).toFixed(1)}%`);
```

---

## Best Practices

### 1. Quest Initialization

✅ **Do**:

- Write clear, bounded intent statements
- Select mission concepts from O₄ (verify with `concepts top`)
- Set realistic depth expectations
- Measure baseline coherence before starting

❌ **Don't**:

- Use vague intents ("make it better")
- Invent mission concepts (must exist in O₄)
- Start Depth 3+ quests without justification
- Skip baseline measurement

---

### 2. Transform Execution

✅ **Do**:

- Break complex changes into multiple transforms
- Log proposed transforms BEFORE applying
- Include rationale for every transform
- Track coherence delta at each step

❌ **Don't**:

- Apply transforms without Oracle evaluation
- Batch multiple unrelated changes
- Ignore negative coherence deltas
- Skip transform logging

---

### 3. Oracle Validation

✅ **Do**:

- Provide detailed feedback (what's good, what's improvable)
- Use AAA framework consistently (Accuracy, Efficiency, Adaptability)
- Accept high-quality transforms (score ≥ 0.80)
- Reject transforms with critical issues

❌ **Don't**:

- Auto-approve all transforms
- Ignore accuracy/efficiency/adaptability dimensions
- Skip feedback messages
- Accept transforms with security flaws

---

### 4. F.L.T.B Sacred Sequence

✅ **Do**:

- Run F.L.T.B before EVERY commit
- Fix all errors (format, lint, test, build)
- Use pre-commit hooks to enforce
- Document F.L.T.B status in commit messages

❌ **Don't**:

- Commit without F.L.T.B passing
- Skip tests ("I'll fix them later")
- Ignore lint warnings
- Bypass hooks with `--no-verify`

---

### 5. Mission Alignment

✅ **Do**:

- Check coherence after every transform
- Rebalance if coherence delta < 0
- Validate mission concepts from O₄
- Celebrate positive alignment (+0.05+)

❌ **Don't**:

- Ignore coherence drift
- Continue quests with negative deltas
- Use arbitrary tags as mission concepts
- Skip final coherence check

---

## Real-World Example: Complete Quest

**Scenario**: Add JWT authentication to user service

### Setup

```bash
# Check mission concepts
cognition-cli concepts top 20
# Output: security (0.95), api-design (0.85), user-management (0.82)

# Measure baseline coherence
cognition-cli coherence check
# Output: Coherence: 0.82
```

### Phase 1: Quest Initialization

```typescript
import { QuestOperationsLog } from 'cognition-cli/quest';

const log = new QuestOperationsLog();
await log.logQuestStart({
  quest_id: 'quest-2025-11-15-auth',
  intent: 'Add JWT authentication to user service',
  baseline_coherence: 0.82,
  mission_concepts: ['security', 'api-design', 'user-management'],
  security_level: 'high',
});
```

### Phase 2: G→T→O Loop (4 transforms)

**Transform 1: Create JWTService**

```typescript
// Propose
await log.logTransform({
  quest_id: 'quest-2025-11-15-auth',
  action: 'transform_proposed',
  transform_id: 't-001',
  transform_type: 'create',
  files_affected: ['src/auth/JWTService.ts'],
  rationale: 'Centralize JWT token generation and validation',
});

// Oracle evaluation
await log.logOracleEvaluation({
  quest_id: 'quest-2025-11-15-auth',
  transform_id: 't-001',
  oracle_score: 0.89,
  accuracy: 0.92,
  efficiency: 0.85,
  adaptability: 0.9,
  feedback: 'Well-structured. Consider adding token expiry validation.',
  session_id: 'oracle-001',
  accepted: true,
});

// Apply
await log.logTransform({
  quest_id: 'quest-2025-11-15-auth',
  action: 'transform_applied',
  transform_id: 't-001',
  transform_type: 'create',
  files_affected: ['src/auth/JWTService.ts'],
  rationale: 'Centralize JWT token generation and validation',
  coherence_delta: +0.02,
});
```

**Transform 2-4**: Similar pattern for middleware, endpoint updates, tests.

### Phase 3-4: F.L.T.B + Commit

```bash
npm run format && npm run lint && npm test && npm run build
# All pass ✅

git add .
git commit -m "Add JWT authentication

- Created JWTService class
- Added authentication middleware
- Updated user login/register endpoints
- Added comprehensive unit + integration tests

F.L.T.B ✓ | Depth 2 | Coherence +0.05 | AQS: 0.91"
```

### Phase 5-8: Update + cPOW + AQS + CoMP

```bash
cognition-cli update
# Regenerated O₁, O₃, O₇
# cPOW generated: cpow-quest-auth
# AQS computed: 0.91 (Grade A)
# CoMP distilled: comp-auth-pattern-001
```

### Phase 9: Quest Completion

```typescript
await log.logQuestComplete({
  quest_id: 'quest-2025-11-15-auth',
  duration_minutes: 87.5,
  transforms_count: 4,
  final_coherence: 0.87,
  coherence_delta: +0.05,
  commit_sha: 'a7b3c9d2e5f8...',
  fltb_passed: true,
  cpow_id: 'cpow-quest-auth',
  aqs_score: 0.91,
  aqs_grade: 'A',
  comp_generated: true,
  comp_id: 'comp-auth-pattern-001',
});
```

**Output**:

```
✅ Quest completed: quest-2025-11-15-auth
Duration: 87.5 minutes (Depth 2)
Transforms: 4, Coherence Δ: +0.050
F.L.T.B: PASSED
Commit: a7b3c9d2
AQS: 0.910 (Grade: A)
🎓 Wisdom distilled: comp-auth-pattern-001
📝 Logged to: .open_cognition/workflow_log.jsonl
```

---

## Summary

**Quest Structures** provide the operational framework for all work in the cognition-cli system:

1. **Quest Anatomy**: What, Why, Success, Big Blocks, Eyes Go
2. **Depth Levels**: Complexity tracking (Depth 0-3, rebalance at 3+)
3. **Sacred Sequences**: F.L.T.B validation (Format, Lint, Test, Build)
4. **Quest Lifecycle**: 9 phases from intent to receipt
5. **Mission Alignment**: Coherence checks at every step

**Key Invariants**:

- ✅ Every quest has a clear intent and success criteria
- ✅ Every transform is validated by Oracle (AAA framework)
- ✅ Every commit passes F.L.T.B sacred sequence
- ✅ Every quest improves mission coherence (positive delta)
- ✅ Every quest generates a cPOW receipt
- ✅ High-quality quests (AQS ≥ 0.80) distill wisdom (CoMP)

**Anti-Patterns**:

- ❌ Depth 3+ without justification (runaway complexity)
- ❌ Negative coherence delta (drift from mission)
- ❌ Skipping F.L.T.B (technical debt)
- ❌ Missing Oracle evaluation (quality risk)
- ❌ Vague intent statements (scope creep)

**Next Steps**:

- **Chapter 20: Validation Oracles** — Deep dive into AAA framework, Oracle personas (eGemma), and quality scoring
- **Chapter 18: Operational Flow** — Transform pipeline, orchestrators, and audit trails

---

**Related Documentation**:

- [Chapter 5: CLI Operations](../part-1-foundation/05-cli-operations.md) — `cognition-cli` commands (`watch`, `status`, `update`)
- [Chapter 9: O₅ Operational](../part-2-seven-layers/09-o5-operational.md) — Operational overlay and workflow patterns
- [Chapter 11: O₇ Coherence](../part-2-seven-layers/11-o7-coherence.md) — Coherence scoring and alignment
- [Quick Start Guide](../part-0-quickstart/00-quick-start.md) — 10-minute onboarding with first queries

**Implementation Reference**:

- Quest Operations Log: `src/cognition-cli/src/core/quest/operations-log.ts:1`
- Workflow Extractor: `src/cognition-cli/src/core/analyzers/workflow-extractor.ts:1`
- cPOW Architecture: `src/cognition-cli/docs/architecture/CPOW_OPERATIONAL_LOOP.md`

---

**End of Chapter 19**
