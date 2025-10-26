# Best Practices

Recommended approaches for using cognition-cli effectively with Claude Code and in your development workflow.

---

## General Principles

### 1. Always Query PGC First

**Do:**

```text
User: "What managers do we have?"
Claude: *Runs cognition-cli patterns list --role manager*
Claude: "Based on PGC metadata, you have 12 managers: PGCManager, ObjectStore..."
```

**Don't:**

```text
User: "What managers do we have?"
Claude: *Reads all source files directly*
Claude: "I found these managers..." (potentially hallucinated)
```

**Why:** PGC metadata is verifiable, complete, and faster than reading source files.

---

### 2. Keep PGC in Sync

**Best Practice:**

- Run `cognition-cli watch` during active development
- Run `cognition-cli update` before commits
- Run `cognition-cli genesis --force` if PGC seems stale

**Signs of stale PGC:**

- `cognition-cli status` shows many dirty files
- Recent code changes not reflected in queries
- Coherence scores don't match expectations

---

### 3. Use Descriptive Symbol Names for Better Coherence

**Good naming (aligns with mission concepts):**

```typescript
class VerifiableDataProcessor {
  async processWithProvenance(input: any): Promise<ProvenanceRecord> {
    // Mission-aligned: "verifiable", "provenance"
  }
}
```

**Poor naming (low coherence):**

```typescript
class DataProc {
  async process(input: any): Promise<any> {
    // Generic: no mission alignment
  }
}
```

**Why:** Strategic coherence uses vector similarity between code identifiers and mission concepts. Descriptive English names improve alignment.

---

### 4. Write Vision Documents Before Code

**Recommended workflow:**

1. Write `VISION.md` or `FEATURE_VISION.md`
2. Ingest: `cognition-cli genesis:docs VISION.md`
3. Extract concepts: `cognition-cli overlay generate mission_concepts`
4. Develop code
5. Verify alignment: `cognition-cli coherence for-symbol YourClass`
6. Iterate based on coherence scores

**Why:** Documentation-driven development ensures code aligns with strategic vision from day 1.

---

### 5. Set Coherence Thresholds Based on Your Project

**Typical thresholds:**

- **Experimental/prototype**: 30-40% (exploratory phase)
- **Production/mature**: 50-70% (well-aligned)
- **Core mission code**: 70%+ (strategic components)

**Example thresholds:**

```bash
# Warn if below 40%
cognition-cli coherence report --json | jq -r '.overall_metrics.average_coherence' > /tmp/score
if (( $(cat /tmp/score) < 0.40 )); then
  echo "⚠️  Coherence below 40%"
fi
```

---

## Development Workflow Best Practices

### 1. Start Every Session with PGC Update

**Morning routine:**

```bash
cd ~/projects/my-app
cognition-cli status
cognition-cli update
```

**Why:** Ensures you're working with up-to-date metadata.

---

### 2. Use Watch Mode During Active Development

**Terminal setup:**

```bash
# Terminal 1: Watch mode
cognition-cli watch

# Terminal 2: Claude Code or editor
# (PGC auto-updates on file save)
```

**Why:** Zero manual intervention for PGC updates.

---

### 3. Check Blast Radius Before Refactoring

**Before:**

```bash
# Check impact
cognition-cli blast-radius UtilityClass

# If impact is high (>10 files), proceed carefully
```

**After:**

```bash
# Verify changes
cognition-cli update
cognition-cli patterns analyze
```

**Why:** Understand scope of changes to avoid unintended breakage.

---

### 4. Commit PGC Changes Separately from Code

**Recommended:**

```bash
# Commit 1: Code changes
git add src/
git commit -m "feat: add new feature"

# Commit 2: PGC update
cognition-cli update
git add .open_cognition/
git commit -m "chore: update PGC"
```

**Why:** Keeps code changes separate from metadata updates for clearer history.

**Alternative:** Ignore `.open_cognition/` entirely if regenerating PGC is cheap.

---

## Mission Alignment Best Practices

### 1. Ingest All Strategic Documents

**Recommended:**

```bash
# Ingest all mission docs
cognition-cli genesis:docs VISION.md
cognition-cli genesis:docs docs/ARCHITECTURE.md
cognition-cli genesis:docs docs/PRINCIPLES.md --recursive

# Generate concepts from all docs
cognition-cli overlay generate mission_concepts --force
```

**Why:** More mission concepts → better coherence analysis.

---

### 2. Review Extracted Concepts

**After extraction:**

```bash
# Review concepts
cognition-cli concepts list

# Check top concepts
cognition-cli concepts top 20

# Validate they match your vision
```

**Why:** Ensure extraction captured the right strategic themes.

---

### 3. Use Coherence to Guide Refactoring

**Workflow:**

```bash
# Find drifted code
cognition-cli coherence drifted | head -20

# Pick top drifted symbols
# Refactor to align with mission (rename, add comments, restructure)

# Re-check coherence
cognition-cli update
cognition-cli overlay generate strategic_coherence --force
cognition-cli coherence for-symbol RefactoredClass
```

