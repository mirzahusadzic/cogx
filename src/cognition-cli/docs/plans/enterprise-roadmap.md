# Enterprise Product Ladder & Packaging Strategy

> **Revised:** 2026-03-25 (v3)
> **Context:** Grounded in (1) a real validation session where an external agent used cognition-cli to produce an actionable refactoring report, (2) a deep 5-agent technical audit of cognition-cli internals (Four Pillars, Update Function U, overlay algebra, lineage system, parser pipeline), and (3) a technical march plan for continuous lineage. This revision adds packaging strategy, pricing model, and go-to-market sequencing.

---

## 🏛️ Positioning: AI Governance Infrastructure

Cognition Σ is not an "AI coding tool." It is **AI governance infrastructure that makes AI agents auditable**.

- **Core thesis**: The biggest blocker to AI agents in regulated environments (defense, finance, medical) isn't capability — it's **auditability**. Organizations need to prove _why_ an agent made a change, verify it didn't introduce structural risk, and trace every decision to grounded evidence.
- **What we sell**: **Reasoning Lineage** + **Structural Integrity** + **Blast Radius Control** — the ability to answer "why did the AI change this?" with mathematical evidence, tracing every decision back to source code (⊥).
- **The differentiator**: Agent-agnostic analysis backend. Works under Claude Code, Copilot CLI, Cursor, the cognition-cli TUI, or any future agent. The reasoning lineage captures and verifies the same way regardless of which LLM is driving.
- **The moat**: Lattice algebra on code knowledge (meet, join, project across 768D vector spaces), content-addressable provenance with O(1) reverse lookups, and rehydratable memory from git history. Nobody else has this.

---

## 📦 Packaging Strategy: Ship the Backend, Let Others Be the Frontend

### The Principle

The moat is the algebra and the lineage chain. Not the UI. Ship the moat. Let other people's UIs sell it for you.

### Why Backend + Skills First (Not TUI)

1. **Skills are agent-agnostic** — already proven with Claude Code, Copilot CLI, and the TUI. Three frontends for free.
2. **The TUI competes on UX against teams of 200** — Anthropic, GitHub, Google all have chat UIs with more polish. Don't fight that battle yet.
3. **Enterprise buyers want integration, not replacement** — "works with your existing tools" beats "replace your tools with ours."
4. **Every hour on TUI polish is an hour not on lineage** — which is the actual product.
5. **SIGMA becomes a Phase 2 differentiator** — persistent memory across sessions is genuinely unique, but it's a premium upsell, not the initial sale.

### The Three-Layer Architecture

```
┌──────────────────────────────────────────────────────────┐
│  LAYER 3: Agent Frontends (interchangeable, NOT ours)    │
│  Claude Code / Copilot CLI / Cursor / cognition-cli TUI  │
│  ↕ Skills (.claude/commands/, slash commands, SIGMA)      │
├──────────────────────────────────────────────────────────┤
│  LAYER 2: Analysis Backend (THIS IS THE PRODUCT)         │
│  cognition-cli                                           │
│  lattice algebra · overlays (O₁-O₇) · PGC provenance    │
│  lineage · blast-radius · coherence · verify-provenance  │
│  report refactor · lineage record · lineage rehydrate    │
├──────────────────────────────────────────────────────────┤
│  LAYER 1: Inference Backend (local, air-gapped)          │
│  eGemma                                                  │
│  Gemma 300M embeddings · AST parsing (TS/PY/Rust/Go)    │
│  Metal/CUDA · OpenAI-compatible API · LanceDB embedded   │
└──────────────────────────────────────────────────────────┘
```

**Full stack runs air-gapped.** Layers 1+2 = no external network calls. Critical for defense/regulated.

### What Ships When

| Phase                             | What ships                  | How it's consumed                                     | Buyer                                   |
| --------------------------------- | --------------------------- | ----------------------------------------------------- | --------------------------------------- |
| **Phase 1: The Engine**           | cognition-cli + eGemma      | `npm i -g @cogx/cognition-cli` + `pip install egemma` | Engineering team installs               |
| **Phase 2: The Interface**        | Skills library              | Drop `.claude/commands/` into any repo                | Developers use naturally                |
| **Phase 3: The Output**           | Reports + provenance chains | Markdown/PDF/JSON artifacts                           | Compliance team consumes                |
| **Phase 4: The Platform** (later) | TUI + SIGMA                 | Full persistent AI workspace                          | Teams that want the complete experience |

