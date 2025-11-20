# O₇: Strategic Coherence Overlay

> _The lattice—where code meets mission, where implementation honors vision, where coherence is computed._

## Overview

The **Strategic Coherence Overlay** is the synthesis layer that verifies alignment between code (O₁), mission (O₄), and all other overlays. It answers the question: **"Does our code embody our mission?"**

**Layer**: Cross-Layer Alignment
**Purpose**: Verify alignment between code and strategic vision
**Status**: ✅ Implemented
**Extraction Method**: Vector similarity (cosine distance)
**Speed**: Fast (no LLM required, pure mathematics)

## Architecture

### Data Flow

```text
O₁ Structural Patterns (code embeddings)
         +
O₄ Mission Concepts (mission embeddings)
         ↓
   Cosine Similarity
         ↓
 Alignment Computation
         ↓
Lattice-Aware Weighting (Gaussian + Centrality)
         ↓
    Coherence Metrics
         ↓
  Strategic Coherence Overlay
```

### Key Components

- **Similarity Engine**: Computes cosine similarity between embeddings
- **Alignment Tracker**: Maps symbols to mission concepts
- **Lattice Weighting**: Gaussian + centrality synthesis for noise filtering
- **Coherence Metrics**: Multiple statistical measures of alignment

## Core Concepts

### 1. Alignment

An **alignment** is a semantic relationship between a code symbol and a mission concept:

```typescript
interface ConceptAlignment {
  conceptText: string; // Mission concept
  conceptSection: string; // Vision, Mission, Principles, etc.
  alignmentScore: number; // Cosine similarity (0.0 - 1.0)
  sectionHash: string; // Provenance to O₄
}
```

**Example**:

```json
{
  "conceptText": "Cryptographic truth is essential",
  "conceptSection": "Principles",
  "alignmentScore": 0.87,
  "sectionHash": "sha256:abc123..."
}
```

### 2. Symbol Coherence

The **coherence** of a code symbol is its alignment with mission concepts:

```typescript
interface SymbolCoherence {
  symbolName: string; // e.g., "ConceptExtractor"
  filePath: string;
  symbolHash: string; // Link to O₁
  topAlignments: ConceptAlignment[]; // Top N mission concepts
  overallCoherence: number; // Average of top alignments
}
```

### 3. Concept Implementation

The **reverse mapping**: which symbols implement each mission concept:

```typescript
interface ConceptImplementation {
  conceptText: string;
  conceptSection: string;
  implementingSymbols: Array<{
    symbolName: string;
    filePath: string;
    alignmentScore: number;
  }>;
}
```

## Coherence Metrics

The overlay computes **three coherence metrics** with different weighting strategies:

### 1. Average Coherence (Baseline)

Simple arithmetic mean of all alignment scores:

```text
average = Σ(alignment_score) / n
```

**Use**: Quick baseline measure, treats all symbols equally.

### 2. Weighted Coherence (Centrality-Based)

Weights by architectural importance (graph centrality from O₃ lineage):

```text
weight(symbol) = log₁₀(dependency_count + 1)
weighted = Σ(alignment_score × weight) / Σ(weight)
```

**Use**: Emphasizes core infrastructure symbols over leaf nodes.

### 3. Lattice Coherence (Gaussian + Centrality)

**Monument 5.1**: Synthesizes across overlays with noise filtering:

```text
gaussian_weight = max(0.1, 1.0 + z_score)
  where z_score = (score - μ) / σ

lattice_weight = centrality × gaussian_weight
lattice_coherence = Σ(alignment × lattice_weight) / Σ(lattice_weight)
```

**Key Properties**:

- ✅ **No hardcoded constants**: All weights derived from data
- ✅ **Noise filtering**: Symbols below μ - σ are excluded
- ✅ **Signal amplification**: High-centrality + high-alignment symbols dominate
- ✅ **Cross-overlay synthesis**: Uses O₁ (structure), O₃ (lineage), O₄ (mission)

**Use**: Most sophisticated metric, represents true lattice coherence.

## Strategic Coherence Schema

```typescript
interface StrategicCoherenceOverlay {
  generated_at: string;
  mission_document_hashes: string[]; // Provenance to strategic docs
  mission_concepts_count: number;
  symbol_coherence: SymbolCoherence[];
  concept_implementations: ConceptImplementation[];

  overall_metrics: {
    // Central Tendency
    average_coherence: number; // Simple mean
    weighted_coherence: number; // Centrality-weighted
    lattice_coherence: number; // Gaussian + centrality
    median_coherence: number; // 50th percentile

    // Statistical Spread
    std_deviation: number; // How varied are alignments?
    top_quartile_coherence: number; // 75th percentile (best)
    bottom_quartile_coherence: number; // 25th percentile (needs work)

    // Classification
    high_alignment_threshold: number; // e.g., 0.7
    aligned_symbols_count: number; // Above threshold
    drifted_symbols_count: number; // Below threshold
    total_symbols: number;
  };
}
```

