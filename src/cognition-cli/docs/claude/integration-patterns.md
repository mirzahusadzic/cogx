# Integration Patterns

Common patterns for integrating cognition-cli with Claude Code and your development workflow.

---

## Pattern 1: The Grounded Query Pattern

**Problem:** You need Claude Code to answer architecture questions without hallucinating.

**Solution:** Always query PGC metadata instead of reading source files.

### Pattern 1 Implementation

Create `.claude/commands/query-pgc.md`:

```markdown
---
description: Query PGC instead of reading source files
---

When answering questions about the codebase:

1. Run `cognition-cli patterns list` or `cognition-cli patterns analyze`
2. Use the PGC metadata to answer the user's question
3. DO NOT read source files directly unless absolutely necessary
4. All claims must be verifiable via PGC queries

Example: To find all managers, run:

```bash
cognition-cli patterns list --role manager
```

**Usage in Claude Code:**

```text
/query-pgc

User: "What architectural patterns do we use?"
Claude: *Runs cognition-cli patterns analyze*
Claude: "Based on PGC metadata, you have 47 managers, 32 services, 18 utilities..."
```

---

## Pattern 2: The Pre-Commit Hook Pattern

**Problem:** You want to ensure PGC coherence and mission alignment before every commit.

**Solution:** Git hook that runs cognition-cli checks.

### Pattern 2 Implementation

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "🔍 Running cognition-cli pre-commit checks..."

# Update PGC
cognition-cli update

# Check for dirty files
DIRTY=$(cognition-cli status --json | jq -r '.dirty_files | length')
if [ "$DIRTY" -gt 0 ]; then
  echo "⚠️  Warning: $DIRTY files not yet in PGC"
fi

# Check coherence (if O₃/O₄ enabled)
if [ -f ".open_cognition/overlays/strategic_coherence.json" ]; then
  COHERENCE=$(cognition-cli coherence report --json | jq -r '.overall_metrics.average_coherence')
  echo "📊 Strategic coherence: $COHERENCE"

  # Optional: Fail if below threshold
  if (( $(echo "$COHERENCE < 0.35" | bc -l) )); then
    echo "❌ Coherence below threshold (0.35)"
    echo "Run: cognition-cli coherence drifted"
    exit 1
  fi
fi

echo "✅ Pre-commit checks passed"
exit 0
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

---

## Pattern 3: The Watch + Develop Pattern

**Problem:** You want Claude Code to always have up-to-date PGC metadata while developing.

**Solution:** Run watch mode in a separate terminal.

### Pattern 3 Implementation

**Terminal 1 (Watch):**

```bash
cd ~/projects/my-app
cognition-cli watch
```

**Terminal 2 (Development):**

```bash
# Use Claude Code normally
# PGC auto-updates on every file save
```

**Terminal 3 (Queries):**

```bash
# Manual queries as needed
cognition-cli patterns inspect NewClass
cognition-cli coherence for-symbol NewService
```

**Benefits:**

- Zero manual PGC updates
- Real-time coherence monitoring
- Claude Code always has fresh metadata

---

## Pattern 4: The Coherence Dashboard Pattern

**Problem:** You want continuous visibility into mission alignment during development.

**Solution:** tmux/screen layout with live coherence monitoring.

### Pattern 4 Implementation

Create `dev-dashboard.sh`:

```bash
#!/bin/bash

# Start tmux session
tmux new-session -d -s cogx-dev

# Window 1: Watch mode
tmux send-keys -t cogx-dev "cognition-cli watch" C-m

# Window 2: Coherence monitor (loop)
tmux split-window -h -t cogx-dev
tmux send-keys -t cogx-dev "watch -n 30 'cognition-cli coherence report'" C-m

# Window 3: Development
tmux split-window -v -t cogx-dev
tmux send-keys -t cogx-dev "# Development terminal" C-m

