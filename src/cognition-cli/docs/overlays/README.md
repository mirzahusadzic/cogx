# Overlay Documentation Structure

This directory contains documentation for each overlay layer in the PGC architecture.

## Overlay Types

### O₁: Structure Overlay

**Layer**: Code Artifacts
**Purpose**: Extract code structure (classes, functions, dependencies)
**Status**: Implemented

### O₂: Security Guidelines Overlay

**Layer**: Foundational Security
**Purpose**: Threat models, CVEs, mitigations
**Status**: Implemented
**Related**: `SECURITY.md`, `THREAT_MODEL.md` in project root

### O₃: Lineage Overlay

**Layer**: Dependency Tracking
**Purpose**: Trace dependency chains and impact analysis
**Status**: Implemented

### O₄: Mission Concepts Overlay

**Layer**: Strategic Intent (The Constitution)
**Purpose**: Extract mission-critical concepts and coding principles—the invariant truths that govern all implementation
**Status**: Implemented
**Key Docs**:

- [PATTERN_LIBRARY.md](./O4_mission/PATTERN_LIBRARY.md) - Extraction patterns (meta)
- [CODING_PRINCIPLES.md](./O4_mission/CODING_PRINCIPLES.md) - Coding philosophy and principles
  **Related**: `../../VISION.md`

**Dimensional Coherence**: Concepts are tagged by source document, enabling:

- `--filter "source:VISION.md"` → Mission alignment scoring
- `--filter "source:CODING_PRINCIPLES.md"` → Principles adherence scoring

### O₅: Operational Patterns Overlay

**Layer**: Workflow Intelligence
**Purpose**: Quest structures, F.L.T.B sequences, depth tracking
**Status**: Implemented
**Key Docs**: [OPERATIONAL_LATTICE.md](./O5_operational/OPERATIONAL_LATTICE.md)

### O₆: Mathematical Proofs Overlay

**Layer**: Formal Properties
**Purpose**: Theorems, lemmas, proofs, axioms
**Status**: Framework implemented, awaiting content

### O₇: Coherence Overlay

**Layer**: Cross-Layer Alignment
**Purpose**: Verify alignment between overlays
**Status**: Planned

## Architecture

See [../architecture/MULTI_OVERLAY_ARCHITECTURE.md](../architecture/MULTI_OVERLAY_ARCHITECTURE.md) for the complete multi-overlay system design.

## Extraction Methods

| Overlay         | Method                            | LLM Required          | Speed  |
| --------------- | --------------------------------- | --------------------- | ------ |
| O₁ Structure    | Tree-sitter AST                   | No                    | Fast   |
| O₂ Security     | Pattern matching + LLM validation | Yes (validation only) | Medium |
| O₃ Lineage      | Graph traversal                   | No                    | Fast   |
| O₄ Mission      | Pattern matching + LLM validation | Yes (validation only) | Medium |
| O₅ Operational  | Pattern matching + LLM validation | Yes (validation only) | Medium |
| O₆ Mathematical | Pattern matching + LLM validation | Yes (validation only) | Medium |
| O₇ Coherence    | Vector similarity                 | No                    | Fast   |

## Validator Personas (Oracle Gates)

Each overlay has validators (eGemma personas) that act as **Oracle (O)** gates in the **G→T→O** feedback loop, ensuring data integrity before commitment to PGC.

**Location**: `~/src/egemma/personas/docs/`

| Overlay                 | Validator Persona            | Validates                                         | Input Type                              |
| ----------------------- | ---------------------------- | ------------------------------------------------- | --------------------------------------- |
| O₁ Structure            | _(none)_                     | N/A - AST parsing is deterministic                | JSON (from Tree-sitter)                 |
| O₂ Security (Strategic) | `security_validator.md`      | Strategic documents for security threats          | Markdown (VISION.md, etc.)              |
| O₂ Security (Overlay)   | `security_meta_validator.md` | Threat models, CVE reports, security guidelines   | Markdown (SECURITY.md, THREAT_MODEL.md) |
| O₃ Lineage              | `lineage_validator.md`       | Dependency graph integrity, blast radius accuracy | JSON (lineage overlay output)           |
| O₄ Mission              | `mission_validator.md`       | Concept extraction quality, pattern application   | JSON (mission concepts overlay)         |
| O₅ Operational          | `operational_validator.md`   | Workflow pattern integrity, F.L.T.B compliance    | Markdown (operational docs)             |
| O₆ Mathematical         | `proof_validator.md`         | Proof correctness, theorem validity               | Markdown (proof documents)              |
| O₇ Coherence            | `coherence_validator.md`     | Alignment computation, cross-overlay linkage      | YAML (strategic coherence overlay)      |

### Validator Role in cPOW Loop

```text
Transform (T) generates overlay data
        ↓
Validator runs (Oracle O phase)
        ↓
   ┌────┴────┐
   │         │
APPROVE   REJECT
   │         │
   ↓         ↓
cPOW   corrections++
receipt   (retry T)
   ↓
Commit to PGC
```

### Validator Output Format

All validators follow a standardized assessment structure:

```yaml
THREAT ASSESSMENT: [SAFE | SUSPICIOUS | MALICIOUS]
DETECTED PATTERNS: [List any patterns found, or "None"]
SPECIFIC CONCERNS: [Quote suspicious data with context, or "None"]
RECOMMENDATION: [APPROVE | REVIEW | REJECT]
REASONING: [Brief explanation of your assessment]
```

**Recommendations**:

- **APPROVE**: Data passes validation, generate cPOW receipt and commit
- **REVIEW**: Requires human validation before proceeding
- **REJECT**: Data has integrity issues, increment corrections counter, retry Transform

### cPOW Receipt with Validation

When a validator approves overlay data, the cPOW receipt includes validation metadata:

```json
{
  "cpow": {
    "magnitude": 0.85,
    "computation": {
      "extraction_method": "pattern_based_llm",
      "embedding_model": "egemma-v1",
      "oracle_validation": "APPROVED",
      "validator_used": "mission_validator"
    },
    "validation_metrics": {
      "total_concepts": 26,
      "extraction_ratio": 0.131,
      "fragment_ratio": 0.04,
      "quality_score": 0.95
    },
    "fidelity": 0.95
  }
}
```

See [../architecture/CPOW_OPERATIONAL_LOOP.md](../architecture/CPOW_OPERATIONAL_LOOP.md) for complete loop formalization.
