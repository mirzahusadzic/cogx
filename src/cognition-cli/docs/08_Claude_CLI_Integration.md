# 08 - Claude Code Integration: AI + PGC Symbiosis

**How `cognition-cli` and Claude Code work together to create a living, grounded development environment.**

---

## Overview

The `cognition-cli` is designed to work seamlessly with **Claude Code** (Anthropic's official CLI tool). Together, they create a powerful symbiosis:

- **Claude Code**: AI-powered coding assistant with deep reasoning capabilities
- **cognition-cli**: Verifiable, grounded knowledge graph of your codebase (PGC)
- **The Result**: AI reasoning anchored in cryptographic truth, not statistical approximation

This integration enables:

- ✅ **Grounded reasoning** - AI sees your actual architecture, not hallucinations
- ✅ **Mission alignment** - Track how code aligns with strategic vision
- ✅ **Impact analysis** - Understand blast radius before making changes
- ✅ **Living documentation** - PGC updates automatically with watch mode
- ✅ **Coherence checking** - Detect drift from architectural intent

---

## Table of Contents

### Getting Started

- **[Quick Start](./claude-integration/quick-start.md)** - 5-minute setup guide
- **[Slash Commands](./claude-integration/slash-commands.md)** - Using `.claude/commands/`
- **[Integration Patterns](./claude-integration/integration-patterns.md)** - Common workflows

### Core Features

- **[Structural Analysis](./claude-integration/structural-analysis.md)** - Architecture exploration with AI
- **[Impact Analysis](./claude-integration/impact-analysis.md)** - Blast radius & dependency tracking
- **[O₃ Mission Alignment](./claude-integration/o3-mission-alignment.md)** ⭐ NEW
  - Mission concepts extraction
  - Strategic coherence scoring
  - Document integrity auditing

### Development Workflows

- **[Best Practices](./claude-integration/best-practices.md)** - Recommended patterns
- **[Real-World Workflows](./claude-integration/workflows.md)** - End-to-end examples
- **[Git Integration](./claude-integration/git-integration.md)** - Pre-commit checks & PR reviews

### Reference

- **[Command Reference](./claude-integration/command-reference.md)** - All cognition-cli commands
- **[Troubleshooting](./claude-integration/troubleshooting.md)** - Common issues

---

## Quick Example

```bash
# 1. Initialize PGC and watch for changes
cognition-cli init
cognition-cli genesis src/
cognition-cli watch

# 2. In Claude Code, use slash commands
/status          # See what changed since last commit
/analyze-impact  # Understand blast radius
/coherence drifted  # Find code drifting from mission

# 3. Claude reasons about your code using grounded data
# All insights are backed by cryptographic provenance!
```

---

## What Makes This Different?

### Traditional AI Coding Assistants

```text
User: "Explain the architecture"
AI:   [Reads all code files]
      [Generates response based on pattern matching]
      ⚠️  May hallucinate non-existent patterns
      ⚠️  No provenance - can't verify claims
      ⚠️  Expensive context usage
```

### Claude Code + cognition-cli

```text
User: "Explain the architecture"
AI:   [Reads PGC structural patterns overlay]
      [Sees verified architectural roles]
      [Traces cryptographically-linked dependencies]
      ✅  Grounded in actual extracted structure
      ✅  Every claim has SHA-256 provenance
      ✅  Efficient - uses overlays, not raw code
```

---

## The Symbiosis Explained

```mermaid
graph LR
    A[Your Code] -->|genesis| B[PGC Index]
    B -->|overlay generate| C[O₁: Structural Patterns]
    B -->|overlay generate| D[O₂: Lineage Patterns]
    E[VISION.md] -->|genesis:docs| F[O₃: Mission Concepts]
    C -->|+ O₃| G[Strategic Coherence]

    H[Claude Code] -->|reads| C
    H -->|reads| D
    H -->|reads| G
    H -->|reasons about| I[Your Questions]
    I -->|grounded by| B
```

**The Flow:**

1. **You write code** → PGC captures structure automatically (via `watch`)
2. **Overlays extract patterns** → O₁ (structure), O₂ (lineage), O₃ (mission)
3. **Claude reads overlays** → Gets grounded, verifiable understanding
4. **Claude assists you** → With insights backed by cryptographic provenance

---

## What's Next?

Choose your path:

### 🚀 **New User?**

Start with **[Quick Start](./claude-integration/quick-start.md)** to set up in 5 minutes.

### 🎯 **Want Practical Examples?**

See **[Real-World Workflows](./claude-integration/workflows.md)** for end-to-end scenarios.

### 🔬 **Interested in Mission Alignment?**

Explore **[O₃ Mission Alignment](./claude-integration/o3-mission-alignment.md)** to track strategic coherence.

### 📚 **Need Command Reference?**

Browse **[Command Reference](./claude-integration/command-reference.md)** for all available commands.

---

## Resources

- **cognition-cli Documentation**: See other docs in this directory
- **Claude Code Docs**: <https://docs.claude.com/claude-code>
- **GitHub Issues**: <https://github.com/your-org/cognition-cli/issues>
- **Slash Commands**: See `.claude/commands/` in this repo

---

**Ready to start?** Head to **[Quick Start](./claude-integration/quick-start.md)** →