# Attach to session
tmux attach-session -t cogx-dev
```

**Layout:**

```text
┌─────────────────┬─────────────────┐
│ Watch Mode      │ Coherence       │
│ (auto-updating) │ Dashboard       │
│                 │ (30s refresh)   │
├─────────────────┴─────────────────┤
│ Development Terminal              │
└───────────────────────────────────┘
```

---

## Pattern 5: The Slash Command Library Pattern

**Problem:** You want reusable Claude Code commands for common PGC operations.

**Solution:** Create `.claude/commands/` directory with specialized commands.

### Pattern 5 Implementation

**`.claude/commands/analyze-architecture.md`:**

```markdown
---
description: Analyze codebase architecture using PGC
---

Run these commands to understand the architecture:

1. \`cognition-cli patterns analyze\` - Overall distribution
2. \`cognition-cli patterns list --role manager\` - List managers
3. \`cognition-cli patterns list --role service\` - List services
4. \`cognition-cli overlay list\` - Check overlay status

Use the PGC metadata to answer the user's architectural questions.
```

**`.claude/commands/check-blast-radius.md`:**

```markdown
---
description: Check impact of changing a symbol
---

Ask the user which symbol they want to modify, then run:

```bash
cognition-cli blast-radius <symbol-name>

Show the user:
- Direct dependents
- Transitive impact
- Files that will be affected

Warn if blast radius is high (>10 files).
```

**`.claude/commands/check-alignment.md`:**

```markdown
---
description: Check mission alignment for recent changes
---

1. Run \`cognition-cli status\` to see modified files
2. For each modified file, extract the main symbol
3. Run \`cognition-cli coherence for-symbol <symbol>\`
4. Report alignment scores to the user
5. Flag any symbols with coherence < 50%
```

**Usage:**

```text
/analyze-architecture
/check-blast-radius
/check-alignment
```

---

## Pattern 6: The CI/CD Integration Pattern

**Problem:** You want automated PGC and coherence checks in your CI pipeline.

**Solution:** GitHub Actions workflow.

### Pattern 6 Implementation

**`.github/workflows/pgc-coherence.yml`:**

```yaml
name: PGC Coherence Check

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  coherence:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install cognition-cli
        run: npm install -g cognition-cli

      - name: Initialize PGC
        run: |
          cognition-cli init
          cognition-cli genesis

      - name: Generate Overlays
        run: |
          cognition-cli overlay generate structural_patterns
          cognition-cli overlay generate lineage_patterns

      - name: Check Architecture
        run: |
          cognition-cli patterns analyze
          echo "✅ Structural patterns extracted"

      # Optional: O₃/O₄ checks
      - name: Mission Alignment (Optional)
        if: hashFiles('VISION.md') != ''
        run: |
          cognition-cli genesis:docs VISION.md
          cognition-cli overlay generate mission_concepts
          cognition-cli overlay generate strategic_coherence

      - name: Coherence Report
        if: hashFiles('VISION.md') != ''
        run: |
          cognition-cli coherence report

          # Fail if below threshold
          SCORE=$(cognition-cli coherence report --json | jq -r '.overall_metrics.average_coherence')
          if (( $(echo "$SCORE < 0.35" | bc -l) )); then
            echo "❌ Coherence score too low: $SCORE"
            exit 1
          fi
          echo "✅ Coherence check passed: $SCORE"

      - name: Comment on PR (Optional)
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('.open_cognition/overlays/strategic_coherence.json', 'utf8');
            const data = JSON.parse(report);

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 📊 Strategic Coherence Report\n\n**Average Coherence:** ${(data.overall_metrics.average_coherence * 100).toFixed(1)}%\n**Aligned Symbols:** ${data.overall_metrics.aligned_symbols_count}\n**Drifted Symbols:** ${data.overall_metrics.drifted_symbols_count}`
            })
