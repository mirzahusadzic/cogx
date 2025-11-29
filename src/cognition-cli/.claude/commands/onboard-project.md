# Onboard New Project to Cognition CLI

Welcome! Let's create strategic documentation for your project that will be properly ingested into the Grounded Context Pool (PGC).

---

## CRITICAL: Large Codebase Strategy

**Before reading any source files, you MUST assess codebase size.**

### Step 0: Assess Codebase Size

```bash
# Count total indexed files
ls .open_cognition/index/*.json 2>/dev/null | wc -l
```

### Decision Threshold

| File Count | Strategy                                          |
| ---------- | ------------------------------------------------- |
| ≤50 files  | Read source files directly for full understanding |
| >50 files  | **USE INDEX FILES ONLY** - Never read raw sources |

### For Large Codebases (>50 files): Index-Based Analysis

**You MUST use the pre-processed AST index files in `.open_cognition/index/`**

These JSON files contain structured representations of each source file:

```json
{
  "path": "src/commands/tui.ts",
  "structuralData": {
    "language": "typescript",
    "docstring": "File-level documentation...",
    "imports": ["path", "../core/workspace-manager.js"],
    "classes": [{ "name": "ClassName", "docstring": "...", "methods": [...] }],
    "functions": [{ "name": "funcName", "docstring": "...", "params": [...], "returns": "..." }],
    "interfaces": [{ "name": "InterfaceName", "properties": [...] }],
    "exports": ["exportedName1", "exportedName2"],
    "dependencies": ["dep1", "dep2"]
  }
}
```

### Building Codebase Summary from Index

Execute these commands to build a compact understanding:

```bash
# 1. Get directory distribution (understand subsystem structure)
ls .open_cognition/index/*.json | sed 's/_/\//g' | sed 's/\.json$//' | xargs -I{} dirname {} | sort | uniq -c | sort -rn | head -20

# 2. Find key entry points (files with many exports)
for f in .open_cognition/index/*.json; do
  exports=$(jq -r '.structuralData.exports | length' "$f" 2>/dev/null)
  if [ "$exports" -gt 3 ]; then
    echo "$exports $(jq -r '.path' "$f")"
  fi
done | sort -rn | head -15

# 3. Extract all exported symbols (understand API surface)
jq -r '.structuralData.exports[]?' .open_cognition/index/*.json | sort -u | head -50

# 4. Find files with docstrings (understand documented modules)
for f in .open_cognition/index/*.json; do
  doc=$(jq -r '.structuralData.docstring // empty' "$f" 2>/dev/null)
  if [ -n "$doc" ]; then
    path=$(jq -r '.path' "$f")
    echo "=== $path ==="
    echo "$doc" | head -5
    echo ""
  fi
done | head -100

# 5. Get interface/type definitions (understand data models)
jq -r '.structuralData.interfaces[]? | "interface \(.name): \(.properties | map(.name) | join(", "))"' .open_cognition/index/*.json 2>/dev/null | head -30

# 6. Get class hierarchy (understand architecture)
jq -r '.structuralData.classes[]? | "class \(.name): \(.methods | map(.name) | join(", "))"' .open_cognition/index/*.json 2>/dev/null | head -30
```

### What You Learn from Index Files

| Index Field                 | Insight                             |
| --------------------------- | ----------------------------------- |
| `structuralData.docstring`  | Module purpose and design rationale |
| `structuralData.imports`    | Dependencies and coupling           |
| `structuralData.exports`    | Public API surface                  |
| `structuralData.classes`    | Object-oriented architecture        |
| `structuralData.functions`  | Procedural/functional architecture  |
| `structuralData.interfaces` | Data contracts and type definitions |
| `path` directory structure  | Subsystem organization              |

### Example: Compact Summary for LLM Context (~2KB vs 500KB+ raw)

After running the above commands, synthesize a summary like:

```
CODEBASE SUMMARY (cognition-cli)
================================
Total files: 127 across 8 subsystems

SUBSYSTEMS:
- src/commands/ (25 files): CLI command implementations
- src/core/ (32 files): Core orchestrators and services
- src/tui/ (18 files): Terminal UI components
- src/sigma/ (22 files): Conversation memory system
- src/llm/ (8 files): LLM provider abstractions

KEY ENTRY POINTS:
- src/cli.ts: Main CLI entry, exports registerCommands
- src/tui/index.tsx: TUI entry, exports startTUI
- src/core/workspace-manager.ts: PGC workspace management

CORE INTERFACES:
- TUIOptions: sessionId, projectRoot, provider, model
- OverlayProgress: phase, overlayType, message, current, total
- WorkbenchConfig: url, apiKey, timeout

ARCHITECTURE PATTERNS:
- Command pattern for CLI (src/commands/*.ts)
- React/Ink for TUI (src/tui/components/*.tsx)
- Provider pattern for LLM (src/llm/providers/*.ts)
```

**Use this compact summary to guide documentation co-creation, NOT raw source files.**

---

## What This Does

This command guides you through creating:

1. **VISION.md** - Your strategic foundation (O4 Mission Concepts)
2. **CODING_PRINCIPLES.md** - Your development philosophy (O4 Mission Concepts)
3. **SECURITY.md** (optional) - Threat models and security guidelines (O2 Security)
4. **MATHEMATICAL.md** (optional) - Formal proofs and invariants (O6 Mathematical)
5. **OPERATIONAL.md** (optional) - Workflows, quests, and depth rules (O5 Operational)

---

## CRITICAL: Extraction Patterns

The concept extractor uses **6 structural patterns** to identify important content. You MUST use these exact formatting patterns or your concepts will not be extracted.

### Pattern 1: Blockquote Essence (Weight: 1.0)

**Format**: `> _Your one-sentence essence._`

**CORRECT**:

```markdown
> _Democratize LLM training by providing a complete, affordable implementation._
```

**WRONG** (will not extract):

```markdown
> Democratize LLM training... (missing italics)
> _Democratize LLM training..._ (missing blockquote)
```

### Pattern 2: Named Concept Headers (Weight: 0.95)

**Format**: `### N. Concept Name` (H3 headers only)

**CORRECT**:

```markdown
### 1. Simplicity Over Abstraction

### 2. Fail Fast, Fail Loud
```

**WRONG** (will not extract):

```markdown
## 1. Simplicity Over Abstraction (H2, wrong level)

**1. Simplicity Over Abstraction** (not a header)
```

### Pattern 3: Value Proposition Bullets (Weight: 0.9)

**Format**: `- **Bold text** — context after em-dash`

**CORRECT**:

```markdown
- **AI reasoning is grounded in cryptographic truth** — anchoring intelligence in verifiable facts
- **Human cognition is augmented by provable insights** — not statistical approximations
```

**WRONG** (will not extract):

```markdown
- AI reasoning is grounded... (missing bold)
- **AI reasoning** - context (hyphen, not em-dash —)
- **AI reasoning**, context (comma, not em-dash)
```

### Pattern 4: Bold Complete Sentences (Weight: 0.85)

**Format**: `**Complete sentence ending with punctuation.**`

**CORRECT**:

```markdown
**Our mission is to establish verifiable AI-human symbiosis.**

**This is not a framework. This is a working implementation.**
```

**WRONG** (will not extract):

```markdown
Our **mission** is to establish... (bold word, not sentence)
**Our mission is to establish symbiosis** (missing period)
```

### Pattern 5: Emoji-Prefixed Items (Weight: 0.8)

**Format**: `- [emoji] **Bold text** — explanation`

Supported emojis: ✅ ❌ ✓ ✗ ⚠️

**CORRECT**:

```markdown
- ✅ **Radical Affordability** — Achieve GPT-2 level performance for ~$100
- ❌ **Prohibitive Cost** — Training requires millions of dollars
```

**WRONG** (will not extract):

```markdown
- ✅ Radical Affordability — ... (missing bold)
- ✅ **Radical Affordability** ... (missing em-dash)
  ✅ **Radical Affordability** — ... (missing bullet)
```

### Pattern 6: Quoted Terms (Weight: 0.75)

**Format**: `"term at least 15 characters"`

**CORRECT**:

