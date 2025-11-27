# Real-World Workflows

End-to-end examples of using cognition-cli with Claude Code for real development tasks.

---

## Workflow 1: New Feature Development

**Scenario:** You need to add a new "Export" feature to your app and want AI help without hallucinations.

### Step 1: Understand Current Architecture

```bash
# See what patterns exist
cognition-cli patterns analyze

# Find similar export/import functionality
cognition-cli patterns find-similar ImportManager

# Check dependencies
cognition-cli patterns graph DataProcessor
```

**In Claude Code:**

> "Using the PGC, show me all classes that handle data transformation. I need to understand the pattern before implementing export functionality."

Claude will query PGC metadata, not guess or hallucinate.

---

### Step 2: Check Impact Before Starting

```bash
# If you plan to modify existing class
cognition-cli blast-radius ExportManager

# Check alignment with mission
cognition-cli coherence for-symbol ExportManager
```

**Question to ask:** "Will this change affect many files?"

---

### Step 3: Develop with Watch Mode

```bash
# Terminal 1: Watch mode (auto-update PGC)
cognition-cli watch
```

**In Claude Code:**

- Write your new `ExportService` class
- Claude can now see it in PGC immediately
- Ask: "Does my new ExportService follow the same pattern as ImportService?"

---

### Step 4: Validate Alignment

```bash
# Update PGC
cognition-cli update

# Check if new code aligns with mission
cognition-cli coherence for-symbol ExportService

# Compare with similar component
cognition-cli patterns compare ExportService ImportService
```

---

### Step 5: Pre-Commit Check

```bash
# See what changed
cognition-cli status

# Check coherence of ALL changes
cognition-cli coherence report

# If good, commit
git add .
git commit -m "feat: add export service"
```

---

## Workflow 2: Refactoring Legacy Code

**Scenario:** You have a large `utils.ts` file that needs to be split up properly.

### Step 1: Understand Current State

```bash
# Inspect the monolithic file
cognition-cli patterns inspect utils

# See what depends on it
cognition-cli blast-radius utils

# List all utility functions
cognition-cli patterns list --role utility
```

**Output shows:** "47 files depend on utils.ts - high impact!"

---

### Step 2: Plan the Refactor with AI

**In Claude Code:**

> "Using the PGC metadata, analyze utils.ts and suggest how to split it into cohesive modules based on actual usage patterns."

Claude will:

1. Query PGC for utils.ts dependencies
2. Analyze what functions are used where
3. Suggest logical groupings
4. **All without reading source code**

---

### Step 3: Refactor Incrementally

```bash
# Watch mode
cognition-cli watch
```

**In Claude Code:**

1. Create new files (e.g., `stringUtils.ts`, `dateUtils.ts`)
2. Move functions
3. Ask Claude: "Update all imports that use the moved functions"

Claude uses PGC to find ALL usages accurately.

---

### Step 4: Verify Impact

```bash
# Check new structure
cognition-cli patterns analyze

# Compare old vs new
cognition-cli patterns compare utils stringUtils

# Verify nothing broke
cognition-cli status
```

---

### Step 5: Coherence Check

```bash
# Did refactoring improve alignment?
cognition-cli coherence compare utils stringUtils

# Overall impact
cognition-cli coherence report
```

---

## Workflow 3: Code Review with Mission Alignment

**Scenario:** Reviewing a PR from a teammate.

### Step 1: Checkout PR Branch

```bash
git checkout feature/new-analytics

# Update PGC for this branch
cognition-cli update --force
```

---

### Step 2: Analyze Changes

```bash
# See what changed
cognition-cli status

# List new patterns
cognition-cli patterns list | grep "AnalyticsService"

# Check impact
cognition-cli blast-radius AnalyticsService
```

---

### Step 3: Strategic Coherence Check

```bash
# Does this PR align with our mission?
cognition-cli coherence for-symbol AnalyticsService

# Compare with existing similar services
cognition-cli patterns compare AnalyticsService MetricsService
```

**Output:**

```text
AnalyticsService coherence: 34.2%
⚠ Low alignment with mission concepts

Top alignments:
• "Structured understanding" (42.1%)
• "Data provenance" (38.7%)
```

---

### Step 4: Provide Feedback

**Comment on PR:**

````markdown
I ran `cognition-cli coherence for-symbol AnalyticsService` and noticed:

- **Coherence score**: 34.2% (below our 50% threshold)
- **Blast radius**: Affects 12 files
- **Pattern match**: Similar to MetricsService (good consistency)

Suggestions:

1. Add provenance tracking (see MetricsService implementation)
2. Consider renaming to align with our "verifiable" mission language

Run these locally:

```bash
cognition-cli coherence for-symbol AnalyticsService
cognition-cli patterns compare AnalyticsService MetricsService
```
````

---

## Workflow 4: Onboarding New Developers