---

## 💰 Pricing Model

### Free Tier (Community Adoption)

- cognition-cli + eGemma (full install)
- O₁ structural patterns + basic `find-similar`/`compare`
- Skills for Claude Code / Copilot / Cursor
- `lineage rehydrate` from git history
- **Goal:** Land. Get developers using it. Build community.

### Pro Tier ($X/dev/month)

- Full continuous lineage (recording, rehydration, git hooks)
- O₇ coherence with drift detection
- `verify-provenance` command
- `report refactor` command
- Air-gapped eGemma with all language parsers
- **Goal:** Convert. Teams that need auditability.

### Enterprise Tier ($Y/dev/month)

- Compliance report generation (PDF, evidence packages)
- Coherence drift monitoring over time
- CI/CD integration (PR checks, merge gates)
- Priority support + SLA
- Custom overlay development (domain-specific O₂ rules, etc.)
- **Goal:** Expand. Organizations with compliance requirements.

### Platform Tier (future, $Z/dev/month)

- TUI + SIGMA persistent memory
- Team-wide coherence dashboards
- Cross-repo lineage
- The "replace your dev workflow" product
- **Goal:** Own. For teams that want the full AI-assisted experience.

---

## 🪜 The Enterprise Product Ladder

A value ladder from one-time audit to continuous governance. Each tier validates the next.

### A. The Surgeon (One-Time Audit) — **BUILD NOW**

- **Service**: Automated structural refactoring report.
- **Delivery**: Single command (`cognition-cli report refactor`) produces a grounded markdown/PDF report with exact LOC counts, line references, priority tiers, and execution order.
- **Target**: CTOs of Series B/C scale-ups; PE firms doing technical due diligence for M&A.
- **Pricing**: Fixed-fee per codebase analysis ($5K–$15K depending on size).
- **Validation**: We produced this exact artifact manually today. Automating it is the MVP.

**What the report contains** (proven by real output):

- Candidate groups ranked by priority (🔴 High / 🟡 Medium / 🟢 Low)
- Exact file paths, line numbers, and LOC savings per candidate
- Concrete fix descriptions (not "extract base class" — "extract `GenericRelationshipRepository` with `add()`, `remove()`, `list_for_parent()`, override hook for unique methods")
- Rejected false positives with explanation (builds trust)
- Blast-radius data for decomposition targets
- Summary table with effort/risk assessment and recommended execution order

### B. The Bouncer (CI/CD Integration) — **BUILD AFTER FIRST CUSTOMER**

- **Service**: Continuous structural analysis in CI pipelines (GitHub Actions / GitLab CI).
- **Delivery**: PR check that runs `blast-radius` on changed files, blocks merges if coherence drops below threshold.
- **Outcome**: Automated PR annotations showing structural impact of changes.
- **Pricing**: Monthly SaaS (Pro tier).
- **Prerequisite**: Continuous lineage (technical march plan Phases 1-2).

### C. The Chiropractor (Reasoning Lineage) — **THE REAL PRODUCT**

- **Service**: Commit-time reasoning capture — every code change gets a verifiable provenance record in `.open_cognition/`.
- **What it records per commit** (from technical march plan):
  - Per-file reasoning (from agent IntentAdapter or git commit message)
  - Transform chain: inputs → outputs with SHA-256 hashes
  - Git context: commit hash, author, message, timestamp
  - Source attribution: developer vs AI agent vs automated tool
  - Blast-radius before/after
  - Coherence delta
- **Rehydratable**: `lineage rehydrate` reconstructs full history from a bare `git clone`. The system's memory regenerates from the bones.
- **Verifiable**: `verify-provenance` traces any artifact back to ⊥ (source code) through the full transform chain.
- **Why it matters**: Transforms AI agent output from "here's a diff" to "here's an auditable decision trail." This is the compliance layer that green-lights agents in regulated environments.
- **Target**: Defense contractors, financial institutions, medical device companies — anyone who needs auditable AI.
- **Pricing**: Enterprise tier.

### D–E. Future Vision (Not in Scope)

Kept for strategic direction but **not prioritized** until Tiers A–C generate revenue:

- **D. The Immune System**: Runtime-to-structure feedback loops (O₃ lineage maps production errors back to structural flaws).
- **E. The Symbiote**: Distributed reasoning network across an engineering org. TUI + SIGMA as the full platform.

---

## 📅 Go-to-Market Timeline

### Month 1-2: Ship the Engine

**Technical work:** Complete march plan Phases 1–2.5 (see `technical-march-plan.md`)

| Week | Deliverable                                                      | Technical Phase |
| ---- | ---------------------------------------------------------------- | --------------- |
| 1-2  | Extend Transformation schema + soft-delete + git extractor       | Phase 1         |
| 3-4  | Auto-update watch + `lineage record` command + git hooks install | Phase 2         |
| 4-5  | `lineage rehydrate` from git history                             | Phase 2.5       |
| 5-6  | Agent IntentAdapter + `lineage intent` command                   | Phase 2         |

**Package:**

- [ ] `npm install -g @cogx/cognition-cli`
- [ ] `pip install egemma`
- [ ] One-command setup: `cognition-cli init → genesis → hooks install → watch`
- [ ] `lineage rehydrate` reconstructs full history from day one

### Month 3: Ship the Interface + `report refactor`

**Technical work:** `report refactor` command + skill library

| Week | Deliverable                                                                           |
| ---- | ------------------------------------------------------------------------------------- |
| 1-2  | `report refactor` command (automate 3-step pipeline: find-similar → compare → ground) |
| 2    | JSON output mode for CI integration (`--format json`)                                 |
| 3-4  | Skill library audit — encode correct tool pipelines in all `.claude/commands/`        |
| 4    | Skill packaging for Claude Code, Copilot CLI, Cursor                                  |

**Template:** Use the rca-catalyst `refactor-candidates.md` as the output template.

### Month 4: Ship the Reports + First Customer

**Technical work:** March plan Phase 3 (provenance engine)

| Week | Deliverable                                                   | Technical Phase |
| ---- | ------------------------------------------------------------- | --------------- |
| 1-2  | Transform DAG + Provenance service                            | Phase 3         |
| 2-3  | `verify-provenance` command + complete blast radius           | Phase 3         |
| 3-4  | Compliance report generation (markdown/PDF evidence packages) | —               |

**Customer acquisition:**

- [ ] Identify 10 targets: defense-adjacent, scale-ups with tech debt, PE firms
- [ ] For each: run `report refactor` on public repos or offer free audit
- [ ] Pitch: "We make AI agents auditable. Here's what we found in yours."
- [ ] Deliver the refactoring report as the demo artifact

### Month 5: Rust Parser + Air-Gap + Storefront

| Week | Deliverable                                                     |
| ---- | --------------------------------------------------------------- |
| 1-2  | Rust AST parser in eGemma (via `syn` crate)                     |
| 2-3  | Air-gapped Docker deployment (cognition-cli + eGemma + LanceDB) |
| 3    | Compliance data-flow document (what stays local: everything)    |
| 4    | Landing page + 2-3 "Architectural Tear-Down" lead magnets       |

### Month 6: Close the Loop + Intent-Grounded Coherence

**Technical work:** March plan Phases 4-5 (living loop + intent-grounded coherence)

| Week | Deliverable                                                    | Technical Phase |
| ---- | -------------------------------------------------------------- | --------------- |
| 1-2  | Reactive update pipeline (watch → update → invalidate → regen) | Phase 4         |
| 2-3  | Selective overlay regeneration + coherence drift detection     | Phase 4         |
| 3-4  | Intent embedding generator + three-way coherence (O₇v2)        | Phase 5         |
| 4    | Temporal coherence report (`coherence report --history`)       | Phase 5         |

**Business:**

- [ ] Convert free audit leads to Pro/Enterprise tier
- [ ] Publish case study from first paying customer
- [ ] Evaluate demand for TUI + SIGMA (Platform tier)

**What Month 6 delivers:** Coherence shifts from shadow-only (structural + docstring) to three-way meet (Structure × Mission × Intent). False drift on infrastructure symbols eliminated. Temporal tracking shows coherence evolution per commit with reasoning attached. This is the "sci-fi" feature that's actually just a SQL query over the transform log joined with coherence deltas.

---

## 📊 When to Ship the TUI

