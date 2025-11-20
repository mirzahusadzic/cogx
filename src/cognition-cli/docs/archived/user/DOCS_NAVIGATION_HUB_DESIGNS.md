# Navigation Hub Designs

> **⚠️ ARCHIVED**: This document represents a historical snapshot and may contain outdated information (e.g., references to "three pillars" instead of "four pillars"). For current documentation structure, see [docs/index.md](../../index.md).

## Cognition Σ Documentation

**Purpose**: Template designs for all documentation hub files (README.md at key locations)

---

## Hub 1: Root README.md (Main Entry Point)

**Location**: `/README.md`
**Audience**: All users (first-time visitors)
**Purpose**: Welcome, orient, and direct users to appropriate documentation

### Structure

```markdown
# CogX: A Blueprint for Verifiable, Agentic AI

[Echo quote - keep existing]

[Logo - keep existing]

[Badges - keep existing]

## Vision

> **Augment human consciousness through verifiable AI-human symbiosis. Ignite the spark of progress.**

This repository contains the architectural blueprint for **Open Cognition** (CogX)—a system that creates verifiable AI-human symbiosis by solving the fundamental limitation of modern LLMs: their lack of persistent, verifiable memory.

**The goal is not better AI. The goal is to accelerate human progress** by providing mathematical foundations for AI systems that augment, rather than replace, human intelligence.

**Read the full manifesto**: **[VISION.md](docs/research/vision.md)** — Mission, symbiosis architecture, strategic intent, and why AGPLv3.

---

## 🚀 Quick Start

**New to Cognition Σ?** Start here:

1. **[Installation](docs/getting-started/installation.md)** — Install cognition-cli
2. **[Your First Project](docs/getting-started/first-project.md)** — Create your first lattice
3. **[Core Concepts](docs/getting-started/core-concepts.md)** — Understand PGC, overlays, and cPOW

**[📚 Complete Documentation →](docs/README.md)**

---

## 📖 Documentation

### For Users

- **[Getting Started](docs/getting-started/README.md)** — Installation and first steps
- **[User Guides](docs/guides/README.md)** — Task-oriented how-tos
- **[CLI Reference](docs/reference/cli-commands.md)** — Complete command reference
- **[FAQ](docs/faq.md)** — Frequently asked questions
- **[Troubleshooting](docs/troubleshooting.md)** — Common issues and solutions

### For Developers & Integrators

- **[Architecture Documentation](docs/architecture/README.md)** — Deep technical dive
- **[API Reference](src/cognition-cli/docs/api/)** — TypeScript API documentation
- **[Contributing Guide](CONTRIBUTING.md)** — How to contribute

### For Researchers

- **[Theoretical Blueprint](docs/architecture/blueprint/README.md)** — Mathematical foundations
- **[Research Papers](docs/research/README.md)** — Cognitive prosthetics, dual-use mandate
- **[Architecture Decision Records](docs/architecture/adrs/README.md)** — Design decisions

---

## 🏗️ Key Concepts

- **🧠 Grounded Context Pool (PGC)**: Persistent, verifiable memory for AI systems
- **🎭 Seven Overlays (O₁-O₇)**: Structure, Security, Lineage, Mission, Operational, Mathematical, Coherence
- **⚡ Cognitive Proof of Work (cPOW)**: Verification mechanism for AI contributions
- **Σ Sigma Dual-Lattice**: Infinite context through dual-lattice architecture

**[Learn more about the architecture →](docs/architecture/README.md)**

---

## 🎯 Latest Release

**November 16, 2025** — [v2.4.0: Production Excellence](https://github.com/mirzahusadzic/cogx/releases/tag/v2.4.0)

[Release highlights - keep existing]

**[View Full Changelog →](CHANGELOG.md)**

---

## 🤝 Contributing

We welcome contributions! Please read:

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Contribution guidelines
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — Community standards
- **[SECURITY.md](SECURITY.md)** — Security policy

---

## 📄 License & Legal

- **License**: [AGPLv3](LICENSE) — Copyleft, open source
- **Defensive Publication**: [Why this matters](docs/research/defensive-publication.md)
- **DOI**: [10.5281/zenodo.17567109](https://doi.org/10.5281/zenodo.17567109)

---

## 🔗 Links

- **[Documentation Site](https://mirzahusadzic.github.io/cogx/)** — Rendered documentation
- **[GitHub Discussions](https://github.com/mirzahusadzic/cogx/discussions)** — Community discussions
- **[Issues](https://github.com/mirzahusadzic/cogx/issues)** — Bug reports and feature requests
- **[Releases](https://github.com/mirzahusadzic/cogx/releases)** — Release history

---

**Built with ❤️ for human-AI symbiosis**
```