**Why:** Data-driven refactoring based on mission alignment.

---

### 4. Set Alignment Goals Per Module

**Example:**

- `src/core/`: Target 70%+ coherence (mission-critical)
- `src/utils/`: Target 40%+ coherence (generic helpers)
- `src/experimental/`: Target 30%+ coherence (exploratory)

**Why:** Not all code needs high coherence. Utilities can be generic.

---

## Claude Code Best Practices

### 1. Create Custom Slash Commands

**Recommended commands:**

- `/analyze-pgc` - Run architectural analysis
- `/check-coherence` - Check mission alignment
- `/blast-radius <symbol>` - Check impact of changes

**Example: `.claude/commands/analyze-pgc.md`**

```markdown
---
description: Analyze architecture using PGC
---

Run:
1. \`cognition-cli patterns analyze\`
2. \`cognition-cli overlay list\`
3. Use PGC metadata to answer the user's question

Do NOT read source files directly.
```

**Why:** Consistent, repeatable workflows for your team.

---

### 2. Always Verify AI Responses Against PGC

**Example:**

```text
Claude: "You have 47 service classes"
User: *Runs cognition-cli patterns list --role service*
User: "Actually, we have 32. Claude, use PGC queries!"
```

**Why:** AI can hallucinate. PGC is ground truth.

---

### 3. Use PGC for Code Reviews

**In pull requests:**

```bash
# Review blast radius
cognition-cli blast-radius ChangedClass

# Check coherence impact
cognition-cli coherence for-symbol NewFeature

# Comment on PR with findings
```

**Example PR comment:**

```markdown
## PGC Analysis

**Blast Radius:** 12 files affected
**Coherence:** 58.3% (above threshold ✓)
**Aligned Concepts:**
- "Verifiable state" (72.4%)
- "Provenance tracking" (61.2%)

Looks good!
```

---

## Performance Best Practices

### 1. Regenerate Overlays Selectively

**Fast:**

```bash
# Only update structural patterns (O₁)
cognition-cli update
```

**Slow:**

```bash
# Force regenerate all overlays (O₁-O₄)
cognition-cli overlay generate structural_patterns --force
cognition-cli overlay generate lineage_patterns --force
cognition-cli overlay generate mission_concepts --force
cognition-cli overlay generate strategic_coherence --force
```

**When to force regenerate:**

- After major refactoring
- After updating VISION.md
- When coherence scores seem stale

---

### 2. Use JSON Output for Automation

**Fast (direct parsing):**

```bash
cognition-cli coherence report --json | jq -r '.overall_metrics.average_coherence'
```

**Slow (manual parsing):**

```bash
cognition-cli coherence report | grep "Average" | awk '{print $3}'
```

**Why:** JSON output is structured and parseable.

---

### 3. Limit Blast Radius Depth

**Fast:**

```bash
cognition-cli blast-radius MyClass --depth 2
```

**Slow:**

```bash
cognition-cli blast-radius MyClass --depth 10
```

**Why:** Deep traversal can be expensive for large codebases.

---

## Security Best Practices

### 1. Always Validate Strategic Documents

**Best practice:**

```bash
# Ingest with validation (default)
cognition-cli genesis:docs VISION.md

# Check for tampering later
cognition-cli audit:docs
```

**What it protects against:**

- Security weakening attacks
- Trust erosion attacks
- Permission creep
- Ambiguity injection
- Velocity-over-safety attacks

---

### 2. Monitor Semantic Drift

**After updating strategic docs:**

```bash
# System automatically detects drift
cognition-cli genesis:docs VISION.md --force

# Output will show if drift is detected
```

**Why:** Prevents gradual mission poisoning through incremental document changes.

---

### 3. Use Provenance Audit Trail

**For security-critical code:**

```bash
# Audit transformation history
cognition-cli audit:transformations src/auth/login.ts

# Check dependencies
cognition-cli patterns inspect AuthenticationManager
```

**Why:** Full provenance chain for security audits.

---

## Team Collaboration Best Practices

### 1. Share Mission Documents Across Repos

**For microservices:**

```bash
# Shared vision
cp ~/company/VISION.md ~/projects/service-a/
cp ~/company/VISION.md ~/projects/service-b/

# Each service generates coherence
cd ~/projects/service-a && cognition-cli genesis:docs VISION.md
cd ~/projects/service-b && cognition-cli genesis:docs VISION.md
```

**Why:** Consistent mission alignment across all services.

---

### 2. Document Your PGC Workflow

**Create `PGC_GUIDE.md` in your repo:**

```markdown
# PGC Developer Guide

## Setup
```bash
cognition-cli init
cognition-cli genesis
```

## Daily Workflow

- Start: `cognition-cli watch`
- Before commit: `cognition-cli update`
- Before refactor: `cognition-cli blast-radius <symbol>`

## Mission Alignment

- Check: `cognition-cli coherence report`
- Target: 50%+ average coherence

**Why:** Onboarding and consistency for the team.

---

### 3. Use Coherence Reports in Code Reviews

**PR template:**

```markdown
## Checklist