```markdown
The result is "verifiable AI-human symbiosis" grounded in truth.
We call this "Chinchilla-optimal training" because it maximizes efficiency.
```

**WRONG** (will not extract):

```markdown
The result is "symbiosis" (too short, <15 chars)
What does "this mean?" (questions are skipped)
```

---

## Step 1: Understanding Your Project

Before we create documentation, answer these questions:

1. **What is your project called?**
2. **What problem does it solve?** (The "why")
3. **What is your core solution?** (The "what")
4. **What are your 3-5 core principles?** (Your non-negotiables)
5. **What makes your approach unique?**
6. **Who benefits from this project?**

---

## Step 2: VISION.md Template

Copy this EXACT structure. Modify only the content, not the formatting:

```markdown
# [Project Name]

> _[One sentence essence - must be 15+ characters, captures core mission]_

## The Vision

[2-3 paragraphs explaining WHY this project exists. Use narrative prose.]

**[Bold emphatic statement about your mission ending with period.]**

**[Second bold emphatic statement if needed.]**

## The Problem

Current state analysis:

- ❌ **[Problem 1]** — [Why this is an issue, specific impact]
- ❌ **[Problem 2]** — [Why this is an issue, specific impact]
- ❌ **[Problem 3]** — [Why this is an issue, specific impact]
- ❌ **[Problem 4]** — [Why this is an issue, specific impact]
- ❌ **[Problem 5]** — [Why this is an issue, specific impact]

## The Solution

[Project name]'s approach:

- ✅ **[Solution 1]** — [How you address it, concrete benefit]
- ✅ **[Solution 2]** — [How you address it, concrete benefit]
- ✅ **[Solution 3]** — [How you address it, concrete benefit]
- ✅ **[Solution 4]** — [How you address it, concrete benefit]
- ✅ **[Solution 5]** — [How you address it, concrete benefit]

## Core Principles

### 1. [Principle Name]

**[Emphatic statement about this principle ending with period.]**

[1-2 paragraphs explaining what this means and why it matters]

### 2. [Principle Name]

**[Emphatic statement about this principle ending with period.]**

[1-2 paragraphs explaining what this means and why it matters]

### 3. [Principle Name]

**[Emphatic statement about this principle ending with period.]**

[1-2 paragraphs explaining what this means and why it matters]

### 4. [Principle Name]

**[Emphatic statement about this principle ending with period.]**

[1-2 paragraphs explaining what this means and why it matters]

### 5. [Principle Name]

**[Emphatic statement about this principle ending with period.]**

[1-2 paragraphs explaining what this means and why it matters]

## Strategic Intent

**[Bold statement about long-term goals ending with period.]**

What success looks like:

- [Concrete outcome 1]
- [Concrete outcome 2]
- [Concrete outcome 3]
- [Concrete outcome 4]
- [Concrete outcome 5]

## Who Benefits

- **[Audience 1]** [how they benefit]
- **[Audience 2]** [how they benefit]
- **[Audience 3]** [how they benefit]

## Long-Term Vision

**[Bold aspirational statement ending with period.]**

The path forward:

1. [Milestone 1]
2. [Milestone 2]
3. [Milestone 3]
4. [Milestone 4]
```

---

## Step 3: CODING_PRINCIPLES.md Template

