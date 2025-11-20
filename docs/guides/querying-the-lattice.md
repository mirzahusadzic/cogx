# 05 - Querying The Lattice: Boolean Algebra Across Overlays

This is where The Lattice shows its power: the ability to query across multiple analytical dimensions simultaneously using Boolean algebra. Like the focused beam of light from the eyes in The Lattice Book cover, these commands let you pierce through complexity to find exactly what you need.

## The Three Query Mechanisms

1. **`lattice`** - Boolean algebra across overlays (O₁ AND O₂, O₃ - O₄, etc.)
2. **`query`** - Basic symbol lookup and dependency traversal
3. **`patterns`** - Structural similarity and architectural analysis

Each serves a different purpose, from simple lookups to complex multi-overlay queries.

---

## Lattice Queries: The Core Power

### **`cognition-cli lattice <query>`**

Execute Boolean algebra operations across overlays. This is the "beam of light" that breaks through the noise.

**The lattice command allows you to:**

- Combine multiple overlay perspectives (O₁ ∧ O₂)
- Find differences between layers (O₁ - O₂)
- Search with filters (O₂[critical])
- Perform similarity searches across layers (O₁ ~ O₄)

```bash
# Basic syntax
cognition-cli lattice "<query>"

# With options
cognition-cli lattice "<query>" --format json --limit 100
```

### Options

- `-p, --project-root <path>` - Root directory of the project
- `-f, --format <format>` - Output format: `table`, `json`, or `summary` (default: `table`)
- `-l, --limit <number>` - Maximum results to show (default: 50)
- `-v, --verbose` - Show detailed error messages

### Overlay Reference

- **O₁** - Structural Patterns (architectural roles, signatures)
- **O₂** - Security Guidelines (vulnerabilities, safety constraints)
- **O₃** - Lineage Patterns (dependency provenance)
- **O₄** - Mission Concepts (strategic alignment)
- **O₅** - Operational Patterns (runtime behaviors)
- **O₆** - Mathematical Proofs (formal verification)
- **O₇** - Strategic Coherence (mission synthesis)

### Boolean Operators

#### Intersection (∧ / AND)

Find elements present in BOTH overlays:

```bash
# Symbols with both structural AND security analysis
cognition-cli lattice "O1 AND O2"

# Short form using ∧
cognition-cli lattice "O1 ∧ O2"
```

**Use case:** "Show me all classes that have both architectural patterns AND security analysis."

#### Union (∨ / OR)

Find elements in EITHER overlay:

```bash
# Symbols in structural OR lineage overlays
cognition-cli lattice "O1 OR O3"

# Short form using ∨
cognition-cli lattice "O1 ∨ O3"
```

**Use case:** "Show me everything that has either structural analysis OR lineage tracking."

#### Difference (- / MINUS)

Find elements in first overlay but NOT in second:

```bash
# Structural patterns WITHOUT security analysis
cognition-cli lattice "O1 - O2"

# Lineage patterns NOT aligned with mission
cognition-cli lattice "O3 - O4"
```

**Use case:** "Find all classes with structural analysis but no security review yet."

#### Similarity (~ / SIMILAR)

Find elements similar across overlays:

```bash
# Structural patterns similar to mission concepts
cognition-cli lattice "O1 ~ O4"

# Security patterns similar to operational patterns
cognition-cli lattice "O2 ~ O5"
```

**Use case:** "Show me code whose structure is similar to our mission documentation."

### Filtered Queries

Add filters to narrow results:

```bash
# Security vulnerabilities marked as critical
cognition-cli lattice "O2[critical]"

# High-severity security issues without fixes
cognition-cli lattice "O2[severity:high] - O2[status:fixed]"

# Mission-aligned concepts with low coherence
cognition-cli lattice "O4[coherence<0.5]"
```

### Complex Queries

Combine multiple operations:

```bash
# Structural patterns with security issues, not yet in lineage
cognition-cli lattice "(O1 ∧ O2) - O3"

# Mission-critical code with low coherence
cognition-cli lattice "O7[coherence<0.7] ∧ O4[priority:high]"

# Similar structural and mission patterns
cognition-cli lattice "(O1 ~ O4) ∧ O7"
```

### Real-World Examples

#### 1. Security Audit

Find all code with structural analysis but no security review:

```bash
cognition-cli lattice "O1 - O2" --format summary
```

**Result:** Lists classes/functions analyzed architecturally but not yet reviewed for security.

#### 2. Mission Drift Detection

Find code with low strategic alignment:

```bash
cognition-cli lattice "O7[coherence<0.6]" --limit 20
```

**Result:** Top 20 symbols drifting from mission goals.

#### 3. Refactoring Candidates

Find structurally complex code with no formal proofs:

```bash
cognition-cli lattice "O1[complexity:high] - O6"
```

**Result:** Complex code that would benefit from formal verification.

#### 4. Architectural Consistency

Find lineage patterns similar to structural patterns:

```bash
cognition-cli lattice "O3 ~ O1" --format json
```

**Result:** Dependencies that match expected architectural patterns.

### Output Formats

#### Table Format (Default)

```bash
$ cognition-cli lattice "O1 AND O2"

┌─────────────────────┬──────────────────────────┬──────────────┬────────────┐
│ Symbol              │ File                     │ O1 Role      │ O2 Status  │
├─────────────────────┼──────────────────────────┼──────────────┼────────────┤
│ AuthManager         │ src/core/auth.ts         │ service      │ reviewed   │
│ UserValidator       │ src/validators/user.ts   │ utility      │ reviewed   │
│ TokenGenerator      │ src/auth/token.ts        │ component    │ pending    │
└─────────────────────┴──────────────────────────┴──────────────┴────────────┘

Found 3 symbols matching query: O1 AND O2
```

#### JSON Format

```bash
$ cognition-cli lattice "O1 - O2" --format json

{
  "query": "O1 - O2",
  "results": [
    {
      "symbol": "DatabaseManager",
      "file": "src/core/db.ts",
      "overlays": {
        "O1": {
          "role": "service",
          "complexity": "high"
        }
      }
    }
  ],
  "count": 1,
  "metadata": {
    "execution_time_ms": 45,
    "overlays_queried": ["O1", "O2"]
  }
}
```

#### Summary Format

```bash
$ cognition-cli lattice "O2[critical]" --format summary

Query: O2[critical]
Total Results: 5

Distribution by Severity:
  Critical: 3
  High: 2

Top Files:
  src/auth/login.ts (2 issues)
  src/api/handler.ts (2 issues)
  src/db/query.ts (1 issue)

Recommendation: Address critical security issues in auth and API layers first.
```

---

## Basic Queries: Symbol Lookup

### **`cognition-cli query <symbol>`**

Direct symbol lookup and dependency traversal through the PGC.

**When to use:** When you need to find a specific symbol and trace its dependency chain.

```bash
# Find a symbol
cognition-cli query UserManager

# Trace dependencies 1 level deep
cognition-cli query UserManager --depth 1

# Trace 3 levels deep
cognition-cli query UserManager --depth 3

# Get full lineage as JSON
cognition-cli query UserManager --lineage
```

### Options

- `-p, --project-root <path>` - Root directory (default: current)
- `-d, --depth <level>` - Depth of dependency traversal (default: 0)
- `--lineage` - Output dependency lineage in JSON format

### Example Output

```bash
$ cognition-cli query UserManager --depth 2

Found: UserManager
File: src/core/user-manager.ts
Type: class

Dependencies (depth 1):
  → AuthService (src/auth/service.ts)
  → Database (src/core/database.ts)
  → Logger (src/utils/logger.ts)

Dependencies (depth 2):
  → AuthService
    → TokenValidator (src/auth/token-validator.ts)
    → PermissionChecker (src/auth/permissions.ts)
  → Database
    → ConnectionPool (src/db/pool.ts)
```

### Lineage JSON

```bash
$ cognition-cli query UserManager --lineage | jq .

{
  "symbol": "UserManager",
  "file": "src/core/user-manager.ts",
  "structural_hash": "abc123...",
  "dependencies": [
    {
      "symbol": "AuthService",
      "file": "src/auth/service.ts",
      "depth": 1,
      "dependencies": [...]
    }
  ]
}
```

---

## Pattern Queries: Architectural Analysis

### **`cognition-cli patterns`**

Suite of commands for querying structural patterns and finding architectural similarities.

---

### `patterns list`

List all symbols with their architectural roles.

```bash
# List all patterns
cognition-cli patterns list

# Filter by architectural role
cognition-cli patterns list --role component
cognition-cli patterns list --role service
cognition-cli patterns list --role utility

# Get raw JSON
cognition-cli patterns list --json
```

**Example output:**

```bash
$ cognition-cli patterns list --role service

Structural Patterns (role: service)

AuthService
  File: src/auth/service.ts
  Role: service
  Complexity: medium

DatabaseService
  File: src/db/service.ts
  Role: service
  Complexity: high

Found 2 services
```

---

### `patterns analyze`

Get high-level architectural distribution statistics.

```bash
# Analyze structural patterns
cognition-cli patterns analyze

# Show detailed breakdown
cognition-cli patterns analyze --verbose

# Analyze lineage patterns
cognition-cli patterns analyze --type lineage
```

**Example output:**

```bash
$ cognition-cli patterns analyze

Architectural Pattern Distribution

Components: 12 (30%)
Services: 8 (20%)
Utilities: 15 (37.5%)
Types: 5 (12.5%)

Total Symbols: 40

Complexity Distribution:
  Low: 18
  Medium: 15
  High: 7
```

---

### `patterns inspect <symbol>`

Detailed information about a specific symbol.

```bash
# Inspect a symbol
cognition-cli patterns inspect UserManager

# Get JSON output
cognition-cli patterns inspect UserManager --json
```

**Example output:**