---

## Hub 2: docs/README.md (Documentation Hub)

**Location**: `/docs/README.md`
**Audience**: All users seeking documentation
**Purpose**: Central navigation hub for all documentation

### Structure

```markdown
# Cognition Σ Documentation

Welcome to the Cognition Σ documentation hub. This is your central navigation point for all documentation.

---

## 🚀 New to Cognition Σ?

**Start here if you're new**:

1. **[Installation](getting-started/installation.md)** — Install cognition-cli
2. **[Your First Project](getting-started/first-project.md)** — Create your first lattice
3. **[Core Concepts](getting-started/core-concepts.md)** — Understand key concepts

**Need help?** Check the **[FAQ](faq.md)** or **[Troubleshooting Guide](troubleshooting.md)**.

---

## 📋 Browse by User Journey

### I want to learn how to use Cognition Σ

👉 **[User Guides](guides/README.md)** — Task-oriented how-to guides

**Popular guides**:

- [Querying the Lattice](guides/querying-the-lattice.md) — Learn the query syntax
- [Interactive TUI Mode](guides/interactive-mode.md) — Use the terminal interface
- [Daily Workflow](guides/daily-workflow.md) — Integrate into your workflow
- [Claude Integration](guides/claude-integration.md) — Use with Claude Code

### I need to look something up

👉 **[Reference Documentation](reference/README.md)** — CLI commands, config, API

**Quick links**:

- [CLI Commands](reference/cli-commands.md) — Complete command reference
- [Configuration](reference/configuration.md) — Config options
- [LLM Providers](reference/llm-providers.md) — Supported LLM providers
- [.cogx Format](reference/cogx-format.md) — File format specification

### I want to understand how it works

👉 **[Architecture Documentation](architecture/README.md)** — Deep technical dive

**Start with**:

- [Architecture Overview](architecture/README.md) — High-level overview
- [Theoretical Blueprint](architecture/blueprint/README.md) — Mathematical foundations
- [Seven Overlays](architecture/overlays/README.md) — O₁ through O₇
- [PGC & Dual-Lattice](architecture/pgc/README.md) — Grounded Context Pool

### I want to read research papers

👉 **[Research Documentation](research/README.md)** — Theory and papers

**Highlights**:

- [Cognitive Prosthetics](research/cognitive-prosthetics.md) — Core concept paper
- [Dual-Use Mandate](research/dual-use-mandate.md) — Security philosophy
- [Defensive Publication](research/defensive-publication.md) — Legal protection

### I want to contribute code

👉 **[Contributing Guide](../CONTRIBUTING.md)** — How to contribute

**Developer resources**:

- [Architecture Decision Records](architecture/adrs/README.md) — Design decisions
- [Internal Architecture](architecture/implementation/internal-architecture.md) — Codebase structure
- [API Reference](../src/cognition-cli/docs/api/) — TypeScript API docs

---

## 📚 Browse by Topic

### Getting Started

- [Installation](getting-started/installation.md)
- [First Project](getting-started/first-project.md)
- [Core Concepts](getting-started/core-concepts.md)

### Guides (How-To)

- [Querying the Lattice](guides/querying-the-lattice.md)
- [Interactive TUI Mode](guides/interactive-mode.md)
- [Daily Workflow](guides/daily-workflow.md)
- [Claude Integration](guides/claude-integration.md)
- [Pattern Discovery](guides/pattern-discovery.md)

### Reference

- [CLI Commands](reference/cli-commands.md)
- [Configuration](reference/configuration.md)
- [LLM Providers](reference/llm-providers.md)
- [.cogx Format](reference/cogx-format.md)
- [API Reference](../src/cognition-cli/docs/api/)

### Architecture

- [Overview](architecture/README.md)
- [Theoretical Blueprint](architecture/blueprint/README.md)
- [Implementation Details](architecture/implementation/README.md)
- [Seven Overlays (O₁-O₇)](architecture/overlays/README.md)
- [Grounded Context Pool](architecture/pgc/README.md)
- [Cognitive Proof of Work](architecture/cpow/README.md)
- [Σ Sigma Dual-Lattice](architecture/sigma/README.md)
- [Architecture Decision Records](architecture/adrs/README.md)

### Research

- [Cognitive Prosthetics](research/cognitive-prosthetics.md)
- [Dual-Use Mandate](research/dual-use-mandate.md)
- [Defensive Publication](research/defensive-publication.md)
- [Testable Promises](research/testable-promises.md)

### Help & Support

- [FAQ](faq.md) — Frequently asked questions
- [Troubleshooting](troubleshooting.md) — Common issues and solutions

---

## 🔍 Can't Find What You're Looking For?

- **Search** the documentation (use your editor's search or GitHub search)
- **Ask** in [GitHub Discussions](https://github.com/mirzahusadzic/cogx/discussions)
- **File an issue** for [documentation improvements](https://github.com/mirzahusadzic/cogx/issues/new)

---

## 📝 Contributing to Documentation

Found a typo? Want to improve a guide? See **[CONTRIBUTING.md](../CONTRIBUTING.md)** for how to contribute to documentation.

---

**[🏠 Back to Main README](../README.md)**
```