```markdown
# Coding Principles

> _[One sentence philosophy - must be 15+ characters]_

## Philosophy

**[Core belief about how code should be written ending with period.]**

[1-2 paragraphs elaborating on the philosophy]

**[Second emphatic statement if needed.]**

## Principles

### 1. [Principle Name]

**[Emphatic statement ending with period.]**

[Explanation paragraph]

What this means:

- ✅ **[Practice 1]** — [Why we do it]
- ✅ **[Practice 2]** — [Why we do it]
- ✅ **[Practice 3]** — [Why we do it]
- ❌ **[Anti-pattern 1]** — [Why we avoid it]
- ❌ **[Anti-pattern 2]** — [Why we avoid it]

### 2. [Principle Name]

**[Emphatic statement ending with period.]**

[Explanation paragraph]

What this means:

- ✅ **[Practice 1]** — [Why we do it]
- ✅ **[Practice 2]** — [Why we do it]
- ❌ **[Anti-pattern 1]** — [Why we avoid it]
- ❌ **[Anti-pattern 2]** — [Why we avoid it]

### 3. [Principle Name]

**[Emphatic statement ending with period.]**

[Explanation paragraph]

Practices:

- ✅ **[Practice 1]** — [Why we do it]
- ✅ **[Practice 2]** — [Why we do it]
- ❌ **[Anti-pattern 1]** — [Why we avoid it]

### 4. [Principle Name]

**[Emphatic statement ending with period.]**

[Explanation paragraph]

### 5. [Principle Name]

**[Emphatic statement ending with period.]**

[Explanation paragraph]

## Practices

### Things We Do

- ✅ **[Practice 1]** — [Why we do it]
- ✅ **[Practice 2]** — [Why we do it]
- ✅ **[Practice 3]** — [Why we do it]
- ✅ **[Practice 4]** — [Why we do it]
- ✅ **[Practice 5]** — [Why we do it]

### Things We Avoid

- ❌ **[Anti-pattern 1]** — [Why we avoid it]
- ❌ **[Anti-pattern 2]** — [Why we avoid it]
- ❌ **[Anti-pattern 3]** — [Why we avoid it]
- ❌ **[Anti-pattern 4]** — [Why we avoid it]
- ❌ **[Anti-pattern 5]** — [Why we avoid it]

## Code Quality Standards

### [Category 1]

- **[Standard 1]** — [Details]
- **[Standard 2]** — [Details]
- **[Standard 3]** — [Details]

### [Category 2]

- **[Standard 1]** — [Details]
- **[Standard 2]** — [Details]
- **[Standard 3]** — [Details]

## Summary

**[Final emphatic summary statement ending with period.]**

[Closing paragraph]
```

---

## Step 4: SECURITY.md Template

**IMPORTANT**: Security documents use different patterns. Use colons (`:`) for assets/boundaries, NOT em-dashes, to prevent misclassification as attack vectors.

```markdown
# Security Guidelines

> _[One sentence security philosophy - must be 15+ characters]_

## Security Philosophy

**[Core security belief ending with period.]**

[1-2 paragraphs explaining the security approach]

**[Statement about what you protect against and what you don't.]**

## Threat Model

### Assets

Critical assets requiring protection:

- **[Asset 1]**: [What it is and why it matters]
- **[Asset 2]**: [What it is and why it matters]
- **[Asset 3]**: [What it is and why it matters]
- **[Asset 4]**: [What it is and why it matters]
- **[Asset 5]**: [What it is and why it matters]

### Threats

**Threat**: [Threat Name]
**Severity**: [CRITICAL/HIGH/MEDIUM/LOW]
**Attack Vector**: [How the attack is executed - specific method]
**Impact**: [What damage could occur - specific consequences]
**Mitigation**:

- [Mitigation step 1]
- [Mitigation step 2]
- [Mitigation step 3]

**Outstanding Risks**:

- [Gap 1 that remains]
- [Gap 2 that remains]

---

**Threat**: [Threat Name]
**Severity**: [CRITICAL/HIGH/MEDIUM/LOW]
**Attack Vector**: [How the attack is executed]
**Impact**: [What damage could occur]
**Mitigation**:

- [Mitigation step 1]
- [Mitigation step 2]

**Outstanding Risks**:

- [Gap 1]
- [Gap 2]

---

**Threat**: [Threat Name]
**Severity**: [CRITICAL/HIGH/MEDIUM/LOW]
**Attack Vector**: [How the attack is executed]
**Impact**: [What damage could occur]
**Mitigation**:

- [Mitigation step 1]

**Outstanding Risks**:

- [Gap 1]

## Security Boundaries

### Boundary 1: [Boundary Name]

**Constraint**: [What is restricted]
**Enforcement**: [How it is enforced]
**Exception**: [What bypasses exist]

### Boundary 2: [Boundary Name]

**Constraint**: [What is restricted]
**Enforcement**: [How it is enforced]
**Exception**: [What bypasses exist]

### Boundary 3: [Boundary Name]

**Constraint**: [What is restricted]
**Enforcement**: [How it is enforced]
**Exception**: [What bypasses exist]

## Known Vulnerabilities

### CVE-[PROJECT]-001: [Vulnerability Name]

**Component**: [affected component]
**Severity**: [CRITICAL/HIGH/MEDIUM/LOW]
**Description**: [What the vulnerability is and how it can be exploited]
**Affected Versions**: [version range]
**Mitigation**: [How to fix or work around]
**Status**: [OPEN/FIXED/ACCEPTED_RISK]

### CVE-[PROJECT]-002: [Vulnerability Name]

**Component**: [affected component]
**Severity**: [CRITICAL/HIGH/MEDIUM/LOW]
**Description**: [What the vulnerability is]
**Affected Versions**: [version range]
**Mitigation**: [How to fix]
**Status**: [OPEN/FIXED/ACCEPTED_RISK]

## Security Requirements

### [Category 1] Requirements

**Implemented:**

- [Requirement 1 that is done]
- [Requirement 2 that is done]
- [Requirement 3 that is done]

**Outstanding Gaps:**

- [Requirement 1 not yet done]
- [Requirement 2 not yet done]

### [Category 2] Requirements

**Implemented:**

- [Requirement 1]
- [Requirement 2]

**Outstanding Gaps:**

- [Gap 1]
- [Gap 2]

## Deployment Recommendations

### [Use Case 1]

[When to use this configuration]

- [Recommendation 1]
- [Recommendation 2]
- [Recommendation 3]

### [Use Case 2]

[When to use this configuration]

- [Recommendation 1]
- [Recommendation 2]

## Incident Response

### If [Incident Type 1] Detected

Immediate Actions:

1. [Action 1]
2. [Action 2]
3. [Action 3]
4. [Action 4]

### If [Incident Type 2] Detected

Immediate Actions:

1. [Action 1]
2. [Action 2]
3. [Action 3]

---

**[Final security statement ending with period.]**
```

