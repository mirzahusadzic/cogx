# 08 - Claude Code Integration: AI + PGC Symbiosis

**How `cognition-cli` and Claude Code work together to create a living, grounded development environment.**

---

## Overview

The `cognition-cli` is designed to work seamlessly with **Claude Code** (Anthropic's official CLI tool). Together, they create a powerful symbiosis:

- **Claude Code**: AI-powered coding assistant with deep reasoning capabilities
- **cognition-cli**: Verifiable, grounded knowledge graph of your codebase
- **The Result**: AI reasoning that is anchored in cryptographic truth, not statistical approximation

This integration enables:

- ✅ **Zero-hallucination architecture queries** — All answers verifiable via PGC metadata
- ✅ **Mission-aligned development** — Strategic coherence analysis (O₃/O₄ layers)
- ✅ **Provenance-tracked changes** — Every transformation cryptographically auditable
- ✅ **Real-time PGC synchronization** — Watch mode keeps metadata up-to-date

---

## Documentation Guide

This guide is organized into focused documents covering different aspects of Claude Code integration:

### 📚 Core Documentation

#### [Quick Start Guide](./claude/quick-start.md)

Get up and running in 5 minutes:

- Installation (npm or from source)
- Initialize PGC
- Extract structural patterns
- Generate overlays (O₁-O₄)
- First queries with Claude Code
- Success criteria checklist

**Start here if you're new to cognition-cli!**

---

#### [Command Reference](./claude/command-reference.md)

Complete reference for all `cognition-cli` commands:

**Core Commands:**

- `init`, `genesis`, `genesis:docs` — Setup and ingestion
- `query`, `status`, `update`, `watch` — Daily operations

**Analysis Commands:**

- `patterns list|inspect|analyze|graph|compare` — Structural analysis
- `concepts list|top|search|by-section|inspect` — Mission concepts (O₃)
- `coherence report|aligned|drifted|for-symbol|compare` — Strategic coherence (O₄)
- `blast-radius` — Impact analysis

**Utilities:**

- `audit:transformations|docs` — Provenance auditing
- `overlay generate|list` — Analytical overlays

**Use this as your API reference.**

---

#### [Real-World Workflows](./claude/workflows.md)

End-to-end examples for common development scenarios:

1. **New Feature Development** — Understand patterns → Check impact → Develop with watch mode → Validate alignment
2. **Refactoring Legacy Code** — Analyze monolithic files → Plan with AI → Refactor incrementally → Verify improvement
3. **Code Review with Mission Alignment** — Checkout PR → Analyze changes → Check coherence → Provide feedback
4. **Onboarding New Developers** — Generate PGC → Explore with AI → Understand mission
5. **Mission Drift Detection** — Ingest docs → Extract concepts → Compute coherence → Course correction
6. **Pre-Commit Quality Gate** — Git hooks for automatic validation
7. **Documentation-Driven Development** — Vision first → Extract concepts → Develop with alignment checks
8. **Multi-Repository Consistency** — Shared vision across microservices

**Use these workflows as templates for your team.**

---

#### [Integration Patterns](./claude/integration-patterns.md)

Common patterns for integrating cognition-cli with Claude Code:

1. **Grounded Query Pattern** — Always query PGC instead of reading source
2. **Pre-Commit Hook Pattern** — Automated PGC updates and coherence checks
3. **Watch + Develop Pattern** — Real-time PGC synchronization
4. **Coherence Dashboard Pattern** — Live mission alignment monitoring
5. **Slash Command Library Pattern** — Reusable Claude Code commands
6. **CI/CD Integration Pattern** — GitHub Actions workflows
7. **Multi-Repo Consistency Pattern** — Shared vision alignment
8. **Documentation-Driven Development Pattern** — Vision → Code loop
9. **Provenance Audit Pattern** — Security and compliance tracking
10. **Onboarding Pattern** — PGC-guided exploration for new devs
11. **API for PGC Pattern** — Programmatic access via JSON output
12. **Security Validation Pattern** — DocsOracle and semantic drift detection

**Use these patterns to build your own workflows.**

---

#### [Best Practices](./claude/best-practices.md)

Recommended approaches for effective use:

**General Principles:**

- Always query PGC first (never read source when PGC has the answer)
- Keep PGC in sync (watch mode, pre-commit updates)
- Use descriptive symbol names (better coherence alignment)
- Write vision documents before code
- Set coherence thresholds based on project phase

**Development Workflows:**

- Start every session with PGC update
- Check blast radius before refactoring
- Commit PGC changes separately from code

**Mission Alignment:**

- Ingest all strategic documents
- Review extracted concepts
- Use coherence to guide refactoring
- Set alignment goals per module

**Performance:**

- Regenerate overlays selectively
- Use JSON output for automation
- Limit blast radius depth

**Security:**

- Always validate strategic documents
- Monitor semantic drift
- Use provenance audit trail

**Anti-Patterns (What NOT to Do):**

- ❌ Don't read source files when PGC has the answer
- ❌ Don't ignore coherence warnings
- ❌ Don't skip PGC updates before commits
- ❌ Don't use generic names for mission-critical code

**Follow these to avoid common pitfalls.**

---

## Quick Reference

### Essential Commands

```bash
# Setup (one-time)
cognition-cli init
cognition-cli genesis

# Daily workflow
cognition-cli watch              # Auto-update mode
cognition-cli status             # Check PGC state
cognition-cli update             # Manual update

# Architecture queries
cognition-cli patterns list      # List all patterns
cognition-cli patterns analyze   # Architectural distribution
cognition-cli blast-radius <symbol>  # Impact analysis

# Mission alignment (O₃/O₄)
cognition-cli genesis:docs VISION.md
cognition-cli overlay generate mission_concepts
cognition-cli overlay generate strategic_coherence
cognition-cli coherence report   # Overall metrics
cognition-cli coherence drifted  # Find misaligned code
```

---

## The `.claude/commands/` System

### How It Works

Claude Code supports **slash commands** defined as markdown files in the `.claude/commands/` directory. When you type `/command-name`, Claude Code expands the corresponding markdown file as a prompt.

**The cognition-cli already includes living guides in this format:**

```text
cognition-cli/
├── .claude/
│   └── commands/
│       ├── watch.md        # Guide for watch command
│       ├── status.md       # Guide for status command
│       ├── update.md       # Guide for update command
│       └── explore-architecture.md  # AI architecture exploration
```

### Using Guides as Slash Commands

In Claude Code, you can run:

```text
/watch     → Shows the watch command guide
/status    → Shows the status command guide
/update    → Shows the update command guide
```

Claude Code will read the markdown, understand the command's purpose, options, and examples, then help you use it effectively!

### Creating Custom Integration Commands

You can create your own `.claude/commands/` that leverage cognition-cli:

**Example: `.claude/commands/analyze-impact.md`**

```markdown
---
description: Analyze impact of recent changes
---

Please analyze the impact of my recent changes using the PGC:

1. Run `cognition-cli status --verbose` to see which symbols are affected
2. For each affected symbol, run `cognition-cli blast-radius <symbol>` to understand downstream impact
3. Summarize the architectural implications
4. Suggest if changes should be split into multiple commits based on blast radius

Be thorough and provide specific examples from the output.
```

Now `/analyze-impact` becomes a custom workflow!

**See [Integration Patterns](./claude/integration-patterns.md) for more examples.**

---

## Integration Philosophy

### The Grounded Cognition Loop

```text
┌─────────────────────────────────────────────────────────┐
│  1. Developer writes code                                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  2. cognition-cli extracts structural patterns (PGC)     │
│     • AST parsing → Structural patterns (O₁)             │
│     • Dependency mining → Lineage patterns (O₂)          │
│     • Strategic docs → Mission concepts (O₃)             │
│     • Vector similarity → Strategic coherence (O₄)       │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  3. Claude Code queries PGC for grounded reasoning       │
│     • Architecture questions → patterns analyze          │
│     • Dependency questions → blast-radius                │
│     • Mission alignment → coherence report               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  4. Developer verifies AI responses against PGC          │
│     • "You have 47 managers" → cognition-cli patterns    │
│     • "This class drifted" → cognition-cli coherence     │
│     • Everything is cryptographically verifiable         │
└─────────────────────────────────────────────────────────┘
```

**Key Principle:** Every AI claim is verifiable by running a PGC command. No hallucinations.

---

## Why This Integration Matters

### Before: Traditional AI-Assisted Development

```text
Developer: "What architectural patterns do we use?"
AI: "You have 47 service classes, 23 managers, 18 utilities"
Developer: *Manually verifies by reading source files*
Developer: "Actually, we only have 32 services. You hallucinated."
```

**Problem:** AI reasoning is statistical approximation. No ground truth.

---

### After: PGC-Grounded AI Development

```text
Developer: "What architectural patterns do we use?"
AI: *Runs cognition-cli patterns analyze*
AI: "Based on PGC metadata (hash: abc123...):
     - 32 services
     - 23 managers
     - 18 utilities"
Developer: "✓ Verified via: cognition-cli patterns analyze"
```

**Solution:** AI reasoning is anchored in cryptographic truth.

---

## Typical Development Session

### Morning: Setup

```bash
cd ~/projects/my-app

# Check PGC state
cognition-cli status

# Update if needed
cognition-cli update

# Start watch mode in separate terminal
cognition-cli watch
```

---

### During Development: Use Claude Code with PGC Queries

**In Claude Code:**

```text
User: "Show me all authentication-related code paths"
Claude: *Runs cognition-cli patterns list | grep -i auth*
Claude: *Runs cognition-cli patterns graph AuthenticationService*
Claude: "Based on PGC metadata, authentication flows through:
         1. AuthenticationService (src/auth/service.ts)
         2. TokenManager (src/auth/token.ts)
         3. SessionStore (src/auth/session.ts)

         Dependencies verified via lineage patterns (O₂)."
```

**Verify:**

```bash
cognition-cli patterns graph AuthenticationService
# Output matches Claude's description ✓
```

---

### Before Commit: Validate Mission Alignment

```bash
# Check coherence
cognition-cli coherence report

# Output:
# Average coherence: 52.3%
# Aligned symbols: 23 (7.4%)
# Drifted symbols: 289 (92.6%)

# Fix drifted code if needed
cognition-cli coherence drifted | head -20
# Refactor based on mission concepts

# Update PGC
cognition-cli update

# Commit
git add .
git commit -m "feat: add authentication with mission alignment"
```

---

## Advanced Integration: O₃/O₄ Layers

### Strategic Coherence Analysis

**Setup:**

```bash
# 1. Ingest strategic documents
cognition-cli genesis:docs VISION.md
cognition-cli genesis:docs docs/ARCHITECTURE.md

# 2. Extract mission concepts (O₃ layer)
cognition-cli overlay generate mission_concepts

# Output: 61 mission concepts extracted

# 3. Compute strategic coherence (O₄ layer)
cognition-cli overlay generate strategic_coherence

# Output: 163 symbols analyzed
```

**Use in Claude Code:**

```text
User: "Which parts of the codebase align with our mission?"
Claude: *Runs cognition-cli coherence aligned*
Claude: "Based on strategic coherence (O₄ layer):

         Top aligned symbols:
         1. VerifiableDataProcessor (72.4%) — aligns with 'verifiable state'
         2. ProvenanceManager (68.1%) — aligns with 'provenance tracking'
         3. GroundedQueryService (61.3%) — aligns with 'grounding'

         These are your mission-critical components."
```

**See [Workflows: Mission Drift Detection](./claude/workflows.md#workflow-5-mission-drift-detection) for complete example.**

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: PGC Coherence Check

on: [pull_request]

jobs:
  coherence:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install cognition-cli
        run: npm install -g cognition-cli

      - name: Generate PGC
        run: |
          cognition-cli init
          cognition-cli genesis

      - name: Check Coherence
        run: |
          cognition-cli overlay generate strategic_coherence
          SCORE=$(cognition-cli coherence report --json | jq -r '.overall_metrics.average_coherence')

          if (( $(echo "$SCORE < 0.40" | bc -l) )); then
            echo "❌ Coherence too low: $SCORE"
            exit 1
          fi

          echo "✅ Coherence check passed: $SCORE"
```

**See [Integration Patterns: CI/CD Integration](./claude/integration-patterns.md#pattern-6-the-cicd-integration-pattern) for complete example.**

---

## Example Slash Commands

Create these in your project's `.claude/commands/` directory:

### `/analyze-pgc`

```markdown
---
description: Analyze codebase architecture using PGC
---

Run these commands to understand the architecture:

1. \`cognition-cli patterns analyze\` — Overall distribution
2. \`cognition-cli overlay list\` — Check overlay status
3. Use the PGC metadata to answer the user's question

Do NOT read source files directly.
```

### `/check-coherence`

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

### `/blast-radius`

```markdown
---
description: Check impact of changing a symbol
---

Ask the user which symbol they want to modify, then run:

```bash
cognition-cli blast-radius <symbol-name>
```

Show:

- Direct dependents
- Transitive impact
- Files that will be affected

Warn if blast radius is high (>10 files).

**See [Integration Patterns: Slash Command Library](./claude/integration-patterns.md#pattern-5-the-slash-command-library-pattern) for more examples.**

---

## Troubleshooting

### PGC Out of Sync

**Symptom:** Recent code changes not reflected in queries

**Fix:**

```bash
# Force full rebuild
cognition-cli genesis --force

# Force overlay regeneration
cognition-cli overlay generate structural_patterns --force
```

---

### Coherence Scores Seem Wrong

**Symptom:** Coherence scores don't match expectations

**Fix:**

```bash
# Ensure all overlays are generated
cognition-cli overlay list

# Regenerate mission concepts
cognition-cli overlay generate mission_concepts --force

# Regenerate strategic coherence
cognition-cli overlay generate strategic_coherence --force

# Verify concepts were extracted correctly
cognition-cli concepts list
```

---

### Claude Code Not Using PGC

**Symptom:** Claude reads source files instead of querying PGC

**Fix:** Create explicit slash commands that enforce PGC usage:

```markdown
---
description: Query architecture (PGC-only)
---

To answer the user's question:

1. Run \`cognition-cli patterns analyze\`
2. Use the PGC metadata to answer
3. DO NOT read source files directly
4. All claims must be verifiable via PGC queries
```

---

## Success Criteria

You've successfully integrated cognition-cli with Claude Code if:

✅ `.open_cognition/` directory exists
✅ `cognition-cli patterns analyze` shows your architecture
✅ `cognition-cli overlay list` shows generated overlays
✅ Claude Code queries PGC instead of reading source files
✅ You can verify all AI responses via PGC commands
✅ Pre-commit hooks run coherence checks (optional)
✅ CI/CD pipeline validates PGC state (optional)

---

## Next Steps

1. **Start with the Quick Start** — [Quick Start Guide](./claude/quick-start.md)
2. **Learn the commands** — [Command Reference](./claude/command-reference.md)
3. **Try real workflows** — [Real-World Workflows](./claude/workflows.md)
4. **Adopt patterns** — [Integration Patterns](./claude/integration-patterns.md)
5. **Follow best practices** — [Best Practices](./claude/best-practices.md)

---

## Philosophy: Verifiable AI Cognition

**The Core Idea:**

Every claim made by AI must be **verifiable** by running a PGC command.

This transforms AI from a **black box** into a **glass box**:

- You can see what data it used (PGC metadata)
- You can verify its reasoning (run the same commands)
- You can audit the provenance (cryptographic hashes)

**The Result:**

AI reasoning that is **grounded in truth**, not statistical approximation.

---

**Welcome to the future of AI-assisted development!** 🚀

---

**Further Reading:**

- [Quick Start Guide](./claude/quick-start.md)
- [Command Reference](./claude/command-reference.md)
- [Real-World Workflows](./claude/workflows.md)
- [Integration Patterns](./claude/integration-patterns.md)
- [Best Practices](./claude/best-practices.md)