## Example Coherence Entry

```yaml
generated_at: '2025-10-29T16:00:00.000Z'
mission_document_hashes:
  - sha256:vision_hash...
  - sha256:pattern_lib_hash...
mission_concepts_count: 42

symbol_coherence:
  - symbolName: 'ConceptExtractor'
    filePath: 'src/core/analyzers/concept-extractor.ts'
    symbolHash: 'sha256:abc123...'
    topAlignments:
      - conceptText: 'Pattern-based extraction targets structural markers'
        conceptSection: 'Patterns'
        alignmentScore: 0.91
        sectionHash: 'sha256:def456...'
      - conceptText: 'The code is docs, the docs is code'
        conceptSection: 'Meta'
        alignmentScore: 0.84
        sectionHash: 'sha256:ghi789...'
    overallCoherence: 0.875

concept_implementations:
  - conceptText: 'Cryptographic truth is essential'
    conceptSection: 'Principles'
    implementingSymbols:
      - symbolName: 'calculateStructuralHash'
        filePath: 'src/core/pgc/hashing.ts'
        alignmentScore: 0.89
      - symbolName: 'ObjectStore'
        filePath: 'src/core/pgc/object-store.ts'
        alignmentScore: 0.82

overall_metrics:
  average_coherence: 0.72
  weighted_coherence: 0.78
  lattice_coherence: 0.81
  median_coherence: 0.75
  std_deviation: 0.12
  top_quartile_coherence: 0.85
  bottom_quartile_coherence: 0.62
  high_alignment_threshold: 0.7
  aligned_symbols_count: 47
  drifted_symbols_count: 8
  total_symbols: 55
```

## Cosine Similarity Algorithm

The core alignment computation uses **cosine similarity**:

```text
cosine_similarity(A, B) = (A · B) / (||A|| × ||B||)

Where:
  A · B = Σ(Aᵢ × Bᵢ)           (dot product)
  ||A|| = √(Σ(Aᵢ²))            (magnitude)
```

**Range**: -1.0 to 1.0 (typically 0.0 to 1.0 for embeddings)
**Interpretation**:

- 1.0 = Perfect alignment (identical semantic meaning)
- 0.7+ = High alignment (strong relationship)
- 0.5 - 0.7 = Moderate alignment
- < 0.5 = Weak alignment (potential drift)

## Storage Structure

```text
.open_cognition/
└── pgc/
    └── overlays/
        └── strategic_coherence/
            ├── coherence.yaml         # Full coherence overlay
            ├── symbol_alignments/
            │   └── {symbol_hash}.json # Per-symbol details
            └── concept_maps/
                └── {concept_hash}.json # Per-concept details
```

## Usage

### Generate Coherence Overlay

```bash
# Generate strategic coherence analysis
cognition-cli coherence generate

# With specific mission docs
cognition-cli coherence generate --docs VISION.md,PATTERN_LIBRARY.md
```

### Check Coherence

```bash
# Show overall coherence metrics
cognition-cli coherence check

# Output:
# ✓ Lattice Coherence: 0.81 (GOOD)
# ✓ Aligned Symbols: 47/55 (85%)
# ⚠ Drifted Symbols: 8/55 (15%)
```

### Find Drifted Symbols

```bash
# List symbols with low alignment
cognition-cli coherence drifted

# Output:
# Symbol: OldUtility
# File: src/utils/old.ts
# Coherence: 0.42 (DRIFT)
# Suggestion: Refactor or document mission alignment
```

### Find Concept Gaps

```bash
# Mission concepts with no implementing code
cognition-cli coherence gaps

# Output:
# Concept: "Real-time collaboration"
# Section: Vision
# Status: NOT IMPLEMENTED
# Suggestion: Create implementation or remove from mission
```

## Integration with Other Overlays

### Uses O₁ (Structure)

Structural embeddings provide code representations:

```text
O₁ structural_patterns → coherence analysis
```

### Uses O₃ (Lineage)

Dependency counts provide centrality weights:

```text
O₃ reverse_deps → centrality weight → lattice coherence
```

### Uses O₄ (Mission)

Mission embeddings provide strategic anchors:

```text
O₄ mission_concepts → alignment targets
```

### Validates All Overlays

Coherence validates cross-layer alignment:

- **O₂ (Security)**: "Security measures align with mission 'cryptographic truth'"
- **O₅ (Operational)**: "Workflows honor mission 'validate before trust'"
- **O₆ (Mathematical)**: "Proofs ground mission 'mathematical certainty'"