---

## Step 5: MATHEMATICAL.md Template (Optional)

For projects with formal verification needs:

````markdown
# Mathematical Properties

> _[One sentence about formal grounding - must be 15+ characters]_

## Overview

[Paragraph explaining why formal properties matter for this project]

## Theorems

### Theorem 1: [Theorem Name]

**THEOREM**: [Formal statement of what is being proven]

**Formal Notation**: [Mathematical notation if applicable]

```
∀ x, y ∈ Set: P(x) ⟹ Q(y)
```

**PROOF**:

1. [Proof step 1]
2. [Proof step 2]
3. [Proof step 3]
4. [Therefore conclusion]

**Assumptions**:

- [Assumption 1]
- [Assumption 2]

---

### Theorem 2: [Theorem Name]

**THEOREM**: [Formal statement]

**PROOF**:

1. [Step 1]
2. [Step 2]
3. [Conclusion]

## Lemmas

### Lemma 1: [Lemma Name]

**LEMMA**: [Supporting statement used in larger proofs]

**PROOF**: [Brief proof or reference to theorem]

## Invariants

### Invariant 1: [Invariant Name]

**INVARIANT**: [Property that always holds]

```
∀ state ∈ System: P(state) = true
```

**Enforcement**: [How the invariant is maintained]

**Violations to Watch**:

- [Condition that would violate]
- [Another condition]

### Invariant 2: [Invariant Name]

**INVARIANT**: [Property that always holds]

**Enforcement**: [How maintained]

## Complexity Bounds

### [Algorithm/Function Name]

**COMPLEXITY**: O([time complexity])
**SPACE**: O([space complexity])
**WHERE**: [variable definitions]
**PROOF**: [Brief justification]

### [Algorithm/Function Name]

**COMPLEXITY**: O([complexity])
**PROOF**: [Justification]

## Axioms

### Axiom 1: [Axiom Name]

**AXIOM**: [Foundational assumption accepted without proof]

**Justification**: [Why this is a reasonable assumption]
````

---

## Step 6: OPERATIONAL.md Template (Optional)

For projects with defined workflows, quests, or operational procedures:

