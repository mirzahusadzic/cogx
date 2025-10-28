# Changelog

All notable changes to the CogX Cognition CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2025-10-28

### 🎉 The Shadow + Monument 5.1 - "Lattice-aware Gaussian Weighting"

This release introduces two major innovations building on the defensive publication:

#### Innovation #26: Monument 4.7 - The Shadow

- Dual embedding system for structural and semantic signatures
- Structural embeddings based on AST patterns
- Semantic embeddings based on docstring + type signatures
- Enables both code pattern matching AND mission alignment queries

#### Innovation #27: Monument 5.1 - Lattice-aware Gaussian Weighting

- Pure lattice-based coherence eliminating all hardcoded constants
- Gaussian statistics for signal/noise separation (filters symbols below μ - σ)
- Graph centrality from O₁ reverse_deps (logarithmic scaling)
- Three-tier coherence metrics: Average, Weighted, Lattice

### Added

- **Lattice coherence metric** using pure mathematical derivation
  - Weight formula: `w = centrality × gaussian_significance`
  - `centrality = log10(dependency_count + 1)`
  - `gaussian_significance = max(0.1, 1.0 + z_score)`
  - NO HARDCODED CONSTANTS - all derived from lattice structure
- **Gaussian noise filtering** - excludes symbols below μ - σ (z-score < -1.0)
- **Cross-overlay synthesis** - O₁ (structure) + O₃ (mission) + statistics
- **Debug logging** for centrality calculations with dependency counts
- **Enhanced coherence report** showing all three metrics with deltas

### Fixed

- **Critical bug**: PGCManager initialization in StrategicCoherenceManager
  - Was passing `pgcRoot` instead of `projectRoot`
  - Created incorrect paths (`.open_cognition/.open_cognition/...`)
  - Caused lattice coherence to always return 0%
  - Now correctly passes parent directory via `path.dirname()`

### Results

- **Lattice coherence**: 57.7% (+3.0% from baseline)
- **Gaussian filtering**: Successfully filtering statistical noise
- **Centrality weighting**: Working correctly from reverse_deps
- **Verification**: Debug logs confirm proper dependency lookups

### Documentation

- Updated README with Innovations #26-27
- Updated Zenodo DOI to 10.5281/zenodo.17466998
- Comprehensive release notes on GitHub
- JSDoc comments for all lattice-aware functions

---

## [1.5.0] - 2025-10-26

### 🎉 O₃/O₄ Implementation Release - "Strategic Intelligence Architecture"

This release represents the completion of the Strategic Intelligence Architecture with full implementation of Overlay 3 (Mission Concepts) and Overlay 4 (Strategic Coherence).

### Added

#### O₃ Layer - Mission Concepts

- **Pattern-based concept extraction** with 6 targeted strategies
  - Blockquotes (distilled essence)
  - Headers (structured concepts)
  - Bold text (emphasis markers)
  - Bullet lists (enumerated concepts)
  - Emoji-prefixed lines (visual markers)
  - Quoted phrases (coined terms)
- **97.6% noise reduction** (1,076 → 26 concepts from VISION.md)
- **768-dimensional embeddings** for semantic analysis
- **Recursive meta-cognition** - system extracted its own methodology
- Multi-document aggregation from strategic documentation

#### O₄ Layer - Strategic Coherence

- **Semantic alignment scoring** between code and mission concepts
- **Vector similarity analysis** using cosine similarity
- **Top-N alignment tracking** per code symbol
- **Bidirectional mapping** (code → concepts, concepts → code)
- **Coherence metrics dashboard** with drift detection

#### Security Architecture

- **Multi-layer mission validation**:
  - Gemini LLM content safety (optional)
  - Pattern-based threat detection (fallback)
  - Semantic drift analysis (embedding-based)
  - Structural integrity validation
- **5-pattern attack detection**:
  - Security weakening
  - Trust erosion
  - Permission creep
  - Ambiguity injection
  - Velocity over safety
- **Immutable audit trail** for mission document versions
- **Advisory mode by default** - warns without blocking
- **Configurable security** with transparent thresholds

#### CLI Commands

**Mission Concepts (`cognition-cli concepts`)**:

- `concepts list` - Show all extracted mission concepts
- `concepts for-section <name>` - Filter concepts by section
- `concepts search <query>` - Semantic search in concepts
- `concepts stats` - Extraction statistics

**Strategic Coherence (`cognition-cli coherence`)**:

- `coherence report` - Overall metrics dashboard
- `coherence aligned` - High-alignment symbols (≥ 70%)
- `coherence drifted` - Low-alignment symbols (< 70%)
- `coherence for-symbol <name>` - Detailed symbol analysis
- `coherence compare <s1> <s2>` - Side-by-side comparison

**Overlay Generation**:

- `overlay generate mission_concepts` - Extract concepts from strategic docs
- `overlay generate strategic_coherence` - Compute code-mission alignment

**Documentation Ingestion**:

- `genesis-docs <path>` - Ingest markdown documentation
- `genesis-docs --recursive` - Recursive directory ingestion

### Changed

- **Lattice architecture** now includes 4 overlay dimensions (O₁-O₄)
- **Multi-document strategic coherence** aggregates concepts from all docs
- **Updated README** with O₃/O₄ lattice graph and data flow patterns
- **Enhanced logging** with spinner indicators and progress tracking

### Fixed

- Vector metadata now includes `filePath` and `structuralHash`
- Invalid vector diagnostics improved (shows symbol instead of full record)
- Single-embedding optimization for mission concept generation
- Positive strategic language in concept extraction

### Documentation

- Comprehensive O₃ documentation with extraction algorithm
- Security architecture threat model and defense layers
- Mission drift attack scenarios and detection
- Claude integration guide with TOC
- DocsOracle integration for concept embedding

### Performance

- **Single embedding pass** for mission concepts (no re-embedding)
- **Cached validation** skips security checks for unchanged documents
- **Parallel lineage mining** with optimized worker pools
- **Rate-limited embedding** service with queue management

### Tested

- 79 passing tests across all overlay layers
- Contract tests for VISION.md ingestion
- Security validation test suite
- Multi-document aggregation tests

---

## [1.0.0-prior-art] - 2025-10-25

Initial tag for prior art baseline before O₃/O₄ implementation.

---

## Release Philosophy

**v1.5.0 represents:**

- ✅ Production-ready Strategic Intelligence Architecture
- ✅ Complete 4-dimensional lattice (O₁-O₄)
- ✅ Full CLI with 10+ commands
- ✅ Multi-layer security with mission drift detection
- ✅ Recursive meta-cognitive capability
- ✅ 20 commits of solid engineering
- ✅ 85 passing tests with no external dependencies

**For Zenodo archival and academic citation.**