---

## Hub 3: internal/README.md (Maintainer Hub)

**Location**: `/internal/README.md`
**Audience**: Core maintainers and contributors
**Purpose**: Access internal documentation, audits, and development resources

### Structure

```markdown
# Internal Documentation (Maintainers Only)

This directory contains internal documentation for Cognition Σ maintainers and core contributors.

**⚠️ Note**: This content is not intended for end users. For user-facing documentation, see [/docs/](../docs/README.md).

---

## 📊 Audit Reports & Analysis

**[View All Audits →](audits/README.md)**

### Recent Audits

**Performance & Quality**:

- [Performance Audit Report](audits/performance-audit-report.md)
- [Error Handling Audit](audits/error-handling-audit.md)
- [Test Coverage Analysis](audits/test-coverage-analysis.md)

**User Experience**:

- [UX Analysis Report](audits/ux-analysis-report.md)
- [UX Roadmap Tickets](audits/ux-roadmap-tickets.md)

**Architecture & Code Quality**:

- [Overlay Analysis (Nov 2025)](audits/overlay-analysis-2025-11-17.md)
- [Lattice Book Audit Report](audits/lattice-book-audit-report.md)
- [Lattice Book Verification](audits/lattice-book-verification.md)

**Dependencies & Security**:

- [Dependency Health Report](audits/dependency-health-report.md)
- [Security CVE Audit Proposal](audits/security-cve-audit-proposal.md)

**Fixes & Summaries**:

- [Fix Summary: Session Lifecycle](audits/fix-summary-session-lifecycle.md)

---

## 🤖 LLM Worker Prompts

**[View All Prompts →](prompts/README.md)**

**Development & DX**:

- [DX Worker Prompt](prompts/dx.md)
- [DX P1 Implementation](prompts/dx-implement-p1.md)
- [TUI Enhancements & Bugs](prompts/tui-enhancements-bugs.md)

**Architecture & Features**:

- [cPOW Implementation](prompts/implement-cpow.md)
- [Overlay Analysis Prompt](prompts/overlay-analysis-prompt.md)

**Testing & Quality**:

- [Test Coverage Gap Analysis](prompts/test-coverage-gap-analysis.md)
- [Error Handling & Recovery](prompts/error-handling-recovery.md)
- [Error Handling & Resilience](prompts/error-handling-resilience.md)

**Documentation**:

- [Lattice Book Documentation](prompts/docs-lattice-book.md)
- [ADR Prompt](prompts/adr.md)

**Ecosystem**:

- [Ecosystem Analysis](prompts/ecosys.md)
- [Dependency Analysis](prompts/deps.md)

---

## 📈 Implementation Status

**[View All Status Reports →](status/README.md)**

- [Overlay Implementation Status](status/overlay-implementation-status.md)

---

## 🛠️ Development Guides

**[View All Dev Guides →](development/README.md)**

### Code Quality & Standards

- [Style Guide](development/style-guide.md) — Code style and conventions
- [Tab Completion Guide](development/tab-completion-guide.md) — CLI tab completion

### Process Guides

- [Testing Strategy](development/testing-strategy.md) — Testing approach
- [Release Process](development/release-process.md) — How to release

---

## 🔗 Related Resources

### User-Facing Documentation

- [Main Documentation Hub](../docs/README.md)
- [Architecture Documentation](../docs/architecture/README.md)
- [Contributing Guide](../CONTRIBUTING.md)

### Development Resources

- [Architecture Decision Records](../docs/architecture/adrs/README.md)
- [Internal Architecture Docs](../docs/architecture/implementation/README.md)

---

## 📝 Creating New Internal Docs

When adding new internal documentation:

1. **Audits**: Add to `audits/` and update `audits/README.md`
2. **Worker Prompts**: Add to `prompts/` and update `prompts/README.md`
3. **Status Reports**: Add to `status/` and update `status/README.md`
4. **Dev Guides**: Add to `development/` and update `development/README.md`

Always update the relevant README.md index when adding new files.

---

**[🏠 Back to Main README](../README.md)** | **[📚 User Documentation](../docs/README.md)**
```