```markdown
# Operational Patterns

> _[One sentence about operational philosophy - must be 15+ characters]_

## Overview

[Paragraph explaining why operational patterns matter for this project]

**[Emphatic statement about operational discipline ending with period.]**

## Terminology

**Quest** — A bounded unit of work with clear success criteria
**Oracle** — Source of truth for decision-making
**Scribe** — Recorder of operational state
**Depth** — Level of detail in operational tracking (0=high-level, 2=granular)
**AQS** — Agentic Quality Score measuring operational effectiveness

## Sacred Sequences

### F.L.T.B (Format, Lint, Test, Build)

**This sequence is invariant and must never be violated.**

The sacred sequence ensures code quality at every commit:

1. **Format** — Apply consistent code formatting
2. **Lint** — Check for code quality issues
3. **Test** — Run all tests to verify correctness
4. **Build** — Compile and verify build succeeds

**All four steps must pass before any commit is accepted.**

### [Custom Sacred Sequence Name]

**[Why this sequence is invariant.]**

1. **[Step 1]** — [What it does]
2. **[Step 2]** — [What it does]
3. **[Step 3]** — [What it does]

## Quest Structures

### Quest: [Quest Name]

**What**: [Clear description of what needs to be accomplished]

**Why**: [Motivation and business value]

**Success Criteria**:

- [Criterion 1 - measurable outcome]
- [Criterion 2 - measurable outcome]
- [Criterion 3 - measurable outcome]

**Big Blocks**: [Major obstacles or dependencies]

**Eyes Go**: [Where to look for guidance]

### Quest: [Quest Name]

**What**: [Description]

**Why**: [Motivation]

**Success Criteria**:

- [Criterion 1]
- [Criterion 2]

## Depth Rules

Depth 0: Strategic decisions and architectural choices
Depth 1: Implementation planning and task breakdown
Depth 2: Line-by-line execution and debugging

### Depth Transitions

**Depth increases when blocking issues require detailed investigation.**

**Depth decreases when patterns emerge and can be abstracted.**

- ✅ **Rebalancing** — Periodically review depth and adjust
- ❌ **Depth lock** — Staying at wrong depth wastes resources

## Workflow Patterns

### [Pattern Name]

**[Bold statement about when to use this pattern.]**

[Explanation of the pattern]

Triggers:

- [When to apply this pattern]
- [Another trigger condition]

Actions:

- [Step 1]
- [Step 2]
- [Step 3]

### [Pattern Name]

**[Bold statement about the pattern.]**

[Explanation]

## Metrics

### Agentic Quality Score (AQS)

AQS = (Completion × Correctness × Coherence) / Time

**Components**:

- **Completion** — Percentage of quest criteria met
- **Correctness** — Accuracy of implementation
- **Coherence** — Alignment with mission principles
- **Time** — Efficiency of execution

### [Custom Metric Name]

**Formula**: [metric formula]

**Purpose**: [Why this metric matters]

## Operational Boundaries

### [Boundary Name]

**Constraint**: [What is restricted]
**Enforcement**: [How violations are detected]
**Recovery**: [What to do when violated]
```

---

## Step 7: Ingesting Documents

Once you've created your documentation:

```bash
# Initialize PGC if not already done
cognition-cli init

# Ingest your strategic documents
cognition-cli genesis:docs docs/VISION.md
cognition-cli genesis:docs docs/CODING_PRINCIPLES.md

# Ingest security docs (if created)
cognition-cli genesis:docs docs/SECURITY.md

# Ingest mathematical docs (if created)
cognition-cli genesis:docs docs/MATHEMATICAL.md

# Ingest operational docs (if created)
cognition-cli genesis:docs docs/OPERATIONAL.md

# Or ingest entire docs directory
cognition-cli genesis:docs docs/
```

---

## Step 8: Verify Ingestion

Check that your documents were ingested successfully:

```bash
# Check PGC status
cognition-cli status

# View mission concepts
cognition-cli concepts list

# Check coherence
cognition-cli coherence report
```

---

## Quality Metrics (Oracle Validation)

Your VISION.md should achieve these metrics:

