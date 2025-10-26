# Quick Start: Claude Code + cognition-cli

Get up and running with verifiable AI cognition in 5 minutes.

---

## Prerequisites

**Required:**

- Node.js 18+
- npm or yarn
- A TypeScript/JavaScript project
- [Claude Code](https://docs.claude.com/claude-code) installed (optional but recommended)

**Optional:**

- Git (for provenance tracking)
- Docker (for eGemma embedding service)

---

## Installation

### Option 1: NPM (Coming Soon)

```bash
npm install -g cognition-cli
```

### Option 2: From Source

```bash
# Clone the repository
git clone https://github.com/mirzahusadzic/cogx.git
cd cogx/src/cognition-cli

# Install dependencies
npm install

# Build
npm run build

# Link globally
npm link

# Verify installation
cognition-cli --version
```

---

## 5-Minute Setup

### Step 1: Initialize PGC (30 seconds)

```bash
# Navigate to your project
cd ~/projects/my-app

# Initialize the Grounded Context Pool
cognition-cli init
```

**What this creates:**

```text
.open_cognition/
├── objects/       # Content-addressable storage
├── logs/          # Transformation audit trail
├── index/         # Fast lookup indices
└── overlays/      # Analytical overlay data
```

---

### Step 2: Extract Structural Patterns (1-2 minutes)

```bash
# Analyze your codebase
cognition-cli genesis

# Or analyze specific directory
cognition-cli genesis src/
```

**What happens:**

- Parses TypeScript/JavaScript files
- Extracts classes, functions, types
- Computes cryptographic hashes
- Stores in `.open_cognition/`

**Output example:**

```text
Scanning for files in: /project/src
Found 47 files

Processing: 47 native (TS/JS), 0 remote (Python)
[Genesis] Initializing 8 workers for parallel AST parsing
[Genesis] Native parsing complete: 47 succeeded, 0 failed

✓ Structural patterns extracted: 163 symbols
```

---

### Step 3: Verify It Works (30 seconds)

```bash
# List extracted patterns
cognition-cli patterns list

# Analyze architecture
cognition-cli patterns analyze

# Inspect a specific symbol
cognition-cli patterns inspect YourClassName
```

**You should see:**

- All your classes, functions, types listed
- Architectural role distribution
- Cryptographic hashes for each symbol

---

### Step 4: Generate Overlays (1 minute)

```bash
# Generate lineage patterns (dependencies)
cognition-cli overlay generate lineage_patterns

# List available overlays
cognition-cli overlay list
```

**Output:**

```text
Available Overlays:
✓ structural_patterns (163 symbols)
✓ lineage_patterns (163 patterns)
```

---

### Step 5: Use with Claude Code (1 minute)

**Open Claude Code in your project:**

```bash
# Start watch mode in terminal
cognition-cli watch
```

**Then in Claude Code, try:**

> "Query the PGC for all manager classes"
>
> "Show me the dependency graph for PGCManager"
>
> "What architectural patterns do we use?"

Claude will now use the PGC metadata instead of reading source files directly!

---

## Optional: Mission Alignment (O₃/O₄)

If you have a `VISION.md` or strategic documentation:

### Step 6: Ingest Strategic Docs (1 minute)

```bash
# Ingest VISION.md
cognition-cli genesis:docs VISION.md

# Or entire docs/ directory
cognition-cli genesis:docs docs/ --recursive
```

---

### Step 7: Extract Mission Concepts (30 seconds)

```bash
# Generate O₃ layer (Mission Concepts)
cognition-cli overlay generate mission_concepts

# View extracted concepts
cognition-cli concepts list
```

**Output:**

```text
Mission Concepts Extracted: 26 concepts

Vision:
• "Augment human consciousness through verifiable AI-human symbiosis"
• "Cryptographic truth anchoring intelligence"
• "Structured understanding"
...
```

---

### Step 8: Compute Strategic Coherence (1 minute)

```bash
# Generate O₄ layer (Strategic Coherence)
cognition-cli overlay generate strategic_coherence

# View coherence report
cognition-cli coherence report
```

**Output:**

```text
📊 Strategic Coherence Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Analysis Scope:
  Code symbols analyzed:   163
  Mission concepts:        26

Coherence Metrics:
  Average coherence:       0.372
  Alignment threshold:     ≥ 0.7

Symbol Distribution:
  ✓ Aligned:               8 (4.9%)
  ⚠ Drifted:               155 (95.1%)
```

---

### Step 9: Check Alignment (30 seconds)

```bash
# See which code aligns with mission
cognition-cli coherence aligned

# See which code has drifted
cognition-cli coherence drifted

# Check specific symbol
cognition-cli coherence for-symbol StrategicCoherenceManager
```

---

## Next Steps

### Enable Real-Time Monitoring

```bash
# Terminal 1: Watch mode (auto-update PGC)
cognition-cli watch

# Terminal 2: Develop with Claude Code
```

Now every file save automatically updates the PGC!

---

### Create Slash Commands for Claude Code

Create `.claude/commands/analyze.md`:

```markdown
---
description: Analyze the codebase using PGC
---

1. Run `cognition-cli patterns analyze` to see architectural distribution
2. Use the PGC metadata to answer the user's question
3. Do NOT read source files directly - use PGC queries instead
```

Then in Claude Code:

```text
/analyze
```

---

### Pre-Commit Hook (Git Integration)

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Update PGC before commit
cognition-cli update

# Check coherence
echo "Checking strategic coherence..."
cognition-cli coherence report

exit 0
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

---

## Common Workflows

### Daily Development

```bash
# Morning: Check PGC state
cognition-cli status

# During development: Watch mode
cognition-cli watch

# Before commit: Update & check
cognition-cli update
cognition-cli coherence report
```

---

### Code Review

```bash
# Check blast radius of changes
cognition-cli blast-radius ModifiedClass

# Compare old vs new patterns
cognition-cli patterns compare OldClass NewClass

# Check if changes align with mission
cognition-cli coherence drifted
```

---

### Architecture Exploration

```bash
# See all architectural patterns
cognition-cli patterns analyze --verbose

# Find similar components
cognition-cli patterns find-similar PGCManager

# Visualize dependencies
cognition-cli patterns graph OverlayOrchestrator
```

---

## Troubleshooting

### PGC out of sync

```bash
# Force full rebuild
cognition-cli genesis --force

# Force overlay regeneration
cognition-cli overlay generate structural_patterns --force
```

---

### Missing patterns

```bash
# Check status
cognition-cli status

# Update incrementally
cognition-cli update
```

---

### Coherence not working

```bash
# Ensure all overlays are generated
cognition-cli overlay list

# Regenerate mission concepts
cognition-cli overlay generate mission_concepts --force

# Regenerate strategic coherence
cognition-cli overlay generate strategic_coherence --force
```

---

## What's Next?

- **[Command Reference](./command-reference.md)** - Complete command documentation
- **[Real-World Workflows](./workflows.md)** - End-to-end examples
- **[Integration Patterns](./integration-patterns.md)** - Common patterns
- **[Best Practices](./best-practices.md)** - Recommended approaches

---

## Success Criteria

You've successfully set up cognition-cli if:

✅ `.open_cognition/` directory exists
✅ `cognition-cli patterns list` shows your code
✅ `cognition-cli patterns analyze` shows architectural distribution
✅ `cognition-cli overlay list` shows generated overlays
✅ Claude Code can query PGC metadata

**Welcome to verifiable AI cognition!** 🚀