- [ ] Tests pass
- [ ] Lint passes
- [ ] PGC updated (`cognition-cli update`)
- [ ] Coherence checked (`cognition-cli coherence report`)
- [ ] Blast radius acceptable (<10 files)
```

---

## Anti-Patterns (What NOT to Do)

### ❌ Don't Read Source Files When PGC Has the Answer

**Wrong:**

```text
User: "List all managers"
Claude: *Reads all .ts files*
```

**Right:**

```text
User: "List all managers"
Claude: *Runs cognition-cli patterns list --role manager*
```

---

### ❌ Don't Ignore Coherence Warnings

**Wrong:**

```bash
# Coherence: 18% (way below threshold)
# Developer: "Whatever, ship it!"
```

**Right:**

```bash
# Coherence: 18%
# Developer: "Let me refactor to align with mission"
# *Renames classes, adds mission-aligned terminology*
# Coherence: 52% ✓
```

---

### ❌ Don't Skip PGC Updates Before Commits

**Wrong:**

```bash
git add .
git commit -m "feat: new feature"
# (PGC is stale, coherence scores are wrong)
```

**Right:**

```bash
cognition-cli update
git add .
git commit -m "feat: new feature"
```

---

### ❌ Don't Force Regenerate Overlays Unnecessarily

**Wrong:**

```bash
# After changing 1 file
cognition-cli overlay generate strategic_coherence --force
# (Expensive, regenerates everything)
```

**Right:**

```bash
# After changing 1 file
cognition-cli update
# (Incremental update, fast)
```

---

### ❌ Don't Use Generic Names for Mission-Critical Code

**Wrong:**

```typescript
class Manager {} // Low coherence
class Processor {} // Low coherence
class Service {} // Low coherence
```

**Right:**

```typescript
class VerifiableDataManager {} // Aligned with mission
class ProvenanceProcessor {} // Aligned with mission
class GroundedQueryService {} // Aligned with mission
```

---

## Testing Best Practices

### 1. Mock External APIs in Tests

**Best practice:**

```typescript
// In test files
vi.mock('../executors/workbench-client.js', () => {
  return {
    WorkbenchClient: vi.fn().mockImplementation(() => ({
      embed: vi.fn().mockResolvedValue({
        embedding_768d: new Array(768).fill(0.1),
      }),
    })),
  };
});
```

**Why:** Tests should not depend on external services (rate limits, availability).

---

### 2. Test PGC Commands in CI/CD

**GitHub Actions example:**

```yaml
- name: Test PGC Generation
  run: |
    cognition-cli init
    cognition-cli genesis
    cognition-cli patterns analyze

    # Verify PGC was created
    test -d .open_cognition/objects
```

---

## Documentation Best Practices

### 1. Keep VISION.md Up to Date

**Recommended:**

- Review quarterly
- Update after major pivots
- Re-ingest after updates: `cognition-cli genesis:docs VISION.md --force`

---

### 2. Document Coherence Goals

**Add to README.md:**

```markdown
## Mission Alignment

This project maintains strategic coherence with our vision.

**Coherence targets:**
- Overall average: 50%+
- Core modules: 70%+
- Utilities: 40%+

Check alignment:

```bash
cognition-cli coherence report
```

---

### 3. Add PGC Status Badge (Optional)

**Conceptual (future):**

```markdown
[![PGC Coherence](https://img.shields.io/badge/coherence-52.3%25-green.svg)](https://cogx.dev)
```

---

## Monitoring & Observability

### 1. Track Coherence Over Time

**Script to log coherence:**

```bash
#!/bin/bash
# Add to daily cron job

DATE=$(date +%Y-%m-%d)
SCORE=$(cognition-cli coherence report --json | jq -r '.overall_metrics.average_coherence')

echo "$DATE,$SCORE" >> coherence-history.csv
```

**Analyze trends:**

```bash
# Plot with gnuplot or import to spreadsheet
gnuplot -e "set datafile separator ','; plot 'coherence-history.csv' using 0:2 with lines"
```

---

### 2. Set Up Alerts

**Example: Slack alert if coherence drops below threshold:**

```bash
#!/bin/bash

SCORE=$(cognition-cli coherence report --json | jq -r '.overall_metrics.average_coherence')

if (( $(echo "$SCORE < 0.40" | bc -l) )); then
  curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
    -d "{\"text\": \"⚠️  Coherence dropped to $SCORE!\"}"
fi
```

---

## Conclusion

Following these best practices ensures:

- ✅ Verifiable AI cognition (no hallucinations)
- ✅ Mission-aligned development
- ✅ Efficient PGC management
- ✅ Team consistency
- ✅ Security and provenance

**Key Takeaway:** Always use PGC metadata as ground truth. Let the data guide your development.

---

**See also:**

- [Command Reference](./command-reference.md) - Complete command API
- [Quick Start](./quick-start.md) - Get started in 5 minutes
- [Workflows](./workflows.md) - Real-world examples
- [Integration Patterns](./integration-patterns.md) - Common patterns
