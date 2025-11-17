# 🚀 Onboard New Project to Cognition CLI

Welcome! Let's create the strategic documentation for your project so it can be ingested into the Grounded Context Pool (PGC).

## What This Does

This command guides you through creating:

1. **VISION.md** - Your strategic foundation (O₄ Mission Concepts)
2. **CODING_PRINCIPLES.md** - Your development philosophy (O₄ Mission Concepts)
3. **SECURITY.md** (optional) - Threat models and security guidelines (O₂ Security)

These documents will be ingested via `cognition-cli genesis:docs` to enable:

- Mission-driven development with `/quest-start`
- Coherence analysis with `/coherence`
- Pattern discovery with `/find-pattern`
- Security validation with `/security-check`

---

## Step 1: Understanding Your Project

Before we create documentation, let me understand your project:

**Please answer these questions:**

1. **What is your project called?**
2. **What problem does it solve?** (The "why")
3. **What is your core solution?** (The "what")
4. **What are your 3-5 core principles?** (Your non-negotiables)
5. **What makes your approach unique?**
6. **Who benefits from this project?**

Take your time - these answers will shape your strategic documentation.

---

## Step 2: Creating VISION.md

Based on your answers, I'll help you create a VISION.md file that follows the optimal extraction patterns.

### Pattern-Optimized Structure

Your VISION.md should follow this structure to maximize concept extraction quality:

```markdown
# [Project Name]

> _[One sentence essence - your core mission]_

## The Vision

[2-3 paragraphs explaining WHY this project exists]

**[Bold emphatic statement about your mission].**

## The Problem

Current state analysis:

- ❌ **[Problem 1]** — [Why this is an issue]
- ❌ **[Problem 2]** — [Why this is an issue]
- ❌ **[Problem 3]** — [Why this is an issue]

## The Solution

Your approach:

- ✅ **[Solution principle 1]** — [How you address it]
- ✅ **[Solution principle 2]** — [How you address it]
- ✅ **[Solution principle 3]** — [How you address it]

## Core Principles

### 1. [Principle Name]

[Explanation of what this means]

### 2. [Principle Name]

[Explanation of what this means]

### 3. [Principle Name]

[Explanation of what this means]

## Strategic Intent

**[Bold statement about long-term goals].**

What success looks like:

- [Outcome 1]
- [Outcome 2]
- [Outcome 3]
```

### Why This Structure?

This format uses **6 proven extraction patterns** from O₄ Mission Concepts:

1. **Blockquote (weight: 1.0)** - `> _essence_` captures your core mission
2. **Bold sentences (weight: 0.85)** - `**Complete thought.**` for emphatic statements
3. **Value proposition bullets (weight: 0.9)** - `- **Prefix** — context` for structured claims
4. **Named concept headers (weight: 0.95)** - `### Concept Name` for principles
5. **Emoji-prefixed items (weight: 0.8)** - `✅/❌ **text** — explanation` for problems/solutions
6. **Quoted terms (weight: 0.75)** - `"terminology"` for domain-specific concepts

These patterns ensure high-quality concept extraction (target: 20-30 concepts, 70-85% alignment).

---

## Step 3: Creating CODING_PRINCIPLES.md

After VISION.md, let's document your development philosophy:

```markdown
# Coding Principles

> _[One sentence about your development philosophy]_

## Philosophy

**[Core belief about how code should be written].**

## Principles

### 1. [Principle Name]

**[Emphatic statement].**

[Explanation and rationale]

### 2. [Principle Name]

**[Emphatic statement].**

[Explanation and rationale]

### 3. [Principle Name]

**[Emphatic statement].**

[Explanation and rationale]

## Practices

Things we do:

- ✅ **[Practice 1]** — [Why we do it]
- ✅ **[Practice 2]** — [Why we do it]

Things we avoid:

- ❌ **[Anti-pattern 1]** — [Why we avoid it]
- ❌ **[Anti-pattern 2]** — [Why we avoid it]

## Code Quality Standards

- **[Standard 1]** - [Details]
- **[Standard 2]** - [Details]
- **[Standard 3]** - [Details]
```

---

## Step 4: Creating SECURITY.md (Optional)

If your project has security considerations:

```markdown
# Security Guidelines

> _[Security philosophy in one sentence]_

## Threat Model

### Assets

- [What needs protection]
- [Critical data/systems]

### Threats

#### Threat 1: [Name]

- **Attack Vector**: [How it could happen]
- **Impact**: [What damage could occur]
- **Mitigation**: [How you prevent it]

#### Threat 2: [Name]

- **Attack Vector**: [How it could happen]
- **Impact**: [What damage could occur]
- **Mitigation**: [How you prevent it]

## Security Boundaries

- ✅ **[Boundary 1]** — [What's protected and how]
- ✅ **[Boundary 2]** — [What's protected and how]

## Security Requirements

- ✅ **[Requirement 1]** — [Why it's required]
- ✅ **[Requirement 2]** — [Why it's required]

## Known Vulnerabilities

[Track CVEs or security issues here]

## Security Review Process

[How you validate security]
```

---

## Step 5: Ingesting Documents

Once you've created your documentation, ingest it:

```bash
# Initialize PGC if not already done
cognition-cli init

# Ingest your strategic documents
cognition-cli genesis:docs docs/VISION.md
cognition-cli genesis:docs docs/CODING_PRINCIPLES.md

# Ingest security docs (if created)
cognition-cli genesis:docs docs/SECURITY.md

# Or ingest entire docs directory
cognition-cli genesis:docs docs/
```

### What Happens During Ingestion

1. **Document Classification**: Automatically determines document type
   - Strategic → O₄ (Mission Concepts)
   - Security → O₂ (Security Guidelines)
   - Operational → O₅ (Operational Patterns)

2. **Concept Extraction**: Uses 6 structural patterns to extract concepts
   - Target: 20-30 concepts per document
   - Quality: 70-85% alignment score

3. **Embedding Generation**: Creates 768-dimensional vectors via eGemma
   - Enables semantic search: `/consult-echo "query"`
   - Powers coherence analysis: `/coherence`

4. **Provenance Tracking**: Records transformation in audit trail
   - Stored in `.open_cognition/logs/transforms/`
   - Full lineage for every concept

5. **Security Validation**: Checks for mission drift
   - Advisory mode: warns about suspicious patterns
   - Strict mode: blocks on policy violations

---

## Step 6: Verify Ingestion

Check that your documents were ingested successfully:

```bash
# Check PGC status
cognition-cli status

# View mission concepts
cognition-cli concepts list

# Test semantic search
cognition-cli ask "What are our core principles?"

# Check coherence
cognition-cli coherence report
```

---

## Step 7: Start Using Quest Commands

Now you can use quest-based development:

```bash
# Start a new quest
/quest-start "implement user authentication"

# Find relevant patterns
/find-pattern "authentication"

# Check alignment
/check-alignment "zero-trust security"

# Verify before committing
/quest-verify
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

- **Too few concepts (<20)**: Add more bold statements, bullet points
- **Too many concepts (>50)**: Be more selective, strengthen signal
- **Low weights (<0.5)**: Use the pattern-optimized structure above
- **High fragments**: Avoid short phrases, focus on complete thoughts

---

## Example: Minimal VISION.md

If you're starting simple:

```markdown
# My Project

> _Solve [problem] with [approach]._

## Vision

**We believe [core belief].**

[2-3 sentences about the opportunity]

## Principles

### 1. [First Principle]

[Explanation]

### 2. [Second Principle]

[Explanation]

### 3. [Third Principle]

[Explanation]

## Success

- ✅ **[Goal 1]** — [Why it matters]
- ✅ **[Goal 2]** — [Why it matters]
```

This minimal structure will still extract 8-12 high-quality concepts.

---

## Tips for Great Documentation

1. **Use blockquotes for essence** - Start with `> _one sentence mission_`
2. **Bold complete sentences** - `**This is our belief.**` not `We **believe** this`
3. **Structure value props** - `- **Claim** — context` for scannable points
4. **Name your concepts** - `### Principle Name` as H3 headers
5. **Use emojis strategically** - `✅/❌` for requirements and problems
6. **Quote coined terms** - `"domain-specific terminology"` for key phrases

These patterns maximize extraction quality (validated by Oracle metrics).

---

## Next Steps

1. **Answer the questions** in Step 1
2. **I'll draft your VISION.md** using pattern-optimized structure
3. **Review and refine** the content
4. **Create the file** in your project
5. **Run ingestion**: `cognition-cli genesis:docs docs/VISION.md`
6. **Verify**: `cognition-cli concepts list`
7. **Start questing**: `/quest-start "your first quest"`

---

## Need Help?

- **Pattern details**: See `docs/overlays/O4_mission/PATTERN_LIBRARY.md`
- **Ingestion guide**: Run `cognition-cli genesis:docs --help`
- **Concept extraction**: See `docs/manual/part-1-foundation/02-the-pgc.md`
- **Quest workflow**: Read `.claude/commands/README.md`

Let's get started! Share your answers to the questions in Step 1, and I'll help you create your strategic documentation.
