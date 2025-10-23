# Patterns Command Review

## Current State Analysis

### Existing Commands

#### 1. `patterns find-similar <symbol>` ✅ (Structural) ⚠️ (Lineage)
**What it does:**
- Vector similarity search to find code structurally similar to a given symbol
- Supports both `--type structural` and `--type lineage`
- Shows similarity score, architectural role, and explanation

**Status:**
- ✅ **Structural patterns**: Fully implemented and working
- ⚠️ **Lineage patterns**: Stub implementation - returns empty array

**Utility:** HIGH - Very useful for finding similar code patterns, refactoring candidates, or understanding architectural consistency.

**Issues:**
- Lineage find-similar is not implemented (just returns `[]`)
- No file path shown in results (where is the similar code?)
- No way to see the actual code snippets

#### 2. `patterns analyze` ✅ (Basic)
**What it does:**
- Shows distribution of architectural roles (controller, service, component, etc.)
- Simple histogram/bar chart of role counts

**Status:**
- ✅ Works for both structural and lineage patterns
- Very basic - just counting

**Utility:** MEDIUM - Useful for high-level architecture overview, but too simplistic.

**Issues:**
- Only shows counts, no deeper insights
- No complexity metrics
- No clustering or pattern identification
- No outlier detection
- Doesn't show relationships between roles

#### 3. `patterns compare <symbol1> <symbol2>` ✅ (Structural) ⚠️ (Lineage)
**What it does:**
- Compares two symbols using cosine similarity
- Shows similarity percentage and both signatures side-by-side

**Status:**
- ✅ **Structural patterns**: Works
- ⚠️ **Lineage patterns**: Stub implementation - getVectorForSymbol returns undefined

**Utility:** MEDIUM - Useful for understanding differences, but doesn't highlight what's actually different.

**Issues:**
- Lineage compare not implemented
- Shows signatures but doesn't diff them
- No highlighting of differences
- No explanation of WHY they're similar/different

---

## Critical Issues

### 1. Lineage Patterns Commands Are Broken ❌
The `LineagePatternsManager` has stub implementations:
```typescript
public async findSimilarPatterns(): Promise<...> {
  return [];  // ← Stub!
}

public async getVectorForSymbol(): Promise<VectorRecord | undefined> {
  return undefined;  // ← Stub!
}
```