```bash
$ cognition-cli patterns inspect UserManager

Symbol: UserManager
File: src/core/user-manager.ts
Role: service
Complexity: high

Structural Signature:
  class:UserManager | methods:12 | imports:8 | complexity:high

Dependencies (3):
  → AuthService
  → Database
  → Logger

Consumers (5):
  ← UserController
  ← AdminController
  ← ProfileHandler
  ← LoginFlow
  ← RegistrationFlow

Lineage Hash: def456...
Computed At: 2025-10-24T10:30:00Z
```

---

### `patterns graph <symbol>`

Visualize dependency tree for a symbol.

```bash
# Show full dependency graph (both directions)
cognition-cli patterns graph UserManager

# Show only dependencies (upstream)
cognition-cli patterns graph UserManager --direction up

# Show only consumers (downstream)
cognition-cli patterns graph UserManager --direction down

# Limit traversal depth
cognition-cli patterns graph UserManager --max-depth 2
```

**Example output:**

```bash
$ cognition-cli patterns graph UserManager --direction down

Dependency Graph for UserManager

UserManager (service)
├── UserController (controller)
│   ├── ApiRouter (router)
│   └── Middleware (utility)
├── AdminController (controller)
│   └── AdminRouter (router)
└── ProfileHandler (component)
    └── ProfileView (view)

Total consumers: 5 (depth: 3)
```

---

### `patterns find-similar <symbol>`

Find architecturally similar code based on vector embeddings.

```bash
# Find 5 similar symbols
cognition-cli patterns find-similar UserManager --top-k 5

# Find similar lineage patterns
cognition-cli patterns find-similar UserService --type lineage

# Get JSON output
cognition-cli patterns find-similar OrderManager --json
```

**Example output:**

```bash
$ cognition-cli patterns find-similar UserManager --top-k 3

Symbols Similar to UserManager

1. OrderManager (similarity: 0.92)
   File: src/orders/manager.ts
   Role: service
   Why: Similar service pattern, comparable method count

2. ProductManager (similarity: 0.87)
   File: src/products/manager.ts
   Role: service
   Why: Similar dependency structure, matching complexity

3. CartManager (similarity: 0.81)
   File: src/cart/manager.ts
   Role: service
   Why: Similar architectural role, related domain
```

---

### `patterns compare <symbol1> <symbol2>`

Compare two symbols side-by-side.

```bash
# Compare structural patterns
cognition-cli patterns compare UserManager OrderManager

# Compare lineage patterns
cognition-cli patterns compare UserService OrderService --type lineage
```

**Example output:**

```bash
$ cognition-cli patterns compare UserManager OrderManager

Comparing: UserManager vs OrderManager

Similarity Score: 0.89 (high)

            │ UserManager         │ OrderManager
────────────┼─────────────────────┼──────────────────────
File        │ src/core/user.ts    │ src/orders/manager.ts
Role        │ service             │ service
Complexity  │ high                │ medium
Methods     │ 12                  │ 9
Dependencies│ 8                   │ 6
Consumers   │ 5                   │ 4

Common Patterns:
  ✓ Both are service-layer managers
  ✓ Both use AuthService
  ✓ Both interact with Database
  ✓ Similar method signatures

Key Differences:
  ✗ UserManager has higher complexity
  ✗ OrderManager has fewer dependencies
```

---

## Combining Query Types

The real power comes from combining lattice algebra with pattern analysis:

### Example Workflow: Security Review

```bash
# 1. Find structural patterns without security review
cognition-cli lattice "O1 - O2" --format summary

# 2. Inspect the most complex one
cognition-cli patterns inspect ComplexService

# 3. Check its consumers (blast radius)
cognition-cli patterns graph ComplexService --direction down

# 4. Find similar code that might need review too
cognition-cli patterns find-similar ComplexService
```

### Example Workflow: Refactoring Planning

```bash
# 1. Find high-complexity code with low mission alignment
cognition-cli lattice "O1[complexity:high] ∧ O7[coherence<0.6]"

# 2. Compare with well-aligned similar code
cognition-cli patterns compare ProblematicClass WellAlignedClass

# 3. Check impact of changing it
cognition-cli blast-radius ProblematicClass

# 4. Find its lineage to understand dependencies
cognition-cli query ProblematicClass --depth 3 --lineage
```

---

## Performance Tips

1. **Use filters** - Narrow results with O₁[role:service] instead of getting everything
2. **Limit results** - Use `--limit` for large queries
3. **Cache-friendly** - Repeated queries are fast (LanceDB caching)
4. **JSON for scripting** - Parse with `jq` for automation
5. **Start simple** - Test with basic queries before complex Boolean algebra

---

## What's Next?

Now that you understand querying, explore:

- **[Interactive Mode](./interactive-mode.md)** - TUI for visual exploration
- **[Seven Overlays](../architecture/overlays/README.md)** - Deep dive on each overlay type
- **[CLI Commands](../reference/cli-commands.md)** - Complete command reference
