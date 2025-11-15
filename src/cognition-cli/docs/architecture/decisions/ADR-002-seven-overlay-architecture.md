# ADR-002: Seven-Overlay Architecture (O₁-O₇)

**Date**: Circa 2024
**Status**: Accepted
**Deciders**: Core team

## Context

Traditional code analysis tools store knowledge in flat, homogeneous structures where all information has equal weight. This creates four critical failures:

1. **No Targeted Queries** - Cannot ask "Show me only security patterns" because everything is mixed
2. **No Compositional Operations** - Cannot combine dimensions like "security patterns aligned with mission"
3. **No Separate Evolution** - Mission concepts (mutable) and security threats (immutable) treated identically
4. **No Portability** - Cannot export specific knowledge types (e.g., "just security") for reuse

**The Cognitive Mismatch:**

Different knowledge types require different cognitive operations:
- Code structure → Recognition ("What symbols exist?")
- Security threats → Threat analysis ("What attacks this?")
- Dependencies → Impact analysis ("What breaks if I change this?")
- Mission alignment → Alignment scoring ("Does this serve our purpose?")

We needed an architecture that separates knowledge by **cognitive dimension** rather than physical location, enabling targeted queries, compositional reasoning, and independent evolution.

## Decision

We implemented a **seven-overlay architecture** where each overlay represents an orthogonal cognitive dimension:

| Overlay | Name | Cognitive Operation | Mutability | Portability |
|---------|------|-------------------|------------|-------------|
| **O₁** | Structure | Recognition | High | No |
| **O₂** | Security | Threat analysis | Low | Yes |
| **O₃** | Lineage | Impact analysis | High | No |
| **O₄** | Mission | Alignment scoring | Medium | Maybe |
| **O₅** | Operational | Workflow guidance | Medium | Maybe |
| **O₆** | Mathematical | Formal verification | Very Low | Maybe |
| **O₇** | Coherence | Cross-layer synthesis | High | No |

**Storage:** `.open_cognition/pgc/overlays/{overlay_name}/`

**Code Reference:** `src/core/overlays/` (manager implementations for each overlay)

## Alternatives Considered

### Option 1: Flat Knowledge Pool (Single Layer)
- **Pros**: Simpler implementation, single query interface, easier to understand initially
- **Cons**:
  - Cannot distinguish security from mission from code structure
  - All queries return mixed results requiring manual filtering
  - Immutable knowledge (security) and mutable knowledge (code) stored identically
  - Cannot export/import specific dimensions
  - No compositional queries ("security ∩ mission")
- **Why rejected**: Cognitive mismatch—treats fundamentally different knowledge types as homogeneous

### Option 2: Three-Layer Model (Structure, Documentation, Security)
- **Pros**: Simpler than seven layers, covers basic needs
- **Cons**:
  - No mission alignment layer (cannot detect drift from strategic goals)
  - No operational patterns (workflow intelligence missing)
  - No formal verification layer (mathematical properties untracked)
  - No coherence layer (no cross-layer synthesis)
  - Cannot express complex queries like "structural patterns that align with mission but violate security"
- **Why rejected**: Too coarse-grained; misses critical dimensions for verifiable AI-human symbiosis

### Option 3: Ten+ Layer Model (Extreme Granularity)
- **Pros**: Maximum separation of concerns
- **Cons**:
  - Cognitive overhead—too many dimensions to reason about
  - Overlapping responsibilities (unclear which layer owns what)
  - Performance overhead (more layers = more processing)
  - Complexity without benefit (diminishing returns)
- **Why rejected**: Violates "minimal orthogonal set" principle

### Option 4: Plugin-Based Dynamic Layers
- **Pros**: Extensibility, users add custom layers
- **Cons**:
  - No standardized query interface
  - Portability issues (custom layers not universally understood)
  - Coherence calculations undefined for unknown layers
  - Complexity in layer interaction rules
- **Why rejected**: Sacrifices verifiability for flexibility

## Rationale

The seven overlays were chosen as the **minimal orthogonal set** needed for complete code understanding:

### 1. Orthogonality Test (Independence)

**Test**: Can you change one overlay without affecting others?

```
Change mission (O₄) → O₁, O₂, O₃, O₅, O₆ unchanged ✓
                     O₇ changes (coherence recomputed) ✓ (by design)

Change code (O₁) → O₄, O₅, O₆ unchanged ✓
                  O₂ might change (new vulnerabilities) ✓
                  O₃ changes (dependencies updated) ✓
                  O₇ changes (coherence recomputed) ✓
```

All overlays except O₇ (integrative by design) can evolve independently.

### 2. Completeness Test (Coverage)

**Every essential question maps to an overlay:**

- "What functions exist?" → O₁ (Structure)
- "What are the threats?" → O₂ (Security)
- "What breaks if I change this?" → O₃ (Lineage)
- "Does this serve our mission?" → O₄ (Mission)
- "What's the next step?" → O₅ (Operational)
- "Can we prove this property?" → O₆ (Mathematical)
- "Do layers align?" → O₇ (Coherence)

No critical question is unanswerable.

### 3. Evolution Frequency (Temporal Separation)