**Scenario:** New teammate needs to understand the codebase quickly.

### Step 1: Generate PGC (If Not Exists)

```bash
cd project/

# Option 1: Use wizard for guided setup (recommended)
cognition-cli wizard

# Option 2: Manual setup
cognition-cli init                                    # Auto-detects sources and docs
cognition-cli genesis                                 # Uses paths from metadata.json
cognition-cli overlay generate structural_patterns   # Uses paths from metadata.json
cognition-cli overlay generate lineage_patterns
```

---

### Step 2: Explore Architecture with AI

**New developer opens Claude Code:**

> "Using the PGC, explain the architecture of this codebase. What are the main components and how do they connect?"

Claude responds with:

- Architectural roles (managers, services, utilities)
- Dependency graph
- Key patterns
- **All verifiable via PGC queries**

---

### Step 3: Deep Dive on Specific Areas

```bash
# New dev wants to work on authentication
cognition-cli patterns list --role service | grep -i auth

# See how auth connects to the system
cognition-cli patterns graph AuthenticationService

# Find related patterns
cognition-cli patterns find-similar AuthenticationService
```

**In Claude Code:**

> "Show me all authentication-related code paths using PGC metadata."

---

### Step 4: Understanding Mission Alignment

```bash
# What's the strategic vision?
cognition-cli concepts list

# What code best implements it?
cognition-cli coherence aligned

# What should I focus on?
cognition-cli coherence drifted
```

**New dev now understands:**

- ✅ Technical architecture (from PGC)
- ✅ Strategic mission (from O₃ concepts)
- ✅ Where to focus efforts (from O₄ coherence)

---

## Workflow 5: Mission Drift Detection

**Scenario:** Your project has been evolving for 6 months. Is it still aligned with the original vision?

### Step 1: Ingest Strategic Docs

```bash
# Original vision
cognition-cli genesis:docs VISION.md

# Additional strategic docs
cognition-cli genesis:docs docs/ARCHITECTURE.md
cognition-cli genesis:docs docs/PRINCIPLES.md --recursive
```

---

### Step 2: Extract Mission Concepts

```bash
# Generate O₃ layer
cognition-cli overlay generate mission_concepts

# Review extracted concepts
cognition-cli concepts list
cognition-cli concepts top 20
```

---

### Step 3: Compute Strategic Coherence

```bash
# Generate O₄ layer
cognition-cli overlay generate strategic_coherence

# Get the verdict
cognition-cli coherence report
```

**Output:**

```text
Strategic Coherence Report
━━━━━━━━━━━━━━━━━━━━━━━━

Analysis Scope:
  Code symbols:     312
  Mission concepts: 45

Coherence Metrics:
  Average coherence:  41.3%
  Aligned symbols:    23 (7.4%)
  Drifted symbols:    289 (92.6%)
```

---

### Step 4: Identify Drift

```bash
# What's drifting?
cognition-cli coherence drifted | head -50

# Which areas are most misaligned?
cognition-cli patterns analyze
```

**Findings:**

- New features in `src/experimental/` have 18% coherence
- Core mission code in `src/core/` has 58% coherence
- Utilities remain neutral (~35% coherence)

---

### Step 5: Course Correction

**In Claude Code:**

> "Based on PGC coherence scores, identify the top 5 classes that have drifted from our mission. For each, suggest specific refactorings to improve alignment."

Claude uses coherence data to suggest:

1. Rename `DataProcessor` → `VerifiableDataProcessor`
2. Add provenance tracking to `CacheManager`
3. Split `ExperimentalFeatures` into mission-aligned modules

---

## Workflow 6: Pre-Commit Quality Gate

**Scenario:** Enforce mission alignment before merging code.

### Setup: Git Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "🔍 Running cognition-cli quality checks..."

# Update PGC
cognition-cli update

# Check coherence
COHERENCE=$(cognition-cli coherence report --json | jq -r '.overall_metrics.average_coherence')

# Threshold: 40%
if (( $(echo "$COHERENCE < 0.40" | bc -l) )); then
  echo "❌ Average coherence ($COHERENCE) below threshold (0.40)"
  echo "Run: cognition-cli coherence drifted"
  exit 1
fi

echo "✅ Coherence check passed ($COHERENCE)"

# Check blast radius for changed files
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.ts$')

for file in $CHANGED_FILES; do
  SYMBOL=$(basename "$file" .ts)
  echo "Checking blast radius for: $SYMBOL"
  cognition-cli blast-radius "$SYMBOL" > /dev/null 2>&1
done

echo "✅ All checks passed"
exit 0
```

Make executable:

```bash
chmod +x .git/hooks/pre-commit
```

---

## Workflow 7: Documentation-Driven Development

**Scenario:** Write strategic docs first, then implement code that aligns.

### Step 1: Write Vision Document

Create `FEATURE_VISION.md`:

```markdown
# Real-Time Collaboration Feature