```

---

## Pattern 7: The Multi-Repo Consistency Pattern

**Problem:** You maintain multiple microservices that should follow the same architectural patterns.

**Solution:** Shared mission document + automated coherence comparison.

### Pattern 7 Implementation

**Shared VISION.md:**

```bash
# Copy shared vision to all repos
cp ~/company/VISION.md ~/projects/service-a/
cp ~/company/VISION.md ~/projects/service-b/
cp ~/company/VISION.md ~/projects/service-c/
```

**Generate coherence in each:**

```bash
for service in service-a service-b service-c; do
  cd ~/projects/$service
  cognition-cli genesis:docs VISION.md
  cognition-cli overlay generate mission_concepts
  cognition-cli overlay generate strategic_coherence
  cognition-cli coherence report --json > coherence-$service.json
done
```

**Compare coherence:**

```bash
# Create comparison script
cat > compare-coherence.sh << 'EOF'
#!/bin/bash

echo "Service Coherence Comparison"
echo "=============================="

for file in coherence-*.json; do
  service=$(echo $file | sed 's/coherence-\(.*\)\.json/\1/')
  score=$(jq -r '.overall_metrics.average_coherence' $file)
  aligned=$(jq -r '.overall_metrics.aligned_symbols_count' $file)
  drifted=$(jq -r '.overall_metrics.drifted_symbols_count' $file)

  printf "%-15s %5.1f%%  ✓ %-3d  ✗ %-3d\n" "$service" "$(echo "$score * 100" | bc)" "$aligned" "$drifted"
done
EOF

chmod +x compare-coherence.sh
./compare-coherence.sh
```

**Output:**

```text
Service Coherence Comparison
==============================
service-a        42.3%  ✓ 23   ✗ 87
service-b        38.7%  ✓ 19   ✗ 92
service-c        51.2%  ✓ 31   ✗ 74
```

---

## Pattern 8: The Documentation-Driven Development Pattern

**Problem:** You want to write strategic vision first, then implement code that aligns.

**Solution:** Vision → Concepts → Code → Verify loop.

### Workflow

#### Step 1: Write Vision Document

`FEATURE_VISION.md`:

```markdown
# Real-Time Collaboration Feature

## Vision
Enable conflict-free simultaneous editing through operational transformation.

## Key Concepts
- "Conflict-free Replicated Data Type (CRDT)"
- "Operational Transformation (OT)"
- "Cryptographic event sourcing"
- "Deterministic merges"
```

#### Step 2: Ingest + Extract

```bash
cognition-cli genesis:docs FEATURE_VISION.md
cognition-cli overlay generate mission_concepts --force
```

#### Step 3: Develop with Alignment Checks

In Claude Code:
> "Based on FEATURE_VISION.md concepts, implement RealTimeCollaborationService"

While coding:

```bash
# Watch mode
cognition-cli watch

# Check alignment continuously
cognition-cli coherence for-symbol RealTimeCollaborationService
```

#### Step 4: Iterate Based on Coherence

```bash
cognition-cli coherence for-symbol RealTimeCollaborationService
```

**Output:**

```text
Overall Coherence: 67.2%

Top alignments:
• "Cryptographic event sourcing" (81.3%) ✓
• "Deterministic merges" (72.4%) ✓
• "Conflict-free Replicated Data Type" (58.1%) ⚠
```

**Action:** Rename variables, add CRDT terminology to improve alignment.

---

## Pattern 9: The Provenance Audit Pattern

**Problem:** You need to trace the full history of a file for security/compliance.

**Solution:** Use transformation audit trail.

### Pattern 8 Implementation

```bash
# Audit specific file
cognition-cli audit:transformations src/core/auth.ts

# Audit all documents
cognition-cli audit:docs

# Check specific symbol's dependencies
cognition-cli patterns inspect AuthenticationManager
cognition-cli blast-radius AuthenticationManager
```

**Use cases:**

- Security audits: "Who changed this code?"
- Compliance: "What transformations were applied?"
- Debugging: "When did this pattern change?"

---

## Pattern 10: The Onboarding Pattern

**Problem:** New developers need to understand the codebase quickly.

**Solution:** PGC-guided exploration with Claude Code.

### Onboarding Script

Create `ONBOARDING.md`:

```markdown
# Developer Onboarding

