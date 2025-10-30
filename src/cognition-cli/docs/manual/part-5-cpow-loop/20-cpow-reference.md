# Chapter 20: cPOW Reference Manual

> "The proof is in the work. The work is in the proof."
>
> — Quest-Oriented Development Manifesto

**Part**: V — cPOW Operational Loop<br/>
**Focus**: Formal Specification & Implementation<br/>
**Status**: Pre-Release Documentation<br/>
**Version**: 1.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Formal Mathematical Foundations](#formal-mathematical-foundations)
3. [Operational Loop Specification](#operational-loop-specification)
4. [API Reference](#api-reference)
5. [Implementation Guide](#implementation-guide)
6. [Validation and Verification](#validation-and-verification)
7. [Storage Architecture](#storage-architecture)
8. [Performance Characteristics](#performance-characteristics)
9. [Security Considerations](#security-considerations)
10. [Appendices](#appendices)

---

## Executive Summary

### What is cPOW?

**Cognitive Proof of Work (cPOW)** is an immutable computational receipt that proves:

1. **Work was performed** - Quest execution with measurable effort
2. **Oracle validated** - External AI oracle (eGemma) verified quality
3. **Wisdom extracted** - High-quality patterns distilled for reuse
4. **Provenance tracked** - Complete lineage from intent to outcome

Unlike traditional Proof of Work (mining), cPOW proves **cognitive value creation** rather than computational brute force.

### Key Properties

- **Immutability**: Once committed to PGC, cPOW cannot be altered
- **Verifiability**: Any agent can verify cPOW authenticity via checksums and oracle signatures
- **Composability**: cPOWs reference each other, forming wisdom graphs
- **Incentive Alignment**: High AQS (Agentic Quality Score) produces reusable wisdom (CoMP)

### Core Innovation

cPOW enables **verifiable mission alignment** through the G→T→O feedback loop:

```
Quest (G) → Transform (T) → Oracle Validation (O) → cPOW
```

This creates a **self-improving system** where:

- Good quests (AQS > 0.7) produce wisdom (CoMP)
- CoMP guides future quests
- Oracle enforces mission alignment
- PGC provides immutable audit trail

---

## Formal Mathematical Foundations

### 1. Core Definitions

#### Definition 1.1: Quest Space

Let **Q** be the set of all possible quests. A quest q ∈ Q is a tuple:

```
q = (I, C₀, T, M, S)
```

Where:

- **I**: Intent (natural language description)
- **C₀**: Baseline coherence state (from O₇)
- **T**: Transform sequence T = [t₁, t₂, ..., tₙ]
- **M**: Mission context (from O₄)
- **S**: Success criteria (from operational patterns O₅)

#### Definition 1.2: Transform Function

A transform t: Σ → Σ is a function mapping codebase state to codebase state.

```
Σ = (F, D, P)
```

Where:

- **F**: File system state (AST, embeddings)
- **D**: Dependency graph (O₃)
- **P**: Pattern library (O₅)

**Properties**:

- Deterministic: ∀σ ∈ Σ, t(σ) is uniquely determined
- Traceable: Each t has metadata (timestamp, agent, rationale)
- Composable: (t₂ ∘ t₁)(σ) = t₂(t₁(σ))

#### Definition 1.3: Coherence Function

The coherence function γ: Σ → [0,1] measures mission alignment:

```
γ(σ) = (1/|S|) Σ_{s∈S} cos_sim(e_s, e_M)
```

Where:

- **S**: Set of symbols in σ
- **e_s**: Embedding of symbol s (from O₁)
- **e_M**: Mission concept embedding (from O₄)
- **cos_sim**: Cosine similarity function

**Properties**:

- γ(σ) = 0: Complete misalignment
- γ(σ) = 1: Perfect alignment
- Monotonicity: Desirable but not guaranteed (drift possible)

#### Definition 1.4: Oracle Function

The oracle ω: (Q, Σ_before, Σ_after) → [0,1] validates quest execution:

```
ω(q, σ₀, σ₁) = w_acc · acc(q, σ₁) + w_eff · eff(T) + w_adp · adp(q, T)
```

Where:

- **acc**: Accuracy - Did we achieve the intent?
- **eff**: Efficiency - Minimal transform sequence?
- **adp**: Adaptability - Handled unexpected obstacles?
- **w_acc, w_eff, w_adp**: Weights (default: 0.5, 0.3, 0.2)

**Properties**:

- ω ∈ [0,1]: Normalized score
- Consistent: Same (q, σ₀, σ₁) → same ω (deterministic oracle)
- Calibrated: External validation (eGemma) ensures objectivity

### 2. Theorems and Proofs

#### Theorem 2.1: Coherence Non-Decrease with Proper Alignment

**Statement**: If a transform t is mission-aligned (coherence-preserving), then:

```
γ(t(σ)) ≥ γ(σ)
```

**Proof**:

Let σ₀ be initial state, σ₁ = t(σ₀) be transformed state.

Assume t is mission-aligned, meaning:

- All new symbols s_new have cos_sim(e_s_new, e_M) ≥ threshold τ
- No high-coherence symbols removed

Then:

```
γ(σ₁) = (1/|S₁|) Σ_{s∈S₁} cos_sim(e_s, e_M)
      = (1/|S₁|) [Σ_{s∈S₀} cos_sim(e_s, e_M) + Σ_{s∈S_new} cos_sim(e_s, e_M)]
```

Since S_new symbols satisfy cos_sim(e_s, e_M) ≥ τ and τ ≥ γ(σ₀) (by design), we have:

```
γ(σ₁) ≥ γ(σ₀)
```

**Corollary 2.1.1**: If all transforms in quest are mission-aligned, overall coherence increases.

#### Theorem 2.2: AQS Monotonicity with Oracle Consistency

**Statement**: If oracle ω is consistent and quest q′ strictly improves on q (same intent, better execution), then:

```
AQS(q′) > AQS(q)
```

**Proof**:

By definition of AQS:

```
AQS(q) = ω(q, σ₀, σ₁) · (1 + bonus(q))
```

Where bonus(q) accounts for:

- Coherence improvement: Δγ = γ(σ₁) - γ(σ₀)
- Pattern reuse: Leveraged existing CoMP
- Security coverage: No new vulnerabilities

If q′ improves on q:

- acc(q′) ≥ acc(q) (achieved intent better or equally)
- eff(T′) ≥ eff(T) (fewer or equal transforms)
- adp(q′) ≥ adp(q) (handled obstacles better or equally)

Then by oracle definition:

```
ω(q′) ≥ ω(q)
```

Additionally, if q′ also improves Δγ, pattern reuse, or security:

```
bonus(q′) > bonus(q)
```

Therefore:

```
AQS(q′) = ω(q′) · (1 + bonus(q′)) > ω(q) · (1 + bonus(q)) = AQS(q)
```

#### Theorem 2.3: cPOW Uniqueness

**Statement**: No two distinct quests produce identical cPOWs.

**Proof**:

cPOW includes:

```
cPOW = (q_id, timestamp, σ₀_hash, σ₁_hash, T_sequence, ω_signature)
```

Each component is unique or collision-resistant:

- **q_id**: UUID (collision probability < 10⁻¹⁸)
- **timestamp**: Millisecond precision (unique per quest)
- **σ₀_hash, σ₁_hash**: SHA-256 (collision probability < 10⁻⁷⁷)
- **T_sequence**: Transform list with unique metadata
- **ω_signature**: Oracle response with session ID

Even if two quests have same intent, they differ in:

- Timestamp (different execution time)
- Transform sequence (different agent decisions)
- Oracle signature (different session)

Therefore, cPOW collision probability is negligible (< 10⁻¹⁸).

### 3. Formal Properties

#### Property 3.1: Immutability

Once cPOW is committed to PGC:

```
∀ t > t_commit: cPOW(t) = cPOW(t_commit)
```

**Enforcement**:

- Git commit SHA locks cPOW data
- Any modification changes commit hash
- PGC lineage tracks all ancestors

#### Property 3.2: Verifiability

Any agent can verify cPOW authenticity:

```
verify(cPOW) = check_checksum(σ₀_hash) ∧
               check_checksum(σ₁_hash) ∧
               validate_oracle_signature(ω_signature) ∧
               validate_transform_chain(T)
```

**Implementation**: See [Validation API](#validation-api)

#### Property 3.3: Composability

cPOWs form a directed acyclic graph (DAG):

```
G = (V, E)
V = {cPOW₁, cPOW₂, ..., cPOWₙ}
E = {(cPOWᵢ, cPOWⱼ) | cPOWⱼ references cPOWᵢ}
```

**Properties**:

- Acyclic: No quest depends on its own future
- Traceable: Path from any cPOW to root (initial commit)
- Queryable: Find all ancestors/descendants of cPOW

---

## Operational Loop Specification

### Overview

The cPOW operational loop consists of **8 phases**:

```
1. Quest Initialization (G)
2. G→T→O Feedback Loop
3. Four-Layered Trust Boundary (F.L.T.B)
4. Commit
5. PGC Update
6. cPOW Generation
7. AQS Computation
8. Wisdom Distillation (CoMP)
```

### Phase 1: Quest Initialization (G)

**Input**: User intent (natural language)

**Process**:

1. Capture intent: `I = "implement user authentication"`
2. Load baseline coherence: `C₀ = coherence_report()`
3. Query mission context: `M = lattice("O4[principle]")`
4. Find relevant patterns: `P = patterns_search("authentication")`
5. Identify security requirements: `SR = lattice("O2 ~ O4")`

**Output**: Quest object `q = (I, C₀, M, P, SR, t_start)`

**API Call**:

```typescript
const quest = await questInit({
  intent: 'Implement user authentication with JWT',
  projectPath: '/path/to/project',
});
```

**Example**:

```json
{
  "quest_id": "q_2025_10_30_001",
  "intent": "Implement user authentication with JWT",
  "baseline_coherence": {
    "mean": 0.624,
    "high_alignment_threshold": 0.731,
    "drift_threshold": 0.524
  },
  "mission_concepts": ["zero-trust", "least-privilege", "defense-in-depth"],
  "relevant_patterns": [
    {
      "name": "JWT Authentication Flow",
      "coherence": 0.89,
      "path": ".open_cognition/operational_patterns/auth_jwt.json"
    }
  ],
  "security_requirements": [
    "Token expiration enforcement",
    "Secure key storage",
    "Rate limiting"
  ],
  "timestamp": "2025-10-30T14:32:11Z"
}
```

### Phase 2: G→T→O Feedback Loop

**Core Loop**:

```
while not quest_complete:
    1. Generate transform proposal (G → T)
    2. Apply transform to codebase (T)
    3. Oracle evaluates result (O)
    4. If O.score < threshold:
         Regenerate transform with Oracle feedback (O → G)
    5. Else:
         Continue to next transform
```

**Detailed Steps**:

#### Step 2.1: Transform Generation (G → T)

**Input**: Current state σ_current, quest intent I, Oracle feedback (if any)

**Process**:

1. Analyze current state
2. Identify next logical step
3. Generate transform proposal: `t_proposed = generate_transform(σ, I)`
4. Validate against constraints (O₂, O₅)

**Output**: Transform proposal `t_proposed`

**API Call**:

```typescript
const transform = await generateTransform({
  currentState: await captureState(),
  intent: quest.intent,
  oracleFeedback: previousFeedback,
});
```

#### Step 2.2: Transform Application (T)

**Input**: Transform `t`, current state σ

**Process**:

1. Apply file modifications
2. Update dependency graph (O₃)
3. Recompute embeddings (O₁)
4. Update coherence (O₇)

**Output**: New state σ′ = t(σ)

**API Call**:

```typescript
const newState = await applyTransform(transform);
```

#### Step 2.3: Oracle Evaluation (O)

**Input**: Quest q, before state σ₀, after state σ₁, transform t

**Process**:

1. Send to Oracle (eGemma):
   ```json
   {
     "quest_intent": q.intent,
     "before_state": summarize(σ₀),
     "after_state": summarize(σ₁),
     "transform": serialize(t)
   }
   ```
2. Oracle computes:
   - Accuracy: Did transform achieve intent?
   - Efficiency: Was it minimal?
   - Adaptability: Handled obstacles well?
3. Oracle returns: `score ∈ [0,1]` and feedback

**Output**: Oracle response `(score, feedback, session_id)`

**API Call**:

```typescript
const oracleResponse = await evaluateTransform({
  quest: quest,
  beforeState: beforeState,
  afterState: afterState,
  transform: transform,
});
```

**Example**:

```json
{
  "score": 0.78,
  "feedback": {
    "accuracy": 0.85,
    "efficiency": 0.7,
    "adaptability": 0.8,
    "suggestions": [
      "Consider adding input validation for email format",
      "Use constant-time comparison for password verification"
    ]
  },
  "session_id": "oracle_sess_2025_10_30_14_33_22",
  "timestamp": "2025-10-30T14:33:22Z"
}
```

### Phase 3: Four-Layered Trust Boundary (F.L.T.B)

Before committing, validate against **4 trust layers**:

#### Layer 1: Syntax Validation

```bash
npm run lint
npm run build
```

- Code compiles without errors
- Linting rules pass
- Type checking succeeds

#### Layer 2: Mission Alignment

```bash
cognition-cli coherence report
```

- Δγ = γ(σ₁) - γ(σ₀) ≥ 0 (no drift)
- New symbols have coherence ≥ drift_threshold
- No high-alignment symbols removed

#### Layer 3: Security Coverage

```bash
cognition-cli security coverage-gaps
```

- New code has security guidelines (O₂)
- No new attack vectors introduced
- Sacred boundaries respected

#### Layer 4: Pattern Compliance

```bash
cognition-cli patterns validate
```

- Follows established workflows (O₅)
- Reuses proven patterns
- No anti-patterns introduced

**API Call**:

```typescript
const fltbResult = await validateFLTB({
  beforeState: beforeState,
  afterState: afterState,
  quest: quest,
});

if (!fltbResult.passed) {
  throw new QuestValidationError(fltbResult.failures);
}
```

**Example Output**:

```json
{
  "passed": true,
  "layers": {
    "syntax": { "passed": true, "errors": [] },
    "alignment": {
      "passed": true,
      "coherence_delta": 0.03,
      "new_symbols_aligned": 12
    },
    "security": {
      "passed": true,
      "coverage_gaps": [],
      "new_vulnerabilities": 0
    },
    "patterns": {
      "passed": true,
      "patterns_followed": ["jwt_auth_flow"],
      "anti_patterns": []
    }
  }
}
```

### Phase 4: Commit

**Process**:

1. Stage all changes: `git add .`
2. Create descriptive commit message
3. Commit: `git commit -m "feat: implement JWT authentication"`
4. Tag with quest ID: `git tag -a quest_q_2025_10_30_001 -m "Quest complete"`

**Commit Message Format**:

```
<type>: <subject>

Quest: <quest_id>
AQS: <pending>
Coherence: <before> → <after> (Δ<delta>)

<body>

Refs: <references to patterns, security guidelines>
```

**Example**:

```
feat: implement JWT authentication

Quest: q_2025_10_30_001
AQS: pending
Coherence: 0.624 → 0.654 (Δ+0.030)

- Added JWT token generation and verification
- Implemented middleware for protected routes
- Added rate limiting for login endpoint
- Stored keys in secure environment variables

Refs:
- Pattern: jwt_auth_flow (O₅)
- Security: token_expiration, secure_key_storage (O₂)
- Mission: zero-trust, least-privilege (O₄)
```

### Phase 5: PGC Update

**Process**:

1. Capture commit SHA: `commit_sha = git rev-parse HEAD`
2. Update `.open_cognition/pgc/lineage.json`:
   ```json
   {
     "commit": "abc123...",
     "quest_id": "q_2025_10_30_001",
     "timestamp": "2025-10-30T14:45:00Z",
     "parent": "def456...",
     "transforms": 5,
     "coherence_delta": 0.03
   }
   ```
3. Update transform chain: `.open_cognition/pgc/transforms/q_2025_10_30_001.json`
4. Update overlay manifests (O₁-O₇) with new embeddings

**API Call**:

```typescript
await updatePGC({
  commitSHA: commitSHA,
  quest: quest,
  transforms: transforms,
  coherenceDelta: coherenceDelta,
});
```

### Phase 6: cPOW Generation

**Process**:

1. Collect all quest artifacts:
   - Quest metadata (intent, timing)
   - Transform sequence
   - Oracle responses
   - F.L.T.B validation results
   - Commit SHA
2. Compute checksums:
   ```typescript
   const beforeHash = sha256(serialize(beforeState));
   const afterHash = sha256(serialize(afterState));
   ```
3. Aggregate Oracle scores:
   ```typescript
   const avgOracleScore = mean(oracleResponses.map((r) => r.score));
   ```
4. Create cPOW document:
   ```json
   {
     "cpow_id": "cpow_q_2025_10_30_001",
     "quest_id": "q_2025_10_30_001",
     "intent": "Implement user authentication with JWT",
     "timestamp_start": "2025-10-30T14:32:11Z",
     "timestamp_end": "2025-10-30T14:45:00Z",
     "duration_minutes": 13,
     "commit_sha": "abc123...",
     "before_state_hash": "sha256:...",
     "after_state_hash": "sha256:...",
     "transforms": [...],
     "oracle_responses": [...],
     "fltb_validation": {...},
     "coherence": {
       "before": 0.624,
       "after": 0.654,
       "delta": 0.030
     }
   }
   ```
5. Store cPOW: `.open_cognition/pgc/cpow/cpow_q_2025_10_30_001.json`

**API Call**:

```typescript
const cpow = await generateCPOW({
  quest: quest,
  transforms: transforms,
  oracleResponses: oracleResponses,
  fltbResult: fltbResult,
  commitSHA: commitSHA,
});
```

### Phase 7: AQS Computation

**Formula**:

```
AQS = ω_avg · (1 + bonus)

where:
  ω_avg = (1/n) Σ ω_i  (average Oracle score across transforms)

  bonus = 0.2 · coherence_bonus +
          0.15 · pattern_reuse_bonus +
          0.10 · security_bonus +
          0.05 · efficiency_bonus

  coherence_bonus = min(Δγ / 0.1, 1.0)
  pattern_reuse_bonus = num_patterns_used / 5
  security_bonus = (new_security_guidelines > 0) ? 1.0 : 0.0
  efficiency_bonus = 1.0 - (num_transforms / expected_transforms)
```

**Process**:

1. Compute average Oracle score
2. Calculate coherence improvement bonus
3. Count pattern reuse
4. Check security additions
5. Evaluate efficiency
6. Compute final AQS

**API Call**:

```typescript
const aqs = await computeAQS({
  cpow: cpow,
  expectedTransforms: 8, // from similar past quests
});
```

**Example**:

```json
{
  "aqs": 0.847,
  "components": {
    "oracle_avg": 0.78,
    "bonus": 0.42,
    "breakdown": {
      "coherence_bonus": 0.3,
      "pattern_reuse_bonus": 0.15,
      "security_bonus": 0.1,
      "efficiency_bonus": 0.04
    }
  },
  "grade": "A",
  "eligible_for_comp": true
}
```

**Grading Scale**:

- A (0.85 - 1.0): Exceptional - Eligible for CoMP distillation
- B (0.70 - 0.84): Good - Solid work, reusable patterns
- C (0.50 - 0.69): Acceptable - Met requirements, room for improvement
- D (0.30 - 0.49): Poor - Needs rework
- F (0.0 - 0.29): Failed - Did not meet basic requirements

### Phase 8: Wisdom Distillation (CoMP)

**Trigger**: Only if AQS ≥ 0.70

**CoMP (Cognitive Micro-Tuning Payload)** is distilled wisdom from high-quality quests.

**Process**:

#### Step 8.1: Extract Patterns

```typescript
const patterns = extractPatterns(cpow, {
  minCoherence: 0.7,
  minReuse: 3, // pattern used ≥3 times in quest
});
```

#### Step 8.2: Generalize Context

```typescript
const generalizedContext = generalize(patterns, {
  removeProjectSpecifics: true,
  abstractDataTypes: true,
  focusOnStructure: true,
});
```

#### Step 8.3: Create CoMP Template

```json
{
  "comp_id": "comp_jwt_auth_2025_10_30",
  "source_cpow": "cpow_q_2025_10_30_001",
  "aqs": 0.847,
  "domain": "authentication",
  "pattern_name": "JWT Authentication Flow",
  "context": {
    "intent_pattern": "Implement token-based authentication",
    "preconditions": [
      "User registration exists",
      "Database for user storage",
      "Environment variables for secrets"
    ],
    "postconditions": [
      "JWT tokens issued on login",
      "Protected routes validate tokens",
      "Tokens expire after configured time"
    ]
  },
  "transforms": [
    {
      "step": 1,
      "action": "Create JWT utility module",
      "rationale": "Centralize token operations",
      "files": ["src/utils/jwt.ts"]
    },
    {
      "step": 2,
      "action": "Implement login endpoint",
      "rationale": "Issue tokens on successful authentication",
      "files": ["src/routes/auth.ts"]
    },
    {
      "step": 3,
      "action": "Create authentication middleware",
      "rationale": "Protect routes requiring authentication",
      "files": ["src/middleware/auth.ts"]
    }
  ],
  "security_considerations": [
    "Use HTTPS for token transmission",
    "Store keys in environment variables, not code",
    "Implement token expiration (e.g., 1 hour)",
    "Add rate limiting to prevent brute force"
  ],
  "mission_alignment": {
    "concepts": ["zero-trust", "least-privilege"],
    "coherence": 0.89
  },
  "reuse_count": 1,
  "last_used": "2025-10-30T14:45:00Z"
}
```

#### Step 8.4: Store in O₅ (Operational Patterns)

```bash
.open_cognition/operational_patterns/comp_jwt_auth_2025_10_30.json
```

#### Step 8.5: Update Pattern Index

```typescript
await updatePatternIndex({
  comp: comp,
  overlay: 'operational_patterns',
});
```

**API Call**:

```typescript
const comp = await distillWisdom({
  cpow: cpow,
  aqs: aqs,
});
```

**Future Reuse**:

When a new quest has similar intent:

```typescript
const relevantComps = await queryPatterns({
  intent: 'implement OAuth authentication',
  minAQS: 0.7,
  domain: 'authentication',
});
// Returns: [comp_jwt_auth_2025_10_30, comp_oauth_flow_2025_09_15, ...]
```

Agent can then:

1. Review high-AQS patterns
2. Adapt to current context
3. Reference in new quest
4. Increase pattern_reuse_bonus for new AQS

---

## API Reference

### Quest Management API

#### `questInit(options: QuestInitOptions): Promise<Quest>`

Initialize a new quest.

**Parameters**:

```typescript
interface QuestInitOptions {
  intent: string; // Natural language description
  projectPath: string; // Absolute path to project
  missionDocs?: string[]; // Optional mission document paths
  securityLevel?: 'low' | 'medium' | 'high' | 'critical';
}
```

**Returns**:

```typescript
interface Quest {
  quest_id: string;
  intent: string;
  baseline_coherence: CoherenceMetrics;
  mission_concepts: string[];
  relevant_patterns: Pattern[];
  security_requirements: string[];
  timestamp: string;
}
```

**Example**:

```typescript
const quest = await questInit({
  intent: 'Implement user authentication with JWT',
  projectPath: '/home/user/myapp',
  securityLevel: 'high',
});
```

#### `generateTransform(options: TransformOptions): Promise<Transform>`

Generate a transform proposal.

**Parameters**:

```typescript
interface TransformOptions {
  currentState: CodebaseState;
  intent: string;
  oracleFeedback?: OracleFeedback;
  constraints?: Constraint[];
}
```

**Returns**:

```typescript
interface Transform {
  transform_id: string;
  type: 'create' | 'modify' | 'delete' | 'refactor';
  files: FileOperation[];
  rationale: string;
  expected_impact: ImpactAnalysis;
}
```

#### `applyTransform(transform: Transform): Promise<CodebaseState>`

Apply transform to codebase.

**Parameters**: `Transform` object

**Returns**: New `CodebaseState` after transform

**Side Effects**: Modifies files, updates embeddings, recomputes coherence

#### `evaluateTransform(options: EvalOptions): Promise<OracleResponse>`

Send transform to Oracle for evaluation.

**Parameters**:

```typescript
interface EvalOptions {
  quest: Quest;
  beforeState: CodebaseState;
  afterState: CodebaseState;
  transform: Transform;
  oracleEndpoint?: string; // Default: eGemma workbench
}
```

**Returns**:

```typescript
interface OracleResponse {
  score: number; // 0.0 - 1.0
  feedback: {
    accuracy: number;
    efficiency: number;
    adaptability: number;
    suggestions: string[];
  };
  session_id: string;
  timestamp: string;
}
```

### Validation API

#### `validateFLTB(options: FLTBOptions): Promise<FLTBResult>`

Validate against Four-Layered Trust Boundary.

**Parameters**:

```typescript
interface FLTBOptions {
  beforeState: CodebaseState;
  afterState: CodebaseState;
  quest: Quest;
}
```

**Returns**:

```typescript
interface FLTBResult {
  passed: boolean;
  layers: {
    syntax: LayerResult;
    alignment: LayerResult;
    security: LayerResult;
    patterns: LayerResult;
  };
  failures: string[]; // If !passed
}

interface LayerResult {
  passed: boolean;
  details: Record<string, any>;
}
```

### cPOW API

#### `generateCPOW(options: CPOWOptions): Promise<CPOW>`

Generate Cognitive Proof of Work.

**Parameters**:

```typescript
interface CPOWOptions {
  quest: Quest;
  transforms: Transform[];
  oracleResponses: OracleResponse[];
  fltbResult: FLTBResult;
  commitSHA: string;
}
```

**Returns**:

```typescript
interface CPOW {
  cpow_id: string;
  quest_id: string;
  intent: string;
  timestamp_start: string;
  timestamp_end: string;
  duration_minutes: number;
  commit_sha: string;
  before_state_hash: string;
  after_state_hash: string;
  transforms: Transform[];
  oracle_responses: OracleResponse[];
  fltb_validation: FLTBResult;
  coherence: {
    before: number;
    after: number;
    delta: number;
  };
}
```

#### `verifyCPOW(cpow: CPOW): Promise<VerificationResult>`

Verify cPOW authenticity and integrity.

**Parameters**: `CPOW` object

**Returns**:

```typescript
interface VerificationResult {
  valid: boolean;
  checks: {
    checksum_before: boolean;
    checksum_after: boolean;
    oracle_signature: boolean;
    transform_chain: boolean;
    commit_exists: boolean;
  };
  errors: string[];
}
```

**Example**:

```typescript
const verification = await verifyCPOW(cpow);
if (!verification.valid) {
  console.error('cPOW verification failed:', verification.errors);
}
```

### AQS API

#### `computeAQS(options: AQSOptions): Promise<AQSResult>`

Compute Agentic Quality Score.

**Parameters**:

```typescript
interface AQSOptions {
  cpow: CPOW;
  expectedTransforms?: number; // For efficiency calculation
  weights?: {
    oracle: number; // Default: 1.0
    coherence: number; // Default: 0.2
    patternReuse: number; // Default: 0.15
    security: number; // Default: 0.10
    efficiency: number; // Default: 0.05
  };
}
```

**Returns**:

```typescript
interface AQSResult {
  aqs: number; // Final score 0.0 - 1.0
  components: {
    oracle_avg: number;
    bonus: number;
    breakdown: {
      coherence_bonus: number;
      pattern_reuse_bonus: number;
      security_bonus: number;
      efficiency_bonus: number;
    };
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  eligible_for_comp: boolean; // true if AQS ≥ 0.70
}
```

### Wisdom API

#### `distillWisdom(options: WisdomOptions): Promise<CoMP>`

Distill wisdom (CoMP) from high-quality quest.

**Parameters**:

```typescript
interface WisdomOptions {
  cpow: CPOW;
  aqs: AQSResult;
  minCoherence?: number; // Default: 0.7
  minReuse?: number; // Default: 3
}
```

**Returns**:

```typescript
interface CoMP {
  comp_id: string;
  source_cpow: string;
  aqs: number;
  domain: string;
  pattern_name: string;
  context: {
    intent_pattern: string;
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
```

#### `queryPatterns(options: PatternQuery): Promise<CoMP[]>`

Query existing patterns for reuse.

**Parameters**:

```typescript
interface PatternQuery {
  intent: string; // Natural language description
  minAQS?: number; // Default: 0.7
  domain?: string; // Filter by domain
  limit?: number; // Default: 10
}
```

**Returns**: Array of `CoMP` objects ranked by relevance

**Example**:

```typescript
const patterns = await queryPatterns({
  intent: 'implement rate limiting for API',
  minAQS: 0.8,
  domain: 'security',
  limit: 5,
});
```

### Storage API

#### `updatePGC(options: PGCUpdate): Promise<void>`

Update Provenance Graph of Cognition.

**Parameters**:

```typescript
interface PGCUpdate {
  commitSHA: string;
  quest: Quest;
  transforms: Transform[];
  coherenceDelta: number;
}
```

**Side Effects**: Updates `.open_cognition/pgc/lineage.json` and transform chain files

---

## Implementation Guide

### Setup Requirements

**Prerequisites**:

- Node.js ≥ 18.0.0
- Git repository initialized
- `.open_cognition/` directory with overlays (O₁-O₇)
- eGemma workbench connection (for Oracle)

**Environment Variables**:

```bash
export WORKBENCH_URL="https://your-egemma-instance"
export WORKBENCH_API_KEY="your-api-key"
export COGNITION_CLI_PATH="/path/to/cognition-cli"
```

### Basic Quest Execution

**Step 1: Initialize Quest**

```typescript
import { questInit } from 'cognition-cli';

const quest = await questInit({
  intent: 'Add pagination to user list API',
  projectPath: process.cwd(),
  securityLevel: 'medium',
});

console.log(`Quest ${quest.quest_id} initialized`);
console.log(`Baseline coherence: ${quest.baseline_coherence.mean}`);
```

**Step 2: Execute G→T→O Loop**

```typescript
let currentState = await captureState();
const transforms = [];
const oracleResponses = [];

while (!questComplete) {
  // Generate transform
  const transform = await generateTransform({
    currentState,
    intent: quest.intent,
    oracleFeedback: oracleResponses[oracleResponses.length - 1],
  });

  // Apply transform
  const newState = await applyTransform(transform);
  transforms.push(transform);

  // Oracle evaluation
  const oracleResp = await evaluateTransform({
    quest,
    beforeState: currentState,
    afterState: newState,
    transform,
  });
  oracleResponses.push(oracleResp);

  // Check if acceptable
  if (oracleResp.score >= 0.6) {
    currentState = newState;
    if (intentAchieved(quest.intent, currentState)) {
      questComplete = true;
    }
  } else {
    // Revert and regenerate with feedback
    await revertTransform(transform);
  }
}
```

**Step 3: Validate F.L.T.B**

```typescript
const fltbResult = await validateFLTB({
  beforeState: quest.baseline_state,
  afterState: currentState,
  quest,
});

if (!fltbResult.passed) {
  console.error('F.L.T.B validation failed:', fltbResult.failures);
  process.exit(1);
}
```

**Step 4: Commit and Generate cPOW**

```typescript
// Commit changes
await execCommand(`git add .`);
await execCommand(
  `git commit -m "feat: add pagination to user list API\n\nQuest: ${quest.quest_id}"`
);
const commitSHA = await execCommand(`git rev-parse HEAD`);

// Update PGC
await updatePGC({
  commitSHA,
  quest,
  transforms,
  coherenceDelta: currentState.coherence - quest.baseline_coherence.mean,
});

// Generate cPOW
const cpow = await generateCPOW({
  quest,
  transforms,
  oracleResponses,
  fltbResult,
  commitSHA,
});

console.log(`cPOW generated: ${cpow.cpow_id}`);
```

**Step 5: Compute AQS**

```typescript
const aqsResult = await computeAQS({
  cpow,
  expectedTransforms: 6,
});

console.log(`AQS: ${aqsResult.aqs.toFixed(3)} (Grade: ${aqsResult.grade})`);
```

**Step 6: Distill Wisdom (if eligible)**

```typescript
if (aqsResult.eligible_for_comp) {
  const comp = await distillWisdom({ cpow, aqs: aqsResult });
  console.log(`Wisdom distilled: ${comp.comp_id}`);
  console.log(`Pattern: ${comp.pattern_name}`);
}
```

### Advanced Patterns

#### Pattern 1: Quest with Security Focus

```typescript
const secureQuest = await questInit({
  intent: 'Implement file upload with virus scanning',
  projectPath: process.cwd(),
  securityLevel: 'critical',
});

// Pre-load security requirements
const securityGuidelines = await latticeQuery('O2[mitigation] ~ O4');
console.log('Security requirements:', securityGuidelines);

// Execute with security validation each step
for (const transform of transforms) {
  const securityCheck = await validateSecurity(transform);
  if (!securityCheck.passed) {
    throw new SecurityViolation(securityCheck.issues);
  }
}
```

#### Pattern 2: Quest with Pattern Reuse

```typescript
const quest = await questInit({
  intent: 'Add OAuth2 authentication',
  projectPath: process.cwd(),
});

// Query existing patterns
const existingPatterns = await queryPatterns({
  intent: quest.intent,
  minAQS: 0.8,
  domain: 'authentication',
});

console.log(`Found ${existingPatterns.length} relevant patterns`);

// Adapt highest-scoring pattern
const bestPattern = existingPatterns[0];
const adaptedTransforms = await adaptPattern(bestPattern, quest);

// Execute adapted transforms
for (const transform of adaptedTransforms) {
  await applyTransform(transform);
}
```

#### Pattern 3: Quest with Continuous Monitoring

```typescript
import { EventEmitter } from 'events';

class MonitoredQuest extends EventEmitter {
  async execute(quest: Quest) {
    this.emit('started', { quest_id: quest.quest_id });

    const transforms = [];
    for (let i = 0; i < maxTransforms; i++) {
      const transform = await generateTransform({...});
      this.emit('transform:proposed', { transform });

      const newState = await applyTransform(transform);
      this.emit('transform:applied', { transform, newState });

      const oracleResp = await evaluateTransform({...});
      this.emit('oracle:evaluated', { score: oracleResp.score });

      if (oracleResp.score < threshold) {
        this.emit('transform:rejected', { reason: oracleResp.feedback });
        continue;
      }

      transforms.push(transform);
    }

    this.emit('completed', { transforms: transforms.length });
    return transforms;
  }
}

// Usage
const monitoredQuest = new MonitoredQuest();
monitoredQuest.on('oracle:evaluated', ({ score }) => {
  console.log(`Oracle score: ${score}`);
});
await monitoredQuest.execute(quest);
```

### Error Handling

#### Common Errors

**1. Oracle Timeout**

```typescript
try {
  const oracleResp = await evaluateTransform({...}, { timeout: 30000 });
} catch (err) {
  if (err instanceof OracleTimeoutError) {
    console.warn("Oracle timeout, using fallback evaluation");
    // Use local heuristic evaluation
    const fallbackScore = await localEvaluate(transform);
  }
}
```

**2. F.L.T.B Failure**

```typescript
const fltbResult = await validateFLTB({...});
if (!fltbResult.passed) {
  // Rollback transforms
  for (const transform of transforms.reverse()) {
    await revertTransform(transform);
  }
  throw new ValidationError("F.L.T.B validation failed", fltbResult.failures);
}
```

**3. Coherence Drift**

```typescript
const currentCoherence = await computeCoherence();
if (currentCoherence < quest.baseline_coherence.mean - 0.05) {
  console.error('Significant coherence drift detected');
  // Analyze which symbols drifted
  const drifted = await getDriftedSymbols();
  console.log('Drifted symbols:', drifted);
  // Decide: revert or fix alignment
}
```

### Testing cPOW Implementation

**Unit Test Example**:

```typescript
import { describe, it, expect } from 'vitest';
import { computeAQS } from 'cognition-cli';

describe('AQS Computation', () => {
  it('should compute correct AQS with bonuses', () => {
    const cpow = createMockCPOW({
      oracle_avg: 0.8,
      coherence_delta: 0.05,
      patterns_used: 2,
      new_security: true,
      transforms: 5,
      expected_transforms: 8,
    });

    const result = computeAQS({ cpow, expectedTransforms: 8 });

    expect(result.aqs).toBeCloseTo(0.92, 2);
    expect(result.grade).toBe('A');
    expect(result.eligible_for_comp).toBe(true);
  });

  it('should not be eligible for CoMP if AQS < 0.7', () => {
    const cpow = createMockCPOW({ oracle_avg: 0.5 });
    const result = computeAQS({ cpow });

    expect(result.eligible_for_comp).toBe(false);
  });
});
```

**Integration Test Example**:

```typescript
describe('Full Quest Execution', () => {
  it('should complete quest and generate cPOW', async () => {
    const quest = await questInit({
      intent: "Add health check endpoint",
      projectPath: testProjectPath
    });

    // Execute quest (mocked Oracle)
    const transforms = await executeQuestWithMockOracle(quest);

    expect(transforms.length).toBeGreaterThan(0);

    // Validate
    const fltbResult = await validateFLTB({...});
    expect(fltbResult.passed).toBe(true);

    // Generate cPOW
    const cpow = await generateCPOW({...});
    expect(cpow.cpow_id).toMatch(/^cpow_/);

    // Verify cPOW
    const verification = await verifyCPOW(cpow);
    expect(verification.valid).toBe(true);
  });
});
```

---

## Validation and Verification

### cPOW Integrity Checks

#### Checksum Verification

Every cPOW includes SHA-256 checksums of before/after states:

```typescript
function verifyChecksums(cpow: CPOW): boolean {
  const beforeState = loadState(cpow.quest_id, 'before');
  const afterState = loadState(cpow.quest_id, 'after');

  const beforeHash = sha256(serialize(beforeState));
  const afterHash = sha256(serialize(afterState));

  return (
    beforeHash === cpow.before_state_hash && afterHash === cpow.after_state_hash
  );
}
```

#### Oracle Signature Validation

Validate Oracle responses are authentic:

```typescript
function validateOracleSignature(response: OracleResponse): boolean {
  // Oracle includes HMAC signature
  const expectedSignature = hmac_sha256(
    response.session_id + response.score + response.timestamp,
    ORACLE_SECRET_KEY
  );

  return response.signature === expectedSignature;
}
```

#### Transform Chain Validation

Ensure transform sequence is valid:

```typescript
function validateTransformChain(cpow: CPOW): boolean {
  let currentState = loadState(cpow.quest_id, 'before');

  for (const transform of cpow.transforms) {
    // Apply transform
    currentState = applyTransformPure(transform, currentState);

    // Check intermediate Oracle validation exists
    const oracleResp = cpow.oracle_responses.find(
      (r) => r.transform_id === transform.transform_id
    );

    if (!oracleResp) {
      console.error(
        `Missing Oracle response for transform ${transform.transform_id}`
      );
      return false;
    }
  }

  // Final state should match after_state_hash
  const finalHash = sha256(serialize(currentState));
  return finalHash === cpow.after_state_hash;
}
```

### Full Verification Workflow

```typescript
async function fullVerification(cpow: CPOW): Promise<VerificationResult> {
  const checks = {
    checksum_before: false,
    checksum_after: false,
    oracle_signature: false,
    transform_chain: false,
    commit_exists: false,
  };
  const errors = [];

  // 1. Verify checksums
  try {
    checks.checksum_before = verifyChecksum(cpow, 'before');
    checks.checksum_after = verifyChecksum(cpow, 'after');
  } catch (err) {
    errors.push(`Checksum verification failed: ${err.message}`);
  }

  // 2. Verify Oracle signatures
  try {
    checks.oracle_signature = cpow.oracle_responses.every(
      validateOracleSignature
    );
  } catch (err) {
    errors.push(`Oracle signature verification failed: ${err.message}`);
  }

  // 3. Verify transform chain
  try {
    checks.transform_chain = validateTransformChain(cpow);
  } catch (err) {
    errors.push(`Transform chain validation failed: ${err.message}`);
  }

  // 4. Verify commit exists
  try {
    const commitExists = await execCommand(
      `git cat-file -t ${cpow.commit_sha}`
    );
    checks.commit_exists = commitExists.trim() === 'commit';
  } catch (err) {
    errors.push(`Commit ${cpow.commit_sha} not found in repository`);
  }

  const valid = Object.values(checks).every((v) => v === true);

  return { valid, checks, errors };
}
```

---

## Storage Architecture

### Directory Structure

```
.open_cognition/
├── pgc/
│   ├── lineage.json              # Git commit lineage
│   ├── transforms/
│   │   ├── q_2025_10_30_001.json
│   │   └── q_2025_10_30_002.json
│   └── cpow/
│       ├── cpow_q_2025_10_30_001.json
│       └── cpow_q_2025_10_30_002.json
├── structural_patterns/          # O₁
│   ├── manifest.json
│   └── embeddings.bin
├── security_guidelines/          # O₂
│   ├── manifest.json
│   └── embeddings.bin
├── lineage_patterns/             # O₃
│   ├── manifest.json
│   └── embeddings.bin
├── mission_concepts/             # O₄
│   ├── manifest.json
│   └── embeddings.bin
├── operational_patterns/         # O₅
│   ├── manifest.json
│   ├── embeddings.bin
│   └── comp/
│       ├── comp_jwt_auth_2025_10_30.json
│       └── comp_pagination_2025_10_29.json
├── mathematical_proofs/          # O₆
│   ├── manifest.json
│   └── embeddings.bin
└── strategic_coherence/          # O₇
    ├── manifest.json
    └── embeddings.bin
```

### File Formats

#### lineage.json

```json
{
  "version": "1.0",
  "repository": {
    "origin": "https://github.com/user/project",
    "branch": "main"
  },
  "commits": [
    {
      "sha": "abc123...",
      "quest_id": "q_2025_10_30_001",
      "timestamp": "2025-10-30T14:45:00Z",
      "parent": "def456...",
      "transforms": 5,
      "coherence_delta": 0.03,
      "cpow_id": "cpow_q_2025_10_30_001"
    }
  ]
}
```

#### Transform File (q_2025_10_30_001.json)

```json
{
  "quest_id": "q_2025_10_30_001",
  "transforms": [
    {
      "transform_id": "t_001",
      "type": "create",
      "timestamp": "2025-10-30T14:33:00Z",
      "files": [
        {
          "path": "src/utils/jwt.ts",
          "operation": "create",
          "content_hash": "sha256:..."
        }
      ],
      "rationale": "Centralize JWT token operations",
      "oracle_score": 0.82
    }
  ]
}
```

#### cPOW File (cpow_q_2025_10_30_001.json)

```json
{
  "cpow_id": "cpow_q_2025_10_30_001",
  "version": "1.0",
  "quest": {
    "quest_id": "q_2025_10_30_001",
    "intent": "Implement user authentication with JWT"
  },
  "execution": {
    "timestamp_start": "2025-10-30T14:32:11Z",
    "timestamp_end": "2025-10-30T14:45:00Z",
    "duration_minutes": 13,
    "agent": "claude-sonnet-4",
    "transforms_count": 5
  },
  "states": {
    "before_hash": "sha256:...",
    "after_hash": "sha256:...",
    "coherence_before": 0.624,
    "coherence_after": 0.654,
    "coherence_delta": 0.03
  },
  "validation": {
    "fltb_passed": true,
    "oracle_avg_score": 0.78,
    "commit_sha": "abc123..."
  },
  "aqs": {
    "score": 0.847,
    "grade": "A",
    "components": {
      "oracle": 0.78,
      "bonus": 0.42
    }
  },
  "wisdom": {
    "comp_generated": true,
    "comp_id": "comp_jwt_auth_2025_10_30"
  }
}
```

#### CoMP File (comp_jwt_auth_2025_10_30.json)

See [Phase 8: Wisdom Distillation](#phase-8-wisdom-distillation-comp) for full format.

---

## Performance Characteristics

### Time Complexity

| Operation             | Complexity   | Notes                                  |
| --------------------- | ------------ | -------------------------------------- |
| Quest Init            | O(n)         | n = number of symbols in O₁            |
| Transform Generation  | O(1)         | LLM call, constant time                |
| Transform Application | O(m)         | m = files modified                     |
| Oracle Evaluation     | O(1)         | LLM call, constant time                |
| Coherence Computation | O(n·d)       | n = symbols, d = mission concepts      |
| F.L.T.B Validation    | O(n + m + k) | n = symbols, m = files, k = patterns   |
| cPOW Generation       | O(t)         | t = number of transforms               |
| AQS Computation       | O(t)         | t = number of transforms               |
| Wisdom Distillation   | O(t·p)       | t = transforms, p = pattern complexity |

### Space Complexity

| Data Structure             | Size                   | Notes                       |
| -------------------------- | ---------------------- | --------------------------- |
| Quest Object               | ~10 KB                 | Metadata + references       |
| Transform                  | ~5 KB                  | File operations + rationale |
| Oracle Response            | ~2 KB                  | Score + feedback            |
| cPOW Document              | ~50 KB                 | Full quest record           |
| CoMP                       | ~20 KB                 | Distilled wisdom            |
| Overlay Embeddings (O₁-O₇) | ~1 MB per 1000 symbols | 384-dim vectors             |

### Performance Benchmarks

Measured on:

- MacBook Pro M1 Max
- 32 GB RAM
- 1000-file codebase (~50K lines)

| Operation                 | Average Time | Notes                           |
| ------------------------- | ------------ | ------------------------------- |
| Quest Init                | 2.3 s        | Includes coherence baseline     |
| Transform Generation      | 8.5 s        | LLM generation time             |
| Transform Application     | 0.8 s        | File writes + embedding update  |
| Oracle Evaluation         | 6.2 s        | LLM evaluation time             |
| F.L.T.B Validation        | 12.0 s       | Includes linting, type checking |
| cPOW Generation           | 0.5 s        | Serialize and write             |
| AQS Computation           | 0.1 s        | Pure calculation                |
| Full Quest (5 transforms) | ~90 s        | End-to-end                      |

### Optimization Strategies

1. **Parallel Oracle Calls**: Evaluate multiple transforms concurrently
2. **Incremental Embeddings**: Only recompute affected symbols
3. **Cached Patterns**: Load CoMP index once, query multiple times
4. **Lazy Validation**: Skip syntax checks if commit hook already ran
5. **Streaming cPOW**: Write cPOW incrementally during quest

---

## Security Considerations

### Threat Model

#### Threat 1: cPOW Tampering

**Attack**: Attacker modifies cPOW file to inflate AQS

**Mitigation**:

- SHA-256 checksums prevent undetected modification
- Git commit SHA links cPOW to immutable history
- Oracle signature validation prevents fake Oracle responses

#### Threat 2: Oracle Manipulation

**Attack**: Attacker bypasses Oracle or provides fake responses

**Mitigation**:

- HTTPS + API key authentication for Oracle endpoint
- HMAC signatures on Oracle responses
- Audit trail of all Oracle interactions

#### Threat 3: Mission Drift

**Attack**: Attacker gradually introduces misaligned code

**Mitigation**:

- F.L.T.B Layer 2 (Mission Alignment) catches drift
- Coherence reports show historical trends
- Drift threshold alerts on significant decreases

#### Threat 4: Pattern Poisoning

**Attack**: Attacker creates high-AQS quest with malicious pattern

**Mitigation**:

- Manual review of CoMP before inclusion in O₅
- Security scanning of CoMP transforms
- Provenance tracking (source cPOW always linked)

#### Threat 5: PGC Corruption

**Attack**: Attacker corrupts `.open_cognition/` directory

**Mitigation**:

- Git-tracked PGC data (version controlled)
- Backup overlays before regeneration
- Integrity checks on overlay manifests

### Security Best Practices

1. **Protect Oracle Credentials**

   ```bash
   # Never commit API keys
   echo "WORKBENCH_API_KEY=..." >> .env
   echo ".env" >> .gitignore
   ```

2. **Verify cPOW Before Reuse**

   ```typescript
   const verification = await verifyCPOW(cpow);
   if (!verification.valid) {
     throw new Error('Untrusted cPOW');
   }
   ```

3. **Audit CoMP Provenance**

   ```typescript
   const comp = await loadCoMP(comp_id);
   const sourceCPOW = await loadCPOW(comp.source_cpow);
   console.log(`CoMP from quest by ${sourceCPOW.execution.agent}`);
   ```

4. **Monitor Coherence Trends**

   ```typescript
   const history = await getCoherenceHistory();
   const trend = linearRegression(history.map((h) => h.coherence));
   if (trend.slope < -0.01) {
     console.warn('Negative coherence trend detected');
   }
   ```

5. **Sandbox Quest Execution**

   ```typescript
   // Run quests in isolated environment
   const docker = spawnDocker({
     image: 'cognition-cli-sandbox',
     volumes: ['/project:/workspace'],
     readonly: true, // Prevent accidental writes
   });
   await docker.exec(`cognition-cli quest-start "${intent}"`);
   ```

---

## Appendices

### Appendix A: Glossary

- **AQS**: Agentic Quality Score - Quality metric for quest execution (0-1 scale)
- **cPOW**: Cognitive Proof of Work - Immutable receipt of quest completion
- **CoMP**: Cognitive Micro-Tuning Payload - Distilled wisdom from high-quality quests
- **F.L.T.B**: Four-Layered Trust Boundary - Validation gate (syntax, alignment, security, patterns)
- **G→T→O Loop**: Quest (Goal) → Transform → Oracle feedback loop
- **O₁-O₇**: Seven cognitive overlays (structural, security, lineage, mission, operational, proofs, coherence)
- **Oracle**: External AI validator (eGemma) that evaluates transform quality
- **PGC**: Provenance Graph of Cognition - Immutable lineage of code evolution
- **Quest**: Unit of development work with intent, transforms, and validation
- **Transform**: Atomic code modification (create, modify, delete, refactor)

### Appendix B: Coherence Score Interpretation

| Range       | Interpretation        | Action                                  |
| ----------- | --------------------- | --------------------------------------- |
| 0.90 - 1.00 | Exceptional alignment | Excellent candidate for CoMP extraction |
| 0.75 - 0.89 | Strong alignment      | Good code, follows mission well         |
| 0.60 - 0.74 | Moderate alignment    | Acceptable, monitor for drift           |
| 0.45 - 0.59 | Weak alignment        | Investigate, may need refactoring       |
| 0.00 - 0.44 | Misalignment          | Urgent review required, likely drift    |

### Appendix C: AQS Grading Rubric

| Grade | AQS Range   | Meaning          | Next Steps                                         |
| ----- | ----------- | ---------------- | -------------------------------------------------- |
| A     | 0.85 - 1.00 | Exceptional work | Extract CoMP, use as exemplar                      |
| B     | 0.70 - 0.84 | Good work        | Usable patterns, minor improvements possible       |
| C     | 0.50 - 0.69 | Acceptable       | Met requirements, significant room for improvement |
| D     | 0.30 - 0.49 | Poor work        | Needs substantial rework                           |
| F     | 0.00 - 0.29 | Failed           | Restart quest with different approach              |

### Appendix D: Oracle Response Interpretation

**Accuracy Component**:

- 1.0: Intent fully achieved, all acceptance criteria met
- 0.8: Intent mostly achieved, minor gaps
- 0.6: Partial achievement, significant gaps
- 0.4: Minimal progress toward intent
- 0.2: Incorrect approach, no meaningful progress

**Efficiency Component**:

- 1.0: Optimal transform sequence, no redundant steps
- 0.8: Good efficiency, minor optimization possible
- 0.6: Moderate efficiency, some redundancy
- 0.4: Inefficient, many unnecessary transforms
- 0.2: Highly inefficient, excessive complexity

**Adaptability Component**:

- 1.0: Handled all obstacles gracefully, proactive problem-solving
- 0.8: Good adaptation, recovered from issues well
- 0.6: Adequate adaptation, some struggles
- 0.4: Poor adaptation, needed significant guidance
- 0.2: Failed to adapt, couldn't overcome obstacles

### Appendix E: Transform Types

| Type     | Description                           | Example                                   |
| -------- | ------------------------------------- | ----------------------------------------- |
| create   | Add new file or symbol                | Create `src/utils/jwt.ts`                 |
| modify   | Edit existing file                    | Update `src/routes/auth.ts` to use JWT    |
| delete   | Remove file or symbol                 | Delete deprecated `src/utils/old-auth.ts` |
| refactor | Restructure without changing behavior | Extract function, rename variable         |
| test     | Add or update tests                   | Create `src/utils/jwt.test.ts`            |
| docs     | Add or update documentation           | Update `README.md` with auth flow         |

### Appendix F: Validation Gates Mapping

| Gate | Layer     | Check                  | Tool                                   |
| ---- | --------- | ---------------------- | -------------------------------------- |
| V₁   | Syntax    | TypeScript compilation | `tsc --noEmit`                         |
| V₂   | Syntax    | Linting rules          | `eslint`                               |
| V₃   | Syntax    | Formatting             | `prettier --check`                     |
| V₄   | Alignment | Coherence delta        | `cognition-cli coherence report`       |
| V₅   | Alignment | Symbol alignment       | `cognition-cli coherence aligned`      |
| V₆   | Security  | Coverage gaps          | `cognition-cli security coverage-gaps` |
| V₇   | Security  | Attack vectors         | `cognition-cli security attacks`       |
| V₈   | Security  | Boundary violations    | `cognition-cli security boundaries`    |
| V₉   | Patterns  | Workflow compliance    | `cognition-cli patterns validate`      |
| V₁₀  | Patterns  | Anti-pattern detection | `cognition-cli patterns anti`          |

### Appendix G: Example Quest Execution Trace

```
[14:32:11] Quest q_2025_10_30_001 initialized
           Intent: Implement user authentication with JWT
           Baseline coherence: 0.624

[14:32:15] Found 2 relevant patterns:
           - JWT Authentication Flow (AQS: 0.89)
           - Token Refresh Pattern (AQS: 0.82)

[14:32:20] Security requirements identified:
           - Token expiration enforcement
           - Secure key storage (environment variables)
           - Rate limiting on authentication endpoints

[14:33:00] Transform t_001 (create): src/utils/jwt.ts
           Rationale: Centralize JWT token operations

[14:33:45] Oracle evaluation: 0.82 (accuracy: 0.85, efficiency: 0.78, adaptability: 0.85)
           Feedback: "Good structure, consider adding token refresh logic"

[14:34:30] Transform t_002 (create): src/routes/auth.ts
           Rationale: Implement login endpoint issuing JWT tokens

[14:35:15] Oracle evaluation: 0.78 (accuracy: 0.80, efficiency: 0.75, adaptability: 0.80)
           Feedback: "Endpoint works, add rate limiting"

[14:36:00] Transform t_003 (modify): src/routes/auth.ts
           Rationale: Add rate limiting middleware

[14:36:40] Oracle evaluation: 0.85 (accuracy: 0.90, efficiency: 0.80, adaptability: 0.85)
           Feedback: "Excellent, security consideration addressed"

[14:37:30] Transform t_004 (create): src/middleware/auth.ts
           Rationale: Create middleware for protected routes

[14:38:15] Oracle evaluation: 0.80 (accuracy: 0.85, efficiency: 0.75, adaptability: 0.80)
           Feedback: "Good implementation, verify token expiration"

[14:39:00] Transform t_005 (create): src/utils/jwt.test.ts
           Rationale: Add comprehensive tests for JWT utilities

[14:39:50] Oracle evaluation: 0.82 (accuracy: 0.85, efficiency: 0.80, adaptability: 0.80)
           Feedback: "Good test coverage"

[14:40:30] F.L.T.B Validation started

[14:40:35] Layer 1 (Syntax): PASSED
           - TypeScript compilation: ✓
           - Linting: ✓
           - Formatting: ✓

[14:41:00] Layer 2 (Alignment): PASSED
           - Coherence: 0.624 → 0.654 (Δ+0.030)
           - New symbols aligned: 12/12
           - High-alignment symbols removed: 0

[14:41:30] Layer 3 (Security): PASSED
           - Coverage gaps: 0
           - New vulnerabilities: 0
           - Boundaries respected: ✓

[14:42:00] Layer 4 (Patterns): PASSED
           - Workflows followed: jwt_auth_flow
           - Anti-patterns detected: 0

[14:42:10] F.L.T.B Validation: PASSED

[14:42:15] Creating git commit...
[14:42:20] Commit: abc123... "feat: implement JWT authentication"

[14:42:25] Updating PGC...
[14:42:30] PGC updated: lineage.json, transforms/q_2025_10_30_001.json

[14:42:35] Generating cPOW...
[14:42:40] cPOW generated: cpow_q_2025_10_30_001

[14:42:45] Computing AQS...
[14:42:50] AQS: 0.847 (Grade: A)
           - Oracle avg: 0.78
           - Coherence bonus: 0.30
           - Pattern reuse bonus: 0.15
           - Security bonus: 0.10
           - Efficiency bonus: 0.04

[14:42:55] Eligible for wisdom distillation (AQS ≥ 0.70)

[14:43:00] Distilling wisdom...
[14:43:10] CoMP generated: comp_jwt_auth_2025_10_30
           Pattern: "JWT Authentication Flow"
           Domain: authentication
           Reuse count: 1

[14:43:15] Quest complete!
           Duration: 13 minutes
           Transforms: 5
           Final coherence: 0.654
           AQS: 0.847 (A)
           Wisdom extracted: Yes
```

### Appendix H: References

1. **Lattice Algebra Theory**: See `docs/LATTICE_ALGEBRA.md`
2. **Overlay Architecture**: See `docs/OVERLAYS.md`
3. **Quest Workflows**: See `docs/QUESTS.md`
4. **Testing Guide**: See `TESTING.md`
5. **Security Checklist**: See `SECURITY_CHECKLIST.md`
6. **Claude Commands**: See `.claude/commands/README.md`

### Appendix I: Change Log

**Version 1.0** (2025-10-30)

- Initial cPOW reference manual
- Formal mathematical foundations
- Complete API reference
- Implementation guide with examples
- Security considerations
- Performance benchmarks

---

## Next Chapter

**[Chapter 21: Advanced Quest Patterns →](./21-advanced-patterns.md)**

Learn advanced quest patterns, optimization strategies, and production deployment techniques.

---

**Part V — cPOW Operational Loop**<br/>
**Chapter 20 — cPOW Reference Manual**<br/>
**Status**: Pre-Release Documentation<br/>
**License**: AGPL-3.0-or-later