---

## Hub 4: docs/getting-started/README.md

**Location**: `/docs/getting-started/README.md`
**Audience**: New users
**Purpose**: Welcome and onboard new users

### Structure

```markdown
# Getting Started with Cognition Σ

Welcome! This guide will help you install Cognition Σ and create your first project.

---

## Quick Start (5 minutes)

### Step 1: Installation

**[→ Installation Guide](installation.md)**

Install the `cognition` CLI:

\`\`\`bash
npm install -g cognition-cli
\`\`\`

Verify installation:

\`\`\`bash
cognition --version
\`\`\`

### Step 2: Your First Project

**[→ First Project Guide](first-project.md)**

Create your first lattice:

\`\`\`bash
cognition init my-first-lattice
cd my-first-lattice
cognition add "Hello, Cognition Σ!"
\`\`\`

### Step 3: Understand Core Concepts

**[→ Core Concepts](core-concepts.md)**

Learn about:

- **PGC (Grounded Context Pool)**: Persistent memory
- **Overlays (O₁-O₇)**: Seven dimensions of knowledge
- **cPOW (Cognitive Proof of Work)**: Verification mechanism

---

## Next Steps

### Learn by Doing

- **[Daily Workflow Guide](../guides/daily-workflow.md)** — Integrate into your workflow
- **[Querying the Lattice](../guides/querying-the-lattice.md)** — Learn query syntax
- **[Interactive TUI Mode](../guides/interactive-mode.md)** — Use the terminal UI

### Learn by Reading

- **[Architecture Overview](../architecture/README.md)** — How Cognition Σ works
- **[Seven Overlays](../architecture/overlays/README.md)** — O₁ through O₇ explained
- **[Theoretical Blueprint](../architecture/blueprint/README.md)** — Mathematical foundations

### Get Help

- **[FAQ](../faq.md)** — Frequently asked questions
- **[Troubleshooting](../troubleshooting.md)** — Common issues
- **[GitHub Discussions](https://github.com/mirzahusadzic/cogx/discussions)** — Ask questions

---

**[🏠 Back to Documentation Hub](../README.md)**
```

