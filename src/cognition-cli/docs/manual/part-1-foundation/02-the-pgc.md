---
type: architectural
overlay: O4_Mission
---

# Chapter 2: The PGC (Grounded Context Pool)

> **The Axiom Applied**: The PGC is not a cache. It is the **persistent lattice substrate** where knowledge accumulates across time. Content-addressable like Git, structured like a database, queryable like an index. This is the executable implementation of "knowledge is stateful."

**Part**: I — Foundation<br/>
**Topic**: The PGC (Grounded Context Pool)<br/>
**Prerequisites**: [Chapter 1: Cognitive Architecture](01-cognitive-architecture.md)<br/>
**Concepts Introduced**: Content-addressable storage, transform manifests, structural indexing, overlay storage, mission integrity<br/>

---

## Table of Contents

1. [Purpose and Scope](#purpose-and-scope)
2. [Directory Structure Overview](#directory-structure-overview)
3. [The Four Pillars](#the-four-pillars)
4. [Overlay Storage Strategies](#overlay-storage-strategies)
5. [Embeddings: LanceDB Integration](#embeddings-lancedb-integration)
6. [Mission Integrity and Security](#mission-integrity-and-security)
7. [Initialization and Lifecycle](#initialization-and-lifecycle)
8. [Performance Characteristics](#performance-characteristics)
9. [Git Integration Strategies](#git-integration-strategies)

---

## Purpose and Scope

The **Grounded Context Pool (PGC)** is cognition-cli's storage layer—the physical manifestation of the knowledge lattice.

### What the PGC Is

**A local-first, content-addressable knowledge repository** that stores:

- Source code snapshots (immutable, hash-indexed)
- Structural metadata (symbols, imports, exports per file)
- Transform records (what operations were performed)
- Overlay knowledge (security, mission, lineage, etc.)
- Embeddings (768-dimensional semantic vectors)

**Design Philosophy**: Like Git for source control, the PGC is foundational infrastructure. Treat it as permanent storage, not disposable cache.

### What the PGC Is NOT

**Not a cache**: Caches can be cleared without consequence. Losing the PGC means losing:

- Accumulated mission concepts (extracted from VISION.md)
- Security patterns (identified by analysis)
- Coherence scores (computed over time)
- Historical transform records (provenance trail)

**Not a build artifact**: Build artifacts (e.g., `dist/`, `node_modules/`) are regenerable from source. The PGC contains **derived knowledge** that requires LLM processing, document analysis, and semantic computation.

**Not a database**: While it has database-like properties (indexed, queryable), it's optimized for cognitive operations (lattice queries, semantic similarity) not CRUD operations.

### Key Properties

| Property         | Value                                                   |
| ---------------- | ------------------------------------------------------- |
| **Location**     | `.open_cognition/` at project root                      |
| **Format**       | Content-addressable (SHA-256), JSON, YAML               |
| **Versioning**   | Git-style sharding + transform manifests                |
| **Provenance**   | Every file tracked by content hash                      |
| **Storage**      | ~70MB for 32K LOC (with template docs and all overlays) |
| **Git strategy** | Selective commits via `.gitignore`                      |

---

## Directory Structure Overview

```text
.open_cognition/
├── objects/              # Content-addressable file storage
├── transforms/           # Transform manifests (YAML)
├── index/                # Structural metadata (JSON per file)
├── reverse_deps/         # Dependency graphs
├── overlays/             # O₁-O₇ overlay storage
├── patterns.lancedb/     # Vector database (embeddings)
├── mission_integrity/    # Mission document checksums + audit logs
├── security/             # Transparency logs (JSONL)
├── logs/                 # Operation logs
├── metadata.json         # PGC version, status
└── .gitignore            # Excludes objects/, patterns.lancedb/
```

**Total size** (cognition-cli, 32K LOC, measured before template doc ingestion):

**Before template docs** (genesis + code only):

- `patterns.lancedb/`: 36MB (embeddings)
- `overlays/`: 4.1MB (overlay data)
- `objects/`: 3.7MB (source snapshots)
- `mission_integrity/`: 1.8MB (checksums + audit)
- `reverse_deps/`: 792KB (dependency graphs)
- `index/`: 716KB (structural metadata)
- `transforms/`: 396KB (YAML manifests)
- `logs/`: 8KB
- **Subtotal**: ~48MB

**After template docs** (complete PGC with all overlays):

- **Total**: ~70MB (+22MB for template doc embeddings and overlays)

---

## The Four Pillars

The PGC architecture rests on **four foundational directories**, each serving a distinct purpose in the knowledge lattice.

### 1. objects/ — Content-Addressable File Storage

**Purpose**: Store immutable snapshots of source code files, indexed by SHA-256 hash.

**Design**: Git-style sharding (first 2 hex chars → directory, remaining 62 chars → filename).

**Structure**:

```text
objects/
├── 05/                   # Shard directory (first 2 chars of hash)
│   └── cc0e0951a04583f827827cd2c781de74df5880b00f87de8aba165589859193
│       # ↑ Full content of source file (remaining 62 chars of hash)
├── 08/
│   └── ab550ea667587e3fb84e70c0bf29642d7a37c6a71cc030f9ce89543a4f0814
├── 0c/
└── ...
```

**Hashing Example**:

If `src/auth/authenticate.ts` contains:

```typescript
export async function authenticate(user: string, password: string) {
  // ... implementation
}
```

The SHA-256 hash of the file content is computed:

```bash
$ sha256sum src/auth/authenticate.ts
05cc0e0951a04583f827827cd2c781de74df5880b00f87de8aba165589859193
```

**Storage location**:

```text
.open_cognition/objects/05/cc0e0951a04583f827827cd2c781de74df5880b00f87de8aba165589859193
```

**Content**: Exact byte-for-byte copy of the source file (not JSON, not metadata—the raw code).

**Why Content-Addressable?**

**1. Deduplication**

If two files have identical content (e.g., copy-pasted code), they share the same hash → stored once.

**2. Integrity Verification**

To verify a file hasn't been tampered with:

```typescript
const stored = readFile('.open_cognition/objects/05/cc0e0951...');
const hash = sha256(stored);
assert(
  hash === '05cc0e0951a04583f827827cd2c781de74df5880b00f87de8aba165589859193'
);
```

**3. Immutability**

Changing file content → different hash → different storage location. Original remains unchanged.

**4. Git Compatibility**

Same strategy as Git's object store. Familiar to developers, well-understood performance characteristics.

---

### 2. transforms/ — Transformation Records

**Purpose**: Record what operations were performed on which files, with full provenance trail.

**Design**: Git-style sharded directories containing `manifest.yaml` files per transform.

**Structure**:

```text
transforms/
├── 02/                                    # Shard (first 2 chars of transform ID)
│   └── 48295242270c25d97e4b73e22e5.../   # Transform ID
│       └── manifest.yaml                  # Transform metadata
├── 16/
│   └── ab550ea667587e3fb84e70c0bf2.../
│       └── manifest.yaml
└── ...
```

**Example `manifest.yaml`**:

```yaml
goal:
  objective: Extract structural metadata from source file
  criteria:
    - Valid syntax
    - Complete import list
    - All exports identified
  phimin: 0.8
inputs:
  - path: src/auth/authenticate.ts
    hash: 2139c73d168b09a167b4eaa7d9e867bc4b43577405e394c62a81daabd3298ffd
outputs:
  - path: src/auth/authenticate.ts
    hash: 0ca63532f4c79f617076891c4cf0d87b602fd2c8280823ae95fe627a280a5917
method: ast_native
fidelity: 1
phi: 1
verification_result:
  status: Success
```

**Key Fields Explained**:

**goal.objective**: What this transform aimed to achieve (human-readable)

**goal.criteria**: Success conditions (e.g., "Valid syntax", "All exports identified")

**goal.phimin**: Minimum acceptable verification score (0-1 scale, typically 0.8)

**inputs**: Files consumed by this transform, referenced by content hash

- `path`: Original file path (for human reference)
- `hash`: SHA-256 of file content (links to `objects/{shard}/{hash}`)

**outputs**: Files produced by this transform

- Same structure as inputs
- Hash may differ from input (e.g., if transform modifies content)

**method**: How transformation was performed

- `ast_native`: TypeScript/JavaScript AST parser (ts-morph, babel)
- `llm_supervised`: LLM extraction with structured output
- `manual`: Human-provided metadata

**fidelity**: Quality score (0-1)

- 1.0: Perfect extraction (all symbols found, all imports resolved)
- < 1.0: Partial extraction (some symbols missed, heuristic used)

**phi (Φ)**: Verification score (0-1)

- 1.0: Transform passed all goal criteria
- < 1.0: Some criteria failed (e.g., syntax error, missing exports)

**verification_result.status**: `Success`, `Failure`, `Partial`

**Use Cases**:

**1. Provenance Queries**

"Which transform produced this structural metadata?"

```typescript
const transformId = findTransformByOutput(outputHash);
const manifest = readYAML(`transforms/${shard}/${transformId}/manifest.yaml`);
console.log(manifest.method); // "ast_native"
```

**2. Re-extraction Decisions**

"Should I re-extract this file?"

```typescript
if (manifest.fidelity < 0.9 || manifest.phi < 0.8) {
  console.log('Low quality extraction, re-run genesis');
}
```

**3. Audit Trails**

"What operations were performed on this file over time?"

```typescript
const transforms = findTransformsByInputPath('src/auth/authenticate.ts');
transforms.forEach((t) =>
  console.log(`${t.timestamp}: ${t.method} (phi: ${t.phi})`)
);
```

---

### 3. index/ — Structural Metadata

**Purpose**: Fast symbol lookup without re-parsing AST. Stores per-file structural metadata (functions, classes, imports, exports).

**Design**: One JSON file per source file, named by path with `/` replaced by `_`.

**Naming Convention**:

```text
src/auth/authenticate.ts  →  index/src_auth_authenticate.ts.json
src/cli.ts                 →  index/src_cli.ts.json
docs/VISION.md             →  index/docs/VISION.md.json (if parsed)
```

**Structure**:

```text
index/
├── src_cli.ts.json
├── src_commands_init.ts.json
├── src_commands_genesis.ts.json
├── src_core_pgc_manager.ts.json
└── ...
```

**Example `src_cli.ts.json`**:

```json
{
  "path": "src/cli.ts",
  "content_hash": "9915768733f1993fcd10d9ef38a2f576189ce491a49ef3afcd41b1b47e71257f",
  "structural_hash": "34ee8691bec45dd7fdc82fb33a5af6a96eec45cc5994db8ebc4a5adcee3d94b4",
  "status": "Valid",
  "history": [
    "89e684654b04b82f066f32c4f275701d57713c5ac5ede32b9ed58bd0231fa6ab"
  ],
  "structuralData": {
    "language": "typescript",
    "docstring": "",
    "imports": [
      "commander",
      "path",
      "./commands/genesis.js",
      "./commands/init.js",
      "./core/query/query.js"
    ],
    "classes": [],
    "functions": [
      {
        "name": "queryAction",
        "docstring": "",
        "params": [
          { "name": "question", "type": "string", "optional": false },
          {
            "name": "options",
            "type": "QueryCommandOptions",
            "optional": false
          }
        ],
        "returns": "any",
        "is_async": true,
        "decorators": []
      }
    ],
    "interfaces": [
      {
        "name": "QueryCommandOptions",
        "docstring": "",
        "properties": [
          { "name": "projectRoot", "type": "string", "optional": false },
          { "name": "depth", "type": "string", "optional": false }
        ]
      }
    ],
    "exports": [],
    "dependencies": ["commander", "path", "./commands/genesis.js"],
    "extraction_method": "ast_native",
    "fidelity": 1
  }
}
```

**Key Fields Explained**:

**content_hash**: SHA-256 of file content (links to `objects/{shard}/{hash}`)

**structural_hash**: SHA-256 of structure (symbols, imports, exports)

- Changes when symbols change (function added, renamed, signature modified)
- Does NOT change when implementation changes (comments, function body)

**status**: `"Valid"` (parsed successfully) or `"Invalid"` (syntax error)

**history**: Previous structural hashes

- Tracks symbol evolution over time
- Used for drift detection ("Did symbols change since last coherence measurement?")

**structuralData.imports**: List of imported modules

- External packages: `"commander"`, `"bcrypt"`
- Relative imports: `"./commands/genesis.js"`

**structuralData.functions**: Extracted function metadata

- `name`: Function name
- `params`: Parameters with types (TypeScript only)
- `returns`: Return type
- `is_async`: Boolean flag
- `docstring`: JSDoc/TSDoc comment (if present)

**structuralData.interfaces**: TypeScript interfaces

- `name`: Interface name
- `properties`: Fields with types and optionality

**structuralData.dependencies**: Resolved import list (deduplicated)

**structuralData.extraction_method**: How this was extracted

- `"ast_native"`: ts-morph or babel parser
- `"llm_supervised"`: LLM with structured output

**structuralData.fidelity**: Quality score (0-1)

**Use Cases**:

**1. Fast Symbol Lookup**

"What symbols does `src/cli.ts` export?"

```typescript
const index = readJSON('index/src_cli.ts.json');
console.log(index.structuralData.exports); // Fast, no AST parsing
```

**2. Dependency Analysis**

"Which files import `commander`?"

```bash
grep -l '"commander"' index/*.json
```

**3. Change Detection**

"Did symbols change since last coherence measurement?"

```typescript
const currentHash = index.structural_hash;
const previousHash = index.history[index.history.length - 1];
if (currentHash !== previousHash) {
  console.log('Symbols changed, re-run coherence measurement');
}
```

---

### 4. reverse_deps/ — Dependency Graphs

**Purpose**: Track "who depends on whom" for blast radius analysis.

**Design**: Sharded directories containing newline-separated lists of transform IDs.

**Structure**:

```text
reverse_deps/
├── 02/
│   └── 48295242270c25d97e4b...   # Object hash
│       # ↑ Contains: newline-separated transform IDs that reference this object
├── 16/
│   └── ab550ea667587e3fb84e...
└── ...
```

**Content Example** (`reverse_deps/05/cc0e0951a04583f827...`):

```text
0248295242270c25d97e4b73e22e513e529138ded8d5ff69c6ba941fc12fbf0e
16ab550ea667587e3fb84e70c0bf29642d7a37c6a71cc030f9ce89543a4f0814
29abc123def456789abcdef012345678901234567890abcdef123456789abcd
```

Each line is a transform ID that references this object as input or dependency.

**Use Cases**:

**1. Blast Radius Calculation**

"If I change `src/auth/authenticate.ts`, what's affected?"

```typescript
const objectHash = sha256('src/auth/authenticate.ts');
const reverseDeps = readReverseDeps(objectHash); // Read newline-separated file
const affectedTransforms = reverseDeps.split('\n');
console.log(`${affectedTransforms.length} transforms affected`);
```

**2. Impact Analysis**

"Which files will need re-extraction if this file changes?"

```typescript
affectedTransforms.forEach((transformId) => {
  const manifest = readManifest(transformId);
  console.log(`Re-run: ${manifest.inputs[0].path}`);
});
```

**3. Dependency Visualization**

"Show me the call graph for this symbol"

(Implemented in O₃ Lineage overlay, uses reverse_deps as data source)

---

## Overlay Storage Strategies

Each overlay (O₁-O₇) uses a storage format optimized for its knowledge type.

### General Structure

```text
overlays/
├── structural_patterns/        # O₁
├── security_guidelines/        # O₂ (if generated)
├── lineage_patterns/           # O₃
├── mission_concepts/           # O₄
├── operational_patterns/       # O₅ (if generated)
├── mathematical_proofs/        # O₆ (if generated)
└── strategic_coherence/        # O₇
```

### O₁: Structural Patterns

**Storage**: `manifest.json` + per-directory JSON files

**Structure**:

```text
overlays/structural_patterns/
├── manifest.json             # Symbol → file mappings
└── src/
    ├── commands/
    │   └── init.ts.json      # Structural data for this file
    └── core/
        └── pgc/
            └── manager.ts.json
```

**`manifest.json`** (excerpt):

```json
{
  "queryAction": "src/cli.ts",
  "QueryCommandOptions": "src/cli.ts",
  "initCommand": "src/commands/init.ts",
  "genesisCommand": "src/commands/genesis.ts",
  "PGCManager": "src/core/pgc/manager.ts"
}
```

**Purpose**: Fast "Where is symbol X defined?" lookups

**Query Example**:

```typescript
const manifest = readJSON('overlays/structural_patterns/manifest.json');
const location = manifest['initCommand']; // "src/commands/init.ts"
```

---

### O₄: Mission Concepts

**Storage**: `{document_hash}.yaml` per mission document

**Structure**:

```text
overlays/mission_concepts/
└── 9d3b60b34729d224f626fcb8b51129951b217b03f7090e0adbaea3942b6b2afb.yaml
    # ↑ SHA-256 of VISION.md
```

**Content** (`{hash}.yaml` excerpt):

```yaml
document_hash: 9d3b60b34729d224f626fcb8b51129951b217b03f7090e0adbaea3942b6b2afb
document_path: ../../VISION.md
extracted_concepts:
  - text: 'Augment human consciousness through verifiable AI-human symbiosis.'
    section: 'Vision: Open Cognition'
    weight: 1
    occurrences: 1
    sectionHash: 290467ebaa36bc7343ed60be3c36a569e8f2ba66572bc4f82bae716f64d52601
    embedding:
      - -0.06913527101278305
      - 0.06313704699277878
      - 0.02987726777791977
      # ... 765 more values (768 total)
  - text: 'Privacy-first design. User control over all data.'
    section: 'Core Principles'
    weight: 1
    occurrences: 1
    sectionHash: abc123def456...
    embedding:
      - 0.01234567890123456
      # ... 767 more values
```

**Key Fields**:

**document_hash**: SHA-256 of mission document (integrity check)

**document_path**: Relative path to original document

**extracted_concepts**: List of mission concepts

- **text**: Concept text (1-3 sentences)
- **section**: Section heading where found
- **weight**: Importance (1 = primary, < 1 = supporting)
- **occurrences**: How many times mentioned
- **sectionHash**: Hash of section (detects section-level changes)
- **embedding**: 768-dimensional vector (EmbeddingGemma-300M)

**Purpose**: Coherence measurement—compare code symbol embeddings to mission concept embeddings

**Query Example**:

```bash
# Load mission concepts
cognition-cli concepts list

# Measure coherence
cognition-cli coherence report
```

---

## Embeddings: LanceDB Integration

**Location**: `patterns.lancedb/`

**Format**: LanceDB (binary, columnar, Apache Arrow-based)

**Purpose**: Fast semantic similarity queries (k-NN, cosine similarity)

**Structure**:

```text
patterns.lancedb/
├── data/
│   └── *.lance      # Binary embedding vectors
├── _versions/       # LanceDB versioning
└── _metadata.json   # LanceDB metadata
```

**Content**: Embeddings of:

- **Symbols**: Functions, classes, interfaces (from O₁)
- **Mission concepts**: Vision, principles, goals (from O₄)
- **Security patterns**: Threats, mitigations (from O₂)
- **Operational patterns**: Workflows, sequences (from O₅)

**Embedding Model**: EmbeddingGemma-300M (default)

- **Dimensions**: 768
- **Languages**: 100+ (multilingual)
- **Speed**: ~1000 embeddings/second (M1 Mac)
- **License**: Apache 2.0

**Access**: Via LanceDB API only (not direct file manipulation)

**Query Example** (TypeScript):

```typescript
import { LanceDB } from 'lancedb';

const db = await LanceDB.connect('patterns.lancedb');
const table = await db.openTable('embeddings');

// Find symbols similar to mission concept
const results = await table.search(missionConceptEmbedding).limit(10).toArray();

results.forEach((r) => console.log(`${r.symbol}: ${r.score}`));
```

**Performance**: ~10ms per similarity query (optimized columnar storage)

---

## Mission Integrity and Security

### Mission Integrity (`mission_integrity/`)

**Purpose**: Detect mission document tampering or drift

**Structure**:

```text
mission_integrity/
├── checksums.json   # SHA-256 hashes of mission documents
└── audit.log        # Append-only audit trail
```

**`checksums.json`**:

```json
{
  "VISION.md": {
    "sha256": "9d3b60b34729d224f626fcb8b51129951b217b03f7090e0adbaea3942b6b2afb",
    "last_checked": "2025-10-30T12:34:56Z",
    "status": "valid"
  },
  "docs/STRATEGY.md": {
    "sha256": "abc123def456...",
    "last_checked": "2025-10-30T12:34:56Z",
    "status": "valid"
  }
}
```

**`audit.log`** (newline-separated):

```text
2025-10-30T12:00:00Z VALIDATED VISION.md (sha256: 9d3b60b3...)
2025-10-30T14:30:00Z WARNING VISION.md changed (old: 9d3b60b3... new: abc123...)
2025-10-30T14:35:00Z REGENERATED O4 mission_concepts (new hash: abc123...)
```

**Validation Flow**:

1. Before loading mission concepts, check `checksums.json`
2. Compare stored hash vs. current file hash
3. If mismatch: Log warning, prompt user to regenerate O₄
4. If regenerated: Update `checksums.json`, append to `audit.log`

See [Chapter 4.5: Core Security](04.5-core-security.md) for mission validation architecture.

---

### Transparency Logs (`security/`)

**Purpose**: Append-only audit trail of mission loads and coherence measurements

**Format**: JSONL (one JSON object per line)

**Structure**:

```text
security/
└── transparency.jsonl
```

**Content** (newline-separated JSON):

```jsonl
{"timestamp":"2025-10-30T12:34:56Z","action":"mission_loaded","user":"mhusadzi","mission_title":"Privacy-First Design","mission_source":"VISION.md","concepts_count":12,"mission_hash":"9d3b60b3..."}
{"timestamp":"2025-10-30T12:35:00Z","action":"coherence_measured","user":"mhusadzi","symbols_count":120,"mission_title":"Privacy-First Design","mission_hash":"9d3b60b3..."}
```

**Use Cases**:

**1. Audit Trail**

"When was this mission document loaded?"

```bash
grep "mission_loaded" .open_cognition/security/transparency.jsonl
```

**2. Coherence History**

"How many times have we measured coherence?"

```bash
grep "coherence_measured" .open_cognition/security/transparency.jsonl | wc -l
```

**3. User Activity**

"Which users have loaded mission documents?"

```bash
jq '.user' .open_cognition/security/transparency.jsonl | sort | uniq
```

**User Control**: Logs are local and under your control. No external reporting.

See [Chapter 4.5: Core Security](04.5-core-security.md) for transparency architecture.

---

## Initialization and Lifecycle

### Initialization

```bash
cognition-cli init
```

**Creates**:

```text
.open_cognition/
├── objects/
├── transforms/
├── index/
├── reverse_deps/
├── overlays/
├── metadata.json
└── .gitignore
```

**`metadata.json`** (initial state):

```json
{
  "version": "0.1.0",
  "initialized_at": "2025-10-30T12:00:00Z",
  "status": "empty"
}
```

**Status values**:

- `"empty"`: PGC initialized, no genesis run yet
- `"active"`: Contains knowledge, ready for queries
- `"stale"`: Code changed significantly since last genesis (needs refresh)

**Next step**: Run `cognition-cli genesis --source src/` to populate

---

### Lifecycle States

**1. Empty → Active** (First Genesis)

```bash
cognition-cli genesis --source src/
```

- Parses all source files
- Populates `objects/`, `transforms/`, `index/`
- Creates O₁ (Structural Patterns)
- Updates `metadata.json`: `"status": "active"`

**2. Active → Stale** (Code Changes)

Detected when:

- Files modified (content hash changed)
- Symbols added/removed (structural hash changed)
- Dependencies changed (imports modified)

**3. Stale → Active** (Incremental Update)

```bash
cognition-cli update
```

- Re-extracts only changed files
- Updates affected indexes
- Re-computes affected overlays
- Resets `"status": "active"`

**4. Active → Active** (Overlay Generation)

```bash
cognition-cli overlay generate security_guidelines
cognition-cli overlay generate mission_concepts
```

- Adds new overlays without re-parsing source
- Uses existing `index/` data
- Appends to `overlays/`

---

## Performance Characteristics

**Measured on cognition-cli codebase** (32K LOC actual, TypeScript):

### Storage

| Component           | Size   | Notes                            |
| ------------------- | ------ | -------------------------------- |
| `objects/`          | ~40MB  | Source code snapshots            |
| `transforms/`       | ~2MB   | YAML manifests                   |
| `index/`            | ~700KB | JSON structural metadata         |
| `reverse_deps/`     | ~500KB | Dependency lists                 |
| `patterns.lancedb/` | ~50MB  | Binary embeddings (768-dim)      |
| `overlays/`         | ~15MB  | Varies by overlay count          |
| **Total**           | ~108MB | Excludes `logs/` (usually < 1MB) |

### Query Performance

| Operation                      | Time  | Notes                                  |
| ------------------------------ | ----- | -------------------------------------- |
| Symbol lookup (index)          | <1ms  | JSON read, small files (~3KB)          |
| Overlay manifest read          | <5ms  | JSON parse, ~15KB file                 |
| Mission concepts load (YAML)   | ~50ms | YAML parse + 768-dim embeddings        |
| Semantic similarity (LanceDB)  | ~10ms | Vector query (k-NN, cosine similarity) |
| Transform manifest read        | ~2ms  | YAML parse, ~2KB file                  |
| Full O₁ manifest parse         | ~20ms | JSON parse, ~200KB file                |
| Coherence report (120 symbols) | ~2s   | 120 × 10ms similarity queries          |
| Coverage analysis (O₁ vs O₂)   | ~50ms | Set operations on manifests            |

**Optimization Notes**:

- Index files cached in memory after first query
- LanceDB uses memory-mapped files (fast cold starts)
- YAML parsing is slowest operation (consider JSON for hot paths)
- Parallel queries possible (read-only operations)

---

## Git Integration Strategies

### What to Commit

✅ **Commit** (version-controlled):

- `metadata.json` (PGC version, status)
- `overlays/**/*.json` (overlay manifests)
- `index/**/*.json` (structural metadata)
- `mission_integrity/checksums.json` (mission document hashes)
- `.gitignore` (exclude large binaries)

**Rationale**: Small, diffable JSON files that track cognitive state evolution.

---

### What NOT to Commit

❌ **Exclude** (via `.gitignore`):

```gitignore
# Large, regenerable content
objects/
patterns.lancedb/

# Ephemeral logs
logs/

# Keep directory structure
!.gitkeep
```

**Rationale**:

- `objects/`: Source code snapshots (redundant with Git)
- `patterns.lancedb/`: Binary embeddings (regenerable from source)
- `logs/`: Ephemeral operation logs

---

### Merge Strategy

**Overlay conflicts**: Use JSON merge tools. Overlays are append-only, so conflicts are rare.

**Regeneration**: If PGC gets corrupted, regenerate with:

```bash
cognition-cli genesis --source src/ --force
```

---

### Backup Strategy

**Option 1: Selective Commit** (recommended)

Commit manifests, exclude binaries. Regenerate embeddings if needed.

**Option 2: Full Backup**

```bash
tar -czf pgc-backup-$(date +%Y%m%d).tar.gz .open_cognition/
```

Store outside repository (large file).

**Option 3: Export .cogx**

```bash
cognition-cli export my-project.cogx
```

Portable, compressed, includes all overlays + metadata.

---

## Key Takeaways

1. **Content-addressable storage** (Git-style)—deduplication + integrity via SHA-256
2. **Transform manifests** (YAML)—full provenance trail for every operation
3. **Index files** (JSON)—fast symbol lookup without re-parsing AST
4. **Overlay-specific storage**—each overlay optimized for its data type
5. **Mission concepts with embeddings**—YAML + 768-dim vectors for coherence
6. **LanceDB for similarity**—fast k-NN queries (~10ms per query)
7. **Mission integrity**—checksums + audit logs detect tampering
8. **Transparency logs**—JSONL append-only audit trail (local, user-controlled)
9. **Selective Git commits**—version control manifests, exclude large binaries
10. **~108MB for 32K LOC**—reasonable storage overhead (3.4 MB per 1K LOC)

**The PGC is the lattice substrate. All cognitive operations depend on this foundation.**

---

**Previous**: [Chapter 1: Cognitive Architecture](01-cognitive-architecture.md)<br/>
**Next**: [Chapter 3: Why Overlays?](03-why-overlays.md)