The TUI + SIGMA ships as the Platform tier **only when**:

1. ✅ At least 3 paying customers on Pro/Enterprise tier (demand validated)
2. ✅ Customers explicitly ask for persistent memory / full workspace experience
3. ✅ Lineage system is battle-tested (6+ months of production use)
4. ✅ The backend alone is generating enough revenue to fund TUI development

**Until then:** Keep TUI alive internally. Use it for demos. Use it for own development. SIGMA's persistent memory is genuinely unique and shows well. But don't ship it as the product until a customer asks.

---

## ⛔ Explicitly Deprioritized

| Item                               | Reason                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| TUI as primary product             | Ship backend + skills first. TUI is Phase 2 when customers ask.                |
| SIGMA as initial selling point     | Competitive advantage, but not the initial sale. Premium upsell later.         |
| O₅ Operational Patterns overlay    | Proven underused; no customer demand signal                                    |
| O₆ Mathematical Proofs overlay     | Requires a proper math analyzer; aspirational without one                      |
| IPC Sigma Bus / distributed agents | Tier E vision; years away from mattering                                       |
| Multi-LLM provider support         | Pick Gemini (own eGemma stack) as primary; others work via skills              |
| Go parser                          | Lower priority than Rust for defense market; add after Rust proves the pattern |

---

## 🎯 Success Metrics

### 90-Day Targets

| Metric                            | Target                                                   |
| --------------------------------- | -------------------------------------------------------- |
| Continuous lineage shipped        | ✅ Git hooks + record + rehydrate + intent adapter       |
| `report refactor` command shipped | ✅ Working, tested on 3+ codebases                       |
| Skills library packaged           | ✅ All `.claude/commands/` encode correct tool pipelines |
| Free tier installs                | ≥ 50 (community signal)                                  |
| Outbound conversations            | ≥ 10 with engineering leads                              |

### 6-Month Targets

| Metric                                          | Target                                                     |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `verify-provenance` + provenance engine shipped | ✅ Full chain verification                                 |
| Rust parser in eGemma                           | ✅ Full overlay generation on Rust codebase                |
| Air-gapped Docker deployment                    | ✅ Zero-network mode verified                              |
| Intent-grounded coherence (O₇v2) shipped        | ✅ Three-way meet: Structure × Mission × Intent            |
| Temporal coherence tracking                     | ✅ `coherence report --history` shows per-commit evolution |
| Paying customers                                | ≥ 1 (Tier A audit, converting to Pro/Enterprise)           |
| Coherence drift detection live                  | ✅ Reactive loop operational                               |

---

## 📐 Grounding: What We Proved

### Session 1: Refactoring Analysis (2026-03-25)

An external agent (GitHub Copilot CLI / Opus 4.6) ran the full pipeline on rca-catalyst:

1. **Discovery**: `patterns find-similar` across 7 seed symbols, 327 total patterns
2. **Validation gap**: `compare` was skipped → 3 false positives required expensive code-reading
3. **Grounding**: 7 parallel agents validated candidates against real source
4. **Output**: 14-candidate report, ~1,500–1,900 LOC savings, prioritized execution order
5. **Skill improvement**: `find-refactor-candidates.md` rewritten to encode 3-step pipeline

### Session 2: Deep Technical Audit (2026-03-25)

5 parallel agents audited cognition-cli internals (Four Pillars, Update Function U, overlay algebra, lineage/provenance, parser/embedding pipeline):

1. **Four Pillars verified**: objects/ (solid), index/ (solid), transforms/ (partial — no reasoning, deletable), reverse_deps/ (solid, O(1) confirmed)
2. **Update Function U works**: Recursive cascade via reverse_deps, chokidar watcher, dirty_state.json — but manually triggered
3. **Algebra is real**: meet/join/∩/∪/\/¬/project on 768D vectors, cosine similarity hand-rolled, mathematically correct
4. **Gap identified**: Transforms record WHAT (goal.objective) but not WHY (no reasoning/intent field). No git integration. No transform→transform DAG.
5. **Technical march plan produced**: 5 phases, 14 tasks, ~2,540 LOC to complete continuous lineage + rehydratable memory

**Key lesson**: The analysis backend works. The skills are the product interface. The moat is the algebra and the lineage chain. Ship the moat. Let other people's UIs sell it for you.