## Vision

Enable multiple developers to work simultaneously on the same codebase with conflict-free merges through operational transformation.

## Principles

- **Verifiable state**: Every edit has cryptographic hash
- **Deterministic merges**: Same inputs = same output
- **Provenance tracking**: Who changed what, when

## Key Concepts

- "Conflict-free Replicated Data Type (CRDT)"
- "Operational Transformation (OT)"
- "Cryptographic event sourcing"
```

---

### Step 2: Ingest & Extract Concepts

```bash
# Ingest vision doc
cognition-cli genesis:docs FEATURE_VISION.md

# Extract concepts
cognition-cli overlay generate mission_concepts --force

# Review concepts
cognition-cli concepts by-section "Key Concepts"
```

---

### Step 3: Develop with Alignment Checks

**In Claude Code:**

> "Based on FEATURE_VISION.md concepts in the PGC, implement the RealTimeCollaborationService class."

As you code:

```bash
# Watch mode
cognition-cli watch

# Check alignment continuously
cognition-cli coherence for-symbol RealTimeCollaborationService
```

---

### Step 4: Iterate Based on Coherence

```bash
# Is implementation aligned?
cognition-cli coherence for-symbol RealTimeCollaborationService
```

**Output:**

```text
Overall Coherence: 67.2%

Top alignments:
• "Cryptographic event sourcing" (81.3%) ✓
• "Verifiable state" (72.4%) ✓
• "Conflict-free Replicated Data Type" (58.1%) ⚠
```

**Action:** Rename variables, add CRDT terminology to align better.

---

## Workflow 8: Multi-Repository Consistency

**Scenario:** You maintain multiple microservices that should follow the same patterns.

### Setup: Initialize PGC in Each Repo

```bash
# Service A - use wizard for guided setup
cd service-a/
cognition-cli wizard

# Service B - or use init with auto-detection
cd service-b/
cognition-cli init     # Auto-detects sources
cognition-cli genesis  # Uses paths from metadata.json
```

---

### Compare Architectures

```bash
# Export Service A patterns
cd service-a/
cognition-cli patterns analyze --json > /tmp/service-a-patterns.json

# Export Service B patterns
cd service-b/
cognition-cli patterns analyze --json > /tmp/service-b-patterns.json

# Compare
diff /tmp/service-a-patterns.json /tmp/service-b-patterns.json
```

---

### Align to Shared Mission

```bash
# Both repos share VISION.md
cp VISION.md service-a/
cp VISION.md service-b/

# Generate coherence for both
cd service-a/ && cognition-cli overlay generate strategic_coherence
cd service-b/ && cognition-cli overlay generate strategic_coherence

# Compare coherence scores
cognition-cli coherence report # in each repo
```

**Goal:** Both services should have similar coherence scores.

---

## Tips for Effective Workflows

### 1. Always Start with Watch Mode

```bash
# Start once, forget about it
cognition-cli watch &
```

PGC auto-updates as you code.

---

### 2. Create Aliases

Add to `.bashrc` or `.zshrc`:

```bash
alias cgx='cognition-cli'
alias cgx-status='cognition-cli status'
alias cgx-update='cognition-cli update'
alias cgx-coherence='cognition-cli coherence report'
```

Now:

```bash
cgx-status
cgx-coherence
```

---

### 3. Combine with CI/CD

**GitHub Actions** (`.github/workflows/coherence.yml`):

```yaml
name: Strategic Coherence Check

on: [pull_request]

jobs:
  coherence:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install cognition-cli
        run: npm install -g cognition-cli

      - name: Generate PGC
        run: |
          cognition-cli init
          cognition-cli genesis

      - name: Check coherence
        run: |
          cognition-cli overlay generate strategic_coherence
          cognition-cli coherence report

          # Fail if below threshold
          SCORE=$(cognition-cli coherence report --json | jq -r '.overall_metrics.average_coherence')
          if (( $(echo "$SCORE < 0.40" | bc -l) )); then
            echo "Coherence too low: $SCORE"
            exit 1
          fi
```

---

### 4. Document Your Patterns

Create `.claude/commands/patterns.md`:

```markdown
---
description: Analyze codebase patterns
---

Run these commands to understand the architecture:

1. \`cognition-cli patterns analyze\`
2. \`cognition-cli overlay list\`
3. Use the PGC metadata to answer questions

Do NOT read source files directly.
```

---

## Conclusion

These workflows show how cognition-cli + Claude Code create a **verifiable, mission-aware development environment**.

**Key Takeaway:** Every workflow starts with PGC metadata, not source code guessing.

---

**Next:**

- [Integration Patterns](./integration-patterns.md) - Common usage patterns
- [Best Practices](./best-practices.md) - Recommended approaches
- [Command Reference](./command-reference.md) - Complete API