| Overlay | Update Frequency | Trigger | Examples |
|---------|------------------|---------|----------|
| O₁ | High | Code changes | Daily |
| O₂ | Low | New threats | Monthly/yearly |
| O₃ | High | Code changes | Daily |
| O₄ | Low | Strategic pivots | Quarterly/yearly |
| O₅ | Medium | Workflow improvements | Weekly/monthly |
| O₆ | Very Low | New formal results | Rarely |
| O₇ | High | Code or mission changes | Daily/weekly |

Separating high-frequency (O₁, O₃) from low-frequency (O₂, O₆) prevents unnecessary recomputation.

### 4. Compositional Power (Lattice Algebra)

Seven layers enable queries impossible in flat structures:

```bash
O₂ ∩ O₄        # Security patterns aligned with mission
O₁ - O₂        # Code without security coverage (gap analysis)
O₅ → O₄        # Operational patterns supporting mission
O₆ ∩ O₂        # Proofs relating to security mitigations
O₇[coherence<0.5]  # Code with low mission alignment (drift)
```

This is **knowledge algebra**—computing over dimensions, not searching flat text.

## Consequences

### Positive
- **Targeted queries** across specific cognitive dimensions
- **Compositional reasoning** via lattice operations (∧, ∨, -, ~)
- **Independent evolution** of immutable (security) vs. mutable (code) knowledge
- **Selective portability** - export O₂ (security) across projects, keep O₁ (structure) local
- **Verifiable alignment** through O₇ coherence scoring
- **Workflow intelligence** through O₅ operational patterns
- **Formal properties** tracked in O₆ for critical systems

### Negative
- **Complexity overhead** - seven layers vs. one requires more cognitive load
- **Storage duplication** - same symbol may appear in multiple overlays with different metadata
- **Processing cost** - generating all seven overlays takes longer than single-layer extraction
- **Learning curve** - users must understand which overlay answers which question

### Neutral
- **Layer ordering matters** - O₁ foundational, O₇ integrative (architectural constraint, not limitation)
- **Validator infrastructure** - each overlay requires Oracle validator personas
- **Migration complexity** - moving from flat to layered requires restructuring

## Evidence

### Documentation
- Overlay rationale: `docs/manual/part-1-foundation/03-why-overlays.md:1-766`
- Overlay overview: `docs/overlays/README.md`
- Individual overlays:
  - O₁: `docs/overlays/O1_structure/STRUCTURAL_PATTERNS.md`
  - O₂: `docs/overlays/O2_security/SECURITY_GUIDELINES.md`
  - O₃: `docs/overlays/O3_lineage/LINEAGE_PATTERNS.md`
  - O₄: `docs/overlays/O4_mission/VISION.md`
  - O₅: `docs/overlays/O5_operational/OPERATIONAL_LATTICE.md`
  - O₆: `docs/overlays/O6_mathematical/MATHEMATICAL_PROOFS.md`
  - O₇: `docs/overlays/O7_coherence/STRATEGIC_COHERENCE.md`

### Code Implementation
- Overlay managers: `src/core/overlays/`
  - O₁: `structural-patterns/manager.ts`
  - O₂: `security-guidelines/manager.ts`
  - O₃: `lineage-patterns/manager.ts`
  - O₄: `mission-concepts/manager.ts`
  - O₅: `operational-patterns/manager.ts`
  - O₆: `mathematical-proofs/manager.ts`
  - O₇: `strategic-coherence/manager.ts`

### Philosophy Alignment
From `VISION.md:119-120`:
> "Every question you ask—'What depends on X?', 'Where is Y used?', 'What changed?'—is a lattice operation. This is not analogy. This is formal mathematical truth, and PGC is its executable form."

From `docs/manual/part-1-foundation/03-why-overlays.md`:
> "Different knowledge types require different cognitive operations. You wouldn't use a hammer for every task. Why use one knowledge structure for every cognitive operation?"

## Notes

**Why Exactly Seven?**

The number seven is neither arbitrary nor magical. It's the **minimal set of orthogonal dimensions** required to answer all essential questions about a codebase:

1. **Structure** (O₁) - Foundational: Must know what exists before reasoning about it
2. **Security** (O₂) - Immutable constraints: Threats don't disappear
3. **Lineage** (O₃) - Derived from structure: Dependencies flow from code
4. **Mission** (O₄) - Strategic intent: Why does this code exist?
5. **Operational** (O₅) - Tactical guidance: How do we build it correctly?
6. **Mathematical** (O₆) - Formal properties: What can we prove?
7. **Coherence** (O₇) - Integrative: Do all layers align?

**Design Philosophy:**
> "The mathematics rewards openness. Closed implementations become evolutionary dead ends because: (1) Fewer overlays = less knowledge compounding, (2) Slower iteration = network moves on without you, (3) Weaker network effects = isolated islands, not a lattice."
— VISION.md:72-78

**Future Evolution:**
The seven-overlay system is the v1.0 foundation. Future additions must prove orthogonality and necessity to avoid bloat.

**Related Decisions:**
- ADR-001 (LanceDB) - Provides vector storage for each overlay
- ADR-003 (Shadow Embeddings) - Enables dual-purpose O₁ queries
- ADR-007 (AGPLv3) - Legal reinforcement of open overlay ecosystem
- ADR-009 (Quest System) - Leverages O₅ operational patterns