---

## Hub 5: docs/architecture/README.md

**Location**: `/docs/architecture/README.md`
**Audience**: Developers, researchers
**Purpose**: Navigate architecture documentation

### Structure

```markdown
# Architecture Documentation

Complete technical documentation of the Cognition Σ architecture.

---

## Overview

Cognition Σ is built on three core pillars:

1. **🧠 Grounded Context Pool (PGC)**: Persistent, verifiable memory
2. **🎭 Seven Overlays (O₁-O₇)**: Multi-dimensional knowledge representation
3. **⚡ Cognitive Proof of Work (cPOW)**: Verification and trust mechanism

---

## Documentation Paths

### For Researchers: Theoretical Foundation

**Start with the blueprint** — mathematical and theoretical foundations:

1. **[Theoretical Blueprint](blueprint/README.md)** — 27-page comprehensive blueprint
   - Axioms and theorems
   - Mathematical proofs
   - Economic model

2. **[Research Papers](../research/README.md)** — Core concept papers
   - Cognitive prosthetics
   - Dual-use mandate

### For Developers: Implementation Details

**Understand the implementation**:

1. **[Implementation Architecture](implementation/README.md)** — How it's built
   - Core infrastructure
   - Internal architecture
   - Structural analysis

2. **[Architecture Decision Records](adrs/README.md)** — Why decisions were made
   - 10 ADRs documenting key decisions

### For All: Key Systems

**Deep dive into specific systems**:

- **[Seven Overlays (O₁-O₇)](overlays/README.md)** — Multi-dimensional knowledge
- **[Grounded Context Pool](pgc/README.md)** — Persistent memory system
- **[Cognitive Proof of Work](cpow/README.md)** — Verification mechanism
- **[Σ Sigma Dual-Lattice](sigma/README.md)** — Infinite context architecture

---

## Architecture Components

### 🎭 Seven Overlays (O₁-O₇)

The overlay system provides seven orthogonal dimensions of knowledge representation:

1. **[O₁: Structure](overlays/O1-structure.md)** — Code structure and patterns
2. **[O₂: Security](overlays/O2-security.md)** — Security analysis and threats
3. **[O₃: Lineage](overlays/O3-lineage.md)** — Provenance and history
4. **[O₄: Mission](overlays/O4-mission.md)** — Intent and purpose
5. **[O₅: Operational](overlays/O5-operational.md)** — Runtime behavior
6. **[O₆: Mathematical](overlays/O6-mathematical.md)** — Formal verification
7. **[O₇: Coherence](overlays/O7-coherence.md)** — Cross-overlay consistency

**[Learn more about overlays →](overlays/README.md)**

### 🧠 Grounded Context Pool (PGC)

Persistent, verifiable memory for AI systems:

- **[PGC Overview](pgc/README.md)** — What is the PGC?
- **[Dual-Lattice Architecture](pgc/dual-lattice.md)** — Σ (Sigma) system
- **[Embedding System](pgc/embeddings.md)** — Semantic embeddings
- **[Lattice Algebra](pgc/algebra.md)** — Boolean operations

**[Learn more about PGC →](pgc/README.md)**

### ⚡ Cognitive Proof of Work (cPOW)

Verification mechanism for AI contributions:

- **[cPOW Overview](cpow/README.md)** — What is cPOW?
- **[Operational Flow](cpow/operational-flow.md)** — How it works
- **[Quest Structures](cpow/quest-structures.md)** — Quest system
- **[Miners & Executors](cpow/miners-and-executors.md)** — Verification process
- **[Verification](cpow/verification.md)** — Oracles and verification

**[Learn more about cPOW →](cpow/README.md)**

---

## Complete Architecture Index

### Theoretical Foundation

- **[Blueprint](blueprint/README.md)** — 27-page theoretical blueprint
- **[Research Papers](../research/README.md)** — Concept papers

### Implementation

- **[Implementation Docs](implementation/README.md)** — Implementation architecture
- **[ADRs](adrs/README.md)** — Architecture decision records

### Key Systems

- **[Overlays](overlays/README.md)** — O₁ through O₇
- **[PGC](pgc/README.md)** — Grounded Context Pool
- **[cPOW](cpow/README.md)** — Cognitive Proof of Work
- **[Sigma](sigma/README.md)** — Σ dual-lattice

---

## Related Documentation

- **[User Guides](../guides/README.md)** — How to use Cognition Σ
- **[Reference Docs](../reference/README.md)** — CLI and API reference
- **[Contributing](../../CONTRIBUTING.md)** — How to contribute

---

**[🏠 Back to Documentation Hub](../README.md)**
```