- ✅ **Concept Count**: 20-30 concepts (not too sparse, not too noisy)
- ✅ **Extraction Ratio**: 10-20% of document (focused extraction)
- ✅ **Fragment Ratio**: <10% generic fragments (high quality)
- ✅ **Top Concept Weight**: Average ≥ 0.7 (strong signal)
- ✅ **Alignment Quality**: 70-85% similarity (clean concepts)

If your metrics are off:

- **Too few concepts (<20)**: Add more bold statements, emoji bullets, H3 headers
- **Too many concepts (>50)**: Remove redundant points, strengthen signal
- **Low weights (<0.5)**: Ensure you're using exact patterns above
- **High fragments**: Use complete sentences, avoid short phrases

---

## Common Mistakes That Break Ingestion

### Wrong Dash Character

```markdown
❌ - **Text** - explanation (hyphen-minus, ASCII 45)
✅ - **Text** — explanation (em-dash, Unicode 2014)
```

**Tip**: Copy the em-dash from this document: —

### Missing Bold on Prefixes

```markdown
❌ - ✅ Radical Affordability — explanation
✅ - ✅ **Radical Affordability** — explanation
```

### H2 Instead of H3 for Principles

```markdown
❌ ## 1. Simplicity Over Abstraction
✅ ### 1. Simplicity Over Abstraction
```

### Bold Words Instead of Sentences

```markdown
❌ Our **mission** is to establish symbiosis.
✅ **Our mission is to establish symbiosis.**
```

### Blockquote Without Italics

```markdown
❌ > One sentence essence
✅ > _One sentence essence_
```

### Security Assets with Em-Dash (Gets Classified as Attack Vector)

```markdown
❌ - **Host Filesystem** — training data that could be deleted
✅ - **Host Filesystem**: training data that could be deleted
```

---

## Pattern Reference Card

| Pattern       | Format                    | Weight |
| ------------- | ------------------------- | ------ |
| Blockquote    | `> _text_`                | 1.0    |
| H3 Header     | `### N. Name`             | 0.95   |
| Bullet Prefix | `- **Bold** — context`    | 0.9    |
| Bold Sentence | `**Sentence.**`           | 0.85   |
| Emoji Item    | `- ✅ **Bold** — context` | 0.8    |
| Quoted Term   | `"15+ char term"`         | 0.75   |

---

## Next Steps

1. **Answer the questions** in Step 1
2. **Copy the templates** exactly (don't modify structure)
3. **Fill in your content** (modify only the bracketed placeholders)
4. **Create the files** in your project's `docs/` directory
5. **Run ingestion**: `cognition-cli genesis:docs docs/`
6. **Verify**: `cognition-cli concepts list`

---

## Need Help?

- **Ingestion issues**: Run `cognition-cli genesis:docs --help`
- **Pattern not extracting**: Check your formatting matches the "CRITICAL: Extraction Patterns" section above exactly
- **Low concept count**: Add more H3 numbered headers, bold sentences, and emoji bullets
- **Wrong classification**: For security docs, use colons (`:`) not em-dashes (`—`) for assets

**Verify Extracted Content**:

- `cognition-cli concepts list` — O4 Mission concepts (VISION.md, CODING_PRINCIPLES.md)
- `cognition-cli security list` — O2 Security threats and boundaries (SECURITY.md)
- `cognition-cli proofs list` — O6 Mathematical theorems and invariants (MATHEMATICAL.md)
- `cognition-cli workflow patterns` — O5 Operational patterns (OPERATIONAL.md)
- `cognition-cli coherence report` — Check alignment across overlays

**Quick Pattern Checklist**:

- [ ] Blockquote essence: `> _text_` (italic inside blockquote)
- [ ] H3 headers: `### 1. Name` (numbered, H3 level only)
- [ ] Emoji bullets: `- ✅ **Bold** — context` (em-dash, not hyphen)
- [ ] Bold sentences: `**Complete sentence.**` (ends with punctuation)
- [ ] Quoted terms: `"at least 15 characters"` (minimum length)

Let's get started! Share your answers to the questions in Step 1, and I'll help you create your strategic documentation.