## Coherence Drift Detection

### High Drift Indicators

1. **Low alignment score** (< 0.5)
2. **No top-3 mission concepts** above threshold
3. **High centrality** but **low coherence** (important but drifted)

### Remediation Strategies

**For Drifted Symbols**:

1. **Refactor**: Align implementation with mission
2. **Document**: Explain how it supports mission
3. **Remove**: If truly misaligned with vision

**For Concept Gaps**:

1. **Implement**: Build missing functionality
2. **Revise Mission**: Remove unimplemented concepts

## Use Cases

### 1. Architecture Review

**Question**: "Does our security layer embody 'cryptographic truth is essential'?"

```bash
cognition-cli coherence check --filter security
```

**Output**:

```text
Security Layer Coherence: 0.89 (EXCELLENT)
Top Alignments:
  - calculateHash → "Cryptographic truth is essential" (0.91)
  - verifySignature → "Immutable provenance" (0.87)
```

### 2. Refactoring Guidance

**Question**: "Which modules need refactoring to align with mission?"

```bash
cognition-cli coherence drifted --sort-by centrality
```

**Output**: High-centrality, low-coherence symbols (high impact if refactored)

### 3. Feature Validation

**Question**: "Does this new feature align with our vision?"

```bash
# After implementing feature
cognition-cli coherence check --path src/features/new-feature
```

### 4. Mission Evolution

**Question**: "If we update our mission, what code needs to change?"

```bash
# Generate coherence with new mission docs
cognition-cli coherence generate --docs VISION_v2.md

# Compare before/after
cognition-cli coherence diff baseline.yaml current.yaml
```

## Lattice-Aware Weighting Deep Dive

### Why Gaussian Weighting?

**Problem**: Simple averaging treats all symbols equally, amplifying noise from low-quality alignments.

**Solution**: Gaussian statistics filter noise:

```text
z_score = (score - μ) / σ

If z_score < -1: symbol below average (noise)
If z_score > +1: symbol above average (signal)
```

### Why Centrality Weighting?

**Problem**: Leaf nodes and core infrastructure have different importance.

**Solution**: Weight by dependency count (from O₃):

```text
centrality = log₁₀(deps + 1)

1 dependent  → weight = 0.3
10 dependents → weight = 1.0
100 dependents → weight = 2.0
```

### Combined Lattice Weight

```text
lattice_weight = centrality × gaussian_significance

Example:
  Symbol: UserService
  Alignment: 0.85 (z_score = +1.5)
  Dependencies: 50

  gaussian_weight = 1.0 + 1.5 = 2.5
  centrality = log₁₀(51) = 1.7
  lattice_weight = 2.5 × 1.7 = 4.25
```

This symbol has **4.25x** influence on lattice coherence.

## Best Practices

### For Developers

1. **Check coherence before PRs**

   ```bash
   cognition-cli coherence check --changed-only
   ```

2. **Aim for alignment > 0.7**

   ```bash
   cognition-cli coherence check MyNewClass
   ```

3. **Document mission links in code**

   ```typescript
   /**
    * Mission Alignment: "Cryptographic truth is essential"
    * Implementation: Uses SHA-256 for content addressing
    */
   ```

### For Architects

1. **Monitor lattice coherence trends**

   ```bash
   cognition-cli coherence history --metric lattice
   ```

2. **Identify architectural debt**

   ```bash
   cognition-cli coherence drifted --centrality high
   ```

3. **Validate mission updates**

   ```bash
   cognition-cli coherence diff old.yaml new.yaml
   ```

## Metrics Interpretation

| Lattice Coherence | Interpretation | Action                     |
| ----------------- | -------------- | -------------------------- |
| 0.9+              | Excellent      | Maintain current alignment |
| 0.7 - 0.9         | Good           | Monitor for drift          |
| 0.5 - 0.7         | Moderate       | Review drifted symbols     |
| < 0.5             | Poor           | Major refactoring needed   |

## Future Enhancements

- [ ] **Temporal Coherence Tracking**: Track coherence over time
- [ ] **Coherence Regression Tests**: Fail CI if coherence drops
- [ ] **LLM-Assisted Drift Remediation**: Suggest refactorings
- [ ] **Multi-Mission Support**: Track multiple strategic documents
- [ ] **Coherence Visualization**: Graph coherence landscapes

## Related Documentation

- [Multi-Overlay Architecture](../../architecture/MULTI_OVERLAY_ARCHITECTURE.md)
- [O₁: Structural Patterns](O1-structure-patterns.md)
- [O₃: Lineage Patterns](O3-lineage-patterns.md)
- [O₄: Mission Concepts](O4-pattern-library.md)