---

## Additional Hub Templates

### docs/guides/README.md

```markdown
# User Guides

Task-oriented guides for using Cognition Σ.

## Guides

- **[Querying the Lattice](querying-the-lattice.md)** — Learn query syntax
- **[Interactive TUI Mode](interactive-mode.md)** — Use the terminal interface
- **[Daily Workflow](daily-workflow.md)** — Integrate into your workflow
- **[Claude Integration](claude-integration.md)** — Use with Claude Code
- **[Pattern Discovery](pattern-discovery.md)** — Discover patterns in your lattice

**[🏠 Back to Documentation Hub](../README.md)**
```

### docs/reference/README.md

```markdown
# Reference Documentation

Quick lookup reference for commands, configuration, and APIs.

## References

- **[CLI Commands](cli-commands.md)** — Complete command reference
- **[Configuration](configuration.md)** — Configuration options
- **[LLM Providers](llm-providers.md)** — Supported LLM providers
- **[.cogx Format](cogx-format.md)** — File format specification
- **[API Reference](../../src/cognition-cli/docs/api/)** — TypeScript API docs

**[🏠 Back to Documentation Hub](../README.md)**
```

### docs/research/README.md

```markdown
# Research Documentation

Theoretical foundations and research papers for Cognition Σ.

## Papers

- **[Cognitive Prosthetics](cognitive-prosthetics.md)** — Core concept paper
- **[Dual-Use Mandate](dual-use-mandate.md)** — Security philosophy
- **[Defensive Publication](defensive-publication.md)** — Legal protection
- **[Testable Promises](testable-promises.md)** — Verification approach

## Related

- **[Theoretical Blueprint](../architecture/blueprint/README.md)** — Mathematical foundations
- **[Architecture Overview](../architecture/README.md)** — Technical architecture

**[🏠 Back to Documentation Hub](../README.md)**
```

---

## Navigation Patterns

### Breadcrumbs (Add to top of deep pages)

```markdown
[Home](../../../README.md) / [Docs](../../README.md) / [Architecture](../README.md) / [Overlays](README.md) / **O2 Security**
```

### Next Steps (Add to bottom of sequential pages)

```markdown
## Next Steps

- ➡️ **Next**: [O3 Lineage](O3-lineage.md)
- 📚 **All Overlays**: [Overlay Index](README.md)
- 🏠 **Architecture Home**: [Architecture](../README.md)
```

### Related Reading (Add to related content)

```markdown
> **Related Reading**:
>
> - For implementation details, see [Internal Architecture](../implementation/internal-architecture.md)
> - For theoretical foundation, see [Blueprint: Architectural Deep Dive](../blueprint/06-architectural-deep-dive.md)
> - For practical usage, see [Querying the Lattice](../../guides/querying-the-lattice.md)
```

---

## Summary

These hub designs provide:

- ✅ Clear entry points for all audiences
- ✅ Multiple navigation paths (by journey, by topic)
- ✅ Consistent structure across all hubs
- ✅ Progressive disclosure (simple → complex)
- ✅ Cross-references to related content

When implementing, use these templates to create all README.md files at key locations in the new documentation structure.