**Impact:**
- `patterns find-similar --type lineage` returns no results
- `patterns compare --type lineage` fails (can't find vectors)

**Fix Required:** Implement these methods in `LineagePatternsManager`

### 2. No File Path Information
When finding similar patterns, users don't know WHERE the code is:
```
1. UserManager [service]
   ████████████████████ 95.3%
   Similar class structure with CRUD methods
```

Should show:
```
1. UserManager [service]
   📁 src/modules/users/user-manager.ts:15
   ████████████████████ 95.3%
   Similar class structure with CRUD methods
```

---

## Missing High-Value Commands

### 1. `patterns inspect <symbol>` 🎯 HIGH VALUE
**Purpose:** Deep dive into a single symbol - show everything we know about it

**Output:**
```
📦 Symbol: UserManager
📁 Location: src/modules/users/user-manager.ts:15
🏛️  Architectural Role: service
📊 Structural Signature:
   class UserManager {
     constructor(2 params)
     methods: create, findById, update, delete (4 methods)
     dependencies: Database, Logger
   }

🌳 Lineage (Dependency Tree):
   UserManager
   ├─ Database [data_access] (depth 1)
   │  └─ Connection [utility] (depth 2)
   └─ Logger [utility] (depth 1)

📈 Metrics:
   - Complexity: Medium
   - Method count: 4
   - Dependency depth: 2
   - Similar patterns: 12 found

✅ Validation:
   - All dependencies resolved
   - Structural integrity: OK
   - Lineage complete: OK
```

**Implementation:** Combine data from:
- Structural overlay metadata
- Lineage overlay metadata
- Index (file path, status)
- ObjectStore (actual structural data)

### 2. `patterns list --role <role>` 🎯 MEDIUM VALUE
**Purpose:** List all symbols with a specific architectural role

**Examples:**
```bash
# Show all controllers
cognition-cli patterns list --role controller

# Show all services
cognition-cli patterns list --role service

# Show all with "data_access" role
cognition-cli patterns list --role data_access
```

**Output:**
```
🎯 Controllers (8 found):

1. UserController
   📁 src/api/controllers/user-controller.ts:10
   Dependencies: UserService, ValidationService

2. OrderController
   📁 src/api/controllers/order-controller.ts:15
   Dependencies: OrderService, PaymentService
...
```

### 3. `patterns graph <symbol>` 🎯 HIGH VALUE
**Purpose:** Visualize the dependency graph for a symbol (ASCII art or JSON for external viz)

**ASCII Output:**
```
UserService
├── Database
│   └── ConnectionPool
├── Logger
├── CacheService
│   └── RedisClient
└── ValidationService
    └── SchemaValidator
```

**JSON Output:** For piping to Graphviz, D3.js, etc.
```json
{
  "symbol": "UserService",
  "nodes": [...],
  "edges": [...],
  "depth": 3
}
```

### 4. `patterns diff <symbol1> <symbol2>` 🎯 MEDIUM VALUE
**Purpose:** Show actual differences between two symbols (enhanced compare)

**Output:**
```
⚖️  Comparing UserManager vs OrderManager:

Similarity: ████████████████░░░░ 80.5%

📊 Structural Differences:
  UserManager:
    ✓ create, findById, update, delete
    ✓ constructor(database, logger)

  OrderManager:
    ✓ create, findById, update, delete, cancel, refund  ← 2 extra methods
    ✓ constructor(database, logger, paymentService)     ← 1 extra dependency

🌳 Lineage Differences:
  UserManager depends on: Database, Logger
  OrderManager depends on: Database, Logger, PaymentService  ← Extra dependency

  Common dependencies: Database, Logger
  Unique to OrderManager: PaymentService
```

### 5. `patterns search <query>` 🎯 LOW-MEDIUM VALUE
**Purpose:** Free-text or fuzzy search for patterns

**Examples:**
```bash
# Find patterns mentioning "payment"
cognition-cli patterns search payment

# Find patterns with "create" method
cognition-cli patterns search "method:create"

# Find patterns depending on Database
cognition-cli patterns search "depends:Database"
```

---

## Enhancement Recommendations

### Priority 1: Critical Fixes
1. ✅ **Implement lineage pattern query methods** in `LineagePatternsManager`
   - `findSimilarPatterns(symbol, topK)`
   - `getVectorForSymbol(symbol)`

2. ✅ **Add file paths to all command outputs**
   - Modify return types to include `filePath: string`
   - Update UI rendering to show paths

### Priority 2: High-Value Additions
3. ✅ **Add `patterns inspect <symbol>`** command
   - Comprehensive view of a single symbol
   - Combines structural, lineage, and validation data

4. ✅ **Add `patterns graph <symbol>`** command
   - ASCII tree visualization
   - Optional JSON output for external tools

### Priority 3: Quality of Life
5. ✅ **Add `patterns list --role <role>`** command
   - Filter symbols by architectural role
   - Show file paths and brief descriptions

6. ✅ **Enhance `patterns compare`** with diff highlighting
   - Show what's different, not just similarity score
   - Highlight added/removed methods and dependencies

7. ✅ **Improve `patterns analyze`**
   - Add complexity metrics
   - Show top dependencies
   - Identify outliers (overly complex or isolated patterns)

### Priority 4: Advanced Features
8. 🔮 **Add `patterns search <query>`** command
   - Flexible querying across all patterns
   - Support for filters (role, dependencies, methods, etc.)

9. 🔮 **Add `patterns cluster`** command
   - Automatic clustering of similar patterns
   - Identify architectural "families"

10. 🔮 **Add `patterns suggest-refactor`** command
    - Find duplicate/similar code that should be refactored
    - Identify missing abstractions

---

## Implementation Plan

### Phase 1: Fix Critical Issues (URGENT)
- [ ] Implement `LineagePatternsManager.findSimilarPatterns()`
- [ ] Implement `LineagePatternsManager.getVectorForSymbol()`
- [ ] Add file paths to all command outputs
- [ ] Add tests for lineage pattern queries

### Phase 2: Add Core Commands (HIGH VALUE)
- [ ] Implement `patterns inspect <symbol>`
- [ ] Implement `patterns graph <symbol>`
- [ ] Implement `patterns list --role <role>`

### Phase 3: Enhance Existing Commands
- [ ] Enhance `patterns compare` with diff view
- [ ] Enhance `patterns analyze` with metrics and insights
- [ ] Add `--verbose` flag for detailed output

### Phase 4: Advanced Features (FUTURE)
- [ ] Implement `patterns search <query>`
- [ ] Implement `patterns cluster`
- [ ] Implement `patterns suggest-refactor`
- [ ] Add interactive TUI mode

---

## Testing Strategy

### Unit Tests Needed
1. `LineagePatternsManager.findSimilarPatterns()` - vector similarity search
2. `LineagePatternsManager.getVectorForSymbol()` - vector retrieval
3. New commands: `inspect`, `graph`, `list`

### Integration Tests Needed
1. End-to-end test: Generate overlays → Run all pattern commands
2. Test with real codebase (cognition-cli itself)
3. Performance test with large codebases (1000+ symbols)

### Manual Testing Checklist
- [ ] `patterns find-similar` with `--type lineage` works
- [ ] `patterns compare` with `--type lineage` works
- [ ] All commands show file paths
- [ ] `patterns inspect` shows complete symbol information
- [ ] `patterns graph` produces valid ASCII tree
- [ ] `patterns list` filters by role correctly

---

## Conclusion

The patterns commands have a solid foundation but need:
1. **Critical fixes** for lineage pattern queries
2. **Missing information** like file paths
3. **New commands** for deeper inspection and analysis
4. **Enhanced output** for existing commands

The highest ROI improvements are:
1. Fix lineage pattern stubs (enables `--type lineage`)
2. Add file paths to all outputs
3. Add `patterns inspect` for deep dives
4. Add `patterns graph` for dependency visualization

These changes will make the patterns commands significantly more useful for understanding and navigating large codebases.
