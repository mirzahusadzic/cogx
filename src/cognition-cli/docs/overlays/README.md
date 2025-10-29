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

**Layer**: Strategic Vision
**Purpose**: Extract mission-critical concepts from strategic docs
**Status**: Implemented
**Key Docs**: [PATTERN_LIBRARY.md](./O4_mission/PATTERN_LIBRARY.md)
**Related**: `../../VISION.md`

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