Welcome! This project uses cognition-cli for verifiable AI-assisted development.

## Step 1: Setup (5 minutes)

```bash
# Install cognition-cli
npm install -g cognition-cli

# Generate PGC
cd ~/projects/my-app
cognition-cli init
cognition-cli genesis
```

## Step 2: Explore Architecture (10 minutes)

```bash
# Overall architecture
cognition-cli patterns analyze

# List main components
cognition-cli patterns list --role manager

# Visualize dependencies
cognition-cli patterns graph MainController
```

## Step 3: Use Claude Code (∞)

Ask Claude Code:

> "Using the PGC, explain the architecture of this codebase"
>
> "Show me all authentication-related code paths using PGC metadata"
>
> "What are the main components and how do they connect?"

## Step 4: Understand Mission (5 minutes)

```bash
# View mission concepts
cognition-cli concepts list

# See what code aligns with mission
cognition-cli coherence aligned

# See what needs improvement
cognition-cli coherence drifted
```

---

## Pattern 11: The API for PGC Pattern

**Problem:** You want to programmatically access PGC data from other tools.

**Solution:** Use `--json` flag and parse with `jq`.

### Examples

**Extract all manager names:**

```bash
cognition-cli patterns list --role manager --json | jq -r '.[].symbolName'
```

**Get coherence scores as CSV:**

```bash
cognition-cli coherence report --json | jq -r '.symbol_coherence[] | "\(.symbolName),\(.overall_score)"'
```

**Find high-impact symbols:**

```bash
cognition-cli blast-radius MySymbol --format json | jq -r '.dependents | length'
```

**Integrate with external dashboard:**

```javascript
const { exec } = require('child_process');

function getCoherenceMetrics() {
  return new Promise((resolve, reject) => {
    exec('cognition-cli coherence report --json', (err, stdout) => {
      if (err) reject(err);
      resolve(JSON.parse(stdout));
    });
  });
}

// Use in web dashboard
const metrics = await getCoherenceMetrics();
console.log(`Average coherence: ${metrics.overall_metrics.average_coherence}`);
```

---

## Pattern 12: The Security Validation Pattern

**Problem:** You want to ensure strategic documents aren't tampered with.

**Solution:** Use DocsOracle validation with semantic drift detection.

### Pattern 12 Implementation

```bash
# Initial ingestion (validated by Gemini LLM + semantic drift)
cognition-cli genesis:docs VISION.md

# Later: Re-validate
cognition-cli audit:docs

# Check for semantic drift
# (System automatically detects if concepts changed significantly)
```

**What it validates:**

- Layer 1A: Gemini LLM checks for attack patterns (security weakening, trust erosion, etc.)
- Layer 1B: Pattern matching for malicious content
- Layer 2: Semantic drift detection (cosine distance on concept embeddings)

**Output if tampered:**

```text
⚠️  Document validation failed: VISION.md
Reason: Semantic drift detected (distance: 0.45 > threshold: 0.3)
Previous version: sha256:abc123...
Current version: sha256:def456...
```

---

## Tips for Effective Integration

1. **Always use PGC queries first**: Before reading source files, check if PGC has the answer
2. **Enable watch mode during development**: Set it and forget it
3. **Create project-specific slash commands**: Tailor commands to your workflow
4. **Use coherence checks in CI/CD**: Prevent mission drift automatically
5. **Leverage JSON output**: Integrate with external tools via `--json` flag
6. **Document your patterns**: Create `.claude/commands/` for team consistency

---

**See also:**

- [Command Reference](./command-reference.md) - Complete command documentation
- [Workflows](./workflows.md) - Real-world examples
- [Best Practices](./best-practices.md) - Recommended approaches
