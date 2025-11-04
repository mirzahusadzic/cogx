# 07 - Overlays & Analysis: Multi-Dimensional Understanding

Overlays provide specialized analytical perspectives on your codebase. Each overlay (O₁-O₇) adds a new dimension of understanding while maintaining provenance to the foundation layer.

## Generating Overlays

### **`cognition-cli overlay generate <type> [sourcePath]`**

Generate analytical layers on top of the PGC foundation.

```bash
# Generate all recommended overlays (after genesis)
cognition-cli overlay generate structural_patterns .
cognition-cli overlay generate lineage_patterns .
cognition-cli overlay generate mission_concepts .
cognition-cli overlay generate strategic_coherence .

# Force regeneration after major refactoring
cognition-cli overlay generate structural_patterns . --force

# Skip GC when switching branches
cognition-cli overlay generate lineage_patterns . --skip-gc
```

### Options

- `-p, --project-root <path>` - Project root directory
- `-f, --force` - Force regeneration of all patterns
- `--skip-gc` - Skip garbage collection (use when switching branches)

### Supported Overlay Types

- **`structural_patterns`** (O₁) - Architectural roles and signatures
- **`lineage_patterns`** (O₃) - Dependency provenance through time
- **`mission_concepts`** (O₄) - Strategic documentation concepts
- **`strategic_coherence`** (O₇) - Mission alignment synthesis

---

## O₇: Strategic Coherence Commands

Measure how well your code aligns with mission documentation.

### **`cognition-cli coherence report`**

Overall strategic coherence metrics dashboard.

```bash
# Show coherence dashboard
cognition-cli coherence report

# Get JSON output
cognition-cli coherence report --json
```

**Shows:**

- Analysis scope (symbols, concepts)
- Coherence metrics (average, weighted, lattice)
- Distribution statistics
- Symbol distribution (aligned vs. drifted)

### **`cognition-cli coherence aligned`**

Show symbols strongly aligned with mission.

```bash
# Show aligned symbols (threshold 0.7)
cognition-cli coherence aligned

# Show highly aligned (threshold 0.8)
cognition-cli coherence aligned --min-score 0.8
```

### **`cognition-cli coherence drifted`**

Show symbols that have drifted from mission.

```bash
# Show drifted symbols (threshold 0.7)
cognition-cli coherence drifted

# Show severely drifted (threshold 0.5)
cognition-cli coherence drifted --max-score 0.5
```

### **`cognition-cli coherence for-symbol <symbolName>`**

Detailed mission alignment for specific symbol.

```bash
# Inspect strategic coherence
cognition-cli coherence for-symbol PGCManager

# Get JSON output
cognition-cli coherence for-symbol OverlayOrchestrator --json
```

### **`cognition-cli coherence compare <symbol1> <symbol2>`**

Compare mission alignment of two symbols.

```bash
# Compare alignment
cognition-cli coherence compare PGCManager OracleVerifier
```

**Workflow example:**

```bash
# 1. Generate overlay
cognition-cli overlay generate strategic_coherence .

# 2. Check overall coherence
cognition-cli coherence report

# 3. Find best-aligned components
cognition-cli coherence aligned

# 4. Identify drift areas
cognition-cli coherence drifted

# 5. Deep-dive on specific symbols
cognition-cli coherence for-symbol StrategicCoherenceManager

# 6. Compare architectural choices
cognition-cli coherence compare StructuralWorker LineageWorker
```

---

## O₄: Mission Concepts Commands

Query mission concepts from strategic documentation.

### **`cognition-cli concepts`**

(Specific subcommands TBD - use `concepts --help` for current options)

---

## Blast Radius Analysis

### **`cognition-cli blast-radius <symbol>`**

Analyze complete impact graph when a symbol changes.

```bash
# Analyze impact
cognition-cli blast-radius PGCManager

# Get JSON for CI/CD
cognition-cli blast-radius UserService --json

# Limit depth for large trees
cognition-cli blast-radius OrderManager --max-depth 2
```

**Shows:**

- Total symbols impacted
- Direct consumers and roles
- Critical dependency paths
- Maximum consumer depth
- Risk assessment (low/medium/high/critical)

---

## Auditing Commands

### **`cognition-cli audit:transformations <filePath>`**

Audit transformation history of a specific file.

```bash
# Audit last 5 transformations
cognition-cli audit:transformations src/core/pgc/manager.ts

# Show last 10
cognition-cli audit:transformations src/core/pgc/manager.ts --limit 10
```

Shows:

- Transformation IDs
- Methods used (AST, SLM, LLM)
- Timestamps
- Verification status
- Input/output hashes

### **`cognition-cli audit:docs`**

Audit document integrity in PGC.

```bash
cognition-cli audit:docs
```

---

## O₂: Security Analysis

### **`cognition-cli security`**

Security analysis commands (wraps lattice algebra for O₂).

Use `security --help` for subcommands.

---

## O₅: Operational Workflows

### **`cognition-cli workflow`**

Operational workflow analysis commands.

Use `workflow --help` for subcommands.

---

## O₆: Mathematical Proofs

### **`cognition-cli proofs`**

Mathematical proofs and theorems analysis.

Use `proofs --help` for subcommands.

---

## What's Next?

- **[Command Reference](./08_Command_Reference.md)** - Complete alphabetical listing
- **[Querying the Lattice](./05_Querying_The_Lattice.md)** - Multi-overlay queries
- **[Interactive Mode](./06_Interactive_Mode.md)** - TUI exploration
